
"use client";

import React from "react";
import {
    Loader2, Check, XCircle, Plus, History, ChevronLeft,
    FileSpreadsheet, FileText, Maximize2, Minimize2,
    Eye, ArrowRight, Trash2, Brain, UploadCloud, MessageSquare, Clock,
    X, Send, Bot, Activity, Paperclip, CheckCircle2, TrendingUp, Ship, Users, Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { useTaskStore } from "@/store/task-store";
import { useCommercialStore } from "@/store/commercial-store";
import { useSession } from "next-auth/react";
import { AIAgent, fileToBase64, ExpenseData } from "@/lib/ai-agent";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// -- Types -----------------------------------------------------
interface ActionCardItem {
    id: string;
    entityType: "sales" | "shipment" | "source" | "meeting" | "task" | "market_price";
    title: string;
    subtitle: string;
    amount?: number;
    status: string;
    date: string;
    createdBy: string;
    description?: string;
    priority?: string;
    extra?: Record<string, string>;
    actions: string[];
}

interface Message {
    id: string;
    role: "user" | "assistant";
    text: string;
    type?: "text" | "expense_draft" | "action_cards" | "detail_card" | "chart_widget" | "report_download";
    data?: any;
    imageUrl?: string;
    fileName?: string;
    fileType?: string;
}

interface ChatSession {
    id: string;
    title: string;
    messages: Message[];
    createdAt: string;
}

const SKEY = (uid: string) => `ctos-chats-${uid}`;
function loadSessions(uid: string): ChatSession[] {
    try { return JSON.parse(localStorage.getItem(SKEY(uid)) || "[]"); } catch { return []; }
}
function saveSessions(uid: string, s: ChatSession[]) {
    try { localStorage.setItem(SKEY(uid), JSON.stringify(s)); } catch { }
}

const ACTION_STYLE: Record<string, string> = {
    approve: "bg-emerald-500 hover:bg-emerald-600 text-white",
    approve_task: "bg-emerald-500 hover:bg-emerald-600 text-white",
    reject: "bg-red-500 hover:bg-red-600 text-white",
    submit: "bg-blue-500 hover:bg-blue-600 text-white",
    delete: "bg-red-500/80 hover:bg-red-600 text-white",
    move_progress: "bg-blue-500 hover:bg-blue-600 text-white",
    detail: "bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-foreground",
};
const ACTION_ICON: Record<string, React.ReactNode> = {
    approve: <Check className="w-3 h-3" />, approve_task: <Check className="w-3 h-3" />,
    reject: <XCircle className="w-3 h-3" />, submit: <UploadCloud className="w-3 h-3" />,
    delete: <Trash2 className="w-3 h-3" />, move_progress: <ArrowRight className="w-3 h-3" />,
    detail: <Eye className="w-3 h-3" />,
};
const ACTION_LABEL: Record<string, string> = {
    approve: "Approve", approve_task: "Approve", reject: "Reject",
    submit: "Submit", delete: "Hapus", move_progress: "Next Stage", detail: "Detail",
};

const fc = (n: number) => `$${n.toLocaleString("en-US")}`;
const fd = (d: string | Date | undefined | null) => {
    if (!d) return "-";
    try {
        return new Date(d).toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    } catch {
        return "-";
    }
};

export function AIChatbot() {
    const { data: session } = useSession();
    const currentUser = (session?.user as any) || { id: "", name: "Guest", role: "guest", email: "" };
    const hasPermission = (permission: string) => {
        const role = currentUser?.role?.toLowerCase();
        // Allow all roles defined in our system
        return ["ceo", "director", "marketing", "purchasing", "operation", "manager"].includes(role);
    };

    // Commercial store entities
    const { deals, shipments, sources, marketPrices, meetings, plForecasts, addDeal, addMeeting, addShipment, updateShipment, deleteShipment } = useCommercialStore();

    const [open, setOpen] = React.useState(false);
    const [maximized, setMaximized] = React.useState(false);
    const [showHistory, setShowHistory] = React.useState(false);

    const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY || "";
    const model = "meta-llama/llama-4-scout-17b-16e-instruct";

    const [sessions, setSessions] = React.useState<ChatSession[]>([]);
    const [activeSessionId, setActiveSessionId] = React.useState("");
    const [completedActions, setCompletedActions] = React.useState<Set<string>>(new Set());
    const [detailModal, setDetailModal] = React.useState<{ item: ActionCardItem; entityType: string } | null>(null);
    const [commentInput, setCommentInput] = React.useState("");
    const [input, setInput] = React.useState("");
    const [isTyping, setIsTyping] = React.useState(false);
    const [thinkingStep, setThinkingStep] = React.useState("");
    const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
    const [imagePreview, setImagePreview] = React.useState<string | null>(null);
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const welcomeMsg = React.useCallback((): Message => ({
        id: "welcome-" + Date.now().toString(),
        role: "assistant",
        text: `Halo ${currentUser.name} !Saya CoalTrade Copilot.Saya bisa membantu Anda membuat Sales Deal baru, melacak pengiriman kapal, mencari data spesifikasi supplier, atau menampilkan ringkasan P & L.Ketikkan apa yang Anda inginkan.`,
    }), [currentUser.name]);

    React.useEffect(() => {
        if (!currentUser?.id) return;
        fetch("/api/chat/history").then(r => r.json()).then(data => {
            if (data && data.length > 0) {
                const formattedMessages = data.map((msg: any) => ({
                    id: msg.id, role: msg.role, text: msg.content
                }));
                const ns: ChatSession = { id: "db-session", title: "History", messages: [welcomeMsg(), ...formattedMessages], createdAt: new Date().toISOString() };
                setSessions([ns]); setActiveSessionId(ns.id);
            } else {
                const ns: ChatSession = { id: Date.now().toString(), title: "Percakapan Baru", messages: [welcomeMsg()], createdAt: new Date().toISOString() };
                setSessions([ns]); setActiveSessionId(ns.id);
            }
        }).catch(console.error);
    }, [currentUser?.id, welcomeMsg]);

    const activeSession = sessions.find(s => s.id === activeSessionId);
    const messages = activeSession?.messages || [welcomeMsg()];

    const updateMessages = (nm: Message[]) => {
        setSessions((prev) => {
            const u = prev.map((s) => s.id === activeSessionId ? { ...s, messages: nm } : s);
            saveSessions(currentUser.id, u); return u;
        });
    };

    const buildSystemPrompt = (): string => {
        const activeShipments = shipments.filter(s => s.status !== "completed" && s.status !== "cancelled");
        const confirmedDeals = deals.filter(d => d.status === "confirmed");
        const preSaleDeals = deals.filter(d => d.status === "pre_sale");
        const totalRevenue = confirmedDeals.reduce((s, d) => s + (d.total_value || d.quantity * (d.price_per_mt || 0)), 0);

        const nameStr = currentUser?.name?.toLowerCase() || "";
        // Relax checking: if attendee string includes name, or if it's the creator
        const myMeetings = meetings.filter(m =>
            (m.attendees && m.attendees.some(a => a.toLowerCase().includes(nameStr))) ||
            m.created_by === currentUser?.id ||
            true // Let's just pass all active meetings to the AI for better context since it's an executive dashboard
        );

        const now = new Date();
        const recentMeetings = myMeetings
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .slice(-5); // Get all meetings and send top 5 to AI

        const isExecutive = currentUser?.role === "ceo" || currentUser?.role === "director";
        const hasSalesAccess = hasPermission("sales_monitor");
        const hasSourceAccess = hasPermission("source_management");

        return `Kamu adalah CoalTrade Copilot, asisten bisnis profesional eksekutif untuk sistem CoalTradeOS.
User: ${currentUser?.name || "User"} (${currentUser?.role || "STAFF"}).

### Jadwal Meeting Terdekat (${recentMeetings.length}):
${recentMeetings.length > 0 ? recentMeetings.map((m, i) => `${i + 1}. ${m.title} pada ${new Date(m.date).toLocaleDateString("id-ID")} ${m.time} (${m.location}). Status: ${m.status}`).join('\n') : '- Tidak ada jadwal meeting aktif.'}


## ATURAN FORMAT & GAYA BAHASA — WAJIB DIIKUTI:

1. **GAYA BAHASA & RESPON**:
   - Selalu gunakan bahasa yang sangat profesional, ringkas, dan to the point.
   - Hindari penggunaan kata-kata filler.
   - DILARANG KERAS MENGGUNAKAN EMOJI APAPUN DALAM RESPON ANDA.
   - JANGAN PERNAH merangkum atau menyebutkan semua isi "DATA KONTEKS LIVE" secara otomatis. Jawab HANYA apa yang ditanyakan user. Jika ditanya fitur, cukup sebutkan fungsinya tanpa melampirkan isi datanya.

2. **FORMAT JAWABAN (MARKDOWN)**:
   - Gunakan **bold** untuk metrik penting dan penekanan.
   - Gunakan bullet list dengan tanda dash (-) untuk menyebutkan daftar item.
   - Gunakan numbered list (1., 2.) untuk urutan proses.
   - Gunakan tabel Markdown untuk perbandingan data (min 2 kolom).
   - Gunakan heading (###) untuk pembatas bagian laporan.

3. **Struktur Jawaban**: Selalu berikan jawaban terstruktur:
   - Mulai dengan ringkasan 1 kalimat.
   - Jika membutuhkan rincian data, tampilkan dalam tabel atau bullet list spesifik sesuai pertanyaan.
   - Akhiri dengan saran/next step jika relevan.

4. **Panjang Jawaban**:
   - Pertanyaan singkat/sapaan santai → jawab 2-3 kalimat saja, JANGAN menampilkan data.
   - Pertanyaan overview → ringkasan singkat + metrik yang diminta.
   - Pertanyaan detail → pelengkap dengan section heading.

5. **AKSI CRUD — WAJIB KONFIRMASI DULU (2 TAHAP)**:
   JANGAN PERNAH langsung mengeluarkan ACTION command pada respon pertama.
   
   **TAHAP 1 — Kumpulkan Informasi Lengkap:**
   Jika user meminta membuat/edit/hapus data (deal, meeting, shipment, dll), SELALU tanyakan detail yang belum lengkap. Contoh:
   - User: "Buat meeting tanggal 28 Februari" → Kamu jawab: "Baik, saya butuh detail tambahan untuk menjadwalkan meeting: 1. Judul meeting? 2. Jam berapa? 3. Lokasi (opsional)? 4. Siapa saja pesertanya?"
   - User: "Buat sales deal 50k MT" → Kamu jawab: "Untuk membuat Draft Sales Deal, saya butuhkan detail berikut: 1. Nama Buyer? 2. Harga per MT (USD)? 3. Spesifikasi GAR target?"
   
   **TAHAP 2 — Konfirmasi Sebelum Eksekusi:**
   Setelah semua data terkumpul, SELALU tampilkan ringkasan dan minta konfirmasi TEGAS dari user. Contoh:
   "Baik, saya akan membuat Sales Deal dengan detail berikut:
   - **Buyer:** PT Indo Coal
   - **Volume:** 50,000 MT
   - **Harga:** $75/MT
   - **GAR:** 4200
   Apakah data di atas sudah benar? Jawab **Ya** untuk melanjutkan."
   
   **TAHAP 3 — Eksekusi (HANYA setelah user jawab Ya/Benar/Oke/Setuju):**
   BARU keluarkan ACTION command setelah mendapat jawaban afirmatif:
   <<<ACTION_CREATE_DEAL: {"buyer":"PT Indo Coal", "quantity": 50000, "price": 75, "gar": 4200}>>>
   <<<ACTION_CREATE_MEETING: {"title":"Judul", "date": "YYYY-MM-DD"}>>>
    <<<ACTION_CREATE_SHIPMENT: {"buyer":"KEPCO", "supplier":"PT Borneo Coal", "vessel_name":"MV Star", "quantity_loaded":50000, "loading_port":"Samarinda", "discharge_port":"Incheon", "type":"export"}>>>
    <<<ACTION_UPDATE_SHIPMENT: {"id":"sh-xxx", "status":"in_transit", "vessel_name":"MV New Star"}>>>
    <<<ACTION_DELETE_SHIPMENT: {"id":"sh-xxx"}>>>
   <<<ACTION_GENERATE_REPORT: {"module": "shipment", "title": "Laporan"}>>>
   
   INGAT: Jika user belum memberikan konfirmasi jelas (Ya/Benar/Oke/OK/Setuju/Lanjut), JANGAN keluarkan ACTION command.

6. Bahasa Indonesia default, English jika user berbicara Inggris.

7. **LAPORAN / REPORT / PDF — WAJIB TRIGGER ACTION**:
   Jika user meminta membuat/generate/download laporan, report, atau PDF (contoh: "buat laporan shipment", "generate laporan pengiriman", "download report sales"), WAJIB keluarkan ACTION command berikut LANGSUNG tanpa menulis isi laporan secara manual:
   <<<ACTION_GENERATE_REPORT: {"module": "shipment", "title": "Laporan Pengiriman Terbaru"}>>>
   
   Module yang valid: "shipment", "sales", "source", "quality", "meeting", "blending"
   JANGAN pernah menulis isi laporan secara manual dalam format teks. SELALU trigger ACTION_GENERATE_REPORT agar sistem otomatis generate PDF.

## CONTOH JAWABAN BENAR:

**User: "bisa bantu apa?"**

Saya dapat membantu Anda mengelola metrik operasional berikut:

- **Sales Monitor** — Memantau status pipelines dan inisiasi kontrak.
- **Shipment Tracking** — Melacak posisi vessel, status muat, dan item tertunda.
- **Supplier Database** — Mengumpulkan informasi kalori, stok, dan status kepatuhan (KYC/PSI).
- **Blending Simulator** — Menghitung rasio campuran spesifikasi kargo.
- **Market Price** — Menyajikan tren harga indeks global.
- **Laporan P&L** — Menganalisis proyeksi profit margin.
- **Meeting & Tasks** — Mengelola penjadwalan efisien.

**User: "berapa total stok?"**

Total inventaris yang tersedia saat ini: **${sources.reduce((s, src) => s + src.stock_available, 0).toLocaleString("en-US")} MT** (berasal dari ${sources.length} supplier aktif).

| Supplier | Region | Stok |
|----------|--------|------|
${sources.slice(0, 5).map(s => `| ${s.name} | ${s.region} | ${s.stock_available.toLocaleString("en-US")} MT |`).join("\n")}

## DATA KONTEKS LIVE:

${hasSalesAccess ? `### Sales Pipeline
- Total Deals: **${deals.length}** (${confirmedDeals.length} confirmed, ${preSaleDeals.length} pre-sale)
${isExecutive ? `- Revenue YTD: **$${(totalRevenue / 1000).toFixed(0)}K**` : ''}
${deals.slice(0, 5).map(d => `- ${d.buyer} — ${d.quantity.toLocaleString("en-US")} MT — ${d.status}`).join("\n")}` : ''}

### Active Shipments: ${activeShipments.length}
${activeShipments.slice(0, 3).map(s => `- ${s.buyer} via ${s.vessel_name || s.barge_name || 'TBA'} — ${s.status}${s.pending_items?.length ? ` (${s.pending_items.length} pending)` : ''}`).join("\n")}

${hasSourceAccess ? `### Suppliers: ${sources.length}
${sources.slice(0, 5).map(s => `- ${s.name} (GAR ${s.spec?.gar || 'TBA'}) — ${s.region} — KYC: ${s.kyc_status}`).join("\n")}` : ''}

${isExecutive ? `### Market Price (Latest)
${marketPrices[0] ? `- ICI 4 (4200): $${marketPrices[0].ici_4}\n- Newcastle: $${marketPrices[0].newcastle}\n- HBA: $${marketPrices[0].hba}` : '- Belum ada data'}

### P&L Entries: ${plForecasts.length}` : ''}`;
    };

    const processActionCommands = (text: string) => {
        let cleanText = text;
        const dealMatch = text.match(/<<<ACTION_CREATE_DEAL:\s*({.*})>>>/);
        if (dealMatch) {
            try {
                const data = JSON.parse(dealMatch[1]);
                addDeal({
                    buyer: data.buyer || "Unknown Buyer",
                    buyer_country: "TBD",
                    type: "export",
                    shipping_terms: "FOB",
                    quantity: data.quantity || 0,
                    price_per_mt: data.price || 0,
                    status: "pre_sale",
                    pic_id: currentUser.id,
                    pic_name: currentUser.name,
                    created_by: currentUser.id,
                    created_by_name: currentUser.name,
                    spec: { gar: data.gar || 0, ts: 0, ash: 0, tm: 0 }
                });
                cleanText = cleanText.replace(dealMatch[0], "").trim() + "\n\n**Sistem telah membuat Draft Sales Deal secara otomatis.** Klik tab Sales Monitor untuk melihat detailnya.";
            } catch (e) {
                console.error("Failed to parse deal action JSON");
            }
        }

        const meetingMatch = text.match(/<<<ACTION_CREATE_MEETING:\s*({.*})>>>/);
        if (meetingMatch) {
            try {
                const data = JSON.parse(meetingMatch[1]);
                addMeeting({
                    title: data.title || "New Meeting",
                    date: data.date || new Date().toISOString().split("T")[0],
                    time: "09:00",
                    location: "Online",
                    status: "scheduled",
                    attendees: [currentUser.name],
                    action_items: [],
                    created_by: currentUser.id,
                    created_by_name: currentUser.name
                });
                cleanText = cleanText.replace(meetingMatch[0], "").trim() + "\n\n**Sistem telah menjadwalkan Meeting baru.** Silakan cek halaman Meetings.";
            } catch (e) { }
        }

        // Shipment Create
        const shipmentCreateMatch = text.match(/<<<ACTION_CREATE_SHIPMENT:\s*({[\s\S]*?})>>>/);
        if (shipmentCreateMatch) {
            try {
                const data = JSON.parse(shipmentCreateMatch[1]);
                addShipment({
                    deal_id: data.deal_id || "",
                    status: "waiting_loading",
                    buyer: data.buyer || "Unknown Buyer",
                    supplier: data.supplier || "Unknown Supplier",
                    vessel_name: data.vessel_name || "",
                    barge_name: data.barge_name || "",
                    loading_port: data.loading_port || "",
                    discharge_port: data.discharge_port || "",
                    quantity_loaded: data.quantity_loaded || 0,
                    bl_date: data.bl_date || "",
                    eta: data.eta || "",
                    sales_price: data.sales_price || 0,
                    margin_mt: data.margin_mt || 0,
                    is_blending: data.is_blending || false,
                    iup_op: data.iup_op || "",
                    pic_id: currentUser.id,
                    pic_name: currentUser.name,
                    buyer_country: data.buyer_country || "",
                    type: data.type || "export",
                    region: data.region || "",
                } as any);
                cleanText = cleanText.replace(shipmentCreateMatch[0], "").trim() + "\n\n**Sistem telah membuat Shipment baru dengan status Waiting Loading.** Cek halaman Shipment Monitor.";
            } catch (e) { console.error("Failed to parse shipment create action"); }
        }

        // Shipment Update
        const shipmentUpdateMatch = text.match(/<<<ACTION_UPDATE_SHIPMENT:\s*({[\s\S]*?})>>>/);
        if (shipmentUpdateMatch) {
            try {
                const data = JSON.parse(shipmentUpdateMatch[1]);
                const { id, ...updates } = data;
                if (id) {
                    updateShipment(id, updates);
                    cleanText = cleanText.replace(shipmentUpdateMatch[0], "").trim() + "\n\n**Sistem telah mengupdate Shipment.** Cek halaman Shipment Monitor untuk melihat perubahan.";
                }
            } catch (e) { console.error("Failed to parse shipment update action"); }
        }

        // Shipment Delete
        const shipmentDeleteMatch = text.match(/<<<ACTION_DELETE_SHIPMENT:\s*({[\s\S]*?})>>>/);
        if (shipmentDeleteMatch) {
            try {
                const data = JSON.parse(shipmentDeleteMatch[1]);
                if (data.id) {
                    deleteShipment(data.id);
                    cleanText = cleanText.replace(shipmentDeleteMatch[0], "").trim() + "\n\n**Sistem telah menghapus Shipment dari daftar.** Cek halaman Shipment Monitor.";
                }
            } catch (e) { console.error("Failed to parse shipment delete action"); }
        }

        // Strip ALL remaining actions globally so they don't show up in UI
        cleanText = cleanText.replace(/<<<ACTION_[A-Z_]+:\s*(\{[\s\S]*?\}|[\s\S]*?)>>>/g, "").trim();

        return cleanText;
    };

    const buildListCards = (input: string): ActionCardItem[] => {
        const c: ActionCardItem[] = [];
        const l = input.toLowerCase();

        if (/list|tampilkan|daftar/i.test(l)) {
            if (/deal|sales|penjualan/i.test(l)) {
                deals.slice(0, 5).forEach(d => c.push({ id: d.id, entityType: "sales", title: d.buyer, subtitle: d.deal_number || "", amount: d.price_per_mt || 0, status: d.status as string, date: fd(d.created_at), createdBy: d.pic_name || "", actions: ["detail"] }));
            }
            if (/kapal|shipment|pengiriman/i.test(l)) {
                shipments.filter(s => s.status !== "completed").slice(0, 5).forEach(s => c.push({ id: s.id, entityType: "shipment", title: s.vessel_name || s.barge_name || "Vessel TBA", subtitle: `${s.buyer}`, status: s.status as string, date: fd(s.created_at), createdBy: s.pic_name || "", actions: ["detail"] }));
            }
            if (/supplier|tambang|source/i.test(l)) {
                sources.slice(0, 5).forEach(s => c.push({ id: s.id, entityType: "source", title: s.name, subtitle: `Stock: ${(s.stock_available / 1000).toFixed(0)}K MT`, status: s.kyc_status, date: fd(s.created_at), createdBy: s.pic_name || "-", actions: ["detail"] }));
            }
        }
        return c;
    };

    // -- Check if we should render charts inline --
    const getChartWidgetType = (input: string): string | undefined => {
        if (/market price|harga pasar|ici|newcastle/i.test(input)) return "market_price";
        if (/p\&l|profit|margin|forecast/i.test(input) && (currentUser.role === "ceo" || currentUser.role === "director")) return "pl_summary";
        if (/target|sales plan|kuota/i.test(input)) return "sales_plan";
        return undefined;
    };

    const handleSend = async () => {
        if (!input.trim() && !selectedFile) return;

        const agent = new AIAgent({ apiKey });
        const userMsg: Message = {
            id: Date.now().toString(),
            role: "user",
            text: input,
            imageUrl: imagePreview || undefined,
            fileName: selectedFile && !selectedFile.type.startsWith("image/") ? selectedFile.name : undefined,
            fileType: selectedFile && !selectedFile.type.startsWith("image/") ? selectedFile.type : undefined
        };
        const newMessages = [...messages, userMsg];
        updateMessages(newMessages);
        fetch('/api/chat/history', { method: 'POST', body: JSON.stringify({ role: "user", content: input }) });
        const currentInput = input;
        setInput(""); setIsTyping(true); setThinkingStep("Membaca permintaan...");

        try {
            const assistantMessages: Message[] = [];
            let imageContext = "";

            if (selectedFile) {
                const currentFile = selectedFile;
                setSelectedFile(null); setImagePreview(null);
                if (currentFile.type.startsWith("image/")) {
                    setThinkingStep("Menganalisis gambar...");
                    const base64 = await fileToBase64(currentFile);
                    imageContext = await agent.analyzeImage(base64);
                } else {
                    setThinkingStep("Membaca dokumen...");
                    await new Promise(r => setTimeout(r, 1000));
                    assistantMessages.push({ id: Date.now().toString(), role: "assistant", text: `Dokumen "$${currentFile.name}" telah dianalisis. Isi dapat saya simpan ke KMS atau digunakan untuk perbandingan data.` });
                }
            }

            setThinkingStep("Menyusun jawaban / aksi Copilot...");
            const finalInput = imageContext ? `[KONTEKS GAMBAR: ${imageContext}]\n\nPertanyaan User: ${currentInput}` : currentInput;
            // Build conversation history for AI memory (last 10 messages + system prompt)
            const historyForAI: { role: string; content: string }[] = [
                { role: "system", content: buildSystemPrompt() }
            ];
            // Include recent conversation history (up to 10 previous messages)
            const recentMessages = newMessages.slice(-11, -1); // exclude the current user msg
            for (const m of recentMessages) {
                historyForAI.push({ role: m.role, content: m.text || "" });
            }
            // Add current user message
            historyForAI.push({ role: "user", content: finalInput });

            const rawReply = await agent.chat(historyForAI, model);

            // Process specific actions
            let processedReply = processActionCommands(rawReply);

            // Extract normal text
            assistantMessages.push({ id: (Date.now() + 2).toString(), role: "assistant", text: processedReply });
            fetch('/api/chat/history', { method: 'POST', body: JSON.stringify({ role: "assistant", content: processedReply }) });

            // Check if we need to show a chart inline
            const chartType = getChartWidgetType(currentInput);
            if (chartType) {
                assistantMessages.push({ id: (Date.now() + 3).toString(), role: "assistant", text: "", type: "chart_widget", data: { chartType } });
            }

            // Check if user wanted lists
            const listCards = buildListCards(currentInput);
            if (listCards.length > 0) {
                assistantMessages.push({ id: (Date.now() + 4).toString(), role: "assistant", text: "", type: "action_cards", data: { items: listCards } });
            }

            // Report generation logic
            const reportMatch = rawReply.match(/<<<ACTION_GENERATE_REPORT:\s*({.*})>>>/);
            if (reportMatch) {
                try {
                    const reportData = JSON.parse(reportMatch[1]);

                    let tableData: any[] = [];
                    let summaryText = reportData.summary || "Laporan hasil kompilasi AI Assistant.";

                    if (reportData.module === "shipment" || reportData.module === "shipments") {
                        tableData = shipments.map(s => ({
                            "Shipment No": s.shipment_number,
                            "Buyer": s.buyer,
                            "Status": s.status,
                            "Port": s.loading_port || "-",
                            "Volume (MT)": s.quantity_loaded || 0
                        }));
                        summaryText = `Menampilkan ${tableData.length} data pengiriman kapal aktif dan historis untuk analisis logistik.`;
                    } else if (reportData.module === "sales" || reportData.module === "deal") {
                        tableData = deals.map(d => ({
                            "Buyer": d.buyer,
                            "Negara": d.buyer_country,
                            "Volume": `${d.quantity} MT`,
                            "Harga": `$${d.price_per_mt}/MT`,
                            "Status": d.status
                        }));
                        summaryText = `Menampilkan ${tableData.length} data sales deal dan pipeline penjualan.`;
                    } else if (reportData.module === "source" || reportData.module === "tambang") {
                        tableData = sources.map(s => ({
                            "Nama Sumber": s.name,
                            "Region": s.region,
                            "Stok (MT)": s.stock_available,
                            "GAR": s.spec.gar,
                            "KYC": s.kyc_status
                        }));
                        summaryText = `Menampilkan ${tableData.length} profil tambang dan inventaris batubara.`;
                    } else if (reportData.module === "meeting") {
                        tableData = meetings.map(m => ({
                            "Meeting": m.title,
                            "Tanggal": m.date,
                            "Status": m.status,
                            "Partisipan": m.attendees.length
                        }));
                        summaryText = `Menampilkan ${tableData.length} jadwal pertemuan operasional.`;
                    }

                    assistantMessages.push({
                        id: (Date.now() + 5).toString(),
                        role: "assistant",
                        text: "",
                        type: "report_download",
                        data: {
                            title: reportData.title || "Laporan Kustom",
                            module: reportData.module,
                            summary: summaryText,
                            tableData: tableData.length > 0 ? tableData : undefined
                        }
                    });
                } catch (e) { }
            }

            updateMessages([...newMessages, ...assistantMessages]);

        } catch (error) {
            updateMessages([...newMessages, { id: Date.now().toString(), role: "assistant", text: "Terjadi kesalahan koneksi AI." }]);
        } finally {
            setIsTyping(false); setThinkingStep("");
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            if (file.type.startsWith("image/")) {
                const r = new FileReader();
                r.onload = (e) => setImagePreview(e.target?.result as string);
                r.readAsDataURL(file);
            } else {
                setImagePreview(null);
            }
        }
    };

    React.useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages, isTyping, thinkingStep]);

    if (!hasPermission("chatbot")) return null;
    const sz = maximized ? "w-[90vw] md:w-[700px] h-[80vh]" : "w-[380px] md:w-[440px] h-[560px]";

    return (
        <>
            {!open && (
                <button onClick={() => setOpen(true)}
                    className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 rounded-full bg-primary border border-primary/20 text-primary-foreground flex items-center justify-center shadow-lg hover:bg-primary/90 hover:scale-105 transition-all duration-300 w-12 h-12 md:w-14 md:h-14">
                    <MessageSquare className="w-5 h-5 md:w-6 md:h-6" />
                </button>
            )}

            {open && (
                <div className={cn("fixed bottom-20 md:bottom-6 right-4 md:right-6 z-[60] flex flex-col bg-background rounded-xl shadow-xl overflow-hidden border border-border transition-all duration-300", sz)}>
                    <div className="flex items-center gap-2 px-3 h-12 border-b border-border shrink-0 bg-muted/30">
                        {showHistory ? (
                            <>
                                <button onClick={() => setShowHistory(false)} className="p-1.5 rounded-lg hover:bg-accent transition-colors"><ChevronLeft className="w-4 h-4 text-muted-foreground" /></button>
                                <p className="text-xs font-semibold flex-1">Chat History</p>
                            </>
                        ) : (
                            <>
                                <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                                    <MessageSquare className="w-3.5 h-3.5 text-primary-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-foreground">Asisten Pintar</p>
                                </div>
                                <div className="flex items-center gap-0.5">
                                    <button onClick={() => setShowHistory(true)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><History className="w-4 h-4" /></button>
                                    <button onClick={() => {
                                        const ns: ChatSession = { id: Date.now().toString(), title: "Percakapan Baru", messages: [welcomeMsg()], createdAt: new Date().toISOString() };
                                        const u = [ns, ...sessions]; setSessions(u); setActiveSessionId(ns.id);
                                        saveSessions(currentUser.id, u); setShowHistory(false); setCompletedActions(new Set());
                                    }} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><Plus className="w-4 h-4" /></button>
                                    <button onClick={() => setMaximized(!maximized)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors">
                                        {maximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                                    </button>
                                    <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X className="w-4 h-4" /></button>
                                </div>
                            </>
                        )}
                    </div>

                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 bg-background">
                        {showHistory ? (
                            <div className="space-y-2">
                                {sessions.map((s) => (
                                    <button key={s.id} onClick={() => { setActiveSessionId(s.id); setShowHistory(false); }} className={cn("w-full text-left p-3 rounded-xl border transition-colors", s.id === activeSessionId ? "bg-primary/10 border-primary/30" : "bg-card border-border/50 hover:bg-accent")}>
                                        <p className="font-semibold text-sm truncate">{s.messages.find(m => m.role === "user")?.text || s.title || "Percakapan Baru"}</p>
                                        <p className="text-[10px] text-muted-foreground mt-1">{fd(s.createdAt)}</p>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {messages.map((msg) => (
                                    <div key={msg.id} className={cn("flex flex-col max-w-[90%]", msg.role === "user" ? "ml-auto" : "")}>
                                        {msg.text && (
                                            <div className={cn("px-4 py-3 rounded-xl text-sm leading-relaxed",
                                                msg.role === "user" ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted text-foreground rounded-tl-sm")}>
                                                {msg.role === "assistant" ? (
                                                    <ReactMarkdown
                                                        remarkPlugins={[remarkGfm]}
                                                        components={{
                                                            p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                                                            strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
                                                            em: ({ children }) => <em className="italic">{children}</em>,
                                                            ul: ({ children }) => <ul className="list-disc ml-5 mb-3 mt-1 space-y-1">{children}</ul>,
                                                            ol: ({ children }) => <ol className="list-decimal ml-5 mb-3 mt-1 space-y-1">{children}</ol>,
                                                            li: ({ children }) => <li className="pl-1 leading-snug">{children}</li>,
                                                            h1: ({ children }) => <h1 className="text-base font-extrabold mt-4 mb-2 border-b border-border/50 pb-1">{children}</h1>,
                                                            h2: ({ children }) => <h2 className="text-[15px] font-bold mt-3 mb-1.5">{children}</h2>,
                                                            h3: ({ children }) => <h3 className="text-sm font-bold mt-2.5 mb-1">{children}</h3>,
                                                            h4: ({ children }) => <h4 style={{ fontWeight: 600, fontSize: '13px', margin: '6px 0 3px' }}>{children}</h4>,
                                                            blockquote: ({ children }) => <blockquote style={{ borderLeft: '3px solid rgba(139,92,246,0.5)', paddingLeft: '12px', margin: '8px 0', color: 'inherit', opacity: 0.85, fontStyle: 'italic' }}>{children}</blockquote>,
                                                            hr: () => <hr style={{ border: 'none', borderTop: '1px solid rgba(128,128,128,0.2)', margin: '10px 0' }} />,
                                                            a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#8b5cf6', textDecoration: 'underline', fontWeight: 500 }}>{children}</a>,
                                                            table: ({ children }) => (
                                                                <div style={{ overflowX: 'auto', margin: '8px 0', borderRadius: '8px', border: '1px solid rgba(128,128,128,0.15)' }}>
                                                                    <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>{children}</table>
                                                                </div>
                                                            ),
                                                            thead: ({ children }) => <thead style={{ backgroundColor: 'rgba(128,128,128,0.08)' }}>{children}</thead>,
                                                            th: ({ children }) => <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '2px solid rgba(128,128,128,0.15)', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{children}</th>,
                                                            td: ({ children }) => <td style={{ padding: '6px 10px', borderBottom: '1px solid rgba(128,128,128,0.08)' }}>{children}</td>,
                                                            code: ({ children }) => <code style={{ background: 'rgba(128,128,128,0.12)', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace' }}>{children}</code>,
                                                            pre: ({ children }) => <pre style={{ background: 'rgba(128,128,128,0.08)', padding: '10px', borderRadius: '8px', margin: '8px 0', overflowX: 'auto', fontSize: '11px' }}>{children}</pre>,
                                                        }}
                                                    >
                                                        {msg.text}
                                                    </ReactMarkdown>
                                                ) : msg.text}
                                            </div>
                                        )}
                                        {msg.imageUrl && (
                                            <img src={msg.imageUrl} alt="Upload" className="w-48 rounded-xl mt-2 border border-border/50 shadow-sm" />
                                        )}
                                        {msg.fileName && (
                                            <div className="mt-2 flex items-center gap-2 p-3 bg-card border border-border/50 rounded-xl max-w-xs">
                                                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                                                    <FileText className="w-4 h-4 text-red-500" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold truncate">{msg.fileName}</p>
                                                    <p className="text-[10px] text-muted-foreground uppercase">{msg.fileType?.split('/')?.pop() || 'DOCUMENT'}</p>
                                                </div>
                                            </div>
                                        )}

                                        {msg.type === "chart_widget" && msg.data?.chartType === "market_price" && (
                                            <div className="mt-2 p-3 bg-card border border-border/50 rounded-xl space-y-2 w-full">
                                                <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-violet-500" /> <span className="font-bold text-xs">Live Market Price</span></div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="p-2 bg-accent/20 rounded border border-border/30"><p className="text-[10px] text-muted-foreground">ICI 4</p><p className="font-bold text-sm">$${marketPrices[0]?.ici_4 || 48.30}</p></div>
                                                    <div className="p-2 bg-accent/20 rounded border border-border/30"><p className="text-[10px] text-muted-foreground">Newcastle</p><p className="font-bold text-sm">$${marketPrices[0]?.newcastle || 132.80}</p></div>
                                                </div>
                                            </div>
                                        )}

                                        {msg.type === "action_cards" && msg.data?.items?.length > 0 && (
                                            <div className="mt-2 space-y-2">
                                                {msg.data.items.map((item: ActionCardItem) => (
                                                    <div key={item.id} className="p-2.5 bg-card/60 border border-border/50 rounded-xl flex items-center justify-between">
                                                        <div>
                                                            <p className="font-bold text-xs">{item.title}</p>
                                                            <p className="text-[10px] text-muted-foreground">{item.subtitle}</p>
                                                        </div>
                                                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent text-muted-foreground capitalize">{item.entityType}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {msg.type === "report_download" && (
                                            <div className="mt-2 p-3 bg-card border border-border/50 rounded-xl space-y-2 w-full flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <FileText className="w-5 h-5 text-indigo-500" />
                                                    <div>
                                                        <p className="font-bold text-xs">{msg.data?.title || "Laporan Kustom"}</p>
                                                        <p className="text-[10px] text-muted-foreground">PDF Document • Siap Diunduh</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        const doc = new jsPDF();
                                                        doc.setFontSize(20);
                                                        doc.setTextColor(40, 40, 40);
                                                        doc.text(msg.data?.title || "Laporan Kustom", 14, 22);
                                                        doc.setFontSize(11);
                                                        doc.setTextColor(100);
                                                        doc.text("Generated by CoalTradeOS AI Assistant", 14, 32);
                                                        doc.text(new Date().toLocaleString('id-ID'), 14, 38);
                                                        doc.setDrawColor(200);
                                                        doc.line(14, 45, 196, 45);

                                                        doc.setFontSize(10);
                                                        doc.setTextColor(60);
                                                        const splitSummary = doc.splitTextToSize(msg.data?.summary || "Laporan hasil kompilasi AI Assistant.", 180);
                                                        doc.text(splitSummary, 14, 55);

                                                        if (msg.data?.tableData && msg.data?.tableData.length > 0) {
                                                            const keys = Object.keys(msg.data.tableData[0]);
                                                            const head = [keys.map(k => k.replace(/_/g, ' ').toUpperCase())];
                                                            const body = msg.data.tableData.map((row: any) => keys.map(k => String(row[k])));
                                                            autoTable(doc, {
                                                                startY: (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 15 : 75,
                                                                head: head,
                                                                body: body,
                                                                theme: 'grid',
                                                                styles: { fontSize: 8, cellPadding: 3 },
                                                                headStyles: { fillColor: [41, 128, 185], textColor: 255 }
                                                            });
                                                        }

                                                        doc.save(`${msg.data?.title?.replace(/\s+/g, '_') || 'report'}.pdf`);
                                                    }}
                                                    className="px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-[10px] font-semibold transition-colors shadow-sm">
                                                    Unduh
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {isTyping && !showHistory && (
                                    <div className="flex gap-2">
                                        <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center shrink-0 mt-0.5"><Bot className="w-3 h-3 text-primary-foreground" /></div>
                                        <div className="bg-muted rounded-xl rounded-tl-sm px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> {thinkingStep}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="px-3 pb-2 pt-1 flex gap-2 overflow-x-auto no-scrollbar border-t border-border/50 bg-card">
                        <button onClick={() => { setInput("Buat draft Sales Deal 50k MT"); setTimeout(handleSend, 100); }} className="shrink-0 px-3 py-1.5 rounded-full bg-accent/50 text-[10px] font-semibold text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all border border-border/50">✨ Buat Sales Deal</button>
                        <button onClick={() => { setInput("Jadwalkan meeting operasional besok"); setTimeout(handleSend, 100); }} className="shrink-0 px-3 py-1.5 rounded-full bg-accent/50 text-[10px] font-semibold text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all border border-border/50">📅 Jadwal Meeting</button>
                        <button onClick={() => { setInput("Generate Laporan Pengiriman (Shipment) terbaru"); setTimeout(handleSend, 100); }} className="shrink-0 px-3 py-1.5 rounded-full bg-accent/50 text-[10px] font-semibold text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all border border-border/50">📑 Buat Laporan PDF</button>
                    </div>

                    <div className="p-2.5 bg-card border-t border-border flex items-end gap-1.5 z-10 relative">
                        <input type="file" accept="image/*,.pdf,.doc,.docx" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
                        <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-xl border border-border bg-accent/50 text-muted-foreground hover:bg-accent hover:text-foreground shrink-0 transition-colors">
                            <Paperclip className="w-4 h-4" />
                        </button>
                        <textarea value={input} onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                            placeholder={selectedFile ? `File: ${selectedFile.name}` : "Ketik perintah (Cth: Buat sales deal 50k MT)..."}
                            className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-border bg-accent/20 text-sm focus:ring-1 focus:ring-primary/50 outline-none resize-none"
                            rows={1} style={{ minHeight: "38px", maxHeight: "100px" }} />
                        <button onClick={handleSend} disabled={(!input.trim() && !selectedFile) || isTyping}
                            className="w-10 h-10 rounded-xl bg-primary text-primary-foreground disabled:opacity-50 hover:shadow-md transition-all active:scale-95 shrink-0 flex items-center justify-center">
                            <Send className="w-4 h-4 -ml-0.5" />
                        </button>
                    </div>
                </div >
            )
            }
        </>
    );
}

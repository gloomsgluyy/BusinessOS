"use client";

import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useCommercialStore } from "@/store/commercial-store";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { MeetingItem } from "@/types";
import { Calendar, Plus, Users, MapPin, FileText, Download, X, Play, Mic, Upload, Wand2, Search, Filter, Loader2, FileAudio, CheckCircle2, Video } from "lucide-react";
import { useTaskStore } from "@/store/task-store";
import { AIAgent } from "@/lib/ai-agent";
import jsPDF from "jspdf";

export default function MeetingsPage() {
    const { meetings, addMeeting, updateMeeting } = useCommercialStore();
    const { addTask } = useTaskStore();
    const { data: session, status } = useSession();
    const currentUser = session?.user as any;
    const [showForm, setShowForm] = React.useState(false);
    const [activeView, setActiveView] = React.useState<"card" | "list">("card");
    const [selectedMeeting, setSelectedMeeting] = React.useState<MeetingItem | null>(null);
    const [momEdit, setMomEdit] = React.useState("");
    const [activeTab, setActiveTab] = React.useState<"all" | "upcoming" | "past">("all");
    const [search, setSearch] = React.useState("");

    const [form, setForm] = React.useState({ title: "", date: "", time: "10:00", location: "", attendees: "" });
    const [isRecording, setIsRecording] = React.useState(false);
    const [isGenerating, setIsGenerating] = React.useState(false);

    // AI Pipeline states
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [uploadedFile, setUploadedFile] = React.useState<File | null>(null);
    const [transcript, setTranscript] = React.useState<string>("");
    const [showExportMenu, setShowExportMenu] = React.useState(false);

    const handleCreate = () => {
        addMeeting({
            title: form.title, date: form.date, time: form.time, location: form.location,
            attendees: form.attendees.split(",").map((a) => a.trim()).filter(Boolean),
            status: "scheduled", action_items: [],
            created_by: currentUser?.id || "system", created_by_name: currentUser?.name || "System",
        });
        setShowForm(false);
        setForm({ title: "", date: "", time: "10:00", location: "", attendees: "" });
    };

    const handleSaveMOM = () => {
        if (selectedMeeting) {
            updateMeeting(selectedMeeting.id, { mom_content: momEdit, status: "completed" });
            setSelectedMeeting({ ...selectedMeeting, mom_content: momEdit, status: "completed" });
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedMeeting) return;
        setUploadedFile(file);

        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) throw new Error("Upload failed");
            const data = await res.json();

            // Save URL to meeting
            updateMeeting(selectedMeeting.id, { voice_note_url: data.url });
            setSelectedMeeting({ ...selectedMeeting, voice_note_url: data.url });
            alert(`File uploaded successfully: ${data.filename}`);

        } catch (error) {
            console.error("Upload error:", error);
            alert("Failed to upload file.");
            setUploadedFile(null);
        }
    };

    const handleGenerateAI = async (type: string) => {
        setIsGenerating(true);
        try {
            if (type === "ML Smart Transcription") {
                if (!selectedMeeting?.voice_note_url) {
                    alert("Please upload an audio/video recording first.");
                    setIsGenerating(false);
                    return;
                }
                const res = await fetch("/api/transcribe", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ fileUrl: selectedMeeting.voice_note_url })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Transcription failed");

                setTranscript(data.transcription);
                setMomEdit(data.mom_markdown);

                // Extract Tasks
                if (data.extracted_tasks && data.extracted_tasks.length > 0) {
                    const confirmTasks = window.confirm(`AI extracted ${data.extracted_tasks.length} tasks. Do you want to add them to the Task Tracker?`);
                    if (confirmTasks) {
                        data.extracted_tasks.forEach((t: any) => {
                            addTask({
                                title: t.title,
                                description: `Extracted from Meeting: ${selectedMeeting.title}`,
                                priority: t.priority || "medium",
                                status: "todo",
                                assignee_id: currentUser?.id || "system", // Assign to creator by default
                                assignee_name: t.assignee_hint || currentUser?.name || "Unassigned",
                                due_date: new Date().toISOString().split('T')[0],
                                created_by: currentUser?.id || "system",
                            });
                        });
                        alert("Tasks inserted into tracker successfully.");
                    }
                }
            } else {
                const ai = new AIAgent({ apiKey: "" }); // Uses server proxy
                let prompt = "";
                let contextStr = `Meeting Title: ${selectedMeeting?.title}\nAttendees: ${selectedMeeting?.attendees.join(", ")}\nDate: ${selectedMeeting?.date}\n\n`;

                if (transcript) {
                    contextStr += `TRANSCRIPT RECORDING:\n${transcript}\n\n`;
                } else {
                    contextStr += `(No audio recording uploaded, base on title and standard practices)\n\n`;
                }

                if (type === "Notes from Agenda") {
                    prompt = `Generate a concise summary of discussion points based on the following meeting context. Respond in professional professional business language:\n${contextStr}`;
                } else if (type === "AI Summary") {
                    prompt = `Summarize the following meeting into 3-4 key takeaways and executive summary. Make it structured using markdown bullet points:\n${contextStr}`;
                } else {
                    prompt = `Generate a comprehensive formal Minutes of Meeting (MOM) document based on the following context. Include sections for: Executive Summary, Key Decisions, and Action Items (with assignees if mentioned):\n${contextStr}`;
                }

                const result = await ai.chat([{ role: "user", content: prompt }]);
                setMomEdit(result);
            }
        } catch (error) {
            console.error("AI Generation failed", error);
            alert("Failed to generate AI response. Please check your API configuration or Network.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleExport = (format: "txt" | "word" | "pdf") => {
        if (!selectedMeeting) return;
        setShowExportMenu(false);
        const content = `MINUTES OF MEETING\n==================\nTitle: ${selectedMeeting.title}\nDate: ${selectedMeeting.date} ${selectedMeeting.time}\nLocation: ${selectedMeeting.location || "-"}\nAttendees: ${selectedMeeting.attendees.join(", ")}\n\n${momEdit || selectedMeeting.mom_content || "No MOM recorded"}`;

        let blob: Blob;
        let filename: string;

        if (format === "word") {
            // Simplified Word export using application/msword MIME type which modern Word can read as text/RTF or simple HTML
            const docContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>MOM</title></head><body><h1>MINUTES OF MEETING</h1><p><b>Title:</b> ${selectedMeeting.title}</p><p><b>Date:</b> ${selectedMeeting.date}</p><p><b>Attendees:</b> ${selectedMeeting.attendees.join(", ")}</p><hr/><pre style="white-space: pre-wrap; font-family: sans-serif;">${momEdit || selectedMeeting.mom_content}</pre></body></html>`;
            blob = new Blob(['\ufeff', docContent], { type: "application/msword" });
            filename = `MOM-${selectedMeeting.title.replace(/\s+/g, "_")}.doc`;
        } else if (format === "pdf") {
            try {
                const doc = new jsPDF();

                // Title
                doc.setFontSize(18);
                doc.setFont("helvetica", "bold");
                doc.text("MINUTES OF MEETING", 105, 20, { align: "center" });

                // Details
                doc.setFontSize(12);
                doc.setFont("helvetica", "normal");
                doc.text(`Title: ${selectedMeeting.title}`, 20, 40);
                doc.text(`Date & Time: ${selectedMeeting.date} ${selectedMeeting.time}`, 20, 50);
                doc.text(`Location: ${selectedMeeting.location || "-"}`, 20, 60);

                // Attendees (handling long lists)
                const attendeesText = `Attendees: ${selectedMeeting.attendees.join(", ")}`;
                const splitAttendees = doc.splitTextToSize(attendeesText, 170);
                doc.text(splitAttendees, 20, 70);

                let yOffset = 70 + (splitAttendees.length * 7);
                doc.line(20, yOffset, 190, yOffset);
                yOffset += 10;

                // Content
                doc.setFont("helvetica", "bold");
                doc.text("Meeting Notes / Transcript:", 20, yOffset);
                yOffset += 10;

                doc.setFont("helvetica", "normal");
                const mainContent = momEdit || selectedMeeting.mom_content || "No MOM recorded";
                const splitContent = doc.splitTextToSize(mainContent, 170);

                // Add pagination if content is too long
                for (let i = 0; i < splitContent.length; i++) {
                    if (yOffset > 280) {
                        doc.addPage();
                        yOffset = 20;
                    }
                    doc.text(splitContent[i], 20, yOffset);
                    yOffset += 7;
                }

                doc.save(`MOM-${selectedMeeting.title.replace(/\s+/g, "_")}.pdf`);
                return; // Early return for PDF as we use doc.save
            } catch (err) {
                console.error("PDF generation failed", err);
                alert("Failed to generate PDF. Check if jsPDF library is properly loaded.");
                return;
            }
        } else {
            blob = new Blob([content], { type: "text/plain" });
            filename = `MOM-${selectedMeeting.title.replace(/\s+/g, "_")}.txt`;
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleGoogleCalendar = () => {
        if (!selectedMeeting) return;
        const start = new Date(`${selectedMeeting.date}T${selectedMeeting.time}`);
        const end = new Date(start.getTime() + 60 * 60 * 1000); // default 1 hour
        const fmt = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
        const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(selectedMeeting.title)}&dates=${fmt(start)}/${fmt(end)}&details=${encodeURIComponent("Attendees: " + selectedMeeting.attendees.join(", "))}&location=${encodeURIComponent(selectedMeeting.location || "")}`;
        window.open(url, '_blank');
    };

    const todayStr = new Date().toISOString().split('T')[0];

    const userMeetings = meetings.filter(m => {
        if (!currentUser) return false;
        if (currentUser.role === "CEO" || currentUser.role === "ASSISTANT_CEO") return true;
        const nameStr = currentUser.name?.toLowerCase() || "";
        const emailStr = currentUser.email?.toLowerCase() || "___noemail___";
        return m.attendees.some(a => a.toLowerCase() === nameStr || a.toLowerCase() === emailStr)
            || m.created_by === currentUser.id
            || m.created_by_name?.toLowerCase() === nameStr;
    });

    const upcomingCount = userMeetings.filter(m => m.date >= todayStr && m.status === 'scheduled').length;
    const todayCount = userMeetings.filter(m => m.date === todayStr).length;
    const buyerCount = userMeetings.filter(m => m.title.toLowerCase().includes('buyer') || m.title.toLowerCase().includes('client')).length;
    const aiMOMCount = userMeetings.filter(m => m.mom_content && m.mom_content.includes('AI')).length;

    const filtered = userMeetings.filter(m => {
        if (activeTab === "upcoming") return m.date >= todayStr && m.status === 'scheduled';
        if (activeTab === "past") return m.date < todayStr || m.status === 'completed';
        return true;
    }).filter(m => search ? m.title.toLowerCase().includes(search.toLowerCase()) || m.attendees.join(" ").toLowerCase().includes(search.toLowerCase()) : true);

    if (status === "loading") {
        return <AppShell><div className="flex h-[50vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div></AppShell>;
    }

    return (
        <AppShell>
            <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fade-in relative z-20">
                    <div><h1 className="text-xl md:text-2xl font-bold tracking-tight text-blue-500">Meeting</h1>
                        <p className="text-sm text-muted-foreground mt-1">Schedule meetings, record sessions, and generate automated MOM</p></div>
                    <button onClick={() => setShowForm(!showForm)} className="btn-primary shadow-lg shadow-blue-500/20 bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-1.5" /> New Meeting
                    </button>
                </div>

                {/* Top Metrics */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up relative z-10">
                    <div className="card-elevated p-5 relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-500/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
                        <div className="flex items-center gap-2 text-muted-foreground mb-3">
                            <Calendar className="w-4 h-4 text-blue-500" />
                            <span className="text-xs font-semibold uppercase">Upcoming</span>
                        </div>
                        <p className="text-2xl font-bold font-mono text-blue-600">{upcomingCount}</p>
                    </div>
                    <div className="card-elevated p-5 relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-500/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
                        <div className="flex items-center gap-2 text-muted-foreground mb-3">
                            <Play className="w-4 h-4 text-sky-500" />
                            <span className="text-xs font-semibold uppercase">Today&apos;s</span>
                        </div>
                        <p className="text-2xl font-bold font-mono text-sky-500">{todayCount}</p>
                    </div>
                    <div className="card-elevated p-5 relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-500/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
                        <div className="flex items-center gap-2 text-muted-foreground mb-3">
                            <Users className="w-4 h-4 text-indigo-500" />
                            <span className="text-xs font-semibold uppercase">Buyer Meetings</span>
                        </div>
                        <p className="text-2xl font-bold font-mono text-indigo-500">{buyerCount}</p>
                    </div>
                    <div className="card-elevated p-5 relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-500/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
                        <div className="flex items-center gap-2 text-muted-foreground mb-3">
                            <Wand2 className="w-4 h-4 text-cyan-500" />
                            <span className="text-xs font-semibold uppercase">AI Summaries</span>
                        </div>
                        <p className="text-2xl font-bold font-mono text-cyan-500">{aiMOMCount}</p>
                    </div>
                </div>

                {/* Filters & Search */}
                <div className="flex items-center gap-3 flex-wrap animate-fade-in delay-1">
                    <div className="flex bg-blue-500/5 p-1 rounded-xl shrink-0 border border-blue-500/10">
                        {["all", "upcoming", "past"].map(t => (
                            <button key={t} onClick={() => setActiveTab(t as any)} className={cn("px-4 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize", activeTab === t ? "bg-blue-600 shadow-sm text-white" : "text-muted-foreground hover:text-foreground hover:bg-blue-500/10")}>
                                {t}
                            </button>
                        ))}
                    </div>
                    <button className="btn-outline text-xs h-8 bg-background border-blue-500/20 text-blue-600 hover:bg-blue-500/5">
                        <Filter className="w-3.5 h-3.5 mr-1.5" /> Filters
                    </button>
                    <div className="relative flex-1 min-w-[200px] max-w-sm ml-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search meeting title or attendees..." className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-background border border-border text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" />
                    </div>
                </div>

                <div className="flex justify-end mb-2">
                    <div className="flex bg-accent/30 p-1 rounded-xl shrink-0 border border-border/50">
                        <button onClick={() => setActiveView("card")} className={cn("px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all", activeView === "card" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-background/50")}>Cards</button>
                        <button onClick={() => setActiveView("list")} className={cn("px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all", activeView === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-background/50")}>Table</button>
                    </div>
                </div>

                {/* Create Form */}
                {showForm && (
                    <div className="card-elevated p-5 space-y-4 animate-scale-in border-blue-500/20 shadow-blue-500/5">
                        <h3 className="text-sm font-semibold text-blue-500">Schedule Meeting</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">Title</label>
                                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" /></div>
                            <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">Date</label>
                                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" /></div>
                            <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">Time</label>
                                <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" /></div>
                            <div><label className="text-[10px] font-semibold text-muted-foreground uppercase">Location / Link</label>
                                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" /></div>
                            <div className="md:col-span-2"><label className="text-[10px] font-semibold text-muted-foreground uppercase">Attendees (comma separated)</label>
                                <input value={form.attendees} onChange={(e) => setForm({ ...form, attendees: e.target.value })} placeholder="John, Mark, Buyer X" className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" /></div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleCreate} className="btn-primary bg-blue-600 hover:bg-blue-700 disabled:opacity-50" disabled={!form.title || !form.date}><Plus className="w-4 h-4 mr-1.5" /> Create Meeting</button>
                            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
                        </div>
                    </div>
                )}

                {/* Meeting Cards/Table */}
                {activeView === "card" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filtered.map((m, i) => {
                            const isCompleted = m.status === "completed" || m.date < todayStr;
                            return (
                                <div key={m.id} className={cn("card-interactive p-5 space-y-3 animate-slide-up border border-transparent hover:border-blue-500/30", `delay-${Math.min(i + 1, 6)}`)} onClick={() => { setSelectedMeeting(m); setMomEdit(m.mom_content || ""); }}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", isCompleted ? "bg-accent" : "bg-blue-500/10 text-blue-600")}>
                                                <Calendar className={cn("w-5 h-5", isCompleted ? "text-muted-foreground" : "text-blue-600")} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold line-clamp-1">{m.title}</p>
                                                <p className={cn("text-[10px] font-medium", isCompleted ? "text-muted-foreground" : "text-blue-500")}>
                                                    {new Date(m.date).toLocaleDateString("en-US", { weekday: "short", day: "2-digit", month: "short" })} · {m.time}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={cn("status-badge text-[10px]", isCompleted ? "text-slate-500 bg-slate-500/10 border border-slate-500/20" : "text-blue-600 bg-blue-500/10 border border-blue-500/20")}>
                                            {isCompleted ? "Past" : "Upcoming"}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{m.attendees.length}</span>
                                        {m.location && <span className="flex items-center gap-1.5 truncate max-w-[100px]"><MapPin className="w-3.5 h-3.5 shrink-0" />{m.location}</span>}
                                        {m.mom_content && <span className="flex items-center gap-1.5 text-blue-500"><FileText className="w-3.5 h-3.5" />MOM</span>}
                                    </div>
                                </div>
                            );
                        })}
                        {filtered.length === 0 && <div className="col-span-full p-12 text-center text-muted-foreground text-sm flex flex-col items-center">
                            <Calendar className="w-8 h-8 opacity-20 mb-3" />
                            No meetings found in this view.
                        </div>}
                    </div>
                ) : (
                    <div className="card-elevated overflow-hidden animate-slide-up">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-accent/30">
                                        <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Title</th>
                                        <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Date & Time</th>
                                        <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Location</th>
                                        <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Attendees</th>
                                        <th className="text-center px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Status</th>
                                        <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((m) => {
                                        const isCompleted = m.status === "completed" || m.date < todayStr;
                                        return (
                                            <tr key={m.id} className="border-b border-border/50 hover:bg-accent/20 transition-colors group cursor-pointer" onClick={() => { setSelectedMeeting(m); setMomEdit(m.mom_content || ""); }}>
                                                <td className="px-4 py-3">
                                                    <p className="font-bold text-xs">{m.title}</p>
                                                    {m.mom_content && <span className="inline-flex items-center gap-1 mt-1 text-[9px] text-blue-500 uppercase tracking-widest font-bold bg-blue-500/10 px-1.5 py-0.5 rounded"><FileText className="w-3 h-3" /> Recorded</span>}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <p className="text-xs font-semibold">{new Date(m.date).toLocaleDateString("en-US", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}</p>
                                                    <p className="text-[10px] text-muted-foreground">{m.time}</p>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-muted-foreground">{m.location || "-"}</td>
                                                <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-[150px]">{m.attendees.join(", ")}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={cn("status-badge text-[9px]", isCompleted ? "text-slate-500 bg-slate-500/10 border border-slate-500/20" : "text-blue-600 bg-blue-500/10 border border-blue-500/20")}>
                                                        {isCompleted ? "Past" : "Upcoming"}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button className="px-2.5 py-1 rounded-md bg-background border border-border text-[10px] font-bold hover:bg-accent transition-colors">Details</button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {filtered.length === 0 && <div className="p-12 text-center text-muted-foreground text-sm flex flex-col items-center"><Calendar className="w-8 h-8 opacity-20 mb-3" />No meetings found.</div>}
                    </div>
                )}

                {/* Meeting Detail / MOM Modal */}
                {selectedMeeting && (
                    <div className="modal-overlay z-50 fixed inset-0 flex items-center justify-center p-4">
                        <div className="modal-backdrop absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => { setSelectedMeeting(null); setUploadedFile(null); setTranscript(""); }} />
                        <div className="modal-content relative bg-card border border-border w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl animate-scale-in flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border">

                            {/* Left Panel: Info & Recording */}
                            <div className="p-6 md:w-1/3 flex flex-col gap-6 bg-accent/10">
                                <div>
                                    <h2 className="text-xl font-bold leading-tight">{selectedMeeting.title}</h2>
                                    <span className={cn("inline-block mt-2 status-badge text-[10px]", selectedMeeting.date < todayStr ? "text-slate-500 bg-slate-500/10" : "text-blue-600 bg-blue-500/10")}>
                                        {selectedMeeting.date < todayStr ? "Past Meeting" : "Scheduled"}
                                    </span>
                                </div>
                                <div className="space-y-3 text-xs">
                                    <div className="flex items-start gap-3 text-muted-foreground"><Calendar className="w-4 h-4 shrink-0 text-foreground" /><div><p className="font-semibold text-foreground">Date & Time</p><p>{selectedMeeting.date} at {selectedMeeting.time}</p></div></div>
                                    <div className="flex items-start gap-3 text-muted-foreground"><MapPin className="w-4 h-4 shrink-0 text-foreground" /><div><p className="font-semibold text-foreground">Location</p><p>{selectedMeeting.location || "No location provided"}</p></div></div>
                                    <div className="flex items-start gap-3 text-muted-foreground"><Users className="w-4 h-4 shrink-0 text-foreground" /><div><p className="font-semibold text-foreground">Attendees</p><p>{selectedMeeting.attendees.join(", ")}</p></div></div>
                                    <button onClick={handleGoogleCalendar} className="mt-4 w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-blue-600 text-white font-semibold shadow-md shadow-blue-500/20 hover:bg-blue-700 hover:-translate-y-0.5 transition-all">
                                        <Calendar className="w-4 h-4" /> Add to Google Calendar
                                    </button>
                                </div>

                                {/* Recording Section */}
                                <div className="pt-4 border-t border-border space-y-3">
                                    <h4 className="text-xs font-semibold uppercase text-muted-foreground flex justify-between items-center">
                                        Meeting Recording
                                        {uploadedFile && <span className="text-[9px] bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Uploaded</span>}
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={() => setIsRecording(!isRecording)} className={cn("flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-colors", isRecording ? "bg-red-500/10 border-red-500/30 text-red-500" : "bg-card border-border hover:border-blue-500/50 hover:bg-blue-500/5 text-muted-foreground hover:text-foreground")}>
                                            <Mic className={cn("w-5 h-5 mb-1.5", isRecording ? "animate-pulse delay-75" : "")} />
                                            {isRecording ? "Stop Recording" : "Start Live Record"}
                                        </button>
                                        <input type="file" ref={fileInputRef} className="hidden" accept="audio/*,video/*" onChange={handleFileUpload} />
                                        <button onClick={() => fileInputRef.current?.click()} className={cn("flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-colors text-muted-foreground hover:text-foreground hover:border-blue-500/50 hover:bg-blue-500/5", selectedMeeting.voice_note_url || uploadedFile ? "bg-emerald-500/5 border-emerald-500/30 text-emerald-600" : "bg-card border-border")}>
                                            {selectedMeeting.voice_note_url || uploadedFile ? <FileAudio className="w-5 h-5 mb-1.5" /> : <Upload className="w-5 h-5 mb-1.5" />}
                                            {selectedMeeting.voice_note_url || uploadedFile ? "Change File" : "Upload Audio/Vid"}
                                        </button>
                                    </div>
                                    {isRecording && <p className="text-[10px] text-red-500 text-center animate-pulse">Recording continuously...</p>}
                                    {uploadedFile && <p className="text-[10px] text-muted-foreground text-center truncate">{uploadedFile.name}</p>}
                                    {selectedMeeting.voice_note_url && !uploadedFile && (
                                        <div className="mt-3 rounded-xl overflow-hidden border border-border bg-black/5 flex flex-col items-center p-2">
                                            {selectedMeeting.voice_note_url.toLowerCase().match(/\.(mp4|webm|ogg)$/i) ? (
                                                <video controls className="w-full h-auto max-h-[150px] rounded-lg">
                                                    <source src={selectedMeeting.voice_note_url} type="video/mp4" />
                                                    Your browser does not support HTML video.
                                                </video>
                                            ) : (
                                                <audio controls className="w-full h-10 outline-none">
                                                    <source src={selectedMeeting.voice_note_url} type="audio/mpeg" />
                                                    Your browser does not support HTML audio.
                                                </audio>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right Panel: MOM Generator & Editor */}
                            <div className="p-6 md:w-2/3 flex flex-col h-[500px] md:h-auto overflow-hidden">
                                <div className="flex items-center justify-between mb-4 shrink-0">
                                    <h4 className="text-sm font-bold flex items-center gap-2"><FileText className="w-4 h-4 text-blue-500" /> Minutes of Meeting</h4>
                                    <button onClick={() => setSelectedMeeting(null)} className="p-2 hover:bg-accent rounded-lg transition-colors md:hidden"><X className="w-4 h-4" /></button>
                                </div>

                                {/* AI Generators */}
                                <div className="flex gap-2 mb-4 shrink-0 overflow-x-auto pb-1 custom-scrollbar">
                                    <button onClick={() => handleGenerateAI("Notes from Agenda")} disabled={isGenerating} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-600 border border-blue-500/20 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-blue-500/20 transition-colors disabled:opacity-50">
                                        <Wand2 className="w-3.5 h-3.5" /> Notes from Agenda
                                    </button>
                                    <button onClick={() => handleGenerateAI("ML Smart Transcription")} disabled={isGenerating || (!selectedMeeting.voice_note_url && !uploadedFile)} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/10 text-violet-600 border border-violet-500/20 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-violet-500/20 transition-colors disabled:opacity-50">
                                        <FileAudio className="w-3.5 h-3.5" /> ML Transcribe & Extract Tasks
                                    </button>
                                    <button onClick={() => handleGenerateAI("Full Report & MOM")} disabled={isGenerating} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 text-cyan-600 border border-cyan-500/20 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-cyan-500/20 transition-colors disabled:opacity-50">
                                        <FileText className="w-3.5 h-3.5" /> Full Report & MOM
                                    </button>
                                </div>

                                <div className="flex-1 relative mb-4 min-h-[200px]">
                                    {isGenerating && (
                                        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-xl border border-border">
                                            <Wand2 className="w-8 h-8 text-blue-500 animate-bounce mb-3" />
                                            <p className="text-sm font-medium animate-pulse">AI is summarizing the meeting...</p>
                                        </div>
                                    )}
                                    <textarea
                                        value={momEdit}
                                        onChange={(e) => setMomEdit(e.target.value)}
                                        placeholder="Meeting notes will appear here..."
                                        className="w-full h-full px-4 py-3 rounded-xl bg-background border border-border text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none custom-scrollbar"
                                    />
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-border shrink-0">
                                    <div className="relative">
                                        <button onClick={() => setShowExportMenu(!showExportMenu)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-xs font-semibold hover:bg-accent/80 transition-colors">
                                            <Download className="w-4 h-4" /> Export
                                        </button>
                                        {showExportMenu && (
                                            <div className="absolute bottom-full left-0 mb-1 w-32 bg-card border border-border shadow-xl rounded-xl overflow-hidden py-1 z-50 animate-scale-in">
                                                <button onClick={() => handleExport("txt")} className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors">Export as TXT</button>
                                                <button onClick={() => handleExport("word")} className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors">Export as Word (.doc)</button>
                                                <button onClick={() => handleExport("pdf")} className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors">Export as PDF</button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => { setSelectedMeeting(null); setUploadedFile(null); setTranscript(""); }} className="px-5 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors font-medium">Close</button>
                                        <button onClick={handleSaveMOM} className="btn-primary shadow-lg shadow-blue-500/20 bg-blue-600 hover:bg-blue-700">Save Updates</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AppShell>
    );
}

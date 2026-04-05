"use client";

import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useCommercialStore } from "@/store/commercial-store";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { MeetingItem } from "@/types";
import {
    Calendar, Plus, Users, MapPin, FileText, Download, X, Play,
    Mic, Upload, Wand2, Search, Filter, Loader2, FileAudio,
    CheckCircle2, ListTodo, Sparkles, ChevronRight, Video,
} from "lucide-react";
import { useTaskStore } from "@/store/task-store";
import { AIAgent } from "@/lib/ai-agent";
import { jsPDF } from "jspdf";
import { Toast } from "@/components/shared/toast";

// ─── Type for extracted task ──────────────────────────────────────
interface ExtractedTask {
  title: string;
  assignee_hint?: string;
  due_date_hint?: string;
  priority?: "low" | "medium" | "high";
  confirmed?: boolean;
  due_date?: string;
  description?: string;
}

// ─── Video MOM API types ──────────────────────────────────────────
interface VideoJobResult {
  transcription?: string;
  mom_markdown?: string;
  extracted_tasks?: ExtractedTask[];
  pdf_file_name?: string;
  pdf_file_path?: string;
  pdf_url?: string;
}

interface VideoJob {
  id: string;
  video_file_name?: string;
  status:
    | "pending"
    | "extracting_audio"
    | "transcribing"
    | "generating_mom"
    | "creating_pdf"
    | "completed"
    | "failed";
  progress: number;
  error?: string;
  result?: VideoJobResult;
}

const MOM_API_BASE = "http://localhost:8080/api/v1";

// ─── Helpers ─────────────────────────────────────────────────────
function stripMarkdown(md: string): string {
    return md
        .replace(/#{1,6}\s+/g, "")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/`(.+?)`/g, "$1")
        .replace(/\[(.+?)\]\(.+?\)/g, "$1")
        .replace(/^[-*+]\s/gm, "")
        .replace(/^>\s/gm, "")
        .replace(/^\d+\.\s/gm, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function parseDatePart(dateStr: string): string {
    if (!dateStr) return "";
    if (typeof dateStr === "string" && dateStr.includes("T")) return dateStr.split("T")[0];
    return dateStr;
}

export default function MeetingsPage() {
    const { meetings, syncFromMemory, addMeeting, updateMeeting } = useCommercialStore();

    React.useEffect(() => {
        syncFromMemory();
    }, [syncFromMemory]);
    const { addTask } = useTaskStore();
    const { data: session, status } = useSession();
    const currentUser = session?.user as any;

    // ── UI state ──────────────────────────────────────────────────
    const [showForm, setShowForm] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [isTranscribing, setIsTranscribing] = React.useState(false);
    const [isGeneratingAI, setIsGeneratingAI] = React.useState(false);
    const [toast, setToast] = React.useState<{ message: string; type: "success" | "error" } | null>(null);
    const [activeView, setActiveView] = React.useState<"card" | "list">("card");
    const [selectedMeeting, setSelectedMeeting] = React.useState<MeetingItem | null>(null);
    const [activeTab, setActiveTab] = React.useState<"all" | "upcoming" | "past">("all");
    const [search, setSearch] = React.useState("");
    const [modalTab, setModalTab] = React.useState<"mom" | "ai">("mom");

    // ── Form ──────────────────────────────────────────────────────
    const [form, setForm] = React.useState({ title: "", date: "", time: "10:00", location: "", attendees: "" });

    // ── MOM & AI content ─────────────────────────────────────────
    const [momText, setMomText] = React.useState("");        // plain text transcript
    const [aiSummary, setAiSummary] = React.useState("");   // markdown AI summary

    // ── Recording ─────────────────────────────────────────────────
    const [isRecording, setIsRecording] = React.useState(false);
    const [recordingSeconds, setRecordingSeconds] = React.useState(0);
    const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
    const audioChunksRef = React.useRef<Blob[]>([]);
    const recordingTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

    // ── File upload ───────────────────────────────────────────────
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const videoInputRef = React.useRef<HTMLInputElement>(null);
    const [uploadedFile, setUploadedFile] = React.useState<File | null>(null);

    // ── Task extraction ───────────────────────────────────────────
    const [extractedTasks, setExtractedTasks] = React.useState<ExtractedTask[]>([]);

    // ── Video MOM Processing State ────────────────────────────────
    const [videoUploading, setVideoUploading] = React.useState(false);
    const [videoProcessing, setVideoProcessing] = React.useState(false);
    const [videoJobId, setVideoJobId] = React.useState<string | null>(null);
    const [videoProgress, setVideoProgress] = React.useState(0);
    const [videoStatus, setVideoStatus] = React.useState("");
    const [videoPdfUrl, setVideoPdfUrl] = React.useState<string | null>(null);
    const pollingIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

    // ─── Open meeting modal ───────────────────────────────────────
    const openMeeting = (m: MeetingItem) => {
        setSelectedMeeting(m);
        setMomText(m.mom_content || "");
        setAiSummary(m.ai_summary || "");
        setUploadedFile(null);
        setExtractedTasks([]);
        setModalTab("mom");
        // Reset video processing state
        setVideoUploading(false);
        setVideoProcessing(false);
        setVideoJobId(null);
        setVideoProgress(0);
        setVideoStatus("");
        setVideoPdfUrl(null);
    };

    const closeModal = () => {
        setSelectedMeeting(null);
        setMomText("");
        setAiSummary("");
        setUploadedFile(null);
        setExtractedTasks([]);
        // Clean up video processing state
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        setVideoUploading(false);
        setVideoProcessing(false);
        setVideoJobId(null);
        setVideoProgress(0);
        setVideoStatus("");
        setVideoPdfUrl(null);
    };

    // ─── Create meeting ───────────────────────────────────────────
    const handleCreate = async () => {
        setIsSaving(true);
        try {
            await addMeeting({
                title: form.title, date: form.date, time: form.time, location: form.location,
                attendees: form.attendees.split(",").map((a) => a.trim()).filter(Boolean),
                status: "scheduled", action_items: [],
                created_by: currentUser?.id || "system", created_by_name: currentUser?.name || "System",
            });
            setToast({ message: "Meeting scheduled successfully!", type: "success" });
            setShowForm(false);
            setForm({ title: "", date: "", time: "10:00", location: "", attendees: "" });
        } catch {
            setToast({ message: "Failed to schedule meeting", type: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    // ─── Save MOM + AI ────────────────────────────────────────────
    const handleSave = async () => {
        if (!selectedMeeting) return;
        setIsSaving(true);
        try {
            await updateMeeting(selectedMeeting.id, {
                mom_content: momText,
                ai_summary: aiSummary,
                status: "completed",
            });
            setSelectedMeeting({ ...selectedMeeting, mom_content: momText, ai_summary: aiSummary, status: "completed" });
            setToast({ message: "Meeting notes saved!", type: "success" });
        } catch {
            setToast({ message: "Failed to save meeting notes", type: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    // ─── File Upload ──────────────────────────────────────────────
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedMeeting) return;
        setUploadedFile(file);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/upload", { method: "POST", body: formData });
            if (!res.ok) throw new Error("Upload failed");
            const data = await res.json();
            updateMeeting(selectedMeeting.id, { voice_note_url: data.url });
            setSelectedMeeting({ ...selectedMeeting, voice_note_url: data.url });
            setToast({ message: "File uploaded! Click Transcribe to extract text.", type: "success" });
        } catch {
            setToast({ message: "Failed to upload file.", type: "error" });
            setUploadedFile(null);
        }
    };

    // ─── Live Recording ────────────────────────────────────────────
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];
            setRecordingSeconds(0);

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
                const audioFile = new File([audioBlob], `recording_${Date.now()}.webm`, { type: "audio/webm" });
                setUploadedFile(audioFile);
                stream.getTracks().forEach((t) => t.stop());

                // Auto-upload
                if (selectedMeeting) {
                    const formData = new FormData();
                    formData.append("file", audioFile);
                    try {
                        const res = await fetch("/api/upload", { method: "POST", body: formData });
                        if (res.ok) {
                            const data = await res.json();
                            updateMeeting(selectedMeeting.id, { voice_note_url: data.url });
                            setSelectedMeeting((prev) => prev ? { ...prev, voice_note_url: data.url } : prev);
                            setToast({ message: "Recording saved! Click Transcribe to extract text.", type: "success" });
                        }
                    } catch { /* silent */ }
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
            recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
        } catch {
            setToast({ message: "Could not access microphone. Please check permissions.", type: "error" });
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        }
    };

    const formatSeconds = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

    // ─── Video MOM Processing (Go API) ─────────────────────────────
    const getVideoStatusText = (status: string): string => {
        const statusMap: Record<string, string> = {
            pending: "Waiting in queue...",
            extracting_audio: "Extracting audio from video...",
            transcribing: "Transcribing audio with AI...",
            generating_mom: "Generating meeting minutes...",
            creating_pdf: "Creating PDF document...",
            completed: "Processing complete!",
            failed: "Processing failed",
        };
        return statusMap[status] || status;
    };

    const pollVideoJobStatus = (jobId: string) => {
        pollingIntervalRef.current = setInterval(async () => {
            try {
                const res = await fetch(`${MOM_API_BASE}/mom/jobs/${jobId}`);
                if (!res.ok) throw new Error("Failed to check job status");
                
                const data = await res.json();
                const job: VideoJob = data.job;

                setVideoProgress(job.progress);
                setVideoStatus(getVideoStatusText(job.status));

                if (job.status === "completed" && job.result) {
                    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
                    setVideoProcessing(false);

                    // Update MOM text with transcription
                    if (job.result.transcription) {
                        setMomText((prev) => prev ? prev + "\n\n" + job.result!.transcription : job.result!.transcription || "");
                    }

                    // Update AI summary with MOM markdown
                    if (job.result.mom_markdown) {
                        setAiSummary(job.result.mom_markdown);
                    }

                    // Extract tasks
                    if (job.result.extracted_tasks && job.result.extracted_tasks.length > 0) {
                        setExtractedTasks(
                            job.result.extracted_tasks.map((t) => ({
                                ...t,
                                due_date: new Date().toISOString().split("T")[0],
                                confirmed: false,
                            }))
                        );
                    }

                    // Store PDF URL
                    if (job.result.pdf_url) {
                        setVideoPdfUrl(job.result.pdf_url);
                    }

                    setToast({ message: "Video MOM generated successfully!", type: "success" });
                    setModalTab("mom");
                } else if (job.status === "failed") {
                    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
                    setVideoProcessing(false);
                    setVideoStatus(`Failed: ${job.error || "Unknown error"}`);
                    setToast({ message: job.error || "Video processing failed", type: "error" });
                }
            } catch (error: any) {
                if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
                setVideoProcessing(false);
                setVideoStatus("Status check failed");
                setToast({ message: "Failed to check processing status", type: "error" });
            }
        }, 3000);
    };

    const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedMeeting) return;

        // Validate file extension
        const validExtensions = [".mp4", ".mov", ".avi", ".mkv", ".webm"];
        const fileExt = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
        if (!validExtensions.includes(fileExt)) {
            setToast({ message: "Invalid format. Allowed: mp4, mov, avi, mkv, webm", type: "error" });
            return;
        }

        setUploadedFile(file);
        setVideoUploading(true);
        setVideoStatus("Uploading video...");
        setVideoProgress(0);

        try {
            const formData = new FormData();
            formData.append("video", file);

            const res = await fetch(`${MOM_API_BASE}/mom/upload-video`, {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || "Upload failed");
            }

            const data = await res.json();
            setVideoJobId(data.job_id);
            setVideoUploading(false);
            setVideoProcessing(true);
            setVideoStatus("Processing started...");

            // Start polling for job status
            pollVideoJobStatus(data.job_id);

        } catch (error: any) {
            setVideoUploading(false);
            setVideoProcessing(false);
            setVideoStatus("");
            setToast({ message: error.message || "Video upload failed", type: "error" });
            setUploadedFile(null);
        }
    };

    // ─── Transcribe audio → plain text MOM ────────────────────────
    const handleTranscribe = async () => {
        if (!selectedMeeting?.voice_note_url) {
            setToast({ message: "Please upload an audio/video file first.", type: "error" });
            return;
        }
        setIsTranscribing(true);
        try {
            const res = await fetch("/api/transcribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fileUrl: selectedMeeting.voice_note_url }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Transcription failed");

            // MOM transcript = plain text (strip any markdown from transcription)
            const plainTranscript = data.transcription || "";
            setMomText((prev) => prev ? prev + "\n\n" + plainTranscript : plainTranscript);
            setModalTab("mom");

            // Extract tasks
            if (data.extracted_tasks && data.extracted_tasks.length > 0) {
                setExtractedTasks(
                    data.extracted_tasks.map((t: any) => ({
                        ...t,
                        due_date: new Date().toISOString().split("T")[0],
                        confirmed: false,
                    }))
                );
            }

            setToast({ message: "Transcription complete! Review the MOM below.", type: "success" });
        } catch (err: any) {
            setToast({ message: err.message || "Transcription failed.", type: "error" });
        } finally {
            setIsTranscribing(false);
        }
    };

    // ─── AI Summary (markdown) ─────────────────────────────────────
    const handleGenerateAISummary = async () => {
        if (!selectedMeeting) return;
        setIsGeneratingAI(true);
        try {
            const ai = new AIAgent({ apiKey: "" });
            const contextParts: string[] = [
                `Meeting: ${selectedMeeting.title}`,
                `Date: ${parseDatePart(selectedMeeting.date)} at ${selectedMeeting.time}`,
                `Attendees: ${selectedMeeting.attendees.join(", ")}`,
            ];
            if (momText) contextParts.push(`\nMOM Transcript:\n${momText}`);
            if (selectedMeeting.voice_note_url) contextParts.push(`\n(Based on audio/video recording attached to this meeting.)`);

            const prompt = `You are a professional business meeting assistant. Based on the following meeting information, generate a structured, professional executive summary.

${contextParts.join("\n")}

Output MUST be in Markdown format with the following sections:
## Executive Summary
## Key Discussion Points
## Decisions Made
## Action Items (with assignee and due date if mentioned)

Be concise and professional.`;

            const result = await ai.chat([{ role: "user", content: prompt }]);
            setAiSummary(result);
            setModalTab("ai");
            setToast({ message: "AI Summary generated!", type: "success" });
        } catch {
            setToast({ message: "Failed to generate AI summary. Check your API configuration.", type: "error" });
        } finally {
            setIsGeneratingAI(false);
        }
    };

    // ─── Push tasks to task tracker ───────────────────────────────
    const handlePushTasks = () => {
        const toAdd = extractedTasks.filter((t) => t.confirmed);
        if (toAdd.length === 0) {
            setToast({ message: "No tasks selected to add.", type: "error" });
            return;
        }
        toAdd.forEach((t) => {
            addTask({
                title: t.title,
                description: `From meeting: ${selectedMeeting?.title}`,
                priority: t.priority || "medium",
                status: "todo",
                assignee_id: currentUser?.id || "system",
                assignee_name: t.assignee_hint || currentUser?.name || "Unassigned",
                due_date: t.due_date || new Date().toISOString().split("T")[0],
                created_by: currentUser?.id || "system",
            });
        });
        setToast({ message: `${toAdd.length} task(s) added to Task Tracker!`, type: "success" });
        setExtractedTasks((prev) => prev.filter((t) => !t.confirmed));
    };

    // ─── Google Calendar ───────────────────────────────────────────
    const handleGoogleCalendar = () => {
        if (!selectedMeeting?.date || !selectedMeeting?.time) {
            setToast({ message: "Meeting date or time is missing", type: "error" });
            return;
        }
        try {
            const datePart = parseDatePart(selectedMeeting.date);
            const start = new Date(`${datePart}T${selectedMeeting.time}`);
            if (isNaN(start.getTime())) { setToast({ message: "Invalid meeting date or time format", type: "error" }); return; }
            const end = new Date(start.getTime() + 60 * 60 * 1000);
            const fmt = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
            window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(selectedMeeting.title)}&dates=${fmt(start)}/${fmt(end)}&details=${encodeURIComponent("Attendees: " + selectedMeeting.attendees.join(", "))}&location=${encodeURIComponent(selectedMeeting.location || "")}`, "_blank");
        } catch { setToast({ message: "Failed to create calendar event", type: "error" }); }
    };

    // ─── Export PDF ────────────────────────────────────────────────
    const exportPDF = (type: "mom" | "ai") => {
        if (!selectedMeeting) return;
        const doc = new jsPDF();
        const title = type === "mom" ? "MINUTES OF MEETING — TRANSCRIPT" : "AI EXECUTIVE SUMMARY";
        const content = type === "mom" ? momText : (aiSummary ? stripMarkdown(aiSummary) : "No AI summary generated yet.");

        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text(title, 105, 18, { align: "center" });

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Meeting: ${selectedMeeting.title}`, 20, 30);
        doc.text(`Date: ${parseDatePart(selectedMeeting.date)} at ${selectedMeeting.time}`, 20, 37);
        doc.text(`Location: ${selectedMeeting.location || "-"}`, 20, 44);
        const attendeesText = doc.splitTextToSize(`Attendees: ${selectedMeeting.attendees.join(", ")}`, 170);
        doc.text(attendeesText, 20, 51);

        let y = 51 + attendeesText.length * 6 + 4;
        doc.line(20, y, 190, y);
        y += 8;

        if (type === "ai" && aiSummary) {
            // For AI summary, render with markdown section headers
            const lines = aiSummary.split("\n");
            for (const line of lines) {
                if (y > 280) { doc.addPage(); y = 20; }
                if (line.startsWith("## ")) {
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(11);
                    doc.text(line.replace("## ", ""), 20, y);
                    y += 7;
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(10);
                } else if (line.startsWith("# ")) {
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(13);
                    doc.text(line.replace("# ", ""), 20, y);
                    y += 8;
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(10);
                } else if (line.trim()) {
                    const wrapped = doc.splitTextToSize(line.replace(/^[-*]\s/, "• "), 170);
                    doc.text(wrapped, 22, y);
                    y += wrapped.length * 6;
                } else {
                    y += 3;
                }
            }
        } else {
            const wrapped = doc.splitTextToSize(content || "No content recorded.", 170);
            for (let i = 0; i < wrapped.length; i++) {
                if (y > 280) { doc.addPage(); y = 20; }
                doc.text(wrapped[i], 20, y);
                y += 6;
            }
        }

        const datePart = parseDatePart(selectedMeeting.date);
        const cleanTitle = selectedMeeting.title.replace(/[^a-z0-9]/gi, "_").replace(/_+/g, "_").substring(0, 30);
        doc.save(`${type === "mom" ? "MOM" : "AI_Summary"}_${cleanTitle}_${datePart}.pdf`);
    };

    // ─── Derived data ──────────────────────────────────────────────
    const todayStr = new Date().toISOString().split("T")[0];

    const userMeetings = meetings; // Show all meetings to every authenticated user as requested

    const upcomingCount = userMeetings.filter((m) => parseDatePart(m.date) >= todayStr && m.status === "scheduled").length;
    const todayCount = userMeetings.filter((m) => parseDatePart(m.date) === todayStr).length;
    const buyerCount = userMeetings.filter((m) => (m.title || "").toLowerCase().includes("buyer") || (m.title || "").toLowerCase().includes("client")).length;
    const aiMOMCount = userMeetings.filter((m) => m.ai_summary).length;

    const filtered = userMeetings.filter((m) => {
        const dp = parseDatePart(m.date);
        if (activeTab === "upcoming") return dp >= todayStr && m.status === "scheduled";
        if (activeTab === "past") return dp < todayStr || m.status === "completed";
        return true;
    }).filter((m) => search
        ? (m.title || "").toLowerCase().includes(search.toLowerCase()) || m.attendees.join(" ").toLowerCase().includes(search.toLowerCase())
        : true
    );

    if (status === "loading") {
        return <AppShell><div className="flex h-[50vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div></AppShell>;
    }

    return (
        <AppShell>
            <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fade-in relative z-20">
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-blue-500">Meeting</h1>
                        <p className="text-sm text-muted-foreground mt-1">Schedule meetings, record sessions, and generate automated MOM</p>
                    </div>
                    <button onClick={() => setShowForm(!showForm)} className="btn-primary shadow-lg shadow-blue-500/20 bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-1.5" /> New Meeting
                    </button>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up relative z-10">
                    {[
                        { label: "Upcoming", value: upcomingCount, icon: Calendar, color: "text-blue-600", bg: "bg-blue-500/10" },
                        { label: "Today's", value: todayCount, icon: Play, color: "text-sky-500", bg: "bg-sky-500/10" },
                        { label: "Buyer Meetings", value: buyerCount, icon: Users, color: "text-indigo-500", bg: "bg-indigo-500/10" },
                        { label: "AI Summaries", value: aiMOMCount, icon: Sparkles, color: "text-cyan-500", bg: "bg-cyan-500/10" },
                    ].map(({ label, value, icon: Icon, color, bg }) => (
                        <div key={label} className="card-elevated p-5 relative overflow-hidden group">
                            <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-500/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
                            <div className="flex items-center gap-2 text-muted-foreground mb-3">
                                <Icon className={cn("w-4 h-4", color)} />
                                <span className="text-xs font-semibold uppercase">{label}</span>
                            </div>
                            <p className={cn("text-2xl font-bold font-mono", color)}>{value}</p>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <div className="flex items-center gap-3 flex-wrap animate-fade-in delay-1">
                    <div className="flex bg-blue-500/5 p-1 rounded-xl shrink-0 border border-blue-500/10">
                        {["all", "upcoming", "past"].map((t) => (
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
                            <button onClick={handleCreate} className="btn-primary bg-blue-600 hover:bg-blue-700 disabled:opacity-50" disabled={!form.title || !form.date || isSaving}>
                                {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : <><Plus className="w-4 h-4 mr-1.5" />Create Meeting</>}
                            </button>
                            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors" disabled={isSaving}>Cancel</button>
                        </div>
                    </div>
                )}

                {/* Meeting Cards */}
                {activeView === "card" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filtered.map((m, i) => {
                            const dp = parseDatePart(m.date);
                            const isCompleted = m.status === "completed" || dp < todayStr;
                            return (
                                <div key={m.id} className={cn("card-interactive p-5 space-y-3 animate-slide-up border border-transparent hover:border-blue-500/30", `delay-${Math.min(i + 1, 6)}`)} onClick={() => openMeeting(m)}>
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
                                        {m.ai_summary && <span className="flex items-center gap-1.5 text-cyan-500"><Sparkles className="w-3.5 h-3.5" />AI</span>}
                                    </div>
                                </div>
                            );
                        })}
                        {filtered.length === 0 && <div className="col-span-full p-12 text-center text-muted-foreground text-sm flex flex-col items-center"><Calendar className="w-8 h-8 opacity-20 mb-3" />No meetings found.</div>}
                    </div>
                ) : (
                    <div className="card-elevated overflow-hidden animate-slide-up">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-accent/30">
                                        {["Title", "Date & Time", "Location", "Attendees", "Status", "Actions"].map((h, i) => (
                                            <th key={h} className={cn("px-4 py-3 text-[10px] font-semibold text-muted-foreground uppercase", i === 5 ? "text-right" : "text-left")}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((m) => {
                                        const dp = parseDatePart(m.date);
                                        const isCompleted = m.status === "completed" || dp < todayStr;
                                        return (
                                            <tr key={m.id} className="border-b border-border/50 hover:bg-accent/20 transition-colors cursor-pointer" onClick={() => openMeeting(m)}>
                                                <td className="px-4 py-3">
                                                    <p className="font-bold text-xs">{m.title}</p>
                                                    <div className="flex gap-1 mt-1">
                                                        {m.mom_content && <span className="text-[9px] text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded font-bold">MOM</span>}
                                                        {m.ai_summary && <span className="text-[9px] text-cyan-500 bg-cyan-500/10 px-1.5 py-0.5 rounded font-bold">AI</span>}
                                                    </div>
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
                                                    <button className="px-2.5 py-1 rounded-md bg-background border border-border text-[10px] font-bold hover:bg-accent transition-colors">Open</button>
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

                {/* ══════════════ MEETING DETAIL MODAL ══════════════ */}
                {selectedMeeting && (
                    <div className="modal-overlay z-50 fixed inset-0 flex items-center justify-center p-4">
                        <div className="modal-backdrop absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={closeModal} />
                        <div className="modal-content relative bg-card border border-border w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-2xl shadow-2xl animate-scale-in flex flex-col">

                            {/* Modal Top Bar */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0 bg-accent/5">
                                <div>
                                    <h2 className="text-base font-bold leading-tight">{selectedMeeting.title}</h2>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {new Date(selectedMeeting.date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} at {selectedMeeting.time}
                                        {selectedMeeting.location ? ` · ${selectedMeeting.location}` : ""}
                                        {selectedMeeting.attendees.length > 0 ? ` · ${selectedMeeting.attendees.join(", ")}` : ""}
                                    </p>
                                </div>
                                <button onClick={closeModal} className="p-2 hover:bg-accent rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                            </div>

                            {/* Modal Body (left + right panels) */}
                            <div className="flex flex-1 overflow-hidden divide-x divide-border">

                                {/* ── LEFT PANEL: Info + Recording ── */}
                                <div className="w-64 shrink-0 flex flex-col gap-4 p-5 overflow-y-auto bg-accent/5">
                                    {/* Calendar Button */}
                                    <button onClick={handleGoogleCalendar} className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold shadow-md shadow-blue-500/20 hover:bg-blue-700 hover:-translate-y-0.5 transition-all">
                                        <Calendar className="w-4 h-4" /> Add to Google Calendar
                                    </button>

                                    {/* Recording Section */}
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-semibold uppercase text-muted-foreground">Recording Input</h4>
                                        <div className="grid grid-cols-1 gap-2">
                                            <button onClick={() => isRecording ? stopRecording() : startRecording()}
                                                className={cn("w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-colors",
                                                    isRecording ? "bg-red-500/10 border-red-500/30 text-red-500" : "bg-card border-border hover:border-blue-500/50 hover:bg-blue-500/5 text-muted-foreground hover:text-foreground")}
                                                disabled={videoUploading || videoProcessing}>
                                                <Mic className={cn("w-4 h-4", isRecording ? "animate-pulse" : "")} />
                                                {isRecording ? `Stop · ${formatSeconds(recordingSeconds)}` : "Start Live Record"}
                                            </button>
                                            <input type="file" ref={fileInputRef} className="hidden" accept="audio/*" onChange={handleFileUpload} />
                                            <button onClick={() => fileInputRef.current?.click()}
                                                className={cn("w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-colors",
                                                    selectedMeeting.voice_note_url || uploadedFile ? "bg-emerald-500/5 border-emerald-500/30 text-emerald-600" : "bg-card border-border hover:border-blue-500/50 hover:bg-blue-500/5 text-muted-foreground hover:text-foreground")}
                                                disabled={videoUploading || videoProcessing}>
                                                <Upload className="w-4 h-4" />
                                                {selectedMeeting.voice_note_url || (uploadedFile && !uploadedFile.type.startsWith("video/")) ? "Change Audio" : "Upload Audio"}
                                            </button>
                                        </div>

                                        {/* Video MOM Section */}
                                        <div className="pt-3 border-t border-border space-y-2">
                                            <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                                                <Video className="w-3 h-3" /> Video MOM (AI)
                                            </h4>
                                            <p className="text-[9px] text-muted-foreground leading-relaxed">
                                                Upload video meeting untuk auto-generate MOM dengan AI. Supported: mp4, mov, avi, mkv, webm.
                                            </p>
                                            <input type="file" ref={videoInputRef} className="hidden" accept=".mp4,.mov,.avi,.mkv,.webm,video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm" onChange={handleVideoUpload} />
                                            <button onClick={() => videoInputRef.current?.click()}
                                                className={cn("w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-colors",
                                                    videoJobId ? "bg-violet-500/10 border-violet-500/30 text-violet-600" : "bg-card border-border hover:border-violet-500/50 hover:bg-violet-500/5 text-muted-foreground hover:text-foreground")}
                                                disabled={videoUploading || videoProcessing || isRecording}>
                                                <Video className="w-4 h-4" />
                                                {videoUploading ? "Uploading..." : videoProcessing ? "Processing..." : "Upload Video Meeting"}
                                            </button>

                                            {/* Uploaded video file name */}
                                            {uploadedFile && uploadedFile.type.startsWith("video/") && (
                                                <p className="text-[10px] text-violet-500 truncate text-center font-medium">{uploadedFile.name}</p>
                                            )}

                                            {/* Video Processing Progress */}
                                            {(videoUploading || videoProcessing) && (
                                                <div className="space-y-2 p-3 bg-violet-500/5 rounded-xl border border-violet-500/20">
                                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                        <div
                                                            className="bg-violet-600 h-2 rounded-full transition-all duration-500"
                                                            style={{ width: `${videoProgress}%` }}
                                                        />
                                                    </div>
                                                    <div className="flex items-center justify-between text-[10px]">
                                                        <span className="text-violet-600 font-medium">{videoStatus}</span>
                                                        <span className="text-muted-foreground font-mono">{videoProgress}%</span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Video PDF Download */}
                                            {videoPdfUrl && !videoProcessing && (
                                                <a href={videoPdfUrl} target="_blank" rel="noopener noreferrer"
                                                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-all">
                                                    <Download className="w-3.5 h-3.5" />Download API Generated PDF
                                                </a>
                                            )}
                                        </div>

                                        {uploadedFile && !uploadedFile.type.startsWith("video/") && <p className="text-[10px] text-muted-foreground truncate text-center">{uploadedFile.name}</p>}

                                        {/* Transcribe Button (for audio only) */}
                                        {(selectedMeeting.voice_note_url || (uploadedFile && !uploadedFile.type.startsWith("video/"))) && !videoProcessing && (
                                            <button onClick={handleTranscribe} disabled={isTranscribing}
                                                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 transition-all disabled:opacity-50">
                                                {isTranscribing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Transcribing...</>
                                                    : <><FileAudio className="w-3.5 h-3.5" />Transcribe → MOM</>}
                                            </button>
                                        )}

                                        {/* Audio/Video Player */}
                                        {selectedMeeting.voice_note_url && !uploadedFile && (
                                            <div className="rounded-xl overflow-hidden border border-border bg-black/5 p-2">
                                                {selectedMeeting.voice_note_url.match(/\.(mp4|webm|ogg)$/i) ? (
                                                    <video controls className="w-full h-auto max-h-[120px] rounded-lg">
                                                        <source src={selectedMeeting.voice_note_url} />
                                                    </video>
                                                ) : (
                                                    <audio controls className="w-full h-9 outline-none">
                                                        <source src={selectedMeeting.voice_note_url} />
                                                    </audio>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* AI Summary Button */}
                                    <div className="space-y-2 pt-3 border-t border-border">
                                        <h4 className="text-xs font-semibold uppercase text-muted-foreground">AI Actions</h4>
                                        <button onClick={handleGenerateAISummary} disabled={isGeneratingAI}
                                            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-cyan-600 text-white text-xs font-semibold hover:bg-cyan-700 transition-all disabled:opacity-50">
                                            {isGeneratingAI ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Summarizing...</>
                                                : <><Sparkles className="w-3.5 h-3.5" />Generate AI Summary</>}
                                        </button>
                                    </div>

                                    {/* Export Buttons */}
                                    <div className="space-y-2 pt-3 border-t border-border">
                                        <h4 className="text-xs font-semibold uppercase text-muted-foreground">Export</h4>
                                        <button onClick={() => exportPDF("mom")}
                                            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-background border border-border text-xs font-semibold hover:bg-accent transition-colors">
                                            <Download className="w-3.5 h-3.5" />Export MOM PDF
                                        </button>
                                        <button onClick={() => exportPDF("ai")} disabled={!aiSummary}
                                            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-background border border-border text-xs font-semibold hover:bg-accent transition-colors disabled:opacity-40">
                                            <FileText className="w-3.5 h-3.5" />Export AI Summary PDF
                                        </button>
                                    </div>
                                </div>

                                {/* ── RIGHT PANEL: MOM + AI Tabs ── */}
                                <div className="flex-1 flex flex-col overflow-hidden">
                                    {/* Tab Bar */}
                                    <div className="flex items-center gap-1 px-6 pt-4 pb-0 shrink-0">
                                        <button onClick={() => setModalTab("mom")}
                                            className={cn("px-4 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2", modalTab === "mom"
                                                ? "bg-background border-blue-500 text-blue-600 shadow-sm"
                                                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50")}>
                                            <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" />MOM Transcript</span>
                                        </button>
                                        <button onClick={() => setModalTab("ai")}
                                            className={cn("px-4 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2 flex items-center gap-1.5", modalTab === "ai"
                                                ? "bg-background border-cyan-500 text-cyan-600 shadow-sm"
                                                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50")}>
                                            <Sparkles className="w-3.5 h-3.5" />AI Summary
                                            {aiSummary && <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 inline-block ml-0.5" />}
                                        </button>
                                    </div>

                                    {/* Tab Content */}
                                    <div className="flex-1 overflow-hidden px-6 pb-0 pt-3 flex flex-col gap-3">
                                        {modalTab === "mom" ? (
                                            <>
                                                <p className="text-[10px] text-muted-foreground">
                                                    Plain text transcript — type manually or use Transcribe to auto-fill from audio/video. This exports as raw MOM PDF.
                                                </p>
                                                <div className="relative flex-1">
                                                    {isTranscribing && (
                                                        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-xl">
                                                            <FileAudio className="w-8 h-8 text-violet-500 animate-bounce mb-2" />
                                                            <p className="text-sm font-medium animate-pulse">Transcribing audio...</p>
                                                        </div>
                                                    )}
                                                    <textarea
                                                        value={momText}
                                                        onChange={(e) => setMomText(e.target.value)}
                                                        placeholder="Start typing the meeting notes here, or use Live Record / Upload Audio to auto-transcribe..."
                                                        className="w-full h-full min-h-[280px] px-4 py-3 rounded-xl bg-background border border-border text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none custom-scrollbar font-mono leading-relaxed"
                                                    />
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <p className="text-[10px] text-muted-foreground">
                                                    AI-generated markdown summary based on MOM transcript and audio sources. Exports with formatted sections.
                                                </p>
                                                <div className="relative flex-1">
                                                    {isGeneratingAI && (
                                                        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-xl">
                                                            <Sparkles className="w-8 h-8 text-cyan-500 animate-bounce mb-2" />
                                                            <p className="text-sm font-medium animate-pulse">AI is summarizing...</p>
                                                        </div>
                                                    )}
                                                    <textarea
                                                        value={aiSummary}
                                                        onChange={(e) => setAiSummary(e.target.value)}
                                                        placeholder="Click 'Generate AI Summary' in the left panel to auto-generate from your MOM transcript and recording..."
                                                        className="w-full h-full min-h-[280px] px-4 py-3 rounded-xl bg-background border border-cyan-500/20 text-sm outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 resize-none custom-scrollbar font-mono leading-relaxed"
                                                    />
                                                </div>
                                            </>
                                        )}

                                        {/* Extracted Tasks Panel */}
                                        {extractedTasks.length > 0 && (
                                            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3 shrink-0">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-xs font-bold text-amber-600 flex items-center gap-1.5">
                                                        <ListTodo className="w-4 h-4" /> {extractedTasks.length} Tasks Extracted from Transcript
                                                    </p>
                                                    <button onClick={handlePushTasks}
                                                        className="flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-500 text-white text-[10px] font-bold hover:bg-amber-600 transition-colors">
                                                        <ChevronRight className="w-3 h-3" />Push Selected to Tasks
                                                    </button>
                                                </div>
                                                <div className="space-y-2 max-h-44 overflow-y-auto custom-scrollbar">
                                                    {extractedTasks.map((t, i) => (
                                                        <div key={i} className="flex items-center gap-3 bg-background rounded-lg p-2.5 border border-border">
                                                            <input type="checkbox" checked={t.confirmed || false}
                                                                onChange={(e) => setExtractedTasks((prev) => prev.map((x, idx) => idx === i ? { ...x, confirmed: e.target.checked } : x))}
                                                                className="w-3.5 h-3.5 rounded accent-amber-500 shrink-0" />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs font-semibold truncate">{t.title}</p>
                                                                <p className="text-[10px] text-muted-foreground">{t.assignee_hint ? `→ ${t.assignee_hint}` : ""} {t.due_date_hint ? `· ${t.due_date_hint}` : ""}</p>
                                                            </div>
                                                            <input type="date" value={t.due_date || ""} onChange={(e) => setExtractedTasks((prev) => prev.map((x, idx) => idx === i ? { ...x, due_date: e.target.value } : x))}
                                                                className="text-[10px] border border-border rounded px-1.5 py-1 bg-background outline-none focus:border-amber-500 w-28 shrink-0" />
                                                            <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0",
                                                                t.priority === "high" ? "bg-red-500/10 text-red-500" : t.priority === "medium" ? "bg-amber-500/10 text-amber-600" : "bg-slate-500/10 text-slate-500")}>
                                                                {t.priority || "medium"}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Modal Footer */}
                                    <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0 bg-accent/5">
                                        <p className="text-[10px] text-muted-foreground">
                                            {momText ? `${momText.length} chars` : "No MOM yet"}{aiSummary ? " · AI Summary ready" : ""}
                                        </p>
                                        <div className="flex gap-2">
                                            <button onClick={closeModal} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent transition-colors font-medium" disabled={isSaving}>Close</button>
                                            <button onClick={handleSave} className="btn-primary shadow-lg shadow-blue-500/20 bg-blue-600 hover:bg-blue-700" disabled={isSaving}>
                                                {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : "Save Notes"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            </div>
        </AppShell>
    );
}

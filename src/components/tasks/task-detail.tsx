"use client";

import React from "react";
import { X, Send, MessageSquare, Activity, Clock, User as UserIcon } from "lucide-react";
import { cn, getInitials, relativeDate } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { useTaskStore } from "@/store/task-store";
import { TASK_STATUSES, TASK_PRIORITIES } from "@/lib/constants";
import { Task } from "@/types";
import { sendWhatsAppReminder } from "@/lib/whatsapp-client";

export function TaskDetail({ task, onClose }: { task: Task; onClose: () => void }) {
    const { currentUser } = useAuthStore();
    const addComment = useTaskStore((s) => s.addComment);
    const moveTask = useTaskStore((s) => s.moveTask);
    const [tab, setTab] = React.useState<"comments" | "activity">("comments");
    const [comment, setComment] = React.useState("");

    const statusCfg = TASK_STATUSES.find((s) => s.value === task.status);
    const priCfg = TASK_PRIORITIES.find((p) => p.value === task.priority);

    const handleComment = () => {
        if (!comment.trim() || !currentUser) return;
        addComment(task.id, currentUser.id, currentUser.name, currentUser.role, comment);
        setComment("");
    };

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6" onClick={onClose}>
                <div className="absolute inset-0 bg-black/20 animate-backdrop-in" />
                <div className="relative w-full max-w-2xl bg-white dark:bg-[#13141b] rounded-2xl border border-border flex flex-col shadow-2xl animate-scale-in max-h-[90vh] overflow-hidden"
                    onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 h-14 border-b border-border shrink-0">
                        <h3 className="text-sm font-semibold truncate pr-2">{task.title}</h3>
                        <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-accent transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
                        {/* Status & Priority */}
                        <div className="flex items-center gap-2 animate-fade-in">
                            <select
                                value={task.status}
                                onChange={(e) => moveTask(task.id, e.target.value as any, currentUser?.name || "System")}
                                className="status-badge text-[10px] items-center text-center font-bold outline-none cursor-pointer border-none appearance-none"
                                style={{ color: statusCfg?.color, backgroundColor: `${statusCfg?.color}15` }}
                            >
                                {TASK_STATUSES.map(st => (
                                    <option key={st.value} value={st.value} style={{ color: '#000' }}>{st.label}</option>
                                ))}
                            </select>
                            <span className="status-badge text-[10px]" style={{ color: priCfg?.color, backgroundColor: `${priCfg?.color}15` }}>
                                {priCfg?.label} Priority
                            </span>
                        </div>

                        {/* Description */}
                        <div className="animate-fade-in delay-1">
                            <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider mb-1">Description</p>
                            <p className="text-sm text-muted-foreground leading-relaxed">{task.description}</p>
                        </div>

                        {/* Meta */}
                        <div className="grid grid-cols-2 gap-4 animate-fade-in delay-2">
                            <div className="space-y-0.5">
                                <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1"><UserIcon className="w-3 h-3" /> Assignee</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary">
                                        {getInitials(task.assignee_name)}
                                    </div>
                                    <span className="text-xs font-medium">{task.assignee_name}</span>
                                    <button
                                        onClick={() => sendWhatsAppReminder(task, "+6281234567890", task.assignee_name)}
                                        className="ml-auto p-1 text-green-600 hover:bg-green-50 rounded dark:hover:bg-green-900/20"
                                        title="Send WhatsApp Reminder"
                                    >
                                        <MessageSquare className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-0.5">
                                <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1"><Clock className="w-3 h-3" /> Due Date</p>
                                <p className="text-xs font-medium mt-1">{relativeDate(task.due_date)}</p>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="border-b border-border animate-fade-in delay-3">
                            <div className="flex gap-4">
                                {(["comments", "activity"] as const).map((t) => (
                                    <button key={t} onClick={() => setTab(t)}
                                        className={cn("pb-2 text-xs font-semibold capitalize transition-all duration-200 border-b-2",
                                            tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                                        )}>
                                        <span className="flex items-center gap-1">
                                            {t === "comments" ? <MessageSquare className="w-3 h-3" /> : <Activity className="w-3 h-3" />}
                                            {t}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Tab content */}
                        {tab === "comments" && (
                            <div className="space-y-3">
                                {task.comments.map((c, i) => (
                                    <div key={c.id} className={cn("flex gap-2.5 animate-fade-in", `delay-${Math.min(i + 1, 6)}`)}>
                                        <div className="w-6 h-6 rounded-lg bg-accent flex items-center justify-center text-[9px] font-bold shrink-0">
                                            {getInitials(c.user_name)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-semibold">{c.user_name}</span>
                                                <span className="text-[10px] text-muted-foreground">{relativeDate(c.created_at)}</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{c.content}</p>
                                        </div>
                                    </div>
                                ))}
                                {task.comments.length === 0 && (
                                    <p className="text-xs text-muted-foreground text-center py-4">No comments yet</p>
                                )}
                            </div>
                        )}

                        {tab === "activity" && (
                            <div className="space-y-3">
                                {task.activities.map((a, i) => (
                                    <div key={a.id} className={cn("flex gap-2.5 animate-fade-in", `delay-${Math.min(i + 1, 6)}`)}>
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary/40 mt-1.5 shrink-0" />
                                        <div className="flex-1">
                                            <p className="text-xs">{a.action}</p>
                                            <p className="text-[10px] text-muted-foreground">{a.user_name} · {relativeDate(a.created_at)}</p>
                                        </div>
                                    </div>
                                ))}
                                {task.activities.length === 0 && (
                                    <p className="text-xs text-muted-foreground text-center py-4">No activity yet</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Comment input */}
                    {tab === "comments" && (
                        <div className="px-5 py-3 border-t border-border shrink-0">
                            <div className="flex gap-2">
                                <input
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleComment()}
                                    placeholder="Write a comment..."
                                    className="flex-1 px-3 py-2.5 rounded-xl border border-border bg-transparent text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-shadow"
                                />
                                <button onClick={handleComment} disabled={!comment.trim()} className="btn-primary px-3 disabled:opacity-30">
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

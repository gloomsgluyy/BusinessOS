"use client";

import React from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Plus, Calendar, MessageSquare } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { TaskDetail } from "@/components/tasks/task-detail";
import { useSession } from "next-auth/react";
import { useTaskStore } from "@/store/task-store";
import { cn, getInitials, generateId } from "@/lib/utils";
import { TASK_STATUSES, TASK_PRIORITIES, DEMO_USERS } from "@/lib/constants";
import { Task, TaskStatus, TaskPriority } from "@/types";
import { sendWhatsAppReminder } from "@/lib/whatsapp-client";

export default function MyTasksPage() {
    const [, setIsInitializing] = React.useState(false);

    const { data: session } = useSession();
    const currentUser = session?.user as any;
    const hasPermission = (permission: string) => {
      const role = currentUser?.role as string;
      if (!role) return false;
      return (
        role !== "STAFF" &&
        !role.startsWith("TRAFFIC_TEAM_") &&
        !role.startsWith("SOURCING_OFFICER_") &&
        !role.startsWith("TRADERS_") &&
        role !== "JUNIOR_TRADER"
      );
    };
    // Mock users list since users was previously pulled from authStore:
    const users = DEMO_USERS || [];
    const tasks = useTaskStore((s) => s.tasks);
    const syncFromMemory = useTaskStore((s) => s.syncFromMemory);
    const moveTask = useTaskStore((s) => s.moveTask);
    const addTask = useTaskStore((s) => s.addTask);

    React.useEffect(() => {
        syncFromMemory().finally(() => setIsInitializing(false));
    }, [syncFromMemory]);
    const [selectedTask, setSelectedTask] = React.useState<Task | null>(null);
    const [showAdd, setShowAdd] = React.useState(false);
    const [newTitle, setNewTitle] = React.useState("");
    const [newDesc, setNewDesc] = React.useState("");
    const [newPriority, setNewPriority] = React.useState<TaskPriority>("medium");
    const [newDueDate, setNewDueDate] = React.useState("");

    const myTasks = tasks.filter((t) => t.assignee_id === currentUser?.id || t.assignee_name === currentUser?.name);

    const summary = TASK_STATUSES.map((s) => ({
        ...s,
        count: myTasks.filter((t) => t.status === s.value).length,
    }));

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination) return;
        const newStatus = result.destination.droppableId as TaskStatus;
        const taskId = result.draggableId;
        const task = myTasks.find((t) => t.id === taskId);
        if (!task) return;
        if (!hasPermission("move_to_done") && newStatus === "done") return;
        moveTask(taskId, newStatus, currentUser?.name || "System");
    };

    const handleAddTask = () => {
        if (!newTitle.trim()) return;
        addTask({
            title: newTitle,
            description: newDesc,
            status: "todo",
            priority: newPriority,
            assignee_id: currentUser?.id || "system",
            assignee_name: currentUser?.name || "System",
            due_date: newDueDate || new Date(Date.now() + 7 * 86400000).toISOString(),
            created_by: currentUser?.id || "system",
        });
        setNewTitle(""); setNewDesc(""); setNewPriority("medium"); setNewDueDate(""); setShowAdd(false);
    };

    const currentSelected = selectedTask ? tasks.find((t) => t.id === selectedTask.id) || null : null;


    return (
        <AppShell>
            <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto h-[calc(100vh-4rem)] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between mb-6 animate-fade-in shrink-0">
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold">My Tasks</h1>
                        <p className="text-sm text-muted-foreground">Manage your workflow</p>
                    </div>
                    <button onClick={() => setShowAdd(true)} className="btn-primary shadow-lg shadow-primary/20">
                        <Plus className="w-4 h-4" />
                        Create Task
                    </button>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6 shrink-0">
                    <div className="card-elevated p-4 animate-slide-up delay-1 bg-accent/30">
                        <div className="flex items-center justify-between text-muted-foreground">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/70">Total Tasks</span>
                        </div>
                        <p className="text-2xl font-bold mt-2">{myTasks.length}</p>
                    </div>
                    {summary.map((s, i) => (
                        <div key={s.value} className={cn("rounded-xl border p-4 transition-all duration-300 hover:shadow-md animate-slide-up bg-card", `delay-${i + 2}`)}>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                                <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{s.label}</span>
                            </div>
                            <p className="text-2xl font-bold">{s.count}</p>
                        </div>
                    ))}
                </div>

                {/* Kanban */}
                <div className="flex-1 min-h-0 overflow-x-auto pb-4">
                    <DragDropContext onDragEnd={handleDragEnd}>
                        <div className="flex gap-4 h-full min-w-[1000px]">
                            {TASK_STATUSES.map((col) => {
                                const colTasks = myTasks.filter((t) => t.status === col.value);
                                return (
                                    <div key={col.value} className="flex-1 flex flex-col min-w-[280px] max-w-[350px]">
                                        <div className={cn("flex items-center gap-2 mb-3 px-3 py-2 rounded-xl border border-border/40 shadow-sm", col.bgClass, "bg-opacity-20")}>
                                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                                            <span className="text-sm font-bold text-foreground/90">{col.label}</span>
                                            <span className="ml-auto text-xs font-semibold text-muted-foreground bg-background/80 px-2 py-0.5 rounded-md shadow-sm border border-border/10">{colTasks.length}</span>
                                        </div>

                                        <div className={cn(
                                            "rounded-2xl p-2 transition-all border-2 border-dashed border-border/80", // Thicker/darker border
                                            "bg-secondary/10", // Very soft background
                                            "min-h-[150px] h-fit" // Adaptive height
                                        )}>
                                            <Droppable droppableId={col.value}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.droppableProps}
                                                        className={cn("space-y-3", snapshot.isDraggingOver ? "bg-secondary/80 rounded-xl" : "")}
                                                        style={{ minHeight: "100px" }}
                                                    >
                                                        {colTasks.map((task, i) => {
                                                            const priCfg = TASK_PRIORITIES.find((p) => p.value === task.priority);
                                                            return (
                                                                <Draggable key={task.id} draggableId={task.id} index={i}>
                                                                    {(prov, snapshot) => (
                                                                        <div
                                                                            ref={prov.innerRef}
                                                                            {...prov.draggableProps}
                                                                            {...prov.dragHandleProps}
                                                                            onClick={() => setSelectedTask(task)}
                                                                            className={cn(
                                                                                "group relative bg-card rounded-xl p-3.5 shadow-sm border border-border/40 cursor-pointer transition-all duration-200 select-none",
                                                                                snapshot.isDragging
                                                                                    ? "shadow-xl rotate-1 scale-[1.02] border-primary/50 z-50 ring-2 ring-primary/10"
                                                                                    : "hover:shadow-md hover:border-border/80"
                                                                            )}
                                                                            style={{
                                                                                ...prov.draggableProps.style,
                                                                                borderLeft: `4px solid ${priCfg?.color || 'transparent'}`,
                                                                                borderRadius: '12px'
                                                                            }}
                                                                        >
                                                                            <div className="flex justify-between items-start gap-2 mb-2">
                                                                                <p className="text-sm font-medium leading-snug line-clamp-2 text-foreground/90">{task.title}</p>
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        const assignee = users.find(u => u.id === task.assignee_id);
                                                                                        sendWhatsAppReminder(task, assignee?.phone, assignee?.name);
                                                                                    }}
                                                                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-green-600 bg-green-500/10 hover:bg-green-500 hover:text-white rounded-lg transition-all"
                                                                                    title="Remind via WhatsApp"
                                                                                >
                                                                                    <MessageSquare className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            </div>

                                                                            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/30">
                                                                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-accent/50 px-2 py-1 rounded-md">
                                                                                    <Calendar className="w-3 h-3" />
                                                                                    {new Date(task.due_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                                                                                </div>
                                                                                {task.priority === 'high' && (
                                                                                    <span className="ml-auto flex h-2 w-2 rounded-full relative">
                                                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </Draggable>
                                                            );
                                                        })}
                                                        {provided.placeholder}
                                                        {colTasks.length === 0 && (
                                                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground/30 py-8">
                                                                <div className="w-12 h-12 rounded-full border-2 border-dashed border-current mb-2 flex items-center justify-center opacity-50">
                                                                    <Plus className="w-5 h-5" />
                                                                </div>
                                                                <p className="text-xs font-medium">Empty</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </Droppable>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </DragDropContext>
                </div>

                {/* Task detail drawer */}
                {currentSelected && (
                    <TaskDetail task={currentSelected} onClose={() => setSelectedTask(null)} />
                )}

                {/* Add task dialog */}
                {showAdd && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6" onClick={() => setShowAdd(false)}>
                        <div className="absolute inset-0 bg-black/20 animate-backdrop-in" />
                        <div className="relative w-full max-w-lg bg-white dark:bg-[#13141b] rounded-2xl border border-border flex flex-col shadow-2xl animate-scale-in max-h-[90vh] overflow-hidden"
                            onClick={e => e.stopPropagation()}>
                            <div className="p-6 border-b border-border">
                                <h3 className="text-lg font-bold">Create New Task</h3>
                                <p className="text-sm text-muted-foreground mt-1">Add a new task to your board.</p>
                            </div>

                            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-muted-foreground">Title</label>
                                    <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="What needs to be done?" className="w-full px-4 py-3 rounded-xl border border-border bg-accent/20 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:bg-background transition-all" autoFocus />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-muted-foreground">Description</label>
                                    <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Add details..." rows={3} className="w-full px-4 py-3 rounded-xl border border-border bg-accent/20 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:bg-background transition-all resize-none" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-muted-foreground">Priority</label>
                                        <div className="relative">
                                            <select value={newPriority} onChange={(e) => setNewPriority(e.target.value as TaskPriority)} className="w-full px-4 py-3 rounded-xl border border-border bg-accent/20 text-sm outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer">
                                                {TASK_PRIORITIES.map((p) => <option key={p.value} value={p.value}> {p.label} </option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-muted-foreground">Due Date</label>
                                        <input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-border bg-accent/20 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-accent/10 flex justify-end gap-3 border-t border-border/50">
                                <button onClick={() => setShowAdd(false)} className="px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-accent transition-colors">Cancel</button>
                                <button onClick={handleAddTask} disabled={!newTitle.trim()} className="btn-primary px-8 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:shadow-none">Create Task</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AppShell>
    );
}

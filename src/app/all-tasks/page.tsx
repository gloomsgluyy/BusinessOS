"use client";

import React from "react";
import GlobalLoading from "@/app/loading";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Calendar, Shield, Loader2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Toast } from "@/components/shared/toast";
import { TaskDetail } from "@/components/tasks/task-detail";
import { useSession } from "next-auth/react";
import { useTaskStore } from "@/store/task-store";
import { cn, getInitials } from "@/lib/utils";
import { TASK_STATUSES, TASK_PRIORITIES } from "@/lib/constants";
import { Task, TaskStatus } from "@/types";

export default function AllTasksPage() {
    const [isInitializing, setIsInitializing] = React.useState(true);

    const { data: session } = useSession();
    const currentUser = session?.user as any;
    const hasPermission = (permission: string) => currentUser?.role === "CEO" || currentUser?.role === "ASSISTANT_CEO";
    const tasks = useTaskStore((s) => s.tasks);
    const syncFromMemory = useTaskStore((s) => s.syncFromMemory);
    const moveTask = useTaskStore((s) => s.moveTask);

    React.useEffect(() => {
        syncFromMemory().finally(() => setIsInitializing(false));
    }, [syncFromMemory]);
    const [selectedTask, setSelectedTask] = React.useState<Task | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);
    const [toast, setToast] = React.useState<{ message: string; type: "success" | "error" } | null>(null);

    if (!hasPermission("all_tasks")) {
        if (isInitializing) return <GlobalLoading />;
        return (
            <AppShell>
                <div className="flex items-center justify-center h-full animate-fade-in">
                    <div className="text-center space-y-2">
                        <Shield className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                        <p className="text-sm font-medium text-muted-foreground">Access Restricted</p>
                        <p className="text-xs text-muted-foreground">Only CEO and Assistant CEO can view all tasks.</p>
                    </div>
                </div>
            </AppShell>
        );
    }

    const handleDragEnd = async (result: DropResult) => {
        if (!result.destination) return;
        const newStatus = result.destination.droppableId as TaskStatus;
        if (newStatus === result.source.droppableId) return;

        setIsSaving(true);
        try {
            await moveTask(result.draggableId, newStatus, currentUser?.name || "System");
            setToast({ message: "Task moved successfully!", type: "success" });
        } catch (error) {
            setToast({ message: "Failed to move task", type: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    const currentSelected = selectedTask ? tasks.find((t) => t.id === selectedTask.id) || null : null;

    return (
        <AppShell>
            <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto">
                <div className="mb-6 animate-fade-in">
                    <h1 className="text-xl md:text-2xl font-bold">All Tasks</h1>
                    <p className="text-sm text-muted-foreground">View and manage all team tasks.</p>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                    <div className="card-elevated p-4 animate-slide-up delay-1">
                        <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide">Total</span>
                        <p className="text-2xl font-bold mt-1">{tasks.length}</p>
                    </div>
                    {TASK_STATUSES.map((s, i) => (
                        <div key={s.value} className={cn("rounded-xl border p-4 transition-all duration-300 hover:shadow-md animate-slide-up", s.bgClass, `delay-${i + 2}`)}>
                            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: s.color }}>{s.label}</span>
                            <p className="text-2xl font-bold mt-1">{tasks.filter((t) => t.status === s.value).length}</p>
                        </div>
                    ))}
                </div>

                {/* Kanban */}
                <DragDropContext onDragEnd={handleDragEnd}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {TASK_STATUSES.map((col) => {
                            const colTasks = tasks.filter((t) => t.status === col.value);
                            return (
                                <div key={col.value} className="flex flex-col min-h-[400px]">
                                    <div className={cn("flex items-center gap-2 mb-3 px-3 py-2 rounded-xl border border-border/40 shadow-sm", col.bgClass, "bg-opacity-20")}>
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                                        <span className="text-sm font-bold text-foreground/90">{col.label}</span>
                                        <span className="ml-auto text-xs font-semibold text-muted-foreground bg-background/80 px-2 py-0.5 rounded-md shadow-sm border border-border/10">{colTasks.length}</span>
                                    </div>

                                    <div className={cn(
                                        "rounded-2xl p-2 transition-all border-2 border-dashed border-border/80 bg-background/20 h-fit min-h-[150px]" // Thicker border and adaptive height
                                    )}>
                                        <Droppable droppableId={col.value}>
                                            {(provided) => (
                                                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
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
                                                                                ? "shadow-xl rotate-1 scale-[1.02] border-primary/30 z-50 ring-2 ring-primary/10"
                                                                                : "hover:shadow-md hover:border-border/80"
                                                                        )}
                                                                        style={{
                                                                            ...prov.draggableProps.style,
                                                                            borderLeft: `4px solid ${priCfg?.color || 'transparent'}`,
                                                                            borderRadius: '12px'
                                                                        }}
                                                                    >
                                                                        <p className="text-sm font-medium">{task.title}</p>
                                                                        <div className="flex items-center gap-2 mt-2">
                                                                            <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center text-[8px] font-bold text-primary" title={task.assignee_name}>
                                                                                {getInitials(task.assignee_name)}
                                                                            </div>
                                                                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                                                <Calendar className="w-3 h-3" />
                                                                                {new Date(task.due_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                                                                            </span>
                                                                            <span className="ml-auto status-badge text-[9px] font-bold" style={{ color: priCfg?.color, backgroundColor: `${priCfg?.color}15` }}>
                                                                                {priCfg?.label}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </Draggable>
                                                        );
                                                    })}
                                                    {provided.placeholder}
                                                    {colTasks.length === 0 && (
                                                        <p className="text-xs text-muted-foreground text-center py-6 opacity-50">No tasks</p>
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

                {currentSelected && (
                    <TaskDetail task={currentSelected} onClose={() => setSelectedTask(null)} />
                )}

                {toast && (
                    <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
                )}

                {isSaving && (
                    <div className="fixed inset-0 bg-background/20 backdrop-blur-[1px] z-[100] flex items-center justify-center pointer-events-none">
                        <div className="bg-card border border-border/50 p-3 rounded-xl shadow-xl flex items-center gap-3">
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            <span className="text-sm font-bold">Updating...</span>
                        </div>
                    </div>
                )}
            </div>
        </AppShell>
    );
}

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { Task, TaskStatus, TaskComment, TaskActivity, TaskPriority } from "@/types";
import { generateId } from "@/lib/utils";

// ── Demo Data ─────────────────────────────────────────────────
const today = new Date();
const d = (offset: number) => {
    const dt = new Date(today);
    dt.setDate(dt.getDate() + offset);
    return dt.toISOString();
};

const DEMO_TASKS: Task[] = [
    {
        id: "tsk-001", title: "Security audit preparation", description: "Prepare documentation and test cases for the upcoming security audit.",
        status: "todo", priority: "high", assignee_id: "usr-001", assignee_name: "Alex Morgan",
        due_date: d(2), created_by: "usr-002", created_at: d(-10), updated_at: d(-1), comments: [], activities: [],
    }
];

// ── Store ─────────────────────────────────────────────────────
interface TaskState {
    _rawTasks: Task[];
    tasks: Task[];
    addTask: (task: Omit<Task, "id" | "created_at" | "updated_at" | "comments" | "activities">) => Promise<void>;
    updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
    deleteTask: (id: string) => Promise<void>;
    moveTask: (id: string, status: TaskStatus, movedBy: string) => Promise<void>;
    addComment: (taskId: string, userId: string, userName: string, userRole: string, content: string) => Promise<void>;
    getTasksByAssignee: (userId: string) => Task[];
    getTasksByStatus: (status: TaskStatus) => Task[];
    getTasksInReview: () => Task[];
    lastSyncTime: string;
    syncFromMemory: () => Promise<void>;
}

export const useTaskStore = create<TaskState>()(persist((set, get) => ({
    _rawTasks: [],
    tasks: [],
    lastSyncTime: new Date(0).toISOString(),

    addTask: async (task) => {
        const body = {
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            assigneeId: task.assignee_id,
            assigneeName: task.assignee_name,
            dueDate: task.due_date,
            createdBy: task.created_by
        };
        const res = await fetch("/api/memory/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        if (res.ok) {
            const data = await res.json();
            const t = data.task;
            const newTask: Task = {
                id: t.id, title: t.title, description: t.description || "", status: t.status as TaskStatus,
                priority: t.priority as TaskPriority, assignee_id: t.assigneeId, assignee_name: t.assigneeName,
                due_date: t.dueDate,
                created_by: t.createdBy, is_deleted: t.isDeleted,
                created_at: t.createdAt, updated_at: t.updatedAt,
                comments: t.comments ? JSON.parse(t.comments) : [],
                activities: t.activities ? JSON.parse(t.activities) : []
            };
            set((state) => {
                if (state._rawTasks.some(t => t.id === newTask.id)) return state;
                const raw = [...state._rawTasks, newTask];
                return { _rawTasks: raw, tasks: raw.filter(x => !x.is_deleted) };
            });
        }
    },

    updateTask: async (id, updates) => {
        const body: any = { id };
        if (updates.title) body.title = updates.title;
        if (updates.description) body.description = updates.description;
        if (updates.priority) body.priority = updates.priority;
        if (updates.assignee_id) body.assigneeId = updates.assignee_id;
        if (updates.assignee_name) body.assigneeName = updates.assignee_name;
        if (updates.due_date) body.dueDate = updates.due_date;

        await fetch("/api/memory/tasks", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        set((state) => {
            const raw = state._rawTasks.map((t) =>
                t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t
            );
            return { _rawTasks: raw, tasks: raw.filter(t => !t.is_deleted) };
        });
    },

    deleteTask: async (id) => {
        await fetch(`/api/memory/tasks?id=${id}`, { method: "DELETE" });
        set((state) => {
            const raw = state._rawTasks.map((t) =>
                t.id === id ? { ...t, is_deleted: true, updated_at: new Date().toISOString() } : t
            );
            return { _rawTasks: raw, tasks: raw.filter(t => !t.is_deleted) };
        });
    },

    moveTask: async (id, status, movedBy) => {
        const body: any = { id, status };
        const activity: TaskActivity = {
            id: generateId("act"),
            task_id: id,
            user_name: movedBy,
            action: `moved to ${status}`,
            created_at: new Date().toISOString()
        };
        const st = get()._rawTasks.find(x => x.id === id);
        if (st) {
            body.activities = JSON.stringify([...st.activities, activity]);
        }

        set((state) => {
            const raw = state._rawTasks.map((t) => {
                if (t.id !== id) return t;
                return { ...t, status, updated_at: new Date().toISOString(), activities: [...t.activities, activity] };
            });
            return { _rawTasks: raw, tasks: raw.filter(t => !t.is_deleted) };
        });

        await fetch("/api/memory/tasks", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
    },

    addComment: async (taskId, userId, userName, userRole, content) => {
        const comment: TaskComment = {
            id: generateId("cmt"),
            task_id: taskId,
            user_id: userId,
            user_name: userName,
            user_role: userRole as any,
            content,
            created_at: new Date().toISOString(),
        };
        const activity: TaskActivity = {
            id: generateId("act"),
            task_id: taskId,
            user_name: userName,
            action: "added a comment",
            created_at: new Date().toISOString(),
        };
        const st = get()._rawTasks.find(x => x.id === taskId);
        if (st) {
            await fetch("/api/memory/tasks", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: taskId,
                    comments: JSON.stringify([...st.comments, comment]),
                    activities: JSON.stringify([...st.activities, activity])
                })
            });
        }
        set((state) => {
            const raw = state._rawTasks.map((t) => {
                if (t.id !== taskId) return t;
                return { ...t, comments: [...t.comments, comment], activities: [...t.activities, activity], updated_at: new Date().toISOString() };
            });
            return { _rawTasks: raw, tasks: raw.filter(t => !t.is_deleted) };
        });
    },

    syncFromMemory: async () => {
        try {
            const res = await fetch("/api/memory/tasks");
            if (res.ok) {
                const data = await res.json();
                if (data.tasks) {
                    const mappedTasks: Task[] = data.tasks.map((t: any) => ({
                        id: t.id, title: t.title, description: t.description || "", status: t.status as TaskStatus,
                        priority: t.priority as TaskPriority, assignee_id: t.assigneeId, assignee_name: t.assigneeName,
                        due_date: t.dueDate,
                        created_by: t.createdBy, is_deleted: t.isDeleted,
                        created_at: t.createdAt, updated_at: t.updatedAt,
                        comments: t.comments ? JSON.parse(t.comments) : [],
                        activities: t.activities ? JSON.parse(t.activities) : []
                    }));
                    set({
                        _rawTasks: mappedTasks,
                        tasks: mappedTasks.filter(x => !x.is_deleted),
                        lastSyncTime: new Date().toISOString()
                    });
                }
            }
        } catch (error) {
            console.error("Failed to sync Tasks from Memory B", error);
        }
    },

    getTasksByAssignee: (userId) => get().tasks.filter((t) => t.assignee_id === userId),
    getTasksByStatus: (status) => get().tasks.filter((t) => t.status === status),
    getTasksInReview: () => get().tasks.filter((t) => t.status === "review"),
}), {
    name: "task-store-v1",
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({
        _rawTasks: state._rawTasks,
        tasks: state.tasks,
        lastSyncTime: state.lastSyncTime,
    }),
}));

// Removed legacy auto-sync polling as this runs via polling in layout or push actions.

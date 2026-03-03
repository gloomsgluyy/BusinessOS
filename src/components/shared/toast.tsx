"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "info";

interface ToastProps {
    message: string;
    type?: ToastType;
    duration?: number;
    onClose: () => void;
}

export function Toast({ message, type = "success", duration = 3000, onClose }: ToastProps) {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(onClose, 300); // Wait for fade out animation
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onClose]);

    return (
        <div
            className={cn(
                "fixed bottom-8 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border transition-all duration-300 animate-in fade-in slide-in-from-bottom-4",
                isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95",
                type === "success" && "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
                type === "error" && "bg-red-500/10 border-red-500/30 text-red-400",
                type === "info" && "bg-blue-500/10 border-blue-500/30 text-blue-400"
            )}
        >
            {type === "success" && <CheckCircle2 className="w-5 h-5" />}
            {type === "error" && <AlertCircle className="w-5 h-5" />}
            <span className="text-sm font-bold">{message}</span>
            <button
                onClick={() => { setIsVisible(false); setTimeout(onClose, 300); }}
                className="ml-2 hover:bg-white/10 p-1 rounded-full transition-colors"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}

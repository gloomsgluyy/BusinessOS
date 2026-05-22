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
            role="status"
            aria-live="polite"
            className={cn(
                "fixed bottom-8 left-1/2 -translate-x-1/2 z-[9999] flex max-w-[calc(100vw-2rem)] min-w-[min(26rem,calc(100vw-2rem))] items-center gap-3 rounded-xl border px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.35)] transition-all duration-300 animate-in fade-in slide-in-from-bottom-4",
                isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95",
                type === "success" && "border-emerald-500 bg-white text-emerald-700",
                type === "error" && "border-red-500 bg-white text-red-600",
                type === "info" && "border-blue-500 bg-white text-blue-700"
            )}
        >
            {type === "success" && <CheckCircle2 className="h-5 w-5 shrink-0" />}
            {type === "error" && <AlertCircle className="h-5 w-5 shrink-0" />}
            <span className="min-w-0 flex-1 text-sm font-bold leading-snug">{message}</span>
            <button
                onClick={() => { setIsVisible(false); setTimeout(onClose, 300); }}
                className="ml-1 shrink-0 rounded-full p-1 transition-colors hover:bg-black/5"
                aria-label="Close notification"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}

"use client";

import React from "react";
import { Upload, X, ImageIcon, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
    value?: string;
    onChange: (url: string) => void;
    className?: string;
}

export function ImageUpload({ value, onChange, className }: ImageUploadProps) {
    const [dragging, setDragging] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleFile = (file: File) => {
        const isImage = file.type.startsWith("image/");
        const isDoc = file.name.match(/\.(pdf|doc|docx|xls|xlsx)$/i) || file.type.includes("pdf") || file.type.includes("document") || file.type.includes("sheet");
        if (!isImage && !isDoc) return;

        // In a real app, we'd upload to S3/Cloudinary here.
        // For this demo, we'll use a local object URL or a placeholder simulation.
        const reader = new FileReader();
        reader.onload = () => {
            onChange(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files?.[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    return (
        <div
            className={cn(
                "relative group rounded-xl border-2 border-dashed transition-all duration-200 overflow-hidden",
                dragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 bg-secondary/30",
                value ? "aspect-video" : "h-32",
                className
            )}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
        >
            {value ? (
                <>
                    {value.startsWith("data:image/") || value.match(/^https?:\/\/.*\.(jpeg|jpg|gif|png|webp)/i) ? (
                        <img src={value} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-accent/30 text-primary border border-border/50">
                            <FileText className="w-8 h-8 mb-2" />
                            <span className="text-[10px] font-semibold">Document Attached</span>
                        </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 bg-black/40 hover:bg-black/60 rounded-lg text-white transition-all"
                        >
                            <Upload className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => onChange("")}
                            className="p-2 bg-destructive hover:bg-destructive/90 rounded-lg text-white transition-all"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </>
            ) : (
                <div
                    className="w-full h-full flex flex-col items-center justify-center cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <div className="w-10 h-10 rounded-full bg-background/50 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                        <Upload className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="text-xs font-medium text-muted-foreground">Drag & drop or <span className="text-primary">click to upload</span></p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">Supports Images, PDF, Word, Excel</p>
                </div>
            )}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
        </div>
    );
}

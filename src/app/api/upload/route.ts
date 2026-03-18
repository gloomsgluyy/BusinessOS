import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const formData = await req.formData();
        const file = formData.get("file") as Blob | null;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        const MAX_SIZE = 10 * 1024 * 1024;
        if (buffer.length > MAX_SIZE) {
            return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
        }

        const originalName = (file as any).name || "uploaded_file";
        const safeName = path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, "_");
        const ext = path.extname(safeName) || "";
        const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".pdf", ".mp3", ".mp4", ".wav", ".m4a"];

        if (!ALLOWED_EXTENSIONS.includes(ext.toLowerCase())) {
            return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
        }

        const filename = `${Date.now()}_${randomUUID()}${ext}`;
        const uploadDir = path.join(process.cwd(), "public", "uploads");
        const finalPath = path.join(uploadDir, filename);

        if (!finalPath.startsWith(uploadDir)) {
            return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
        }

        // Try to write the file, ensure directory exists
        try {
            await writeFile(finalPath, buffer);
        } catch (dirErr: any) {
            if (dirErr.code === "ENOENT") {
                const fs = require("fs");
                fs.mkdirSync(uploadDir, { recursive: true });
                await writeFile(finalPath, buffer);
            } else {
                throw dirErr;
            }
        }

        const fileUrl = `/uploads/${filename}`;

        return NextResponse.json({ success: true, url: fileUrl, filename });
    } catch (error: any) {
        console.error("Upload error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

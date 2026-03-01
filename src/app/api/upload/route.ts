import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
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
        // Clean filename and ensure exact path
        const originalName = (file as any).name || "uploaded_file";
        const filename = `${Date.now()}_${originalName.replace(/\s+/g, "_")}`;
        const uploadDir = path.join(process.cwd(), "public", "uploads");

        // Try to write the file, ensure directory exists
        try {
            await writeFile(path.join(uploadDir, filename), buffer);
        } catch (dirErr: any) {
            if (dirErr.code === "ENOENT") {
                const fs = require("fs");
                fs.mkdirSync(uploadDir, { recursive: true });
                await writeFile(path.join(uploadDir, filename), buffer);
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

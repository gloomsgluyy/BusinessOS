// Example integration for 11gawe Next.js app
// Add this to: src/app/meetings/page.tsx or create new component

import { useState } from "react";

interface VideoUploadResult {
  job_id: string;
  transcription?: string;
  mom_markdown?: string;
  extracted_tasks?: Array<{
    title: string;
    assignee_hint?: string;
    due_date_hint?: string;
    priority: string;
  }>;
  pdf_url?: string;
}

export function VideoMOMProcessor() {
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<VideoUploadResult | null>(null);

  const handleVideoUpload = async (file: File) => {
    setUploading(true);
    setStatus("Uploading video...");

    try {
      // 1. Upload video to Go API
      const formData = new FormData();
      formData.append("video", file);

      const uploadRes = await fetch(
        "http://localhost:8080/api/v1/mom/upload-video",
        {
          method: "POST",
          body: formData,
        },
      );

      if (!uploadRes.ok) {
        throw new Error("Upload failed");
      }

      const { job_id } = await uploadRes.json();
      setUploading(false);
      setProcessing(true);

      // 2. Poll for job status
      pollJobStatus(job_id);
    } catch (error) {
      console.error("Upload error:", error);
      setUploading(false);
      setStatus("Upload failed");
    }
  };

  const pollJobStatus = async (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const statusRes = await fetch(
          `http://localhost:8080/api/v1/mom/jobs/${jobId}`,
        );
        const { job } = await statusRes.json();

        setProgress(job.progress);
        setStatus(getStatusText(job.status));

        if (job.status === "completed") {
          clearInterval(interval);
          setProcessing(false);
          setResult({
            job_id: jobId,
            transcription: job.result.transcription,
            mom_markdown: job.result.mom_markdown,
            extracted_tasks: job.result.extracted_tasks,
            pdf_url: job.result.pdf_url,
          });

          // 3. Optional: Auto-save to your database
          // await saveMOMToDatabase(job.result);
        } else if (job.status === "failed") {
          clearInterval(interval);
          setProcessing(false);
          setStatus(`Failed: ${job.error}`);
        }
      } catch (error) {
        console.error("Status check error:", error);
        clearInterval(interval);
        setProcessing(false);
        setStatus("Status check failed");
      }
    }, 3000); // Poll every 3 seconds
  };

  const getStatusText = (status: string): string => {
    const statusMap: Record<string, string> = {
      pending: "Waiting in queue...",
      extracting_audio: "Extracting audio from video...",
      transcribing: "Transcribing audio...",
      generating_mom: "Generating meeting minutes...",
      creating_pdf: "Creating PDF document...",
      completed: "Processing complete!",
      failed: "Processing failed",
    };
    return statusMap[status] || status;
  };

  const saveMOMToDatabase = async (jobResult: any) => {
    // Save to your existing Next.js API
    await fetch("/api/memory/meetings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "your-meeting-id", // Replace with actual meeting ID
        momContent: jobResult.transcription,
        aiSummary: jobResult.mom_markdown,
        voiceNoteUrl: jobResult.pdf_url,
      }),
    });

    // Push tasks to task store
    if (jobResult.extracted_tasks?.length > 0) {
      // Use your existing task management logic
      console.log("Extracted tasks:", jobResult.extracted_tasks);
    }
  };

  return (
    <div className="p-6 border rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Video MOM Processing</h3>

      {/* File Upload */}
      <input
        type="file"
        accept="video/mp4,video/mov,video/avi,video/webm"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleVideoUpload(file);
        }}
        disabled={uploading || processing}
        className="mb-4"
      />

      {/* Progress */}
      {(uploading || processing) && (
        <div className="mb-4">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-600 mt-2">{status}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold">Transcription:</h4>
            <p className="text-sm text-gray-700 max-h-40 overflow-y-auto border p-2 rounded">
              {result.transcription}
            </p>
          </div>

          <div>
            <h4 className="font-semibold">Minutes of Meeting:</h4>
            <div className="prose prose-sm max-h-60 overflow-y-auto border p-2 rounded">
              {result.mom_markdown}
            </div>
          </div>

          {result.extracted_tasks && result.extracted_tasks.length > 0 && (
            <div>
              <h4 className="font-semibold">Extracted Tasks:</h4>
              <ul className="list-disc list-inside text-sm">
                {result.extracted_tasks.map((task, idx) => (
                  <li key={idx}>
                    <span className="font-medium">{task.title}</span>
                    {task.assignee_hint && ` - ${task.assignee_hint}`}
                    {task.due_date_hint && ` (Due: ${task.due_date_hint})`}
                    <span
                      className={`ml-2 text-xs px-2 py-0.5 rounded ${
                        task.priority === "high"
                          ? "bg-red-100 text-red-800"
                          : task.priority === "medium"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-green-100 text-green-800"
                      }`}
                    >
                      {task.priority}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <a
              href={result.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Download PDF
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

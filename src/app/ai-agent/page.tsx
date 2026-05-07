"use client";

import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Brain, FileSpreadsheet, Loader2, Send, Database } from "lucide-react";

type Workbook = {
  fileName: string;
  relativePath: string;
  sheets: Array<{
    name: string;
    rows: number;
    columns: number;
    headers: string[];
  }>;
};

export default function AIExcelAgentPage() {
  const [workbooks, setWorkbooks] = React.useState<Workbook[]>([]);
  const [question, setQuestion] = React.useState("");
  const [answer, setAnswer] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [asking, setAsking] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let mounted = true;
    fetch("/api/ai-agent/excel-context", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return;
        if (data.success) setWorkbooks(data.workbooks || []);
        else setError(data.error || "Failed to load Excel context");
      })
      .catch((err) => mounted && setError(err.message))
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, []);

  const ask = async () => {
    if (!question.trim()) return;
    setAsking(true);
    setError("");
    try {
      const res = await fetch("/api/ai-agent/excel-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to ask agent");
      setAnswer(data.answer || "");
      setWorkbooks(data.workbooks || workbooks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to ask agent");
    } finally {
      setAsking(false);
    }
  };

  const totalSheets = workbooks.reduce((sum, book) => sum + book.sheets.length, 0);
  const totalRows = workbooks.reduce((sum, book) => sum + book.sheets.reduce((inner, sheet) => inner + sheet.rows, 0), 0);

  return (
    <AppShell>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <Brain className="w-6 h-6 text-primary" />
              AI Excel Context Agent
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Workbook-aware assistant for shipment, delivery, market, and migration Excel context.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-xl border border-border bg-card px-3 py-2">
              <p className="text-muted-foreground">Files</p>
              <p className="font-bold">{workbooks.length}</p>
            </div>
            <div className="rounded-xl border border-border bg-card px-3 py-2">
              <p className="text-muted-foreground">Sheets</p>
              <p className="font-bold">{totalSheets}</p>
            </div>
            <div className="rounded-xl border border-border bg-card px-3 py-2">
              <p className="text-muted-foreground">Rows</p>
              <p className="font-bold">{totalRows.toLocaleString("en-US")}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-2 card-elevated p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-500" />
              <h2 className="text-sm font-bold">Excel Context Index</h2>
            </div>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Reading workbook context...
              </div>
            ) : (
              <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
                {workbooks.map((book) => (
                  <div key={book.relativePath} className="rounded-xl border border-border/60 bg-background/60 p-3">
                    <div className="flex items-start gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-500 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{book.fileName}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{book.relativePath}</p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {book.sheets.slice(0, 5).map((sheet) => (
                        <div key={sheet.name} className="rounded-lg bg-accent/30 px-2 py-1.5">
                          <div className="flex justify-between gap-2 text-[10px]">
                            <span className="font-semibold truncate">{sheet.name}</span>
                            <span className="text-muted-foreground">{sheet.rows}x{sheet.columns}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate">{sheet.headers.slice(0, 6).join(", ") || "No headers detected"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-3 card-elevated p-5 space-y-4">
            <div>
              <h2 className="text-sm font-bold">Ask Workbook Context</h2>
              <p className="text-xs text-muted-foreground mt-1">The agent answers from workbook metadata and samples. With Groq/OpenRouter key, it uses AI; without a key, it falls back to local context search.</p>
            </div>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={4}
              placeholder="Example: workbook mana yang berisi Daily Delivery, shipment, market price, atau MV Barge?"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 resize-none"
            />
            <div className="flex justify-end">
              <button onClick={ask} disabled={asking || !question.trim()} className="btn-primary text-sm disabled:opacity-50">
                {asking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Ask Agent
              </button>
            </div>
            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 p-3 text-sm">{error}</div>
            )}
            {answer && (
              <div className="rounded-xl border border-border bg-background/70 p-4 whitespace-pre-wrap text-sm leading-relaxed">
                {answer}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

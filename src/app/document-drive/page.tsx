"use client";

import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import {
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";

type DriveSource = "all" | "forecast" | "shipment" | "daily_delivery";
type DriveGroup = "all" | "required" | "additional" | "critical" | "domestic_handover" | "forecast";

type DriveDocument = {
  id: string;
  sourceType: "forecast" | "shipment" | "daily_delivery";
  ownerId: string;
  ownerName: string;
  buyer?: string | null;
  documentGroup?: string | null;
  documentType?: string | null;
  title: string;
  fileName: string;
  mimeType?: string | null;
  sizeBytes: number;
  uploadedByName?: string | null;
  createdAt: string;
  url: string;
  isCritical?: boolean;
};

type DriveSummary = {
  total: number;
  forecast: number;
  shipment: number;
  dailyDelivery: number;
  required: number;
  additional: number;
  domestic: number;
};

const sourceLabels: Record<DriveDocument["sourceType"], string> = {
  forecast: "Forecast Sales",
  shipment: "Shipment",
  daily_delivery: "Domestic Handover",
};

const groupLabels: Record<string, string> = {
  required: "Required",
  additional: "Additional",
  critical: "Critical",
  domestic_handover: "Domestic",
  forecast: "Forecast",
};

const emptySummary: DriveSummary = {
  total: 0,
  forecast: 0,
  shipment: 0,
  dailyDelivery: 0,
  required: 0,
  additional: 0,
  domestic: 0,
};

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DocumentDrivePage() {
  const { currentUser, hasPermission } = useAuthStore();
  const [query, setQuery] = React.useState("");
  const [source, setSource] = React.useState<DriveSource>("all");
  const [group, setGroup] = React.useState<DriveGroup>("all");
  const [documents, setDocuments] = React.useState<DriveDocument[]>([]);
  const [summary, setSummary] = React.useState<DriveSummary>(emptySummary);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const canOpenDrive = !currentUser || hasPermission("document_drive");

  React.useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          q: query.trim(),
          source,
          group,
          limit: "500",
        });
        const res = await fetch(`/api/document-drive?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(data.error || "Failed to load document drive");
        setDocuments(Array.isArray(data.documents) ? data.documents : []);
        setSummary(data.summary || emptySummary);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load document drive");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, query.trim() ? 250 : 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [group, query, refreshKey, source]);

  const summaryCards = [
    { label: "Total Files", value: summary.total, tone: "border-emerald-500/25" },
    { label: "Forecast", value: summary.forecast, tone: "border-cyan-500/25" },
    { label: "Shipment", value: summary.shipment, tone: "border-blue-500/25" },
    { label: "Domestic", value: summary.dailyDelivery, tone: "border-amber-500/25" },
    { label: "Required", value: summary.required, tone: "border-violet-500/25" },
    { label: "Additional", value: summary.additional, tone: "border-slate-500/25" },
  ];

  return (
    <AppShell>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-5 animate-fade-in">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-primary">
              <FolderOpen className="h-5 w-5" />
              <p className="text-xs font-bold uppercase tracking-wide">Document Drive</p>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">All operational documents</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Pusat akses dokumen public dari Forecast Sales, Shipment Monitor, dan Domestic Handover.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRefreshKey((key) => key + 1)}
            disabled={loading}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold hover:bg-accent disabled:opacity-60"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </button>
        </div>

        {!canOpenDrive && (
          <div className="rounded-lg border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
            Akun ini belum memiliki permission Document Drive.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {summaryCards.map((item) => (
            <div key={item.label} className={cn("rounded-lg border bg-card p-3 min-h-[76px]", item.tone)}>
              <p className="text-[10px] font-bold uppercase leading-tight text-muted-foreground">{item.label}</p>
              <p className="mt-2 text-xl font-bold leading-none">{item.value.toLocaleString("id-ID")}</p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-border bg-card p-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_180px_180px_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search document, project, buyer, uploader..."
                className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary/60"
              />
            </div>
            <select
              value={source}
              onChange={(event) => setSource(event.target.value as DriveSource)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
            >
              <option value="all">All Source</option>
              <option value="forecast">Forecast Sales</option>
              <option value="shipment">Shipment</option>
              <option value="daily_delivery">Domestic Handover</option>
            </select>
            <select
              value={group}
              onChange={(event) => setGroup(event.target.value as DriveGroup)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
            >
              <option value="all">All Group</option>
              <option value="forecast">Forecast</option>
              <option value="required">Required</option>
              <option value="additional">Additional</option>
              <option value="critical">Critical</option>
              <option value="domestic_handover">Domestic</option>
            </select>
            <div className="flex h-9 items-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-muted-foreground">
              {loading ? "Loading..." : `${documents.length.toLocaleString("id-ID")} shown`}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="hidden grid-cols-[1.3fr_1fr_120px_140px_130px_120px] gap-3 border-b border-border bg-accent/30 px-4 py-3 text-[10px] font-bold uppercase text-muted-foreground lg:grid">
            <span>Document</span>
            <span>Owner</span>
            <span>Source</span>
            <span>Group</span>
            <span>Uploaded</span>
            <span className="text-right">Action</span>
          </div>

          {error && (
            <div className="p-8 text-center text-sm text-rose-600">{error}</div>
          )}

          {!error && loading && documents.length === 0 && (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-lg bg-accent/50" />
              ))}
            </div>
          )}

          {!error && !loading && documents.length === 0 && (
            <div className="p-10 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <p className="mt-3 text-sm font-semibold">No documents found</p>
              <p className="mt-1 text-xs text-muted-foreground">Coba ubah filter atau keyword pencarian.</p>
            </div>
          )}

          {!error && documents.length > 0 && (
            <div className="divide-y divide-border">
              {documents.map((doc) => (
                <div
                  key={`${doc.sourceType}:${doc.id}`}
                  className="grid grid-cols-1 gap-3 px-4 py-3 text-sm hover:bg-accent/30 lg:grid-cols-[1.3fr_1fr_120px_140px_130px_120px] lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <p className="truncate font-semibold">{doc.title || doc.fileName}</p>
                      {doc.isCritical && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-amber-600" />}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{doc.fileName}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{formatBytes(doc.sizeBytes)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{doc.ownerName}</p>
                    <p className="truncate text-[10px] text-muted-foreground">Buyer: {doc.buyer || "-"}</p>
                  </div>
                  <span className="w-fit rounded-md bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">
                    {sourceLabels[doc.sourceType]}
                  </span>
                  <span className="w-fit rounded-md border border-border px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground">
                    {groupLabels[String(doc.documentGroup || "")] || doc.documentGroup || doc.documentType || "-"}
                  </span>
                  <div>
                    <p className="text-xs font-semibold">{doc.uploadedByName || "Unknown"}</p>
                    <p className="text-[10px] text-muted-foreground">{formatDate(doc.createdAt)}</p>
                  </div>
                  <div className="flex items-center justify-start gap-2 lg:justify-end">
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-semibold hover:bg-accent"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open
                    </a>
                    <a
                      href={doc.url}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

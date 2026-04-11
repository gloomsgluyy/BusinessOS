"use client";

import React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { cn } from "@/lib/utils";
import {
  FolderKanban,
  Calendar,
  TrendingUp,
  Ship,
  Search,
  Package,
  X,
} from "lucide-react";
import { useCommercialStore } from "@/store/commercial-store";
import GlobalLoading from "@/app/loading";
import { ShipmentDetail } from "@/types";

type ProjectStatus = "ongoing" | "upcoming" | "completed";

type ProjectCard = {
  id: string;
  projectName: string;
  projectKey: string;
  mvTitle: string;
  buyer: string;
  year: number | null;
  laycan: string;
  shippingTerm: string;
  volume: number;
  revenue: number;
  grossProfit: number;
  shipmentCount: number;
  status: ProjectStatus;
  rows: ShipmentDetail[];
};

const safeNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const normalizeKey = (v?: string | null): string =>
  (v || "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

const cleanText = (v?: string | null): string | null => {
  if (!v) return null;
  const t = String(v).replace(/\s+/g, " ").trim();
  return t || null;
};

const firstLine = (v?: string | null): string => {
  if (!v) return "";
  return String(v).split(/\r?\n/)[0]?.trim() || "";
};

const extractProjectName = (raw?: string | null): string | null => {
  const text = cleanText(raw);
  if (!text) return null;
  const explicit = text.match(/project\s*:\s*([^\n\r]+)/i);
  if (explicit?.[1]) return cleanText(explicit[1]);

  const code = text.match(/\b([A-Z]{2,}[A-Z0-9_.\-\/]*_\d{2})\b/i);
  if (code?.[1]) return cleanText(code[1]);
  return null;
};

const extractMVName = (raw?: string | null): string | null => {
  const line = firstLine(raw);
  if (!line) return null;
  const mv = line.match(/(MV\.?\s*[A-Z0-9 .\-\/]+?)(?:\s+OR\s+SUBS.*)?$/i);
  if (mv?.[1]) return cleanText(mv[1]);
  return cleanText(line);
};

const detectStatus = (rows: ShipmentDetail[]): ProjectStatus => {
  if (!rows.length) return "upcoming";
  const statuses = rows
    .map((r) => normalizeKey(r.status || r.shipment_status || ""))
    .filter(Boolean);

  const hasOngoing = statuses.some((s) =>
    ["LOADING", "IN_TRANSIT", "IN TRANSIT", "ANCHORAGE", "DISCHARGING"].some(
      (k) => s.includes(k),
    ),
  );
  if (hasOngoing) return "ongoing";

  const hasUpcoming = statuses.some((s) =>
    ["UPCOMING", "WAITING", "WAITING_LOADING", "WAITING LOADING"].some((k) =>
      s.includes(k),
    ),
  );
  if (hasUpcoming) return "upcoming";

  return "completed";
};

const pickMVTitle = (rows: ShipmentDetail[]): string => {
  const counter = new Map<string, number>();
  rows.forEach((r) => {
    const mv =
      extractMVName(r.vessel_name) ||
      extractMVName(r.mv_project_name) ||
      cleanText(r.nomination) ||
      "-";
    counter.set(mv, (counter.get(mv) || 0) + 1);
  });
  const sorted = Array.from(counter.entries()).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) return "-";
  if (sorted.length === 1) return sorted[0][0];
  return `${sorted[0][0]} +${sorted.length - 1} MV`;
};

const fmtUsd = (n: number): string =>
  `$${safeNum(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

const fmtInt = (n: number): string =>
  safeNum(n).toLocaleString("en-US", { maximumFractionDigits: 0 });

export default function ProjectsPage() {
  const { shipments, deals, syncFromMemory } = useCommercialStore();
  const [isInitializing, setIsInitializing] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [yearFilter, setYearFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState<
    "all" | ProjectStatus
  >("all");
  const [selectedProject, setSelectedProject] = React.useState<ProjectCard | null>(
    null,
  );

  React.useEffect(() => {
    syncFromMemory().finally(() => setIsInitializing(false));
  }, [syncFromMemory]);

  const projects = React.useMemo<ProjectCard[]>(() => {
    const grouped = new Map<string, ShipmentDetail[]>();

    for (const sh of shipments) {
      const projectName =
        extractProjectName(sh.mv_project_name) ||
        extractProjectName(sh.vessel_name) ||
        extractMVName(sh.mv_project_name) ||
        extractMVName(sh.vessel_name) ||
        cleanText(sh.mv_project_name) ||
        cleanText(sh.vessel_name) ||
        "Unmapped Project";
      const key = normalizeKey(projectName);
      const existing = grouped.get(key) || [];
      existing.push(sh);
      grouped.set(key, existing);
    }

    // Fallback for confirmed deals that do not have shipment detail yet.
    deals
      .filter((d) => d.status === "confirmed")
      .forEach((d) => {
        const projectName =
          cleanText(d.project_id) ||
          extractProjectName(d.vessel_name) ||
          extractMVName(d.vessel_name) ||
          cleanText(d.deal_number) ||
          "Unmapped Project";
        const key = normalizeKey(projectName);
        if (!grouped.has(key)) grouped.set(key, []);
      });

    const out: ProjectCard[] = [];
    grouped.forEach((rows, key) => {
      const projectName =
        extractProjectName(rows[0]?.mv_project_name) ||
        extractProjectName(rows[0]?.vessel_name) ||
        extractMVName(rows[0]?.mv_project_name) ||
        extractMVName(rows[0]?.vessel_name) ||
        rows[0]?.mv_project_name ||
        rows[0]?.vessel_name ||
        key;

      const volume = rows.reduce(
        (s, r) => s + safeNum(r.qty_plan || r.quantity_loaded),
        0,
      );
      const revenue = rows.reduce((s, r) => {
        const qty = safeNum(r.qty_plan || r.quantity_loaded);
        const price = safeNum(r.harga_actual_fob_mv || r.sales_price);
        return s + qty * price;
      }, 0);
      const grossProfit = rows.reduce((s, r) => {
        const qty = safeNum(r.qty_plan || r.quantity_loaded);
        const marginFromRow = safeNum(r.margin_mt);
        if (marginFromRow) return s + qty * marginFromRow;
        const fallbackMargin =
          safeNum(r.harga_actual_fob_mv || r.sales_price) - safeNum(r.harga_actual_fob);
        return s + qty * fallbackMargin;
      }, 0);

      const years = rows.map((r) => safeNum(r.year)).filter((y) => y > 0);
      const year = years.length ? Math.max(...years) : null;
      const laycan = cleanText(rows.find((r) => cleanText(r.laycan))?.laycan) || "TBA";
      const shippingTerm =
        cleanText(rows.find((r) => cleanText(r.shipping_term))?.shipping_term) || "-";
      const buyer = cleanText(rows.find((r) => cleanText(r.buyer))?.buyer) || "-";

      out.push({
        id: key,
        projectName: cleanText(projectName) || "Unmapped Project",
        projectKey: key,
        mvTitle: pickMVTitle(rows),
        buyer,
        year,
        laycan,
        shippingTerm,
        volume,
        revenue,
        grossProfit,
        shipmentCount: rows.length,
        status: detectStatus(rows),
        rows,
      });
    });

    return out.sort((a, b) => {
      const yA = a.year || 0;
      const yB = b.year || 0;
      if (yA !== yB) return yB - yA;
      return b.volume - a.volume;
    });
  }, [shipments, deals]);

  const years = React.useMemo(() => {
    const set = new Set<number>();
    projects.forEach((p) => {
      if (p.year) set.add(p.year);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [projects]);

  const filteredProjects = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (yearFilter !== "all" && String(p.year || "") !== yearFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.projectName.toLowerCase().includes(q) ||
        p.mvTitle.toLowerCase().includes(q) ||
        p.buyer.toLowerCase().includes(q)
      );
    });
  }, [projects, search, yearFilter, statusFilter]);

  if (isInitializing) return <GlobalLoading />;

  return (
    <AppShell>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fade-in">
          <div>
            <h1 className="text-xl md:text-2xl font-bold border-l-4 border-emerald-500 pl-3">
              Projects (MV/Project Centric)
            </h1>
            <p className="text-sm text-muted-foreground mt-1 ml-4">
              Sumber utama: shipment detail. Title = Project, sub-title = MV.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search project/MV/buyer..."
                className="pl-9 pr-4 py-2 w-56 rounded-lg bg-accent/30 border border-border text-xs outline-none focus:border-emerald-500"
              />
            </div>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-accent/30 border border-border text-xs outline-none focus:border-emerald-500"
            >
              <option value="all">All Year</option>
              {years.map((y) => (
                <option key={y} value={String(y)}>
                  Year {y}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | ProjectStatus)}
              className="px-3 py-2 rounded-lg bg-accent/30 border border-border text-xs outline-none focus:border-emerald-500"
            >
              <option value="all">All Status</option>
              <option value="ongoing">Ongoing</option>
              <option value="upcoming">Upcoming</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card-elevated p-4">
            <p className="text-[10px] text-muted-foreground uppercase font-bold">Projects</p>
            <p className="text-xl font-bold text-emerald-600 mt-1">{fmtInt(filteredProjects.length)}</p>
          </div>
          <div className="card-elevated p-4">
            <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Shipments</p>
            <p className="text-xl font-bold mt-1">{fmtInt(filteredProjects.reduce((s, p) => s + p.shipmentCount, 0))}</p>
          </div>
          <div className="card-elevated p-4">
            <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Volume</p>
            <p className="text-xl font-bold mt-1">{fmtInt(filteredProjects.reduce((s, p) => s + p.volume, 0))} MT</p>
          </div>
          <div className="card-elevated p-4">
            <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Revenue</p>
            <p className="text-xl font-bold mt-1">{fmtUsd(filteredProjects.reduce((s, p) => s + p.revenue, 0))}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((p, i) => (
            <div
              key={p.id}
              onClick={() => setSelectedProject(p)}
              className={cn(
                "card-interactive cursor-pointer p-0 overflow-hidden animate-slide-up hover:border-emerald-500/30 group",
                `delay-${Math.min((i % 5) + 1, 5)}`,
              )}
            >
              <div className="p-5 space-y-4">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-base line-clamp-1 group-hover:text-emerald-500 transition-colors">
                      {p.projectName}
                    </h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                      {p.mvTitle}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Buyer: {p.buyer}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider",
                      p.status === "ongoing" && "bg-amber-500/10 text-amber-600",
                      p.status === "upcoming" && "bg-blue-500/10 text-blue-600",
                      p.status === "completed" && "bg-emerald-500/10 text-emerald-600",
                    )}
                  >
                    {p.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Volume</p>
                    <p className="text-sm font-bold font-mono text-emerald-600">{fmtInt(p.volume)} MT</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Revenue</p>
                    <p className="text-sm font-bold font-mono">{fmtUsd(p.revenue)}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-px pt-px bg-border/50">
                <div className="p-3 text-center bg-card/80">
                  <Calendar className="w-3.5 h-3.5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Laycan</p>
                  <p className="text-[11px] font-bold mt-0.5 line-clamp-1">{p.laycan}</p>
                </div>
                <div className="p-3 text-center bg-card/80">
                  <Ship className="w-3.5 h-3.5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Rows</p>
                  <p className="text-[11px] font-bold mt-0.5">{fmtInt(p.shipmentCount)}</p>
                </div>
                <div className="p-3 text-center bg-card/80">
                  <TrendingUp className="w-3.5 h-3.5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Year</p>
                  <p className="text-[11px] font-bold mt-0.5">{p.year || "-"}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredProjects.length === 0 && (
          <div className="text-center py-16 px-8 card-elevated border-dashed border-2">
            <FolderKanban className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="text-lg font-bold mb-1">No Project Data</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Tidak ada project yang cocok dengan filter saat ini.
            </p>
          </div>
        )}

        {selectedProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setSelectedProject(null)}
            />
            <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-2xl">
              <div className="flex items-start justify-between p-5 border-b border-border bg-accent/10">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold line-clamp-1">{selectedProject.projectName}</h2>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{selectedProject.mvTitle}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Buyer: {selectedProject.buyer} • Year {selectedProject.year || "-"}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="p-2 rounded-lg hover:bg-accent transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              <div className="p-5 space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="card-elevated p-3">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Rows</p>
                    <p className="text-lg font-bold">{fmtInt(selectedProject.shipmentCount)}</p>
                  </div>
                  <div className="card-elevated p-3">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Volume</p>
                    <p className="text-lg font-bold">{fmtInt(selectedProject.volume)} MT</p>
                  </div>
                  <div className="card-elevated p-3">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Revenue</p>
                    <p className="text-lg font-bold">{fmtUsd(selectedProject.revenue)}</p>
                  </div>
                  <div className="card-elevated p-3">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Gross Profit</p>
                    <p className="text-lg font-bold">{fmtUsd(selectedProject.grossProfit)}</p>
                  </div>
                  <div className="card-elevated p-3">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Shipping Term</p>
                    <p className="text-lg font-bold">{selectedProject.shippingTerm}</p>
                  </div>
                </div>

                <div className="card-elevated p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold flex items-center gap-2">
                      <Package className="w-4 h-4 text-emerald-500" /> Child Shipment Details
                    </h4>
                    <span className="text-[10px] text-muted-foreground">
                      Menampilkan {Math.min(12, selectedProject.rows.length)} dari {selectedProject.rows.length} row
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/60 text-muted-foreground">
                          <th className="text-left py-2 pr-3">Nomination</th>
                          <th className="text-left py-2 pr-3">Jetty/Port</th>
                          <th className="text-left py-2 pr-3">Laycan</th>
                          <th className="text-left py-2 pr-3">Status</th>
                          <th className="text-right py-2 pr-3">Qty</th>
                          <th className="text-right py-2">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedProject.rows.slice(0, 12).map((r) => (
                          <tr key={r.id} className="border-b border-border/30">
                            <td className="py-2 pr-3">{r.nomination || r.barge_name || "-"}</td>
                            <td className="py-2 pr-3">{r.jetty_loading_port || r.loading_port || "-"}</td>
                            <td className="py-2 pr-3">{r.laycan || "-"}</td>
                            <td className="py-2 pr-3">{r.shipment_status || r.status || "-"}</td>
                            <td className="py-2 pr-3 text-right font-mono">
                              {fmtInt(safeNum(r.qty_plan || r.quantity_loaded))}
                            </td>
                            <td className="py-2 text-right font-mono">
                              {safeNum(r.harga_actual_fob_mv || r.sales_price)
                                ? fmtUsd(safeNum(r.harga_actual_fob_mv || r.sales_price))
                                : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

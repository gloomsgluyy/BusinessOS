import React from "react";
import { Download, FileText, X, FileSpreadsheet, Calendar, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useCommercialStore } from "@/store/commercial-store";

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    moduleName: string;
    onExport: (format: "pdf" | "excel", options: any) => void;
}

export function ReportModal({ isOpen, onClose, moduleName, onExport }: ReportModalProps) {
    const [format, setFormat] = React.useState<"pdf" | "excel">("pdf");
    const [dateRange, setDateRange] = React.useState("last_30_days");
    const [includeCharts, setIncludeCharts] = React.useState(true);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay z-50 fixed inset-0 flex items-center justify-center p-4">
            <div className="modal-backdrop absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
            <div className="modal-content relative bg-card border border-border w-full max-w-md rounded-xl shadow-2xl animate-scale-in">
                <div className="p-5 border-b border-border/50 flex justify-between items-center bg-card/50">
                    <div>
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <Download className="w-5 h-5 text-primary" />
                            Generate Data Report
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">Export {moduleName} data.</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-accent rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                </div>

                <div className="p-5 space-y-6">
                    {/* Format Selection */}
                    <div className="space-y-3">
                        <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5"><FileText className="w-3 h-3" /> Select Format</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setFormat("pdf")} className={cn("flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all", format === "pdf" ? "border-red-500 bg-red-500/5 text-red-500" : "border-border/50 bg-accent/20 text-muted-foreground hover:border-red-500/30")}>
                                <div className={cn("w-10 h-10 rounded-full flex items-center justify-center mb-2", format === "pdf" ? "bg-red-500/10" : "")}>
                                    <FileText className="w-5 h-5" />
                                </div>
                                <span className="text-sm font-bold">PDF Report</span>
                                <span className="text-[10px] mt-1 opacity-70">Visual & Presentation</span>
                            </button>
                            <button onClick={() => setFormat("excel")} className={cn("flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all", format === "excel" ? "border-emerald-500 bg-emerald-500/5 text-emerald-500" : "border-border/50 bg-accent/20 text-muted-foreground hover:border-emerald-500/30")}>
                                <div className={cn("w-10 h-10 rounded-full flex items-center justify-center mb-2", format === "excel" ? "bg-emerald-500/10" : "")}>
                                    <FileSpreadsheet className="w-5 h-5" />
                                </div>
                                <span className="text-sm font-bold">Excel Data</span>
                                <span className="text-[10px] mt-1 opacity-70">Raw & Editable</span>
                            </button>
                        </div>
                    </div>

                    {/* Date Range Selection */}
                    <div className="space-y-3">
                        <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Report Period</label>
                        <select value={dateRange} onChange={e => setDateRange(e.target.value)} className="w-full px-3 py-2 bg-accent/50 rounded-lg border border-border focus:border-primary/50 outline-none text-sm">
                            <option value="last_7_days">Last 7 Days</option>
                            <option value="last_30_days">Last 30 Days</option>
                            <option value="this_month">This Month</option>
                            <option value="ytd">Year to Date</option>
                            <option value="all_time">All Time</option>
                        </select>
                    </div>

                    {/* Advanced Options */}
                    <div className="space-y-3">
                        <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5"><Filter className="w-3 h-3" /> Include Content</label>
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-accent/30 rounded-lg transition-colors border border-transparent hover:border-border/50">
                                <input type="checkbox" checked={includeCharts} onChange={e => setIncludeCharts(e.target.checked)} className="rounded text-primary focus:ring-primary bg-accent border-border" />
                                <div>
                                    <span className="text-sm font-medium block">Visual Charts & Graphs</span>
                                    <span className="text-[10px] text-muted-foreground">Add summary visualization to the report (PDF only)</span>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="p-5 border-t border-border/50 bg-card/50 flex gap-3">
                    <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">Cancel</button>
                    <button
                        onClick={() => {
                            let tableHead: string[][] = [];
                            let tableBody: string[][] = [];

                            const { shipments, deals, sources, meetings, qualityResults } = useCommercialStore.getState();

                            // --- DATE FILTER ---
                            const now = new Date();
                            const filterByDate = (items: any[], dateField = "created_at") => {
                                if (dateRange === "all_time") return items;
                                let cutoff: Date;
                                if (dateRange === "last_7_days") cutoff = new Date(now.getTime() - 7 * 86400000);
                                else if (dateRange === "last_30_days") cutoff = new Date(now.getTime() - 30 * 86400000);
                                else if (dateRange === "this_month") cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
                                else if (dateRange === "ytd") cutoff = new Date(now.getFullYear(), 0, 1);
                                else cutoff = new Date(0);
                                return items.filter(i => {
                                    const d = new Date(i[dateField] || i.created_at || i.updated_at || i.date || 0);
                                    return d.getTime() >= cutoff.getTime();
                                });
                            };

                            if (moduleName.toLowerCase().includes("shipment") || moduleName.toLowerCase().includes("transshipment")) {
                                const filtered = filterByDate(shipments);
                                tableHead = [['Shipment No', 'Buyer', 'Status', 'Port', 'Volume (MT)']];
                                tableBody = filtered?.map((s: any) => [s.shipment_number, s.buyer, s.status, s.loading_port || "TBA", String(s.quantity_loaded || 0)]) || [];
                            } else if (moduleName.toLowerCase().includes("sales")) {
                                const filtered = filterByDate(deals);
                                tableHead = [['Buyer', 'Country', 'Volume (MT)', 'Price USD', 'Status']];
                                tableBody = filtered?.map((s: any) => [s.buyer, s.buyer_country, String(s.quantity), String(s.price_per_mt), s.status]) || [];
                            } else if (moduleName.toLowerCase().includes("source") || moduleName.toLowerCase().includes("tambang") || moduleName.toLowerCase().includes("coal")) {
                                const filtered = filterByDate(sources, "updated_at");
                                tableHead = [['Source Name', 'Region', 'Stock (MT)', 'GAR', 'KYC']];
                                tableBody = filtered?.map((s: any) => [s.name, s.region, String(s.stock_available), String(s.spec?.gar), s.kyc_status]) || [];
                            } else if (moduleName.toLowerCase().includes("meeting")) {
                                const filtered = filterByDate(meetings, "date");
                                tableHead = [['Title', 'Date', 'Time', 'Location', 'Status']];
                                tableBody = filtered?.map((s: any) => [s.title, s.date, s.time, s.location, s.status]) || [];
                            } else if (moduleName.toLowerCase().includes("quality")) {
                                const filtered = filterByDate(qualityResults);
                                tableHead = [['Cargo/Vessel', 'Surveyor', 'GAR', 'TM (%)', 'ASH (%)']];
                                tableBody = filtered?.map((s: any) => [s.cargo_name, s.surveyor, String(s.spec_result?.gar), String(s.spec_result?.tm), String(s.spec_result?.ash)]) || [];
                            } else if (moduleName.toLowerCase().includes("blending")) {
                                const filtered = filterByDate(qualityResults);
                                tableHead = [['Cargo/Vessel', 'Surveyor', 'GAR', 'TM (%)', 'ASH (%)']];
                                tableBody = filtered?.map((s: any) => [s.cargo_name, s.surveyor, String(s.spec_result?.gar), String(s.spec_result?.tm), String(s.spec_result?.ash)]) || [];
                            } else {
                                tableHead = [['Metric', 'Value', 'Status']];
                                tableBody = [
                                    ['Total Records', '150', 'Active'],
                                    ['System Verification', 'Passed', 'Verified']
                                ];
                            }

                            if (format === "pdf") {
                                const doc = new jsPDF();
                                doc.setFontSize(14);
                                doc.text(`Data Report: ${moduleName}`, 14, 20);
                                doc.setFontSize(10);
                                doc.setTextColor(100);
                                doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);
                                doc.text(`Period: ${dateRange.replace(/_/g, " ").toUpperCase()}`, 14, 34);

                                autoTable(doc, {
                                    startY: 40,
                                    head: tableHead,
                                    body: tableBody.length > 0 ? tableBody : [['No Data', '', '']],
                                    theme: 'grid',
                                    headStyles: { fillColor: [41, 128, 185] },
                                    styles: { fontSize: 8 }
                                });

                                doc.save(`${moduleName.replace(/\s+/g, '_').toLowerCase()}_report.pdf`);
                            } else {
                                const blob = new Blob([`Mock EXCEL Report Content for ${moduleName}\nData Count: ${tableBody.length}`], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = `${moduleName.replace(/\s+/g, '_').toLowerCase()}_report.xlsx`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                            }

                            onExport(format, { dateRange, includeCharts });
                            onClose();
                        }}
                        className={cn("flex-1 px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5", format === "pdf" ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20")}
                    >
                        <Download className="w-4 h-4" /> Export {format.toUpperCase()}
                    </button>
                </div>
            </div>
        </div>
    );
}

import * as XLSX from "xlsx";
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, WidthType, AlignmentType, BorderStyle } from "docx";
import { saveAs } from "file-saver";

interface ReportColumn {
    header: string;
    key: string;
    width?: number;
    format?: (val: any) => string;
}

const formatCurrency = (val: number) => `Rp ${val?.toLocaleString("id-ID") || "0"}`;
const formatDate = (val: string) => {
    if (!val) return "-";
    const d = new Date(val);
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
};

// ── Excel Generator ──────────────────────────────────────────
export function generateExcel(title: string, columns: ReportColumn[], data: any[], filename: string) {
    const headers = columns.map(c => c.header);
    const rows = data.map(item => columns.map(c => {
        const val = item[c.key];
        return c.format ? c.format(val) : val ?? "-";
    }));

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Auto-width
    ws["!cols"] = columns.map(c => ({ wch: c.width || 18 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));
    XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ── Word Generator ───────────────────────────────────────────
export async function generateWord(title: string, columns: ReportColumn[], data: any[], filename: string) {
    const headerCells = columns.map(c =>
        new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: c.header, bold: true, size: 20, font: "Calibri" })], alignment: AlignmentType.CENTER })],
            width: { size: c.width || 2000, type: WidthType.DXA },
            shading: { fill: "4F46E5" },
        })
    );

    const dataRows = data.map(item =>
        new TableRow({
            children: columns.map(c => {
                const val = item[c.key];
                const text = c.format ? c.format(val) : String(val ?? "-");
                return new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text, size: 18, font: "Calibri" })], alignment: AlignmentType.LEFT })],
                    borders: {
                        top: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
                        bottom: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
                        left: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
                        right: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
                    },
                });
            }),
        })
    );

    const doc = new Document({
        sections: [{
            properties: {},
            children: [
                new Paragraph({ text: title, heading: HeadingLevel.HEADING_1, spacing: { after: 200 } }),
                new Paragraph({
                    children: [new TextRun({ text: `Generated: ${new Date().toLocaleDateString("id-ID", { dateStyle: "full" })}`, italics: true, size: 18, color: "6B7280" })],
                    spacing: { after: 400 },
                }),
                new Table({ rows: [new TableRow({ children: headerCells }), ...dataRows] }),
                new Paragraph({
                    children: [new TextRun({ text: `\nTotal: ${data.length} records`, size: 18, color: "6B7280" })],
                    spacing: { before: 200 },
                }),
            ],
        }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${filename}.docx`);
}

// ── Preset Report Functions ──────────────────────────────────

export function downloadPurchaseReport(purchases: any[], format: "xlsx" | "docx") {
    const cols: ReportColumn[] = [
        { header: "No. Request", key: "request_number", width: 22 },
        { header: "Kategori", key: "category", width: 16 },
        { header: "Supplier", key: "supplier", width: 20 },
        { header: "Deskripsi", key: "description", width: 30 },
        { header: "Jumlah", key: "amount", width: 18, format: formatCurrency },
        { header: "Status", key: "status", width: 12 },
        { header: "Dibuat Oleh", key: "created_by_name", width: 16 },
        { header: "Tanggal", key: "created_at", width: 14, format: formatDate },
    ];
    const title = "Laporan Pembelian";
    const fn = `laporan-pembelian-${new Date().toISOString().slice(0, 10)}`;
    if (format === "xlsx") generateExcel(title, cols, purchases, fn);
    else generateWord(title, cols, purchases, fn);
}

export function downloadSalesReport(orders: any[], format: "xlsx" | "docx") {
    const cols: ReportColumn[] = [
        { header: "No. Order", key: "order_number", width: 22 },
        { header: "Client", key: "client", width: 22 },
        { header: "Deskripsi", key: "description", width: 30 },
        { header: "Jumlah", key: "amount", width: 18, format: formatCurrency },
        { header: "Status", key: "status", width: 12 },
        { header: "Dibuat Oleh", key: "created_by_name", width: 16 },
        { header: "Tanggal", key: "created_at", width: 14, format: formatDate },
    ];
    const title = "Laporan Penjualan";
    const fn = `laporan-penjualan-${new Date().toISOString().slice(0, 10)}`;
    if (format === "xlsx") generateExcel(title, cols, orders, fn);
    else generateWord(title, cols, orders, fn);
}

export function downloadTaskReport(tasks: any[], format: "xlsx" | "docx") {
    const cols: ReportColumn[] = [
        { header: "Judul", key: "title", width: 30 },
        { header: "Status", key: "status", width: 14 },
        { header: "Prioritas", key: "priority", width: 12 },
        { header: "Assignee", key: "assignee_name", width: 18 },
        { header: "Deadline", key: "due_date", width: 14, format: formatDate },
        { header: "Dibuat", key: "created_at", width: 14, format: formatDate },
    ];
    const title = "Laporan Tugas";
    const fn = `laporan-tugas-${new Date().toISOString().slice(0, 10)}`;
    if (format === "xlsx") generateExcel(title, cols, tasks, fn);
    else generateWord(title, cols, tasks, fn);
}

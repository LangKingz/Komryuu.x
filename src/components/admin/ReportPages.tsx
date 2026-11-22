"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { logAdminAction } from "@/lib/admin-activity";
import {
  AlertCircle,
  AlertTriangle,
  Bug,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  Globe,
  Inbox,
  Layers,
  MessageSquare,
  RefreshCw,
  Search,
  Smartphone,
  Trash2,
  User,
  Wrench,
  X,
} from "lucide-react";

export type ReportStatus = "pending" | "in_progress" | "resolved";
export type ReportType = "scraper_error" | "broken_chapter" | "bug" | "feedback";

export interface ReportItem {
  id: string;
  type: ReportType;
  title: string;
  description: string;
  extensionName?: string;
  comicId?: string;
  chapterTitle?: string;
  targetUrl?: string;
  userEmail?: string;
  uid?: string;
  deviceInfo?: Record<string, unknown>;
  status: ReportStatus;
  adminNote?: string;
  createdAt: string;
  updatedAt?: unknown;
}

export default function ReportPages() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Catatan admin modal / state
  const [editingNoteReport, setEditingNoteReport] = useState<ReportItem | null>(null);
  const [adminNoteDraft, setAdminNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const currentAdminEmail = auth.currentUser?.email || "admin@komryuu.x";

  useEffect(() => {
    const q = query(collection(db, "REPORTS"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: ReportItem[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            type: d.type || "feedback",
            title: d.title || "Tanpa Judul",
            description: d.description || "",
            extensionName: d.extensionName || "",
            comicId: d.comicId || "",
            chapterTitle: d.chapterTitle || "",
            targetUrl: d.targetUrl || d.url || d.link || "",
            userEmail: d.userEmail || "",
            uid: d.uid || "",
            deviceInfo: d.deviceInfo || {},
            status: d.status || "pending",
            adminNote: d.adminNote || "",
            createdAt: d.createdAt || new Date().toISOString(),
            updatedAt: d.updatedAt,
          };
        });
        setReports(list);
        setLoading(false);
      },
      (error) => {
        console.error("Error reading reports:", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const counts = useMemo(() => {
    return {
      total: reports.length,
      pending: reports.filter((r) => r.status === "pending").length,
      inProgress: reports.filter((r) => r.status === "in_progress").length,
      resolved: reports.filter((r) => r.status === "resolved").length,
    };
  }, [reports]);

  const filteredReports = useMemo(() => {
    const s = search.trim().toLowerCase();
    return reports.filter((r) => {
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      const matchType = typeFilter === "all" || r.type === typeFilter;
      const matchSearch =
        !s ||
        r.title.toLowerCase().includes(s) ||
        r.description.toLowerCase().includes(s) ||
        (r.extensionName && r.extensionName.toLowerCase().includes(s)) ||
        (r.comicId && r.comicId.toLowerCase().includes(s)) ||
        (r.userEmail && r.userEmail.toLowerCase().includes(s)) ||
        (r.adminNote && r.adminNote.toLowerCase().includes(s));
      return matchStatus && matchType && matchSearch;
    });
  }, [reports, statusFilter, typeFilter, search]);

  async function updateReportStatus(report: ReportItem, newStatus: ReportStatus) {
    setBusyId(report.id);
    try {
      await updateDoc(doc(db, "REPORTS", report.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      await logAdminAction(
        currentAdminEmail,
        "Status Laporan Diperbarui",
        report.extensionName || report.title,
        `Tiket ${report.id} (${report.title}) diubah status menjadi: ${newStatus.toUpperCase()}`
      );
      setToast({ kind: "success", message: `Status laporan diubah ke ${newStatus === "in_progress" ? "Diproses" : newStatus === "resolved" ? "Selesai" : "Menunggu"}.` });
      if (selectedReport?.id === report.id) {
        setSelectedReport({ ...selectedReport, status: newStatus });
      }
    } catch (err) {
      console.error("Update status error:", err);
      setToast({ kind: "error", message: "Gagal memperbarui status laporan." });
    } finally {
      setBusyId(null);
    }
  }

  function openNoteEditor(report: ReportItem) {
    setEditingNoteReport(report);
    setAdminNoteDraft(report.adminNote || "");
  }

  async function saveAdminNote() {
    if (!editingNoteReport) return;
    setSavingNote(true);
    try {
      await updateDoc(doc(db, "REPORTS", editingNoteReport.id), {
        adminNote: adminNoteDraft.trim(),
        updatedAt: serverTimestamp(),
      });
      await logAdminAction(
        currentAdminEmail,
        "Catatan Admin Disimpan",
        editingNoteReport.title,
        `Catatan pada tiket ${editingNoteReport.id}: ${adminNoteDraft.slice(0, 50)}`
      );
      setToast({ kind: "success", message: "Catatan admin berhasil disimpan." });
      if (selectedReport?.id === editingNoteReport.id) {
        setSelectedReport({ ...selectedReport, adminNote: adminNoteDraft.trim() });
      }
      setEditingNoteReport(null);
    } catch (err) {
      console.error("Save note error:", err);
      setToast({ kind: "error", message: "Gagal menyimpan catatan admin." });
    } finally {
      setSavingNote(false);
    }
  }

  async function deleteReport(report: ReportItem) {
    if (!confirm(`Hapus laporan "${report.title}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    setBusyId(report.id);
    try {
      await deleteDoc(doc(db, "REPORTS", report.id));
      await logAdminAction(
        currentAdminEmail,
        "Laporan Dihapus",
        report.title,
        `Laporan ID ${report.id} dihapus dari antrean.`
      );
      setToast({ kind: "success", message: "Laporan berhasil dihapus." });
      if (selectedReport?.id === report.id) {
        setSelectedReport(null);
      }
    } catch (err) {
      console.error("Delete report error:", err);
      setToast({ kind: "error", message: "Gagal menghapus laporan." });
    } finally {
      setBusyId(null);
    }
  }

  function getDeviceString(deviceInfo?: Record<string, unknown>): string {
    if (!deviceInfo) return "Android";
    const model = deviceInfo.model || deviceInfo.deviceModel || deviceInfo.name;
    const platform = deviceInfo.platform ? `(${deviceInfo.platform})` : "";
    return [model, platform].filter(Boolean).join(" ") || "Android Device";
  }

  function getTypeBadge(type: ReportType) {
    switch (type) {
      case "scraper_error":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-rose-300">
            <AlertCircle size={12} />
            Error Scraper
          </span>
        );
      case "broken_chapter":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
            <AlertTriangle size={12} />
            Chapter Rusak
          </span>
        );
      case "bug":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-purple-300">
            <Bug size={12} />
            Bug App
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-sky-300">
            <MessageSquare size={12} />
            Feedback
          </span>
        );
    }
  }

  function getStatusBadge(status: ReportStatus) {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
            <Clock size={12} />
            Menunggu
          </span>
        );
      case "in_progress":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-indigo-400/30 bg-indigo-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-300">
            <Wrench size={12} />
            Diproses
          </span>
        );
      case "resolved":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
            <CheckCircle2 size={12} />
            Selesai
          </span>
        );
    }
  }

  return (
    <section className="min-h-full bg-[#14141e] p-4 text-white md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-400">Pusat Bantuan &amp; Scraper</p>
          <h1 className="mt-2 text-3xl font-semibold">Pusat Tiket Laporan User</h1>
          <p className="mt-2 text-sm text-slate-400">
            Kelola laporan otomatis error scraper dari Android, feedback chapter rusak, dan simpan catatan tindak lanjut admin.
          </p>
        </header>

        {toast && (
          <div
            className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
              toast.kind === "error"
                ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
                : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
            }`}
          >
            {toast.message}
          </div>
        )}

        {/* METRICS CARDS */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/[0.08] bg-[#1c1c28] p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">Total Tiket Masuk</p>
                <p className="mt-2 text-3xl font-bold text-white">{counts.total}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                <Inbox size={22} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#1c1c28] p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">Menunggu</p>
                <p className="mt-2 text-3xl font-bold text-amber-300">{counts.pending}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                <Clock size={22} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#1c1c28] p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">Diproses</p>
                <p className="mt-2 text-3xl font-bold text-indigo-300">{counts.inProgress}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                <Wrench size={22} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#1c1c28] p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">Selesai</p>
                <p className="mt-2 text-3xl font-bold text-emerald-300">{counts.resolved}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 size={22} />
              </div>
            </div>
          </div>
        </div>

        {/* CONTROLS: FILTER TABS & SEARCH */}
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-[#1c1c28] p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Tabs: Semua, Menunggu, Diproses, Selesai */}
            {[
              { id: "all", label: "Semua", count: counts.total },
              { id: "pending", label: "Menunggu", count: counts.pending },
              { id: "in_progress", label: "Diproses", count: counts.inProgress },
              { id: "resolved", label: "Selesai", count: counts.resolved },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  statusFilter === tab.id
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    statusFilter === tab.id
                      ? "bg-white/20 text-white"
                      : "bg-white/10 text-slate-300"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}

            {/* Type Dropdown */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-white/[0.09] bg-[#14141e] px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
            >
              <option value="all">Semua Tipe Masalah</option>
              <option value="scraper_error">Error Scraper</option>
              <option value="broken_chapter">Chapter Rusak</option>
              <option value="bug">Bug Aplikasi</option>
              <option value="feedback">Saran &amp; Masukan</option>
            </select>
          </div>

          <div className="relative w-full lg:max-w-xs">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari judul, ekstensi, URL, catatan..."
              className="w-full rounded-xl border border-white/[0.09] bg-[#14141e] py-2 pl-9 pr-3 text-xs text-white outline-none placeholder:text-slate-500 focus:border-indigo-500"
            />
          </div>
        </div>

        {/* REPORTS TABLE */}
        {loading ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#1c1c28] py-16 text-center text-slate-400 text-sm">
            Memuat daftar laporan...
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#1c1c28] py-16 text-center text-slate-400 text-sm">
            Tidak ada laporan masalah yang cocok dengan filter.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1c1c28]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left">
                <thead className="border-b border-white/[0.07] bg-white/[0.02] text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-4">Masalah &amp; Detail</th>
                    <th className="px-5 py-4">Sumber &amp; Komik</th>
                    <th className="px-5 py-4">Perangkat &amp; Pelapor</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Catatan Admin</th>
                    <th className="px-5 py-4 text-right">Aksi Cepat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-xs">
                  {filteredReports.map((report) => (
                    <tr key={report.id} className="transition hover:bg-white/[0.02]">
                      {/* Masalah & Detail */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 mb-1">
                          {getTypeBadge(report.type)}
                          <span className="text-[10px] text-slate-500">
                            {new Date(report.createdAt).toLocaleString("id-ID", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="font-semibold text-white text-sm truncate max-w-sm">{report.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-slate-400 max-w-sm leading-relaxed">{report.description}</p>
                        {report.targetUrl && (
                          <a
                            href={report.targetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1.5 inline-flex items-center gap-1 font-mono text-[11px] text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
                            title={report.targetUrl}
                          >
                            <Globe size={11} />
                            <span className="truncate max-w-[240px]">{report.targetUrl}</span>
                            <ExternalLink size={10} />
                          </a>
                        )}
                      </td>

                      {/* Sumber & Komik */}
                      <td className="px-5 py-4">
                        {report.extensionName ? (
                          <div className="flex items-center gap-1.5 text-indigo-300 font-medium">
                            <Layers size={14} />
                            <span>{report.extensionName}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                        {report.comicId && (
                          <p className="mt-0.5 text-slate-300 font-mono text-[11px] truncate max-w-[160px]" title={report.comicId}>
                            Komik: {report.comicId}
                          </p>
                        )}
                        {report.chapterTitle && (
                          <p className="text-slate-400 text-[11px] truncate max-w-[160px]" title={report.chapterTitle}>
                            {report.chapterTitle}
                          </p>
                        )}
                      </td>

                      {/* Pelapor & Perangkat */}
                      <td className="px-5 py-4">
                        <p className="text-slate-300 truncate max-w-[160px]" title={report.userEmail}>
                          {report.userEmail || "Pengguna Android"}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400 flex items-center gap-1">
                          <Smartphone size={12} className="text-indigo-400" />
                          <span>{getDeviceString(report.deviceInfo)}</span>
                        </p>
                        {report.uid && (
                          <p className="mt-0.5 font-mono text-[10px] text-slate-500 truncate max-w-[140px]">
                            UID: {report.uid}
                          </p>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        {getStatusBadge(report.status)}
                      </td>

                      {/* Catatan Admin */}
                      <td className="px-5 py-4">
                        {report.adminNote ? (
                          <div
                            onClick={() => openNoteEditor(report)}
                            className="cursor-pointer group rounded-lg border border-white/[0.08] bg-[#14141e] p-2 hover:border-indigo-500/40 transition max-w-[180px]"
                            title="Klik untuk edit catatan"
                          >
                            <p className="line-clamp-2 text-[11px] text-slate-300 group-hover:text-white">
                              {report.adminNote}
                            </p>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openNoteEditor(report)}
                            className="inline-flex items-center gap-1 rounded-lg border border-dashed border-white/20 px-2 py-1 text-[11px] text-slate-400 hover:border-indigo-400 hover:text-indigo-300 transition"
                          >
                            <FileText size={12} />
                            + Tambah Catatan
                          </button>
                        )}
                      </td>

                      {/* Aksi Cepat */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Tombol Proses */}
                          {report.status !== "in_progress" && (
                            <button
                              type="button"
                              disabled={busyId === report.id}
                              onClick={() => updateReportStatus(report, "in_progress")}
                              className="inline-flex items-center gap-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1.5 text-xs font-medium text-indigo-300 hover:bg-indigo-500/20 disabled:opacity-50 transition"
                              title="Tandai Sedang Diproses"
                            >
                              <Wrench size={13} />
                              <span className="hidden sm:inline">Proses</span>
                            </button>
                          )}

                          {/* Tombol Tandai Selesai */}
                          {report.status !== "resolved" && (
                            <button
                              type="button"
                              disabled={busyId === report.id}
                              onClick={() => updateReportStatus(report, "resolved")}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50 transition"
                              title="Tandai Selesai"
                            >
                              <CheckCircle2 size={13} />
                              <span className="hidden sm:inline">Selesai</span>
                            </button>
                          )}

                          {/* Tombol Detail */}
                          <button
                            type="button"
                            onClick={() => setSelectedReport(report)}
                            className="rounded-lg border border-white/[0.08] p-1.5 text-slate-300 hover:bg-white/[0.05] hover:text-white"
                            title="Lihat Detail Lengkap"
                          >
                            <Eye size={15} />
                          </button>

                          {/* Tombol Hapus */}
                          <button
                            type="button"
                            disabled={busyId === report.id}
                            onClick={() => deleteReport(report)}
                            className="rounded-lg border border-white/[0.08] p-1.5 text-slate-400 hover:border-rose-500/40 hover:text-rose-300 disabled:opacity-50 transition"
                            title="Hapus Tiket Laporan"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL DETAIL LAPORAN LENGKAP */}
        {selectedReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="presentation">
            <section
              role="dialog"
              aria-modal="true"
              className="w-full max-w-2xl rounded-3xl border border-white/[0.09] bg-[#1c1c28] p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    {getTypeBadge(selectedReport.type)}
                    {getStatusBadge(selectedReport.status)}
                  </div>
                  <h3 className="text-xl font-bold text-white">{selectedReport.title}</h3>
                  <p className="mt-0.5 text-xs text-slate-400">ID Tiket: {selectedReport.id}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.06] hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-5 space-y-4 text-xs">
                {/* Deskripsi */}
                <div>
                  <h4 className="font-semibold text-slate-300">Deskripsi Masalah / Log</h4>
                  <div className="mt-1.5 rounded-xl border border-white/[0.08] bg-[#14141e] p-3.5 text-slate-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto font-mono text-[11px]">
                    {selectedReport.description}
                  </div>
                </div>

                {/* Target URL */}
                {selectedReport.targetUrl && (
                  <div>
                    <h4 className="font-semibold text-slate-300">Target URL Sumber</h4>
                    <a
                      href={selectedReport.targetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 flex items-center gap-2 rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-3 text-indigo-300 hover:text-indigo-200 transition"
                    >
                      <Globe size={16} />
                      <span className="truncate flex-1 font-mono">{selectedReport.targetUrl}</span>
                      <ExternalLink size={14} />
                    </a>
                  </div>
                )}

                {/* Info Grid */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/[0.06] bg-[#14141e] p-3.5">
                    <p className="text-slate-500">Sumber &amp; Konten Terkait</p>
                    <p className="mt-1 font-semibold text-white text-sm">{selectedReport.extensionName || "Umum / Semua Ekstensi"}</p>
                    {selectedReport.comicId && (
                      <p className="mt-1 font-mono text-[11px] text-indigo-300">Komik ID: {selectedReport.comicId}</p>
                    )}
                    {selectedReport.chapterTitle && (
                      <p className="text-slate-400 text-[11px]">Chapter: {selectedReport.chapterTitle}</p>
                    )}
                  </div>

                  <div className="rounded-xl border border-white/[0.06] bg-[#14141e] p-3.5">
                    <p className="text-slate-500">Pelapor &amp; Perangkat</p>
                    <p className="mt-1 font-semibold text-white">{selectedReport.userEmail || "Pengguna Aplikasi Android"}</p>
                    <p className="mt-1 text-slate-300 flex items-center gap-1">
                      <Smartphone size={13} className="text-indigo-400" />
                      <span>{getDeviceString(selectedReport.deviceInfo)}</span>
                    </p>
                    {selectedReport.uid && (
                      <p className="mt-1 font-mono text-[10px] text-slate-500 truncate">UID: {selectedReport.uid}</p>
                    )}
                  </div>
                </div>

                {/* Catatan Admin Section */}
                <div className="rounded-xl border border-white/[0.08] bg-[#14141e] p-3.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <h4 className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <FileText size={14} className="text-indigo-400" />
                      Catatan Penanganan Admin
                    </h4>
                    <button
                      type="button"
                      onClick={() => openNoteEditor(selectedReport)}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium"
                    >
                      {selectedReport.adminNote ? "Edit Catatan" : "+ Tambah Catatan"}
                    </button>
                  </div>
                  {selectedReport.adminNote ? (
                    <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">{selectedReport.adminNote}</p>
                  ) : (
                    <p className="text-slate-500 italic">Belum ada catatan admin untuk tiket ini.</p>
                  )}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => updateReportStatus(selectedReport, "in_progress")}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 px-3.5 py-2 text-xs font-semibold text-indigo-300 hover:bg-indigo-600/30 transition"
                  >
                    <Wrench size={14} />
                    <span>Proses Tiket</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateReportStatus(selectedReport, "resolved")}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600/20 border border-emerald-500/30 px-3.5 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-600/30 transition"
                  >
                    <CheckCircle2 size={14} />
                    <span>Tandai Selesai</span>
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => deleteReport(selectedReport)}
                    className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs text-rose-300 hover:bg-rose-500/20 transition"
                  >
                    Hapus Tiket
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedReport(null)}
                    className="rounded-xl border border-white/[0.08] px-4 py-2 text-xs text-slate-300 hover:bg-white/[0.05]"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* MODAL INPUT CATATAN ADMIN */}
        {editingNoteReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="presentation">
            <section
              role="dialog"
              aria-modal="true"
              className="w-full max-w-md rounded-2xl border border-white/[0.09] bg-[#1c1c28] p-5 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <FileText size={16} className="text-indigo-400" />
                  Catatan Admin
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingNoteReport(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-4">
                <p className="text-xs text-slate-400 mb-2 truncate">
                  Tiket: <strong className="text-white">{editingNoteReport.title}</strong>
                </p>
                <textarea
                  rows={4}
                  value={adminNoteDraft}
                  onChange={(e) => setAdminNoteDraft(e.target.value)}
                  placeholder="Contoh: Sudah diperbaiki cookie cf_clearance scraper Shinigami, gambar manga sudah normal kembali."
                  className="w-full rounded-xl border border-white/10 bg-[#14141e] p-3 text-xs text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingNoteReport(null)}
                  disabled={savingNote}
                  className="rounded-lg border border-white/10 px-3.5 py-1.5 text-xs text-slate-300 hover:bg-white/10"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={savingNote}
                  onClick={() => void saveAdminNote()}
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-50"
                >
                  {savingNote ? "Menyimpan..." : "Simpan Catatan"}
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </section>
  );
}

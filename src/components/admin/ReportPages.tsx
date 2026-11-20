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
  Filter,
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
  userEmail?: string;
  uid?: string;
  deviceInfo?: Record<string, unknown>;
  status: ReportStatus;
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
            userEmail: d.userEmail || "",
            uid: d.uid || "",
            deviceInfo: d.deviceInfo || {},
            status: d.status || "pending",
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
        (r.userEmail && r.userEmail.toLowerCase().includes(s));
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
      setToast({ kind: "success", message: `Status laporan berhasil diubah ke ${newStatus}.` });
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

  async function deleteReport(report: ReportItem) {
    if (!confirm(`Hapus laporan "${report.title}"?`)) return;
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
            Sedang Diperbaiki
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
          <h1 className="mt-2 text-3xl font-semibold">Laporan Masalah &amp; Tiket</h1>
          <p className="mt-2 text-sm text-slate-400">
            Pantau laporan otomatis error scraper dari Android dan feedback chapter rusak pengguna.
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
                <p className="text-xs font-medium text-slate-400">Menunggu Penanganan</p>
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
                <p className="text-xs font-medium text-slate-400">Sedang Diperbaiki</p>
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
                <p className="text-xs font-medium text-slate-400">Terselesaikan</p>
                <p className="mt-2 text-3xl font-bold text-emerald-300">{counts.resolved}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 size={22} />
              </div>
            </div>
          </div>
        </div>

        {/* CONTROLS: FILTER & SEARCH */}
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-[#1c1c28] p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Tabs */}
            {[
              { id: "all", label: "Semua Status" },
              { id: "pending", label: `Menunggu (${counts.pending})` },
              { id: "in_progress", label: `Dalam Proses (${counts.inProgress})` },
              { id: "resolved", label: `Selesai (${counts.resolved})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  statusFilter === tab.id
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                {tab.label}
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
              placeholder="Cari judul, ekstensi, komik..."
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
              <table className="w-full min-w-[900px] text-left">
                <thead className="border-b border-white/[0.07] bg-white/[0.02] text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-4">Tipe &amp; Masalah</th>
                    <th className="px-5 py-4">Target Ekstensi / Komik</th>
                    <th className="px-5 py-4">Pelapor</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Waktu</th>
                    <th className="px-5 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-xs">
                  {filteredReports.map((report) => (
                    <tr key={report.id} className="transition hover:bg-white/[0.02]">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 mb-1">
                          {getTypeBadge(report.type)}
                        </div>
                        <p className="font-semibold text-white text-sm truncate max-w-sm">{report.title}</p>
                        <p className="mt-0.5 line-clamp-1 text-slate-400 max-w-sm">{report.description}</p>
                      </td>

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
                          <p className="mt-0.5 text-slate-400 font-mono text-[11px] truncate max-w-[160px]">
                            ID: {report.comicId}
                          </p>
                        )}
                        {report.chapterTitle && (
                          <p className="text-slate-500 text-[11px] truncate max-w-[160px]">
                            {report.chapterTitle}
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <p className="text-slate-300">{report.userEmail || "Anonim / Pengguna App"}</p>
                        {report.deviceInfo && typeof report.deviceInfo.model === "string" && (
                          <p className="mt-0.5 text-[11px] text-slate-500 flex items-center gap-1">
                            <Smartphone size={11} />
                            <span>{report.deviceInfo.model}</span>
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {getStatusBadge(report.status)}
                      </td>

                      <td className="px-5 py-4 text-slate-400">
                        {new Date(report.createdAt).toLocaleString("id-ID", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedReport(report)}
                            className="rounded-lg border border-white/[0.08] p-1.5 text-slate-300 hover:bg-white/[0.05] hover:text-white"
                            title="Lihat Detail Laporan"
                          >
                            <Eye size={15} />
                          </button>

                          {report.status !== "in_progress" && (
                            <button
                              type="button"
                              disabled={busyId === report.id}
                              onClick={() => updateReportStatus(report, "in_progress")}
                              className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-1.5 text-indigo-300 hover:bg-indigo-500/20 disabled:opacity-50"
                              title="Tandai Sedang Diperbaiki"
                            >
                              <Wrench size={15} />
                            </button>
                          )}

                          {report.status !== "resolved" && (
                            <button
                              type="button"
                              disabled={busyId === report.id}
                              onClick={() => updateReportStatus(report, "resolved")}
                              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-1.5 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                              title="Tandai Selesai"
                            >
                              <CheckCircle2 size={15} />
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={busyId === report.id}
                            onClick={() => deleteReport(report)}
                            className="rounded-lg border border-white/[0.08] p-1.5 text-slate-400 hover:border-rose-500/40 hover:text-rose-300 disabled:opacity-50"
                            title="Hapus Laporan Spam"
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

        {/* DETAIL REPORT MODAL */}
        {selectedReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="presentation">
            <section
              role="dialog"
              aria-modal="true"
              className="w-full max-w-xl rounded-3xl border border-white/[0.09] bg-[#1c1c28] p-6 shadow-2xl"
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
                <div>
                  <h4 className="font-semibold text-slate-300">Deskripsi Masalah / Log</h4>
                  <div className="mt-1.5 rounded-xl border border-white/[0.08] bg-[#14141e] p-3 text-slate-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                    {selectedReport.description}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/[0.06] bg-[#14141e] p-3">
                    <p className="text-slate-500">Ekstensi / Sumber Terkait</p>
                    <p className="mt-0.5 font-semibold text-white">{selectedReport.extensionName || "Tidak spesifik"}</p>
                    {selectedReport.comicId && (
                      <p className="mt-1 font-mono text-[11px] text-indigo-300">Comic ID: {selectedReport.comicId}</p>
                    )}
                    {selectedReport.chapterTitle && (
                      <p className="text-slate-400 text-[11px]">{selectedReport.chapterTitle}</p>
                    )}
                  </div>

                  <div className="rounded-xl border border-white/[0.06] bg-[#14141e] p-3">
                    <p className="text-slate-500">Pelapor / Perangkat</p>
                    <p className="mt-0.5 font-semibold text-white">{selectedReport.userEmail || "Pengguna Aplikasi"}</p>
                    {selectedReport.uid && (
                      <p className="mt-1 font-mono text-[10px] text-slate-400 truncate">UID: {selectedReport.uid}</p>
                    )}
                    <p className="mt-1 text-[11px] text-slate-500">
                      Waktu Lapor: {new Date(selectedReport.createdAt).toLocaleString("id-ID")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => updateReportStatus(selectedReport, "in_progress")}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-600/30"
                  >
                    <Wrench size={13} />
                    <span>Set Sedang Diperbaiki</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateReportStatus(selectedReport, "resolved")}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600/20 border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-600/30"
                  >
                    <CheckCircle2 size={13} />
                    <span>Set Selesai</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  className="rounded-xl border border-white/[0.08] px-4 py-1.5 text-xs text-slate-300 hover:bg-white/[0.05]"
                >
                  Tutup
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </section>
  );
}

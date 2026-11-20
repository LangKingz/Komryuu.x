"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logAdminAction } from "@/lib/admin-activity";
import {
  Bug,
  CheckCircle,
  Clock,
  DotsThreeVertical,
  Eye,
  FileText,
  Hourglass,
  MagnifyingGlass,
  PencilSimple,
  Trash,
  WarningCircle,
  Wrench,
  X,
} from "@phosphor-icons/react";

export type ReportItem = {
  id: string;
  type: "broken_scraper" | "broken_chapter" | "app_bug" | "feedback" | string;
  extensionId?: string;
  comicTitle?: string;
  chapterNumber?: string;
  message: string;
  userEmail?: string;
  uid?: string;
  appVersion?: string;
  deviceInfo?: unknown;
  status: "pending" | "in_progress" | "resolved";
  adminNotes?: string;
  createdAt: string;
};

type StatusFilter = "all" | "pending" | "in_progress" | "resolved";

function statusBadge(status: ReportItem["status"]) {
  switch (status) {
    case "pending":
      return {
        label: "Pending",
        cls: "border-amber-400/30 bg-amber-400/10 text-amber-300",
        icon: Hourglass,
      };
    case "in_progress":
      return {
        label: "Sedang Diperbaiki",
        cls: "border-sky-400/30 bg-sky-400/10 text-sky-300",
        icon: Wrench,
      };
    case "resolved":
      return {
        label: "Selesai",
        cls: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
        icon: CheckCircle,
      };
    default:
      return {
        label: status,
        cls: "border-slate-700 bg-slate-800 text-slate-300",
        icon: Clock,
      };
  }
}

function typeBadge(type: string) {
  switch (type) {
    case "broken_scraper":
      return { label: "Scraper Error", cls: "bg-rose-500/10 text-rose-300 border-rose-500/20" };
    case "broken_chapter":
      return { label: "Chapter Rusak", cls: "bg-amber-500/10 text-amber-300 border-amber-500/20" };
    case "app_bug":
      return { label: "Bug Aplikasi", cls: "bg-purple-500/10 text-purple-300 border-purple-500/20" };
    default:
      return { label: "Feedback User", cls: "bg-sky-500/10 text-sky-300 border-sky-500/20" };
  }
}

export default function ReportPages() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [adminNotesDraft, setAdminNotesDraft] = useState("");
  const [updating, setUpdating] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "REPORTS"),
      (snapshot) => {
        const items: ReportItem[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          items.push({
            id: d.id,
            type: data.type || "app_bug",
            extensionId: data.extensionId || "",
            comicTitle: data.comicTitle || "",
            chapterNumber: data.chapterNumber || "",
            message: data.message || "",
            userEmail: data.userEmail || "",
            uid: data.uid || "",
            appVersion: data.appVersion || "1.0.0",
            deviceInfo: data.deviceInfo,
            status: data.status === "in_progress" || data.status === "resolved" ? data.status : "pending",
            adminNotes: data.adminNotes || "",
            createdAt: data.createdAt || new Date().toISOString(),
          });
        });

        // Urutkan berdasarkan waktu pembuatan terbaru
        items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setReports(items);
        setLoading(false);
      },
      (err) => {
        console.error("Error listening to REPORTS:", err);
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

  const filteredReports = useMemo(() => {
    const term = search.trim().toLowerCase();
    return reports.filter((item) => {
      const matchSearch =
        !term ||
        item.message.toLowerCase().includes(term) ||
        (item.comicTitle && item.comicTitle.toLowerCase().includes(term)) ||
        (item.extensionId && item.extensionId.toLowerCase().includes(term)) ||
        (item.userEmail && item.userEmail.toLowerCase().includes(term));

      const matchStatus = statusFilter === "all" || item.status === statusFilter;
      const matchType = typeFilter === "all" || item.type === typeFilter;
      return matchSearch && matchStatus && matchType;
    });
  }, [reports, search, statusFilter, typeFilter]);

  const pendingCount = reports.filter((r) => r.status === "pending").length;
  const inProgressCount = reports.filter((r) => r.status === "in_progress").length;
  const resolvedCount = reports.filter((r) => r.status === "resolved").length;

  async function updateReportStatus(reportId: string, newStatus: ReportItem["status"], notes?: string) {
    setUpdating(true);
    try {
      await updateDoc(doc(db, "REPORTS", reportId), {
        status: newStatus,
        ...(notes !== undefined ? { adminNotes: notes } : {}),
        updatedAt: serverTimestamp(),
      });
      await logAdminAction(
        "admin@komryuu.core",
        `Laporan ditandai: ${newStatus.toUpperCase()}`,
        `Report: ${reportId}`,
        notes ? `Catatan: ${notes}` : `Status diubah menjadi ${newStatus}`,
        "system"
      );
      setToast({ kind: "success", message: `Status laporan berhasil diubah ke ${newStatus}.` });
      if (selectedReport && selectedReport.id === reportId) {
        setSelectedReport((prev) => (prev ? { ...prev, status: newStatus, ...(notes !== undefined ? { adminNotes: notes } : {}) } : null));
      }
    } catch (e) {
      console.error(e);
      setToast({ kind: "error", message: "Gagal memperbarui status laporan." });
    } finally {
      setUpdating(false);
    }
  }

  async function deleteReport(reportId: string) {
    if (!confirm("Hapus laporan ini secara permanen?")) return;
    setUpdating(true);
    try {
      await deleteDoc(doc(db, "REPORTS", reportId));
      await logAdminAction("admin@komryuu.core", "Laporan dihapus", `Report: ${reportId}`, "Hapus laporan", "system");
      setToast({ kind: "success", message: "Laporan berhasil dihapus." });
      if (selectedReport?.id === reportId) {
        setSelectedReport(null);
      }
    } catch (e) {
      console.error(e);
      setToast({ kind: "error", message: "Gagal menghapus laporan." });
    } finally {
      setUpdating(false);
    }
  }

  return (
    <section className="min-h-full bg-[#14141e] p-4 text-white md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* HEADER */}
        <div className="mb-7">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-400">Pusat Bantuan &amp; Scraper</p>
          <h1 className="mt-2 text-3xl font-semibold">Laporan &amp; Tiket Masalah</h1>
          <p className="mt-1 text-sm text-slate-400">
            Laporan error otomatis scraper dari aplikasi Android dan aduan chapter rusak oleh pengguna.
          </p>
        </div>

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

        {/* METRICS */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-white/[0.07] bg-[#1c1c28] p-5">
            <p className="text-xs text-slate-400">Total Tiket Laporan</p>
            <p className="mt-2 text-3xl font-bold text-white">{loading ? "—" : reports.length}</p>
            <p className="mt-1 text-xs text-slate-500">Semua laporan masuk</p>
          </article>
          <article className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5">
            <p className="text-xs text-amber-300 font-medium">Perlu Penanganan (Pending)</p>
            <p className="mt-2 text-3xl font-bold text-amber-300">{loading ? "—" : pendingCount}</p>
            <p className="mt-1 text-xs text-amber-300/70">Menunggu pengecekan admin</p>
          </article>
          <article className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-5">
            <p className="text-xs text-sky-300 font-medium">Sedang Diperbaiki</p>
            <p className="mt-2 text-3xl font-bold text-sky-300">{loading ? "—" : inProgressCount}</p>
            <p className="mt-1 text-xs text-sky-300/70">Dalam investigasi scraper</p>
          </article>
          <article className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
            <p className="text-xs text-emerald-300 font-medium">Selesai / Teratasi</p>
            <p className="mt-2 text-3xl font-bold text-emerald-300">{loading ? "—" : resolvedCount}</p>
            <p className="mt-1 text-xs text-emerald-300/70">Tiket berhasil diselesaikan</p>
          </article>
        </div>

        {/* CONTROLS */}
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-[#1c1c28] p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1">
            {[
              { id: "all", label: "Semua Status" },
              { id: "pending", label: `Pending (${pendingCount})` },
              { id: "in_progress", label: `Diperbaiki (${inProgressCount})` },
              { id: "resolved", label: `Selesai (${resolvedCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as StatusFilter)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  statusFilter === tab.id
                    ? "bg-indigo-600 text-white font-semibold"
                    : "text-slate-400 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-xl border border-white/[0.08] bg-[#14141e] px-3 py-2 text-xs text-slate-300 outline-none"
            >
              <option value="all">Semua Tipe Masalah</option>
              <option value="broken_scraper">Scraper Error</option>
              <option value="broken_chapter">Chapter Rusak</option>
              <option value="app_bug">Bug Aplikasi</option>
              <option value="feedback">Feedback User</option>
            </select>

            <div className="relative w-full sm:w-64">
              <MagnifyingGlass size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari komik, ekstensi, pesan..."
                className="w-full rounded-xl border border-white/[0.08] bg-[#14141e] py-2 pl-9 pr-3 text-xs text-white outline-none placeholder:text-slate-500 focus:border-indigo-500 transition"
              />
            </div>
          </div>
        </div>

        {/* LIST / TABLE */}
        {loading ? (
          <div className="rounded-2xl border border-white/[0.07] bg-[#1c1c28] py-16 text-center text-sm text-slate-400">
            Memuat daftar laporan...
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.07] bg-[#1c1c28] py-16 text-center text-sm text-slate-400">
            {reports.length ? "Tidak ada tiket yang cocok dengan kriteria filter." : "Belum ada laporan atau tiket error masuk."}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReports.map((report) => {
              const status = statusBadge(report.status);
              const type = typeBadge(report.type);
              return (
                <div
                  key={report.id}
                  className="rounded-2xl border border-white/[0.07] bg-[#1c1c28] p-5 transition hover:border-indigo-500/30"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${type.cls}`}>
                        {type.label}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${status.cls}`}>
                        <status.icon size={12} />
                        {status.label}
                      </span>
                      {report.extensionId && (
                        <span className="rounded bg-white/[0.05] px-2 py-0.5 text-[10px] font-mono text-indigo-300">
                          ext: {report.extensionId}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 font-mono">
                      {new Date(report.createdAt).toLocaleString("id-ID")}
                    </span>
                  </div>

                  {/* Body Content */}
                  <div className="mt-3">
                    {report.comicTitle && (
                      <p className="text-sm font-semibold text-white">
                        {report.comicTitle} {report.chapterNumber ? `• Chapter ${report.chapterNumber}` : ""}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-slate-300 leading-relaxed bg-[#14141e] p-3 rounded-xl border border-white/[0.04]">
                      {report.message}
                    </p>
                  </div>

                  {/* Footer & Actions */}
                  <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-white/[0.06] pt-3 text-xs">
                    <div className="text-slate-400 text-[11px]">
                      Pengirim: <strong>{report.userEmail || report.uid || "Anonim (Android)"}</strong> • App v{report.appVersion}
                      {report.adminNotes && (
                        <span className="block mt-1 text-emerald-300">
                          Catatan Admin: {report.adminNotes}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedReport(report);
                          setAdminNotesDraft(report.adminNotes || "");
                        }}
                        className="rounded-lg border border-white/[0.09] bg-[#14141e] px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-white/[0.05] transition"
                      >
                        Detail &amp; Tanggapi
                      </button>

                      {report.status !== "resolved" && (
                        <button
                          type="button"
                          onClick={() => void updateReportStatus(report.id, "resolved")}
                          className="rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30 transition"
                        >
                          Tandai Selesai
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => void deleteReport(report.id)}
                        className="rounded-lg border border-white/[0.08] p-1.5 text-slate-400 hover:text-rose-400 hover:border-rose-400/40 transition"
                        title="Hapus laporan"
                      >
                        <Trash size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* MODAL DETAIL & TANGGAPAN ADMIN */}
        {selectedReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-white/[0.09] bg-[#1c1c28] p-6 shadow-2xl">
              <div className="flex items-start justify-between border-b border-white/[0.07] pb-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Tanggapi Laporan Tiket</h3>
                  <p className="text-xs text-slate-400">ID: {selectedReport.id}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  className="rounded-lg p-1 text-slate-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <span className="text-slate-400">Pesan Pengguna:</span>
                  <p className="mt-1 rounded-xl bg-[#14141e] p-3 text-slate-200 border border-white/[0.05]">
                    {selectedReport.message}
                  </p>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium">Ubah Status</label>
                  <div className="mt-1.5 flex gap-2">
                    {(["pending", "in_progress", "resolved"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void updateReportStatus(selectedReport.id, s, adminNotesDraft)}
                        disabled={updating}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize border transition ${
                          selectedReport.status === s
                            ? "bg-indigo-600 border-indigo-500 text-white"
                            : "border-white/[0.08] text-slate-400 hover:text-white"
                        }`}
                      >
                        {s.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium">Catatan Admin (Solusi / Investigasi)</label>
                  <textarea
                    rows={3}
                    value={adminNotesDraft}
                    onChange={(e) => setAdminNotesDraft(e.target.value)}
                    placeholder="Contoh: Link scraper sudah diperbaiki di commit v1.2.1."
                    className="mt-1.5 w-full rounded-xl border border-white/[0.09] bg-[#14141e] p-3 text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-2 border-t border-white/[0.07]">
                <button
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  className="rounded-lg border border-white/[0.08] px-4 py-2 text-xs text-slate-300 hover:bg-white/[0.05]"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => void updateReportStatus(selectedReport.id, selectedReport.status, adminNotesDraft)}
                  disabled={updating}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-50"
                >
                  {updating ? "Menyimpan..." : "Simpan Catatan"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

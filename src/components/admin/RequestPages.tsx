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
import { db } from "@/lib/firebase";
import { recordAdminActivity } from "@/lib/admin-activity";
import {
  AlertCircle,
  ArrowUp,
  Check,
  CheckCircle2,
  Clock,
  Filter,
  Layers,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  ThumbsUp,
  Trash,
  Wrench,
  X,
} from "lucide-react";

export interface FeatureRequestItem {
  id: string;
  title: string;
  type: "extension" | "feature";
  description: string;
  createdByUid: string;
  createdByName: string;
  upvotes: string[];
  status: "open" | "planned" | "completed";
  adminNote?: string;
  createdAt: string;
  updatedAt?: unknown;
}

export default function RequestPages() {
  const [requests, setRequests] = useState<FeatureRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<"all" | "extension" | "feature">("all");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "open" | "planned" | "completed">("all");
  const [sortBy, setSortBy] = useState<"popular" | "newest">("popular");

  // Status edit modal state
  const [editModalItem, setEditModalItem] = useState<FeatureRequestItem | null>(null);
  const [editStatus, setEditStatus] = useState<"open" | "planned" | "completed">("open");
  const [editAdminNote, setEditAdminNote] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  // Delete modal state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const q = query(collection(db, "FEATURE_REQUESTS"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: FeatureRequestItem[] = snapshot.docs.map((docItem) => {
          const d = docItem.data();
          const rawUpvotes = Array.isArray(d.upvotes) ? d.upvotes : [];
          const upvotes = rawUpvotes.filter((u): u is string => typeof u === "string");

          return {
            id: docItem.id,
            title: typeof d.title === "string" ? d.title : "Tanpa Judul",
            type: d.type === "feature" ? "feature" : "extension",
            description: typeof d.description === "string" ? d.description : "",
            createdByUid: typeof d.createdByUid === "string" ? d.createdByUid : "",
            createdByName: typeof d.createdByName === "string" ? d.createdByName : "Pengguna Komryuu",
            upvotes,
            status: d.status === "planned" || d.status === "completed" ? d.status : "open",
            adminNote: typeof d.adminNote === "string" ? d.adminNote : "",
            createdAt: typeof d.createdAt === "string" ? d.createdAt : new Date().toISOString(),
            updatedAt: d.updatedAt,
          };
        });

        setRequests(list);
        setLoading(false);
      },
      (err) => {
        console.error("Error listening to FEATURE_REQUESTS:", err);
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

  // Filtered & sorted list
  const filteredRequests = useMemo(() => {
    let result = requests;

    if (selectedType !== "all") {
      result = result.filter((r) => r.type === selectedType);
    }

    if (selectedStatus !== "all") {
      result = result.filter((r) => r.status === selectedStatus);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.createdByName.toLowerCase().includes(q)
      );
    }

    if (sortBy === "popular") {
      return [...result].sort((a, b) => b.upvotes.length - a.upvotes.length);
    } else {
      return [...result].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
  }, [requests, selectedType, selectedStatus, searchQuery, sortBy]);

  // Statistics
  const counts = useMemo(() => {
    const total = requests.length;
    const extensions = requests.filter((r) => r.type === "extension").length;
    const features = requests.filter((r) => r.type === "feature").length;
    const open = requests.filter((r) => r.status === "open").length;
    const planned = requests.filter((r) => r.status === "planned").length;
    const completed = requests.filter((r) => r.status === "completed").length;
    return { total, extensions, features, open, planned, completed };
  }, [requests]);

  // Handle Save Status
  async function handleSaveStatus() {
    if (!editModalItem) return;
    setSavingStatus(true);
    try {
      const docRef = doc(db, "FEATURE_REQUESTS", editModalItem.id);
      await updateDoc(docRef, {
        status: editStatus,
        adminNote: editAdminNote.trim(),
        updatedAt: serverTimestamp(),
      });

      try {
        await recordAdminActivity(
          "Status Request Diperbarui",
          `Request ${editModalItem.id} ("${editModalItem.title}") diubah ke status: ${editStatus.toUpperCase()}`,
          editModalItem.id
        );
      } catch (logErr) {
        console.error("Audit log failed for request update", logErr);
      }

      setToast({ kind: "success", message: "Status request berhasil diperbarui." });
      setEditModalItem(null);
    } catch (err) {
      console.error("Failed to update request status", err);
      setToast({ kind: "error", message: "Gagal memperbarui status request." });
    } finally {
      setSavingStatus(false);
    }
  }

  // Handle Delete Request
  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const docRef = doc(db, "FEATURE_REQUESTS", deleteId);
      await deleteDoc(docRef);

      try {
        await recordAdminActivity("Request Dihapus", `Request ID ${deleteId} dihapus oleh Admin`, deleteId);
      } catch (logErr) {
        console.error("Audit log failed for delete request", logErr);
      }

      setToast({ kind: "success", message: "Request berhasil dihapus." });
      setDeleteId(null);
    } catch (err) {
      console.error("Failed to delete request", err);
      setToast({ kind: "error", message: "Gagal menghapus request." });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white">Request Ekstensi &amp; Voting</h1>
            <span className="rounded-full bg-purple-500/20 px-2.5 py-0.5 text-xs font-semibold text-purple-300 border border-purple-500/30">
              {counts.total} Request
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Kelola aspirasi pengguna terkait penambahan sumber ekstensi komik dan fitur baru aplikasi.
          </p>
        </div>
      </div>

      {toast && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm shadow-lg ${
            toast.kind === "error"
              ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
              : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-white/[0.08] bg-[#1c1c28] p-4">
          <p className="text-xs text-slate-400">Total Request</p>
          <p className="mt-1 text-2xl font-bold text-white">{counts.total}</p>
          <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500">
            <span>{counts.extensions} Ekstensi</span>
            <span>•</span>
            <span>{counts.features} Fitur</span>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-xs text-amber-300">Menunggu (Open)</p>
          <p className="mt-1 text-2xl font-bold text-amber-200">{counts.open}</p>
          <p className="mt-2 text-[10px] text-amber-400/80">Belum diputuskan</p>
        </div>

        <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4">
          <p className="text-xs text-indigo-300">Direncanakan</p>
          <p className="mt-1 text-2xl font-bold text-indigo-200">{counts.planned}</p>
          <p className="mt-2 text-[10px] text-indigo-400/80">Dalam roadmap rilis</p>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-xs text-emerald-300">Selesai (Completed)</p>
          <p className="mt-1 text-2xl font-bold text-emerald-200">{counts.completed}</p>
          <p className="mt-2 text-[10px] text-emerald-400/80">Sudah diimplementasikan</p>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status & Type Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Type Filter */}
          <div className="flex rounded-xl border border-white/[0.08] bg-[#1c1c28] p-1 text-xs">
            <button
              type="button"
              onClick={() => setSelectedType("all")}
              className={`rounded-lg px-3 py-1 font-semibold transition ${
                selectedType === "all" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Semua Tipe
            </button>
            <button
              type="button"
              onClick={() => setSelectedType("extension")}
              className={`rounded-lg px-3 py-1 font-semibold transition ${
                selectedType === "extension" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Ekstensi ({counts.extensions})
            </button>
            <button
              type="button"
              onClick={() => setSelectedType("feature")}
              className={`rounded-lg px-3 py-1 font-semibold transition ${
                selectedType === "feature" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Fitur ({counts.features})
            </button>
          </div>

          {/* Status Filter */}
          <div className="flex rounded-xl border border-white/[0.08] bg-[#1c1c28] p-1 text-xs">
            <button
              type="button"
              onClick={() => setSelectedStatus("all")}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                selectedStatus === "all" ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus("open")}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                selectedStatus === "open" ? "bg-amber-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Open
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus("planned")}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                selectedStatus === "planned" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Planned
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus("completed")}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                selectedStatus === "completed" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Done
            </button>
          </div>
        </div>

        {/* Sort & Search */}
        <div className="flex items-center gap-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "popular" | "newest")}
            className="rounded-xl border border-white/10 bg-[#1c1c28] px-3 py-2 text-xs text-white outline-none"
          >
            <option value="popular">Terbanyak Di-Vote</option>
            <option value="newest">Terbaru Diajukan</option>
          </select>

          <div className="relative w-full sm:w-60">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari request..."
              className="w-full rounded-xl border border-white/10 bg-[#1c1c28] py-2 pl-8 pr-3 text-xs text-white outline-none placeholder:text-slate-500 focus:border-indigo-500 transition"
            />
          </div>
        </div>
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={32} className="animate-spin text-indigo-500" />
        </div>
      ) : filteredRequests.length > 0 ? (
        <div className="space-y-3">
          {filteredRequests.map((req) => (
            <div
              key={req.id}
              className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 rounded-2xl border border-white/[0.08] bg-[#1c1c28] p-5 transition hover:border-indigo-500/30"
            >
              <div className="flex items-start gap-4">
                {/* Vote Counter Badge */}
                <div className="flex h-14 w-14 flex-shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-purple-500/20 to-indigo-500/10 border border-purple-500/30 text-purple-300">
                  <ArrowUp size={16} />
                  <span className="text-sm font-extrabold text-white mt-0.5">{req.upvotes.length}</span>
                  <span className="text-[9px] uppercase tracking-wider text-slate-400">vote</span>
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    {/* Type Badge */}
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-semibold border ${
                        req.type === "extension"
                          ? "bg-purple-500/10 text-purple-300 border-purple-500/30"
                          : "bg-indigo-500/10 text-indigo-300 border-indigo-500/30"
                      }`}
                    >
                      {req.type === "extension" ? "Ekstensi Komik" : "Fitur Baru"}
                    </span>

                    {/* Status Badge */}
                    {req.status === "completed" ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                        <CheckCircle2 size={11} /> Selesai
                      </span>
                    ) : req.status === "planned" ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-300">
                        <Wrench size={11} /> Direncanakan
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-300">
                        <Clock size={11} /> Open
                      </span>
                    )}

                    <span className="text-[11px] text-slate-500">•</span>
                    <span className="text-[11px] text-slate-400">
                      Oleh <strong>{req.createdByName}</strong>
                    </span>
                    <span className="text-[11px] text-slate-500">•</span>
                    <span className="text-[11px] text-slate-500">
                      {new Date(req.createdAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-white">{req.title}</h3>
                  <p className="mt-1.5 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap max-w-2xl">
                    {req.description}
                  </p>

                  {/* Admin Note if Present */}
                  {req.adminNote && (
                    <div className="mt-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3 text-xs text-indigo-200 max-w-2xl">
                      <strong className="block text-[11px] text-indigo-400 mb-0.5">Catatan Tim Pengembang:</strong>
                      <p>{req.adminNote}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex sm:flex-col items-center sm:items-end gap-2 flex-shrink-0 pt-2 sm:pt-0">
                <button
                  type="button"
                  onClick={() => {
                    setEditModalItem(req);
                    setEditStatus(req.status);
                    setEditAdminNote(req.adminNote || "");
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/20 transition"
                >
                  <Wrench size={13} />
                  <span>Kelola Status</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteId(req.id)}
                  className="rounded-lg border border-rose-500/20 p-1.5 text-rose-400 hover:bg-rose-500/10 transition"
                  title="Hapus request"
                >
                  <Trash size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-white/[0.08] bg-[#1c1c28]/40 py-20 text-center">
          <MessageSquare size={40} className="mx-auto text-slate-600 mb-3" />
          <p className="text-base font-semibold text-slate-300">
            {searchQuery ? "Tidak ada request yang cocok" : "Belum Ada Request Pengguna"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Request baru yang diajukan pengunjung atau pengguna web akan muncul di sini.
          </p>
        </div>
      )}

      {/* Edit Status Modal */}
      {editModalItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#1c1c28] p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white">Perbarui Status Request</h3>
            <p className="mt-1 text-xs text-slate-400 truncate">
              {editModalItem.title}
            </p>

            <div className="my-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">Pilih Status Baru:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditStatus("open")}
                    className={`rounded-xl border p-2.5 font-semibold transition ${
                      editStatus === "open"
                        ? "border-amber-500 bg-amber-500/15 text-amber-200"
                        : "border-white/10 bg-[#14141E] text-slate-400"
                    }`}
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditStatus("planned")}
                    className={`rounded-xl border p-2.5 font-semibold transition ${
                      editStatus === "planned"
                        ? "border-indigo-500 bg-indigo-500/15 text-indigo-200"
                        : "border-white/10 bg-[#14141E] text-slate-400"
                    }`}
                  >
                    Planned
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditStatus("completed")}
                    className={`rounded-xl border p-2.5 font-semibold transition ${
                      editStatus === "completed"
                        ? "border-emerald-500 bg-emerald-500/15 text-emerald-200"
                        : "border-white/10 bg-[#14141E] text-slate-400"
                    }`}
                  >
                    Completed
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Catatan Admin / Pengembang:
                </label>
                <textarea
                  rows={3}
                  value={editAdminNote}
                  onChange={(e) => setEditAdminNote(e.target.value)}
                  placeholder="Contoh: Rilis pada update v1.3.0 minggu depan / Sudah ditambahkan ke scraper."
                  className="w-full rounded-xl border border-white/10 bg-[#14141E] p-3 text-xs text-white outline-none focus:border-indigo-500 transition"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-white/[0.08] pt-4">
              <button
                type="button"
                disabled={savingStatus}
                onClick={() => setEditModalItem(null)}
                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.06] transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={savingStatus}
                onClick={handleSaveStatus}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-50 transition"
              >
                {savingStatus ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                <span>{savingStatus ? "Menyimpan..." : "Simpan Status"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-[#1c1c28] p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white">Hapus Request Ini?</h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Tindakan ini tidak dapat dibatalkan. Request dan seluruh riwayat upvotes akan dihapus permanen.
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteId(null)}
                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.06] transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50 transition"
              >
                {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash size={13} />}
                <span>{deleting ? "Menghapus..." : "Hapus Request"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

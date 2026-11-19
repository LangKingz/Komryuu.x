"use client";

import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import {
  Copy,
  Devices,
  ShieldWarning,
  Trash,
  UserCircle,
  UserMinus,
  UserPlus,
  X,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { recordAdminActivity } from "@/lib/admin-activity";

type FilterType = "all" | "active" | "banned" | "admin";
type ModalType = "ban" | "delete" | "role" | "reason" | null;

type UserRecord = {
  id: string;
  uid: string;
  name: string;
  email: string;
  photoUrl: string;
  provider: string;
  role: "user" | "admin";
  isBanned: boolean;
  banReason: string;
  bannedAt: unknown;
  deviceInfo: {
    platform: string;
    appVersion: string;
    deviceModel: string;
  };
  createdAt: unknown;
  lastLoginAt: unknown;
};

function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (value && typeof value === "object" && "toDate" in value) {
    const toDate = (value as { toDate?: unknown }).toDate;
    if (typeof toDate === "function") {
      const date = toDate.call(value);
      if (date instanceof Date && !Number.isNaN(date.getTime())) return date;
    }
  }
  return null;
}

function toUser(id: string, data: Record<string, unknown>): UserRecord {
  const device =
    data.deviceInfo && typeof data.deviceInfo === "object"
      ? (data.deviceInfo as Record<string, unknown>)
      : {};
  return {
    id,
    uid: toText(data.uid) || id,
    name: toText(data.name),
    email: toText(data.email),
    photoUrl: toText(data.photoUrl),
    provider: toText(data.provider).toLowerCase() || "guest",
    role: data.role === "admin" ? "admin" : "user",
    isBanned: data.isBanned === true,
    banReason: toText(data.banReason),
    bannedAt: data.bannedAt,
    deviceInfo: {
      platform: toText(device.platform),
      appVersion: toText(device.appVersion),
      deviceModel: toText(device.deviceModel),
    },
    createdAt: data.createdAt,
    lastLoginAt: data.lastLoginAt,
  };
}

function relativeTime(value: unknown): string {
  const date = parseDate(value);
  if (!date) return "Belum pernah login";

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Baru saja";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hari lalu`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} minggu lalu`;
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function UserPages() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [modal, setModal] = useState<ModalType>(null);
  const [selected, setSelected] = useState<UserRecord | null>(null);
  const [banReason, setBanReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [targetRole, setTargetRole] = useState<"user" | "admin">("user");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return onSnapshot(
      collection(db, "USERS"),
      (snapshot) => {
        setUsers(snapshot.docs.map((item) => toUser(item.id, item.data())));
        setLoading(false);
        setError(null);
      },
      (snapshotError) => {
        setError(snapshotError.message);
        setToast({ kind: "error", message: "Gagal memuat data pengguna." });
        setLoading(false);
      }
    );
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const now = Date.now();
  const activeToday = users.filter((user) => {
    const date = parseDate(user.lastLoginAt);
    return date ? date.getTime() >= now - 24 * 60 * 60 * 1000 : false;
  }).length;
  const newThisWeek = users.filter((user) => {
    const date = parseDate(user.createdAt);
    return date ? date.getTime() >= now - 7 * 24 * 60 * 60 * 1000 : false;
  }).length;
  const bannedCount = users.filter((user) => user.isBanned).length;

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch =
        !term ||
        user.name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        user.uid.toLowerCase().includes(term);
      const matchesFilter =
        filter === "all" ||
        (filter === "active" && !user.isBanned) ||
        (filter === "banned" && user.isBanned) ||
        (filter === "admin" && user.role === "admin");
      return matchesSearch && matchesFilter;
    });
  }, [users, search, filter]);

  async function logActivity(action: string, detail: string, userId: string) {
    try {
      await recordAdminActivity(action, detail, userId);
    } catch (logError) {
      console.error("User update succeeded but activity logging failed", logError);
    }
  }

  function openModal(type: ModalType, user: UserRecord) {
    setSelected(user);
    setModal(type);
    setBanReason("");
    setCustomReason("");
    setTargetRole(user.role);
  }

  function closeModal() {
    if (busy) return;
    setModal(null);
    setSelected(null);
  }

  async function copyUid(uid: string) {
    try {
      await navigator.clipboard.writeText(uid);
      setToast({ kind: "success", message: "UID berhasil disalin." });
    } catch {
      setToast({ kind: "error", message: "Gagal menyalin UID." });
    }
  }

  async function banUser() {
    if (!selected) return;
    const reason = (customReason.trim() || banReason).trim();
    if (!reason) {
      setToast({ kind: "error", message: "Alasan banned wajib diisi." });
      return;
    }
    setBusy(true);
    try {
      await updateDoc(doc(db, "USERS", selected.id), {
        isBanned: true,
        banReason: reason,
        bannedAt: serverTimestamp(),
      });
      await logActivity("Pengguna dibanned", `${selected.name || selected.email}: ${reason}`, selected.id);
      setToast({ kind: "success", message: "Pengguna berhasil dibanned." });
      closeModal();
    } catch (operationError) {
      setToast({
        kind: "error",
        message: operationError instanceof Error ? operationError.message : "Gagal membanned pengguna.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function unbanUser(user: UserRecord) {
    setBusy(true);
    try {
      await updateDoc(doc(db, "USERS", user.id), {
        isBanned: false,
        banReason: "",
        bannedAt: null,
      });
      await logActivity("Pengguna dipulihkan", user.name || user.email, user.id);
      setToast({ kind: "success", message: "Pengguna berhasil dipulihkan." });
    } catch (operationError) {
      setToast({
        kind: "error",
        message: operationError instanceof Error ? operationError.message : "Gagal memulihkan pengguna.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function changeRole() {
    if (!selected) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, "USERS", selected.id), { role: targetRole });
      await logActivity("Role pengguna diubah", `${selected.name || selected.email} menjadi ${targetRole}`, selected.id);
      setToast({ kind: "success", message: `Role berhasil diubah menjadi ${targetRole}.` });
      closeModal();
    } catch (operationError) {
      setToast({
        kind: "error",
        message: operationError instanceof Error ? operationError.message : "Gagal mengubah role.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function deleteUser() {
    if (!selected) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, "USERS", selected.id));
      await logActivity("Data pengguna dihapus", selected.name || selected.email, selected.id);
      setToast({ kind: "success", message: "Data pengguna berhasil dihapus." });
      closeModal();
    } catch (operationError) {
      setToast({
        kind: "error",
        message: operationError instanceof Error ? operationError.message : "Gagal menghapus data pengguna.",
      });
    } finally {
      setBusy(false);
    }
  }

  const filterTabs: Array<{ value: FilterType; label: string }> = [
    { value: "all", label: "Semua User" },
    { value: "active", label: "Aktif" },
    { value: "banned", label: "Dibanned" },
    { value: "admin", label: "Admin" },
  ];

  return (
    <section className="min-h-full bg-[#14141e] p-4 text-white md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-400">Monitoring</p>
          <h1 className="mt-2 text-3xl font-semibold">Pengguna</h1>
          <p className="mt-2 text-sm text-slate-400">Data sinkron langsung dari koleksi USERS.</p>
        </header>

        {toast && (
          <div
            role={toast.kind === "error" ? "alert" : "status"}
            className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
              toast.kind === "error"
                ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
                : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
            }`}
          >
            {toast.message}
          </div>
        )}
        {error && (
          <div role="alert" className="mb-5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            {error}
          </div>
        )}

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total Pengguna", value: users.length, icon: UserCircle, color: "text-sky-300", bg: "bg-sky-400/10" },
            { label: "Aktif Hari Ini", value: activeToday, icon: UserPlus, color: "text-emerald-300", bg: "bg-emerald-400/10" },
            { label: "Pengguna Baru (7 Hari)", value: newThisWeek, icon: Devices, color: "text-violet-300", bg: "bg-violet-400/10" },
            { label: "Total Akun Dibanned", value: bannedCount, icon: ShieldWarning, color: "text-rose-300", bg: "bg-rose-400/10" },
          ].map((stat) => (
            <article key={stat.label} className="rounded-2xl border border-white/[0.07] bg-[#1b1b28] p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-400">{stat.label}</p>
                  <p className="mt-3 text-3xl font-semibold">{loading ? "—" : stat.value}</p>
                </div>
                <span className={`rounded-xl p-2.5 ${stat.bg} ${stat.color}`}>
                  <stat.icon size={20} weight="duotone" />
                </span>
              </div>
            </article>
          ))}
        </div>

        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-[#1b1b28] p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1">
            {filterTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setFilter(tab.value)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  filter === tab.value
                    ? "bg-sky-500 text-slate-950"
                    : "text-slate-400 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari nama, email, atau UID"
            aria-label="Cari pengguna"
            className="w-full rounded-xl border border-white/[0.08] bg-[#14141e] px-4 py-2.5 text-sm outline-none placeholder:text-slate-500 focus:border-sky-500 lg:max-w-sm"
          />
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/[0.07] bg-[#1b1b28] py-16 text-center text-slate-300">Memuat pengguna...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.07] bg-[#1b1b28] py-16 text-center text-slate-400">
            {users.length ? "Tidak ada pengguna yang cocok." : "Belum ada data pengguna."}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#1b1b28]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left">
                <thead className="border-b border-white/[0.07] bg-white/[0.02] text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Pengguna</th>
                    <th className="px-5 py-4">Perangkat</th>
                    <th className="px-5 py-4">Login Terakhir</th>
                    <th className="px-5 py-4">Role</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="transition hover:bg-white/[0.025]">
                      <td className="px-5 py-4">
                        <div className="flex min-w-[230px] items-center gap-3">
                          {user.photoUrl ? (
                            <img src={user.photoUrl} alt="" className="h-10 w-10 rounded-full border border-white/10 object-cover" />
                          ) : (
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 text-slate-300">
                              <UserCircle size={24} weight="duotone" />
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium">{user.name || "Tanpa nama"}</p>
                            <p className="mt-0.5 truncate text-sm text-slate-400">{user.email || "-"}</p>
                            <button
                              type="button"
                              onClick={() => void copyUid(user.uid)}
                              className="mt-1 flex items-center gap-1 text-[11px] text-slate-500 hover:text-sky-300"
                              title={user.uid}
                            >
                              <span className="max-w-[180px] truncate">{user.uid}</span>
                              <Copy size={12} />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                            user.provider === "google"
                              ? "bg-sky-400/10 text-sky-300"
                              : "bg-slate-700/70 text-slate-300"
                          }`}>
                            {user.provider === "google" ? "Google" : "Guest"}
                          </span>
                        </div>
                        <p className="mt-2 max-w-[170px] truncate text-xs text-slate-400">
                          {user.deviceInfo.appVersion || "Versi -"} / {user.deviceInfo.deviceModel || "Perangkat -"}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-300">
                        {relativeTime(user.lastLoginAt)}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => openModal("role", user)}
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            user.role === "admin"
                              ? "bg-violet-400/10 text-violet-300"
                              : "bg-slate-700/70 text-slate-300"
                          }`}
                        >
                          {user.role === "admin" ? "Admin" : "User"}
                        </button>
                      </td>
                      <td className="px-5 py-4">
                        {user.isBanned ? (
                          <button
                            type="button"
                            onClick={() => openModal("reason", user)}
                            className="rounded-full bg-rose-400/10 px-2.5 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-400/20"
                          >
                            Banned
                          </button>
                        ) : (
                          <span className="inline-flex rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                            Aktif
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          {user.isBanned ? (
                            <button
                              type="button"
                              onClick={() => void unbanUser(user)}
                              disabled={busy}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/20 px-3 py-2 text-xs font-medium text-emerald-300 transition hover:bg-emerald-400/10 disabled:opacity-50"
                            >
                              <UserPlus size={15} weight="bold" />
                              Unban
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openModal("ban", user)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/20 px-3 py-2 text-xs font-medium text-amber-300 transition hover:bg-amber-400/10"
                            >
                              <UserMinus size={15} weight="bold" />
                              Ban
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openModal("delete", user)}
                            aria-label={`Hapus ${user.email}`}
                            className="rounded-lg border border-white/[0.08] p-2 text-slate-400 transition hover:border-rose-400/40 hover:text-rose-300"
                          >
                            <Trash size={16} />
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

        {modal && selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="presentation">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="user-action-title"
              className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/[0.09] bg-[#1b1b28] p-5 shadow-2xl sm:p-6"
            >
              <header className="mb-5 flex items-start justify-between">
                <div>
                  <h2 id="user-action-title" className="text-xl font-semibold">
                    {modal === "ban" && "Banned Pengguna"}
                    {modal === "delete" && "Hapus Data Pengguna"}
                    {modal === "role" && "Ubah Role Pengguna"}
                    {modal === "reason" && "Alasan Banned"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">{selected.name || selected.email}</p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={busy}
                  aria-label="Tutup modal"
                  className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.06] hover:text-white"
                >
                  <X size={20} />
                </button>
              </header>

              {modal === "ban" && (
                <div className="space-y-4">
                  <label className="block text-sm text-slate-300">
                    Pilih alasan
                    <select
                      value={banReason}
                      onChange={(event) => setBanReason(event.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-white/[0.09] bg-[#14141e] px-3 py-2.5 outline-none focus:border-amber-400"
                    >
                      <option value="">Pilih alasan...</option>
                      <option value="Spamming API">Spamming API</option>
                      <option value="Pelanggaran Ketentuan">Pelanggaran Ketentuan</option>
                    </select>
                  </label>
                  <label className="block text-sm text-slate-300">
                    Alasan kustom
                    <input
                      value={customReason}
                      onChange={(event) => setCustomReason(event.target.value)}
                      placeholder="Masukkan alasan lainnya"
                      className="mt-1.5 w-full rounded-lg border border-white/[0.09] bg-[#14141e] px-3 py-2.5 outline-none placeholder:text-slate-600 focus:border-amber-400"
                    />
                  </label>
                  <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={closeModal} disabled={busy} className="rounded-lg border border-white/[0.09] px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.05]">
                      Batal
                    </button>
                    <button type="button" onClick={() => void banUser()} disabled={busy} className="rounded-lg bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-400 disabled:opacity-50">
                      {busy ? "Memproses..." : "Konfirmasi Ban"}
                    </button>
                  </div>
                </div>
              )}

              {modal === "delete" && (
                <div>
                  <p className="text-sm leading-6 text-slate-300">
                    Tindakan ini akan menghapus dokumen pengguna dari Firestore secara permanen dan tidak dapat dibatalkan.
                  </p>
                  <div className="mt-5 flex justify-end gap-3">
                    <button type="button" onClick={closeModal} disabled={busy} className="rounded-lg border border-white/[0.09] px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.05]">
                      Batal
                    </button>
                    <button type="button" onClick={() => void deleteUser()} disabled={busy} className="rounded-lg bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-400 disabled:opacity-50">
                      {busy ? "Menghapus..." : "Hapus Permanen"}
                    </button>
                  </div>
                </div>
              )}

              {modal === "role" && (
                <div className="space-y-4">
                  <label className="block text-sm text-slate-300">
                    Role
                    <select
                      value={targetRole}
                      onChange={(event) => setTargetRole(event.target.value as "user" | "admin")}
                      className="mt-1.5 w-full rounded-lg border border-white/[0.09] bg-[#14141e] px-3 py-2.5 outline-none focus:border-violet-400"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>
                  <div className="flex justify-end gap-3">
                    <button type="button" onClick={closeModal} disabled={busy} className="rounded-lg border border-white/[0.09] px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.05]">
                      Batal
                    </button>
                    <button type="button" onClick={() => void changeRole()} disabled={busy} className="rounded-lg bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-400 disabled:opacity-50">
                      {busy ? "Memproses..." : "Simpan Role"}
                    </button>
                  </div>
                </div>
              )}

              {modal === "reason" && (
                <div>
                  <div className="rounded-xl border border-rose-400/20 bg-rose-400/[0.07] p-4">
                    <div className="flex items-center gap-2 text-rose-300">
                      <ShieldWarning size={18} weight="duotone" />
                      <p className="text-sm font-semibold">Akun dibanned</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-300">{selected.banReason || "Tidak ada alasan tercatat."}</p>
                    {parseDate(selected.bannedAt) && (
                      <p className="mt-3 text-xs text-slate-500">
                        {parseDate(selected.bannedAt)?.toLocaleString("id-ID")}
                      </p>
                    )}
                  </div>
                  <div className="mt-5 flex justify-end">
                    <button type="button" onClick={closeModal} className="rounded-lg border border-white/[0.09] px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.05]">
                      Tutup
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </section>
  );
}

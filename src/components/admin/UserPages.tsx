"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { PencilSimple, Plus, Trash, X } from "@phosphor-icons/react";
import { FormEvent, useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { recordAdminActivity } from "@/lib/admin-activity";

const PASSWORD_ITERATIONS = 310000;

type UserStatus = "active" | "inactive";

type UserRecord = {
  id: string;
  email: string;
  name: string;
  status: UserStatus;
  createdAt: string;
};

type UserForm = {
  email: string;
  name: string;
  password: string;
  status: UserStatus;
};

const emptyForm: UserForm = {
  email: "",
  name: "",
  password: "",
  status: "active",
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function toUser(id: string, data: Record<string, unknown>): UserRecord {
  return {
    id,
    email: typeof data.email === "string" ? data.email : "",
    name: typeof data.name === "string" ? data.name : "",
    status: data.status === "inactive" ? "inactive" : "active",
    createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
  };
}

async function hashPassword(password: string) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = Array.from(saltBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: PASSWORD_ITERATIONS,
      hash: "SHA-256",
    },
    key,
    512
  );
  const passwordHash = Array.from(new Uint8Array(derivedBits), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");

  return {
    salt,
    passwordHash,
    passwordAlgorithm: "pbkdf2-sha256",
    passwordIterations: PASSWORD_ITERATIONS,
  };
}

export default function UserPages() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [editing, setEditing] = useState<UserRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [search, setSearch] = useState("");

  useEffect(() => {
    return onSnapshot(
      collection(db, "users"),
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

  function openCreateForm() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEditForm(user: UserRecord) {
    setEditing(user);
    setForm({
      email: user.email,
      name: user.name,
      password: "",
      status: user.status,
    });
    setFormOpen(true);
  }

  async function ensureUniqueEmail(email: string, currentId?: string) {
    const result = await getDocs(
      query(collection(db, "users"), where("email", "==", email))
    );
    return result.docs.every((item) => item.id === currentId);
  }

  async function logActivity(action: string, detail: string, userId: string) {
    try {
      await recordAdminActivity(action, detail, userId);
    } catch (logError) {
      console.error("User data was saved but its activity log failed", logError);
      setToast({ kind: "error", message: "Data tersimpan, tetapi log aktivitas gagal disimpan." });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = form.email.trim().toLowerCase();
    const name = form.name.trim();

    if (!isValidEmail(email)) {
      setToast({ kind: "error", message: "Masukkan alamat email yang valid." });
      return;
    }
    if (name.length < 1 || name.length > 100) {
      setToast({ kind: "error", message: "Nama harus berisi 1 sampai 100 karakter." });
      return;
    }
    if (!editing && (form.password.length < 8 || form.password.length > 128)) {
      setToast({ kind: "error", message: "Password baru harus berisi 8 sampai 128 karakter." });
      return;
    }
    if (editing && form.password && (form.password.length < 8 || form.password.length > 128)) {
      setToast({ kind: "error", message: "Password harus berisi 8 sampai 128 karakter." });
      return;
    }

    setSaving(true);
    try {
      if (!(await ensureUniqueEmail(email, editing?.id))) {
        setToast({ kind: "error", message: "Email sudah digunakan." });
        return;
      }

      if (editing) {
        const updates: Record<string, string | number | boolean> = {
          email,
          name,
          status: form.status,
          updatedAt: new Date().toISOString(),
        };
        if (form.password) Object.assign(updates, await hashPassword(form.password));
        await updateDoc(doc(db, "users", editing.id), updates);
        setToast({ kind: "success", message: "Data pengguna berhasil diperbarui." });
        await logActivity("Pengguna diperbarui", email, editing.id);
      } else {
        const credentials = await hashPassword(form.password);
        const reference = await addDoc(collection(db, "users"), {
          email,
          name,
          status: form.status,
          ...credentials,
          createdAt: new Date().toISOString(),
        });
        setToast({ kind: "success", message: "Pengguna berhasil ditambahkan." });
        await logActivity("Pengguna ditambahkan", email, reference.id);
      }
      setFormOpen(false);
    } catch (operationError) {
      setToast({
        kind: "error",
        message: operationError instanceof Error ? operationError.message : "Operasi pengguna gagal.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(user: UserRecord) {
    const status: UserStatus = user.status === "active" ? "inactive" : "active";
    try {
      await updateDoc(doc(db, "users", user.id), { status, updatedAt: new Date().toISOString() });
      setToast({
        kind: "success",
        message: `${user.name || user.email} sekarang ${status === "active" ? "aktif" : "nonaktif"}.`,
      });
      await logActivity(`Pengguna ${status === "active" ? "diaktifkan" : "dinonaktifkan"}`, user.email, user.id);
    } catch (operationError) {
      setToast({
        kind: "error",
        message: operationError instanceof Error ? operationError.message : "Gagal mengubah status pengguna.",
      });
    }
  }

  async function deleteUser(user: UserRecord) {
    if (!window.confirm(`Hapus pengguna "${user.name || user.email}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    setDeletingId(user.id);
    try {
      await deleteDoc(doc(db, "users", user.id));
      setToast({ kind: "success", message: "Pengguna berhasil dihapus." });
      await logActivity("Pengguna dihapus", user.email, user.id);
    } catch (operationError) {
      setToast({
        kind: "error",
        message: operationError instanceof Error ? operationError.message : "Gagal menghapus pengguna.",
      });
    } finally {
      setDeletingId(null);
    }
  }

  const filteredUsers = users.filter((user) => {
    const term = search.trim().toLowerCase();
    return !term || user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term);
  });

  return (
    <section className="min-h-full bg-slate-950 p-4 text-white md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-400">Pengelolaan</p>
            <h1 className="mt-2 text-3xl font-semibold">Pengguna</h1>
            <p className="mt-2 text-sm text-slate-400">Data tersinkron langsung dari Firestore.</p>
          </div>
          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
          >
            <Plus size={18} weight="bold" />
            Tambah pengguna
          </button>
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
        {error && <p role="alert" className="mb-5 text-sm text-rose-300">{error}</p>}

        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-400">Total pengguna</p>
            <p className="mt-1 text-2xl font-semibold">{users.length}</p>
          </div>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari nama atau email"
            aria-label="Cari pengguna"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm outline-none placeholder:text-slate-500 focus:border-sky-500 sm:max-w-sm"
          />
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 py-16 text-center text-slate-300">Memuat pengguna...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 py-16 text-center text-slate-400">
            {users.length ? "Tidak ada pengguna yang cocok." : "Belum ada data pengguna."}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead className="bg-slate-800/70 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-4">Pengguna</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Terdaftar</th>
                    <th className="px-5 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="transition hover:bg-slate-800/40">
                      <td className="px-5 py-4">
                        <p className="font-medium">{user.name || "Tanpa nama"}</p>
                        <p className="mt-1 text-sm text-slate-400">{user.email}</p>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => void toggleStatus(user)}
                          aria-label={`Ubah status ${user.email}`}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            user.status === "active"
                              ? "bg-emerald-400/10 text-emerald-300"
                              : "bg-slate-700 text-slate-300"
                          }`}
                        >
                          {user.status === "active" ? "Aktif" : "Nonaktif"}
                        </button>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-400">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "-"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditForm(user)}
                            aria-label={`Edit ${user.email}`}
                            className="rounded-lg border border-slate-700 p-2 text-slate-300 transition hover:border-sky-400 hover:text-sky-300"
                          >
                            <PencilSimple size={17} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteUser(user)}
                            disabled={deletingId === user.id}
                            aria-label={`Hapus ${user.email}`}
                            className="rounded-lg border border-slate-700 p-2 text-slate-300 transition hover:border-rose-400 hover:text-rose-300 disabled:opacity-50"
                          >
                            <Trash size={17} />
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

        {formOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="presentation">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="user-form-title"
              className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl sm:p-7"
            >
              <header className="mb-6 flex items-start justify-between">
                <div>
                  <h2 id="user-form-title" className="text-xl font-semibold">
                    {editing ? "Edit pengguna" : "Tambah pengguna"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">Password di-hash sebelum disimpan.</p>
                </div>
                <button
                  type="button"
                  aria-label="Tutup form"
                  onClick={() => setFormOpen(false)}
                  disabled={saving}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  <X size={20} />
                </button>
              </header>
              <form onSubmit={handleSubmit} className="space-y-4">
                <label className="block text-sm text-slate-300">
                  Nama
                  <input
                    required
                    maxLength={100}
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 outline-none focus:border-sky-500"
                  />
                </label>
                <label className="block text-sm text-slate-300">
                  Email
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 outline-none focus:border-sky-500"
                  />
                </label>
                <label className="block text-sm text-slate-300">
                  {editing ? "Password baru (opsional)" : "Password"}
                  <input
                    type="password"
                    autoComplete="new-password"
                    required={!editing}
                    minLength={8}
                    maxLength={128}
                    value={form.password}
                    onChange={(event) => setForm({ ...form, password: event.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 outline-none focus:border-sky-500"
                  />
                </label>
                <label className="block text-sm text-slate-300">
                  Status
                  <select
                    value={form.status}
                    onChange={(event) => setForm({ ...form, status: event.target.value as UserStatus })}
                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 outline-none focus:border-sky-500"
                  >
                    <option value="active">Aktif</option>
                    <option value="inactive">Nonaktif</option>
                  </select>
                </label>
                <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setFormOpen(false)}
                    disabled={saving}
                    className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:cursor-wait disabled:opacity-60"
                  >
                    {saving ? "Menyimpan..." : editing ? "Simpan perubahan" : "Tambah pengguna"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
      </div>
    </section>
  );
}

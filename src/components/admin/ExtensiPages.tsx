"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { PencilSimple, Plus, Trash, X } from "@phosphor-icons/react";
import { FormEvent, useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { recordAdminActivity } from "@/lib/admin-activity";

type ExtensionType = "komik" | "anime" | "cinema";

type ExtensionRecord = {
  id: string;
  name: string;
  description: string;
  logo: string;
  type: ExtensionType;
  location: string;
  BaseUrl: string;
  UrlSearch: string;
  api: string;
  nsfw: boolean;
  status: "active" | "inactive";
  createdAt: string;
};

type ExtensionForm = Omit<ExtensionRecord, "id" | "createdAt" | "status">;

const emptyForm: ExtensionForm = {
  name: "",
  description: "",
  logo: "",
  type: "komik",
  location: "",
  BaseUrl: "",
  UrlSearch: "",
  api: "",
  nsfw: false,
};

function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function toDateText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object" && "toDate" in value) {
    const toDate = value.toDate;
    if (typeof toDate === "function") {
      const date: unknown = toDate.call(value);
      if (date instanceof Date) return date.toISOString();
    }
  }
  return "";
}

function toExtension(id: string, data: Record<string, unknown>): ExtensionRecord {
  const type = data.type === "anime" || data.type === "cinema" ? data.type : "komik";
  return {
    id,
    name: toText(data.name),
    description: toText(data.description),
    logo: toText(data.logo),
    type,
    location: toText(data.location),
    BaseUrl: toText(data.BaseUrl),
    UrlSearch: toText(data.UrlSearch),
    api: toText(data.api),
    nsfw: data.nsfw === true || data.isNsfw === true,
    status: data.status === "active" || data.status === "inactive"
      ? data.status
      : data.isActive === false
        ? "inactive"
        : "active",
    createdAt: toDateText(data.createdAt),
  };
}

export default function ExtensiPages() {
  const [extensions, setExtensions] = useState<ExtensionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [editing, setEditing] = useState<ExtensionRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ExtensionForm>(emptyForm);
  const [search, setSearch] = useState("");

  useEffect(() => {
    return onSnapshot(
      collection(db, "EXTENSION"),
      (snapshot) => {
        setExtensions(snapshot.docs.map((item) => toExtension(item.id, item.data())));
        setLoading(false);
        setError(null);
      },
      (snapshotError) => {
        setError(snapshotError.message);
        setToast({ kind: "error", message: "Gagal memuat data ekstensi." });
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

  function openEditForm(extension: ExtensionRecord) {
    setEditing(extension);
    setForm({
      name: extension.name,
      description: extension.description,
      logo: extension.logo,
      type: extension.type,
      location: extension.location,
      BaseUrl: extension.BaseUrl,
      UrlSearch: extension.UrlSearch,
      api: extension.api,
      nsfw: extension.nsfw,
    });
    setFormOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      name: form.name.trim(),
      description: form.description.trim(),
      logo: form.logo.trim(),
      location: form.location.trim(),
      BaseUrl: form.BaseUrl.trim(),
      UrlSearch: form.UrlSearch.trim(),
      api: form.api.trim(),
    };
    if (!isHttpUrl(payload.logo) || !isHttpUrl(payload.BaseUrl)) {
      setToast({ kind: "error", message: "Logo dan Base URL harus menggunakan URL HTTP atau HTTPS." });
      setSaving(false);
      return;
    }

    try {
      if (editing) {
        await updateDoc(doc(db, "EXTENSION", editing.id), {
          ...payload,
          updatedAt: new Date().toISOString(),
        });
        setToast({ kind: "success", message: "Ekstensi berhasil diperbarui." });
        await logActivity("Ekstensi diperbarui", editing.name);
      } else {
        const reference = await addDoc(collection(db, "EXTENSION"), {
          ...payload,
          status: "active",
          createdAt: new Date().toISOString(),
        });
        setToast({ kind: "success", message: "Ekstensi berhasil ditambahkan." });
        await logActivity("Ekstensi ditambahkan", payload.name, reference.id);
      }
      setFormOpen(false);
    } catch (operationError) {
      setToast({
        kind: "error",
        message: operationError instanceof Error ? operationError.message : "Operasi ekstensi gagal.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(extension: ExtensionRecord) {
    if (!window.confirm(`Hapus ekstensi "${extension.name}"? Tindakan ini tidak dapat dibatalkan.`)) return;

    setDeletingId(extension.id);
    try {
      await deleteDoc(doc(db, "EXTENSION", extension.id));
      setToast({ kind: "success", message: "Ekstensi berhasil dihapus." });
      await logActivity("Ekstensi dihapus", extension.name, extension.id);
    } catch (operationError) {
      setToast({
        kind: "error",
        message: operationError instanceof Error ? operationError.message : "Gagal menghapus ekstensi.",
      });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggleStatus(extension: ExtensionRecord) {
    const status = extension.status === "active" ? "inactive" : "active";
    try {
      await updateDoc(doc(db, "EXTENSION", extension.id), {
        status,
        isActive: status === "active",
        updatedAt: new Date().toISOString(),
      });
      setToast({
        kind: "success",
        message: `${extension.name} sekarang ${status === "active" ? "aktif" : "nonaktif"}.`,
      });
      await logActivity(`Ekstensi ${status === "active" ? "diaktifkan" : "dinonaktifkan"}`, extension.name, extension.id);
    } catch (operationError) {
      setToast({
        kind: "error",
        message: operationError instanceof Error ? operationError.message : "Gagal mengubah status ekstensi.",
      });
    }
  }

  async function logActivity(action: string, detail: string, id?: string) {
    try {
      await recordAdminActivity(action, detail, id);
    } catch (logError) {
      console.error("Extension data was saved but its activity log failed", logError);
      setToast({ kind: "error", message: "Data tersimpan, tetapi log aktivitas gagal disimpan." });
    }
  }

  const filteredExtensions = extensions.filter((extension) => {
    const query = search.trim().toLowerCase();
    return !query || [extension.name, extension.type, extension.location].some((value) => value.toLowerCase().includes(query));
  });

  return (
    <section className="min-h-full bg-slate-950 p-4 text-white md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-400">Pengelolaan</p>
            <h1 className="mt-2 text-3xl font-semibold">Extensi</h1>
            <p className="mt-2 text-sm text-slate-400">Perubahan tersinkron langsung ke Firestore.</p>
          </div>
          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
          >
            <Plus size={18} weight="bold" />
            Tambah ekstensi
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
            <p className="text-sm text-slate-400">Total ekstensi</p>
            <p className="mt-1 text-2xl font-semibold">{extensions.length}</p>
          </div>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari nama, tipe, atau lokasi"
            aria-label="Cari ekstensi"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm outline-none transition placeholder:text-slate-500 focus:border-sky-500 sm:max-w-sm"
          />
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 py-16 text-center text-slate-300">Memuat ekstensi...</div>
        ) : filteredExtensions.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 py-16 text-center text-slate-400">
            {extensions.length ? "Tidak ada ekstensi yang cocok." : "Belum ada data ekstensi."}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead className="bg-slate-800/70 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-4">Ekstensi</th>
                    <th className="px-5 py-4">Tipe</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Konten</th>
                    <th className="px-5 py-4">Lokasi</th>
                    <th className="px-5 py-4">Base URL</th>
                    <th className="px-5 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredExtensions.map((extension) => (
                    <tr key={extension.id} className="transition hover:bg-slate-800/40">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {extension.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={extension.logo} alt="" className="h-10 w-10 rounded-lg bg-slate-800 object-contain p-1" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-xs text-slate-500">N/A</div>
                          )}
                          <div>
                            <p className="font-medium">{extension.name || "Tanpa nama"}</p>
                            <p className="mt-1 max-w-xs truncate text-xs text-slate-400">{extension.description || "Tidak ada deskripsi"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-sky-400/10 px-2.5 py-1 text-xs font-medium capitalize text-sky-300">{extension.type}</span>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => void handleToggleStatus(extension)}
                          aria-label={`Ubah status ${extension.name}`}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            extension.status === "active"
                              ? "bg-emerald-400/10 text-emerald-300"
                              : "bg-slate-700 text-slate-300"
                          }`}
                        >
                          {extension.status === "active" ? "Aktif" : "Nonaktif"}
                        </button>
                      </td>
                      <td className="px-5 py-4">
                        {extension.nsfw ? (
                          <span className="rounded-full bg-rose-400/10 px-2.5 py-1 text-xs font-medium text-rose-300">18+</span>
                        ) : (
                          <span className="text-xs text-slate-500">Umum</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-300">{extension.location || "-"}</td>
                      <td className="max-w-xs truncate px-5 py-4 text-sm text-slate-400">{extension.BaseUrl || "-"}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditForm(extension)}
                            aria-label={`Edit ${extension.name}`}
                            className="rounded-lg border border-slate-700 p-2 text-slate-300 transition hover:border-sky-400 hover:text-sky-300"
                          >
                            <PencilSimple size={17} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(extension)}
                            disabled={deletingId === extension.id}
                            aria-label={`Hapus ${extension.name}`}
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
              aria-labelledby="extension-form-title"
              className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl sm:p-7"
            >
              <header className="mb-6 flex items-start justify-between">
                <div>
                  <h2 id="extension-form-title" className="text-xl font-semibold">
                    {editing ? "Edit ekstensi" : "Tambah ekstensi"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">Isi konfigurasi yang akan disimpan di Firestore.</p>
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm text-slate-300">
                    Tipe
                    <select
                      value={form.type}
                      onChange={(event) => setForm({ ...form, type: event.target.value as ExtensionType })}
                      className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 outline-none focus:border-sky-500"
                    >
                      <option value="komik">Komik</option>
                      <option value="anime">Anime</option>
                      <option value="cinema">Cinema</option>
                    </select>
                  </label>
                  <label className="block text-sm text-slate-300">
                    Lokasi
                    <input
                      value={form.location}
                      onChange={(event) => setForm({ ...form, location: event.target.value })}
                      className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 outline-none focus:border-sky-500"
                    />
                  </label>
                </div>

                <label className="block text-sm text-slate-300">
                  Logo URL
                  <input
                    type="url"
                    required
                    value={form.logo}
                    onChange={(event) => setForm({ ...form, logo: event.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 outline-none focus:border-sky-500"
                  />
                </label>
                <label className="block text-sm text-slate-300">
                  Base URL
                  <input
                    type="url"
                    required
                    value={form.BaseUrl}
                    onChange={(event) => setForm({ ...form, BaseUrl: event.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 outline-none focus:border-sky-500"
                  />
                </label>
                <label className="block text-sm text-slate-300">
                  URL pencarian
                  <input
                    value={form.UrlSearch}
                    onChange={(event) => setForm({ ...form, UrlSearch: event.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 outline-none focus:border-sky-500"
                  />
                </label>
                <label className="block text-sm text-slate-300">
                  API
                  <input
                    value={form.api}
                    onChange={(event) => setForm({ ...form, api: event.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 outline-none focus:border-sky-500"
                  />
                </label>
                <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-300">
                  Tandai sebagai konten NSFW / 18+
                  <input
                    type="checkbox"
                    checked={form.nsfw}
                    onChange={(event) => setForm({ ...form, nsfw: event.target.checked })}
                    className="h-5 w-5 accent-sky-500"
                  />
                </label>
                <label className="block text-sm text-slate-300">
                  Deskripsi
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                    className="mt-1.5 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 outline-none focus:border-sky-500"
                  />
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
                    {saving ? "Menyimpan..." : editing ? "Simpan perubahan" : "Tambah ekstensi"}
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

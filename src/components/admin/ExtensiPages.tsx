"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import {
  CaretDown,
  CaretRight,
  Crown,
  Globe,
  PencilSimple,
  Plus,
  Trash,
  X,
} from "@phosphor-icons/react";
import { FormEvent, useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { recordAdminActivity } from "@/lib/admin-activity";
import type { CustomHeaders } from "@/model/extensi";

type ExtensionType = "komik" | "anime" | "cinema";

type ExtensionRecord = {
  id: string;
  name: string;
  description: string;
  logo: string;
  type: ExtensionType;
  location: string;
  BaseUrl: string;
  baseUrl: string;
  mirrorUrls: string[];
  UrlSearch: string;
  api: string;
  nsfw: boolean;
  status: "active" | "inactive";
  isActive: boolean;
  isVipOnly: boolean;
  customHeaders: CustomHeaders;
  createdAt: string;
};

type ExtensionForm = {
  name: string;
  description: string;
  logo: string;
  type: ExtensionType;
  location: string;
  baseUrl: string;
  mirrorUrls: string[];
  UrlSearch: string;
  api: string;
  nsfw: boolean;
  isActive: boolean;
  isVipOnly: boolean;
  customHeaders: {
    referer: string;
    userAgent: string;
    cookie: string;
  };
};

const emptyForm: ExtensionForm = {
  name: "",
  description: "",
  logo: "",
  type: "komik",
  location: "",
  baseUrl: "",
  mirrorUrls: [],
  UrlSearch: "",
  api: "",
  nsfw: false,
  isActive: true,
  isVipOnly: false,
  customHeaders: {
    referer: "",
    userAgent: "",
    cookie: "",
  },
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
  const baseUrl = toText(data.baseUrl || data.BaseUrl);
  const rawMirrors = Array.isArray(data.mirrorUrls) ? data.mirrorUrls : [];
  const mirrorUrls = rawMirrors.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
  const isActive = data.isActive !== undefined
    ? data.isActive === true
    : data.status !== "inactive";

  const rawHeaders = (typeof data.customHeaders === "object" && data.customHeaders !== null)
    ? (data.customHeaders as Record<string, unknown>)
    : {};

  return {
    id,
    name: toText(data.name),
    description: toText(data.description),
    logo: toText(data.logo),
    type,
    location: toText(data.location),
    BaseUrl: baseUrl,
    baseUrl,
    mirrorUrls,
    UrlSearch: toText(data.UrlSearch),
    api: toText(data.api),
    nsfw: data.nsfw === true || data.isNsfw === true,
    status: isActive ? "active" : "inactive",
    isActive,
    isVipOnly: data.isVipOnly === true,
    customHeaders: {
      referer: toText(rawHeaders.referer),
      userAgent: toText(rawHeaders.userAgent),
      cookie: toText(rawHeaders.cookie),
    },
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
  const [newMirrorInput, setNewMirrorInput] = useState("");
  const [advancedHeadersOpen, setAdvancedHeadersOpen] = useState(false);

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
    setNewMirrorInput("");
    setAdvancedHeadersOpen(false);
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
      baseUrl: extension.baseUrl || extension.BaseUrl,
      mirrorUrls: [...extension.mirrorUrls],
      UrlSearch: extension.UrlSearch,
      api: extension.api,
      nsfw: extension.nsfw,
      isActive: extension.isActive,
      isVipOnly: extension.isVipOnly,
      customHeaders: {
        referer: extension.customHeaders?.referer || "",
        userAgent: extension.customHeaders?.userAgent || "",
        cookie: extension.customHeaders?.cookie || "",
      },
    });
    setNewMirrorInput("");
    setAdvancedHeadersOpen(
      Boolean(
        extension.customHeaders?.referer ||
        extension.customHeaders?.userAgent ||
        extension.customHeaders?.cookie
      )
    );
    setFormOpen(true);
  }

  function handleAddMirrorUrl() {
    const trimmed = newMirrorInput.trim();
    if (!trimmed) return;
    if (!isHttpUrl(trimmed)) {
      setToast({ kind: "error", message: "URL mirror cadangan harus berupa HTTP/HTTPS valid." });
      return;
    }
    if (form.mirrorUrls.includes(trimmed)) {
      setToast({ kind: "error", message: "URL mirror tersebut sudah ada di daftar." });
      return;
    }
    setForm((prev) => ({
      ...prev,
      mirrorUrls: [...prev.mirrorUrls, trimmed],
    }));
    setNewMirrorInput("");
  }

  function handleRemoveMirrorUrl(indexToRemove: number) {
    setForm((prev) => ({
      ...prev,
      mirrorUrls: prev.mirrorUrls.filter((_, idx) => idx !== indexToRemove),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    const trimmedBaseUrl = form.baseUrl.trim();
    const trimmedLogo = form.logo.trim();

    if (!isHttpUrl(trimmedLogo) || !isHttpUrl(trimmedBaseUrl)) {
      setToast({ kind: "error", message: "Logo dan Base URL harus menggunakan URL HTTP atau HTTPS yang valid." });
      setSaving(false);
      return;
    }

    const cleanedHeaders: CustomHeaders = {};
    if (form.customHeaders.referer.trim()) cleanedHeaders.referer = form.customHeaders.referer.trim();
    if (form.customHeaders.userAgent.trim()) cleanedHeaders.userAgent = form.customHeaders.userAgent.trim();
    if (form.customHeaders.cookie.trim()) cleanedHeaders.cookie = form.customHeaders.cookie.trim();

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      logo: trimmedLogo,
      type: form.type,
      location: form.location.trim(),
      baseUrl: trimmedBaseUrl,
      BaseUrl: trimmedBaseUrl,
      mirrorUrls: form.mirrorUrls,
      UrlSearch: form.UrlSearch.trim(),
      api: form.api.trim(),
      nsfw: form.nsfw,
      isActive: form.isActive,
      status: form.isActive ? "active" : "inactive",
      isVipOnly: form.isVipOnly,
      customHeaders: cleanedHeaders,
    };

    try {
      if (editing) {
        await updateDoc(doc(db, "EXTENSION", editing.id), {
          ...payload,
          updatedAt: new Date().toISOString(),
        });
        setToast({ kind: "success", message: "Ekstensi berhasil diperbarui." });
        await logActivity("Ekstensi diperbarui", `${editing.name} (${payload.baseUrl})`, editing.id);
      } else {
        const reference = await addDoc(collection(db, "EXTENSION"), {
          ...payload,
          createdAt: new Date().toISOString(),
        });
        setToast({ kind: "success", message: "Ekstensi berhasil ditambahkan." });
        await logActivity("Ekstensi ditambahkan", `${payload.name} (${payload.baseUrl})`, reference.id);
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
    const nextActive = !extension.isActive;
    const nextStatus = nextActive ? "active" : "inactive";
    try {
      await updateDoc(doc(db, "EXTENSION", extension.id), {
        status: nextStatus,
        isActive: nextActive,
        updatedAt: new Date().toISOString(),
      });
      setToast({
        kind: "success",
        message: `${extension.name} sekarang ${nextActive ? "aktif" : "nonaktif"}.`,
      });
      await logActivity(`Ekstensi ${nextActive ? "diaktifkan" : "dinonaktifkan"}`, extension.name, extension.id);
    } catch (operationError) {
      setToast({
        kind: "error",
        message: operationError instanceof Error ? operationError.message : "Gagal mengubah status ekstensi.",
      });
    }
  }

  async function handleToggleVip(extension: ExtensionRecord) {
    const nextVip = !extension.isVipOnly;
    try {
      await updateDoc(doc(db, "EXTENSION", extension.id), {
        isVipOnly: nextVip,
        updatedAt: new Date().toISOString(),
      });
      setToast({
        kind: "success",
        message: `${extension.name} sekarang ${nextVip ? "khusus VIP" : "dapat diakses publik"}.`,
      });
      await logActivity(`Akses ekstensi diubah: ${nextVip ? "Khusus VIP" : "Publik"}`, extension.name, extension.id);
    } catch (operationError) {
      setToast({
        kind: "error",
        message: operationError instanceof Error ? operationError.message : "Gagal mengubah akses VIP ekstensi.",
      });
    }
  }

  async function logActivity(action: string, detail: string, id?: string) {
    try {
      await recordAdminActivity(action, detail, id);
    } catch (logError) {
      console.error("Extension data was saved but its activity log failed", logError);
    }
  }

  const filteredExtensions = extensions.filter((extension) => {
    const query = search.trim().toLowerCase();
    return (
      !query ||
      [extension.name, extension.type, extension.location, extension.baseUrl, ...extension.mirrorUrls].some((value) =>
        value.toLowerCase().includes(query)
      )
    );
  });

  return (
    <section className="min-h-full bg-[#14141e] p-4 text-white md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-400">Pengelolaan Ekstensi</p>
            <h1 className="mt-2 text-3xl font-semibold">Remote Extension & Mirror Domain</h1>
            <p className="mt-2 text-sm text-slate-400">
              Kelola domain utama, domain mirror cadangan, sakelar live, hak akses VIP, dan override header scrapers.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500"
          >
            <Plus size={18} weight="bold" />
            Tambah Ekstensi
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

        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-[#1c1c28] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs text-slate-400">Total Ekstensi</p>
              <p className="mt-0.5 text-2xl font-bold">{extensions.length}</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <p className="text-xs text-slate-400">Aktif</p>
              <p className="mt-0.5 text-lg font-semibold text-emerald-400">
                {extensions.filter((item) => item.isActive).length}
              </p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <p className="text-xs text-slate-400">VIP Exclusive</p>
              <p className="mt-0.5 text-lg font-semibold text-amber-400">
                {extensions.filter((item) => item.isVipOnly).length}
              </p>
            </div>
          </div>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari nama, tipe, lokasi, domain..."
            aria-label="Cari ekstensi"
            className="w-full rounded-xl border border-white/10 bg-[#14141e] px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-500 sm:max-w-sm"
          />
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#1c1c28] py-16 text-center text-slate-300">
            Memuat data ekstensi...
          </div>
        ) : filteredExtensions.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#1c1c28] py-16 text-center text-slate-400">
            {extensions.length ? "Tidak ada ekstensi yang cocok dengan pencarian." : "Belum ada ekstensi terdaftar."}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1c1c28]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left">
                <thead className="bg-[#14141e]/80 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-4">Ekstensi</th>
                    <th className="px-5 py-4">Tipe</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Akses</th>
                    <th className="px-5 py-4">Domain & Mirror</th>
                    <th className="px-5 py-4">Konten</th>
                    <th className="px-5 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {filteredExtensions.map((extension) => (
                    <tr key={extension.id} className="transition hover:bg-white/[0.02]">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {extension.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={extension.logo}
                              alt=""
                              className="h-10 w-10 rounded-lg bg-[#14141e] object-contain p-1 border border-white/10"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#14141e] text-xs text-slate-500 border border-white/10">
                              N/A
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-white">{extension.name || "Tanpa nama"}</p>
                              {extension.isVipOnly && (
                                <span className="inline-flex items-center gap-1 rounded bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                                  <Crown size={11} weight="fill" /> VIP
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 max-w-xs truncate text-xs text-slate-400">
                              {extension.description || "Tidak ada deskripsi"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs font-medium capitalize text-indigo-300 border border-indigo-500/20">
                          {extension.type}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => void handleToggleStatus(extension)}
                          aria-label={`Ubah status ${extension.name}`}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                            extension.isActive
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25"
                              : "bg-slate-800 text-slate-400 border border-white/10 hover:bg-slate-700"
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              extension.isActive ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
                            }`}
                          />
                          {extension.isActive ? "Aktif" : "Nonaktif"}
                        </button>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => void handleToggleVip(extension)}
                          aria-label={`Ubah akses VIP ${extension.name}`}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                            extension.isVipOnly
                              ? "bg-amber-400/15 text-amber-300 border border-amber-400/30 hover:bg-amber-400/25"
                              : "bg-white/[0.06] text-slate-300 border border-white/10 hover:bg-white/10"
                          }`}
                        >
                          <Crown size={13} weight={extension.isVipOnly ? "fill" : "regular"} />
                          {extension.isVipOnly ? "VIP Only" : "Publik"}
                        </button>
                      </td>
                      <td className="px-5 py-4 text-sm">
                        <div className="max-w-xs">
                          <p className="truncate font-mono text-xs text-sky-400" title={extension.baseUrl}>
                            {extension.baseUrl || "-"}
                          </p>
                          {extension.mirrorUrls.length > 0 && (
                            <p className="mt-1 text-[11px] text-slate-400">
                              <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                                +{extension.mirrorUrls.length} mirror
                              </span>
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {extension.nsfw ? (
                          <span className="rounded-full bg-rose-400/10 px-2 py-0.5 text-[11px] font-semibold text-rose-300 border border-rose-400/20">
                            18+ NSFW
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Umum</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditForm(extension)}
                            aria-label={`Edit ${extension.name}`}
                            className="rounded-lg border border-white/10 p-2 text-slate-300 transition hover:border-indigo-400 hover:text-indigo-300"
                          >
                            <PencilSimple size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(extension)}
                            disabled={deletingId === extension.id}
                            aria-label={`Hapus ${extension.name}`}
                            className="rounded-lg border border-white/10 p-2 text-slate-300 transition hover:border-rose-400 hover:text-rose-300 disabled:opacity-50"
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

        {/* Modal Form Tambah / Edit Ekstensi */}
        {formOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="presentation">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="extension-form-title"
              className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#1c1c28] p-5 shadow-2xl sm:p-7"
            >
              <header className="mb-6 flex items-start justify-between">
                <div>
                  <h2 id="extension-form-title" className="text-xl font-semibold text-white">
                    {editing ? "Edit Konfigurasi Ekstensi" : "Tambah Ekstensi Baru"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Konfigurasi domain aktif, mirror cadangan, dan parameter headers scrapers.
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Tutup form"
                  onClick={() => setFormOpen(false)}
                  disabled={saving}
                  className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
                >
                  <X size={20} />
                </button>
              </header>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm text-slate-300">
                    Nama Ekstensi *
                    <input
                      required
                      maxLength={100}
                      value={form.name}
                      onChange={(event) => setForm({ ...form, name: event.target.value })}
                      placeholder="Contoh: Shinigami ID"
                      className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#14141e] px-3.5 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
                    />
                  </label>
                  <label className="block text-sm text-slate-300">
                    Tipe Konten *
                    <select
                      value={form.type}
                      onChange={(event) => setForm({ ...form, type: event.target.value as ExtensionType })}
                      className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#14141e] px-3.5 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
                    >
                      <option value="komik">Komik / Manga / Manhwa</option>
                      <option value="anime">Anime / Series</option>
                      <option value="cinema">Cinema / Film</option>
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm text-slate-300">
                    Logo URL *
                    <input
                      type="url"
                      required
                      value={form.logo}
                      placeholder="https://domain.com/logo.png"
                      onChange={(event) => setForm({ ...form, logo: event.target.value })}
                      className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#14141e] px-3.5 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
                    />
                  </label>
                  <label className="block text-sm text-slate-300">
                    Lokasi / Bahasa
                    <input
                      value={form.location}
                      placeholder="Contoh: Indonesia / ID"
                      onChange={(event) => setForm({ ...form, location: event.target.value })}
                      className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#14141e] px-3.5 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
                    />
                  </label>
                </div>

                {/* Section Domain Utama & Mirror URLs */}
                <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Globe size={18} className="text-indigo-400" />
                    <h3 className="text-sm font-semibold text-white">Domain Manager & Mirror URLs</h3>
                  </div>

                  <label className="block text-sm text-slate-300">
                    Domain Utama Aktif (Base URL) *
                    <input
                      type="url"
                      required
                      value={form.baseUrl}
                      placeholder="https://shinigami01.com"
                      onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}
                      className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#14141e] px-3.5 py-2.5 font-mono text-sm text-indigo-200 outline-none focus:border-indigo-500"
                    />
                    <span className="mt-1 block text-xs text-slate-400">
                      Domain utama yang digunakan aplikasi untuk fetching data.
                    </span>
                  </label>

                  <div>
                    <label className="block text-sm text-slate-300">
                      Daftar Mirror URLs Cadangan
                    </label>
                    <div className="mt-1.5 flex gap-2">
                      <input
                        type="url"
                        value={newMirrorInput}
                        placeholder="https://shinigami02.com"
                        onChange={(event) => setNewMirrorInput(event.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddMirrorUrl();
                          }
                        }}
                        className="flex-1 rounded-lg border border-white/10 bg-[#14141e] px-3.5 py-2 font-mono text-xs text-white outline-none focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddMirrorUrl}
                        className="rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
                      >
                        + Tambah
                      </button>
                    </div>

                    {form.mirrorUrls.length > 0 ? (
                      <div className="mt-3 space-y-1.5">
                        {form.mirrorUrls.map((mirror, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between rounded-lg border border-white/[0.07] bg-[#14141e] px-3 py-1.5 text-xs font-mono text-slate-300"
                          >
                            <span className="truncate">{mirror}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveMirrorUrl(idx)}
                              className="ml-2 text-rose-400 hover:text-rose-300"
                              title="Hapus mirror"
                            >
                              <Trash size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">
                        Belum ada mirror cadangan. Tambahkan URL di atas jika ada mirror domain alternatif.
                      </p>
                    )}
                  </div>
                </div>

                {/* Additional endpoints */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm text-slate-300">
                    URL Pencarian (Opsional)
                    <input
                      value={form.UrlSearch}
                      placeholder="/?s={query}"
                      onChange={(event) => setForm({ ...form, UrlSearch: event.target.value })}
                      className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#14141e] px-3.5 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
                    />
                  </label>
                  <label className="block text-sm text-slate-300">
                    Endpoint API Khusus (Opsional)
                    <input
                      value={form.api}
                      placeholder="/api/v1/..."
                      onChange={(event) => setForm({ ...form, api: event.target.value })}
                      className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#14141e] px-3.5 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
                    />
                  </label>
                </div>

                {/* Toggles Status, VIP, NSFW */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#14141e] p-3 text-xs text-slate-300 cursor-pointer">
                    <span>Ekstensi Aktif</span>
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                      className="h-4 w-4 accent-emerald-500 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#14141e] p-3 text-xs text-slate-300 cursor-pointer">
                    <span className="inline-flex items-center gap-1">
                      <Crown size={14} className="text-amber-400" /> Khusus VIP
                    </span>
                    <input
                      type="checkbox"
                      checked={form.isVipOnly}
                      onChange={(event) => setForm({ ...form, isVipOnly: event.target.checked })}
                      className="h-4 w-4 accent-amber-400 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#14141e] p-3 text-xs text-slate-300 cursor-pointer">
                    <span>Konten 18+ (NSFW)</span>
                    <input
                      type="checkbox"
                      checked={form.nsfw}
                      onChange={(event) => setForm({ ...form, nsfw: event.target.checked })}
                      className="h-4 w-4 accent-rose-500 cursor-pointer"
                    />
                  </label>
                </div>

                {/* Collapsible Accordion: Advanced Headers & Cookie Override */}
                <div className="rounded-xl border border-white/10 bg-[#14141e] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setAdvancedHeadersOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-300 hover:bg-white/[0.03]"
                  >
                    <span className="flex items-center gap-2">
                      {advancedHeadersOpen ? <CaretDown size={16} /> : <CaretRight size={16} />}
                      Advanced Headers & Cookie Override
                      {(form.customHeaders.referer || form.customHeaders.userAgent || form.customHeaders.cookie) && (
                        <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] text-indigo-300 font-normal">
                          Aktif
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-slate-500">Bypass Cloudflare / Proteksi</span>
                  </button>

                  {advancedHeadersOpen && (
                    <div className="border-t border-white/10 p-4 space-y-3 bg-[#171723]">
                      <p className="text-xs text-slate-400">
                        Header ini dikirimkan oleh aplikasi Android saat scraping. Gunakan untuk bypass Cloudflare clearance (`cf_clearance`), Referer, atau User Agent tanpa update APK.
                      </p>

                      <label className="block text-xs text-slate-300">
                        Custom Referer Header
                        <input
                          value={form.customHeaders.referer}
                          placeholder="https://shinigami01.com/"
                          onChange={(e) =>
                            setForm({
                              ...form,
                              customHeaders: { ...form.customHeaders, referer: e.target.value },
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-white/10 bg-[#14141e] px-3 py-2 font-mono text-xs text-white outline-none focus:border-indigo-500"
                        />
                      </label>

                      <label className="block text-xs text-slate-300">
                        Custom User-Agent Header
                        <input
                          value={form.customHeaders.userAgent}
                          placeholder="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36..."
                          onChange={(e) =>
                            setForm({
                              ...form,
                              customHeaders: { ...form.customHeaders, userAgent: e.target.value },
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-white/10 bg-[#14141e] px-3 py-2 font-mono text-xs text-white outline-none focus:border-indigo-500"
                        />
                      </label>

                      <label className="block text-xs text-slate-300">
                        Custom Cookie (cf_clearance / session token)
                        <textarea
                          rows={2}
                          value={form.customHeaders.cookie}
                          placeholder="cf_clearance=abc123...; session=xyz789..."
                          onChange={(e) =>
                            setForm({
                              ...form,
                              customHeaders: { ...form.customHeaders, cookie: e.target.value },
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-white/10 bg-[#14141e] px-3 py-2 font-mono text-xs text-white outline-none focus:border-indigo-500"
                        />
                      </label>
                    </div>
                  )}
                </div>

                <label className="block text-sm text-slate-300">
                  Deskripsi Ekstensi
                  <textarea
                    rows={2}
                    value={form.description}
                    placeholder="Deskripsi singkat sumber komik/anime..."
                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                    className="mt-1.5 w-full resize-y rounded-lg border border-white/10 bg-[#14141e] px-3.5 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
                  />
                </label>

                <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setFormOpen(false)}
                    disabled={saving}
                    className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/10 disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 disabled:cursor-wait disabled:opacity-60"
                  >
                    {saving ? "Menyimpan..." : editing ? "Simpan Perubahan" : "Tambah Ekstensi"}
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

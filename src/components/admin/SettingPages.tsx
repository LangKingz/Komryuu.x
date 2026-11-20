"use client";

import { collection, doc, getDocs, onSnapshot, setDoc, Timestamp } from "firebase/firestore";
import {
  ArrowCounterClockwise,
  Check,
  Copy,
  Devices,
  DownloadSimple,
  Key,
  Megaphone,
  ShieldWarning,
  Warning,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import { recordAdminActivity } from "@/lib/admin-activity";
import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_APP_UPDATE,
  DEFAULT_BROADCAST_BANNER,
  normalizeAppSettings,
  type AppSettings,
  type AppUpdate,
  type BroadcastBanner,
} from "@/model/app-settings";

type Toast = { kind: "success" | "error"; message: string };

function hashKey(key: string): Promise<string> {
  const bytes = new TextEncoder().encode(key);
  return crypto.subtle.digest("SHA-256", bytes).then((digest) =>
    Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
  );
}

function serializeValue(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, serializeValue(item)])
    );
  }
  return value;
}

export default function SettingPages() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const settingsRef = useRef<AppSettings>(DEFAULT_APP_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [generatedKey, setGeneratedKey] = useState("");
  const [rateLimitDraft, setRateLimitDraft] = useState(String(DEFAULT_APP_SETTINGS.rateLimitPerMinute));
  const [cacheTtlDraft, setCacheTtlDraft] = useState(String(DEFAULT_APP_SETTINGS.extensionCacheTtlSeconds));
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [resetConfirmationOpen, setResetConfirmationOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "SETTINGS", "app_config"),
      (snapshot) => {
        const nextSettings = normalizeAppSettings(snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : {});
        settingsRef.current = nextSettings;
        setSettings(nextSettings);
        setRateLimitDraft(String(nextSettings.rateLimitPerMinute));
        setCacheTtlDraft(String(nextSettings.extensionCacheTtlSeconds));
        setLoading(false);
        setError(null);
      },
      (snapshotError) => {
        setError(snapshotError.message);
        setToast({ kind: "error", message: "Gagal memuat pengaturan dari Firestore." });
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  async function savePatch(patch: Record<string, unknown>) {
    const previous = settingsRef.current;
    const next = { ...previous, ...patch } as AppSettings;
    settingsRef.current = next;
    setSettings(next);
    setSaving(true);
    setError(null);
    try {
      await setDoc(
        doc(db, "SETTINGS", "app_config"),
        { ...patch, updatedAt: new Date().toISOString() },
        { merge: true }
      );
      setToast({ kind: "success", message: "Pengaturan berhasil disimpan." });
      return true;
    } catch (saveError) {
      settingsRef.current = previous;
      setSettings(previous);
      const message = saveError instanceof Error ? saveError.message : "Gagal menyimpan pengaturan.";
      setError(message);
      setToast({ kind: "error", message });
      return false;
    } finally {
      setSaving(false);
    }
  }

  function updateBroadcastBanner(patch: Partial<BroadcastBanner>) {
    const currentBanner = settingsRef.current.broadcastBanner || DEFAULT_BROADCAST_BANNER;
    const updatedBanner: BroadcastBanner = { ...currentBanner, ...patch };
    const next = { ...settingsRef.current, broadcastBanner: updatedBanner };
    settingsRef.current = next;
    setSettings(next);
    return updatedBanner;
  }

  function updateAppUpdate(patch: Partial<AppUpdate>) {
    const currentUpdate = settingsRef.current.appUpdate || DEFAULT_APP_UPDATE;
    const updatedUpdate: AppUpdate = { ...currentUpdate, ...patch };
    const next = { ...settingsRef.current, appUpdate: updatedUpdate };
    settingsRef.current = next;
    setSettings(next);
    return updatedUpdate;
  }

  function saveNumberSetting(field: "rateLimitPerMinute" | "extensionCacheTtlSeconds", value: string) {
    const number = Number(value);
    const min = field === "extensionCacheTtlSeconds" ? 0 : 1;
    const max = field === "extensionCacheTtlSeconds" ? 3600 : 10000;
    if (!Number.isInteger(number) || number < min || number > max) {
      setToast({ kind: "error", message: `Nilai harus berupa bilangan bulat ${min}–${max}.` });
      setRateLimitDraft(String(settingsRef.current.rateLimitPerMinute));
      setCacheTtlDraft(String(settingsRef.current.extensionCacheTtlSeconds));
      return;
    }
    if (field === "rateLimitPerMinute") {
      void savePatch({ rateLimitPerMinute: number });
    } else {
      void savePatch({ extensionCacheTtlSeconds: number });
    }
  }

  async function generateApiKey() {
    setGeneratingKey(true);
    try {
      const random = crypto.getRandomValues(new Uint8Array(32));
      const key = Array.from(random, (byte) => byte.toString(16).padStart(2, "0")).join("");
      const externalApiKeyHash = await hashKey(key);
      const saved = await savePatch({ externalApiKeyHash });
      if (saved) {
        setGeneratedKey(key);
        setToast({ kind: "success", message: "API key baru tersimpan. Salin sekarang karena nilai mentah tidak disimpan." });
        try {
          await recordAdminActivity("API key eksternal dirotasi", "Kunci tersimpan sebagai hash.");
        } catch (logError) {
          console.error("API key was rotated but its activity log failed", logError);
        }
      }
    } catch (keyError) {
      const message = keyError instanceof Error ? keyError.message : "Gagal membuat API key.";
      setToast({ kind: "error", message });
    } finally {
      setGeneratingKey(false);
    }
  }

  async function copyApiKey() {
    try {
      await navigator.clipboard.writeText(generatedKey);
      setToast({ kind: "success", message: "API key disalin ke clipboard." });
    } catch (copyError) {
      setToast({
        kind: "error",
        message: copyError instanceof Error ? copyError.message : "Gagal menyalin API key.",
      });
    }
  }

  async function exportBackup() {
    setSaving(true);
    try {
      const [extensionSnapshot, settingsSnapshot] = await Promise.all([
        getDocs(collection(db, "EXTENSION")),
        getDocs(collection(db, "SETTINGS")),
      ]);
      const backup = {
        exportedAt: new Date().toISOString(),
        collections: {
          EXTENSION: extensionSnapshot.docs.map((item) => ({
            id: item.id,
            ...(serializeValue(item.data()) as Record<string, unknown>),
          })),
          SETTINGS: settingsSnapshot.docs.map((item) => ({
            id: item.id,
            ...(serializeValue(item.data()) as Record<string, unknown>),
          })),
        },
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `komryuu-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      anchor.click();
      URL.revokeObjectURL(downloadUrl);
      setToast({ kind: "success", message: "Backup JSON berhasil dibuat." });
    } catch (backupError) {
      const message = backupError instanceof Error ? backupError.message : "Gagal mengekspor backup.";
      setToast({ kind: "error", message });
    } finally {
      setSaving(false);
    }
  }

  async function resetSettings() {
    setSaving(true);
    try {
      await setDoc(doc(db, "SETTINGS", "app_config"), {
        ...DEFAULT_APP_SETTINGS,
        updatedAt: new Date().toISOString(),
      });
      setGeneratedKey("");
      setResetConfirmationOpen(false);
      setToast({ kind: "success", message: "Pengaturan dikembalikan ke nilai default." });
      try {
        await recordAdminActivity("Pengaturan aplikasi direset", "Nilai SETTINGS/app_config kembali ke default.");
      } catch (logError) {
        console.error("Settings were reset but their activity log failed", logError);
        setToast({ kind: "error", message: "Pengaturan direset, tetapi log aktivitas gagal disimpan." });
      }
    } catch (resetError) {
      setToast({
        kind: "error",
        message: resetError instanceof Error ? resetError.message : "Gagal mereset pengaturan.",
      });
    } finally {
      setSaving(false);
    }
  }

  const settingCard = "rounded-2xl border border-white/[0.07] bg-[#1c1c28] p-5 md:p-6";
  const toggleCard = "flex items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-[#14141e] p-4";
  const inputClass = "mt-1.5 w-full rounded-lg border border-white/[0.09] bg-[#14141e] px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-sky-500 transition";

  return (
    <section className="min-h-full bg-[#14141e] p-4 text-white md:p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-400">Konfigurasi</p>
          <h1 className="mt-2 text-3xl font-semibold">Pengaturan Global</h1>
          <p className="mt-2 text-sm text-slate-400">Perubahan disimpan langsung ke dokumen SETTINGS/app_config Firestore.</p>
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

        {loading ? (
          <div className={settingCard + " py-16 text-center text-slate-300"}>Memuat pengaturan...</div>
        ) : (
          <div className="space-y-6">
            {/* 1. SECTION: PENGUMUMAN & BROADCAST APLIKASI */}
            <section className={settingCard}>
              <div className="mb-5 flex items-start gap-3">
                <span className="rounded-xl bg-amber-400/10 p-2.5 text-amber-300">
                  <Megaphone size={22} weight="duotone" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold">Pengumuman & Broadcast Aplikasi</h2>
                  <p className="mt-0.5 text-sm text-slate-400">
                    Kirim pengumuman penting atau banner darurat langsung ke aplikasi Android user.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <label className={toggleCard}>
                  <div>
                    <span className="block font-medium">Aktifkan Banner Pengumuman</span>
                    <span className="mt-0.5 block text-xs text-slate-400">
                      Tampilkan bar pengumuman melayang di halaman utama aplikasi.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.broadcastBanner?.isActive ?? false}
                    disabled={saving}
                    onChange={(event) => {
                      const updated = updateBroadcastBanner({ isActive: event.target.checked });
                      void savePatch({ broadcastBanner: updated });
                    }}
                    className="h-5 w-5 accent-amber-400 cursor-pointer"
                    aria-label="Aktifkan Banner Pengumuman"
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label className="block text-sm text-slate-300">
                      Judul Pengumuman
                      <input
                        value={settings.broadcastBanner?.title ?? ""}
                        placeholder="Contoh: Pemeliharaan Server / Rilis Fitur Baru"
                        onChange={(event) => updateBroadcastBanner({ title: event.target.value })}
                        onBlur={() => {
                          const banner = settingsRef.current.broadcastBanner;
                          void savePatch({ broadcastBanner: banner });
                        }}
                        className={inputClass}
                      />
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300">
                      Tipe Alert
                      <select
                        value={settings.broadcastBanner?.type ?? "info"}
                        disabled={saving}
                        onChange={(event) => {
                          const updated = updateBroadcastBanner({ type: event.target.value });
                          void savePatch({ broadcastBanner: updated });
                        }}
                        className={inputClass}
                      >
                        <option value="info">Info (Biru/Abu)</option>
                        <option value="warning">Warning (Kuning/Oranye)</option>
                        <option value="urgent">Urgent (Merah/Kritis)</option>
                      </select>
                    </label>
                  </div>
                </div>

                <label className="block text-sm text-slate-300">
                  Pesan Pengumuman
                  <textarea
                    rows={3}
                    value={settings.broadcastBanner?.message ?? ""}
                    placeholder="Tulis pesan siaran yang akan dibaca oleh semua pengguna aplikasi..."
                    onChange={(event) => {
                      const msg = event.target.value;
                      updateBroadcastBanner({ message: msg });
                    }}
                    onBlur={() => {
                      const banner = settingsRef.current.broadcastBanner;
                      void savePatch({
                        broadcastBanner: banner,
                        announcement: banner?.message || "",
                      });
                    }}
                    className={inputClass}
                  />
                  <span className="mt-1 block text-xs text-slate-500">
                    Tersimpan otomatis setelah cursor meninggalkan kotak teks.
                  </span>
                </label>
              </div>
            </section>

            {/* 2. SECTION: KONTROL VERSI & FORCE UPDATE APK */}
            <section className={settingCard}>
              <div className="mb-5 flex items-start gap-3">
                <span className="rounded-xl bg-sky-400/10 p-2.5 text-sky-300">
                  <Devices size={22} weight="duotone" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold">Kontrol Versi & Force Update APK</h2>
                  <p className="mt-0.5 text-sm text-slate-400">
                    Atur versi minimum yang diizinkan dan paksa pengguna mengupdate aplikasi ke versi terbaru.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <label className={toggleCard}>
                  <div>
                    <span className="block font-medium">Wajibkan Force Update</span>
                    <span className="mt-0.5 block text-xs text-slate-400">
                      Jika aktif, aplikasi Android di bawah Minimum App Version akan diblokir dengan dialog update wajib.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.appUpdate?.forceUpdate ?? false}
                    disabled={saving}
                    onChange={(event) => {
                      const updated = updateAppUpdate({ forceUpdate: event.target.checked });
                      void savePatch({ appUpdate: updated });
                    }}
                    className="h-5 w-5 accent-sky-400 cursor-pointer"
                    aria-label="Wajibkan Force Update"
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm text-slate-300">
                    Minimum App Version
                    <input
                      value={settings.appUpdate?.minAppVersion ?? settings.minimumAppVersion}
                      maxLength={32}
                      placeholder="1.0.0"
                      onChange={(event) => {
                        const val = event.target.value;
                        updateAppUpdate({ minAppVersion: val });
                      }}
                      onBlur={() => {
                        const val = (settingsRef.current.appUpdate?.minAppVersion || "1.0.0").trim();
                        void savePatch({
                          minimumAppVersion: val,
                          appUpdate: updateAppUpdate({ minAppVersion: val }),
                        });
                      }}
                      className={inputClass}
                    />
                    <span className="mt-1 block text-xs text-slate-500">Versi terendah yang masih boleh mengakses API.</span>
                  </label>

                  <label className="block text-sm text-slate-300">
                    Latest App Version
                    <input
                      value={settings.appUpdate?.latestAppVersion ?? "1.0.0"}
                      maxLength={32}
                      placeholder="1.1.0"
                      onChange={(event) => updateAppUpdate({ latestAppVersion: event.target.value })}
                      onBlur={() => {
                        const val = (settingsRef.current.appUpdate?.latestAppVersion || "1.0.0").trim();
                        void savePatch({ appUpdate: updateAppUpdate({ latestAppVersion: val }) });
                      }}
                      className={inputClass}
                    />
                    <span className="mt-1 block text-xs text-slate-500">Versi terbaru yang tersedia di server/distribusi.</span>
                  </label>
                </div>

                <label className="block text-sm text-slate-300">
                  URL Download APK Terbaru
                  <input
                    type="url"
                    value={settings.appUpdate?.downloadUrl ?? ""}
                    placeholder="https://github.com/.../releases/download/v1.1.0/app-release.apk"
                    onChange={(event) => updateAppUpdate({ downloadUrl: event.target.value })}
                    onBlur={() => {
                      const url = (settingsRef.current.appUpdate?.downloadUrl || "").trim();
                      void savePatch({ appUpdate: updateAppUpdate({ downloadUrl: url }) });
                    }}
                    className={inputClass}
                  />
                  <span className="mt-1 block text-xs text-slate-500">Link langsung saat user menekan tombol &quot;Update Sekarang&quot;.</span>
                </label>

                <label className="block text-sm text-slate-300">
                  Catatan Pembaruan (Changelog)
                  <textarea
                    rows={3}
                    value={settings.appUpdate?.changelog ?? ""}
                    placeholder="- Penambahan fitur sinkronisasi cloud&#10;- Perbaikan bug saat membaca manga&#10;- Peningkatan performa"
                    onChange={(event) => updateAppUpdate({ changelog: event.target.value })}
                    onBlur={() => {
                      const cl = (settingsRef.current.appUpdate?.changelog || "").trim();
                      void savePatch({ appUpdate: updateAppUpdate({ changelog: cl }) });
                    }}
                    className={inputClass}
                  />
                </label>
              </div>
            </section>

            {/* 3. SECTION: STATUS SISTEM & MAINTENANCE */}
            <section className={settingCard}>
              <div className="mb-5 flex items-start gap-3">
                <span className="rounded-xl bg-rose-400/10 p-2.5 text-rose-300">
                  <ShieldWarning size={22} weight="duotone" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold">Status Sistem & Pemeliharaan</h2>
                  <p className="mt-0.5 text-sm text-slate-400">Kontrol downtime aplikasi untuk maintenance terjadwal.</p>
                </div>
              </div>

              <div className="space-y-4">
                <label className={toggleCard}>
                  <div>
                    <span className="block font-medium">Maintenance Mode</span>
                    <span className="mt-0.5 block text-xs text-slate-400">
                      API eksternal akan mengembalikan HTTP 503 dengan pesan pemeliharaan.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.maintenanceMode}
                    disabled={saving}
                    onChange={(event) => void savePatch({ maintenanceMode: event.target.checked })}
                    className="h-5 w-5 accent-rose-500 cursor-pointer"
                    aria-label="Maintenance Mode"
                  />
                </label>

                <label className="block text-sm text-slate-300">
                  Pesan Pemeliharaan (Maintenance Message)
                  <textarea
                    rows={2}
                    value={settings.maintenanceMessage}
                    onChange={(event) => {
                      const value = event.target.value;
                      const next = { ...settingsRef.current, maintenanceMessage: value };
                      settingsRef.current = next;
                      setSettings(next);
                    }}
                    onBlur={() => void savePatch({ maintenanceMessage: settingsRef.current.maintenanceMessage.trim() })}
                    className={inputClass}
                  />
                </label>
              </div>
            </section>

            {/* 4. SECTION: AKSES API EKSTERNAL */}
            <section className={settingCard}>
              <div className="mb-5 flex items-start gap-3">
                <span className="rounded-xl bg-violet-400/10 p-2.5 text-violet-300">
                  <Key size={22} weight="duotone" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold">Akses API Eksternal</h2>
                  <p className="mt-0.5 text-sm text-slate-400">
                    Otorisasi request dari aplikasi Android via header <code className="text-sky-300">x-api-key</code>.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <Key size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    readOnly
                    value={generatedKey}
                    placeholder={
                      settings.externalApiKeyHash
                        ? "Key tersimpan (hash SHA-256). Rotasi untuk membuat key baru."
                        : "Belum ada API key terdaftar"
                    }
                    className="w-full rounded-lg border border-white/[0.09] bg-[#14141e] py-2.5 pl-10 pr-3 font-mono text-xs text-slate-200 outline-none"
                    aria-label="External API Key"
                  />
                </div>
                {generatedKey && (
                  <button
                    type="button"
                    onClick={() => void copyApiKey()}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/[0.09] bg-[#14141e] px-4 py-2.5 text-sm text-slate-200 hover:bg-white/[0.05]"
                  >
                    <Copy size={17} />
                    Salin
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void generateApiKey()}
                  disabled={generatingKey || saving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50 transition"
                >
                  <Key size={17} />
                  {generatingKey ? "Membuat..." : "Generate / Rotate Key"}
                </button>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Nilai mentah API key hanya ditampilkan satu kali setelah digenerate dan disimpan sebagai SHA-256 hash di database.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm text-slate-300">
                  Rate Limit (request/menit)
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={rateLimitDraft}
                    onChange={(event) => setRateLimitDraft(event.target.value)}
                    onBlur={() => saveNumberSetting("rateLimitPerMinute", rateLimitDraft)}
                    className={inputClass}
                  />
                </label>
                <label className="block text-sm text-slate-300">
                  Cache TTL Ekstensi (detik)
                  <input
                    type="number"
                    min={0}
                    max={3600}
                    value={cacheTtlDraft}
                    onChange={(event) => setCacheTtlDraft(event.target.value)}
                    onBlur={() => saveNumberSetting("extensionCacheTtlSeconds", cacheTtlDraft)}
                    className={inputClass}
                  />
                </label>
              </div>
            </section>

            {/* 5. SECTION: KONTEN DAN PREFERENSI */}
            <section className={settingCard}>
              <div className="mb-5 flex items-start gap-3">
                <span className="rounded-xl bg-emerald-400/10 p-2.5 text-emerald-300">
                  <Warning size={22} weight="duotone" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold">Konten & Kebijakan Aplikasi</h2>
                  <p className="mt-0.5 text-sm text-slate-400">Preferensi global pembatasan fitur dan registrasi.</p>
                </div>
              </div>

              <div className="space-y-3">
                <label className={toggleCard}>
                  <div>
                    <span className="block font-medium">Izinkan Registrasi Pengguna Baru</span>
                    <span className="mt-0.5 block text-xs text-slate-400">Kontrol endpoint registrasi akun aplikasi.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.allowRegistration}
                    disabled={saving}
                    onChange={(event) => void savePatch({ allowRegistration: event.target.checked })}
                    className="h-5 w-5 accent-emerald-500 cursor-pointer"
                    aria-label="Izinkan registrasi pengguna baru"
                  />
                </label>
                <label className={toggleCard}>
                  <div>
                    <span className="block font-medium">Tampilkan Konten Dewasa / NSFW 18+</span>
                    <span className="mt-0.5 block text-xs text-slate-400">Default global filter untuk API eksternal.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.showNsfw}
                    disabled={saving}
                    onChange={(event) => void savePatch({ showNsfw: event.target.checked })}
                    className="h-5 w-5 accent-emerald-500 cursor-pointer"
                    aria-label="Tampilkan konten NSFW"
                  />
                </label>
              </div>

              <div className="mt-4">
                <label className="block text-sm text-slate-300">
                  Kategori Default
                  <select
                    value={settings.defaultCategory}
                    disabled={saving}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === "komik" || value === "anime" || value === "cinema") {
                        void savePatch({ defaultCategory: value });
                      }
                    }}
                    className={inputClass}
                  >
                    <option value="komik">Komik</option>
                    <option value="anime">Anime</option>
                    <option value="cinema">Cinema</option>
                  </select>
                </label>
              </div>
            </section>

            {/* 6. SECTION: UTILITAS DATABASE & DANGER ZONE */}
            <section className="rounded-2xl border border-rose-500/20 bg-rose-950/10 p-5 md:p-6">
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-300">Danger Zone</p>
                <h2 className="mt-1 text-lg font-semibold">Utilitas & Backup Database</h2>
                <p className="mt-0.5 text-sm text-slate-400">Backup mencakup koleksi EXTENSION dan SETTINGS.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void exportBackup()}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/[0.09] bg-[#14141e] px-4 py-2.5 text-sm text-slate-200 hover:bg-white/[0.05] disabled:opacity-50 transition"
                >
                  <DownloadSimple size={18} />
                  {saving ? "Memproses..." : "Export Backup Data (JSON)"}
                </button>
                <button
                  type="button"
                  onClick={() => setResetConfirmationOpen(true)}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-400/40 px-4 py-2.5 text-sm text-rose-200 hover:bg-rose-400/10 disabled:opacity-50 transition"
                >
                  <ArrowCounterClockwise size={18} />
                  Reset Pengaturan ke Default
                </button>
              </div>
            </section>
          </div>
        )}

        {saving && <p role="status" className="mt-4 text-xs text-slate-500">Menyimpan ke Firestore...</p>}
      </div>

      {resetConfirmationOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-dialog-title"
            className="w-full max-w-md rounded-2xl border border-white/[0.09] bg-[#1b1b28] p-6 shadow-2xl"
          >
            <h2 id="reset-dialog-title" className="text-xl font-semibold">Reset semua pengaturan?</h2>
            <p className="mt-2 text-sm text-slate-400">
              Nilai SETTINGS/app_config akan diganti dengan default dan API key eksternal yang aktif akan dicabut.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setResetConfirmationOpen(false)}
                disabled={saving}
                className="rounded-lg border border-white/[0.09] px-4 py-2 text-sm text-slate-300 hover:bg-white/[0.05]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void resetSettings()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-400 disabled:opacity-50"
              >
                <Check size={16} />
                {saving ? "Mereset..." : "Ya, reset"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

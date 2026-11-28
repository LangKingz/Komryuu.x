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
  Plus,
  ShieldWarning,
  Trash,
  Warning,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Sliders } from "lucide-react";
import { db } from "@/lib/firebase";
import { recordAdminActivity } from "@/lib/admin-activity";
import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_APP_UPDATE,
  DEFAULT_BROADCAST_BANNER,
  DEFAULT_FEATURE_FLAGS,
  normalizeAppSettings,
  type AnnouncementType,
  type AppReleaseItem,
  type AppSettings,
  type FeatureState,
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

  // Local drafts for inputs to provide smooth typing
  const [rateLimitDraft, setRateLimitDraft] = useState(String(DEFAULT_APP_SETTINGS.rateLimitPerMinute));
  const [cacheTtlDraft, setCacheTtlDraft] = useState(String(DEFAULT_APP_SETTINGS.extensionCacheTtlSeconds));

  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [resetConfirmationOpen, setResetConfirmationOpen] = useState(false);

  // Release history state
  const [releases, setReleases] = useState<AppReleaseItem[]>([]);
  const [activeReleaseId, setActiveReleaseId] = useState("");
  const [releaseFormOpen, setReleaseFormOpen] = useState(false);
  const [fetchingGithub, setFetchingGithub] = useState(false);
  const [releaseForm, setReleaseForm] = useState({
    versionName: "",
    versionCode: 1,
    apkUrl: "/aplikasi/Komryuu.apk",
    fileSize: "",
    channel: "stable" as "stable" | "beta",
    forceUpdate: false,
    changelog: "",
    releasedAt: new Date().toISOString().slice(0, 16),
  });
  const [deleteReleaseId, setDeleteReleaseId] = useState<string | null>(null);
  const [featureFlagsDraft, setFeatureFlagsDraft] = useState<Record<string, FeatureState>>({
    ...DEFAULT_FEATURE_FLAGS,
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "SETTINGS", "app_config"),
      (snapshot) => {
        const nextSettings = normalizeAppSettings(snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : {});
        settingsRef.current = nextSettings;
        setSettings(nextSettings);
        setRateLimitDraft(String(nextSettings.rateLimitPerMinute));
        setCacheTtlDraft(String(nextSettings.extensionCacheTtlSeconds));
        setReleases(nextSettings.releases ?? []);
        setActiveReleaseId(nextSettings.activeReleaseId ?? "");
        setFeatureFlagsDraft(nextSettings.featureFlags ?? { ...DEFAULT_FEATURE_FLAGS });
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

  async function savePatch(patch: Record<string, unknown>, activityDescription?: { action: string; detail: string }) {
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

      if (activityDescription) {
        try {
          await recordAdminActivity(activityDescription.action, activityDescription.detail);
        } catch (logErr) {
          console.error("Activity log failed", logErr);
        }
      }
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

  // Version & Release controls
  function handleUpdateRelease(patch: {
    latestVersion?: string;
    minVersionCode?: number;
    forceUpdate?: boolean;
    apkUrl?: string;
    changelog?: string;
  }) {
    const cur = settingsRef.current;
    const nextLatest = patch.latestVersion !== undefined ? patch.latestVersion : (cur.latestVersion || "1.2.0");
    const nextMinCode = patch.minVersionCode !== undefined ? patch.minVersionCode : (cur.minVersionCode ?? 1);
    const nextForce = patch.forceUpdate !== undefined ? patch.forceUpdate : (cur.forceUpdate ?? false);
    const nextApkUrl = patch.apkUrl !== undefined ? patch.apkUrl : (cur.apkUrl || "/aplikasi/Komryuu.apk");
    const nextChangelog = patch.changelog !== undefined ? patch.changelog : (cur.changelog || "");

    const appUpdateObj = {
      ...cur.appUpdate,
      latestVersion: nextLatest,
      latestAppVersion: nextLatest,
      minVersionCode: nextMinCode,
      forceUpdate: nextForce,
      apkUrl: nextApkUrl,
      downloadUrl: nextApkUrl,
      changelog: nextChangelog,
    };

    return {
      latestVersion: nextLatest,
      minVersionCode: nextMinCode,
      forceUpdate: nextForce,
      apkUrl: nextApkUrl,
      changelog: nextChangelog,
      appUpdate: appUpdateObj,
    };
  }

  // Announcement controls
  function handleUpdateAnnouncement(patch: {
    active?: boolean;
    title?: string;
    message?: string;
    type?: AnnouncementType;
  }) {
    const cur = settingsRef.current;
    const curAnn = cur.appAnnouncement || {
      active: cur.broadcastBanner.isActive,
      title: cur.broadcastBanner.title,
      message: cur.broadcastBanner.message,
      type: "info" as const,
    };

    const nextActive = patch.active !== undefined ? patch.active : curAnn.active;
    const nextTitle = patch.title !== undefined ? patch.title : curAnn.title;
    const nextMessage = patch.message !== undefined ? patch.message : curAnn.message;
    const nextType = patch.type !== undefined ? patch.type : curAnn.type;

    const announcementObj = {
      active: nextActive,
      title: nextTitle,
      message: nextMessage,
      type: nextType,
    };

    const broadcastBannerObj = {
      isActive: nextActive,
      title: nextTitle,
      message: nextMessage,
      type: nextType,
    };

    return {
      announcement: nextMessage,
      appAnnouncement: announcementObj,
      broadcastBanner: broadcastBannerObj,
    };
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
      const saved = await savePatch(
        { externalApiKeyHash },
        { action: "API key eksternal dirotasi", detail: "Kunci baru di-hash dengan SHA-256." }
      );
      if (saved) {
        setGeneratedKey(key);
        setToast({ kind: "success", message: "API key baru tersimpan. Salin sekarang karena nilai mentah tidak disimpan." });
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
        console.error("Settings reset activity log failed", logError);
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

  const settingCard = "rounded-2xl border border-white/[0.08] bg-[#1c1c28] p-5 md:p-6";
  const toggleCard = "flex items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-[#14141e] p-4";
  const inputClass = "mt-1.5 w-full rounded-lg border border-white/10 bg-[#14141e] px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-500 transition";

  return (
    <section className="min-h-full bg-[#14141e] p-4 text-white md:p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-400">Konfigurasi Sistem</p>
          <h1 className="mt-2 text-3xl font-semibold">Status Server, Rilis & Pengaturan</h1>
          <p className="mt-2 text-sm text-slate-400">
            Perubahan disinkronkan secara real-time ke Firestore dokumen <code className="text-indigo-300">SETTINGS/app_config</code> dan disajikan via endpoint <code className="text-sky-300">/api/v1/config</code>.
          </p>
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
          <div className={settingCard + " py-16 text-center text-slate-300"}>Memuat pengaturan aplikasi...</div>
        ) : (
          <div className="space-y-6">
            {/* 1. SECTION: STATUS SERVER & PEMELIHARAAN */}
            <section className={settingCard}>
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="rounded-xl bg-rose-500/10 p-2.5 text-rose-400 border border-rose-500/20">
                    <ShieldWarning size={22} weight="duotone" />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Status Server & Mode Pemeliharaan</h2>
                    <p className="mt-0.5 text-sm text-slate-400">
                      Kontrol status online/offline API saat update database atau perbaikan infrastruktur.
                    </p>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                    settings.maintenanceMode
                      ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                      : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      settings.maintenanceMode ? "bg-rose-400 animate-pulse" : "bg-emerald-400"
                    }`}
                  />
                  {settings.maintenanceMode ? "Maintenance Aktif" : "Server Online"}
                </span>
              </div>

              <div className="space-y-4">
                <label className={toggleCard}>
                  <div>
                    <span className="block font-medium text-white">Aktifkan Maintenance Mode</span>
                    <span className="mt-0.5 block text-xs text-slate-400">
                      Jika aktif, aplikasi mobile dan API eksternal menerima status HTTP 503 dengan pesan di bawah.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.maintenanceMode}
                    disabled={saving}
                    onChange={(event) => {
                      const nextVal = event.target.checked;
                      void savePatch(
                        { maintenanceMode: nextVal },
                        {
                          action: nextVal ? "Maintenance mode diaktifkan" : "Maintenance mode dinonaktifkan",
                          detail: nextVal ? "Server berada dalam pemeliharaan." : "Server kembali online.",
                        }
                      );
                    }}
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
                      const msg = event.target.value;
                      setSettings((prev) => ({ ...prev, maintenanceMessage: msg }));
                      settingsRef.current.maintenanceMessage = msg;
                    }}
                    onBlur={() => {
                      const msg = settingsRef.current.maintenanceMessage.trim();
                      void savePatch(
                        { maintenanceMessage: msg },
                        { action: "Pesan maintenance diubah", detail: msg }
                      );
                    }}
                    className={inputClass}
                  />
                  <span className="mt-1 block text-xs text-slate-500">
                    Pesan ini akan ditampilkan pada dialog pop-up di aplikasi Android saat maintenance aktif.
                  </span>
                </label>
              </div>
            </section>

            {/* 2. SECTION: KONTROL RILIS VERSI APK & FORCE UPDATE */}
            <section className={settingCard}>
              <div className="mb-5 flex items-start gap-3">
                <span className="rounded-xl bg-indigo-500/10 p-2.5 text-indigo-400 border border-indigo-500/20">
                  <Devices size={22} weight="duotone" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-white">Rilis Versi APK & Force Update</h2>
                  <p className="mt-0.5 text-sm text-slate-400">
                    Kelola versi aplikasi Android terbaru, version code minimum, serta aturan pembaruan paksa (*force update*).
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <label className={toggleCard}>
                  <div>
                    <span className="block font-medium text-white">Wajibkan Update (Force Update)</span>
                    <span className="mt-0.5 block text-xs text-slate-400">
                      Jika aktif, pengguna yang memiliki versionCode di bawah versi server tidak dapat menutup dialog pembaruan.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.forceUpdate ?? settings.appUpdate?.forceUpdate ?? false}
                    disabled={saving}
                    onChange={(event) => {
                      const nextForce = event.target.checked;
                      const patch = handleUpdateRelease({ forceUpdate: nextForce });
                      void savePatch(patch, {
                        action: nextForce ? "Force update diwajibkan" : "Force update dinonaktifkan",
                        detail: `Versi ${patch.latestVersion}`,
                      });
                    }}
                    className="h-5 w-5 accent-indigo-500 cursor-pointer"
                    aria-label="Wajibkan Force Update"
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm text-slate-300">
                    Latest Version (Versi Terbaru) *
                    <input
                      value={settings.latestVersion ?? settings.appUpdate?.latestAppVersion ?? "1.2.0"}
                      maxLength={32}
                      placeholder="1.2.0"
                      onChange={(event) => {
                        const val = event.target.value;
                        setSettings((prev) => ({
                          ...prev,
                          latestVersion: val,
                          appUpdate: { ...prev.appUpdate, latestAppVersion: val, latestVersion: val },
                        }));
                        settingsRef.current.latestVersion = val;
                      }}
                      onBlur={() => {
                        const val = (settingsRef.current.latestVersion || "1.2.0").trim();
                        const patch = handleUpdateRelease({ latestVersion: val });
                        void savePatch(patch, {
                          action: "Versi APK terbaru diperbarui",
                          detail: `Versi: ${val}`,
                        });
                      }}
                      className={inputClass}
                    />
                    <span className="mt-1 block text-xs text-slate-500">
                      String versi tampilan aplikasi (contoh: 1.2.0).
                    </span>
                  </label>

                  <label className="block text-sm text-slate-300">
                    Min Version Code (Kode Versi Minimum) *
                    <input
                      type="number"
                      min={1}
                      value={settings.minVersionCode ?? settings.appUpdate?.minVersionCode ?? 1}
                      onChange={(event) => {
                        const val = parseInt(event.target.value, 10) || 1;
                        setSettings((prev) => ({
                          ...prev,
                          minVersionCode: val,
                          appUpdate: { ...prev.appUpdate, minVersionCode: val },
                        }));
                        settingsRef.current.minVersionCode = val;
                      }}
                      onBlur={() => {
                        const val = settingsRef.current.minVersionCode ?? 1;
                        const patch = handleUpdateRelease({ minVersionCode: val });
                        void savePatch(patch, {
                          action: "Minimum version code APK diperbarui",
                          detail: `Code: ${val}`,
                        });
                      }}
                      className={inputClass}
                    />
                    <span className="mt-1 block text-xs text-slate-500">
                      Integer versionCode Android (misal: 10). APK dengan versionCode &lt; nilai ini akan diminta update.
                    </span>
                  </label>
                </div>

                <label className="block text-sm text-slate-300">
                  URL Unduhan APK (apkUrl) *
                  <input
                    type="text"
                    value={settings.apkUrl ?? settings.appUpdate?.downloadUrl ?? "/aplikasi/Komryuu.apk"}
                    placeholder="/aplikasi/Komryuu.apk atau https://domain.com/Komryuu.apk"
                    onChange={(event) => {
                      const val = event.target.value;
                      setSettings((prev) => ({
                        ...prev,
                        apkUrl: val,
                        appUpdate: { ...prev.appUpdate, downloadUrl: val, apkUrl: val },
                      }));
                      settingsRef.current.apkUrl = val;
                    }}
                    onBlur={() => {
                      const val = (settingsRef.current.apkUrl || "/aplikasi/Komryuu.apk").trim();
                      const patch = handleUpdateRelease({ apkUrl: val });
                      void savePatch(patch, {
                        action: "URL download APK diperbarui",
                        detail: val,
                      });
                    }}
                    className={inputClass}
                  />
                  <span className="mt-1 block text-xs text-slate-500">
                    Path publik internal (&apos;/aplikasi/Komryuu.apk&apos;) atau tautan file direct server.
                  </span>
                </label>

                <label className="block text-sm text-slate-300">
                  Catatan Pembaruan (Changelog)
                  <textarea
                    rows={3}
                    value={settings.changelog ?? settings.appUpdate?.changelog ?? ""}
                    placeholder="- Penambahan fitur sinkronisasi bookmark & history&#10;- Pembaruan ekstensi manga & bypass cloudflare&#10;- Peningkatan performa dan kestabilan"
                    onChange={(event) => {
                      const val = event.target.value;
                      setSettings((prev) => ({
                        ...prev,
                        changelog: val,
                        appUpdate: { ...prev.appUpdate, changelog: val },
                      }));
                      settingsRef.current.changelog = val;
                    }}
                    onBlur={() => {
                      const val = (settingsRef.current.changelog || "").trim();
                      const patch = handleUpdateRelease({ changelog: val });
                      void savePatch(patch, {
                        action: "Changelog rilis diperbarui",
                        detail: val.slice(0, 50),
                      });
                    }}
                    className={inputClass}
                  />
                  <span className="mt-1 block text-xs text-slate-500">
                    Teks changelog yang ditampilkan di modal rilis aplikasi pengguna.
                  </span>
                </label>
              </div>
            </section>

            {/* 2.5 SECTION: RIWAYAT RILIS & DISTRIBUSI VERSI APK */}
            <section className={settingCard}>
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="rounded-xl bg-sky-500/10 p-2.5 text-sky-400 border border-sky-500/20">
                    <DownloadSimple size={22} weight="duotone" />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Riwayat Rilis & Distribusi Versi APK</h2>
                    <p className="mt-0.5 text-sm text-slate-400">
                      Kelola riwayat rilis, channel distribusi (Stable / Beta), dan rollback versi 1-klik.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReleaseFormOpen(!releaseFormOpen)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition"
                >
                  <Plus size={15} />
                  {releaseFormOpen ? "Tutup Form" : "Tambah Rilis"}
                </button>
              </div>

              {/* Add Release Form */}
              {releaseFormOpen && (
                <div className="mb-6 rounded-xl border border-indigo-500/20 bg-[#14141e] p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-indigo-300">Form Rilis Baru</h3>
                    <button
                      type="button"
                      disabled={fetchingGithub}
                      onClick={async () => {
                        setFetchingGithub(true);
                        try {
                          const res = await fetch("https://api.github.com/repos/langkingz/Komik-Komryuu/releases/latest");
                          if (!res.ok) throw new Error("GitHub API error");
                          const gh = await res.json() as Record<string, unknown>;
                          const assets = Array.isArray(gh.assets) ? gh.assets : [];
                          const firstAsset = (assets[0] && typeof assets[0] === "object") ? (assets[0] as Record<string, unknown>) : null;
                          setReleaseForm((prev) => ({
                            ...prev,
                            versionName: typeof gh.tag_name === "string" ? gh.tag_name.replace(/^v/, "") : prev.versionName,
                            changelog: typeof gh.body === "string" ? gh.body : prev.changelog,
                            apkUrl: firstAsset && typeof firstAsset.browser_download_url === "string" ? firstAsset.browser_download_url : prev.apkUrl,
                            fileSize: firstAsset && typeof firstAsset.size === "number" ? `${(firstAsset.size / 1024 / 1024).toFixed(1)} MB` : prev.fileSize,
                            releasedAt: typeof gh.published_at === "string" ? gh.published_at.slice(0, 16) : prev.releasedAt,
                          }));
                          setToast({ kind: "success", message: "Data rilis GitHub berhasil diambil." });
                        } catch (err) {
                          setToast({ kind: "error", message: `Gagal mengambil data dari GitHub: ${err instanceof Error ? err.message : "unknown"}` });
                        } finally {
                          setFetchingGithub(false);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#1c1c28] px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.05] disabled:opacity-50 transition"
                    >
                      {fetchingGithub ? "Mengambil..." : "⬇ Ambil dari GitHub Release Terbaru"}
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs text-slate-300">
                      Nama Versi *
                      <input
                        value={releaseForm.versionName}
                        placeholder="1.3.0"
                        onChange={(e) => setReleaseForm((p) => ({ ...p, versionName: e.target.value }))}
                        className={inputClass}
                      />
                    </label>
                    <label className="block text-xs text-slate-300">
                      Version Code *
                      <input
                        type="number"
                        min={1}
                        value={releaseForm.versionCode}
                        onChange={(e) => setReleaseForm((p) => ({ ...p, versionCode: parseInt(e.target.value, 10) || 1 }))}
                        className={inputClass}
                      />
                    </label>
                  </div>

                  <label className="block text-xs text-slate-300">
                    URL Download APK *
                    <input
                      value={releaseForm.apkUrl}
                      placeholder="/aplikasi/Komryuu.apk atau URL GitHub Release"
                      onChange={(e) => setReleaseForm((p) => ({ ...p, apkUrl: e.target.value }))}
                      className={inputClass}
                    />
                  </label>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="block text-xs text-slate-300">
                      Ukuran File
                      <input
                        value={releaseForm.fileSize}
                        placeholder="32.5 MB"
                        onChange={(e) => setReleaseForm((p) => ({ ...p, fileSize: e.target.value }))}
                        className={inputClass}
                      />
                    </label>
                    <label className="block text-xs text-slate-300">
                      Channel
                      <select
                        value={releaseForm.channel}
                        onChange={(e) => setReleaseForm((p) => ({ ...p, channel: e.target.value as "stable" | "beta" }))}
                        className={inputClass}
                      >
                        <option value="stable">Stable (Semua User)</option>
                        <option value="beta">Beta (VIP/Admin)</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-300 pt-5">
                      <input
                        type="checkbox"
                        checked={releaseForm.forceUpdate}
                        onChange={(e) => setReleaseForm((p) => ({ ...p, forceUpdate: e.target.checked }))}
                        className="h-4 w-4 accent-indigo-500"
                      />
                      Wajib Update
                    </label>
                  </div>

                  <label className="block text-xs text-slate-300">
                    Changelog
                    <textarea
                      rows={3}
                      value={releaseForm.changelog}
                      placeholder="- Fitur baru X&#10;- Perbaikan bug Y"
                      onChange={(e) => setReleaseForm((p) => ({ ...p, changelog: e.target.value }))}
                      className={inputClass}
                    />
                  </label>

                  <button
                    type="button"
                    disabled={!releaseForm.versionName.trim() || saving}
                    onClick={async () => {
                      const id = crypto.randomUUID?.() || `rel-${Date.now()}`;
                      const newRelease: AppReleaseItem = {
                        id,
                        versionName: releaseForm.versionName.trim(),
                        versionCode: releaseForm.versionCode,
                        apkUrl: releaseForm.apkUrl.trim() || "/aplikasi/Komryuu.apk",
                        fileSize: releaseForm.fileSize.trim(),
                        channel: releaseForm.channel,
                        forceUpdate: releaseForm.forceUpdate,
                        changelog: releaseForm.changelog.trim(),
                        releasedAt: releaseForm.releasedAt ? new Date(releaseForm.releasedAt).toISOString() : new Date().toISOString(),
                      };
                      const updated = [...releases, newRelease];
                      const ok = await savePatch(
                        { releases: updated },
                        { action: "Rilis baru ditambahkan", detail: `v${newRelease.versionName} (${newRelease.channel})` }
                      );
                      if (ok) {
                        setReleaseForm({
                          versionName: "", versionCode: 1, apkUrl: "/aplikasi/Komryuu.apk",
                          fileSize: "", channel: "stable", forceUpdate: false, changelog: "",
                          releasedAt: new Date().toISOString().slice(0, 16),
                        });
                        setReleaseFormOpen(false);
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-50 transition"
                  >
                    <Check size={16} />
                    Simpan Rilis Baru
                  </button>
                </div>
              )}

              {/* Release History List */}
              {releases.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">Belum ada riwayat rilis. Tambahkan rilis pertama di atas.</p>
              ) : (
                <div className="space-y-3">
                  {[...releases]
                    .sort((a, b) => new Date(b.releasedAt).getTime() - new Date(a.releasedAt).getTime())
                    .map((rel) => {
                      const isActive = rel.id === activeReleaseId;
                      return (
                        <div
                          key={rel.id}
                          className={`rounded-xl border p-4 transition ${
                            isActive
                              ? "border-emerald-500/30 bg-emerald-500/5"
                              : "border-white/[0.08] bg-[#14141e]"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-bold text-white">v{rel.versionName}</span>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                                rel.channel === "beta"
                                  ? "bg-amber-400/10 text-amber-300 border-amber-400/20"
                                  : "bg-indigo-400/10 text-indigo-300 border-indigo-400/20"
                              }`}>
                                {rel.channel === "beta" ? "Beta" : "Stable"}
                              </span>
                              {rel.forceUpdate && (
                                <span className="rounded-full bg-rose-400/10 px-2 py-0.5 text-[10px] font-semibold text-rose-300 border border-rose-400/20">
                                  Force Update
                                </span>
                              )}
                              {isActive && (
                                <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-400/20">
                                  ✓ Aktif
                                </span>
                              )}
                              {rel.fileSize && (
                                <span className="text-[11px] text-slate-500">{rel.fileSize}</span>
                              )}
                              <span className="text-[11px] text-slate-500">
                                {new Date(rel.releasedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {!isActive && (
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={async () => {
                                    const releasePatch = handleUpdateRelease({
                                      latestVersion: rel.versionName,
                                      apkUrl: rel.apkUrl,
                                      changelog: rel.changelog,
                                      forceUpdate: rel.forceUpdate,
                                    });
                                    await savePatch(
                                      { ...releasePatch, activeReleaseId: rel.id },
                                      { action: "Rollback / aktivasi rilis", detail: `v${rel.versionName} diaktifkan` }
                                    );
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/20 transition"
                                >
                                  <ArrowCounterClockwise size={13} />
                                  Aktifkan
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => setDeleteReleaseId(rel.id)}
                                className="rounded-lg border border-rose-500/20 p-1.5 text-rose-400 hover:bg-rose-500/10 transition"
                                title="Hapus rilis"
                              >
                                <Trash size={14} />
                              </button>
                            </div>
                          </div>

                          {rel.changelog && (
                            <p className="mt-2 line-clamp-2 text-xs text-slate-400 whitespace-pre-line">{rel.changelog}</p>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </section>

            {/* Delete Release Confirmation */}
            {deleteReleaseId && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
                <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1c1c28] p-6 shadow-2xl">
                  <h3 className="text-lg font-semibold text-white">Hapus rilis ini?</h3>
                  <p className="mt-2 text-sm text-slate-400">Rilis yang dihapus tidak dapat dikembalikan.</p>
                  <div className="mt-5 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setDeleteReleaseId(null)}
                      className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/10"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={async () => {
                        const updated = releases.filter((r) => r.id !== deleteReleaseId);
                        const patch: Record<string, unknown> = { releases: updated };
                        if (activeReleaseId === deleteReleaseId) {
                          patch.activeReleaseId = "";
                        }
                        await savePatch(patch, { action: "Rilis dihapus", detail: `ID: ${deleteReleaseId}` });
                        setDeleteReleaseId(null);
                      }}
                      className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
                    >
                      <Trash size={15} />
                      Hapus
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 3. SECTION: PENGUMUMAN & BROADCAST APLIKASI */}
            <section className={settingCard}>
              <div className="mb-5 flex items-start gap-3">
                <span className="rounded-xl bg-amber-400/10 p-2.5 text-amber-300 border border-amber-400/20">
                  <Megaphone size={22} weight="duotone" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-white">Pengumuman & Broadcast Aplikasi</h2>
                  <p className="mt-0.5 text-sm text-slate-400">
                    Kirim pesan siaran, banner pemberitahuan, atau peringatan darurat ke seluruh pengguna aplikasi mobile.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <label className={toggleCard}>
                  <div>
                    <span className="block font-medium text-white">Aktifkan Banner Pengumuman</span>
                    <span className="mt-0.5 block text-xs text-slate-400">
                      Tampilkan bilah pengumuman di beranda aplikasi Android.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.appAnnouncement?.active ?? settings.broadcastBanner?.isActive ?? false}
                    disabled={saving}
                    onChange={(event) => {
                      const nextActive = event.target.checked;
                      const patch = handleUpdateAnnouncement({ active: nextActive });
                      void savePatch(patch, {
                        action: nextActive ? "Banner pengumuman diaktifkan" : "Banner pengumuman dinonaktifkan",
                        detail: patch.appAnnouncement.title || patch.appAnnouncement.message || "",
                      });
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
                        value={settings.appAnnouncement?.title ?? settings.broadcastBanner?.title ?? ""}
                        placeholder="Contoh: Maintenance Ekstensi / Fitur Baru"
                        onChange={(event) => {
                          const val = event.target.value;
                          setSettings((prev) => ({
                            ...prev,
                            appAnnouncement: { ...(prev.appAnnouncement || { active: false, title: "", message: "", type: "info" }), title: val },
                            broadcastBanner: { ...prev.broadcastBanner, title: val },
                          }));
                          if (settingsRef.current.appAnnouncement) {
                            settingsRef.current.appAnnouncement.title = val;
                          }
                          settingsRef.current.broadcastBanner.title = val;
                        }}
                        onBlur={() => {
                          const title = settingsRef.current.appAnnouncement?.title ?? settingsRef.current.broadcastBanner.title;
                          const patch = handleUpdateAnnouncement({ title });
                          void savePatch(patch, {
                            action: "Judul pengumuman diubah",
                            detail: title,
                          });
                        }}
                        className={inputClass}
                      />
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300">
                      Tipe Alert
                      <select
                        value={settings.appAnnouncement?.type ?? settings.broadcastBanner?.type ?? "info"}
                        disabled={saving}
                        onChange={(event) => {
                          const nextType = event.target.value as AnnouncementType;
                          const patch = handleUpdateAnnouncement({ type: nextType });
                          void savePatch(patch, {
                            action: "Tipe alert pengumuman diubah",
                            detail: nextType,
                          });
                        }}
                        className={inputClass}
                      >
                        <option value="info">Info (Biru/Informatif)</option>
                        <option value="warning">Warning (Kuning/Peringatan)</option>
                        <option value="update">Update (Hijau/Pembaruan)</option>
                      </select>
                    </label>
                  </div>
                </div>

                <label className="block text-sm text-slate-300">
                  Pesan Pengumuman
                  <textarea
                    rows={3}
                    value={settings.appAnnouncement?.message ?? settings.broadcastBanner?.message ?? ""}
                    placeholder="Tulis pesan lengkap yang akan dibaca pengguna saat membuka aplikasi..."
                    onChange={(event) => {
                      const val = event.target.value;
                      setSettings((prev) => ({
                        ...prev,
                        announcement: val,
                        appAnnouncement: { ...(prev.appAnnouncement || { active: false, title: "", message: "", type: "info" }), message: val },
                        broadcastBanner: { ...prev.broadcastBanner, message: val },
                      }));
                      if (settingsRef.current.appAnnouncement) {
                        settingsRef.current.appAnnouncement.message = val;
                      }
                      settingsRef.current.broadcastBanner.message = val;
                      settingsRef.current.announcement = val;
                    }}
                    onBlur={() => {
                      const message = settingsRef.current.appAnnouncement?.message ?? settingsRef.current.broadcastBanner.message;
                      const patch = handleUpdateAnnouncement({ message });
                      void savePatch(patch, {
                        action: "Pesan pengumuman diubah",
                        detail: message.slice(0, 50),
                      });
                    }}
                    className={inputClass}
                  />
                  <span className="mt-1 block text-xs text-slate-500">
                    Tersimpan otomatis saat kursor meninggalkan kotak input (onBlur).
                  </span>
                </label>
              </div>
            </section>

            {/* 4. SECTION: AKSES API EKSTERNAL */}
            <section className={settingCard}>
              <div className="mb-5 flex items-start gap-3">
                <span className="rounded-xl bg-violet-400/10 p-2.5 text-violet-300 border border-violet-400/20">
                  <Key size={22} weight="duotone" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-white">Akses API Eksternal & Keamanan</h2>
                  <p className="mt-0.5 text-sm text-slate-400">
                    Otorisasi request dari aplikasi Android via header <code className="text-indigo-300">x-api-key</code>.
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
                        ? "API Key aktif tersimpan (SHA-256 hash). Tekan Rotate Key untuk membuat kunci baru."
                        : "Belum ada API key terdaftar"
                    }
                    className="w-full rounded-lg border border-white/10 bg-[#14141e] py-2.5 pl-10 pr-3 font-mono text-xs text-slate-200 outline-none"
                    aria-label="External API Key"
                  />
                </div>
                {generatedKey && (
                  <button
                    type="button"
                    onClick={() => void copyApiKey()}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#14141e] px-4 py-2.5 text-sm text-slate-200 hover:bg-white/[0.05]"
                  >
                    <Copy size={17} />
                    Salin
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void generateApiKey()}
                  disabled={generatingKey || saving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-50 transition"
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
                  Rate Limit (request / menit)
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

            {/* 4.5 SECTION: KONTROL VISIBILITAS FITUR (FEATURE FLAGS) */}
            <section className={settingCard}>
              <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="rounded-xl bg-purple-500/10 p-2.5 text-purple-300 border border-purple-500/20">
                    <Sliders size={22} />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Kontrol Visibilitas Fitur (Feature Flags)</h2>
                    <p className="mt-0.5 text-sm text-slate-400">
                      Atur apakah fitur aplikasi tersedia untuk publik, khusus role Admin (tahap pengembangan), atau berstatus Segera Hadir.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    const summary = Object.entries(featureFlagsDraft)
                      .map(([k, v]) => `${k}=${v}`)
                      .join(", ");
                    void savePatch(
                      { featureFlags: featureFlagsDraft },
                      {
                        action: "Feature Flags diperbarui",
                        detail: summary,
                      }
                    );
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 disabled:opacity-50 transition"
                >
                  <Check size={16} />
                  {saving ? "Menyimpan..." : "Simpan Feature Flags"}
                </button>
              </div>

              <div className="space-y-3">
                {[
                  {
                    key: "cinemaMode",
                    label: "Mode Cinema / Nonton",
                    desc: "Tab dan pemutar video anime/cinema di aplikasi Android.",
                  },
                  {
                    key: "dohProxy",
                    label: "DNS-over-HTTPS Cloudflare",
                    desc: "Bypass pemblokiran ISP melalui resolver DoH 1.1.1.1 bawaan.",
                  },
                  {
                    key: "floatingReadBall",
                    label: "Bola Menu Mengambang",
                    desc: "Kontrol cepat mengambang saat membaca chapter komik.",
                  },
                  {
                    key: "cloudSync",
                    label: "Sinkronisasi Cloud",
                    desc: "Backup & sinkronisasi otomatis bookmark serta riwayat baca ke Firestore.",
                  },
                ].map((item) => {
                  const currentState: FeatureState = featureFlagsDraft[item.key] ?? "enabled";
                  const options: Array<{ value: FeatureState; label: string; activeClass: string }> = [
                    {
                      value: "enabled",
                      label: "Publik / Aktif",
                      activeClass: "bg-emerald-600 text-white border-emerald-500 shadow-sm shadow-emerald-600/30",
                    },
                    {
                      value: "admin_only",
                      label: "Khusus Admin (Dev)",
                      activeClass: "bg-amber-600 text-white border-amber-500 shadow-sm shadow-amber-600/30",
                    },
                    {
                      value: "coming_soon",
                      label: "Segera Hadir (Coming Soon)",
                      activeClass: "bg-purple-600 text-white border-purple-500 shadow-sm shadow-purple-600/30",
                    },
                  ];

                  return (
                    <div
                      key={item.key}
                      className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-[#14141e] p-4 lg:flex-row lg:items-center lg:justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{item.label}</span>
                          <code className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[11px] text-indigo-300">
                            {item.key}
                          </code>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-400">{item.desc}</p>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {options.map((opt) => {
                          const isSelected = currentState === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              disabled={saving}
                              onClick={() =>
                                setFeatureFlagsDraft((prev) => ({
                                  ...prev,
                                  [item.key]: opt.value,
                                }))
                              }
                              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                                isSelected
                                  ? opt.activeClass
                                  : "border-white/10 bg-[#1c1c28] text-slate-400 hover:text-white"
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 5. SECTION: KONTEN DAN PREFERENSI */}
            <section className={settingCard}>
              <div className="mb-5 flex items-start gap-3">
                <span className="rounded-xl bg-emerald-400/10 p-2.5 text-emerald-300 border border-emerald-400/20">
                  <Warning size={22} weight="duotone" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-white">Konten & Kebijakan Aplikasi</h2>
                  <p className="mt-0.5 text-sm text-slate-400">Preferensi global pembatasan fitur dan registrasi.</p>
                </div>
              </div>

              <div className="space-y-3">
                <label className={toggleCard}>
                  <div>
                    <span className="block font-medium text-white">Izinkan Registrasi Pengguna Baru</span>
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
                    <span className="block font-medium text-white">Tampilkan Konten Dewasa / NSFW 18+</span>
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
                <h2 className="mt-1 text-lg font-semibold text-white">Utilitas & Backup Database</h2>
                <p className="mt-0.5 text-sm text-slate-400">Backup mencakup seluruh koleksi EXTENSION dan SETTINGS.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void exportBackup()}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#14141e] px-4 py-2.5 text-sm text-slate-200 hover:bg-white/[0.05] disabled:opacity-50 transition"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-dialog-title"
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1c1c28] p-6 shadow-2xl"
          >
            <h2 id="reset-dialog-title" className="text-xl font-semibold text-white">Reset semua pengaturan?</h2>
            <p className="mt-2 text-sm text-slate-400">
              Nilai SETTINGS/app_config akan diganti dengan default dan API key eksternal yang aktif akan dicabut.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setResetConfirmationOpen(false)}
                disabled={saving}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/10"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void resetSettings()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
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

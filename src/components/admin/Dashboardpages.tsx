"use client";

import { collection, doc, onSnapshot, setDoc, Timestamp } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { logAdminAction } from "@/lib/admin-activity";
import { DEFAULT_APP_SETTINGS, normalizeAppSettings, type AppSettings } from "@/model/app-settings";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Flame,
  Globe,
  HardDrive,
  Inbox,
  Layers,
  Lock,
  LogOut,
  Plus,
  RefreshCw,
  Server,
  Shield,
  ShieldAlert,
  Smartphone,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  Wrench,
  Zap,
} from "lucide-react";

type ExtensionRecord = {
  id: string;
  name: string;
  type: string;
  status: "active" | "inactive";
  createdAt: unknown;
};

type UserRecord = {
  id: string;
  name: string;
  email: string;
  role: string;
  isBanned: boolean;
  provider: string;
  createdAt: unknown;
};

type ReportSummary = {
  id: string;
  status: string;
  type: string;
};

interface DashboardPagesProps {
  onNavigate?: (page: string) => void;
  onLogout?: () => void;
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export default function Dashboardpages({ onNavigate, onLogout }: DashboardPagesProps) {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [extensions, setExtensions] = useState<ExtensionRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingMaintenance, setTogglingMaintenance] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const currentAdmin = auth.currentUser;
  const adminEmail = currentAdmin?.email || "admin@komryuu.x";

  useEffect(() => {
    // 1. Listen USERS (uppercase) with fallback
    const unsubUsers = onSnapshot(
      collection(db, "USERS"),
      (snapshot) => {
        if (!snapshot.empty) {
          setUsers(
            snapshot.docs.map((item) => {
              const data = item.data();
              return {
                id: item.id,
                name: typeof data.name === "string" ? data.name : "",
                email: typeof data.email === "string" ? data.email : "",
                role: typeof data.role === "string" ? data.role.toLowerCase() : "user",
                isBanned: data.isBanned === true,
                provider: typeof data.provider === "string" ? data.provider.toLowerCase() : "google",
                createdAt: data.createdAt,
              };
            })
          );
        } else {
          // fallback lowercase
          onSnapshot(collection(db, "users"), (sub) => {
            setUsers(
              sub.docs.map((item) => {
                const data = item.data();
                return {
                  id: item.id,
                  name: typeof data.name === "string" ? data.name : "",
                  email: typeof data.email === "string" ? data.email : "",
                  role: "user",
                  isBanned: data.status === "inactive",
                  provider: "google",
                  createdAt: data.createdAt,
                };
              })
            );
          });
        }
      },
      (err) => console.error("Error reading users:", err)
    );

    // 2. Listen EXTENSION
    const unsubExtensions = onSnapshot(
      collection(db, "EXTENSION"),
      (snapshot) => {
        setExtensions(
          snapshot.docs.map((item) => {
            const data = item.data();
            return {
              id: item.id,
              name: typeof data.name === "string" ? data.name : "Tanpa Nama",
              type: typeof data.type === "string" ? data.type : "komik",
              status: data.status === "inactive" || data.isActive === false ? "inactive" : "active",
              createdAt: data.createdAt,
            };
          })
        );
      },
      (err) => console.error("Error reading extensions:", err)
    );

    // 3. Listen SETTINGS/app_config
    const unsubSettings = onSnapshot(
      doc(db, "SETTINGS", "app_config"),
      (snapshot) => {
        setSettings(normalizeAppSettings(snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : {}));
      },
      (err) => console.error("Error reading settings:", err)
    );

    // 4. Listen REPORTS
    const unsubReports = onSnapshot(
      collection(db, "REPORTS"),
      (snapshot) => {
        setReports(
          snapshot.docs.map((item) => ({
            id: item.id,
            status: item.data().status || "pending",
            type: item.data().type || "feedback",
          }))
        );
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => {
      unsubUsers();
      unsubExtensions();
      unsubSettings();
      unsubReports();
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Tren 7 Hari Terakhir
  const weeklyGrowthData = useMemo(() => {
    const days: Array<{ label: string; count: number; dateStr: string }> = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayLabel = d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric" });
      days.push({ label: dayLabel, count: 0, dateStr });
    }

    users.forEach((u) => {
      const d = parseDate(u.createdAt);
      if (d) {
        const uStr = d.toISOString().slice(0, 10);
        const target = days.find((item) => item.dateStr === uStr);
        if (target) {
          target.count += 1;
        }
      }
    });

    const maxCount = Math.max(...days.map((item) => item.count), 1);
    return { days, maxCount };
  }, [users]);

  // Distribusi Role & Status
  const distribution = useMemo(() => {
    const total = users.length || 1;
    const banned = users.filter((u) => u.isBanned).length;
    const active = users.length - banned;

    const admins = users.filter((u) => u.role === "admin" || u.role === "moderator").length;
    const vips = users.filter((u) => u.role === "vip").length;
    const standard = users.filter((u) => u.role !== "admin" && u.role !== "moderator" && u.role !== "vip").length;

    const googleUsers = users.filter((u) => u.provider === "google").length;
    const guestUsers = users.length - googleUsers;

    return {
      active,
      banned,
      activePercent: Math.round((active / total) * 100),
      bannedPercent: Math.round((banned / total) * 100),
      admins,
      vips,
      standard,
      googleUsers,
      guestUsers,
    };
  }, [users]);

  const pendingReportsCount = useMemo(() => {
    return reports.filter((r) => r.status === "pending").length;
  }, [reports]);

  // Quick Action: Toggle Maintenance Mode
  async function toggleMaintenanceMode() {
    setTogglingMaintenance(true);
    const nextState = !settings.maintenanceMode;
    try {
      await setDoc(
        doc(db, "SETTINGS", "app_config"),
        {
          maintenanceMode: nextState,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      await logAdminAction(
        adminEmail,
        nextState ? "Maintenance Mode Diaktifkan" : "Maintenance Mode Dinonaktifkan",
        "SETTINGS/app_config",
        `Admin mengubah status pemeliharaan menjadi ${nextState ? "AKTIF (HTTP 503)" : "NONAKTIF (Normal)"}`
      );
      setToast({
        kind: "success",
        message: nextState ? "Maintenance Mode sekarang AKTIF." : "Maintenance Mode dinonaktifkan.",
      });
    } catch (err) {
      console.error("Toggle maintenance error:", err);
      setToast({ kind: "error", message: "Gagal mengubah mode maintenance." });
    } finally {
      setTogglingMaintenance(false);
    }
  }

  // Quick Action: Export System Snapshot Report
  function exportSystemReport() {
    const reportData = {
      generatedAt: new Date().toISOString(),
      admin: adminEmail,
      summary: {
        totalUsers: users.length,
        activeUsers: distribution.active,
        bannedUsers: distribution.banned,
        roles: { admin: distribution.admins, vip: distribution.vips, standard: distribution.standard },
        totalExtensions: extensions.length,
        activeExtensions: extensions.filter((e) => e.status === "active").length,
        pendingReports: pendingReportsCount,
        maintenanceMode: settings.maintenanceMode,
      },
      extensions: extensions.map((e) => ({ id: e.id, name: e.name, type: e.type, status: e.status })),
      reportsSummary: {
        total: reports.length,
        pending: pendingReportsCount,
      },
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `komryuu-system-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToast({ kind: "success", message: "Laporan sistem berhasil diunduh (JSON)." });
  }

  return (
    <section className="min-h-full bg-[#14141e] p-4 text-white md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* HEADER & ADMIN PROFILE SUMMARY */}
        <header className="mb-7 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/[0.08] pb-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300">
              <Sparkles size={12} />
              <span>Ringkasan Eksekutif &amp; Analitik</span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold text-white">Dashboard Monitoring</h1>
            <p className="mt-1 text-sm text-slate-400">
              Pantau metrik pengguna, tren pendaftaran, kesehatan ekstensi, dan antrean tiket masalah.
            </p>
          </div>

          {/* ADMIN PROFILE CARD & QUICK LOGOUT */}
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#1c1c28] p-2.5 pr-4 shadow-lg">
            {currentAdmin?.photoURL ? (
              <img
                src={currentAdmin.photoURL}
                alt=""
                className="h-10 w-10 rounded-xl border border-indigo-500/30 object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-md">
                <Shield size={18} />
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-xs text-white truncate max-w-[140px] sm:max-w-[180px]">
                {currentAdmin?.displayName || adminEmail}
              </p>
              <span className="inline-flex items-center gap-1 text-[10px] text-indigo-300 font-semibold uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Administrator
              </span>
            </div>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="ml-2 rounded-lg border border-white/[0.08] bg-white/[0.03] p-2 text-slate-400 hover:border-rose-500/40 hover:text-rose-300 hover:bg-rose-500/10 transition"
                title="Keluar dari Dashboard"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
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

        {/* TOP METRIC CARDS */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/[0.08] bg-[#1c1c28] p-5 transition hover:border-indigo-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">Total Pengguna</p>
                <p className="mt-2 text-3xl font-bold text-white">{loading ? "—" : users.length}</p>
                <p className="mt-1 text-[11px] text-emerald-400 font-medium">
                  {distribution.active} Aktif • {distribution.banned} Dibanned
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400">
                <Users size={24} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#1c1c28] p-5 transition hover:border-violet-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">Ekstensi Sumber</p>
                <p className="mt-2 text-3xl font-bold text-white">{loading ? "—" : extensions.length}</p>
                <p className="mt-1 text-[11px] text-indigo-300 font-medium">
                  {extensions.filter((e) => e.status === "active").length} Scraper Online
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-400">
                <Layers size={24} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#1c1c28] p-5 transition hover:border-amber-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">Tiket Masalah Pending</p>
                <p className="mt-2 text-3xl font-bold text-amber-300">
                  {loading ? "—" : pendingReportsCount}
                </p>
                <p className="mt-1 text-[11px] text-slate-400 font-medium">
                  {reports.length} Total Laporan Masuk
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400">
                <Inbox size={24} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#1c1c28] p-5 transition hover:border-emerald-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">Mode Sistem</p>
                <p className={`mt-2 text-xl font-bold ${settings.maintenanceMode ? "text-amber-400" : "text-emerald-400"}`}>
                  {settings.maintenanceMode ? "Maintenance" : "Live Normal"}
                </p>
                <p className="mt-1 text-[11px] text-slate-400 truncate max-w-[170px]">
                  {settings.maintenanceMode ? "API blokir 503 aktif" : "API eksternal terbuka"}
                </p>
              </div>
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                  settings.maintenanceMode ? "bg-amber-500/10 text-amber-400" : "bg-emerald-500/10 text-emerald-400"
                }`}
              >
                <Server size={24} />
              </div>
            </div>
          </div>
        </div>

        {/* QUICK ACTIONS PANEL (TOMBOL CEPAT 1-KLIK) */}
        <section className="mt-6 rounded-2xl border border-white/[0.08] bg-[#1c1c28] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={18} className="text-indigo-400" />
              <h2 className="text-base font-bold text-white">Quick Actions Panel</h2>
            </div>
            <span className="text-xs text-slate-500">Tindakan cepat sistem</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Action 1: Toggle Maintenance Mode */}
            <button
              type="button"
              disabled={togglingMaintenance}
              onClick={toggleMaintenanceMode}
              className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition ${
                settings.maintenanceMode
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
                  : "border-white/[0.08] bg-[#14141e] text-slate-200 hover:border-indigo-500/30 hover:bg-[#181824]"
              }`}
            >
              <div className="min-w-0">
                <p className="text-xs font-bold leading-snug">
                  {settings.maintenanceMode ? "Nonaktifkan Maintenance" : "Aktifkan Maintenance"}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {settings.maintenanceMode ? "Kembalikan ke status online" : "Tampilkan pesan HTTP 503"}
                </p>
              </div>
              <div className={`p-2 rounded-lg ${settings.maintenanceMode ? "bg-amber-400 text-slate-950" : "bg-white/5 text-slate-400"}`}>
                <Wrench size={16} />
              </div>
            </button>

            {/* Action 2: Tambah Ekstensi Baru */}
            <button
              type="button"
              onClick={() => onNavigate && onNavigate("Extensions")}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#14141e] p-3.5 text-left transition hover:border-indigo-500/40 hover:bg-[#181824]"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold leading-snug text-white">Kelola Ekstensi Komik</p>
                <p className="text-[10px] text-slate-400 truncate">Tambah atau edit sumber scraper</p>
              </div>
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                <Plus size={16} />
              </div>
            </button>

            {/* Action 3: Cek Laporan Pending */}
            <button
              type="button"
              onClick={() => onNavigate && onNavigate("Reports")}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#14141e] p-3.5 text-left transition hover:border-amber-500/40 hover:bg-[#181824]"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold leading-snug text-white">
                  Cek Laporan Masalah{" "}
                  {pendingReportsCount > 0 && (
                    <span className="ml-1 rounded-full bg-amber-400 px-1.5 py-0.2 text-[10px] text-slate-950 font-extrabold">
                      {pendingReportsCount}
                    </span>
                  )}
                </p>
                <p className="text-[10px] text-slate-400 truncate">Tinjau error scraper &amp; chapter rusak</p>
              </div>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                <Inbox size={16} />
              </div>
            </button>

            {/* Action 4: Export Laporan Sistem */}
            <button
              type="button"
              onClick={exportSystemReport}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#14141e] p-3.5 text-left transition hover:border-emerald-500/40 hover:bg-[#181824]"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold leading-snug text-white">Export Ringkasan Sistem</p>
                <p className="text-[10px] text-slate-400 truncate">Unduh data metrik dalam JSON</p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Download size={16} />
              </div>
            </button>
          </div>
        </section>

        {/* ANALYTICS SECTION: CHARTS */}
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* CHART 1: TREN PERTUMBUHAN PENGGUNA 7 HARI TERAKHIR (SPAN 2 COLS) */}
          <div className="lg:col-span-2 rounded-2xl border border-white/[0.08] bg-[#1c1c28] p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp size={18} className="text-indigo-400" />
                  <h3 className="font-bold text-base text-white">Tren Pendaftaran Pengguna Baru (7 Hari)</h3>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Grafik pertumbuhan akun baru yang tercatat secara real-time di Firestore.
                </p>
              </div>
              <span className="rounded-lg bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-300">
                Live Data
              </span>
            </div>

            {/* LIGHTWEIGHT CSS/SVG BAR CHART */}
            <div className="h-56 w-full flex items-end gap-3 pt-6 pb-2 px-2 border-b border-white/[0.06]">
              {weeklyGrowthData.days.map((day, idx) => {
                const heightPercent = Math.max(Math.round((day.count / weeklyGrowthData.maxCount) * 100), 8);
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
                    <span className="mb-2 text-xs font-mono font-bold text-indigo-300 opacity-0 group-hover:opacity-100 transition">
                      {day.count}
                    </span>
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full max-w-[48px] rounded-t-xl bg-gradient-to-t from-indigo-600 via-indigo-500 to-violet-400 group-hover:from-indigo-500 group-hover:to-violet-300 shadow-lg shadow-indigo-600/20 transition-all duration-300"
                    />
                    <span className="mt-3 text-[11px] text-slate-400 group-hover:text-white transition whitespace-nowrap">
                      {day.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CHART 2: DISTRIBUSI PENGGUNA (ROLE & STATUS) */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#1c1c28] p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 size={18} className="text-violet-400" />
                <h3 className="font-bold text-base text-white">Distribusi Pengguna</h3>
              </div>
              <p className="text-xs text-slate-400 mb-6">Status akun dan segmentasi hak akses.</p>

              {/* Status Split Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300">Status Akun</span>
                  <span className="font-medium text-emerald-400">{distribution.activePercent}% Aktif</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-[#14141e] flex">
                  <div
                    style={{ width: `${distribution.activePercent}%` }}
                    className="bg-emerald-500 transition-all duration-500"
                    title={`Aktif: ${distribution.active}`}
                  />
                  <div
                    style={{ width: `${distribution.bannedPercent}%` }}
                    className="bg-rose-500 transition-all duration-500"
                    title={`Banned: ${distribution.banned}`}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    {distribution.active} Aktif
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    {distribution.banned} Dibanned
                  </span>
                </div>
              </div>

              {/* Roles Breakdown */}
              <div className="mt-6 border-t border-white/[0.06] pt-5 space-y-2 text-xs">
                <span className="text-slate-300 font-semibold block mb-2">Segmentasi Role</span>
                <div className="flex items-center justify-between rounded-lg bg-[#14141e] p-2">
                  <span className="flex items-center gap-1.5 text-rose-300">
                    <Shield size={13} /> Admin &amp; Moderator
                  </span>
                  <span className="font-mono font-bold">{distribution.admins}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-[#14141e] p-2">
                  <span className="flex items-center gap-1.5 text-purple-300">
                    <Sparkles size={13} /> VIP Member
                  </span>
                  <span className="font-mono font-bold">{distribution.vips}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-[#14141e] p-2">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <Users size={13} /> User Standar
                  </span>
                  <span className="font-mono font-bold">{distribution.standard}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-white/[0.06] pt-4 text-xs text-slate-500 flex justify-between items-center">
              <span>Metode Login:</span>
              <span>
                Google ({distribution.googleUsers}) • Guest/Pass ({distribution.guestUsers})
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

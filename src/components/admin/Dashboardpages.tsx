"use client";

import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { DEFAULT_APP_SETTINGS, normalizeAppSettings, type AppSettings } from "@/model/app-settings";
import {
  ArrowRight,
  ArrowUpRight,
  Browser,
  ChartBar,
  ChartPie,
  CheckCircle,
  Clock,
  DownloadSimple,
  Gear,
  Lightning,
  Lock,
  Plus,
  Shield,
  ShieldCheck,
  ShieldWarning,
  SignOut,
  Sliders,
  TrendUp,
  UserCheck,
  Users,
  Warning,
  WarningCircle,
  Wrench,
} from "@phosphor-icons/react";

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

type ActivityRecord = {
  id: string;
  action: string;
  detail: string;
  target?: string;
  adminEmail?: string;
  category?: string;
  date: Date;
};

interface DashboardPagesProps {
  onNavigate?: (page: string) => void;
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export default function Dashboardpages({ onNavigate }: DashboardPagesProps) {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [extensions, setExtensions] = useState<ExtensionRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [activity, setActivity] = useState<ActivityRecord[]>([]);
  const [pendingReportsCount, setPendingReportsCount] = useState<number>(0);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingMaintenance, setTogglingMaintenance] = useState(false);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

    // 1. Listen koleksi USERS (Pastikan USERS uppercase)
    const stopUsers = onSnapshot(
      collection(db, "USERS"),
      (snapshot) => {
        setUsers(
          snapshot.docs.map((item) => {
            const data = item.data();
            return {
              id: item.id,
              name: typeof data.name === "string" ? data.name : "",
              email: typeof data.email === "string" ? data.email : "",
              role: typeof data.role === "string" ? data.role.toLowerCase() : "user",
              isBanned: data.isBanned === true,
              provider: typeof data.provider === "string" ? data.provider : "google",
              createdAt: data.createdAt,
            };
          })
        );
      },
      (err) => console.error("Error reading USERS:", err)
    );

    // 2. Listen EXTENSION
    const stopExtensions = onSnapshot(
      collection(db, "EXTENSION"),
      (snapshot) => {
        setExtensions(
          snapshot.docs.map((item) => {
            const data = item.data();
            return {
              id: item.id,
              name: typeof data.name === "string" ? data.name : "Tanpa nama",
              type: typeof data.type === "string" ? data.type : "komik",
              status: data.status === "inactive" || data.status === false ? "inactive" : "active",
              createdAt: data.createdAt,
            };
          })
        );
      },
      (err) => console.error("Error reading EXTENSION:", err)
    );

    // 3. Listen SETTINGS/app_config
    const stopSettings = onSnapshot(
      doc(db, "SETTINGS", "app_config"),
      (snapshot) => {
        setSettings(normalizeAppSettings(snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : {}));
      },
      (err) => console.error("Error reading SETTINGS:", err)
    );

    // 4. Listen AUDIT_LOGS
    const stopAudit = onSnapshot(
      collection(db, "AUDIT_LOGS"),
      (snapshot) => {
        const list: ActivityRecord[] = [];
        snapshot.forEach((item) => {
          const data = item.data();
          const d = parseDate(data.timestamp || data.createdAt);
          if (d) {
            list.push({
              id: item.id,
              action: typeof data.action === "string" ? data.action : "Aktivitas",
              detail: typeof data.details === "string" ? data.details : "",
              target: typeof data.target === "string" ? data.target : "",
              adminEmail: typeof data.adminEmail === "string" ? data.adminEmail : "",
              category: typeof data.category === "string" ? data.category : "system",
              date: d,
            });
          }
        });
        list.sort((a, b) => b.date.getTime() - a.date.getTime());
        setActivity(list.slice(0, 7));
        setLoading(false);
      },
      () => setLoading(false)
    );

    // 5. Listen REPORTS (Pending count)
    const stopReports = onSnapshot(
      collection(db, "REPORTS"),
      (snapshot) => {
        let pending = 0;
        snapshot.forEach((d) => {
          if (d.data().status === "pending") pending++;
        });
        setPendingReportsCount(pending);
      },
      () => {}
    );

    return () => {
      unsubAuth();
      stopUsers();
      stopExtensions();
      stopSettings();
      stopAudit();
      stopReports();
    };
  }, []);

  // Quick Action: Toggle Maintenance Mode
  async function handleToggleMaintenance() {
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
    } catch (e) {
      console.error(e);
    } finally {
      setTogglingMaintenance(false);
    }
  }

  // Quick Action: Export System Snapshot
  function handleExportSystemSnapshot() {
    const snapshotData = {
      exportedAt: new Date().toISOString(),
      serverStatus: "operational",
      totalUsers: users.length,
      totalExtensions: extensions.length,
      settings,
      recentLogs: activity,
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(snapshotData, null, 2));
    const dlAnchor = document.createElement("a");
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `komryuu-system-snapshot-${new Date().toISOString().split("T")[0]}.json`);
    dlAnchor.click();
  }

  // Analitik 7 Hari Terakhir
  const last7DaysData = useMemo(() => {
    const days: Array<{ label: string; dateStr: string; count: number }> = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayName = d.toLocaleDateString("id-ID", { weekday: "short" });
      days.push({ label: `${dayName} ${d.getDate()}`, dateStr, count: 0 });
    }

    users.forEach((u) => {
      const d = parseDate(u.createdAt);
      if (d) {
        const str = d.toISOString().split("T")[0];
        const match = days.find((item) => item.dateStr === str);
        if (match) match.count++;
      }
    });

    const maxCount = Math.max(...days.map((item) => item.count), 1);
    return { days, maxCount };
  }, [users]);

  // Distribusi Pengguna Berdasarkan Role & Status
  const userRoleDistribution = useMemo(() => {
    const adminCount = users.filter((u) => u.role === "admin" || u.role === "moderator").length;
    const vipCount = users.filter((u) => u.role === "vip").length;
    const regularCount = users.filter((u) => u.role === "user" || !u.role).length;
    const bannedCount = users.filter((u) => u.isBanned).length;
    const activeCount = users.length - bannedCount;

    return {
      adminCount,
      vipCount,
      regularCount,
      bannedCount,
      activeCount,
      total: users.length || 1,
    };
  }, [users]);

  // Counts by category
  const countsByCategory = useMemo(() => {
    const categories = ["komik", "anime", "cinema"];
    return categories.map((type) => {
      const items = extensions.filter((extension) => extension.type === type);
      return {
        type,
        active: items.filter((extension) => extension.status === "active").length,
        inactive: items.filter((extension) => extension.status === "inactive").length,
        total: items.length,
      };
    });
  }, [extensions]);

  async function handleLogout() {
    await signOut(auth);
    document.cookie = "komryuu_session=; path=/; max-age=0;";
    document.cookie = "komryuu_role=; path=/; max-age=0;";
    window.location.href = "/login";
  }

  return (
    <section className="min-h-full bg-[#14141e] p-4 text-white md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* TOP EXECUTIVE BAR: ADMIN PROFILE & ACTIONS */}
        <header className="mb-7 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/[0.07] pb-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-400">Ringkasan Eksekutif</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Admin Dashboard &amp; Analytics</h1>
            <p className="mt-1 text-xs text-slate-400">
              Monitoring real-time aktivitas pengguna, kesehatan ekstensi, dan log keamanan platform.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#1c1c28] p-2 pr-4 shadow-sm">
              {currentUser?.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt=""
                  className="h-9 w-9 rounded-xl object-cover border border-white/10"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/30 text-indigo-300 font-bold text-xs">
                  ADM
                </div>
              )}
              <div className="text-left text-xs">
                <p className="font-semibold text-white truncate max-w-[140px]">
                  {currentUser?.displayName || currentUser?.email?.split("@")[0] || "Admin"}
                </p>
                <span className="inline-flex items-center gap-1 rounded bg-rose-500/20 px-1.5 py-0.2 text-[10px] font-bold text-rose-300">
                  <ShieldCheck size={11} weight="fill" />
                  SUPERADMIN
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition"
              title="Keluar dari akun admin"
            >
              <SignOut size={16} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* 1. TOP METRICS CARDS */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-white/[0.07] bg-[#1c1c28] p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Total Pengguna Terdaftar</span>
              <span className="rounded-xl bg-sky-500/10 p-2 text-sky-400">
                <Users size={18} weight="duotone" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold text-white">{loading ? "—" : users.length}</p>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
              <span className="text-emerald-400">{userRoleDistribution.activeCount} Aktif</span>
              <span className="text-rose-400">{userRoleDistribution.bannedCount} Banned</span>
            </div>
          </article>

          <article className="rounded-2xl border border-white/[0.07] bg-[#1c1c28] p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Ekstensi Sumber Aktif</span>
              <span className="rounded-xl bg-violet-500/10 p-2 text-violet-400">
                <Browser size={18} weight="duotone" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold text-white">
              {loading ? "—" : `${extensions.filter((e) => e.status === "active").length} / ${extensions.length}`}
            </p>
            <p className="mt-2 text-[11px] text-slate-500">Shinigami, Ikiru, Komikcast online</p>
          </article>

          <article className="rounded-2xl border border-white/[0.07] bg-[#1c1c28] p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Tiket Laporan Pending</span>
              <span className="rounded-xl bg-amber-500/10 p-2 text-amber-400">
                <WarningCircle size={18} weight="duotone" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold text-amber-300">{loading ? "—" : pendingReportsCount}</p>
            <button
              type="button"
              onClick={() => onNavigate && onNavigate("Reports")}
              className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300"
            >
              <span>Periksa di menu Laporan</span>
              <ArrowRight size={12} />
            </button>
          </article>

          <article className="rounded-2xl border border-white/[0.07] bg-[#1c1c28] p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Status Maintenance Server</span>
              <span
                className={`rounded-xl p-2 ${
                  settings.maintenanceMode ? "bg-amber-500/10 text-amber-300" : "bg-emerald-500/10 text-emerald-300"
                }`}
              >
                <Lightning size={18} weight="duotone" />
              </span>
            </div>
            <p
              className={`mt-3 text-xl font-bold ${
                settings.maintenanceMode ? "text-amber-300" : "text-emerald-300"
              }`}
            >
              {settings.maintenanceMode ? "Mode Pemeliharaan" : "Sistem Berjalan Normal"}
            </p>
            <p className="mt-2 truncate text-[11px] text-slate-500">
              API Eksternal: {settings.maintenanceMode ? "HTTP 503 Locked" : "HTTP 200 Ready"}
            </p>
          </article>
        </div>

        {/* 2. QUICK ACTIONS PANEL */}
        <section className="mt-6 rounded-2xl border border-white/[0.08] bg-gradient-to-r from-[#1c1c28] to-[#171724] p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Lightning size={16} className="text-indigo-400" />
                <span>Quick Actions Panel</span>
              </h2>
              <p className="text-xs text-slate-400">Perintah cepat 1-klik untuk operasional sistem sehari-hari.</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Quick Action 1: Toggle Maintenance */}
            <button
              type="button"
              onClick={handleToggleMaintenance}
              disabled={togglingMaintenance}
              className={`flex items-center justify-between rounded-xl border p-3.5 text-left transition ${
                settings.maintenanceMode
                  ? "border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20"
                  : "border-white/[0.07] bg-[#14141e] hover:border-white/20"
              }`}
            >
              <div>
                <span className="block text-xs font-semibold text-white">
                  {settings.maintenanceMode ? "Matikan Maintenance" : "Aktifkan Maintenance"}
                </span>
                <span className="text-[10px] text-slate-400">
                  {settings.maintenanceMode ? "Klik untuk normalkan API" : "Kunci API eksternal"}
                </span>
              </div>
              <span
                className={`rounded-lg p-2 ${
                  settings.maintenanceMode ? "bg-amber-500/20 text-amber-300" : "bg-slate-800 text-slate-400"
                }`}
              >
                <Sliders size={18} />
              </span>
            </button>

            {/* Quick Action 2: Tambah Ekstensi */}
            <button
              type="button"
              onClick={() => onNavigate && onNavigate("Extensions")}
              className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-[#14141e] p-3.5 text-left transition hover:border-indigo-500/30 hover:bg-indigo-500/5"
            >
              <div>
                <span className="block text-xs font-semibold text-white">Tambah Ekstensi Baru</span>
                <span className="text-[10px] text-slate-400">Konfigurasi sumber scraper</span>
              </div>
              <span className="rounded-lg bg-indigo-500/20 p-2 text-indigo-400">
                <Plus size={18} weight="bold" />
              </span>
            </button>

            {/* Quick Action 3: Cek Laporan */}
            <button
              type="button"
              onClick={() => onNavigate && onNavigate("Reports")}
              className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-[#14141e] p-3.5 text-left transition hover:border-amber-500/30 hover:bg-amber-500/5"
            >
              <div>
                <span className="block text-xs font-semibold text-white">Tinjau Laporan Error</span>
                <span className="text-[10px] text-amber-300 font-semibold">{pendingReportsCount} tiket pending</span>
              </div>
              <span className="rounded-lg bg-amber-500/20 p-2 text-amber-300">
                <Wrench size={18} />
              </span>
            </button>

            {/* Quick Action 4: Export Snapshot */}
            <button
              type="button"
              onClick={handleExportSystemSnapshot}
              className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-[#14141e] p-3.5 text-left transition hover:border-emerald-500/30 hover:bg-emerald-500/5"
            >
              <div>
                <span className="block text-xs font-semibold text-white">Export Snapshot (JSON)</span>
                <span className="text-[10px] text-slate-400">Unduh data metrik &amp; log</span>
              </div>
              <span className="rounded-lg bg-emerald-500/20 p-2 text-emerald-400">
                <DownloadSimple size={18} />
              </span>
            </button>
          </div>
        </section>

        {/* 3. LIGHTWEIGHT ANALYTICS & CHARTS SECTION */}
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* CHART 1: TREN PERTUMBUHAN PENGGUNA 7 HARI TERAKHIR (SPAN 2) */}
          <section className="lg:col-span-2 rounded-2xl border border-white/[0.07] bg-[#1c1c28] p-5">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <TrendUp size={18} className="text-indigo-400" />
                  <span>Tren Pengguna Baru (7 Hari Terakhir)</span>
                </h3>
                <p className="mt-0.5 text-xs text-slate-400">Registrasi akun baru yang tercatat di database.</p>
              </div>
              <span className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs font-bold text-indigo-300">
                Live Data
              </span>
            </div>

            {/* SVG / CSS BAR CHART */}
            <div className="mt-6">
              <div className="flex h-48 items-end gap-3 sm:gap-6 pt-4 pb-2 px-2">
                {last7DaysData.days.map((item, idx) => {
                  const percentage = Math.max(12, Math.round((item.count / last7DaysData.maxCount) * 100));
                  return (
                    <div key={item.dateStr} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                      <span className="text-[11px] font-mono text-indigo-300 font-semibold group-hover:scale-110 transition">
                        {item.count}
                      </span>
                      <div className="w-full max-w-[42px] bg-white/[0.05] rounded-xl overflow-hidden flex flex-col justify-end h-32">
                        <div
                          style={{ height: `${percentage}%` }}
                          className="w-full bg-gradient-to-t from-indigo-600 via-indigo-500 to-violet-400 rounded-xl transition-all duration-500 group-hover:from-indigo-500 group-hover:to-violet-300 shadow-md shadow-indigo-600/30"
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 tracking-tight text-center truncate max-w-full">
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* CHART 2: DISTRIBUSI ROLE & STATUS PENGGUNA */}
          <section className="rounded-2xl border border-white/[0.07] bg-[#1c1c28] p-5">
            <div className="border-b border-white/[0.06] pb-4">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <ChartPie size={18} className="text-violet-400" />
                <span>Distribusi Role &amp; Status</span>
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">Proporsi tipe akun dan hak akses aktif.</p>
            </div>

            <div className="mt-5 space-y-4 text-xs">
              {/* Role Admin */}
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="h-2 w-2 rounded-full bg-rose-400" />
                    Admin &amp; Moderator
                  </span>
                  <span className="font-mono text-slate-400">
                    {userRoleDistribution.adminCount} ({Math.round((userRoleDistribution.adminCount / userRoleDistribution.total) * 100)}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-[#14141e] overflow-hidden">
                  <div
                    style={{ width: `${(userRoleDistribution.adminCount / userRoleDistribution.total) * 100}%` }}
                    className="h-full bg-rose-500 rounded-full"
                  />
                </div>
              </div>

              {/* Role VIP */}
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="h-2 w-2 rounded-full bg-purple-400" />
                    VIP Member
                  </span>
                  <span className="font-mono text-slate-400">
                    {userRoleDistribution.vipCount} ({Math.round((userRoleDistribution.vipCount / userRoleDistribution.total) * 100)}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-[#14141e] overflow-hidden">
                  <div
                    style={{ width: `${(userRoleDistribution.vipCount / userRoleDistribution.total) * 100}%` }}
                    className="h-full bg-purple-500 rounded-full"
                  />
                </div>
              </div>

              {/* Role User Biasa */}
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="h-2 w-2 rounded-full bg-sky-400" />
                    Pengguna Standar
                  </span>
                  <span className="font-mono text-slate-400">
                    {userRoleDistribution.regularCount} ({Math.round((userRoleDistribution.regularCount / userRoleDistribution.total) * 100)}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-[#14141e] overflow-hidden">
                  <div
                    style={{ width: `${(userRoleDistribution.regularCount / userRoleDistribution.total) * 100}%` }}
                    className="h-full bg-sky-500 rounded-full"
                  />
                </div>
              </div>

              {/* Status Keamanan */}
              <div className="pt-3 border-t border-white/[0.06]">
                <div className="flex justify-between text-slate-300 mb-1">
                  <span className="text-slate-400">Status Akun Aktif</span>
                  <span className="text-emerald-400 font-semibold font-mono">
                    {Math.round((userRoleDistribution.activeCount / userRoleDistribution.total) * 100)}%
                  </span>
                </div>
                <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-[#14141e]">
                  <div
                    style={{ width: `${(userRoleDistribution.activeCount / userRoleDistribution.total) * 100}%` }}
                    className="bg-emerald-500"
                  />
                  <div
                    style={{ width: `${(userRoleDistribution.bannedCount / userRoleDistribution.total) * 100}%` }}
                    className="bg-rose-500"
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* 4. STATUS EKSTENSI PER KATEGORI & LOG AKTIVITAS TERBARU */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Status Kategori */}
          <section className="rounded-2xl border border-white/[0.07] bg-[#1c1c28] p-5">
            <div className="mb-4 flex items-center justify-between border-b border-white/[0.06] pb-3">
              <h3 className="text-base font-semibold text-white">Status Ekstensi per Kategori</h3>
              <button
                type="button"
                onClick={() => onNavigate && onNavigate("Extensions")}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <span>Kelola</span>
                <ArrowRight size={12} />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {countsByCategory.map((category) => (
                <article key={category.type} className="rounded-xl border border-white/[0.07] bg-[#14141e] p-4">
                  <h4 className="font-semibold capitalize text-sm text-white">{category.type}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{category.total} sumber terdaftar</p>
                  <div className="mt-3 flex gap-2 text-xs">
                    <span className="rounded-full bg-emerald-400/10 px-2.5 py-0.5 text-emerald-300 font-semibold">
                      {category.active} aktif
                    </span>
                    {category.inactive > 0 && (
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-400">
                        {category.inactive} off
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* Log Aktivitas Terakhir */}
          <section className="rounded-2xl border border-white/[0.07] bg-[#1c1c28] p-5">
            <div className="mb-4 flex items-center justify-between border-b border-white/[0.06] pb-3">
              <h3 className="text-base font-semibold text-white">Audit Log Aktivitas Terakhir</h3>
              <button
                type="button"
                onClick={() => onNavigate && onNavigate("AuditLogs")}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <span>Lihat Semua</span>
                <ArrowRight size={12} />
              </button>
            </div>

            {activity.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">Belum ada aktivitas tercatat.</p>
            ) : (
              <div className="space-y-3">
                {activity.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-200 truncate">{item.action}</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {item.target ? `${item.target} • ` : ""}
                        {item.detail}
                      </p>
                    </div>
                    <time className="text-[11px] text-slate-500 whitespace-nowrap font-mono">
                      {item.date.toLocaleDateString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                    </time>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}

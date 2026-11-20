"use client";

import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Activity,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Filter,
  History,
  Layers,
  Search,
  Shield,
  ShieldAlert,
  UserCheck,
  Users,
} from "lucide-react";

export interface AuditLogItem {
  id: string;
  adminEmail: string;
  action: string;
  target: string;
  details: string;
  createdAt: string;
}

export default function AuditLogPages() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionCategory, setActionCategory] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const q = query(collection(db, "AUDIT_LOGS"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const items: AuditLogItem[] = snapshot.docs.map((docSnap) => {
            const d = docSnap.data();
            return {
              id: docSnap.id,
              adminEmail: d.adminEmail || "admin@komryuu.x",
              action: d.action || "Aksi Sistem",
              target: d.target || "General",
              details: d.details || "",
              createdAt: d.createdAt || new Date().toISOString(),
            };
          });
          setLogs(items);
        } else {
          // Fallback membaca collection ACTIVITY jika AUDIT_LOGS belum terisi banyak
          const unsubFallback = onSnapshot(
            collection(db, "ACTIVITY"),
            (fallbackSnap) => {
              const fItems: AuditLogItem[] = fallbackSnap.docs.map((docSnap) => {
                const d = docSnap.data();
                return {
                  id: docSnap.id,
                  adminEmail: d.userId || "admin",
                  action: d.action || "Aktivitas",
                  target: "System",
                  details: d.detail || "",
                  createdAt: d.createdAt || new Date().toISOString(),
                };
              });
              setLogs(fItems);
            }
          );
        }
        setLoading(false);
      },
      (err) => {
        console.error("Error reading audit logs:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const now = Date.now();

  const metrics = useMemo(() => {
    const todayLogs = logs.filter((l) => {
      const d = new Date(l.createdAt).getTime();
      return !isNaN(d) && now - d < 24 * 60 * 60 * 1000;
    }).length;

    const uniqueAdmins = new Set(logs.map((l) => l.adminEmail)).size;

    return {
      total: logs.length,
      today: todayLogs,
      admins: uniqueAdmins || 1,
    };
  }, [logs, now]);

  const filteredLogs = useMemo(() => {
    const s = search.trim().toLowerCase();
    return logs.filter((item) => {
      const matchSearch =
        !s ||
        item.adminEmail.toLowerCase().includes(s) ||
        item.action.toLowerCase().includes(s) ||
        item.target.toLowerCase().includes(s) ||
        item.details.toLowerCase().includes(s);

      let matchCategory = true;
      if (actionCategory !== "all") {
        const a = item.action.toLowerCase();
        if (actionCategory === "user") {
          matchCategory = a.includes("pengguna") || a.includes("user") || a.includes("ban") || a.includes("role");
        } else if (actionCategory === "extension") {
          matchCategory = a.includes("ekstensi") || a.includes("extension");
        } else if (actionCategory === "settings") {
          matchCategory = a.includes("pengaturan") || a.includes("setting") || a.includes("api key") || a.includes("maintenance");
        } else if (actionCategory === "report") {
          matchCategory = a.includes("laporan") || a.includes("tiket");
        }
      }

      let matchTime = true;
      if (timeRange !== "all") {
        const t = new Date(item.createdAt).getTime();
        if (!isNaN(t)) {
          if (timeRange === "24h") {
            matchTime = now - t < 24 * 60 * 60 * 1000;
          } else if (timeRange === "7d") {
            matchTime = now - t < 7 * 24 * 60 * 60 * 1000;
          }
        }
      }

      return matchSearch && matchCategory && matchTime;
    });
  }, [logs, search, actionCategory, timeRange, now]);

  function exportLogs() {
    const jsonStr = JSON.stringify(filteredLogs, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function getActionBadge(action: string) {
    const a = action.toLowerCase();
    if (a.includes("ban") || a.includes("hapus") || a.includes("delete")) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-300">
          <ShieldAlert size={12} />
          {action}
        </span>
      );
    }
    if (a.includes("role") || a.includes("hak akses")) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[11px] font-semibold text-purple-300">
          <UserCheck size={12} />
          {action}
        </span>
      );
    }
    if (a.includes("ekstensi")) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-300">
          <Layers size={12} />
          {action}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-300">
        <Activity size={12} />
        {action}
      </span>
    );
  }

  return (
    <section className="min-h-full bg-[#14141e] p-4 text-white md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-400">Akuntabilitas &amp; Keamanan</p>
            <h1 className="mt-2 text-3xl font-semibold">Audit Log Aktivitas Admin</h1>
            <p className="mt-2 text-sm text-slate-400">
              Riwayat kronologis seluruh tindakan modifikasi data, blokir user, dan perubahan konfigurasi sistem.
            </p>
          </div>

          <button
            type="button"
            onClick={exportLogs}
            disabled={filteredLogs.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-[#1c1c28] px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-white/[0.05] disabled:opacity-50 transition"
          >
            <Download size={15} />
            <span>Export Log JSON</span>
          </button>
        </header>

        {/* METRICS CARDS */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/[0.08] bg-[#1c1c28] p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">Total Aktivitas Tercatat</p>
                <p className="mt-2 text-3xl font-bold text-white">{metrics.total}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                <History size={22} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#1c1c28] p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">Aktivitas Hari Ini (24 Jam)</p>
                <p className="mt-2 text-3xl font-bold text-emerald-300">{metrics.today}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <Clock size={22} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#1c1c28] p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">Admin Terlibat</p>
                <p className="mt-2 text-3xl font-bold text-purple-300">{metrics.admins}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
                <Shield size={22} />
              </div>
            </div>
          </div>
        </div>

        {/* FILTERS & SEARCH */}
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-[#1c1c28] p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {/* Category Tabs */}
            {[
              { id: "all", label: "Semua Kategori" },
              { id: "user", label: "Pengguna & Role" },
              { id: "extension", label: "Ekstensi" },
              { id: "settings", label: "Pengaturan & API" },
              { id: "report", label: "Laporan & Tiket" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActionCategory(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  actionCategory === tab.id
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}

            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="rounded-lg border border-white/[0.09] bg-[#14141e] px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
            >
              <option value="all">Semua Waktu</option>
              <option value="24h">24 Jam Terakhir</option>
              <option value="7d">7 Hari Terakhir</option>
            </select>
          </div>

          <div className="relative w-full lg:max-w-xs">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari email admin, aksi, target..."
              className="w-full rounded-xl border border-white/[0.09] bg-[#14141e] py-2 pl-9 pr-3 text-xs text-white outline-none placeholder:text-slate-500 focus:border-indigo-500"
            />
          </div>
        </div>

        {/* LOGS TABLE */}
        {loading ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#1c1c28] py-16 text-center text-slate-400 text-sm">
            Memuat audit log aktivitas...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#1c1c28] py-16 text-center text-slate-400 text-sm">
            Tidak ada riwayat aktivitas yang sesuai filter.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1c1c28]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left">
                <thead className="border-b border-white/[0.07] bg-white/[0.02] text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-4">Waktu &amp; Tanggal</th>
                    <th className="px-5 py-4">Admin Pelaksana</th>
                    <th className="px-5 py-4">Aksi</th>
                    <th className="px-5 py-4">Target Objek</th>
                    <th className="px-5 py-4">Keterangan / Rincian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-xs">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="transition hover:bg-white/[0.02]">
                      <td className="px-5 py-4 text-slate-400 whitespace-nowrap">
                        <p className="font-mono text-slate-200">
                          {new Date(log.createdAt).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {new Date(log.createdAt).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <span className="font-medium text-white">{log.adminEmail}</span>
                      </td>

                      <td className="px-5 py-4">
                        {getActionBadge(log.action)}
                      </td>

                      <td className="px-5 py-4 font-medium text-indigo-300">
                        {log.target || "General"}
                      </td>

                      <td className="px-5 py-4 text-slate-300 max-w-md">
                        <p className="line-clamp-2">{log.details}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

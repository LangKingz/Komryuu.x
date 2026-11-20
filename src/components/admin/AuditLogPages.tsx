"use client";

import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Clock,
  DownloadSimple,
  Funnel,
  Key,
  Lightning,
  MagnifyingGlass,
  Shield,
  ShieldWarning,
  Sliders,
  Terminal,
  User,
} from "@phosphor-icons/react";

export type AuditLogItem = {
  id: string;
  adminEmail: string;
  action: string;
  target: string;
  details: string;
  category: "security" | "extension" | "settings" | "user" | "system";
  createdAt: string;
  timestamp?: unknown;
};

type CategoryFilter = "all" | "security" | "extension" | "settings" | "user" | "system";

function parseDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function relativeTime(value: unknown): string {
  const date = parseDate(value);
  if (!date) return "Baru saja";

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Baru saja";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hari lalu`;
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function categoryBadge(category: string) {
  switch (category) {
    case "security":
      return {
        label: "Keamanan",
        cls: "bg-rose-500/10 text-rose-300 border-rose-500/20",
        icon: ShieldWarning,
      };
    case "extension":
      return {
        label: "Ekstensi",
        cls: "bg-violet-500/10 text-violet-300 border-violet-500/20",
        icon: Lightning,
      };
    case "settings":
      return {
        label: "Pengaturan",
        cls: "bg-amber-500/10 text-amber-300 border-amber-500/20",
        icon: Sliders,
      };
    case "user":
      return {
        label: "Pengguna",
        cls: "bg-sky-500/10 text-sky-300 border-sky-500/20",
        icon: User,
      };
    default:
      return {
        label: "Sistem",
        cls: "bg-slate-700/60 text-slate-300 border-white/5",
        icon: Terminal,
      };
  }
}

export default function AuditLogPages() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "AUDIT_LOGS"),
      (snapshot) => {
        const items: AuditLogItem[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          items.push({
            id: d.id,
            adminEmail: typeof data.adminEmail === "string" ? data.adminEmail : "admin@komryuu.core",
            action: typeof data.action === "string" ? data.action : "Aktivitas Admin",
            target: typeof data.target === "string" ? data.target : "Sistem",
            details: typeof data.details === "string" ? data.details : "",
            category: (data.category as AuditLogItem["category"]) || "system",
            createdAt: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
            timestamp: data.timestamp,
          });
        });

        // Urutkan dari yang terbaru ke terlama
        items.sort((a, b) => {
          const timeA = parseDate(a.timestamp || a.createdAt)?.getTime() || 0;
          const timeB = parseDate(b.timestamp || b.createdAt)?.getTime() || 0;
          return timeB - timeA;
        });

        setLogs(items);
        setLoading(false);
      },
      (err) => {
        console.error("Error loading AUDIT_LOGS:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    return logs.filter((log) => {
      const matchSearch =
        !term ||
        log.action.toLowerCase().includes(term) ||
        log.target.toLowerCase().includes(term) ||
        log.details.toLowerCase().includes(term) ||
        log.adminEmail.toLowerCase().includes(term);

      const matchCat = categoryFilter === "all" || log.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [logs, search, categoryFilter]);

  // Hitung metrik
  const securityCount = logs.filter((l) => l.category === "security").length;
  const settingsCount = logs.filter((l) => l.category === "settings").length;
  const extensionCount = logs.filter((l) => l.category === "extension").length;

  function exportAuditLogs() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const dlAnchor = document.createElement("a");
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `komryuu-audit-logs-${new Date().toISOString().split("T")[0]}.json`);
    dlAnchor.click();
  }

  const filterTabs: Array<{ id: CategoryFilter; label: string }> = [
    { id: "all", label: "Semua Kategori" },
    { id: "security", label: "Keamanan" },
    { id: "user", label: "Pengguna" },
    { id: "extension", label: "Ekstensi" },
    { id: "settings", label: "Pengaturan" },
    { id: "system", label: "Sistem" },
  ];

  return (
    <section className="min-h-full bg-[#14141e] p-4 text-white md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-7">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-400">Security & Governance</p>
            <h1 className="mt-2 text-3xl font-semibold">Audit Logs Aktivitas</h1>
            <p className="mt-1 text-sm text-slate-400">
              Riwayat lengkap setiap tindakan perubahan konfigurasi, ekstensi, dan keamanan oleh admin.
            </p>
          </div>

          <button
            type="button"
            onClick={exportAuditLogs}
            disabled={logs.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#1c1c28] px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-[#232332] hover:text-white transition disabled:opacity-50"
          >
            <DownloadSimple size={16} />
            <span>Export Audit Log (JSON)</span>
          </button>
        </div>

        {/* METRICS */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-white/[0.07] bg-[#1c1c28] p-5">
            <p className="text-xs text-slate-400">Total Aktivitas Tercatat</p>
            <p className="mt-2 text-3xl font-bold text-white">{loading ? "—" : logs.length}</p>
            <p className="mt-1 text-xs text-slate-500">Koleksi AUDIT_LOGS</p>
          </article>
          <article className="rounded-2xl border border-white/[0.07] bg-[#1c1c28] p-5">
            <p className="text-xs text-slate-400">Tindakan Keamanan (Ban/Role)</p>
            <p className="mt-2 text-3xl font-bold text-rose-300">{loading ? "—" : securityCount}</p>
            <p className="mt-1 text-xs text-slate-500">Operasi proteksi akun</p>
          </article>
          <article className="rounded-2xl border border-white/[0.07] bg-[#1c1c28] p-5">
            <p className="text-xs text-slate-400">Perubahan Pengaturan</p>
            <p className="mt-2 text-3xl font-bold text-amber-300">{loading ? "—" : settingsCount}</p>
            <p className="mt-1 text-xs text-slate-500">API Key, Banner &amp; Maintenance</p>
          </article>
          <article className="rounded-2xl border border-white/[0.07] bg-[#1c1c28] p-5">
            <p className="text-xs text-slate-400">Modifikasi Ekstensi</p>
            <p className="mt-2 text-3xl font-bold text-violet-300">{loading ? "—" : extensionCount}</p>
            <p className="mt-1 text-xs text-slate-500">Tambah / Edit scraper</p>
          </article>
        </div>

        {/* FILTERS & SEARCH */}
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-[#1c1c28] p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategoryFilter(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  categoryFilter === tab.id
                    ? "bg-indigo-600 text-white font-semibold"
                    : "text-slate-400 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:max-w-sm">
            <MagnifyingGlass size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari aksi, admin, atau detail..."
              className="w-full rounded-xl border border-white/[0.08] bg-[#14141e] py-2 pl-9 pr-3 text-xs text-white outline-none placeholder:text-slate-500 focus:border-indigo-500 transition"
            />
          </div>
        </div>

        {/* TABLE */}
        {loading ? (
          <div className="rounded-2xl border border-white/[0.07] bg-[#1c1c28] py-16 text-center text-sm text-slate-400">
            Memuat riwayat log...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.07] bg-[#1c1c28] py-16 text-center text-sm text-slate-400">
            {logs.length ? "Tidak ada aktivitas yang sesuai dengan filter." : "Belum ada aktivitas admin tercatat."}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#1c1c28]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-left">
                <thead className="border-b border-white/[0.07] bg-white/[0.02] text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-4">Waktu</th>
                    <th className="px-5 py-4">Admin Pelaksana</th>
                    <th className="px-5 py-4">Kategori &amp; Aksi</th>
                    <th className="px-5 py-4">Target Operasi</th>
                    <th className="px-5 py-4">Rincian Perubahan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-xs">
                  {filteredLogs.map((log) => {
                    const badge = categoryBadge(log.category);
                    return (
                      <tr key={log.id} className="transition hover:bg-white/[0.02]">
                        {/* Waktu */}
                        <td className="px-5 py-4 whitespace-nowrap text-slate-400 font-mono">
                          <span title={new Date(log.createdAt).toLocaleString("id-ID")}>
                            {relativeTime(log.timestamp || log.createdAt)}
                          </span>
                        </td>

                        {/* Admin Pelaksana */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-300 font-bold text-[10px]">
                              A
                            </div>
                            <span className="font-medium text-slate-200">{log.adminEmail}</span>
                          </div>
                        </td>

                        {/* Kategori & Aksi */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}
                            >
                              <badge.icon size={11} />
                              {badge.label}
                            </span>
                            <span className="font-semibold text-white">{log.action}</span>
                          </div>
                        </td>

                        {/* Target Operasi */}
                        <td className="px-5 py-4 text-slate-300 font-medium">
                          {log.target}
                        </td>

                        {/* Rincian */}
                        <td className="px-5 py-4 max-w-xs text-slate-400 truncate">
                          {log.details || "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

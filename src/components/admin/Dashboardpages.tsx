"use client";

import { collection, doc, onSnapshot, Timestamp } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { DEFAULT_APP_SETTINGS, normalizeAppSettings, type AppSettings } from "@/model/app-settings";

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
  status: "active" | "inactive";
  createdAt: unknown;
};

type ActivityRecord = {
  id: string;
  action: string;
  detail: string;
  userId: string;
  date: Date;
};

type ListenerState = {
  ready: boolean;
  error: string | null;
};

type ListenerName = "users" | "extensions" | "settings" | "activity";

function parseDate(value: unknown): Date | null {
  let date: Date | null = null;
  if (value instanceof Timestamp) date = value.toDate();
  else if (value instanceof Date) date = value;
  else if (typeof value === "string" || typeof value === "number") date = new Date(value);
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function readStatus(value: unknown): "active" | "inactive" {
  return value === "inactive" || value === false ? "inactive" : "active";
}

export default function Dashboardpages() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [extensions, setExtensions] = useState<ExtensionRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [activity, setActivity] = useState<ActivityRecord[]>([]);
  const [listeners, setListeners] = useState<Record<ListenerName, ListenerState>>({
    users: { ready: false, error: null },
    extensions: { ready: false, error: null },
    settings: { ready: false, error: null },
    activity: { ready: false, error: null },
  });

  useEffect(() => {
    function updateListener(name: ListenerName, error: string | null = null) {
      setListeners((current) => ({ ...current, [name]: { ready: true, error } }));
    }

    const stopUsers = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        setUsers(snapshot.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            name: typeof data.name === "string" ? data.name : "",
            email: typeof data.email === "string" ? data.email : "",
            status: readStatus(data.status),
            createdAt: data.createdAt,
          };
        }));
        updateListener("users");
      },
      (error) => updateListener("users", error.message)
    );
    const stopExtensions = onSnapshot(
      collection(db, "EXTENSION"),
      (snapshot) => {
        setExtensions(snapshot.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            name: typeof data.name === "string" ? data.name : "Tanpa nama",
            type: typeof data.type === "string" ? data.type : "lainnya",
            status: readStatus(data.status === "active" || data.status === "inactive" ? data.status : data.isActive),
            createdAt: data.createdAt,
          };
        }));
        updateListener("extensions");
      },
      (error) => updateListener("extensions", error.message)
    );
    const stopSettings = onSnapshot(
      doc(db, "SETTINGS", "app_config"),
      (snapshot) => {
        setSettings(normalizeAppSettings(snapshot.exists() ? snapshot.data() : {}));
        updateListener("settings");
      },
      (error) => updateListener("settings", error.message)
    );
    const stopActivity = onSnapshot(
      collection(db, "ACTIVITY"),
      (snapshot) => {
        setActivity(snapshot.docs.flatMap((item) => {
          const data = item.data();
          const date = parseDate(data.createdAt);
          if (!date) return [];
          return [{
            id: item.id,
            action: typeof data.action === "string" ? data.action : "Aktivitas",
            detail: typeof data.detail === "string" ? data.detail : "",
            userId: typeof data.userId === "string" ? data.userId : "",
            date,
          }];
        }));
        updateListener("activity");
      },
      (error) => {
        setActivity([]);
        updateListener("activity", error.message);
      }
    );

    return () => {
      stopUsers();
      stopExtensions();
      stopSettings();
      stopActivity();
    };
  }, []);

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

  const fallbackActivity = useMemo(() => [
    ...users.flatMap((user) => {
      const date = parseDate(user.createdAt);
      return date ? [{
        id: `user-${user.id}`,
        action: "Pengguna terdaftar",
        detail: user.name || user.email,
        userId: user.id,
        date,
      }] : [];
    }),
    ...extensions.flatMap((extension) => {
      const date = parseDate(extension.createdAt);
      return date ? [{
        id: `extension-${extension.id}`,
        action: "Ekstensi ditambahkan",
        detail: extension.name,
        userId: "",
        date,
      }] : [];
    }),
  ], [extensions, users]);

  const latestActivity = useMemo(
    () => [...(activity.length > 0 ? activity : fallbackActivity)]
      .sort((first, second) => second.date.getTime() - first.date.getTime())
      .slice(0, 6),
    [activity, fallbackActivity]
  );
  const isLoading = Object.values(listeners).some((listener) => !listener.ready);
  const hasCoreError = ["users", "extensions", "settings"].some((name) =>
    Boolean(listeners[name as ListenerName].error)
  );
  const activityError = listeners.activity.error;

  return (
    <section className="min-h-full bg-slate-950 p-4 text-white md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-400">Monitoring</p>
          <h1 className="mt-2 text-3xl font-semibold">Dashboard</h1>
          <p className="mt-2 text-sm text-slate-400">Seluruh metrik diperbarui langsung dari Firestore.</p>
        </header>

        {(hasCoreError || activityError) && (
          <div role="alert" className="mb-5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            {hasCoreError
              ? "Beberapa listener Firestore gagal. Periksa Firestore Security Rules dan koneksi."
              : "Log aktivitas tidak dapat diakses; dashboard menampilkan aktivitas turunan data."}
            {activityError && <p className="mt-1 text-xs text-amber-300">{activityError}</p>}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-sm text-slate-400">Total ekstensi</p>
            <p className="mt-3 text-3xl font-semibold">{isLoading ? "—" : extensions.length}</p>
            <p className="mt-2 text-xs text-slate-500">Data live dari EXTENSION</p>
          </article>
          <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-sm text-slate-400">Pengguna terdaftar</p>
            <p className="mt-3 text-3xl font-semibold">{isLoading ? "—" : users.length}</p>
            <p className="mt-2 text-xs text-slate-500">Data live dari users</p>
          </article>
          <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-sm text-slate-400">Status server</p>
            <p className={`mt-3 text-xl font-semibold ${isLoading ? "text-amber-300" : hasCoreError ? "text-rose-300" : "text-emerald-300"}`}>
              {isLoading ? "Memuat..." : hasCoreError ? "Terbatas" : "Firestore online"}
            </p>
            <p className="mt-2 text-xs text-slate-500">Berdasarkan status listener</p>
          </article>
          <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-sm text-slate-400">Mode aplikasi</p>
            <p className={`mt-3 text-xl font-semibold ${settings.maintenanceMode ? "text-amber-300" : "text-emerald-300"}`}>
              {settings.maintenanceMode ? "Maintenance" : "Normal"}
            </p>
            <p className="mt-2 truncate text-xs text-slate-500">
              {settings.maintenanceMode ? settings.maintenanceMessage : settings.announcement || "Tidak ada pengumuman"}
            </p>
          </article>
        </div>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Status ekstensi per kategori</h2>
            <p className="mt-1 text-sm text-slate-400">Ekstensi lama tanpa field status dihitung aktif.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {countsByCategory.map((category) => (
              <article key={category.type} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium capitalize">{category.type}</h3>
                  <span className="text-xs text-slate-500">{category.total} total</span>
                </div>
                <div className="mt-4 flex gap-3 text-sm">
                  <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-emerald-300">
                    {category.active} aktif
                  </span>
                  <span className="rounded-full bg-slate-700 px-3 py-1 text-slate-300">
                    {category.inactive} nonaktif
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Aktivitas terbaru</h2>
              <p className="mt-1 text-sm text-slate-400">Log ACTIVITY live atau fallback waktu pembuatan data.</p>
            </div>
            <span className="rounded-full bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-300">
              {activity.length ? "Live log" : "Fallback"}
            </span>
          </header>
          {isLoading ? (
            <p className="py-6 text-center text-sm text-slate-400">Memuat aktivitas...</p>
          ) : latestActivity.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Belum ada aktivitas.</p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {latestActivity.map((item) => (
                <li key={item.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-slate-200">{item.action}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {item.detail || (item.userId ? `Pengguna ${item.userId}` : "")}
                    </p>
                  </div>
                  <time className="text-xs text-slate-500">{item.date.toLocaleString()}</time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}

"use client";
import React, { useEffect, useState } from "react";

type Extensi = {
  id?: string;
  name: string;
  description?: string;
  logo?: string;
  type: string;
  location?: string;
  BaseUrl?: string;
  UrlSearch?: string;
  createdAt?: string;
};

export default function Dashboardpages() {
  const [items, setItems] = useState<Extensi[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [limit, setLimit] = useState<number | "">("");

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();

      if (typeFilter !== "all") params.set("type", typeFilter);
      if (limit !== "") params.set("limit", String(limit));

      const res = await fetch(`/api/v1/extensi?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const json = await res.json();
      setItems(json.data || []);
    } catch (err: any) {
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onApplyFilters() {
    fetchData();
  }

  function formatDate(d?: string) {
    if (!d) return "-";
    try {
      return new Date(d).toLocaleString();
    } catch {
      return d;
    }
  }

  return (
    <div className="p-6 bg-slate-900 text-white shadow-md">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold">Dashboard Extensions</h2>
          <p className="text-sm text-slate-300">Kelola dan lihat extension yang tersimpan di Firestore</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="px-4 py-2 bg-sky-600 hover:bg-sky-500 rounded text-sm">
            Refresh
          </button>
        </div>
      </header>

      <section className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 bg-slate-800 rounded">
          <div className="text-sm text-slate-400">Total</div>
          <div className="text-xl font-bold">{items.length}</div>
        </div>

        <div className="p-4 bg-slate-800 rounded">
          <div className="text-sm text-slate-400">Filter by type</div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="mt-2 w-full bg-slate-700 text-white px-3 py-2 rounded"
          >
            <option value="all">All</option>
            <option value="komik">Komik</option>
            <option value="anime">Anime</option>
            <option value="cinema">Cinema</option>
          </select>
        </div>

        <div className="p-4 bg-slate-800 rounded">
          <div className="text-sm text-slate-400">Limit</div>
          <div className="flex gap-2 mt-2">
            <input
              type="number"
              value={limit as any}
              onChange={(e) => setLimit(e.target.value === "" ? "" : parseInt(e.target.value))}
              className="w-full bg-slate-700 text-white px-3 py-2 rounded"
              placeholder="e.g. 10"
            />
            <button onClick={onApplyFilters} className="px-4 bg-emerald-600 hover:bg-emerald-500 rounded text-sm">
              Apply
            </button>
          </div>
        </div>
      </section>

      <section>
        {loading ? (
          <div className="py-6 text-center text-slate-300">Loading...</div>
        ) : error ? (
          <div className="py-6 text-center text-red-400">Error: {error}</div>
        ) : items.length === 0 ? (
          <div className="py-6 text-center text-slate-400">No extensions found</div>
        ) : (
          <div className="overflow-x-auto rounded bg-slate-800">
            <table className="w-full text-left min-w-[700px]">
              <thead className="text-slate-400 text-sm">
                <tr>
                  <th className="px-4 py-3"></th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Base URL</th>

                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t border-slate-700">
                    <td className="px-4 py-3">
                      <img src={it.logo} alt={it.name} className="w-10 h-10 object-contain rounded" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{it.name}</div>
                      <div className="text-xs text-slate-400">{it.description}</div>
                    </td>
                    <td className="px-4 py-3">{it.type}</td>
                    <td className="px-4 py-3">{it.location || "-"}</td>
                    <td className="px-4 py-3 break-words">{it.BaseUrl || "-"}</td>

                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <a
                          href={it.BaseUrl || "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs px-2 py-1 bg-slate-700 rounded hover:bg-slate-600"
                        >
                          Visit
                        </a>
                        <button
                          onClick={() => navigator.clipboard?.writeText(it.BaseUrl || "")}
                          className="text-xs px-2 py-1 bg-slate-700 rounded hover:bg-slate-600"
                        >
                          Copy URL
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

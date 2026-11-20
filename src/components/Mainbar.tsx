"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  Download,
  Layers,
  Menu,
  Server,
  Sparkles,
  Terminal,
  X,
  Zap,
} from "lucide-react";

const Mainbar = () => {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Jangan render navbar jika berada di dalam dashboard admin
  if (pathname && (pathname.startsWith("/dashboard") || pathname.startsWith("/(admin)"))) {
    return null;
  }

  const navLinks = [
    { name: "Fitur", href: "#features" },
    { name: "Ekstensi", href: "#extensions" },
    { name: "Statistik", href: "#stats" },
    { name: "API Docs", href: "#api" },
    { name: "Download App", href: "#download" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.08] bg-[#14141e]/80 backdrop-blur-xl transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* LOGO & LIVE STATUS BADGE */}
        <div className="flex items-center gap-4">
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-lg shadow-indigo-500/25 transition-transform group-hover:scale-105">
              <Zap size={18} className="text-white fill-white" />
            </div>
            <div className="flex items-baseline">
              <span className="text-lg font-bold tracking-tight text-white">Komryuu</span>
              <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-lg font-extrabold text-transparent">
                .x
              </span>
            </div>
          </Link>

          {/* STATUS LIVE SERVER BADGE */}
          <div className="hidden items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 sm:flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            <span className="text-[11px] tracking-wide">All Systems Operational</span>
          </div>
        </div>

        {/* DESKTOP NAV LINKS */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Navigasi Utama">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/[0.05] hover:text-white"
            >
              {link.name}
            </a>
          ))}
        </nav>

        {/* RIGHT ACTION: CTA DASHBOARD */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-gradient-to-r from-indigo-600/90 to-violet-600/90 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 transition-all hover:border-indigo-400/50 hover:from-indigo-600 hover:to-violet-600 hover:shadow-indigo-500/30"
          >
            <span>Masuk Dashboard</span>
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* MOBILE MENU TOGGLE BUTTON */}
        <div className="flex items-center gap-2 md:hidden">
          <Link
            href="/dashboard"
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white"
          >
            Dashboard
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-lg p-2 text-slate-300 hover:bg-white/[0.06] hover:text-white"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* MOBILE DRAWER MENU */}
      {mobileMenuOpen && (
        <div className="border-b border-white/[0.08] bg-[#14141e]/95 px-4 pt-2 pb-6 backdrop-blur-2xl md:hidden">
          {/* Status badge di mobile */}
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-xs text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            <span className="font-medium">API v1 & Cloud Sync: Operational</span>
          </div>

          <div className="space-y-1">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-lg px-3 py-2 text-base font-medium text-slate-200 hover:bg-white/[0.06] hover:text-white"
              >
                {link.name}
              </a>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-white/[0.08]">
            <Link
              href="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-sm font-semibold text-white shadow-lg"
            >
              <span>Buka Admin Dashboard</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};

export default Mainbar;

"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Dashboardpages from "@/components/admin/Dashboardpages";
import ExtensiPages from "@/components/admin/ExtensiPages";
import UserPages from "@/components/admin/UserPages";
import SettingPages from "@/components/admin/SettingPages";
import ReportPages from "@/components/admin/ReportPages";
import AuditLogPages from "@/components/admin/AuditLogPages";
import {
  FileText,
  History,
  Inbox,
  Layers,
  LogOut,
  Menu,
  Server,
  Settings,
  Shield,
  User as UserIcon,
  Users,
  X,
  Zap,
} from "lucide-react";

export type AdminTab = "Dashboard" | "Users" | "Extensions" | "Reports" | "AuditLogs" | "Settings";

const AdminDashboard = () => {
  const router = useRouter();
  const [currentPages, setCurrentPages] = useState<string>("Dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsub();
  }, []);

  async function handleLogout() {
    await signOut(auth);
    document.cookie = "komryuu_session=; path=/; max-age=0;";
    document.cookie = "komryuu_role=; path=/; max-age=0;";
    router.push("/login");
  }

  const renderPages = () => {
    switch (currentPages) {
      case "Dashboard":
        return <Dashboardpages onNavigate={setCurrentPages} onLogout={handleLogout} />;
      case "Users":
        return <UserPages />;
      case "Extensions":
        return <ExtensiPages />;
      case "Reports":
        return <ReportPages />;
      case "AuditLogs":
        return <AuditLogPages />;
      case "Settings":
      case "Notifikasi":
        return <SettingPages />;
      default:
        return <Dashboardpages onNavigate={setCurrentPages} onLogout={handleLogout} />;
    }
  };

  const navItems = [
    { label: "Dashboard", title: "Ringkasan & Analitik", icon: Zap },
    { label: "Users", title: "Pengguna & Role", icon: Users },
    { label: "Extensions", title: "Ekstensi Sumber", icon: Layers },
    { label: "Reports", title: "Laporan & Tiket", icon: Inbox },
    { label: "AuditLogs", title: "Audit Log Aktivitas", icon: History },
    { label: "Settings", title: "Pengaturan & API", icon: Settings },
  ];

  return (
    <div className="flex min-h-screen overflow-hidden bg-[#14141e] text-white">
      {/* MOBILE BACKDROP */}
      {menuOpen && (
        <button
          type="button"
          aria-label="Tutup menu"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
        />
      )}

      {/* SIDEBAR NAVIGATION */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col justify-between border-r border-white/[0.08] bg-[#1c1c28] transition-transform duration-300 md:static md:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div>
          {/* BRANDING HEADER */}
          <div className="flex h-18 items-center justify-between border-b border-white/[0.08] px-6 py-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-md">
                <Zap size={18} className="text-white fill-white" />
              </div>
              <div className="flex items-baseline">
                <span className="text-lg font-bold text-white tracking-tight">Komryuu</span>
                <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-lg font-extrabold text-transparent">
                  .x
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="p-1.5 text-slate-400 hover:text-white md:hidden"
            >
              <X size={20} />
            </button>
          </div>

          {/* NAV LINKS */}
          <nav className="space-y-1.5 px-3 py-5" aria-label="Navigasi admin">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPages === item.label;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setCurrentPages(item.label);
                    setMenuOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-xs font-semibold transition ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                      : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  <Icon size={18} className={isActive ? "text-white" : "text-slate-400"} />
                  <span>{item.title}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* ADMIN PROFILE CARD & LOGOUT AT BOTTOM */}
        <div className="border-t border-white/[0.08] p-4">
          <div className="flex items-center justify-between rounded-xl bg-[#14141e] p-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              {currentUser?.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt=""
                  className="h-8 w-8 rounded-lg object-cover border border-white/10"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
                  <Shield size={16} />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-white">
                  {currentUser?.displayName || currentUser?.email?.split("@")[0] || "Admin"}
                </p>
                <p className="text-[10px] text-emerald-400 font-medium">Online • Admin</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-300 transition"
              title="Keluar / Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex min-w-0 flex-1 flex-col overflow-auto bg-[#14141e]">
        {/* TOP MOBILE NAV HEADER */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.08] bg-[#1c1c28]/90 px-4 py-3 backdrop-blur-md md:hidden">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg p-1.5 text-slate-300 hover:bg-white/[0.06]"
              aria-label="Buka menu"
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={22} />
            </button>
            <span className="font-semibold text-sm text-white">
              {navItems.find((i) => i.label === currentPages)?.title || currentPages}
            </span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg p-1.5 text-slate-400 hover:text-rose-300"
            title="Keluar"
          >
            <LogOut size={18} />
          </button>
        </header>

        {renderPages()}
      </main>
    </div>
  );
};

export default AdminDashboard;

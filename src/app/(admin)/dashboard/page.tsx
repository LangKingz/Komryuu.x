"use client";

import React, { useEffect, useState } from "react";
import Dashboardpages from "@/components/admin/Dashboardpages";
import ExtensiPages from "@/components/admin/ExtensiPages";
import UserPages from "@/components/admin/UserPages";
import SettingPages from "@/components/admin/SettingPages";
import AuditLogPages from "@/components/admin/AuditLogPages";
import ReportPages from "@/components/admin/ReportPages";
import {
  Browser,
  Gear,
  House,
  ListDashes,
  Person,
  SignOut,
  WarningCircle,
  Lightning,
} from "@phosphor-icons/react";
import { RiMenu4Fill } from "@remixicon/react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const AdminDashboard = () => {
  const [currentPages, setCurrentPages] = useState<string>("Dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingReports, setPendingReports] = useState(0);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

    const unsubReports = onSnapshot(
      collection(db, "REPORTS"),
      (snap) => {
        let count = 0;
        snap.forEach((d) => {
          if (d.data().status === "pending") count++;
        });
        setPendingReports(count);
      },
      () => {}
    );

    return () => {
      unsubAuth();
      unsubReports();
    };
  }, []);

  async function handleLogout() {
    await signOut(auth);
    document.cookie = "komryuu_session=; path=/; max-age=0;";
    document.cookie = "komryuu_role=; path=/; max-age=0;";
    window.location.href = "/login";
  }

  const renderPages = () => {
    switch (currentPages) {
      case "Dashboard":
        return <Dashboardpages onNavigate={(page) => setCurrentPages(page)} />;
      case "Users":
        return <UserPages />;
      case "Extensions":
        return <ExtensiPages />;
      case "Reports":
        return <ReportPages />;
      case "AuditLogs":
        return <AuditLogPages />;
      case "Notifikasi":
      case "Settings":
        return <SettingPages />;
      default:
        return <Dashboardpages onNavigate={(page) => setCurrentPages(page)} />;
    }
  };

  const navItems = [
    { label: "Dashboard", title: "Ringkasan", icon: <House size={20} weight="duotone" /> },
    { label: "Users", title: "Pengguna & Role", icon: <Person size={20} weight="duotone" /> },
    { label: "Extensions", title: "Ekstensi Komik", icon: <Browser size={20} weight="duotone" /> },
    {
      label: "Reports",
      title: "Laporan & Tiket",
      icon: <WarningCircle size={20} weight="duotone" />,
      badge: pendingReports > 0 ? pendingReports : undefined,
    },
    { label: "AuditLogs", title: "Audit Log Aktivitas", icon: <ListDashes size={20} weight="duotone" /> },
    { label: "Settings", title: "Pengaturan Global", icon: <Gear size={20} weight="duotone" /> },
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
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col overflow-y-auto border-r border-white/[0.08] bg-[#1c1c28] shadow-2xl transition-transform duration-300 md:static md:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* BRANDING HEADER */}
        <div className="flex h-20 items-center justify-between px-6 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-lg shadow-indigo-600/30">
              <Lightning size={20} weight="fill" className="text-white" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white">Komryuu</span>
              <span className="text-indigo-400 font-extrabold text-lg">.x</span>
            </div>
          </div>
        </div>

        {/* NAVIGATION LINKS */}
        <nav className="flex-1 space-y-1 px-3 py-5" aria-label="Navigasi admin">
          {navItems.map((item) => {
            const isActive = currentPages === item.label || (item.label === "Settings" && currentPages === "Notifikasi");
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setCurrentPages(item.label);
                  setMenuOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-left text-xs font-semibold transition ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                    : "text-slate-300 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={isActive ? "text-white" : "text-slate-400"}>{item.icon}</span>
                  <span>{item.title}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-slate-950">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* BOTTOM USER PROFILE & LOGOUT */}
        <div className="border-t border-white/[0.06] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              {currentUser?.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt=""
                  className="h-8 w-8 rounded-full object-cover border border-indigo-400/30 flex-shrink-0"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white flex-shrink-0">
                  A
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">
                  {currentUser?.displayName || currentUser?.email?.split("@")[0] || "Admin"}
                </p>
                <p className="text-[10px] text-slate-400 truncate">{currentUser?.email}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg p-2 text-slate-400 hover:bg-rose-500/10 hover:text-rose-300 transition"
              title="Logout"
            >
              <SignOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex min-w-0 flex-1 flex-col overflow-auto bg-[#14141e]">
        {/* MOBILE TOP BAR */}
        <nav className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.07] bg-[#14141e]/90 p-4 backdrop-blur-md text-white md:hidden">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="cursor-pointer rounded-lg p-2 text-slate-300 hover:bg-white/[0.06]"
              aria-label="Buka menu"
              onClick={() => setMenuOpen((isOpen) => !isOpen)}
            >
              <RiMenu4Fill size={22} />
            </button>
            <span className="font-semibold text-sm">
              {navItems.find((item) => item.label === currentPages)?.title || currentPages}
            </span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg p-2 text-slate-400 hover:text-rose-300"
            title="Logout"
          >
            <SignOut size={18} />
          </button>
        </nav>

        {renderPages()}
      </main>
    </div>
  );
};

export default AdminDashboard;

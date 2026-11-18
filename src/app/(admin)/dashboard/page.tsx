"use client";

import Dashboardpages from "@/components/admin/Dashboardpages";
import ExtensiPages from "@/components/admin/ExtensiPages";
import UserPages from "@/components/admin/UserPages";
import SettingPages from "@/components/admin/SettingPages";
import { Browser, Gear, House, Person } from "@phosphor-icons/react";
import { RiMenu4Fill } from "@remixicon/react";
import React, { useState } from "react";

const AdminDashboard = () => {
  const [currentPages, setCurrentPages] = useState<string>("Dashboard");
  const [menuOpen, setMenuOpen] = useState(false);

  const renderPages = () => {
    switch (currentPages) {
      case "Dashboard":
        return <Dashboardpages />;
      case "Users":
        return <UserPages />;
      case "Extensions":
        return <ExtensiPages />;
      case "Notifikasi":
        return <SettingPages />;
      default:
        return <div>Dashboard Page</div>;
    }
  };

  return (
    <div className="flex min-h-screen overflow-hidden bg-slate-950">
      {menuOpen && (
        <button
          type="button"
          aria-label="Tutup menu"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col overflow-y-auto bg-slate-900 text-white shadow-lg transition-transform duration-300 md:static md:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-20 items-center justify-center p-6">
          <h1 className="ml-3 text-2xl font-bold text-blue-500">Komryuu</h1>
        </div>
        <nav className="flex-1 space-y-2 px-4 py-6 text-white" aria-label="Navigasi admin">
          {[
            { label: "Dashboard", icon: <House size={22} /> },
            { label: "Users", title: "Pengguna", icon: <Person size={22} /> },
            { label: "Extensions", title: "Extensi", icon: <Browser size={22} /> },
            { label: "Notifikasi", title: "Pengaturan", icon: <Gear size={22} /> },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                setCurrentPages(item.label);
                setMenuOpen(false);
              }}
              aria-current={currentPages === item.label ? "page" : undefined}
              className={`flex w-full items-center rounded-lg px-4 py-3 text-left font-medium transition-colors duration-200 ${
                currentPages === item.label ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-700"
              }`}
            >
              {item.icon}
              <span className="ml-4">{item.title ?? item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-auto">
        <nav className="sticky top-0 z-30 flex items-center gap-4 bg-slate-900 p-4 text-white shadow-md">
          <button
            type="button"
            className="cursor-pointer rounded-lg p-2 hover:bg-slate-800 md:hidden"
            aria-label="Buka menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((isOpen) => !isOpen)}
          >
            <RiMenu4Fill size={24} />
          </button>
          <span className="font-medium">{currentPages === "Users" ? "Pengguna" : currentPages === "Extensions" ? "Extensi" : currentPages}</span>
        </nav>
        {renderPages()}
      </main>
    </div>
  );
};

export default AdminDashboard;

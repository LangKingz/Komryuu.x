"use client";

import Dashboardpages from "@/components/admin/Dashboardpages";
import { Browser, Gear, House, Person } from "@phosphor-icons/react";
import { RiMenu4Fill } from "@remixicon/react";
import React, { useState } from "react";

const AdminDashboard = () => {
  const [currentPages, setCurrentPages] = useState<string>("Dashboard");

  const renderPages = () => {
    switch (currentPages) {
      case "Dashboard":
        return <Dashboardpages />;
      case "Users":
        return <div>Users Page</div>;
      case "Extensions":
        return <div>Extensions Page</div>;
      case "Notifikasi":
        return <div>Notifikasi Page</div>;
      default:
        return <div>Dashboard Page</div>;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="fixed bg-slate-900  inset-y-0 left-0 z-50 flex h-full w-64 transform flex-col overflow-y-auto text-white shadow-lg transition-transform duration-300 ease-in-out -translate-x-full md:translate-x-0 md:static md:inset-0">
        <div className="flex items-center justify-center p-6 h-20 ">
          <h1 className="ml-3 text-2xl font-bold text-blue-600">Komryuu</h1>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2 text-white">
          <a href="#" className={`flex items-center px-4 py-3 text-base-200 bg-blue-600 rounded-lg font-medium transition-colors duration-200`}>
            <House size={24} />
            <span className="ml-4">Dashboard</span>
          </a>

          <a href="#" className={`flex items-center px-4 py-3  hover:bg-slate-500 rounded-lg font-medium transition-colors duration-200`}>
            <Person size={24} />
            <span className="ml-4">Pengguna</span>
          </a>

          <a href="#" className={`flex items-center px-4 py-3  hover:bg-slate-500 rounded-lg font-medium transition-colors duration-200`}>
            <Browser size={24} />
            <span className="ml-4">Extensi</span>
          </a>

          <a href="#" className={`flex items-center px-4 py-3  hover:bg-slate-500 rounded-lg font-medium transition-colors duration-200`}>
            <Gear size={24} />
            <span className="ml-4">Pengaturan</span>
          </a>
        </nav>
      </aside>

      <main className=" flex-1 flex flex-col overflow-auto">
        <nav className="sticky top-0 bg-slate-900 text-white p-4 shadow-md z-10">
          <button className="cursor-pointer">
            <RiMenu4Fill size={24}/>
          </button>
        </nav>
        {renderPages()}
      </main>
    </div>
  );
};

export default AdminDashboard;

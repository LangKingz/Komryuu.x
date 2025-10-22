"use client";

import { ChartPieSliceIcon, Download, Megaphone, StudentIcon } from "@phosphor-icons/react";
import { HomeIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

const menuItems = [
  {
    icon: <HomeIcon size={24} />,
    href: "/",
    onclick: () => {
      console.log("clicked");
    },
    name: "Home",
  },
  {
    icon: <ChartPieSliceIcon size={24} />,
    href: "/s",
    onclick: () => {
      console.log("clicked");
    },
    name: "Stats",
  },
  {
    icon: <Download size={24} />,
    href: "/",
    onclick: () => {
      console.log("clicked");
    },
    name: "Downloads",
  },
];
const MenuBar = () => {
  const path = usePathname();

  return (
    <>
      {menuItems.map((items, index) => (
        <li key={index} className={` border p-3 ${path === items.href ? "" : ""} ${items.name === "Downloads" && "bg-gradient-to-r from-purple-600 to-blue-600 border-none"} border-white rounded-xl bg-black`}>
          <Link href={items.href} onClick={items.onclick}>
            <div className="flex gap-3">
              {items.icon}
              {path === items.href && <span className="">{items.name}</span>}
            </div>
          </Link>
        </li>
      ))}
    </>
  );
};

const DisiblePathMenuBar = () => {};

const Mainbar = () => {
  return (
    <div className="fixed bottom-0 flex justify-center w-full">
      <ul className="flex gap-3 p-2 bg-transparent text-white m-2 rounded-2xl">
        <MenuBar />
      </ul>
    </div>
  );
};

export default Mainbar;

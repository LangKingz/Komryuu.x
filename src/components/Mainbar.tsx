"use client";

import { ChartPieSliceIcon, Download, Megaphone, NewspaperClippingIcon, StudentIcon } from "@phosphor-icons/react";
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
    icon: <NewspaperClippingIcon size={24} />,
    href: "/s",
    onclick: () => {
      const modal = document.getElementById("my_modal_1") as HTMLDialogElement;
      modal?.showModal();
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
        <li
          key={index}
          className={` border p-3 ${path === items.href ? "" : ""} ${
            items.name === "Downloads" && "bg-gradient-to-r from-purple-600 to-blue-600 border-none"
          } border-white rounded-xl bg-black`}
        >
          <Link href={items.href} onClick={items.onclick}>
            <div className="flex gap-3">
              <div className={`${items.name === "Downloads" && "animate-bounce"}`}>{items.icon}</div>
              {path === items.href && <span className="">{items.name}</span>}
            </div>
          </Link>
        </li>
      ))}
    </>
  );
};

const DisiblePathMenuBar = () => {
  const path = usePathname();
  const disablePaths = ["/dashboard", "/login", "/register"];

  return disablePaths.includes(path) ? null : <MenuBar />;
};

const Mainbar = () => {
  return (
    <>
      <div className="fixed bottom-0 flex justify-center w-full">
        <ul className="flex gap-3 p-2 bg-transparent text-white m-2 rounded-2xl">
          <DisiblePathMenuBar />
        </ul>
      </div>
      <dialog id="my_modal_1" className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-lg">Hello!</h3>
          <p className="py-4">Press ESC key or click the button below to close</p>
          <div className="modal-action">
            <form method="dialog">
              {/* if there is a button in form, it will close the modal */}
              <button className="btn">Close</button>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
};

export default Mainbar;

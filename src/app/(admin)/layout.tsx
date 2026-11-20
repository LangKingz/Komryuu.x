"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  ArrowLeft,
  Loader2,
  Lock,
  LogOut,
  ShieldAlert,
  ShieldX,
  UserCheck,
} from "lucide-react";

interface AdminRouteGuardProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminRouteGuardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string>("user");
  const [canAccess, setCanAccess] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [banReason, setBanReason] = useState("");

  useEffect(() => {
    let unsubscribeFirestore: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // Hapus cookie sesi jika ada
        document.cookie = "komryuu_session=; path=/; max-age=0;";
        document.cookie = "komryuu_role=; path=/; max-age=0;";
        setCurrentUser(null);
        setCanAccess(false);
        setLoading(false);
        router.push("/login?redirect=/dashboard");
        return;
      }

      setCurrentUser(user);

      // Listen dokumen user di Firestore secara real-time
      const userDocRef = doc(db, "USERS", user.uid);
      unsubscribeFirestore = onSnapshot(
        userDocRef,
        async (snapshot) => {
          if (!snapshot.exists()) {
            // User belum terdaftar di USERS
            setCanAccess(false);
            setLoading(false);
            return;
          }

          const data = snapshot.data();
          const role = typeof data.role === "string" ? data.role.toLowerCase() : "user";
          const banned = data.isBanned === true;
          const reason = typeof data.banReason === "string" ? data.banReason : "";
          const permissions =
            data.permissions && typeof data.permissions === "object"
              ? (data.permissions as Record<string, unknown>)
              : {};
          const canAccessAdmin =
            role === "admin" ||
            role === "moderator" ||
            permissions.canAccessAdminPanel === true;

          setUserRole(role);
          setIsBanned(banned);
          setBanReason(reason);

          if (banned) {
            // Jika akun dibanned, otomatis logout
            await signOut(auth);
            document.cookie = "komryuu_session=; path=/; max-age=0;";
            document.cookie = "komryuu_role=; path=/; max-age=0;";
            setCanAccess(false);
          } else {
            // Perbarui cookie sesi
            document.cookie = `komryuu_session=${user.uid}; path=/; max-age=604800; SameSite=Lax`;
            document.cookie = `komryuu_role=${role}; path=/; max-age=604800; SameSite=Lax`;
            setCanAccess(canAccessAdmin);
          }

          setLoading(false);
        },
        (error) => {
          console.error("Error reading admin user data:", error);
          setCanAccess(false);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
    };
  }, [router]);

  async function handleSignOut() {
    await signOut(auth);
    document.cookie = "komryuu_session=; path=/; max-age=0;";
    document.cookie = "komryuu_role=; path=/; max-age=0;";
    router.push("/login");
  }

  // 1. LOADING STATE
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#14141e] text-white">
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-white/[0.08] bg-[#1c1c28] p-8 shadow-2xl">
          <Loader2 size={36} className="animate-spin text-indigo-500" />
          <div className="text-center">
            <p className="text-base font-semibold text-white">Memverifikasi Otoritas Admin</p>
            <p className="mt-1 text-xs text-slate-400">Memeriksa izin akses dan status akun...</p>
          </div>
        </div>
      </div>
    );
  }

  // 2. BANNED ACCOUNT STATE
  if (isBanned) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#14141e] p-4 text-white">
        <div className="w-full max-w-md rounded-3xl border border-rose-500/30 bg-[#1c1c28] p-7 text-center shadow-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400">
            <ShieldX size={32} />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-white">Akun Anda Telah Diblokir</h2>
          <p className="mt-2 text-sm text-slate-300">
            Akses ke dashboard dan platform ditangguhkan oleh administrator.
          </p>
          {banReason && (
            <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3.5 text-xs text-rose-200">
              <strong>Alasan:</strong> {banReason}
            </div>
          )}
          <div className="mt-6 flex flex-col gap-2.5">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/[0.06] py-2.5 text-sm font-semibold text-white hover:bg-white/[0.1] transition"
            >
              <ArrowLeft size={16} />
              <span>Kembali ke Beranda</span>
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-500/30 py-2.5 text-sm font-semibold text-rose-300 hover:bg-rose-500/10 transition"
            >
              <LogOut size={16} />
              <span>Keluar Akun</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. 403 FORBIDDEN (PENGGUNA BIASA / VIP TIDAK MEMILIKI AKSES KE DASHBOARD)
  if (!canAccess) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#14141e] p-4 text-white">
        <div className="w-full max-w-lg rounded-3xl border border-amber-500/30 bg-[#1c1c28] p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Lock size={32} />
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-amber-400">
            Error 403 • Akses Dibatasi
          </p>
          <h2 className="mt-2 text-2xl font-extrabold text-white sm:text-3xl">
            Akses Ditolak (Khusus Administrator)
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            Halo <strong>{currentUser?.displayName || currentUser?.email || "Pengguna"}</strong>, Anda
            saat ini login dengan role{" "}
            <span className="rounded bg-slate-800 px-2 py-0.5 font-semibold text-sky-300 uppercase text-xs">
              {userRole}
            </span>
            . Dashboard kontrol ini hanya dapat diakses oleh akun bertipe <strong>Admin</strong> atau{" "}
            <strong>Moderator</strong>.
          </p>

          <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/profile"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition"
            >
              <UserCheck size={16} />
              <span>Buka Profil Pengguna</span>
            </Link>
            <Link
              href="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.03] px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/[0.08] transition"
            >
              <ArrowLeft size={16} />
              <span>Kembali ke Beranda</span>
            </Link>
          </div>

          <div className="mt-6 border-t border-white/[0.07] pt-4">
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-300 transition"
            >
              <LogOut size={14} />
              <span>Beralih / Keluar dari Akun Ini</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. AKSES DITERIMA (ROLE ADMIN / MODERATOR)
  return <div className="bg-[#14141e] text-white min-h-screen">{children}</div>;
}

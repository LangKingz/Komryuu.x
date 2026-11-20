"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  User,
  Zap,
} from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get("redirect") || "";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cek apakah sudah login sebelumnya
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userSnap = await getDoc(doc(db, "USERS", user.uid));
          if (userSnap.exists()) {
            const data = userSnap.data();
            if (data.isBanned === true) {
              await signOut(auth);
              setError("Akun Anda telah diblokir.");
              return;
            }
            const role = typeof data.role === "string" ? data.role.toLowerCase() : "user";
            const perms = (data.permissions && typeof data.permissions === "object")
              ? (data.permissions as Record<string, unknown>)
              : {};
            const canAdmin = role === "admin" || role === "moderator" || perms.canAccessAdminPanel === true;

            // Simpan cookie sesi
            document.cookie = `komryuu_session=${user.uid}; path=/; max-age=604800; SameSite=Lax`;
            document.cookie = `komryuu_role=${role}; path=/; max-age=604800; SameSite=Lax`;

            if (canAdmin) {
              router.push(redirectTarget || "/dashboard");
            } else {
              router.push("/profile");
            }
          }
        } catch (e) {
          console.error("Auto login error:", e);
        }
      }
    });

    return () => unsub();
  }, [router, redirectTarget]);

  async function handleLoginSuccess(uid: string, userEmail: string, displayName: string, photoUrl: string, provider: string) {
    const userRef = doc(db, "USERS", uid);
    const existingSnap = await getDoc(userRef);

    let role = "user";
    let isBanned = false;
    let banReason = "";
    let canAccessAdmin = false;

    if (!existingSnap.exists()) {
      // Buat akun baru di USERS
      const defaultPerms = {
        canAccessAdminPanel: false,
        canManageExtensions: false,
        canBanUsers: false,
        bypassRateLimit: false,
        canAccessNsfw: false,
      };

      await setDoc(userRef, {
        uid,
        email: userEmail,
        name: displayName || userEmail.split("@")[0],
        photoUrl: photoUrl || "",
        provider,
        role: "user",
        permissions: defaultPerms,
        isBanned: false,
        banReason: "",
        bannedAt: null,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      });
    } else {
      const data = existingSnap.data();
      isBanned = data.isBanned === true;
      banReason = typeof data.banReason === "string" ? data.banReason : "";
      role = typeof data.role === "string" ? data.role.toLowerCase() : "user";
      const perms = (data.permissions && typeof data.permissions === "object")
        ? (data.permissions as Record<string, unknown>)
        : {};
      canAccessAdmin = role === "admin" || role === "moderator" || perms.canAccessAdminPanel === true;

      if (isBanned) {
        await signOut(auth);
        document.cookie = "komryuu_session=; path=/; max-age=0;";
        document.cookie = "komryuu_role=; path=/; max-age=0;";
        setError(`Akun Anda telah diblokir. Alasan: ${banReason || "Pelanggaran aturan"}`);
        setLoading(false);
        setGoogleLoading(false);
        return;
      }

      await updateDoc(userRef, {
        lastLoginAt: serverTimestamp(),
      });
    }

    // Tulis session cookie untuk middleware
    document.cookie = `komryuu_session=${uid}; path=/; max-age=604800; SameSite=Lax`;
    document.cookie = `komryuu_role=${role}; path=/; max-age=604800; SameSite=Lax`;

    // Pengalihan berdasarkan role
    if (canAccessAdmin || role === "admin" || role === "moderator") {
      router.push(redirectTarget || "/dashboard");
    } else {
      router.push("/profile");
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setGoogleLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      await handleLoginSuccess(
        user.uid,
        user.email || "",
        user.displayName || "",
        user.photoURL || "",
        "google"
      );
    } catch (err: unknown) {
      console.error("Google sign in failed:", err);
      const msg = err instanceof Error ? err.message : "Gagal masuk menggunakan Google.";
      setError(msg);
      setGoogleLoading(false);
    }
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Email dan password wajib diisi.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        await handleLoginSuccess(
          cred.user.uid,
          cred.user.email || email.trim(),
          cred.user.displayName || "",
          cred.user.photoURL || "",
          "password"
        );
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await handleLoginSuccess(
          cred.user.uid,
          cred.user.email || email.trim(),
          name.trim() || email.trim().split("@")[0],
          "",
          "password"
        );
      }
    } catch (err: unknown) {
      console.error("Auth error:", err);
      let message = "Terjadi kesalahan autentikasi.";
      if (err instanceof Error) {
        if (err.message.includes("user-not-found") || err.message.includes("wrong-password") || err.message.includes("invalid-credential")) {
          message = "Email atau kata sandi tidak sesuai.";
        } else if (err.message.includes("email-already-in-use")) {
          message = "Email ini sudah terdaftar. Silakan pilih tab Masuk.";
        } else if (err.message.includes("weak-password")) {
          message = "Kata sandi terlalu lemah (minimal 6 karakter).";
        } else {
          message = err.message;
        }
      }
      setError(message);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#14141e] p-4 text-white">
      {/* Background ambient glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-gradient-to-b from-indigo-600/20 to-transparent blur-[120px]" />

      <div className="w-full max-w-md rounded-3xl border border-white/[0.08] bg-[#1c1c28] p-7 shadow-2xl backdrop-blur-xl sm:p-9">
        {/* LOGO */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-lg shadow-indigo-600/30">
              <Zap size={22} className="text-white fill-white" />
            </div>
            <div className="flex items-baseline">
              <span className="text-2xl font-bold tracking-tight text-white">Komryuu</span>
              <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-2xl font-extrabold text-transparent">
                .x
              </span>
            </div>
          </Link>
          <h1 className="mt-4 text-xl font-bold text-white sm:text-2xl">
            {mode === "login" ? "Masuk ke Akun Anda" : "Daftar Akun Baru"}
          </h1>
          <p className="mt-1.5 text-xs text-slate-400">
            {mode === "login"
              ? "Akses portal pengguna atau admin dashboard sesuai peran akun."
              : "Buat akun baru untuk sinkronisasi cloud riwayat komik."}
          </p>
        </div>

        {/* ERROR ALERT */}
        {error && (
          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-200">
            <AlertCircle size={16} className="text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        {/* GOOGLE SIGN IN BUTTON */}
        <div className="mt-6">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/[0.12] bg-[#14141e] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-white/[0.05] hover:border-white/20 disabled:opacity-50"
          >
            {googleLoading ? (
              <Loader2 size={18} className="animate-spin text-indigo-400" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>Lanjutkan dengan Google</span>
          </button>
        </div>

        {/* OR DIVIDER */}
        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/[0.08]" />
          </div>
          <span className="relative bg-[#1c1c28] px-3 text-xs text-slate-500 uppercase tracking-widest">
            atau gunakan email
          </span>
        </div>

        {/* EMAIL & PASSWORD FORM */}
        <form onSubmit={handleEmailAuth} className="space-y-4">
          {mode === "register" && (
            <div>
              <label className="block text-xs font-medium text-slate-300">Nama Lengkap</label>
              <div className="relative mt-1.5">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nama Pengguna"
                  className="w-full rounded-xl border border-white/[0.09] bg-[#14141e] py-2.5 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-500 transition"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300">Email</label>
            <div className="relative mt-1.5">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full rounded-xl border border-white/[0.09] bg-[#14141e] py-2.5 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">Kata Sandi</label>
            <div className="relative mt-1.5">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-white/[0.09] bg-[#14141e] py-2.5 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-500 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:from-indigo-500 hover:to-violet-500 hover:shadow-indigo-500/50 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin text-white" />
            ) : (
              <>
                <span>{mode === "login" ? "Masuk Sekarang" : "Daftar Akun"}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* SWITCH LOGIN / REGISTER */}
        <div className="mt-6 text-center text-xs text-slate-400">
          {mode === "login" ? (
            <p>
              Belum punya akun?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setError(null);
                }}
                className="font-semibold text-indigo-400 hover:underline"
              >
                Daftar sekarang
              </button>
            </p>
          ) : (
            <p>
              Sudah punya akun?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
                className="font-semibold text-indigo-400 hover:underline"
              >
                Masuk ke akun
              </button>
            </p>
          )}
        </div>

        <div className="mt-6 border-t border-white/[0.06] pt-4 text-center">
          <Link href="/" className="text-xs text-slate-500 hover:text-slate-300 transition">
            ← Kembali ke Beranda
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#14141e] text-white">
          <Loader2 size={32} className="animate-spin text-indigo-500" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

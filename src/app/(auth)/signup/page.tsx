"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, AlertCircle, MailCheck } from "lucide-react";

export default function SignUpPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessInfo(null);

    if (!fullName.trim() || !email.trim() || !password) {
      setErrorMessage("Please fill out all required fields.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to create account.");
      }

      if (data.sessionCreated) {
        // Immediate session active -> redirect to dashboard
        router.push("/today");
        router.refresh();
      } else {
        setSuccessInfo(data.message || "Account created! Please check your email.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred during registration.");
    } finally {
      setLoading(false);
    }
  };

  // Dedicated Success Confirmation Screen
  if (successInfo) {
    return (
      <div className="bg-neutral-900/70 border border-neutral-800/80 backdrop-blur-xl rounded-2xl p-8 shadow-2xl text-center animate-in fade-in zoom-in-95">
        <div className="w-16 h-16 rounded-2xl bg-emerald-950/60 border border-emerald-800/80 flex items-center justify-center mx-auto mb-5 text-emerald-400 shadow-xl shadow-emerald-950/40">
          <MailCheck className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">Account Created! 🎉</h2>
        <p className="text-sm text-neutral-300 mt-2 leading-relaxed">
          We&apos;ve sent a confirmation link to:
        </p>
        <div className="my-3 px-3 py-1.5 rounded-lg bg-neutral-950/80 border border-neutral-800 text-cyan-400 font-mono text-sm inline-block">
          {email}
        </div>
        <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed mt-2">
          Please check your inbox (and spam folder) to activate your account. Once verified, your personal goals, daily missions, and AI memory will be 100% ready for you.
        </p>

        <div className="mt-8 space-y-3">
          <Link
            href="/login"
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium text-sm flex items-center justify-center gap-2 hover:opacity-95 shadow-lg shadow-cyan-500/20"
          >
            <span>Proceed to Sign In</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <div>
            <button
              type="button"
              onClick={() => {
                setSuccessInfo(null);
              }}
              className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              Entered the wrong email? Back to sign up
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900/70 border border-neutral-800/80 backdrop-blur-xl rounded-2xl p-8 shadow-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white tracking-tight">Create Account</h2>
        <p className="text-sm text-neutral-400 mt-1">
          Your personal goals, daily missions, and life journal will be 100% private to you.
        </p>
      </div>

      {errorMessage && (
        <div className="mb-6 p-3.5 rounded-xl bg-red-950/50 border border-red-800/60 text-red-300 text-xs flex items-start gap-2.5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">{errorMessage}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-neutral-300 mb-1.5">
            Full Name
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              required
              autoFocus
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Alex Rivera"
              className="w-full pl-10 pr-4 py-2.5 bg-neutral-950/80 border border-neutral-800 rounded-xl text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/80 transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-300 mb-1.5">
            Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@domain.com"
              className="w-full pl-10 pr-4 py-2.5 bg-neutral-950/80 border border-neutral-800 rounded-xl text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/80 transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-300 mb-1.5">
            Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 6 characters"
              className="w-full pl-10 pr-10 py-2.5 bg-neutral-950/80 border border-neutral-800 rounded-xl text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/80 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-300 mb-1.5">
            Confirm Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type={showPassword ? "text" : "password"}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              className="w-full pl-10 pr-4 py-2.5 bg-neutral-950/80 border border-neutral-800 rounded-xl text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/80 transition-all"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium text-sm flex items-center justify-center gap-2 hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-cyan-500/20"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Creating your Life OS...</span>
            </>
          ) : (
            <>
              <span>Create Account</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-neutral-800/80 text-center">
        <p className="text-xs text-neutral-400">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

"use client";

import { useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        const from = searchParams.get("from") || "/dashboard";
        router.push(from);
        router.refresh();
      } else {
        setError("Incorrect password. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--color-bg)" }}
    >
      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="text-center mb-10">
          <h1
            className="text-3xl font-bold tracking-widest uppercase"
            style={{ color: "var(--color-gold)" }}
          >
            Revival Lending
          </h1>
          <p className="mt-2 text-sm tracking-wider uppercase" style={{ color: "var(--color-muted)" }}>
            Team Dashboard
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <h2 className="text-lg font-semibold mb-6" style={{ color: "var(--color-text)" }}>
            Sign In
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium uppercase tracking-wider mb-2"
                style={{ color: "var(--color-muted)" }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter team password"
                required
                autoComplete="current-password"
                className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all"
                style={{
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--color-gold)";
                  e.target.style.boxShadow = "0 0 0 2px var(--color-gold-glow)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--color-border)";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            {error && (
              <p className="text-sm" style={{ color: "var(--color-danger)" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg text-sm font-semibold uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "var(--color-gold)",
                color: "#0A0A0A",
              }}
              onMouseEnter={(e) => {
                if (!loading) (e.target as HTMLButtonElement).style.filter = "brightness(1.1)";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.filter = "none";
              }}
            >
              {loading ? "Signing in..." : "Enter Dashboard"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

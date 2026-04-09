"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="text-xs uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all"
      style={{
        color: "var(--color-muted)",
        border: "1px solid var(--color-border)",
        background: "transparent",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = "var(--color-gold)";
        (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-gold)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = "var(--color-muted)";
        (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-border)";
      }}
    >
      Sign Out
    </button>
  );
}

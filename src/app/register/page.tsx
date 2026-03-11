"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const teamName = formData.get("teamName") as string;
    const repoUrl = formData.get("repoUrl") as string;
    const branch = formData.get("branch") as string;
    
    const members = [
      formData.get("member1") as string,
      formData.get("member2") as string,
      formData.get("member3") as string,
      formData.get("member4") as string,
    ].filter(Boolean);

    try {
      const res = await fetch("/api/team/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamName, repoUrl, branch, members }),
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        throw new Error(`Server error (${res.status}). Please try again.`);
      }
      if (!res.ok) throw new Error(data.error || "Failed to register");

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#7c5cff', '#22d3ee', '#ffffff']
      });

      if (typeof window !== "undefined") {
        localStorage.setItem("lastTeamId", data.teamId);
      }

      setTimeout(() => {
        router.push(`/team/${data.teamId}`);
      }, 1500);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6 sm:space-y-8 px-4 sm:px-0">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Register Team
        </h1>
        <p className="text-sm sm:text-base text-muted">
          Join the hackathon and start earning XP.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6 rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-2xl">
        {error && (
          <div className="rounded-lg bg-red-500/10 p-4 text-sm text-red-500">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="teamName" className="text-sm font-medium text-foreground">
              Team Name
            </label>
            <input
              id="teamName"
              name="teamName"
              required
              className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="Awesome Hackers"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="repoUrl" className="text-sm font-medium text-foreground">
              GitHub Repository URL
            </label>
            <input
              id="repoUrl"
              name="repoUrl"
              type="url"
              required
              className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="https://github.com/owner/repo"
            />
            <p className="text-xs text-muted">
              Must be a public repository for validation.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="branch" className="text-sm font-medium text-foreground">
              Default Branch
            </label>
            <input
              id="branch"
              name="branch"
              defaultValue="main"
              className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="main"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Team Members (1-4, solo allowed)
            </label>
            <div className="space-y-2">
              <input
                name="member1"
                required
                className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="Member 1 Name"
              />
              <input
                name="member2"
                className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="Member 2 Name (Optional)"
              />
              <input
                name="member3"
                className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="Member 3 Name (Optional)"
              />
              <input
                name="member4"
                className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="Member 4 Name (Optional)"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
        >
          {loading ? "Registering..." : "Register Team"}
        </button>
      </form>
    </div>
  );
}

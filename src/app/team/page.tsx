"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function TeamLoginPage() {
  const router = useRouter();
  const [teamId, setTeamId] = useState("");
  const [savedTeamId, setSavedTeamId] = useState("");
  const [recoverName, setRecoverName] = useState("");
  const [recoverRepoUrl, setRecoverRepoUrl] = useState("");
  const [recoverError, setRecoverError] = useState("");
  const [recoverLoading, setRecoverLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("lastTeamId") ?? "";
    if (saved) {
      setSavedTeamId(saved);
      setTeamId(saved);
    }
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (teamId.trim()) {
      const normalized = teamId.trim().toUpperCase();
      if (typeof window !== "undefined") {
        localStorage.setItem("lastTeamId", normalized);
      }
      router.push(`/team/${normalized}`);
    }
  }

  async function recoverTeam(e: React.FormEvent) {
    e.preventDefault();
    setRecoverError("");
    setRecoverLoading(true);

    try {
      const res = await fetch("/api/team/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamName: recoverName,
          repoUrl: recoverRepoUrl || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to recover Team ID");

      if (typeof window !== "undefined") {
        localStorage.setItem("lastTeamId", json.teamId);
      }

      setTeamId(json.teamId);
      setSavedTeamId(json.teamId);
      router.push(`/team/${json.teamId}`);
    } catch (err) {
      setRecoverError(err instanceof Error ? err.message : "Recovery failed");
    } finally {
      setRecoverLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6 sm:space-y-8 px-4 sm:px-0">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Team Dashboard
        </h1>
        <p className="text-sm sm:text-base text-muted">
          Enter your Team ID to view your progress.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6 rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-2xl">
        <div className="space-y-2">
          <label htmlFor="teamId" className="text-sm font-medium text-foreground">
            Team ID
          </label>
          <input
            id="teamId"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value.toUpperCase())}
            required
            pattern="TM(00[1-9]|0[1-8][0-9]|090)"
            title="Team ID must be between TM001 and TM090"
            maxLength={5}
            className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder="e.g. TM023"
          />
          <p className="text-xs text-muted">Use format TM001 to TM090.</p>
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/90"
        >
          Go to Dashboard
        </button>

        {savedTeamId && (
          <button
            type="button"
            onClick={() => router.push(`/team/${savedTeamId}`)}
            className="w-full rounded-lg border border-border bg-card-strong px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-card-strong/80"
          >
            Continue with Last Team ({savedTeamId})
          </button>
        )}

        <div className="text-center text-sm text-muted">
          Don't have a team yet?{" "}
          <a href="/register" className="font-medium text-accent hover:underline">
            Register here
          </a>
        </div>
      </form>

      <form onSubmit={recoverTeam} className="space-y-4 rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-2xl">
        <h2 className="text-base font-semibold text-foreground">Forgot Team ID?</h2>
        <p className="text-sm text-muted">
          Enter the same team name and repo URL used during registration.
        </p>

        {recoverError && (
          <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-500">{recoverError}</div>
        )}

        <div className="space-y-2">
          <label htmlFor="recoverName" className="text-sm font-medium text-foreground">
            Team Name
          </label>
          <input
            id="recoverName"
            required
            value={recoverName}
            onChange={(e) => setRecoverName(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder="Your registered team name"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="recoverRepo" className="text-sm font-medium text-foreground">
            Repo URL (recommended)
          </label>
          <input
            id="recoverRepo"
            type="url"
            value={recoverRepoUrl}
            onChange={(e) => setRecoverRepoUrl(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder="https://github.com/owner/repo"
          />
        </div>

        <button
          type="submit"
          disabled={recoverLoading}
          className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
        >
          {recoverLoading ? "Recovering..." : "Recover Team Access"}
        </button>
      </form>
    </div>
  );
}

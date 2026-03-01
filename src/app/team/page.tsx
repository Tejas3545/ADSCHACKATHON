"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TeamLoginPage() {
  const router = useRouter();
  const [teamId, setTeamId] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (teamId.trim()) {
      router.push(`/team/${teamId.trim()}`);
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
            onChange={(e) => setTeamId(e.target.value)}
            required
            className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder="e.g. aBcDeFgHiJ"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/90"
        >
          Go to Dashboard
        </button>

        <div className="text-center text-sm text-muted">
          Don't have a team yet?{" "}
          <a href="/register" className="font-medium text-accent hover:underline">
            Register here
          </a>
        </div>
      </form>
    </div>
  );
}

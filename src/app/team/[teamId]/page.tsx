"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import confetti from "canvas-confetti";

export default function TeamDashboardPage() {
  const params = useParams();
  const teamId = params.teamId as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [autoRefreshed, setAutoRefreshed] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const esRef = useRef<EventSource | null>(null);
  const prevXpRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && teamId) {
      localStorage.setItem("lastTeamId", teamId);
    }

    fetchData();

    // Connect to SSE — auto-refresh this team's dashboard when they (or anyone) push
    const es = new EventSource("/api/public/events");
    esRef.current = es;

    es.addEventListener("leaderboard-update", (e: MessageEvent) => {
      const payload = JSON.parse(e.data);
      // Only re-fetch if the update is for THIS team
      if (payload.teamId === teamId) {
        setAutoRefreshed(true);
        fetchData();
        setTimeout(() => setAutoRefreshed(false), 3000);
      }
    });

    return () => {
      es.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  async function fetchData() {
    try {
      const res = await fetch(`/api/team/${teamId}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load team data");

      // If XP went up since last check (via auto-webhook), fire confetti
      if (prevXpRef.current !== null && json.team.xp > prevXpRef.current) {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ["#7c5cff", "#22d3ee", "#eab308", "#ffffff"],
        });
      }
      prevXpRef.current = json.team.xp;
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitMilestone(milestoneCode: string) {
    setSubmitting(milestoneCode);
    try {
      const res = await fetch(`/api/team/${teamId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestoneCode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.reason || json.error || "Submission failed");

      if (json.status === "pending") {
        alert("Submission sent for manual review by Admin.");
      } else {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ["#7c5cff", "#22d3ee", "#eab308", "#ffffff"],
        });
        setTimeout(() => {
          let message = `Success! Earned ${json.xpAwarded} XP and ${json.coinsAwarded} Coins.`;
          if (json.bonusMessage) {
            message += `\n\n${json.bonusMessage}`;
          }
          alert(message);
        }, 500);
      }

      fetchData();
    } catch (err: any) {
      alert(`Validation Failed: ${err.message}`);
      fetchData();
    } finally {
      setSubmitting(null);
    }
  }

  async function syncNow() {
    setSyncing(true);
    setSyncMessage("");

    try {
      const res = await fetch(`/api/team/${teamId}/sync`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Sync failed");

      const statusText = json.result?.skipped
        ? json.result.reason || "No new commits found"
        : "Sync complete. Dashboard refreshed.";

      setSyncMessage(statusText);
      await fetchData();
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  if (loading) return <div className="text-center text-muted">Loading dashboard...</div>;
  if (error) return <div className="text-center text-red-500">{error}</div>;
  if (!data) return null;

  const { team, milestones, submissions } = data;

  const getStatus = (code: string) => {
    const sub = submissions.find((s: any) => s.milestoneCode === code);
    return sub ? sub.status : "pending";
  };

  const getReason = (code: string) => {
    const sub = submissions.find((s: any) => s.milestoneCode === code);
    return sub ? sub.reason : null;
  };

  return (
    <div className="space-y-6 sm:space-y-8 px-4 sm:px-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground break-words">
            {team.name}
          </h1>
          <p className="text-sm sm:text-base text-muted">
            Team ID: <span className="font-mono text-accent break-all">{team.teamId}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          Live updates active
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border bg-card px-4 py-3">
        <p className="text-sm text-muted">Latest commit not reflected yet? Run a manual sync.</p>
        <button
          onClick={syncNow}
          disabled={syncing}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
        >
          {syncing ? "Syncing..." : "Sync from GitHub"}
        </button>
      </div>

      {syncMessage && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted">
          {syncMessage}
        </div>
      )}

      {autoRefreshed && (
        <div className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm font-medium text-accent animate-pulse">
          ✅ Dashboard auto-updated from your latest GitHub push!
        </div>
      )}

      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xl">
          <div className="text-sm font-medium text-muted">Level</div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-foreground">{team.level}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xl">
          <div className="text-sm font-medium text-muted">Total XP</div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-accent-2">{team.xp}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xl">
          <div className="text-sm font-medium text-muted">Coins</div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-yellow-500">{team.coins}</div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Milestones</h2>
        <div className="grid gap-4">
          {milestones.map((m: any) => {
            const status = getStatus(m.code);
            const reason = getReason(m.code);
            const isSubmitting = submitting === m.code;

            return (
              <div key={m.code} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xl sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-accent">{m.code}</span>
                    <span className="font-medium text-foreground">{m.title}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs sm:text-sm text-muted">
                    <span>{m.xp} XP</span>
                    <span>{m.coins} Coins</span>
                  </div>
                  {status === "rejected" && reason && (
                    <div className="text-xs sm:text-sm text-red-400 mt-2">
                      Reason: {reason}
                    </div>
                  )}
                </div>

                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
                  {status === "verified" ? (
                    <span className="inline-flex w-full sm:w-auto items-center justify-center rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1.5 sm:py-1 text-sm font-medium text-green-500">
                      Verified ✓
                    </span>
                  ) : status === "pending" ? (
                    <span className="inline-flex w-full sm:w-auto items-center justify-center rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1.5 sm:py-1 text-sm font-medium text-yellow-500">
                      Pending Review
                    </span>
                  ) : status === "rejected" ? (
                    <button
                      onClick={() => submitMilestone(m.code)}
                      disabled={isSubmitting || team.frozen}
                      className="w-full sm:w-auto rounded-lg bg-card-strong px-4 py-2.5 sm:py-2 text-sm font-medium text-foreground transition-colors hover:bg-card-strong/80 disabled:opacity-50"
                    >
                      {isSubmitting ? "Validating..." : "Retry Validation"}
                    </button>
                  ) : (
                    <button
                      onClick={() => submitMilestone(m.code)}
                      disabled={isSubmitting || team.frozen}
                      className="w-full sm:w-auto rounded-lg bg-accent px-4 py-2.5 sm:py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
                    >
                      {isSubmitting ? "Validating..." : "Validate via GitHub"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


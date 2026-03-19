"use client";

import { useEffect, useState } from "react";
import type { Team, Milestone, MilestoneSubmission } from "@/lib/models";

type DashboardData = {
  teams: Team[];
  milestones: Milestone[];
  submissions: MilestoneSubmission[];
  leaderboardState?: {
    isRunning: boolean;
    startedAt: string | null;
    endedAt: string | null;
  };
};

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M8 6.5v11l9-5.5-9-5.5Z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <rect x="7" y="7" width="10" height="10" rx="1" />
    </svg>
  );
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"teams" | "submissions">("teams");

  async function fetchDashboard(silent = false) {
    setLoading(true);
    if (!silent) setError("");
    try {
      const res = await fetch("/api/admin/dashboard", { cache: "no-store" });
      let json: DashboardData & { error?: string } = { teams: [], milestones: [], submissions: [] };
      try {
        json = await res.json();
      } catch {
        throw new Error(`Server returned non-JSON response (status ${res.status}). Check server logs.`);
      }
      if (!res.ok) throw new Error(json.error || "Failed to load dashboard");
      setData(json);
      setLoggedIn(true);
    } catch (err: unknown) {
      if (silent) {
        setLoggedIn(false);
        return;
      }
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred");
      }
      setLoggedIn(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDashboard(true);
  }, []);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "Login failed");
        await fetchDashboard(true);
      })
      .catch((err: unknown) => {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("An unknown error occurred");
        }
      })
      .finally(() => setLoading(false));
  }

  async function handleAction(action: string, payload: Record<string, unknown>) {
    try {
      const res = await fetch("/api/admin/action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, payload }),
      });
      if (!res.ok) throw new Error("Action failed");
      fetchDashboard(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message);
      } else {
        alert("An unknown error occurred");
      }
    }
  }

  async function resetDatabase() {
    const confirmed = confirm(
      "WARNING: This will delete ALL data (teams, submissions, and milestones). This action cannot be undone. Are you sure?"
    );
    
    if (!confirmed) return;

    const doubleConfirm = prompt(
      'Type "RESET" to confirm database reset:'
    );

    if (doubleConfirm !== "RESET") {
      alert("Reset cancelled.");
      return;
    }

    try {
      const res = await fetch("/api/internal/reset-database", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to reset database");
      const result = await res.json();
      alert(`Database reset complete!\n\nDeleted:\n- Teams: ${result.deleted.teams}\n- Submissions: ${result.deleted.submissions}\n- Milestones: ${result.deleted.milestones}\n\nYou can now start fresh!`);
      fetchDashboard(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message);
      } else {
        alert("An unknown error occurred");
      }
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } finally {
      setLoggedIn(false);
      setData(null);
      setPassword("");
      setError("");
    }
  }

  if (!loggedIn) {
    return (
      <div className="mx-auto w-full max-w-md space-y-6 sm:space-y-8 mt-10 sm:mt-20 px-4 sm:px-0">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Admin Login</h1>
          <p className="text-sm sm:text-base text-muted">Enter the admin password to access the dashboard.</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-6 rounded-lg border border-border bg-card p-6 sm:p-8 shadow-sm">
          {error && <div className="rounded-lg bg-red-500/10 p-4 text-sm text-red-500">{error}</div>}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="••••••••"
            />
          </div>
          <button type="submit" disabled={loading} className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent/90">
            {loading ? "Loading..." : "Login"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 px-4 sm:px-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-sm sm:text-base text-muted">Manage teams, milestones, and submissions.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className={`inline-flex items-center rounded-md border px-2 py-0.5 font-medium ${data?.leaderboardState?.isRunning ? "border-green-500/30 bg-green-500/10 text-green-500" : "border-red-500/30 bg-red-500/10 text-red-400"}`}>
              {data?.leaderboardState?.isRunning ? "Running" : "Ended"}
            </span>
            {data?.leaderboardState?.startedAt && <span>Started: {new Date(data.leaderboardState.startedAt).toLocaleString()}</span>}
            {data?.leaderboardState?.endedAt && <span>Ended: {new Date(data.leaderboardState.endedAt).toLocaleString()}</span>}
          </div>
        </div>
        <div className="flex w-full flex-col sm:flex-row sm:w-auto gap-2">
          <button
            onClick={() => handleAction("startLeaderboard", {})}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg border border-border bg-card-strong px-4 py-2.5 sm:py-2 text-sm font-semibold text-foreground hover:bg-card-strong/80"
          >
            <PlayIcon />
            Start Leaderboard
          </button>
          <button
            onClick={() => handleAction("endLeaderboard", {})}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg border border-border bg-card-strong px-4 py-2.5 sm:py-2 text-sm font-semibold text-foreground hover:bg-card-strong/80"
          >
            <StopIcon />
            End Leaderboard
          </button>
          <button
            onClick={handleLogout}
            className="w-full sm:w-auto rounded-lg border border-border bg-card-strong px-4 py-2.5 sm:py-2 text-sm font-semibold text-foreground hover:bg-card-strong/80"
          >
            Logout
          </button>
          <button 
            onClick={resetDatabase} 
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2.5 sm:py-2 text-sm font-semibold text-white hover:bg-red-600"
          >
            <TrashIcon />
            Reset Database
          </button>
        </div>
      </div>

      <div className="border-b border-border">
        <div className="flex gap-4 overflow-x-auto">
        <button
          onClick={() => setActiveTab("teams")}
          className={`pb-2 text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === "teams"
              ? "border-b-2 border-accent text-foreground"
              : "text-muted hover:text-foreground"
          }`}
        >
          Teams ({data?.teams.length})
        </button>
        <button
          onClick={() => setActiveTab("submissions")}
          className={`pb-2 text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === "submissions"
              ? "border-b-2 border-accent text-foreground"
              : "text-muted hover:text-foreground"
          }`}
        >
          Submissions ({data?.submissions.length})
        </button>
        </div>
      </div>

      {activeTab === "teams" && (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-border bg-card-strong text-muted">
                  <tr>
                    <th className="whitespace-nowrap px-6 py-4 font-medium">Team Name</th>
                    <th className="whitespace-nowrap px-6 py-4 font-medium">Team ID</th>
                    <th className="whitespace-nowrap px-6 py-4 font-medium">Stats</th>
                    <th className="whitespace-nowrap px-6 py-4 font-medium">Status</th>
                    <th className="whitespace-nowrap px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data?.teams.map((team: Team) => (
                    <tr key={team._id} className="transition-colors hover:bg-card-strong/50">
                      <td className="whitespace-nowrap px-6 py-4 font-medium text-foreground">{team.name}</td>
                      <td className="whitespace-nowrap px-6 py-4 font-mono text-xs text-muted">{team._id}</td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="text-accent-2 font-bold">{team.xp} XP</span>
                        <span className="text-muted mx-2">•</span>
                        <span className="text-yellow-500 font-bold">{team.coins} Coins</span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        {team.frozen ? (
                          <span className="inline-flex items-center rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-500">Frozen</span>
                        ) : (
                          <span className="inline-flex items-center rounded-md border border-green-500/30 bg-green-500/10 px-2.5 py-0.5 text-xs font-semibold text-green-500">Active</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleAction(team.frozen ? "unfreezeTeam" : "freezeTeam", { teamId: team._id })}
                            className="text-xs bg-card-strong px-3 py-1.5 rounded-md hover:bg-border transition-colors"
                          >
                            {team.frozen ? "Unfreeze" : "Freeze"}
                          </button>
                          <button
                            onClick={() => {
                              const amt = prompt("Enter XP to add (use negative to subtract):");
                              if (amt && !isNaN(parseInt(amt))) {
                                handleAction("adjustXp", { teamId: team._id, amount: parseInt(amt, 10) });
                              }
                            }}
                            className="text-xs bg-card-strong px-3 py-1.5 rounded-md hover:bg-border transition-colors"
                          >
                            Adjust XP
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {data?.teams.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-muted">No teams registered yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {data?.teams.map((team: Team) => (
              <div key={team._id} className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-foreground">{team.name}</h3>
                    <p className="text-xs font-mono text-muted mt-1">{team._id}</p>
                  </div>
                  {team.frozen ? (
                    <span className="inline-flex items-center rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-500">Frozen</span>
                  ) : (
                    <span className="inline-flex items-center rounded-md border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs font-semibold text-green-500">Active</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-accent-2 font-bold">{team.xp} XP</span>
                  <span className="text-muted">•</span>
                  <span className="text-yellow-500 font-bold">{team.coins} Coins</span>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => handleAction(team.frozen ? "unfreezeTeam" : "freezeTeam", { teamId: team._id })}
                    className="flex-1 text-xs bg-card-strong px-3 py-2 rounded-md hover:bg-border transition-colors"
                  >
                    {team.frozen ? "Unfreeze" : "Freeze"}
                  </button>
                  <button
                    onClick={() => {
                      const amt = prompt("Enter XP to add (use negative to subtract):");
                      if (amt && !isNaN(parseInt(amt))) {
                        handleAction("adjustXp", { teamId: team._id, amount: parseInt(amt, 10) });
                      }
                    }}
                    className="flex-1 text-xs bg-card-strong px-3 py-2 rounded-md hover:bg-border transition-colors"
                  >
                    Adjust XP
                  </button>
                </div>
              </div>
            ))}
            {data?.teams.length === 0 && (
              <div className="rounded-lg border border-border bg-card px-6 py-8 text-center text-muted shadow-sm">
                No teams registered yet.
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === "submissions" && (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-border bg-card-strong text-muted">
                  <tr>
                    <th className="whitespace-nowrap px-6 py-4 font-medium">Milestone</th>
                    <th className="whitespace-nowrap px-6 py-4 font-medium">Team</th>
                    <th className="whitespace-nowrap px-6 py-4 font-medium">Status</th>
                    <th className="whitespace-nowrap px-6 py-4 font-medium">Reason</th>
                    <th className="whitespace-nowrap px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data?.submissions.map((sub: MilestoneSubmission) => {
                    const team = data.teams.find((t: Team) => t._id === sub.teamId);
                    const milestone = data.milestones.find((m: Milestone) => m._id === sub.milestoneId);
                    
                    return (
                      <tr key={sub._id} className="transition-colors hover:bg-card-strong/50">
                        <td className="whitespace-nowrap px-6 py-4 font-bold text-accent">{sub.milestoneCode}</td>
                        <td className="whitespace-nowrap px-6 py-4 font-medium text-foreground">{team?.name || sub.teamId}</td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold ${
                            sub.status === 'verified' ? 'border-green-500/30 bg-green-500/10 text-green-500' : 
                            sub.status === 'rejected' ? 'border-red-500/30 bg-red-500/10 text-red-500' : 
                            'border-yellow-500/30 bg-yellow-500/10 text-yellow-500'
                          }`}>
                            {sub.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-muted max-w-xs truncate" title={sub.reason || ""}>
                          {sub.reason || "-"}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {sub.status !== "verified" && (
                              <>
                                <button
                                  onClick={() => {
                                    if (confirm("Are you sure you want to manually approve this submission?")) {
                                      handleAction("updateSubmission", { 
                                        submissionId: sub._id, 
                                        status: "verified", 
                                        teamId: sub.teamId, 
                                        xp: milestone?.xp, 
                                        coins: milestone?.coins 
                                      });
                                    }
                                  }}
                                  className="text-xs bg-green-500/20 text-green-500 px-3 py-1.5 rounded-md hover:bg-green-500/30 transition-colors"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => {
                                    const reason = prompt("Enter rejection reason:");
                                    if (reason) {
                                      handleAction("updateSubmission", { submissionId: sub._id, status: "rejected", reason });
                                    }
                                  }}
                                  className="text-xs bg-red-500/20 text-red-500 px-3 py-1.5 rounded-md hover:bg-red-500/30 transition-colors"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {sub.status === "verified" && (
                              <button
                                onClick={() => {
                                  if (confirm("Are you sure you want to revoke this approval? This will NOT remove the XP/Coins automatically.")) {
                                    handleAction("updateSubmission", { 
                                      submissionId: sub._id, 
                                      status: "rejected", 
                                      reason: "Manually revoked by admin" 
                                    });
                                  }
                                }}
                                className="text-xs bg-red-500/20 text-red-500 px-3 py-1.5 rounded-md hover:bg-red-500/30 transition-colors"
                              >
                                Revoke
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {data?.submissions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-muted">No submissions yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {data?.submissions.map((sub: MilestoneSubmission) => {
              const team = data.teams.find((t: Team) => t._id === sub.teamId);
              const milestone = data.milestones.find((m: Milestone) => m._id === sub.milestoneId);
              
              return (
                <div key={sub._id} className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-accent">{sub.milestoneCode}</h3>
                      <p className="text-sm text-foreground mt-1">{team?.name || sub.teamId}</p>
                    </div>
                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${
                      sub.status === 'verified' ? 'border-green-500/30 bg-green-500/10 text-green-500' : 
                      sub.status === 'rejected' ? 'border-red-500/30 bg-red-500/10 text-red-500' : 
                      'border-yellow-500/30 bg-yellow-500/10 text-yellow-500'
                    }`}>
                      {sub.status.toUpperCase()}
                    </span>
                  </div>
                  {sub.reason && (
                    <div className="text-xs text-muted bg-card-strong p-2 rounded">
                      <span className="font-semibold">Reason:</span> {sub.reason}
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    {sub.status !== "verified" && (
                      <>
                        <button
                          onClick={() => {
                            if (confirm("Are you sure you want to manually approve this submission?")) {
                              handleAction("updateSubmission", { 
                                submissionId: sub._id, 
                                status: "verified", 
                                teamId: sub.teamId, 
                                xp: milestone?.xp, 
                                coins: milestone?.coins 
                              });
                            }
                          }}
                          className="flex-1 text-xs bg-green-500/20 text-green-500 px-3 py-2 rounded-md hover:bg-green-500/30 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            const reason = prompt("Enter rejection reason:");
                            if (reason) {
                              handleAction("updateSubmission", { submissionId: sub._id, status: "rejected", reason });
                            }
                          }}
                          className="flex-1 text-xs bg-red-500/20 text-red-500 px-3 py-2 rounded-md hover:bg-red-500/30 transition-colors"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {sub.status === "verified" && (
                      <button
                        onClick={() => {
                          if (confirm("Are you sure you want to revoke this approval? This will NOT remove the XP/Coins automatically.")) {
                            handleAction("updateSubmission", { 
                              submissionId: sub._id, 
                              status: "rejected", 
                              reason: "Manually revoked by admin" 
                            });
                          }
                        }}
                        className="w-full text-xs bg-red-500/20 text-red-500 px-3 py-2 rounded-md hover:bg-red-500/30 transition-colors"
                      >
                        Revoke Approval
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {data?.submissions.length === 0 && (
              <div className="rounded-lg border border-border bg-card px-6 py-8 text-center text-muted shadow-sm">
                No submissions yet.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

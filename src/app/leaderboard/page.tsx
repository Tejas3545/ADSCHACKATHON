"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type MilestoneCol = { _id: string; code: string; title: string; xp: number };
type Row = {
  rank: number;
  teamId: string;
  teamName: string;
  xp: number;
  level: number;
  milestones: string[];
};

const LEVEL_COLORS = [
  "",
  "from-slate-500 to-slate-400",   // Lvl 1
  "from-emerald-600 to-emerald-400", // Lvl 2
  "from-blue-600 to-blue-400",     // Lvl 3
  "from-violet-600 to-violet-400", // Lvl 4
];

const RANK_MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

async function fetchLeaderboard(): Promise<{ rows: Row[]; milestones: MilestoneCol[] }> {
  const res = await fetch("/api/public/leaderboard", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load");
  return res.json();
}

function AnimatedXP({ value, flash }: { value: number; flash: boolean }) {
  const [displayed, setDisplayed] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    if (value === prev.current) return;
    const start = prev.current;
    const end = value;
    const duration = 800;
    const startTime = performance.now();
    const raf = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(start + (end - start) * eased));
      if (t < 1) requestAnimationFrame(raf);
      else prev.current = end;
    };
    requestAnimationFrame(raf);
  }, [value]);

  return (
    <span className={`font-mono font-bold tabular-nums transition-all inline-block duration-300 ${flash ? "scale-125 text-yellow-300" : "text-foreground"}`}>
      {displayed.toLocaleString()}
    </span>
  );
}

function MilestoneTrack({ milestones, completed, flash }: {
  milestones: MilestoneCol[];
  completed: string[];
  flash: boolean;
}) {
  const total = milestones.length;
  if (total === 0) return null;
  const doneCount = milestones.filter(m => completed.includes(m.code)).length;
  const pct = total > 0 ? (doneCount / total) * 100 : 0;
  const trackId = `track-${completed.join('-')}`;

  return (
    <div className="w-full space-y-2">
      {/* Progress track */}
      <div className="relative flex items-center gap-0">
        {milestones.map((m, i) => {
          const done = completed.includes(m.code);
          const isLast = i === total - 1;
          return (
            <div key={m.code} className="flex items-center flex-1 min-w-0">
              {/* Connector line before dot (skip for first) */}
              {i > 0 && (
                <div className="flex-1 h-1 relative overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 bg-gradient-to-r from-violet-600 to-violet-400 ${done ? 'w-full' : 'w-0'}`}
                  />
                </div>
              )}
              {/* Checkpoint dot */}
              <div className="relative group flex-shrink-0 flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all duration-500 cursor-default
                    ${done
                      ? "border-violet-400 bg-violet-500 text-white shadow-[0_0_12px_rgba(139,92,246,0.7)]"
                      : "border-white/20 bg-white/5 text-muted"
                    }
                    ${done && flash ? "animate-bounce" : ""}
                  `}
                >
                  {done ? "✓" : m.code}
                </div>
                {/* Tooltip — smart position: left-align first dot, right-align last, center others */}
                <div className={`absolute bottom-full mb-2 z-50 hidden group-hover:flex
                  whitespace-nowrap rounded-lg bg-zinc-900 border border-white/15 px-3 py-2
                  text-[11px] text-white shadow-2xl flex-col items-center gap-0.5 pointer-events-none
                  ${
                    i === 0
                      ? 'left-0'
                      : i === total - 1
                      ? 'right-0'
                      : 'left-1/2 -translate-x-1/2'
                  }`}>
                  <span className="font-semibold">{m.title}</span>
                  <span className="text-violet-300">+{m.xp} XP</span>
                </div>
              </div>
              {/* Connector after last dot — fill remaining */}
              {isLast && (
                <div className="flex-1 h-1 relative overflow-hidden rounded-full bg-white/10">
                  <div className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 bg-gradient-to-r from-violet-600 to-violet-400 ${done ? 'w-full' : 'w-0'}`} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Progress label */}
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{doneCount} / {total} milestones</span>
        <span className="font-mono">{Math.round(pct)}%</span>
      </div>
      {/* Bar */}
      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
        <div
          className={`milestone-progress-bar-${trackId} h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-violet-600 via-violet-400 to-violet-200`}
          data-has-glow={pct > 0}
        />
      </div>
      <style>{`
        .milestone-progress-bar-${trackId} {
          width: ${pct}%;
        }
        .milestone-progress-bar-${trackId}[data-has-glow="true"] {
          filter: drop-shadow(0 0 8px rgba(139,92,246,0.6));
        }
      `}</style>
    </div>
  );
}

export default function LeaderboardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [milestones, setMilestones] = useState<MilestoneCol[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [flashTeam, setFlashTeam] = useState<string | null>(null);
  const [newTeamId, setNewTeamId] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchLeaderboard();
      setRows(data.rows);
      setMilestones(data.milestones);
      setLastUpdated(new Date());
    } catch {
      // keep stale data on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();

    // SSE for instant updates when any team earns XP or a new team registers
    const es = new EventSource("/api/public/events");
    esRef.current = es;

    es.addEventListener("leaderboard-update", (e: MessageEvent) => {
      const data = JSON.parse(e.data) as { teamName?: string; teamId?: string; newTeam?: boolean };
      if (data.newTeam && data.teamId) {
        setNewTeamId(data.teamId);
        setTimeout(() => setNewTeamId(null), 3000);
      } else if (data.teamName) {
        setFlashTeam(data.teamName);
        setTimeout(() => setFlashTeam(null), 4000);
      }
      load();
    });

    // Fallback: refresh every 30 seconds in case SSE misses something
    pollRef.current = setInterval(load, 30_000);

    return () => {
      es.close();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load]);

  return (
    <div className="space-y-6 px-4 sm:px-0">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Live Leaderboard
          </h1>
          <p className="text-sm text-muted mt-1">
            Rankings auto-update every 2 min when teams push to GitHub
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          Live
          {lastUpdated && (
            <span className="tabular-nums ml-1">· Updated {lastUpdated.toLocaleTimeString()}</span>
          )}
        </div>
      </div>

      {/* Flash banners */}
      {flashTeam && (
        <div className="rounded-xl border border-violet-400/40 bg-violet-500/10 px-4 py-3 text-sm font-medium text-violet-300 animate-pulse">
          🎉 <strong>{flashTeam}</strong> just earned XP — leaderboard updated!
        </div>
      )}
      {newTeamId && (
        <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-300 animate-pulse">
          🚀 A new team just joined the hackathon!
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-2xl border border-border bg-card h-32 animate-pulse" />
          ))}
        </div>
      )}

      {/* Team cards */}
      {!loading && (
        <div className="space-y-4">
          {rows.map((row, i) => {
            const isFlash = flashTeam === row.teamName;
            const isNew = newTeamId === row.teamId;
            const medal = RANK_MEDALS[row.rank];
            const lvlGradient = LEVEL_COLORS[row.level] ?? LEVEL_COLORS[1];
            const doneCount = milestones.filter(m => row.milestones.includes(m.code)).length;

            return (
              <div
                key={row.teamId}
                className={`leaderboard-card relative rounded-2xl border transition-all duration-500 animate-[slideUp_0.4s_ease-out_both]
                  ${isFlash ? "border-violet-400/70 shadow-[0_0_24px_rgba(139,92,246,0.3)]" : "border-border"}
                  ${isNew ? "border-emerald-400/70 shadow-[0_0_24px_rgba(52,211,153,0.3)]" : ""}
                  bg-card
                `}
                data-index={i}
              >
                {/* Rank accent stripe */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-gradient-to-b ${lvlGradient}`}
                />

                <div className="pl-5 pr-5 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Rank + team info */}
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    {/* Rank badge */}
                    <div className="flex-shrink-0 flex flex-col items-center justify-center w-14 h-14 rounded-2xl bg-card-strong border border-border text-center">
                      {medal
                        ? <span className="text-2xl leading-none">{medal}</span>
                        : <span className="text-xl font-bold text-muted">#{row.rank}</span>
                      }
                    </div>

                    {/* Name + level + XP */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-lg text-foreground truncate">{row.teamName}</span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gradient-to-r ${lvlGradient} text-white`}>
                          Lvl {row.level}
                        </span>
                        {doneCount === milestones.length && milestones.length > 0 && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-400/30">
                            🏆 Complete
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted mt-0.5">
                        <AnimatedXP value={row.xp} flash={isFlash} />
                        <span className="text-muted font-normal ml-1">XP</span>
                      </div>
                    </div>
                  </div>

                  {/* Milestone track */}
                  <div className="sm:w-1/2 flex-shrink-0">
                    <MilestoneTrack
                      milestones={milestones}
                      completed={row.milestones}
                      flash={isFlash}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {rows.length === 0 && (
            <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center text-muted">
              No teams have registered yet. Be the first!
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        
        .leaderboard-card[data-index="0"] { animation-delay: 0s; }
        .leaderboard-card[data-index="1"] { animation-delay: 0.07s; }
        .leaderboard-card[data-index="2"] { animation-delay: 0.14s; }
        .leaderboard-card[data-index="3"] { animation-delay: 0.21s; }
        .leaderboard-card[data-index="4"] { animation-delay: 0.28s; }
        .leaderboard-card[data-index="5"] { animation-delay: 0.35s; }
        .leaderboard-card[data-index="6"] { animation-delay: 0.42s; }
        .leaderboard-card[data-index="7"] { animation-delay: 0.49s; }
        .leaderboard-card[data-index="8"] { animation-delay: 0.56s; }
        .leaderboard-card[data-index="9"] { animation-delay: 0.63s; }
      `}</style>
    </div>
  );
}

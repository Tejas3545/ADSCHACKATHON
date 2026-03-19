import Link from "next/link";

export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-6xl flex-col items-center justify-center space-y-10 px-4 text-center sm:px-0">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold text-foreground sm:text-5xl lg:text-6xl">
          ADSC Hackathon <br />
          <span className="text-accent">Leaderboard</span>
        </h1>
        <p className="mx-auto max-w-2xl text-base text-muted sm:text-lg">
          Track your team&apos;s progress, complete milestones, and climb the ranks in real-time.
        </p>
      </div>

      <div className="flex w-full flex-col gap-4 px-4 sm:w-auto sm:flex-row sm:justify-center sm:px-0">
        <Link
          href="/register"
          className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-accent px-8 text-sm font-semibold text-white transition-colors hover:bg-accent/90 sm:w-auto"
        >
          Register Team
        </Link>
        <Link
          href="/leaderboard"
          className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-border bg-card px-8 text-sm font-medium text-foreground transition-colors hover:bg-card-strong sm:w-auto"
        >
          View Leaderboard
        </Link>
      </div>

      <div className="grid w-full max-w-4xl gap-6 px-4 sm:grid-cols-3 sm:gap-8 sm:px-0">
        <div className="space-y-3 rounded-lg border border-border bg-card p-5 text-left shadow-sm">
          <div className="inline-flex h-8 w-8 items-center justify-center text-accent">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="font-semibold text-foreground">Earn XP</h3>
          <p className="text-sm text-muted">Complete milestones to earn XP and level up your team.</p>
        </div>
        <div className="space-y-3 rounded-lg border border-border bg-card p-5 text-left shadow-sm">
          <div className="inline-flex h-8 w-8 items-center justify-center text-accent-2">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="font-semibold text-foreground">Auto Validation</h3>
          <p className="text-sm text-muted">Milestones are automatically validated via GitHub commits.</p>
        </div>
        <div className="space-y-3 rounded-lg border border-border bg-card p-5 text-left shadow-sm">
          <div className="inline-flex h-8 w-8 items-center justify-center text-yellow-500">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="font-semibold text-foreground">Collect Coins</h3>
          <p className="text-sm text-muted">Earn coins for engagement and unlock special badges.</p>
        </div>
      </div>
    </div>
  );
}

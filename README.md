# ADSC Hackathon Leaderboard

A real-time live leaderboard for hackathon events. Teams register their GitHub repository, and the system automatically detects commits, validates milestone completion, and awards XP every 2 minutes — no webhook setup required on any team repo.

---

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Database:** MongoDB Atlas
- **Styling:** Tailwind CSS v4
- **Language:** TypeScript
- **Hosting:** Vercel (with Cron Jobs for auto-polling)

---

## How It Works

1. Teams register on `/register` with their name, members, and GitHub repo URL
2. Every 2 minutes, the server polls each team's GitHub repo for new commits
3. If a commit satisfies milestone rules (files present, keywords found, lines added), XP is awarded automatically
4. The live leaderboard at `/leaderboard` updates in real-time via Server-Sent Events
5. Judges visit `/admin` to see the full dashboard and manually review milestones

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                  # Home / landing page
│   ├── layout.tsx                # Root layout
│   ├── globals.css               # Global styles
│   ├── leaderboard/page.tsx      # Live leaderboard view
│   ├── register/page.tsx         # Team registration form
│   ├── team/page.tsx             # Team lookup
│   ├── team/[teamId]/page.tsx    # Individual team page
│   ├── admin/page.tsx            # Admin dashboard
│   └── api/
│       ├── admin/
│       │   ├── dashboard/        # GET  — all teams, milestones, submissions
│       │   └── action/           # POST — freeze team, manual award
│       ├── public/
│       │   ├── leaderboard/      # GET  — public leaderboard data
│       │   └── events/           # GET  — SSE stream for real-time updates
│       ├── team/
│       │   ├── register/         # POST — register a new team
│       │   ├── [teamId]/         # GET  — team info
│       │   └── [teamId]/submit/  # POST — manual milestone submission
│       ├── internal/
│       │   ├── poll/             # GET  — cron: auto-check all team repos
│       │   ├── ensure-indexes/   # POST — create MongoDB indexes
│       │   └── seed-milestones/  # POST — seed default milestones
│       └── webhooks/github/      # POST — GitHub push webhook (optional)
└── lib/
    ├── db.ts                     # MongoDB client
    ├── collections.ts            # Typed MongoDB collections
    ├── models.ts                 # Zod schemas and TypeScript types
    ├── check-team.ts             # Core logic: check commits, award XP
    ├── broadcaster.ts            # SSE broadcaster for real-time updates
    └── admin.ts                  # Admin auth helper
```

---

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your values:

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | Yes | MongoDB Atlas connection string |
| `MONGODB_DB` | No | Database name (default: `hackathon_leaderboard`) |
| `ADMIN_PASSWORD` | Yes | Password for the admin panel |
| `GITHUB_TOKEN` | Yes | GitHub PAT for reading repo/commit data |
| `CRON_SECRET` | Yes | Secret to protect the `/api/internal/poll` endpoint |
| `GITHUB_WEBHOOK_SECRET` | No | Only needed if using webhooks instead of polling |

---

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

Then initialize the database (run once):

```bash
# Create MongoDB indexes
curl -X POST http://localhost:3000/api/internal/ensure-indexes

# Seed default milestones
curl -X POST http://localhost:3000/api/internal/seed-milestones \
  -H "x-admin-password: YOUR_ADMIN_PASSWORD"
```

---

## Deploying to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → Import Project → select this repo
3. Set **Root Directory** to `leaderboard`
4. Add all environment variables in Vercel → Settings → Environment Variables
5. Deploy — Vercel reads `vercel.json` and runs the cron poll every 2 minutes automatically

> **MongoDB Atlas:** In Network Access, allow `0.0.0.0/0` so Vercel servers can connect.

---

## Admin Panel

- Visit `/admin` and enter your `ADMIN_PASSWORD`
- Freeze/unfreeze teams
- Manually award milestones that require human review
- View all submissions, XP totals, and commit history

---

## Milestone Rules (stored in MongoDB)

Each milestone can define:

- `files` — required file paths, minimum character count, required keywords
- `diff` — minimum files changed and lines added per commit
- `manualReview: true` — skips auto-check, admin must award manually

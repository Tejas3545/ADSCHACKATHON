# ADSC Leaderboard — Updated Implementation Plan (Applied)

## Scope Implemented

This plan now matches your latest rules and UI request:

- Repo-age aware XP policy with your multiplier bands.
- Commit keyword + folder-based milestone validation.
- Admin controls to start/end leaderboard game.
- Cleaner admin/team UI updates with SVG icons (emoji removed in key areas).

---

## Rule Model (Implemented)

## 1) Leaderboard Runtime

- Global game state in `settings` collection (`leaderboard_state`).
- Admin can trigger:
  - `startLeaderboard`
  - `endLeaderboard`
- While game is ended:
  - Team `submit` returns `409`
  - Team `sync` returns `409`
  - Automated checks (`checkTeam`) are skipped

## 2) Repo-Age XP Policy

Policy timestamps (env-driven with defaults):

- Event window start: `2026-03-20 07:30`
- Event window end: `2026-03-20 14:30`
- Old cutoff: `2026-03-14 12:00`

Repo tiers:

- `fresh` (created in event window) → repo multiplier `1.0`
- `mid` (created between old cutoff and event start)
  - pre-event commit → `0.85`
  - event-window/new commit → `1.0`
- `old` (created before old cutoff)
  - pre-event commit → `0.75`
  - event-window/new commit → `0.9`

Stored metadata on team:

- `repoCreatedAt`
- `oldestCommitAt`
- `repoTier`

Final XP formula now:

`finalXP = round(baseXP * timeBonusMultiplier * repoMultiplier)`

## 3) Milestone Validation Rules

Added milestone rule types:

- `commitMessageKeywords`
- `requiredPathPrefixes`

Validation behavior:

- Reject weak commit messages like `.`
- Require milestone keywords in commit message text
- Require changed files under expected folder prefixes

---

## Milestones (Configured)

## MS1 — Create repository and README

- README required (`README.md`, minimum chars)
- Diff minimums
- Commit message keyword match: `init`, `readme`, `repository`, `repo`

## MS2 — Frontend folder + requirements

- Changed files must include `frontend/`
- Diff minimums
- Commit message keyword match: `frontend`, `ui`, `client`, `react`, `next`

## MS3 — Backend folder + requirements

- Changed files must include `backend/`
- Diff minimums
- Commit message keyword match: `backend`, `api`, `server`, `database`, `auth`

MS2 and MS3 are independent, so they are naturally interchangeable.

---

## Files Updated

- `src/lib/models.ts`
- `src/lib/collections.ts`
- `src/lib/xp-calculator.ts`
- `src/lib/check-team.ts`
- `src/lib/default-milestones.ts`
- `src/app/api/team/register/route.ts`
- `src/app/api/team/[teamId]/submit/route.ts`
- `src/app/api/team/[teamId]/sync/route.ts`
- `src/app/api/admin/action/route.ts`
- `src/app/api/admin/dashboard/route.ts`
- `src/app/api/webhooks/github/route.ts`
- `src/app/admin/page.tsx`
- `src/app/team/[teamId]/page.tsx`
- `src/app/api/internal/reset-database/route.ts`

Added:

- `src/lib/leaderboard-state.ts`
- `src/lib/repo-xp-policy.ts`
- `src/lib/milestone-validation.ts`
- `src/lib/github-utils.ts`

---

## UI Notes (Uncodixify-aligned)

Applied immediately:

- Removed emoji usage in key admin/status surfaces.
- Replaced iconography with inline SVGs for actions/status.
- Reduced heavy rounded/pill look in admin panel badges/cards.
- Kept existing project color tokens; no random palette injection.

---

## Important Limitation (and Mitigation)

Case: "old project code was built locally but pushed only during event in a fresh repo".

- This cannot be perfectly detected from GitHub alone.
- Mitigation applied:
  - repo creation date tiering
  - commit message and folder-path milestone checks
  - optional oldest-commit metadata capture on registration

For stronger fairness later, add manual review sampling + code-age heuristics (e.g., first push volume anomaly checks).

---

## Next Improvements Recommended

1. Add audit log collection for XP mutations (who/why/old/new).
2. Add UI filter in admin submissions for reject reasons.
3. Add webhook/poll dedupe lock to avoid rare double-awards under concurrency.
4. Add a public game-state banner endpoint (`/api/public/state`).
5. Add backfill script to classify existing teams missing repo metadata.

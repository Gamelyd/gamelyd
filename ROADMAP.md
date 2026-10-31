# Roadmap

Planned work for Gamelyd, roughly in priority order. Items move to the commit
history once shipped.

**Today Gamelyd supports:** single-elimination knockout (single match, two-leg,
Bo3, Bo5), battle royale, groups into knockout, and leagues, with goal-difference
and head-to-head tie-breakers, Stripe and Paystack entry fees, organisations,
leaderboards and an admin area for users, orgs, tournaments, games, platforms,
ratings, reports and payouts.

## 1. Reliability and testing

- [ ] Run `npm run lint`, `npx tsc --noEmit` and `npm test` in CI before the
      Docker build, so a broken commit can't deploy
      (`.github/workflows/build-deploy.yml` currently builds and deploys only).
- [ ] Unit tests for `src/lib/knockoutSeries.ts` (series winners, `tieDepths`,
      `teamsStillIn`), including events whose winners were re-paired by hand.
- [ ] Extend `src/lib/bracketModel.test.ts` to cover `knockoutRoundLabels` for
      finished, in-progress and bye-heavy brackets.
- [ ] Tests for `groupQualifiers.ts`, `leagueStandings.ts` and `roundLabel.ts`.
- [ ] Service tests for draws, payments and payouts against a throwaway MongoDB.
- [ ] End-to-end tests (Playwright): sign up, create a tournament, register,
      pay, report results, crown a winner.

## 2. New tournament formats

- [ ] **Double elimination**: upper and lower brackets, optional grand-final
      reset.
- [ ] **Swiss system**: pair by record each round, no rematches, Buchholz and
      opponent-win-rate tie-breakers, optional top-cut into knockout.
- [ ] **Round robin**: single or double, as a standalone event, not only inside
      groups.
- [ ] **GSL-style groups**: four-team double-elimination groups.
- [ ] **Ladder / challenge**: open-ended ranking where players challenge those
      above them, with challenge windows and decay for inactivity.
- [ ] **King of the hill / gauntlet**: the winner stays on until beaten; the
      lowest seed climbs a step-ladder.
- [ ] **Battle royale points races**: multi-match lobbies scored by placement
      and kills, with presets per game and custom point tables.
- [ ] **Multi-stage events**: chain stages (open qualifier, then groups, then
      playoffs) with automatic advancement between them.
- [ ] **Seasons and circuits**: points across several tournaments feeding a
      final event and a season leaderboard.
- [ ] Bo7 series, a third-place match, and more tie-breakers (goals scored,
      wins, a decider match, coin toss as last resort).
- [ ] Seeding from ratings or past results instead of only manual or random.

## 3. Running an event

- [ ] Check-in window before start; no-shows are removed and the bracket is
      redrawn.
- [ ] Waitlist that fills dropped spots automatically.
- [ ] Match scheduling: start times per round, with email and in-app reminders.
- [ ] Score reporting by both sides; mismatches open a dispute for the
      organiser, with screenshot evidence.
- [ ] Manual bracket fixes for organisers (swap seeds, correct a result,
      replace a team), each recorded with who did it and why.
- [ ] Forfeits, disqualifications and walkovers handled consistently across all
      formats.
- [ ] Time-zone-aware schedules shown in each player's local time.

## 4. Admin coverage

- [ ] **Audit log**: every admin and organiser action (result edits, refunds,
      bans, setting changes) recorded and searchable.
- [ ] **Admin roles**: split full admin into super-admin, moderator, support
      and finance, each with its own permissions.
- [ ] **Two-factor authentication** required for admin accounts.
- [ ] **User moderation**: suspend, ban and unban with a reason and expiry, a
      history per user, and a check on banned users rejoining with new accounts.
- [ ] **Dispute queue**: open result disputes and reports in one place, with
      assign, resolve and notes.
- [ ] **Tournament controls**: pause, cancel with refunds, force-advance a
      round, take over from an inactive organiser.
- [ ] **Payments dashboard**: reconcile Stripe and Paystack against tournament
      entries, spot failed or duplicate webhooks, issue refunds.
- [ ] **Payout approvals**: review queue with limits and a two-person sign-off
      above a threshold.
- [ ] **Site analytics**: sign-ups, active users, tournaments created and
      completed, revenue by currency.
- [ ] **Announcements**: site-wide banners and email broadcasts to opted-in
      users.
- [ ] **Feature flags**: switch new formats on per org or for everyone.
- [ ] **Bulk actions** on users, orgs and tournaments, plus CSV export.
- [ ] **Whisperly admin UI**: a page for the existing `/api/whisperly/admin/*`
      routes (users, access, device resets), which are API-only today.

## 5. Robustness and security

- [ ] Optimistic locking on draws and results so two people saving at once
      can't overwrite each other.
- [ ] Idempotent Stripe and Paystack webhook handling, with a stored event ID
      and safe retries.
- [ ] MongoDB transactions for payment, entry and payout updates that must
      succeed or fail together.
- [ ] Rate limiting on login, signup, password reset, contact and Whisperly
      auth routes.
- [ ] Structured logging and error monitoring, with alerts on failed payments
      and webhooks.
- [ ] Health and readiness endpoints for the main app, as Whisperly already
      has.
- [ ] Versioned database migrations instead of one-off backfill scripts.
- [ ] Automated, tested backups and a restore runbook.
- [ ] Dependency and secret scanning in CI.

## 6. Players and organisers

- [ ] Organisation dashboard: entries, revenue and payouts per tournament.
- [ ] Player stats on profiles: events played, win rate, best finish, rating
      history.
- [ ] Team pages with a roster history.
- [ ] Shareable tournament pages with Open Graph images built from the existing
      export-image code.
- [ ] Leaderboard filters by game, platform and season.
- [ ] Discord integration: post results and bracket updates to a server.

## 7. Payments

- [ ] Refunds for cancelled tournaments and withdrawn teams before start.
- [ ] Payout history and statements for organisers.
- [ ] Prize pools that grow with entries, with a split per placing.
- [ ] Turn on Whisperly billing (`WHISPERLY_PAYMENTS_ENABLED`) once checkout
      and webhooks are tested.

## 8. Docs and developer experience

- [ ] README: who Gamelyd is for, screenshots, and a local MongoDB setup
      (Docker Compose) so the app runs without a cloud database.
- [ ] Seed script with made-up sample users, orgs and tournaments.
- [ ] Architecture notes for the bracket engine and how to add a new format.
- [ ] CONTRIBUTING.md with the lint, type-check and test steps.

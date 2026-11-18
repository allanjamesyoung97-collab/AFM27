# AFL Manager 27 — project context

**Documentation checked:** 4 November 2026  
**Project type:** Browser-based AFL club management and match simulation game built with React, Vite, and JavaScript/TypeScript.

## Project goal

Let a user manage an AFL club across seasons: choose a club and game mode, select and develop a list, manage staff and contracts, recruit and trade, play or simulate matches, and progress through finals and the offseason. The longer-term gameplay goal is a coherent, believable AFL season and an engaging 2D match presentation. The 2D presentation is intended to approach the organic movement, ball flight, and match flow seen in the user's Magnet Board reference videos; that quality has not yet been achieved reliably.

This document describes the inspected writable copy at `/Users/allanyoung/Documents/Codex/contract-structure-revamp`. It is not proof that the same files are already in the user's StackBlitz project. The read-only mounted project at `/Users/allanyoung/Documents/ChatGPT/AFLGM` was found to differ in several files. Reconcile copies before transferring changes.

## Game modes and start dates

The codebase contains entry points and tools for three modes:

- **Classic Mode:** Start with existing club lists and manage a full career.
- **Club Reset Mode:** Clubs draft their lists from a shared player pool before the career proceeds.
- **Fantasy Mode:** Fantasy tools allow broader player/team editing and legends management, including separate direct-add and legends-draft workflows.

The career start-date engine supports two starts:

- **After the Grand Final:** 1 October 2026.
- **Preseason:** 1 February 2027.

The preseason path is designed to start with the existing 2027 rosters and treat the initial 2026 draft as completed. Calendar progression and season transitions are handled by engine/state code; keep those transitions intact when changing the start flow.

These mode screens and supporting systems exist in the inspected source. Their complete end-to-end behavior in every mode has not been acceptance-tested here.

## Main systems and locations

- `src/App.tsx`: top-level game state, screen routing, career state wiring, and major callbacks. Large and sensitive to broad replacements.
- `src/components/`: user-facing screens. Examples include `Dashboard.jsx`, `SquadScreen.jsx`, `SeasonScreen.jsx`, `MatchCentre.jsx`, `LiveMatchOval.jsx`, `RecruitmentScreen.jsx`, `ScoutReportDossier.jsx`, `ClubAdministrationScreen.jsx`, `JobMarketTab.jsx`, `ClubResetDraftScreen.jsx`, `SeasonFinale.jsx`, and fantasy tools.
- `src/engine/`: rules and state transitions for seasons, calendar, matches, movement/presentation, player development, training, contracts, staff, scouting, drafts, salary caps, trades, and fantasy tools.
- `src/data/`: clubs, player lists and templates, player attributes, heights, traits, legends, draft data, and related game content.
- `src/state/`: initialized game-state structures and related state helpers.
- `src/lib/`: browser storage and optional Supabase-backed account/career-save behavior.
- `src/workers/`: background work. Check consumers before moving or duplicating simulation work.
- `vite.config.ts`: Vite setup plus an opt-in developer endpoint for writing sanitized player-attribute overrides to a local data file.

The engine should own rules and simulation outcomes; components should gather input and render state. In played matches, the resolved event stream should remain the shared source for animation, commentary, box score, and season result. Presentation must not independently invent a result.

## Career saves and account storage

The application supports local browser saves and optional cloud career saves through Supabase. Cloud behavior depends on browser-side `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` configuration, a working Supabase project, the expected database schema/migrations, and correctly restricted row-level-security policies. A public anon/publishable key is intended for browser use; a service-role key is not.

The existence of local/cloud save code does not by itself establish production-grade durability. Cross-device recovery, interrupted/corrupt-write recovery, migration from every historical save version, database policy correctness, backup/restore, and release operations still need explicit verification.

The developer attribute writer is separate from player-facing saves. It is disabled unless `AFM_ENABLE_PLAYER_ATTRIBUTE_WRITER=true` is set for the local Vite server and that server is restarted. It writes a sanitized override JSON file and should only be enabled in a trusted private development workspace.

## Gameplay rules and design decisions

### Player ages, development, and positions

- Player ages originate in the player data and should remain stable during a season. Add one year at season rollover; avoid random age changes during daily/calendar simulation.
- Development should combine age, potential, training, club-wide training plan, targeted focus, coaching, match time, and player suitability. Forecast and actual calendar progression should use compatible inputs.
- Players can train toward another position over time. Training duration should depend on current suitability. A completed position course adds that role without removing existing roles.
- A player can focus on either attribute development or a new position at a time.
- Positional ratings are suitability estimates; they must not inflate above base overall.
- Traits are intended to develop from relevant history (for example, Injury Prone from repeated injury frequency) and contribute automatically in matching game situations.

### Team selection and match roles

- The hard fielding floor is 18 players. If a valid replacement cannot be arranged, the current player stays on until the rotation can be made.
- Players may be placed in secondary positions, but suitability should affect their effective rating and role performance. Match rotations should preserve a legal field count and avoid assigning players to roles they cannot reasonably cover.
- The user's selection strategy presets include Best Available, Rest Players, Prioritise Youth, Match Opponent, and Protect Stars. Preset effectiveness has been reviewed and revised in previous work, but every preset still needs practical verification against live match situations.
- Possessions and actions should be phase-appropriate: midfielders, wings, and half-backs should generally lead disposal counts, while forwards and key forwards receive more of the scoring and aerial work appropriate to their roles.

### Match simulation and presentation

The played-match system includes a match state engine, event/commentary presentation, 2D oval, player movement helpers, shot logic, pace controls, live statistics, and goal/quarter presentation. The intended passage structure is a centre bounce, clearance, transition/entry, contest, then a shot or turnover, with player roles and ball movement supporting that sequence.

Design targets established by the user:

- Natural, continuous player movement rather than players snapping back to fixed zones or clustering around the ball.
- Ball travel that reflects kick distance, direction, hang time, and receiver location; avoid implausible long kicks or arbitrary possession hand-offs.
- A 6-6-6 starting formation at centre bounces, with teams shifting according to the clearance direction.
- Exactly 18 players per side visibly on field.
- A set shot should visibly settle on the kicker briefly and show distance; goals should animate and celebrate only once the score event has visibly resolved.
- A centre bounce follows a goal and begins each quarter. A behind or ordinary turnover does not reset the ball to the centre.
- Quarter-end banners should say Quarter Time, Half Time, Three Quarter Time, and Full Time, with a pause prompt between quarters.
- Spacebar pauses/resumes live play.

These are design requirements, not a claim of complete implementation. The current system has had user-reported issues with choppy/clumped movement, strange ball possession and trajectories, goals not visibly resolving, premature/missing celebration effects, formation after goals, and implausible scoring rates. See `PROGRESS.md`.

### Contracts, trades, recruitment, and staff

- Player contracts should include meaningful club and player decisions (salary, age, role, cap space, replacement options, playing opportunity, security, morale, and club appeal). A “consider” decision should have a clear time-based follow-up rather than silently acting as acceptance.
- Contract requests/counters should not create an easier or more favorable path for the user than a direct offer. Avoid accidental duplicate resignings shortly after a deal is signed.
- The intended standard contract structure includes base salary, match payments, performance incentives, and trigger clauses; the user explicitly excluded ASAs.
- Trade UI supports multi-asset packages, players and picks. Successful processing must transfer both sides' assets and reset the selected package state.
- Trade Genius (`src/engine/tradeGeniusEngine.js`, `src/components/TradeGenius.jsx`) suggests trades clubs will accept using `evaluateFairPackageExchange` (Shop Your Assets exchange rules plus best-23, headline-player and market-value protections in `playerValuationEngine.js`). Its Trade Chain and multi-club shop trades are applied atomically by `handleTradeGeniusComplete` in `src/App.tsx`; call that, not `handleShopTradeComplete` repeatedly, for any trade touching more than one club.
- Father-son/academy bidding lives in `src/engine/draftBiddingEngine.js` (DVI, ladder loadings, two-pick cap, deficits, compensation picks, prospect links) and is applied to the draft by `placeDraftBid`, `resolvePendingBid` and `processAIDraftPicks` in `src/engine/draftEngine.js`. Draft state carries `pickMeta` alongside `pickOwners`; anything that rebuilds pick order from pick assets must use `draftPickMetaFields` so both stay in step.
- Recruitment scouting is intended to compare a target's estimated attributes, tactical fit, likely role, squad comparisons, and development outlook. Report precision should depend on staff quality and further scouting; up to five players may be scouted at once. Shortlisting belongs in Trade Lab.
- Staff management is intended to support multi-year staff deals, renewals, market offers, poaching, counter/match offers, and an unattached market. The staff market currently has known UI/state-flow defects described below.

### Finals and season review

The desired post-season flow is a prominent standalone Grand Final result, followed by a season-in-review page that displays at least AFLCA, Brownlow, and Coleman award winners before the offseason. The code includes `SeasonFinale` and final-result support, but a user reported that a played Grand Final did not show the expected finale. Verify both played and simulated Grand Final transitions.

## Project commands

The inspected `package.json` exposes:

- `npm run dev` / `npm start`: Vite development server.
- `npm run build`: TypeScript project build followed by Vite production build.
- `npm run lint`: Oxlint.
- `npm test`: Node test runner.
- `npm run preview`: serve the built app locally.

There are engine test files, but their presence does not prove full game acceptance. Do not report a passing build, lint, or test run unless it was actually run against the current copy.
# Project progress

**Last reviewed:** 4 November 2026  
**Last updated:** 5 November 2026 (feature work, see “Changes made 5 November 2026”; none of it has been run)  
**Scope:** Source inspection of `/Users/allanyoung/Documents/Codex/contract-structure-revamp`. No application code or tests were changed/run during this documentation pass.

## How to read this status

“Present in source” means the inspected copy contains a component, engine, data structure, or flow for that feature. It does not mean the feature has passed end-to-end gameplay testing or is present in the user's StackBlitz workspace. User-reported behavior is listed separately from code inspection.

The writable copy inspected here differs from `/Users/allanyoung/Documents/ChatGPT/AFLGM`, the read-only mounted copy. Treat the writable copy as the basis of these documents and reconcile before copying files to StackBlitz.

## Present in the inspected source

- Three game-mode pathways: Classic, Club Reset, and Fantasy, with mode-specific selection and management components.
- Career start choices for After the Grand Final (1 October 2026) and Preseason (1 February 2027).
- Season/calendar progression, fixture and finals systems, and local career persistence.
- Optional Supabase account and cloud-career integration, with corresponding client libraries and save flows.
- Player data, attributes, heights, traits, development, training, positional suitability, and fantasy editing/legend data.
- Team selection, five interchange positions, selectable presets, saved custom selections, and match-day selection state.
- Played and simulated match systems, live statistics, tactics/instructions, match presentation, 2D oval, movement helpers, shot logic, quarter/goal UI, and commentary.
- Recruitment, scouting reports/dossiers, shortlist integration, trade tools, draft systems, and free-agency-related engines.
- Club administration, staff market/contracts, club finances/facilities, and job-market components.
- `vite.config.ts` contains a development-only player attribute file writer. It is opt-in via `AFM_ENABLE_PLAYER_ATTRIBUTE_WRITER=true`, checks same-origin requests, filters supported fields and bounds, and writes overrides atomically.
- `package.json` provides `build`, `lint`, and `test` scripts; engine test files are present.

## Changes made 5 November 2026 (implemented, not run)

These were written and syntax-checked only. No build, lint, test suite or browser session was run, so treat all of them as unverified until exercised in StackBlitz.

- **Live/played match smoothness** (`LiveMatchOval.jsx`, `MatchCentre.jsx`, `liveMatchPacing.js`, `matchPresentation.js`): players ease toward targets with frame-rate-independent smoothing; each action's animation fills its interval; the tick delay subtracts simulation/render time; shots use a longer 800 ms slot; the ball blends linear and eased motion; after a goal the ball glides back to the centre instead of teleporting.
- **Goal display:** the goal banner above the oval and the caption under it are removed for goals. “GOAL” draws above the centre circle and the leading team and margin (for example “Collingwood by 1”, or “Scores level”) below it. The goal still appears in THE CALL.
- **Match speed:** the 1.5x presentation cap is gone, so 1x/2x/4x/8x divide the action interval (40 ms floor). Goal celebrations speed up to a 3x maximum. Match results should not depend on speed. At 8x the game may not keep up with ~60 ms ticks.
- **Goal posts and goal square:** each end draws a 6.4 m x 9 m goal square, goal posts 6.4 m apart and behind posts a further 6.4 m out; behinds land between a goal post and a behind post.
- **Interchange timing:** rotations happen only at quarter breaks (up to 5), the set shot after a mark (4), stoppages (3) or when the ball is on the bench side (1; bench side assumed to be the bottom of the oval). Never during the kick. The ball carrier, receiver, defender and set-shot taker are protected. A player coming on takes the exact position of the player replaced; the player going off jogs to the boundary. Set shots were not lengthened to 30 seconds of game time.
- **Finals bracket** (`FinalsBracket.jsx`, `finalsBracket.js`, `SeasonScreen.jsx`; `finalsEngine.js` exports `dateAtWeek`): the Finals tab is an AFL-style bracket with a wildcard column, W/L connectors, projected teams from the ladder, a highlighted path for the user's club and report links for played matches.
- **Trade Genius** (`tradeGeniusEngine.js`, `TradeGenius.jsx`, `TradeLab.jsx`, `RecruitmentScreen.jsx`, `App.tsx`, `playerValuationEngine.js`):
  - New TRADE GENIUS tab in Trade Lab, plus a “Use Trade Genius” prompt at the top of Shop Your Assets (manual shopping is unchanged).
  - **Trade Chain** (formerly “Find a player”): up to three positions or types, optional minimum overall, excluded assets. Targets at different clubs produce multi-club trades with the user's assets split so every club accepts its own leg.
  - **Shop my assets**: best return each club will give for up to three chosen assets. A checkbox (on by default) lets those assets be split between up to three clubs.
  - Acceptance uses `evaluateFairPackageExchange`: the Shop Your Assets exchange rules plus fair-trade protections (tiered premium with +18% for a club's best 23, a headline rule that a best-23 player rated 80+ needs a comparable player within 7 OVR or an early pick back, and a market guard that a club will not give up more than about 25% more neutral market value than it receives). This replaced the looser Shop-only rule after trades looked unrealistic (for example a club's best player for a role player).
  - Results show neutral market value given and received; “Best value” sorts by that gain.
  - Other clubs' salary-cap breaches (current contracts) rule a suggestion out; the user's own cap only produces a warning because incoming contracts are renegotiated.
  - Incoming players go through the existing contract negotiation one by one (pick-only returns skip it); `handleTradeGeniusComplete` in `App.tsx` applies every leg atomically with the same checks as `handleShopTradeComplete`.
  - Not built: clubs trading assets among themselves (pick funnelling like the five-club deal in the reference screenshot). Every trade currently has the user's club on every leg.

- **Father-son and academy drafting** (`draftBiddingEngine.js` new; `draftEngine.js`, `DraftScreen.jsx`, `App.tsx`, `RecruitmentScreen.jsx`, `worldSimulationEngine.js`), based on the AFL's revised bidding rules:
  - National-draft prospects can carry a father-son, Northern Academy (Brisbane, Gold Coast, Sydney, GWS) or NGA link to a club. The four real 2026 links are Cody Walker (Carlton father-son), Dougie Cochrane (Port Adelaide NGA), Ethan Matthews (GWS) and Caylen Murray (Brisbane); generated classes get a seeded mix of about three Northern Academy, two NGA and four father-son prospects. Rookie and mid-season drafts have no bidding.
  - Any club can bid on a rival's tied prospect at its own pick; the home club can match with its own later picks, paying draft value index (DVI) points. DVI is approximate, calibrated to the AFL's examples (pick 1 = 3000, pick 2 = 2481, pick 6 = 1659).
  - Ladder loadings: finished 1st-2nd +20%, 3rd-4th +10%, 11th or lower -10% (assumed to apply to bids at picks 1-18). A bid at picks 1-36 can be matched with at most two picks. A deficit is capped at 412 points and costs the club its next first-round pick (second-round if the first is traded), applied when the draft completes. Picks acquired by trade cannot be used to match (`MATCHING_REQUIRES_OWN_PICKS`, one constant to flip). A matched bid inserts the home club's selection and pushes the bidding club's pick back one place; a bottom-five club that is pushed back gets a compensation pick at the start of round two (one per club).
  - AI clubs bid when a tied prospect is rated at least as highly as the pick and better than the player they would otherwise take; AI home clubs match when affordable and the bid is not far above the prospect's rank. When the manager's prospect is bid on, the draft pauses on a match panel (pick value, loading, points to match, selectable picks, deficit, suggested picks). The manager can also bid on a rival's prospect (binding: if the home club does not match, the player is drafted). The Draft screen lists tied prospects with estimated matching cost, a bids and matches log, and notes in the results table.
  - Not modelled: official nomination/eligibility confirmation, historical predecessor-club father-son rules, and the state-league games requirements for some WA/SA pathways. Existing saves keep their current draft; the new fields default safely, but their prospects have no links until the next draft is generated.

## Changes made 17 November 2026 (implemented, not run in a browser)

- **Sponsorship packages.** Offers now differ in structure as well as value: Guaranteed (fixed fee), Up-front payment (signing payment plus lower fee), Performance-linked (lower fee plus season bonuses) and Up-front + performance. Every set of five offers mixes plain and combined deals. Bonuses are drawn from wins, ladder finish, finals progress, membership growth and supporter satisfaction, weighted by sponsor type. Logic lives in `clubAdministrationEngine.js` (`generateSponsorshipOffers`, `buildSponsorCounter`, `settleSponsorIncentives`, `sponsorTerminationFee`); the Commercial tab in `ClubAdministrationScreen.jsx` shows the breakdown.
- **Sponsor counters re-package instead of adding money.** Three requests per offer (more up front, more guaranteed, add bonuses), one counter per offer. A club with high reputation concedes less value.
- **Settlement.** Bonuses are assessed at season rollover (`advanceClubAdministrationSeason`, new `seasonOutcome` argument from `App.tsx`) and paid into cash; the Commercial tab shows the last settlement. Deals signed after round 1 start earning bonuses the following season, and replacement offers after round 1 are guaranteed or up-front only. Early termination also refunds the unearned part of a signing payment.
- **Trade and free-agent signings keep negotiated conditional pay.** `conditionalTermFields` and the extended `contractSigningFields` in `contractComponents.js` are saved by `executeTrade` and `signFreeAgent`, replacing the previous club's terms. `TradeLab` passes `seasonState` to the trade negotiation screen.
- Not verified in a browser; existing saves keep legacy offers and sponsors, which display as Guaranteed.

## Changes made 17 November 2026 (finals stall after a developer skip; implemented, verified in Node only)

- **Reported:** after skipping to Grand Final day from preseason, the season stayed in the wildcard phase, the button read "COMPLETE WILDCARD ROUND", and one wildcard game showed `NaN vs NaN`.
- **Cause of the stall:** a knockout result with no usable scoreline has no winner, so `advanceCompetition` never found two wildcard winners and the finals never began. The Season screen's stage button then asked the calendar for the wildcard date, which was already in the past, so it did nothing. The original source of the `NaN` scoreline was not reproduced from default data and is still unknown.
- **Fix:** `commitCalendarMatchResult` now guarantees a finite scoreline for every match (`ensureValidScoreline`), and `advanceCompetition` repairs any stored wildcard or finals result that has no usable score or winner, which also frees saves that are already stuck. `simulateCalendarStage` in `App.tsx` steps forward a day when a stage date has passed.
- **Calendar speed-up.** `advanceWorld` now takes one rollback copy of the world per day (and per slot on the target day) instead of one per slot, and matches simulated inside the loop are applied to that working copy instead of cloning the world again for each match. Deep-copying the world was about 37% of simulation time. Verified in Node: the full game state is byte-identical to the previous version in five scenarios (60 days, stop before first match, developer skip, finish-target-day, and a full preseason-to-Grand-Final skip), and a preseason-to-Grand-Final skip dropped from about 100s to about 69s. Matches played by the manager still use their own copy. Not measured in the browser or in the web worker.
- Check this next time: if `scoreRepaired` appears on a result in a save, a match produced an unusable scoreline, and the root cause should be traced from that save.

## Partially implemented or requiring verification

- **Full-season reliability:** Core systems exist, but no full acceptance pass was performed here for both modes, played and simulated matches, saves/resumes, injuries, finals, trade period, awards, drafts, and season rollover.
- **Cloud saves:** Auth and cloud-save code exists. Supabase schema, migrations, row-level security, recovery from interrupted/corrupt writes, and production backups are not verified by this review.
- **Player development and age:** The codebase has development and rollover systems. Verify actual gameplay uses fixed base ages with a single one-year increase at rollover, and that actual daily development receives the same club training plan used by forecast screens.
- **Position training and match rotations:** Supporting code exists. Verify completed positional training is retained, a player cannot double-focus, rotations maintain at least 18 field players, and attribute-based suitability controls secondary-role performance.
- **Presets:** Five named presets exist, and selection logic is present. Validate Match Opponent, Protect Stars, Rest Players, Prioritise Youth, and Best Available on representative squads and injuries.
- **Recruitment scouting:** Components and dossier/report logic exist. Verify scout-quality precision, additional-scouting timing, five-player concurrency, player comparison controls, and shortlist movement in an actual career.
- **Staff market:** Staff contracts and market components exist, but user reports indicate the candidate flows are broken (details below).
- **Finale:** Finale/result components exist. Verify the played Grand Final path, not only simulated results, enters the standalone finale and then the award review before offseason.
- **2D match:** Movement, pacing, event, shot, and presentation modules exist. Their output still needs substantial game-level evaluation against the user's realism target.

## Known issues reported by the user

These are user-observed reports, not claims independently reproduced during this documentation pass. Mark them unresolved until a current build is exercised and the issue is confirmed fixed.

### Match gameplay and 2D presentation — highest priority

- Match movement remains choppy, clustered, or unintelligent; players may not spread or move naturally with play. (Smoothing, pacing and interchange changes were made on 5 November 2026 but are unverified; keep this open until confirmed in a current build.)
- Ball possession and travel can look arbitrary: the ball bounces in space, moves implausibly, or is handed to players to satisfy possession expectations.
- Goal actions and their animation have sometimes been skipped or not appeared; goal halos/celebrations have appeared before the visible scoring action.
- Teams may not reset into the intended 6-6-6 formation after goals, and the centre-bounce flow may not match clearance direction.
- Some close-range shots fail to cover the distance plausibly.
- Scoring and player stat output are inconsistent: reports include 200 points in a first half, other very low match scores (28–8, 44–12, 50–39), and too few disposals in some games. Forwards have also dominated disposals when midfielders, wingers, and half-backs should usually lead.
- Verify score, goals/behinds, commentary, player/team statistics, match result, and season ladder use the same resolved events.
- A played Grand Final reportedly did not show the expected prominent finale/review flow.

### Staff contracts and market

- Offering a contract to an unattached staff member reportedly puts the negotiation in the “Other clubs” section instead of the unattached-staff flow.
- The “Other clubs” staff list reportedly shows no staff, preventing poaching approaches.
- The user wants the staff member's requested salary/term displayed up front when “Offer contract” is clicked, matching the reference behavior. Confirm the current interaction presents those requested terms and routes the response to the correct market category.

### Reliability and user experience

- Earlier project history includes intermittent lazy-screen MIME/import failures, blank/slow startup, and screen crashes. The writable source copy may contain mitigations, but reliability across refreshes and routes is unverified.
- Verify save compatibility and error recovery with real browser reload/resume flows; code-level smoke inspection is insufficient.

## Next priorities

1. **Make played-match outcomes coherent.** Trace one resolved possession from event creation through movement, ball trajectory, shot/goal presentation, player stats, match result, and season result. Remove any independent outcome rolls or possession balancing that conflict with that event. Establish believable scoring and role-based disposal distributions.
2. **Fix staff-market routing and data.** Trace unattached offer, other-club list generation, offer response, acceptance, staff transfer, and budget changes. Keep each candidate and negotiation in the correct category; show requested terms before submission.
3. **Verify goal and centre-bounce state transitions.** Enforce 6-6-6 setup at centre bounce, correct 18-player sides, goal-only in-game centre resets, quarter starts, visible scoring action before celebration, and plausible shot distance outcomes.
4. **Run the full-season acceptance pass.** Cover Classic and Club Reset at minimum, played and simulated fixtures, saves and resumes, injury/suspension, finals and played Grand Final, award review, trading, draft, and rollover. Include Fantasy workflows where release scope requires them.
5. **Verify the 5 November changes.** Watch several quarters at each match speed (goal overlay, goal square/posts, smooth motion, interchange timing, no missing positions); open the Finals tab before, during and after finals; try Trade Genius (Trade Chain with one, two and three targets, Shop my assets with and without multi-club, excluded assets, cap warnings, a multi-club trade completing for all clubs, and whether suggested values now look realistic). Run a full draft with bids: AI bids and matches, the match panel when a bid lands on your prospect, bidding on a rival's prospect, compensation picks, deficits costing next year's first-round pick, and that a saved draft in progress still loads.
6. **Validate contracts and movement.** Test direct offers, player counters, consider/wait states, expiry timing, three-month re-sign restriction, staff renewals/poaching, pick/player transfer, and package reset after successful trades.
7. **Validate development, selection, and scouting.** Check age rollover, veteran decline and youth growth, actual vs forecast training inputs, positional training completion, 18-player floor, all selection presets, scout quality/concurrency, and shortlist transfer.
8. **Confirm production persistence and release operations.** Verify Supabase migrations/RLS, save migration and recovery, hosting variables, error reporting, backups, and rollback before publishing.

## Validation record for this documentation pass

- Inspected file inventory, package scripts, Vite configuration, start-date logic, save integration, staff and match modules, and the two project-copy difference.
- Did not modify application code.
- Did not run build, lint, or tests; this pass was documentation-only.

## Changes made 18 November 2026 (Tasmania career; implemented, engine-tested in Node only, not run in a browser)

- **Tasmania career** (Classic mode, new card on the club selection screen). Starts 1 Oct 2026 (after the Grand Final) with no list; the 2026 trade period and national draft are run automatically so draftees join their clubs (verified: 58 players drafted, all in the game and on their clubs). `runTasmaniaFirstSeason` in `App.tsx` simulates 2027 for the 18 clubs (same fast-forward path as the developer skip, plus the season rollover), then hands control over on 1 Oct 2027 at the Recruitment > Trade Lab screen. State flag: `seasonState.expansionCareer` (`SIMULATING` -> `CONCESSION` -> `ENTERED`).
- **Concession window** 1-18 Oct 2027 (`tasmaniaConcessionOpen/Close` in `seasonRules.js`). Players out of contract after 2027 appear in the Free Agents tab with status `TAS_CONCESSION` (new status in `getFreeAgencyStatus`, only when `tasmaniaConcession` options are passed, so AI clubs never see them). One per club, max 18, no rival bids. Each signing adds compensation picks for the losing club (`tasmaniaExpansionEngine.js`).
- Free agency, trade period and draft then run as normal using Tasmania's existing 2027 concession picks. At 1 Jan 2028 `activateTasmaniaExpansion` keeps the manager's own administration and signings and only tops up generated recruits (18 minus concession signings).
- Pre-entry rollover starts Tasmania's books fresh instead of settling a season it did not play.
- Verified in Node: full 2027 sim + rollover with Tasmania as manager; concession pool and one-per-club rule; 10 signings kept into 2028 (list of 43); Tasmania on the 2028 ladder with 23 fixture games. Not tested: the UI, the played draft, Fantasy/Club Reset modes. Board objectives for 2028 are generic. The simulation takes roughly 2 minutes.

## Disposal chains (18 November 2026; Node-tested on a headless copy of the chain logic, not played in a browser)

- **Cause of low, key-position-heavy disposals in played matches:** each action (7-10 game seconds) could credit one disposal and only transition, forward entry and the shot kick counted (the clearance was always a carry); after any turnover the next chain started at a random stoppage where the *nearest* player collected the ball, which in the 50s meant key forwards and defenders.
- **Changes:** `liveMatchPacing.js` actions now cover 3-5 seconds; `matchPresentation.js` gains `chooseStoppageCollector` (line affinity x zone x distance, with a soft cap on one player's involvement), clearances are disposals (about 88%), midfield and forward-line chains loop, half-backs/half-forwards/forward pockets get receiving bonuses, back-line receivers only in deep defence; `MatchCentre.jsx` makes the defender rebound after a turnover (key defenders less often), sends behinds to a kick-in, lets a mark outside 38m link to a lead, and shifts forward-entry turnover (0.9 -> 0.74 base). `statisticsEngine.js` uses a per-position `DISPOSAL_ROLE_WEIGHT` table for simulated matches.
- **Measured (24-30 matches, headless):** old chain logic 64 disposals per team with key forwards (7.5) and key defenders (5.5) level with midfielders (8.3); new about 380 per team with midfielders ~38, wings ~36, half-backs ~19, key defenders ~13, half-forwards ~22, key forwards ~10, ruck ~9. Simulated-stat path: ~394 per team, midfielders 25, wings 23, half-backs 19.5, key defenders 11, key forwards 8.6.
- **To verify in play:** shots per team are about 31 in the headless model (target 22-28), midfielders and wings are still high and forward pockets low; scores in played matches will have risen with the extra actions, so re-check scoring (and match length, roughly 1.5-2x longer at 1x speed).
import { useState } from "react";
import TrophyCollection from "./TrophyCollection.jsx";
import { TROPHIES, trophyProgress } from "../engine/trophyEngine.js";

const modes = [
  {
    id: "CLASSIC",
    name: "Classic Mode",
    eyebrow: "FULL AFL CAREER",
    description:
      "Continue with the management experience: choose a club, manage your squad, and build toward a premiership.",
    available: true,
    icon: "classic",
  },
  {
    id: "FANTASY",
    name: "Fantasy Mode",
    eyebrow: "FREE REIN",
    description:
      "Play the full Classic career with free rein: create players, edit any player or team, and bring in legends.",
    available: true,
    icon: "fantasy",
  },
  {
    id: "CLUB_RESET",
    name: "Club Reset Mode",
    eyebrow: "LEAGUE-WIDE DRAFT",
    description:
      "Draft every club’s list from the current AFL players and 50 new prospects, then continue with the full Classic Mode ecosystem.",
    available: true,
    icon: "reset",
  },
];

function ModeIcon({ type }) {
  const common = {
    width: 28,
    height: 28,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    focusable: "false",
  };

  if (type === "classic") return <svg {...common}><path d="M8 4h8v3a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5v1a4 4 0 0 0 4 4M16 6h3v1a4 4 0 0 1-4 4M12 11v5m-4 4h8m-7-4h6l1 4H8l1-4Z"/></svg>;
  if (type === "fantasy") return <svg {...common}><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z"/><path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14ZM5 3l.7 1.8L7.5 5.5l-1.8.7L5 8l-.7-1.8L2.5 5.5l1.8-.7L5 3Z"/></svg>;
  return <svg {...common} aria-hidden="true"><path d="M20 11a8 8 0 1 1-2.35-5.65L20 7"/><path d="M20 3v4h-4"/></svg>;
}

function savedModeLabel(mode) {
  if (mode === "FANTASY") return "Fantasy Mode";
  if (mode === "CLUB_RESET") return "Club Reset Mode";
  return "Classic Mode";
}

export default function GameModeSelectionScreen({
  onSelectMode,
  onResume,
  onResumeSave,
  savedGame,
  savedGames = [],
  resumeClubName,
  onDeleteSavedGame,
  cloudAvailable = false,
  cloudUser = null,
  cloudBusy = false,
  cloudMessage = "",
  passwordRecovery = false,
  localCareersAvailable = 0,
  onCloudAuth,
  onImportLocalCareers,
  onRefreshCloudCareers,
  appearance = "dark",
  textSize = "STANDARD",
}) {
  const [manageSavedGamesOpen, setManageSavedGamesOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [dismissedSavedGame, setDismissedSavedGame] = useState(false);
  const [landingTab, setLandingTab] = useState("MODES");
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountAction, setAccountAction] = useState("SIGN_IN");
  const lightMode = appearance === "light";
  const baseFontSize = textSize === "LARGE" ? 18 : textSize === "EXTRA_LARGE" ? 20 : 16;
  const legacySavedGame = resumeClubName ? { id: "legacy-career", clubName: resumeClubName } : null;
  const availableSavedGames = dismissedSavedGame || cloudBusy
    ? []
    : savedGames.length > 0
      ? savedGames
      : savedGame
        ? [savedGame]
        : legacySavedGame
          ? [legacySavedGame]
          : [];
  const activeSavedGame = dismissedSavedGame || cloudBusy ? null : savedGame ?? availableSavedGames[0] ?? null;
  const savedDateLabel = (game) => game?.savedAt
    ? new Date(game.savedAt).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })
    : "Save date unavailable";
  const savedRoundLabel = (game) => {
    switch (game?.phase) {
      case "HOME_AND_AWAY":
        return `Round ${Math.min(game.round ?? 1, game.totalRounds ?? 23)} of ${game.totalRounds ?? 23}`;
      case "PRESEASON": return "Preseason";
      case "OFFSEASON": return "Offseason";
      case "POST_SEASON": return "Post-season";
      case "WILDCARD": return "Wildcard round";
      case "FINALS": return "Finals";
      default: return "Season progress unavailable";
    }
  };
  const careerTrophies = savedGames.map(game => trophyProgress(game.seasonState, game.clubName)).flat();
  const trophySummary = TROPHIES.map(trophy => {
    const options = careerTrophies.filter(item => item.id === trophy.id);
    return options.sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || b.progress - a.progress)[0] ?? { ...trophy, unlocked: false, progress: 0 };
  });

  const deleteCurrentSavedGame = (saveId) => {
    if (onDeleteSavedGame) {
      onDeleteSavedGame(saveId);
    } else {
      // Compatibility with older App.tsx versions that only pass resumeClubName.
      try {
        window.localStorage.removeItem("afl-manager-save-v1");
        window.localStorage.removeItem("afl-manager-saves-v1");
      } catch {
        // The game mode screen remains usable if browser storage is unavailable.
      }
    }
    if (!onDeleteSavedGame) setDismissedSavedGame(true);
    setConfirmDeleteId(null);
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        boxSizing: "border-box",
        padding: "clamp(24px, 5vw, 64px)",
        color: lightMode ? "#0f172a" : "#f8fafc",
        background: lightMode
          ? "radial-gradient(ellipse at top, #ffffff 0%, #e2e8f0 68%)"
          : "radial-gradient(ellipse at top, #172554 0%, #020617 58%)",
        fontFamily: "Arial, sans-serif",
        fontSize: baseFontSize,
        display: "flex",
        alignItems: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 1120, margin: "0 auto" }}>
        <div
          style={{
            color: "#fb923c",
            fontSize: 12,
            letterSpacing: 4,
            fontWeight: 800,
          }}
        >
          AFL MANAGER 27
        </div>
        <h1
          style={{
            margin: "12px 0 8px",
            fontSize: "clamp(2rem, 5vw, 3.5rem)",
            lineHeight: 1.05,
          }}
        >
          Choose Your Game Mode
        </h1>
        <p
          style={{
            color: lightMode ? "#475569" : "#94a3b8",
            maxWidth: 660,
            margin: "0 0 30px",
            fontSize: 16,
            lineHeight: 1.6,
          }}
        >
          Select how you want to play. Start with existing club lists in Classic Mode,
          or draft every club’s list in Club Reset Mode.
        </p>

        {cloudAvailable && <section aria-label="Cloud save account" style={{ maxWidth: 520, marginBottom: 25, padding: 16, border: `1px solid ${lightMode ? "#cbd5e1" : "#334155"}`, borderRadius: 12, background: lightMode ? "#fff" : "#0f172a" }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 17 }}>Cloud saves</h2>
          {cloudUser ? <>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: lightMode ? "#475569" : "#cbd5e1" }}>Signed in as {cloudUser.email}. Your careers are saved to this account.</p>
            {passwordRecovery && <form onSubmit={(event) => { event.preventDefault(); onCloudAuth?.("UPDATE_PASSWORD", "", accountPassword); }} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input type="password" required minLength={6} autoComplete="new-password" aria-label="New password" placeholder="New password" value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} style={{ padding: "9px 12px", borderRadius: 8 }} />
              <button type="submit" disabled={cloudBusy} style={{ border: 0, borderRadius: 8, padding: "9px 12px", background: "#ea580c", color: "#fff", fontWeight: 700 }}>Update password</button>
            </form>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button type="button" disabled={cloudBusy} onClick={onRefreshCloudCareers} style={{ padding: "8px 12px", border: "1px solid #64748b", borderRadius: 8, background: "transparent", color: lightMode ? "#334155" : "#e2e8f0", cursor: "pointer" }}>Refresh cloud saves</button>
              {localCareersAvailable > 0 && <button type="button" disabled={cloudBusy} onClick={onImportLocalCareers} style={{ padding: "8px 12px", border: 0, borderRadius: 8, background: "#ea580c", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Add browser careers to account</button>}
              <button type="button" disabled={cloudBusy} onClick={() => onCloudAuth?.("SIGN_OUT", "", "")} style={{ padding: "8px 12px", border: "1px solid #64748b", borderRadius: 8, background: "transparent", color: lightMode ? "#334155" : "#e2e8f0", cursor: "pointer" }}>Sign out</button>
            </div>
          </> : <>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: lightMode ? "#475569" : "#cbd5e1" }}>Create an account to resume your careers on another device. You can still play without signing in.</p>
            <form onSubmit={(event) => { event.preventDefault(); onCloudAuth?.(accountAction, accountEmail, accountPassword); }} style={{ display: "grid", gap: 8 }}>
              <input type="email" required autoComplete="email" aria-label="Email address" placeholder="Email address" value={accountEmail} onChange={(event) => setAccountEmail(event.target.value)} style={{ padding: "10px 12px", borderRadius: 8 }} />
              <input type="password" required minLength={6} autoComplete={accountAction === "SIGN_UP" ? "new-password" : "current-password"} aria-label="Password" placeholder="Password" value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} style={{ padding: "10px 12px", borderRadius: 8 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" disabled={cloudBusy} style={{ padding: "9px 14px", border: 0, borderRadius: 8, background: "#ea580c", color: "#fff", fontWeight: 700, cursor: "pointer" }}>{cloudBusy ? "Please wait…" : accountAction === "SIGN_UP" ? "Create account" : "Sign in"}</button>
                <button type="button" onClick={() => setAccountAction(accountAction === "SIGN_UP" ? "SIGN_IN" : "SIGN_UP")} style={{ padding: "9px 14px", border: "1px solid #64748b", borderRadius: 8, background: "transparent", color: lightMode ? "#334155" : "#e2e8f0", cursor: "pointer" }}>{accountAction === "SIGN_UP" ? "I have an account" : "Create an account"}</button>
              </div>
              <button type="button" disabled={cloudBusy || !accountEmail} onClick={() => onCloudAuth?.("RESET_PASSWORD", accountEmail, "")} style={{ justifySelf: "start", padding: 0, border: 0, background: "transparent", color: "#fb923c", cursor: "pointer" }}>Forgot password?</button>
            </form>
          </>}
          {cloudMessage && <p role="status" style={{ margin: "10px 0 0", fontSize: 13, color: lightMode ? "#475569" : "#cbd5e1" }}>{cloudMessage}</p>}
        </section>}

        {activeSavedGame && onResume && (
          <button
            type="button"
            onClick={() => activeSavedGame.id && onResumeSave
              ? onResumeSave(activeSavedGame.id)
              : onResume()}
            style={{
              width: "100%",
              maxWidth: 520,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              margin: "-10px 0 24px",
              padding: "16px 18px",
              border: "1px solid #059669",
              borderRadius: 14,
              color: lightMode ? "#064e3b" : "#ecfdf5",
              background: lightMode ? "#ecfdf5" : "#064e3b",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <span>
              <strong style={{ display: "block", fontSize: 16 }}>Resume last save</strong>
              <span style={{ display: "block", marginTop: 4, fontSize: 13, opacity: 0.82 }}>
                {savedModeLabel(activeSavedGame.mode)} · {activeSavedGame.clubName}{activeSavedGame.seasonYear ? ` · Season ${activeSavedGame.seasonYear}` : ""} · {savedRoundLabel(activeSavedGame)}
              </span>
            </span>
            <span aria-hidden="true" style={{ fontSize: 22 }}>→</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            setManageSavedGamesOpen(true);
            setConfirmDeleteId(null);
          }}
          style={{
            display: "block",
            margin: activeSavedGame ? "-10px 0 24px" : "0 0 24px",
            padding: "9px 12px",
            border: `1px solid ${lightMode ? "#cbd5e1" : "#475569"}`,
            borderRadius: 9,
            color: lightMode ? "#334155" : "#cbd5e1",
            background: lightMode ? "#ffffff" : "#0f172a",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Manage saved games
        </button>

        <nav aria-label="Game mode sections" style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {[ ["MODES", "Game modes"], ["TROPHIES", "🏆 Trophies"] ].map(([key, label]) => <button key={key} type="button" onClick={() => setLandingTab(key)} style={{ padding: "9px 14px", border: `1px solid ${landingTab === key ? "#ea580c" : lightMode ? "#cbd5e1" : "#334155"}`, borderRadius: 9, color: landingTab === key ? "#fff" : lightMode ? "#334155" : "#e2e8f0", background: landingTab === key ? "#ea580c" : lightMode ? "#fff" : "#0f172a", fontWeight: 800, cursor: "pointer" }}>{label}</button>)}
        </nav>
        {landingTab === "TROPHIES" && <TrophyCollection trophies={trophySummary} appearance={appearance} />}
        {landingTab === "MODES" && <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
            gap: 16,
          }}
        >
          {modes.map((mode) => (
            <article
              key={mode.id}
              role={mode.available ? "button" : undefined}
              tabIndex={mode.available ? 0 : undefined}
              aria-label={mode.available ? `Start ${mode.name}` : undefined}
              onClick={mode.available ? () => onSelectMode?.(mode.id) : undefined}
              onKeyDown={mode.available ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectMode?.(mode.id);
                }
              } : undefined}
              style={{
                minHeight: 270,
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                padding: "clamp(20px, 3vw, 28px)",
                border: `1px solid ${mode.available ? "#ea580c" : (lightMode ? "#cbd5e1" : "#263449")}`,
                borderRadius: 20,
                background: lightMode
                  ? (mode.available ? "#ffffff" : "#f8fafc")
                  : (mode.available
                    ? "linear-gradient(145deg, rgba(30, 41, 59, 0.98), rgba(15, 23, 42, 0.98))"
                    : "rgba(15, 23, 42, 0.72)"),
                boxShadow: mode.available ? "0 18px 48px rgba(234, 88, 12, 0.12)" : "none",
                opacity: mode.available ? 1 : 0.78,
                cursor: mode.available ? "pointer" : "default",
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: 54,
                  height: 54,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 15,
                background: mode.available ? "#ea580c" : (lightMode ? "#e2e8f0" : "#1e293b"),
                  fontSize: 26,
                }}
              >
                <ModeIcon type={mode.icon} />
              </div>
              <div
                style={{
                  marginTop: 22,
                  color: mode.available ? "#fb923c" : "#94a3b8",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 2,
                }}
              >
                {mode.eyebrow}
              </div>
              <h2 style={{ margin: "8px 0 10px", fontSize: 24 }}>{mode.name}</h2>
              <p
                style={{
                  flex: 1,
                  margin: 0,
                  color: lightMode ? "#475569" : "#cbd5e1",
                  fontSize: 14,
                  lineHeight: 1.6,
                }}
              >
                {mode.description}
              </p>
              {mode.available ? (
                <div
                  aria-hidden="true"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    marginTop: 22,
                    padding: "13px 16px",
                    border: 0,
                    borderRadius: 11,
                    color: "white",
                    background: "#ea580c",
                    fontSize: 15,
                    fontWeight: 800,
                    textAlign: "center",
                  }}
                >
                  Start {mode.name}
                </div>
              ) : (
                <div
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    marginTop: 22,
                    padding: "12px 16px",
                    border: `1px solid ${lightMode ? "#cbd5e1" : "#334155"}`,
                    borderRadius: 11,
                    color: lightMode ? "#64748b" : "#94a3b8",
                    textAlign: "center",
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  In development
                </div>
              )}
            </article>
          ))}
        </div>}

        {manageSavedGamesOpen && (
          <div
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setManageSavedGamesOpen(false);
            }}
            style={{
              position: "fixed",
              zIndex: 100,
              inset: 0,
              display: "grid",
              placeItems: "center",
              padding: 20,
              background: "rgba(2, 6, 23, 0.72)",
              backdropFilter: "blur(5px)",
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="saved-games-title"
              style={{
                width: "min(100%, 560px)",
                maxHeight: "90vh",
                overflowY: "auto",
                boxSizing: "border-box",
                padding: 22,
                border: `1px solid ${lightMode ? "#cbd5e1" : "#334155"}`,
                borderRadius: 18,
                color: lightMode ? "#0f172a" : "#f8fafc",
                background: lightMode ? "#ffffff" : "#0f172a",
                boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                  <h2 id="saved-games-title" style={{ margin: "0 0 5px" }}>Manage saved games</h2>
                  <p style={{ margin: 0, color: lightMode ? "#64748b" : "#94a3b8", fontSize: 13 }}>{cloudUser ? "Saved careers are linked to your account." : "Saved careers are stored in this browser."}</p>
                </div>
                <button type="button" aria-label="Close saved games" onClick={() => setManageSavedGamesOpen(false)} style={{ border: 0, borderRadius: 8, padding: "6px 10px", color: lightMode ? "#334155" : "#cbd5e1", background: lightMode ? "#f1f5f9" : "#1e293b", cursor: "pointer", fontSize: 18 }}>×</button>
              </div>

              {availableSavedGames.length > 0 ? (
                <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
                  {availableSavedGames.map((game, index) => (
                    <article key={game.id ?? `${game.clubName}-${index}`} style={{ padding: 16, border: `1px solid ${lightMode ? "#cbd5e1" : "#334155"}`, borderRadius: 12, background: lightMode ? "#f8fafc" : "#111c30" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                        <div style={{ color: "#fb923c", fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>SAVE SLOT {index + 1}</div>
                        {game.savedAt === activeSavedGame?.savedAt && <span style={{ color: lightMode ? "#64748b" : "#94a3b8", fontSize: 11 }}>Most recent</span>}
                      </div>
                      <h3 style={{ margin: "7px 0 5px" }}>{savedModeLabel(game.mode)} · {game.clubName}</h3>
                      <div style={{ color: lightMode ? "#475569" : "#cbd5e1", fontSize: 13 }}>{game.seasonYear ? `Season ${game.seasonYear} · ` : ""}{savedRoundLabel(game)}</div>
                      <div style={{ color: lightMode ? "#64748b" : "#94a3b8", fontSize: 12, marginTop: 5 }}>{savedDateLabel(game)}</div>

                      {confirmDeleteId === game.id ? (
                        <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: lightMode ? "#fef2f2" : "#450a0a" }}>
                          <div style={{ fontSize: 13, lineHeight: 1.45 }}>Delete this saved career {cloudUser ? "from your account" : "from this browser"}? This cannot be undone.</div>
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
                            <button type="button" onClick={() => setConfirmDeleteId(null)} style={{ padding: "8px 11px", border: `1px solid ${lightMode ? "#cbd5e1" : "#475569"}`, borderRadius: 8, color: lightMode ? "#334155" : "#e2e8f0", background: "transparent", cursor: "pointer" }}>Cancel</button>
                            <button type="button" onClick={() => deleteCurrentSavedGame(game.id)} style={{ padding: "8px 11px", border: 0, borderRadius: 8, color: "#fff", background: "#dc2626", fontWeight: 800, cursor: "pointer" }}>Delete saved game</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                          <button type="button" onClick={() => game.id && onResumeSave ? onResumeSave(game.id) : onResume?.()} style={{ padding: "8px 11px", border: 0, borderRadius: 8, color: "#fff", background: "#059669", fontWeight: 700, cursor: "pointer" }}>Resume this save</button>
                          <button type="button" onClick={() => setConfirmDeleteId(game.id)} style={{ padding: "8px 11px", border: "1px solid #dc2626", borderRadius: 8, color: lightMode ? "#b91c1c" : "#fca5a5", background: "transparent", fontWeight: 700, cursor: "pointer" }}>Delete</button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div style={{ marginTop: 18, padding: 16, border: `1px dashed ${lightMode ? "#cbd5e1" : "#475569"}`, borderRadius: 12, color: lightMode ? "#64748b" : "#94a3b8", textAlign: "center" }}>
                  {cloudUser ? "No cloud careers in this account." : "No saved games in this browser."}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                <button type="button" onClick={() => setManageSavedGamesOpen(false)} style={{ padding: "9px 14px", border: 0, borderRadius: 9, color: "#fff", background: "#ea580c", fontWeight: 800, cursor: "pointer" }}>Done</button>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

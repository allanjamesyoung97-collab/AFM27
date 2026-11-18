import { rulesForDate } from "../engine/seasonRules.js";
import { dayKey } from "../engine/simulationClock.js";
import { useEffect, useState } from "react";

import TradeLab from "./TradeLab.jsx";
import DraftScreen from "./DraftScreen.jsx";
import ScoutingScreen from "./ScoutingScreen.jsx";
import AcademyScreen from "./AcademyScreen.jsx";
import { resolveAppearance } from "./appearance.js";

export default function RecruitmentScreen({ appearance, playerDevelopment, playerContracts, seasonYear, currentDate, facilityBonuses = {}, userClub, onTradeComplete, onShopTradeComplete, onTradeGeniusComplete, onRespondToAITradeOffer, onTradeOutcome, aiTradeOfferResponses, seasonState, players, onOpenClub, onAcademyAction, onDraftPick, onDraftBid, onResolveDraftBid, onDraftPass, onAdvanceDraftAI, onDraftPickTrade, onScout, onToggleShortlist, navigationTab = null, navigationSequence = 0 }) {
  const [activeTab, setActiveTab] =
    useState("TRADE");
  const [focusedTarget, setFocusedTarget] = useState({ id: null, sequence: 0 });
  const viewInRecruitment = (id, tab) => {
    setFocusedTarget(previous => ({ id: String(id), sequence: previous.sequence + 1 }));
    setActiveTab(tab);
  };
  useEffect(() => { if (navigationTab) setActiveTab(navigationTab); }, [navigationSequence, navigationTab]);

  useEffect(() => {
    const date = currentDate instanceof Date ? currentDate : currentDate ? new Date(currentDate) : null;
    const draftNight = date && !Number.isNaN(date.getTime()) && date.getMonth() === 10 && date.getDate() >= 25;
    const rules = date ? rulesForDate(seasonState ?? {}, date) : null;
    const kind = seasonState?.draftState?.kind;
    const scheduled = kind === "MID_SEASON" ? rules?.midSeasonDraft : kind === "ROOKIE" ? rules?.rookieDraft : rules?.nationalDraft;
    if (date && scheduled && dayKey(date) >= scheduled && !seasonState?.draftState?.completed) {
      setActiveTab("DRAFT");
    }
  }, [currentDate, seasonState?.phase, seasonState?.draftState?.completed]);

  const lightMode = resolveAppearance(appearance) === "light";
  const theme = lightMode
    ? { text: "#172033", surface: "#eef2f8" }
    : { text: "#f8fafc", surface: "#1e293b" };
  const tabStyle = (tab) => ({
    padding: "10px 14px",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    background:
      activeTab === tab
        ? "#ea580c"
        : theme.surface,
    color: activeTab === tab ? "white" : theme.text,
    fontWeight: "bold",
  });

  return (
    <div style={{ width: "100%", maxWidth: 1240, margin: "0 auto", boxSizing: "border-box" }}>
      <div
        style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          marginBottom: "20px"
        }}
      >
        <button
          style={tabStyle("TRADE")}
          onClick={() =>
            setActiveTab("TRADE")
          }
        >
          TRADE LAB
        </button>

        <button
          style={tabStyle("DRAFT")}
          onClick={() =>
            setActiveTab("DRAFT")
          }
        >
          DRAFT BOARD
        </button>
        <button style={tabStyle("SCOUTING")} onClick={() => setActiveTab("SCOUTING")}>SCOUTING</button>
        <button style={tabStyle("ACADEMY")} onClick={() => setActiveTab("ACADEMY")}>ACADEMY</button>
      </div>

      <div aria-hidden={activeTab !== "TRADE"} style={{ display: activeTab === "TRADE" ? "block" : "none" }}>
        <TradeLab appearance={appearance} players={players} playerDevelopment={playerDevelopment} playerContracts={playerContracts} seasonYear={seasonYear} currentDate={currentDate} userClub={userClub} seasonState={seasonState} onTradeComplete={onTradeComplete} onShopTradeComplete={onShopTradeComplete} onTradeGeniusComplete={onTradeGeniusComplete} onRespondToAITradeOffer={onRespondToAITradeOffer} onTradeOutcome={onTradeOutcome} aiTradeOfferResponses={aiTradeOfferResponses} onOpenClub={onOpenClub} focusPlayerId={focusedTarget.id} focusSequence={focusedTarget.sequence} onViewDraftProspect={id => viewInRecruitment(id, "DRAFT")} />
      </div>

      <div aria-hidden={activeTab !== "DRAFT"} style={{ display: activeTab === "DRAFT" ? "block" : "none" }}>
        <DraftScreen
          scoutingAccuracy={facilityBonuses.scoutingAccuracy}
          seasonState={seasonState}
          currentDate={currentDate}
          userClub={userClub}
          players={players}
          onDraftPick={onDraftPick}
          onDraftBid={onDraftBid}
          onResolveDraftBid={onResolveDraftBid}
          onDraftPass={onDraftPass}
          onAdvanceAI={onAdvanceDraftAI}
          onTradePicks={onDraftPickTrade}
          focusPlayerId={focusedTarget.id}
          focusSequence={focusedTarget.sequence}
        />
      </div>
      {activeTab === "ACADEMY" && <AcademyScreen academy={seasonState?.academies?.[userClub?.name ?? seasonState?.managerClubName] ?? null} seasonState={seasonState} userClub={userClub} appearance={appearance} onAcademyAction={onAcademyAction} />}
      {activeTab === "SCOUTING" && <ScoutingScreen players={players} playerDevelopment={playerDevelopment} seasonState={seasonState} userClub={userClub} onScout={onScout} onToggleShortlist={onToggleShortlist} onViewInRecruitment={viewInRecruitment} scoutingAccuracy={facilityBonuses.scoutingAccuracy} />}
    </div>
  );
}

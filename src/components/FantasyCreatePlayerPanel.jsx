import { useState } from "react";
import FantasyPlayerFields, { fantasyButtonStyle } from "./FantasyPlayerFields.jsx";
import { createFantasyPlayer } from "../engine/fantasyToolsEngine.js";
import { ATTRIBUTE_GROUPS } from "../data/footballData.js";

const blankPlayer = { name: "", age: 24, heightCm: 185, positions: ["MID"], overall: 70, potential: 80, attributes: Object.fromEntries(Object.values(ATTRIBUTE_GROUPS).flat().map((key) => [key, 70])), activeTraits: [], salary: 500000, yearsRemaining: 2 };

export default function FantasyCreatePlayerPanel({ clubs, onSeasonStateChange, lightMode }) {
  const [values, setValues] = useState({ ...blankPlayer, club: clubs[0]?.name ?? "" });
  const [message, setMessage] = useState({ type: "", text: "" });

  const submit = (event) => {
    event.preventDefault();
    const result = createFantasyPlayer(values);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    onSeasonStateChange((previous) => ({
      ...previous,
      generatedPlayers: [...(previous.generatedPlayers ?? []), result.player],
      playerContracts: { ...(previous.playerContracts ?? {}), [result.player.id]: result.contract },
    }));
    setValues({ ...blankPlayer, club: values.club });
    setMessage({ type: "success", text: `${result.player.name} has joined ${values.club}.` });
  };

  return (
    <section aria-label="Create player" style={{ maxWidth: 760 }}>
      <h2 style={{ margin: "0 0 14px", fontSize: 20 }}>Create a player</h2>
      <form onSubmit={submit} style={{ display: "grid", gap: 18 }}>
        <FantasyPlayerFields values={values} onChange={setValues} lightMode={lightMode} clubs={clubs} showContract />
        {message.text && (
          <p role="status" style={{ margin: 0, color: message.type === "error" ? "#f87171" : "#4ade80", fontWeight: 700 }}>{message.text}</p>
        )}
        <div>
          <button type="submit" style={fantasyButtonStyle}>Add player</button>
        </div>
      </form>
    </section>
  );
}

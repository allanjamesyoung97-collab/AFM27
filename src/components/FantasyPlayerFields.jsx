import { FANTASY_ATTRIBUTE_GROUPS, FANTASY_POSITIONS } from "../engine/fantasyToolsEngine.js";
import { getEligiblePlayerTraits, TRAIT_DEFINITIONS } from "../data/footballData.js";
import { calculateOverall } from "../engine/playerRatingGenerator.js";

export const fantasyButtonStyle = {
  padding: "10px 16px",
  border: 0,
  borderRadius: 9,
  color: "#fff",
  background: "#ea580c",
  fontWeight: 800,
  cursor: "pointer",
};

export default function FantasyPlayerFields({ values, onChange, lightMode, clubs, showContract = false }) {
  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${lightMode ? "#cbd5e1" : "#475569"}`,
    background: lightMode ? "#ffffff" : "#0f172a",
    color: lightMode ? "#0f172a" : "#f8fafc",
  };
  const labelStyle = { display: "grid", gap: 6, fontSize: 13, fontWeight: 700 };
  const setField = (key) => (event) => onChange({ ...values, [key]: event.target.value });
  const setAttribute = (key) => (event) => {
    const attributes = { ...(values.attributes ?? {}), [key]: Number(event.target.value) };
    onChange({ ...values, attributes, overall: calculateOverall(attributes, values.positions?.[0] ?? "MID") });
  };
  const attributes = Object.fromEntries(Object.values(FANTASY_ATTRIBUTE_GROUPS).flat().map((key) => [key, Number(values.attributes?.[key] ?? 70)]));
  const eligibleTraits = getEligiblePlayerTraits({ positions: values.positions ?? [], attributes, heightCm: Number(values.heightCm ?? 185) })
    .filter((trait) => !trait.automatic);
  const selectedTraits = values.activeTraits ?? [];
  const toggleTrait = (id) => {
    const trait = TRAIT_DEFINITIONS[id];
    if (!trait) return;
    const existing = selectedTraits.filter((selected) => selected !== id);
    if (selectedTraits.includes(id)) {
      onChange({ ...values, activeTraits: existing });
      return;
    }
    const sameKind = existing.filter((selected) => (TRAIT_DEFINITIONS[selected]?.category === "drawback") === (trait.category === "drawback"));
    const otherKind = existing.filter((selected) => (TRAIT_DEFINITIONS[selected]?.category === "drawback") !== (trait.category === "drawback"));
    const retainedSameKind = trait.category === "drawback" ? [] : sameKind.slice(0, 2);
    onChange({ ...values, activeTraits: [...otherKind, ...retainedSameKind, id] });
  };
  const togglePosition = (position) => {
    const current = values.positions ?? [];
    const positions = current.includes(position) ? current.filter((item) => item !== position) : [...current, position];
    const attributes = Object.fromEntries(Object.values(FANTASY_ATTRIBUTE_GROUPS).flat().map((key) => [key, Number(values.attributes?.[key] ?? 70)]));
    onChange({
      ...values,
      positions,
      overall: calculateOverall(attributes, positions[0] ?? "MID"),
    });
  };

  return (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))" }}>
      <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
        Name
        <input style={inputStyle} value={values.name} onChange={setField("name")} placeholder="Full name" />
      </label>
      {clubs && (
        <label style={labelStyle}>
          Club
          <select style={inputStyle} value={values.club} onChange={setField("club")}>
            {clubs.map((club) => <option key={club.id ?? club.name} value={club.name}>{club.name}</option>)}
          </select>
        </label>
      )}
      <label style={labelStyle}>
        Age
        <input style={inputStyle} type="number" min={17} max={45} value={values.age} onChange={setField("age")} />
      </label>
      <label style={labelStyle}>
        Height (cm)
        <input style={inputStyle} type="number" min={150} max={220} value={values.heightCm ?? 185} onChange={setField("heightCm")} />
      </label>
      <label style={labelStyle}>
        Overall (calculated from attributes)
        <input style={{ ...inputStyle, opacity: 0.8 }} type="number" min={40} max={99} value={values.overall ?? 70} readOnly />
      </label>
      <label style={labelStyle}>
        Potential
        <input style={inputStyle} type="number" min={40} max={99} value={values.potential} onChange={setField("potential")} />
      </label>
      {showContract && (
        <>
          <label style={labelStyle}>
            Salary
            <input style={inputStyle} type="number" min={0} max={10000000} step={10000} value={values.salary} onChange={setField("salary")} />
          </label>
          <label style={labelStyle}>
            Contract years
            <input style={inputStyle} type="number" min={1} max={5} value={values.yearsRemaining} onChange={setField("yearsRemaining")} />
          </label>
        </>
      )}
      <fieldset style={{ gridColumn: "1 / -1", border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Positions</legend>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {FANTASY_POSITIONS.map((position) => {
            const selected = (values.positions ?? []).includes(position);
            return (
              <button
                key={position}
                type="button"
                aria-pressed={selected}
                onClick={() => togglePosition(position)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: `1px solid ${selected ? "#ea580c" : lightMode ? "#cbd5e1" : "#475569"}`,
                  color: selected ? "#fff" : lightMode ? "#334155" : "#e2e8f0",
                  background: selected ? "#ea580c" : "transparent",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {position}
              </button>
            );
          })}
        </div>
      </fieldset>
      <section style={{ gridColumn: "1 / -1", display: "grid", gap: 8 }} aria-label="Player attributes">
        <div><strong>Attributes</strong><div style={{ color: lightMode ? "#64748b" : "#94a3b8", fontSize: 12 }}>Set each skill from 1 to 99. Overall updates from the selected position and attributes.</div></div>
        {Object.entries(FANTASY_ATTRIBUTE_GROUPS).map(([group, keys]) => (
          <details key={group} style={{ border: `1px solid ${lightMode ? "#cbd5e1" : "#334155"}`, borderRadius: 9, padding: 10 }}>
            <summary style={{ cursor: "pointer", textTransform: "capitalize", fontWeight: 800 }}>{group === "footballIQ" ? "Football IQ" : group} · avg {Math.round(keys.reduce((sum, key) => sum + attributes[key], 0) / keys.length)}</summary>
            <div style={{ display: "grid", gap: 7, marginTop: 10 }}>
              {keys.map((key) => (
                <label key={key} style={{ display: "grid", gridTemplateColumns: "minmax(120px, 1fr) minmax(110px, 2fr) 58px", gap: 10, alignItems: "center", fontSize: 12 }}>
                  <span>{key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())}</span>
                  <input type="range" min={1} max={99} value={attributes[key]} onChange={setAttribute(key)} aria-label={`${key} attribute`} />
                  <input style={{ ...inputStyle, padding: "6px 7px" }} type="number" min={1} max={99} value={attributes[key]} onChange={setAttribute(key)} aria-label={`${key} value`} />
                </label>
              ))}
            </div>
          </details>
        ))}
      </section>
      <fieldset style={{ gridColumn: "1 / -1", border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>Traits <span style={{ color: lightMode ? "#64748b" : "#94a3b8", fontWeight: 500 }}>(up to 3 strengths and 1 drawback)</span></legend>
        <p style={{ margin: "0 0 8px", color: lightMode ? "#64748b" : "#94a3b8", fontSize: 12 }}>Trait eligibility follows the player's positions, height and attributes. Adjust those above to unlock more traits.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))", gap: 7 }}>
          {eligibleTraits.map((trait) => {
            const checked = selectedTraits.includes(trait.id);
            return <label key={trait.id} style={{ display: "grid", gridTemplateColumns: "auto 1fr", alignItems: "start", gap: 8, padding: 9, border: `1px solid ${checked ? "#ea580c" : lightMode ? "#cbd5e1" : "#334155"}`, borderRadius: 8, background: checked ? (lightMode ? "#fff7ed" : "#431407") : "transparent", cursor: "pointer" }}>
              <input type="checkbox" checked={checked} onChange={() => toggleTrait(trait.id)} />
              <span><strong>{trait.label}{trait.category === "drawback" ? " · Drawback" : ""}</strong><small style={{ display: "block", marginTop: 3, color: lightMode ? "#64748b" : "#94a3b8", lineHeight: 1.4 }}>{trait.description}</small></span>
            </label>;
          })}
          {!eligibleTraits.length && <span style={{ color: lightMode ? "#64748b" : "#94a3b8", fontSize: 13 }}>No traits currently meet the player's profile. Adjust positions, height or attributes to unlock eligible traits.</span>}
        </div>
      </fieldset>
    </div>
  );
}

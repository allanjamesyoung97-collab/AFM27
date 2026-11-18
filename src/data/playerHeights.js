import sourcePlayerHeights from "./playerHeights.json" with { type: "json" };

// A few profile names in the game use common shortened forms while the
// reference list uses the player's full name.
const profileNameAliases = {
  "Alix Tauru": "Alixzander Tauru",
  "Bailey Williams": "Bailey J. Williams",
  "Callum Brown": "Callum M Brown",
  "Cam Mackenzie": "Cameron Mackenzie",
  "Cam Rayner": "Cameron Rayner",
  "Cameron Nairn": "Cam Nairn",
  "Christopher Scerri": "Chris Scerri",
  "Daniel Annable": "Dan Annable",
  "Daniel Curtin": "Dan Curtin",
  "Finnegan Davis": "Finn Davis",
  "Harry Himmelberg": "Harrison Himmelberg",
  "Lachie Jones": "Lachlan Jones",
  "Lachlan Blakiston": "Lachie Blakiston",
  "Lachie Schultz": "Lachlan Schultz",
  "Lachlan Carmichael": "Lachy Carmichael",
  "Leonardo Lombard": "Leo Lombard",
  "Matt Flynn": "Matthew Flynn",
  "Matthew LeRay": "Matt LeRay",
  "Matt Roberts": "Matthew Roberts",
  "Matt Rowell": "Matthew Rowell",
  "Mitch Lewis": "Mitchell Lewis",
  "Nicholas Driscoll": "Nick Driscoll",
  "Nicholas Madden": "Nick Madden",
  "Nik Cox": "Nikolas Cox",
  "Oliver Griffin": "Ollie Griffin",
  "Tom Cole": "Thomas Cole",
  "Tom Lynch": "Tom J. Lynch",
  "Tom Sims": "Thomas Sims",
  "William Edwards": "Will Edwards",
  "William Green": "Will Green",
  "William McCabe": "Will McCabe",
};

function normalizePlayerName(name) {
  return String(name ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const normalizedHeights = new Map(
  Object.entries(sourcePlayerHeights).map(([name, height]) => [normalizePlayerName(name), height]),
);

export function getPlayerHeightCm(playerOrName) {
  const directHeight = playerOrName?.heightCm;
  if (directHeight !== null && directHeight !== undefined && directHeight !== "") {
    const parsedHeight = Number(directHeight);
    if (Number.isFinite(parsedHeight) && parsedHeight > 0) return parsedHeight;
  }

  const name = typeof playerOrName === "string" ? playerOrName : playerOrName?.name;
  if (!name) return null;

  const referenceName = profileNameAliases[name] ?? name;
  return normalizedHeights.get(normalizePlayerName(referenceName)) ?? null;
}

export const playerHeightSource = "Zero Hanger";

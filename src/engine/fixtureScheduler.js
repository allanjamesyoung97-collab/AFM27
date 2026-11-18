export const parseFixtureDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12));
};

const formatFixtureDate = (date) => date.toLocaleDateString("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function scheduleFixtureAcrossWeekend(fixture) {
  const lastPlayed = new Map();
  const accumulatedFatigue = new Map();
  const dayCountsByTeam = new Map();
  const weekendGameCounts = [1, 2, 4, 2]; // Thursday through Sunday for a nine-game round
  const defaultStart = new Date(Date.UTC(2027, 2, 18, 12)); // Thursday, 18 March 2027

  return fixture.map((roundData, roundIndex) => {
    const existingStart = parseFixtureDate(roundData.matches?.[0]?.date);
    const roundStart = existingStart ?? new Date(defaultStart.getTime() + roundIndex * 7 * 86400000);
    const daysSinceThursday = (roundStart.getUTCDay() - 4 + 7) % 7;
    roundStart.setUTCDate(roundStart.getUTCDate() - daysSinceThursday);

    const remainingMatches = [...roundData.matches];
    const scheduledMatches = [];
    const getDayCount = (team, dayOffset) => dayCountsByTeam.get(team)?.[dayOffset] ?? 0;
    const recordDayCount = (team, dayOffset) => {
      const counts = dayCountsByTeam.get(team) ?? [0, 0, 0, 0];
      counts[dayOffset] += 1;
      dayCountsByTeam.set(team, counts);
    };

    weekendGameCounts.forEach((slotCount, dayOffset) => {
      const slotsForDay = roundData.matches.length === 9
        ? slotCount
        : Math.floor((dayOffset + 1) * roundData.matches.length / 4) - Math.floor(dayOffset * roundData.matches.length / 4);

      for (let slot = 0; slot < slotsForDay && remainingMatches.length > 0; slot += 1) {
        const rotation = (roundIndex * 7 + dayOffset * 3 + slot * 5) % remainingMatches.length;
        let bestIndex = 0;
        let bestScore = Infinity;
        let bestRotationDistance = Infinity;

        remainingMatches.forEach((candidate, index) => {
          const home = candidate.homeTeam ?? candidate.home;
          const away = candidate.awayTeam ?? candidate.away;
          const score = getDayCount(home, dayOffset) + getDayCount(away, dayOffset);
          const rotationDistance = (index - rotation + remainingMatches.length) % remainingMatches.length;
          if (score < bestScore || (score === bestScore && rotationDistance < bestRotationDistance)) {
            bestIndex = index;
            bestScore = score;
            bestRotationDistance = rotationDistance;
          }
        });

        const match = remainingMatches.splice(bestIndex, 1)[0];
        const home = match.homeTeam ?? match.home;
        const away = match.awayTeam ?? match.away;
        recordDayCount(home, dayOffset);
        recordDayCount(away, dayOffset);
        scheduledMatches.push({ match, dayOffset });
      }
    });

    // Retain any extra matches on the final Sunday if the round has an unusual size.
    remainingMatches.forEach((match) => scheduledMatches.push({ match, dayOffset: 3 }));

    const matches = scheduledMatches.map(({ match, dayOffset }) => {
      const matchDate = new Date(roundStart.getTime() + dayOffset * 86400000);
      const homeTeam = match.homeTeam ?? match.home;
      const awayTeam = match.awayTeam ?? match.away;
      const daysRest = (team) => {
        const lastDate = lastPlayed.get(team);
        return lastDate ? Math.round((matchDate.getTime() - lastDate.getTime()) / 86400000) : 9;
      };
      const homeRestDays = daysRest(homeTeam);
      const awayRestDays = daysRest(awayTeam);
      const preMatchFatigue = (team, days) => Math.max(0, (accumulatedFatigue.get(team) ?? 0) - days * 0.5);
      const homePreMatchFatigue = preMatchFatigue(homeTeam, homeRestDays);
      const awayPreMatchFatigue = preMatchFatigue(awayTeam, awayRestDays);
      const homeFatiguePenalty = Math.max(0, 7 - homeRestDays) * 2 + homePreMatchFatigue;
      const awayFatiguePenalty = Math.max(0, 7 - awayRestDays) * 2 + awayPreMatchFatigue;

      lastPlayed.set(homeTeam, matchDate);
      lastPlayed.set(awayTeam, matchDate);
      accumulatedFatigue.set(homeTeam, homePreMatchFatigue + 3);
      accumulatedFatigue.set(awayTeam, awayPreMatchFatigue + 3);

      return {
        ...match,
        date: formatFixtureDate(matchDate),
        homeRestDays,
        awayRestDays,
        homeFatiguePenalty,
        awayFatiguePenalty,
      };
    });

    return { ...roundData, matches };
  });
}


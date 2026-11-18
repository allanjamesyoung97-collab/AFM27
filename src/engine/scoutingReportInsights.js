const midpoint = row => (Number(row.low) + Number(row.high)) / 2;

export function getScoutingReportInsights(dossier, report, squad = []) {
  const peers = (dossier?.peers ?? []).map(row => ({ row,
    player: squad.find(candidate => String(candidate.id) === String(row.playerId)) })).filter(item => item.player?.attributes);
  const comparison = (dossier?.groups ?? []).flatMap(group => (group.attributes ?? []).flatMap(attribute =>
    peers.map(({ row, player }) => ({ attribute, peer: row, rating: Number(player.attributes[attribute.key]),
      gap: midpoint(attribute) - Number(player.attributes[attribute.key]) }))))
    .filter(item => Number.isFinite(item.rating));
  const bestByAttribute = [...comparison].sort((a, b) => b.gap - a.gap)
    .filter((item, index, rows) => rows.findIndex(row => row.attribute.key === item.attribute.key) === index);
  const pros = bestByAttribute.filter(item => item.attribute.low > item.rating).slice(0, 2).map(item => ({
    title: `${item.attribute.name} upgrade`,
    detail: `Scouted range ${item.attribute.low}–${item.attribute.high} sits above ${item.peer.name}'s ${item.rating}.`,
  }));
  if (pros.length < 2) for (const item of bestByAttribute.filter(row => row.gap >= 4 && !pros.some(pro => pro.title === `${row.attribute.name} upgrade`))) {
    pros.push({ title: `${item.attribute.name} upside`, detail: `Estimated ${item.attribute.low}–${item.attribute.high} versus ${item.peer.name}'s ${item.rating}; ranges overlap, so the edge is uncertain.` });
    if (pros.length === 2) break;
  }
  const style = [...(report?.fit?.styles ?? [])].sort((a, b) => Number(b.change) - Number(a.change))[0];
  if (pros.length < 2 && Number(style?.change) > 0) pros.push({ title: `${style.name} fit`, detail: `The scout projects a ${style.change} point improvement to this tactical style.` });
  if (pros.length < 2 && Number(dossier?.potentialRange?.low) > Number(report?.estimatedOverall ?? 0) + 2) pros.push({ title: 'Development runway', detail: `Estimated ceiling ${dossier.potentialRange.low}–${dossier.potentialRange.high} OVR leaves room to grow.` });
  while (pros.length < 2) pros.push({ title: pros.length ? 'Role coverage' : 'Recruitment option', detail: 'Adds another player in the scouted position group; no clear attribute upgrade is established yet.' });

  const deficit = [...comparison].sort((a, b) => a.gap - b.gap)[0];
  const weakStyle = [...(report?.fit?.styles ?? [])].sort((a, b) => Number(a.change) - Number(b.change))[0];
  const con = deficit && deficit.attribute.high < deficit.rating
    ? { title: `${deficit.attribute.name} gap`, detail: `Even the upper scout estimate (${deficit.attribute.high}) is below ${deficit.peer.name}'s ${deficit.rating}.` }
    : Number(weakStyle?.change) < 0
      ? { title: `${weakStyle.name} trade-off`, detail: `The scout projects a ${Math.abs(weakStyle.change)} point reduction in this tactical style.` }
      : { title: 'No clear downside established', detail: 'The current estimates do not show a reliable disadvantage. Further scouting may reveal one.' };
  return { pros: pros.slice(0, 2), con };
}

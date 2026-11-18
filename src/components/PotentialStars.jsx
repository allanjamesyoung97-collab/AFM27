import { useId } from "react";
import { getPotentialStarRating } from "../engine/potentialScouting.js";

export default function PotentialStars({ potential, player, color = "#fbbf24", size = "1em" }) {
  const halfStarId = `potential-half-${useId().replaceAll(":", "")}`;
  const value = player
    ? player?.development?.potential ?? player?.potential
    : potential;
  const rating = getPotentialStarRating(value);
  if (rating == null) return <span aria-label="Potential unknown">—</span>;

  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 !== 0;
  const starPath = "M50 4 61 37 96 37 68 58 79 92 50 72 21 92 32 58 4 37 39 37Z";
  const starStyle = { display: "inline-flex", alignItems: "center", gap: "0.04em", fontSize: size, lineHeight: 1, whiteSpace: "nowrap" };

  return (
    <span role="img" aria-label={`${rating} out of 5 potential stars`} style={starStyle}>
      {Array.from({ length: fullStars }, (_, index) => (
        <svg key={index} viewBox="0 0 100 100" width="1em" height="1em" aria-hidden="true" style={{ display: "block", fill: color }}>
          <path d={starPath} />
        </svg>
      ))}
      {hasHalfStar && (
        <svg viewBox="0 0 100 100" width="1em" height="1em" aria-hidden="true" style={{ display: "block" }}>
          <defs>
            <linearGradient id={halfStarId} x1="0" x2="1" y1="0" y2="0">
              <stop offset="50%" stopColor={color} />
              <stop offset="50%" stopColor="#475569" />
            </linearGradient>
          </defs>
          <path d={starPath} fill={`url(#${halfStarId})`} />
        </svg>
      )}
    </span>
  );
}

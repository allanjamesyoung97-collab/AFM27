// Several screens (Club Administration, Draft, Scouting, Job Market) are designed
// as dark cards with pale text. In light mode they would otherwise sit directly on
// the light page background and become unreadable, so in light mode they get a
// dark panel behind them. The wrapper element is always rendered (and simply
// becomes layout-neutral when disabled) so toggling the theme never remounts the
// screen or loses its local state.
export default function DarkSurface({ enabled = true, children, style }) {
  return (
    <div
      className="dark-surface"
      style={enabled
        ? {
            background: "#020617",
            color: "#f8fafc",
            colorScheme: "dark",
            border: "1px solid #1e293b",
            borderRadius: 16,
            padding: "clamp(14px, 2vw, 24px)",
            boxSizing: "border-box",
            ...style,
          }
        : { display: "contents" }}
    >
      {children}
    </div>
  );
}

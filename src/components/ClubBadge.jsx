// ClubBadge: circular badge showing each club's guernsey design.
// Drawn as SVG on a 100x100 grid and clipped to a circle, so the props
// (club, size) and the outer look (white ring + shadow) are unchanged.

const vStripes = (colors) =>
 colors.map((fill, i) => (
 <rect
 key={i}
 x={(100 / colors.length) * i}
 y="0"
 width={100 / colors.length + 0.5}
 height="100"
 fill={fill}
 />
 ));

const hStripes = (colors) =>
 colors.map((fill, i) => (
 <rect
 key={i}
 x="0"
 y={(100 / colors.length) * i}
 width="100"
 height={100 / colors.length + 0.5}
 fill={fill}
 />
 ));

const Rect = ({ x = 0, y = 0, w = 100, h = 100, fill }) => (
 <rect x={x} y={y} width={w} height={h} fill={fill} />
);

const designs = {
 // Navy with red / gold hoops
 Adelaide: () => {
 const navy = "#0B1F4B";
 const red = "#E21937";
 const gold = "#FFD200";
 return (
 <>
 <Rect fill={navy} />
 <Rect y={16} h={10} fill={gold} />
 <Rect y={26} h={12} fill={red} />
 <Rect y={38} h={10} fill={navy} />
 <Rect y={48} h={12} fill={gold} />
 <Rect y={60} h={10} fill={navy} />
 <Rect y={70} h={12} fill={red} />
 <Rect y={82} h={8} fill={navy} />
 <Rect y={90} h={10} fill={gold} />
 </>
 );
 },

 // Equal blue, gold and maroon bands, without a crest
 Brisbane: () => (
 <>
 <Rect fill="#7A0C2E" />
 <Rect h={33.34} fill="#0039A6" />
 <Rect y={33.33} h={33.34} fill="#F2B705" />
 </>
 ),

 // Navy with white CFC monogram
 Carlton: () => (
 <>
 <Rect fill="#0A1F3D" />
 {/* Outer C */}
 <path d="M72 30 A28 28 0 1 0 74 72" fill="none" stroke="#FFFFFF" strokeWidth="9" />
 {/* Inner C */}
 <path d="M62 38 A15 15 0 1 0 62 62" fill="none" stroke="#FFFFFF" strokeWidth="6" />
 {/* Central stem with top and bottom caps */}
 <rect x="46" y="14" width="9" height="74" fill="#FFFFFF" />
 <rect x="40" y="12" width="21" height="5" fill="#FFFFFF" />
 <rect x="41" y="21" width="19" height="5" fill="#FFFFFF" />
 <rect x="39" y="85" width="23" height="5" fill="#FFFFFF" />
 {/* Right-hand arms */}
 <rect x="55" y="39" width="14" height="4" fill="#FFFFFF" />
 <rect x="55" y="48" width="11" height="4" fill="#FFFFFF" />
 <rect x="55" y="57" width="14" height="4" fill="#FFFFFF" />
 </>
 ),

 // Black and white vertical stripes
 Collingwood: () => <>{vStripes(["#111111", "#FFFFFF", "#111111", "#FFFFFF", "#111111"])}</>,

 // Black with red sash, right shoulder to left hem
 Essendon: () => (
 <>
 <Rect fill="#0D0D0D" />
 <polygon points="56,0 84,0 44,100 16,100" fill="#D50032" />
 </>
 ),

 // Purple with white chevrons
 Fremantle: () => (
 <>
 <Rect fill="#2A0D54" />
 <polyline points="14,24 50,54 86,24" fill="none" stroke="#FFFFFF" strokeWidth="9" strokeLinejoin="miter" />
 <polyline points="14,46 50,76 86,46" fill="none" stroke="#FFFFFF" strokeWidth="9" strokeLinejoin="miter" />
 </>
 ),

 // Deep green with red trim, yellow Tasmania map and a red T
 Tasmania: () => (
 <>
 <Rect fill="#1D5C3A" />
 <Rect h={9} fill="#E3313B" />
 <polygon
 points="20,30 33,25 46,29 58,27 71,33 82,29 88,38 83,48 85,57 77,63 70,73 60,79 52,88 44,81 37,71 27,67 21,57 26,46 18,38"
 fill="#F6D55C"
 />
 <rect x="40" y="41" width="25" height="8" fill="#E3313B" />
 <rect x="48.5" y="41" width="8" height="27" fill="#E3313B" />
 </>
 ),

 // Navy and white hoops
 Geelong: () => (
 <>
 {hStripes([
 "#0B1F4B",
 "#FFFFFF",
 "#0B1F4B",
 "#FFFFFF",
 "#0B1F4B",
 "#FFFFFF",
 "#0B1F4B",
 "#FFFFFF",
 ])}
 </>
 ),

 // Red body, gold side panels, GC monogram
 "Gold Coast": () => (
 <>
 <Rect fill="#D4202C" />
 <Rect w={15} fill="#F5B800" />
 <Rect x={85} w={15} fill="#F5B800" />
 <text
 x="50"
 y="60"
 textAnchor="middle"
 fontFamily="Arial, Helvetica, sans-serif"
 fontWeight="900"
 fontSize="30"
 fill="#F5B800"
 >
 GC
 </text>
 </>
 ),

 // Orange top, charcoal lower, white G
 GWS: () => (
 <>
 <Rect fill="#F47920" />
 <path d="M0 62 C28 48 58 48 100 30 L100 100 L0 100 Z" fill="#3A3A3A" />
 <text
 x="38"
 y="82"
 textAnchor="middle"
 fontFamily="Arial, Helvetica, sans-serif"
 fontWeight="900"
 fontSize="42"
 fill="#FFFFFF"
 >
 G
 </text>
 </>
 ),

 // Brown and gold vertical stripes
 Hawthorn: () => (
 <>
 {vStripes([
 "#FBBF15",
 "#4D2004",
 "#FBBF15",
 "#4D2004",
 "#FBBF15",
 "#4D2004",
 "#FBBF15",
 ])}
 </>
 ),

 // Navy with red V yoke
 Melbourne: () => (
 <>
 <Rect fill="#0F1F4D" />
 <polygon points="0,0 100,0 100,30 50,62 0,30" fill="#C8102E" />
 </>
 ),

 // Royal blue and white vertical stripes
 "North Melbourne": () => (
 <>
 {vStripes([
 "#FFFFFF",
 "#0B5ED7",
 "#FFFFFF",
 "#0B5ED7",
 "#FFFFFF",
 "#0B5ED7",
 "#FFFFFF",
 ])}
 </>
 ),

 // Black with teal and white V
 "Port Adelaide": () => (
 <>
 <Rect fill="#0A0A0A" />
 <polyline points="0,2 50,64 100,2" fill="none" stroke="#00B2CA" strokeWidth="24" strokeLinejoin="miter" />
 <polyline points="0,8 50,66 100,8" fill="none" stroke="#FFFFFF" strokeWidth="13" strokeLinejoin="miter" />
 </>
 ),

 // Black with yellow sash, right shoulder to left hem
 Richmond: () => (
 <>
 <Rect fill="#0D0D0D" />
 <polygon points="56,0 84,0 44,100 16,100" fill="#FFD200" />
 </>
 ),

 // White with red upper and jagged edge
 Sydney: () => (
 <>
 <Rect fill="#FFFFFF" />
 <polygon
 points="0,0 100,0 100,46 85,32 70,50 55,30 40,50 25,32 10,50 0,40"
 fill="#D50032"
 />
 </>
 ),

 // Red, white and black vertical panels
 "St Kilda": () => <>{vStripes(["#D71920", "#FFFFFF", "#0D0D0D"])}</>,

 // Blue with white and gold centre panels
 "West Coast": () => <>{vStripes(["#0B2A8A", "#FFFFFF", "#F2B705"])}</>,

 // Blue with red and white chest bands
 "Western Bulldogs": () => (
 <>
 <Rect fill="#1B4DB1" />
 <Rect y={30} h={13} fill="#D4202C" />
 <Rect y={43} h={11} fill="#FFFFFF" />
 </>
 ),
};

export default function ClubBadge({ club, size = 80 }) {
 const Design = designs[club];

 return (
 <div
 title={club}
 style={{
 width: size,
 height: size,
 borderRadius: "50%",
 border: "3px solid white",
 boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
 flexShrink: 0,
 overflow: "hidden",
 background: "#334155",
 }}
 >
 {Design && (
 <svg
 viewBox="0 0 100 100"
 width="100%"
 height="100%"
 preserveAspectRatio="xMidYMid slice"
 style={{ display: "block" }}
 aria-label={club}
 role="img"
 >
 <Design />
 </svg>
 )}
 </div>
 );
}
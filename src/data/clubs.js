export const clubs = [

  {
  id: 1,
  name: "Adelaide",
  abbreviation: "ADE",
  colours: {
  primary: "#002B7F",
  secondary: "#FFD100"
  },
  badgeStyle: "crows",
  draftPicks: [15, 32, 35, 43, 56, 92, 110],
  venue: "Adelaide Oval"
  },
  
  {
  id: 2,
  name: "Brisbane",
  abbreviation: "BL",
  colours: {
  primary: "#7B001C",
  secondary: "#002B7F"
  },
  badgeStyle: "lions",
  draftPicks: [21, 27, 28, 45, 79, 97, 115],
  venue: "Gabba"
  },
  
  
  
  {
  id: 3,
  name: "Carlton",
  abbreviation: "CAR",
  colours: {
  primary: "#031B4E",
  secondary: "#FFFFFF"
  },
  badgeStyle: "navy",
  draftPicks: [13, 18, 31, 50, 61, 72, 90, 108],
  venue: "MCG"
  },
  
  {
  id: 4,
  name: "Collingwood",
  abbreviation: "COL",
  colours: {
  primary: "#000000",
  secondary: "#FFFFFF"
  },
  badgeStyle: "stripes",
  draftPicks: [11, 30, 67, 68, 70, 88, 106],
  venue: "MCG"
  },
  
  {
  id: 5,
  name: "Essendon",
  abbreviation: "ESS",
  colours: {
  primary: "#000000",
  secondary: "#D50032"
  },
  badgeStyle: "bombers",
  draftPicks: [1, 17, 25, 80, 98],
  venue: "Marvel Stadium"
  },
  
  {
  id: 6,
  name: "Fremantle",
  abbreviation: "FRE",
  colours: {
  primary: "#2D006B",
  secondary: "#FFFFFF"
  },
  badgeStyle: "dockers",
  draftPicks: [19, 40, 60, 63, 78, 96, 114],
  venue: "Optus Stadium"
  },
  
  {
  id: 7,
  name: "Geelong",
  abbreviation: "GEE",
  colours: {
  primary: "#002B7F",
  secondary: "#FFFFFF"
  },
  badgeStyle: "cats",
  draftPicks: [36, 57, 62, 75, 93, 111],
  venue: "GMHBA Stadium"
  },
  
  {
  id: 8,
  name: "Gold Coast",
  abbreviation: "GC",
  colours: {
  primary: "#D71920",
  secondary: "#FDB927"
  },
  badgeStyle: "suns",
  draftPicks: [8, 81, 85, 103],
  venue: "People First Stadium"
  },
  
  {
  id: 9,
  name: "GWS",
  abbreviation: "GWS",
  colours: {
  primary: "#F15A22",
  secondary: "#424242"
  },
  badgeStyle: "giants",
  draftPicks: [9, 20, 26, 59, 77, 86, 104],
  venue: "ENGIE Stadium"
  },
  
  {
  id: 10,
  name: "Hawthorn",
  abbreviation: "HAW",
  colours: {
  primary: "#4A2E13",
  secondary: "#F4C542"
  },
  badgeStyle: "hawks",
  draftPicks: [29, 37, 71, 94, 107, 112],
  venue: "MCG"
  },
  
  
  {
  id: 11,
  name: "Melbourne",
  abbreviation: "MEL",
  colours: {
  primary: "#001B44",
  secondary: "#C8102E"
  },
  badgeStyle: "demons",
  draftPicks: [4, 14, 48, 52],
  venue: "MCG"
  },
  
  {
  id: 12,
  name: "North Melbourne",
  abbreviation: "NM",
  colours: {
  primary: "#0057B8",
  secondary: "#FFFFFF"
  },
  badgeStyle: "kangaroos",
  draftPicks: [33, 49, 66, 74, 84, 102],
  venue: "Marvel Stadium"
  },
  
  {
  id: 13,
  name: "Port Adelaide",
  abbreviation: "PA",
  colours: {
  primary: "#00A3E0",
  secondary: "#000000"
  },
  badgeStyle: "power",
  draftPicks: [7, 12, 22, 24, 34, 46, 65, 101],
  venue: "Adelaide Oval"
  },
  
  {
  id: 14,
  name: "Richmond",
  abbreviation: "RIC",
  colours: {
  primary: "#000000",
  secondary: "#FFD100"
  },
  badgeStyle: "tigers",
  draftPicks: [2, 5, 44, 99],
  venue: "MCG"
  },
  
  {
  id: 15,
  name: "St Kilda",
  abbreviation: "STK",
  colours: {
  primary: "#D71920",
  secondary: "#000000"
  },
  badgeStyle: "saints",
  draftPicks: [10, 16, 41, 51, 69, 87, 105],
  venue: "Marvel Stadium"
  },
  
  {
  id: 16,
  name: "Sydney",
  abbreviation: "SYD",
  colours: {
  primary: "#D50032",
  secondary: "#FFFFFF"
  },
  badgeStyle: "swans",
  draftPicks: [6, 38, 39, 47, 54, 76, 95, 113],
  venue: "SCG"
  },
  
  {
  id: 17,
  name: "West Coast",
  abbreviation: "WC",
  colours: {
  primary: "#003087",
  secondary: "#F2A900"
  },
  badgeStyle: "eagles",
  draftPicks: [3, 23, 58, 64, 73, 82, 100],
  venue: "Optus Stadium"
  },
  
  {
  id: 18,
  name: "Western Bulldogs",
  abbreviation: "WB",
  colours: {
  primary: "#003087",
  secondary: "#C8102E"
  },
  badgeStyle: "bulldogs",
  draftPicks: [42, 53, 55, 83, 89, 91, 109],
  venue: "Marvel Stadium"
  }
  ];
  
  export const tasmaniaDevils = {
  id: 19,
  name: "Tasmania",
  abbreviation: "TAS",
  // Taken from the Tasmania Devils guernsey: deep green body, red trim, yellow Tasmania map with a red T.
  colours: { primary: "#1D5C3A", secondary: "#E3313B", accent: "#F6D55C" },
  badgeStyle: "devils",
  draftPicks: [],
  venue: "York Park",
  competitionStartYear: 2028,
  };
  
  export function leagueClubsForYear(year = 2027) {
  return Number(year) >= 2028 ? [...clubs, tasmaniaDevils] : clubs;
  }
  
  // Tasmania may participate in draft/list-building events before it joins the
  // premiership competition in 2028.
  export function draftClubsForYear(year = 2026) {
  return Number(year) >= 2027 ? [...clubs, tasmaniaDevils] : clubs;
  }
  
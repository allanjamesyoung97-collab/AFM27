import { clubs as allClubs, tasmaniaDevils } from "./clubs.js";

export const clubs = allClubs.map((club) => ({
  name: club.name,
  venue: club.venue
}));

export const initialLadder = allClubs.map((club) => ({
  club: club.name,

  wins: 0,
  losses: 0,
  draws: 0,

  points: 0,

  pointsFor: 0,
  pointsAgainst: 0,

  percentage: 100.0,

  form: [],

  previousPosition: null,
  movement: "-"
}));

export const clubVenues = Object.fromEntries(
  [...allClubs, tasmaniaDevils].map((club) => [club.name, club.venue])
);

import type { HelpTour } from "@/lib/help";

export const HOME_TOUR: HelpTour = {
  id: "home",
  steps: [
    {
      target: "help",
      title: "Help is here",
      body: "The first time you open a page, we walk you through it. Tap this anytime to run the tour again.",
    },
    {
      target: "home-hero",
      title: "Host or join",
      body: "Browse open events, or create one. Games are titles you play online. Sports are pitch events, with an optional venue so people can find what’s near them.",
    },
    {
      target: "home-how",
      title: "How an event runs",
      body: "Create the lobby, players register, you draw fixtures, then scores update the table or bracket. That’s the whole loop.",
    },
  ],
};

export const BROWSE_TOUR: HelpTour = {
  id: "browse",
  steps: [
    {
      target: "browse-filters",
      title: "Filter the list",
      body: "Narrow by status, Games vs Sports, payment, and format. Sponsored events have a prize already on the board.",
    },
    {
      target: "browse-location",
      title: "Find events near you",
      body: "Sports can list a country and city. Filter by country, search a place, or use Near me.",
    },
    {
      target: "browse-create",
      title: "Host your own",
      body: "Create a tournament when you want to run the lobby. Invite-only events still show here; people just need an invite to register.",
    },
  ],
};

export const GAMES_TOUR: HelpTour = {
  id: "games",
  steps: [
    {
      target: "catalog-kinds",
      title: "Games and sports",
      body: "Switch catalog here. Pick a title when you create a tournament. This list is the catalog, not a live stream.",
    },
    {
      target: "catalog-search",
      title: "Find a title",
      body: "Search by name, then create a tournament from that game or sport.",
    },
    {
      target: "catalog-create",
      title: "Create from here",
      body: "You choose the title again in the create flow. This just gets you to the host terminal.",
    },
  ],
};

export const CREATE_GAME_TOUR: HelpTour = {
  id: "create-game",
  steps: [
    {
      target: "create-steps",
      title: "Four locks, then launch",
      body: "Catalog, format, rules, then the lobby details. You can jump back a step without losing what you set.",
    },
    {
      target: "create-kinds",
      title: "Pick the catalog",
      body: "Country and city are enough for people to find the event. Venues (a pitch or stadium) are optional.",
    },
    {
      target: "create-pick",
      title: "Choose the title",
      body: "Tap the game or sport this event is for. That’s what players see on the listing.",
    },
  ],
};

export const CREATE_FORMAT_TOUR: HelpTour = {
  id: "create-format",
  steps: [
    {
      target: "create-pitch-format",
      title: "Pitch format",
      body: "Sports like football can suggest 5, 7, or 11-a-side. That is only a starting point. You still choose the roster.",
    },
    {
      target: "create-modes",
      title: "How they compete",
      body: "Knockout is win or go home. Groups play a round-robin then a bracket. League is a table. Battle royale is one lobby.",
    },
    {
      target: "create-roster",
      title: "Roster size",
      body: "Set how many players sit on each team. Use any count from 1 to 32, for games, sports, or anything else.",
    },
    {
      target: "create-draw",
      title: "Seeding",
      body: "Auto seed shuffles the draw. Manual keeps registration order, which matters for leagues and some host setups.",
    },
  ],
};

export const CREATE_RULES_TOUR: HelpTour = {
  id: "create-rules",
  steps: [
    {
      target: "create-access",
      title: "Who can register",
      body: "Invite only still lists the event. Anyone can join means an account is enough. You send invites from the tournament page.",
    },
    {
      target: "create-entry",
      title: "Stakes",
      body: "Free has no purse. Paid: players pay, a cut is the platform fee, the rest is held for prizes. Sponsored: you fund the board at launch.",
    },
  ],
};

export const CREATE_BRIEF_TOUR: HelpTour = {
  id: "create-brief",
  steps: [
    {
      target: "create-identity",
      title: "Name and date",
      body: "This is the public listing. Host as yourself or under an organization if you have one.",
    },
    {
      target: "create-venues",
      title: "Location, then venues",
      body: "Set country and city so the listing can be searched. Add venues only if you already know the pitch or stadium.",
    },
    {
      target: "create-launch",
      title: "Launch the lobby",
      body: "Publishing does not start play. Registration stays open until you start the tournament from Manage or Run.",
    },
  ],
};

export const TOURNAMENT_TOUR: HelpTour = {
  id: "tournament",
  steps: [
    {
      target: "tour-actions",
      title: "Join, share, run",
      body: "Register if the lobby is open. Check in when the host requires it. Hosts get Manage. Share the page so people can find it.",
    },
    {
      target: "tour-tabs",
      title: "Everything lives in tabs",
      body: "Details and announcements for everyone. Fixtures and the table update from scores. Invite and Run are for hosts.",
    },
    {
      target: "tour-details",
      title: "The brief",
      body: "Rules, prizes, location, and who can register. Venues are optional extras when you know the pitch.",
    },
  ],
};

// Managing is split across four tabs, so each step names the tab it lives on -
// the spotlight only lands when that tab is the one on screen.
export const MANAGE_TOUR: HelpTour = {
  id: "manage",
  steps: [
    {
      target: "tour-stages",
      title: "Run event",
      body: "Start when the lobby is ready. That locks registration and builds fixtures. Later buttons advance groups or the next knockout round.",
    },
    {
      target: "manage-invite",
      title: "Roster tab",
      body: "Invite players by name, add them directly, or remove a team. Invite-only events need an invite before someone can register.",
    },
    {
      target: "manage-announce",
      title: "Announcements tab",
      body: "Posts show on the tournament page and notify everyone in this event.",
    },
    {
      target: "manage-settings",
      title: "Settings tab",
      body: "Name, date, location, size, format options, co-managers, and deletion. After it starts, serious changes ask registered players to accept.",
    },
  ],
};

export const PROFILE_TOUR: HelpTour = {
  id: "profile",
  steps: [
    {
      target: "dash-create",
      title: "Your events",
      body: "Create a new tournament, or open one you already host. Joined events are listed lower on this page.",
    },
    {
      target: "dash-hosted",
      title: "You host these",
      body: "Open a card to run scores, invites, and the draw. Manage is on the tournament page.",
    },
    {
      target: "dash-joined",
      title: "You play these",
      body: "Events you registered for. Your teams, payout account, organizations and account settings are in the tabs at the top of this page.",
    },
  ],
};

export const ORG_TOUR: HelpTour = {
  id: "org",
  steps: [
    {
      target: "org-create",
      title: "Host under a brand",
      body: "An organization lets several people run events under one name. Create one, then invite managers.",
    },
    {
      target: "org-invites",
      title: "Invites to join",
      body: "If someone added you to a club, accept or decline here.",
    },
    {
      target: "org-list",
      title: "Your organizations",
      body: "Open one to edit the profile, members, and the events it hosts.",
    },
  ],
};

export const FALLBACK_TOUR: HelpTour = {
  id: "site",
  steps: [
    {
      target: "help",
      title: "Help",
      body: "Complex pages walk you through the first visit. Tap this to replay. Home, tournaments, create, and manage have the longest tours.",
    },
    {
      target: "nav-tournaments",
      title: "Tournaments",
      body: "Browse every lobby. Filter Games vs Sports, and for sports use country or Near me.",
    },
    {
      target: "nav-games",
      title: "Catalog",
      body: "Games and Sports are catalogs you host from, not a stream. Pick a title when you create an event.",
    },
  ],
};

export const CREATE_TOURS: Record<
  "game" | "format" | "rules" | "brief",
  HelpTour
> = {
  game: CREATE_GAME_TOUR,
  format: CREATE_FORMAT_TOUR,
  rules: CREATE_RULES_TOUR,
  brief: CREATE_BRIEF_TOUR,
};

/**
 * Single source of truth for the events the site counts down to.
 *
 * Times are US Eastern wall-clock ("YYYY-MM-DDTHH:mm:ss"), converted with parseAsEastern.
 * Each event has three phases:
 *   upcoming  now <  start           → countdown
 *   today     start <= now < end     → "Today is Election Day" (polls open somewhere in the US)
 *   past      now >= end             → dropped from the flip list
 */

export type ElectionId = "midterm-2026" | "presidential-2028" | "inauguration-2029";
/** Elections the API accepts a vote intent for. */
export type VotableElectionId = "midterm-2026" | "presidential-2028";
export type ElectionPhase = "upcoming" | "today" | "past";

export interface Election {
  id: ElectionId;
  title: string;
  subtitle: string;
  /** Countdown target, Eastern time. */
  start: string;
  /** When the "today" phase ends, Eastern time. */
  end: string;
  /** Message shown during the "today" phase. */
  todayTitle: string;
  todayMessage: string;
  /** Which election a vote intent made on this card belongs to. */
  votesFor: VotableElectionId;
}

// Election days end at 1:00 AM ET the next morning: the last US polls (Alaska's Aleutian
// Islands, 8 PM HAST) close at 1:00 AM EST. Hawaii and the rest of Alaska close at midnight EST.
export const ELECTIONS: Election[] = [
  {
    id: "midterm-2026",
    title: "2026 Midterm Elections",
    subtitle: "Upcoming Election",
    start: "2026-11-03T00:00:00",
    end: "2026-11-04T01:00:00",
    todayTitle: "Today is Election Day",
    todayMessage: "Polls are open across the country. Hours vary by state, so check yours before you go.",
    votesFor: "midterm-2026",
  },
  {
    id: "presidential-2028",
    title: "2028 Presidential Election",
    subtitle: "Next Presidential Race",
    start: "2028-11-07T00:00:00",
    end: "2028-11-08T01:00:00",
    todayTitle: "Today is Election Day",
    todayMessage: "Polls are open across the country. Hours vary by state, so check yours before you go.",
    votesFor: "presidential-2028",
  },
  {
    id: "inauguration-2029",
    title: "2029 Inauguration Day",
    subtitle: "Presidential Inauguration",
    start: "2029-01-20T12:00:00",
    end: "2029-01-21T00:00:00",
    todayTitle: "Today is Inauguration Day",
    todayMessage: "The President takes the oath of office at noon Eastern.",
    votesFor: "presidential-2028",
  },
];

/**
 * Interpret "2026-11-03T00:00:00" as US Eastern time (EST or EDT on that date),
 * independent of the viewer's own timezone.
 */
export function parseAsEastern(dateStr: Date | string): Date {
  if (dateStr instanceof Date) return dateStr;
  try {
    const asUtc = new Date(dateStr + "Z");
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      timeZoneName: "shortOffset",
    });
    const tzPart = formatter.formatToParts(asUtc).find((p) => p.type === "timeZoneName");
    const offsetMatch = tzPart?.value?.match(/GMT([+-]\d+)/);
    if (offsetMatch) {
      const offsetHours = parseInt(offsetMatch[1], 10);
      return new Date(asUtc.getTime() - offsetHours * 3600 * 1000);
    }
  } catch {
    // fall through
  }
  return new Date(dateStr);
}

export function electionPhase(election: Election, now: Date = new Date()): ElectionPhase {
  if (now < parseAsEastern(election.start)) return "upcoming";
  if (now < parseAsEastern(election.end)) return "today";
  return "past";
}

/** Events still worth showing (upcoming or today), in date order. */
export function activeElections(now: Date = new Date()): Election[] {
  return ELECTIONS.filter((e) => electionPhase(e, now) !== "past");
}

/** The event to feature first; falls back to the last one so the page is never empty. */
export function nextElection(now: Date = new Date()): Election {
  return activeElections(now)[0] ?? ELECTIONS[ELECTIONS.length - 1];
}

// State-specific voting dates for the 2026 general election, served as a static JSON file
// (client/public/data/state-voting-2026.json). Every date there was read from an official
// source; null means "not verifiable from the official page" and the UI says so.
//
// Plain TypeScript only (no enums/namespaces, no path aliases): tests/e2e/state-dates.mjs
// imports this file under Node's native type stripping.

export type IsoDate = string | null;

export interface StateVoting {
  name: string;
  registration: { online: IsoDate; mail: IsoDate; inPerson: IsoDate; sameDay: boolean; note: string | null };
  earlyVoting: { start: IsoDate; end: IsoDate; note: string | null };
  mail: { requestBy: IsoDate; returnBy: IsoDate; postmarkOk: boolean; note: string | null };
  source: { url: string; title: string; checkedOn: string };
  officialUrl: string;
}

export interface StateVotingFile {
  election: string;
  electionDay: string;
  generatedOn: string;
  states: Record<string, StateVoting>;
}

export const STATE_VOTING_URL = "/data/state-voting-2026.json";
export const UNKNOWN_DATE_TEXT = "Check your state's site";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "2026-10-19" -> "Mon, Oct 19"; null or malformed -> "Check your state's site". Timezone-free. */
export function formatVotingDate(iso: IsoDate): string {
  if (!iso) return UNKNOWN_DATE_TEXT;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return UNKNOWN_DATE_TEXT;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return `${DAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** Latest non-null ISO date (they sort lexically), or null when all are null. */
export function latestDate(dates: IsoDate[]): IsoDate {
  return dates.reduce<IsoDate>((best, d) => (d && (!best || d > best) ? d : best), null);
}

let cached: Promise<StateVotingFile> | null = null;

/** Fetches the JSON once per page load; a failure clears the cache so a later selection retries. */
export function loadStateVoting(): Promise<StateVotingFile> {
  if (!cached) {
    cached = fetch(STATE_VOTING_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`state voting data ${r.status}`);
        return r.json() as Promise<StateVotingFile>;
      })
      .catch((e) => {
        cached = null;
        throw e;
      });
  }
  return cached;
}

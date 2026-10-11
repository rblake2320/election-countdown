// Anonymous visitor id: a random value kept in this browser only (key shared with the
// tracking script in index.html). It is how an anonymous vote is updated instead of duplicated.
const KEY = "ec_visitor_id";
const VALID = /^v_[a-z0-9]{8,48}$/;
let sessionFallback: string | null = null;

function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return "v_" + Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 24) + Date.now().toString(36);
}

export function getVisitorId(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing && VALID.test(existing)) return existing;
    const id = newId();
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    // Storage blocked (private mode / sandboxed iframe): one id for this page session.
    sessionFallback ||= newId();
    return sessionFallback;
  }
}

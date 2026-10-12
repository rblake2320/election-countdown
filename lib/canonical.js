// One public address. Requests for a page on an alias host (the old *.pages.dev address, www)
// get a permanent redirect to the canonical host, keeping path and query.
// /api/* is never redirected: open tabs on the old address and OAuth callbacks keep working.
export function canonicalRedirect(requestUrl, method, env) {
  const canonical = String(env.CANONICAL_HOST || "").trim().toLowerCase();
  if (!canonical) return null;
  const aliases = String(env.REDIRECT_HOSTS || "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
  const url = new URL(requestUrl);
  if (!aliases.includes(url.hostname) || url.hostname === canonical) return null;
  if (method !== "GET" && method !== "HEAD") return null;
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return null;
  return `https://${canonical}${url.pathname}${url.search}`;
}

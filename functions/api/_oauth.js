// Google + GitHub sign-in (OAuth 2.0 authorization-code flow, server side).
// Each provider is enabled only when both its client id and secret are set as Pages secrets.
// The underscore prefix keeps Pages from routing this file; [[path]].js imports it.

export const PROVIDERS = {
  google: {
    idVar: "GOOGLE_CLIENT_ID",
    secretVar: "GOOGLE_CLIENT_SECRET",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "openid email profile",
    pkce: true
  },
  github: {
    idVar: "GITHUB_CLIENT_ID",
    secretVar: "GITHUB_CLIENT_SECRET",
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scope: "read:user user:email",
    pkce: true
  }
};

export const OAUTH_COOKIE = "ec_oauth";
const OAUTH_COOKIE_MAX_AGE = 600;

export function providerConfig(env, name) {
  const p = PROVIDERS[name];
  if (!p) return null;
  const clientId = String(env[p.idVar] || "").trim();
  const clientSecret = String(env[p.secretVar] || "").trim();
  return clientId && clientSecret ? { ...p, name, clientId, clientSecret } : null;
}

export function enabledProviders(env) {
  return Object.fromEntries(Object.keys(PROVIDERS).map((name) => [name, !!providerConfig(env, name)]));
}

export function callbackUrl(requestUrl, name) {
  return `${new URL(requestUrl).origin}/api/auth/oauth/${name}/callback`;
}

/** Only same-site relative paths, so the flow can't be used as an open redirect. */
export function safeReturnTo(value) {
  const v = String(value || "/");
  return v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") ? v.slice(0, 200) : "/";
}

function b64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomB64url(n) {
  return b64url(crypto.getRandomValues(new Uint8Array(n)));
}

async function s256(verifier) {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
}

/** Builds the provider redirect and the short-lived cookie holding state, PKCE verifier and returnTo. */
export async function startAuthorization(cfg, requestUrl, returnTo) {
  const state = randomB64url(24);
  const verifier = randomB64url(48);
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: callbackUrl(requestUrl, cfg.name),
    response_type: "code",
    scope: cfg.scope,
    state
  });
  if (cfg.pkce) {
    params.set("code_challenge", await s256(verifier));
    params.set("code_challenge_method", "S256");
  }
  if (cfg.name === "google") params.set("prompt", "select_account");
  if (cfg.name === "github") params.set("allow_signup", "true");
  const cookieValue = b64url(new TextEncoder().encode(JSON.stringify({ p: cfg.name, s: state, v: verifier, r: safeReturnTo(returnTo) })));
  const secure = new URL(requestUrl).protocol === "https:" ? " Secure;" : "";
  // SameSite=Lax: the provider sends the browser back with a top-level GET, which Lax allows.
  const cookie = `${OAUTH_COOKIE}=${cookieValue}; Path=/api/auth/oauth; HttpOnly;${secure} SameSite=Lax; Max-Age=${OAUTH_COOKIE_MAX_AGE}`;
  return { location: `${cfg.authorizeUrl}?${params}`, cookie };
}

export function readOAuthCookie(raw) {
  try {
    const json = new TextDecoder().decode(Uint8Array.from(atob(raw.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));
    const value = JSON.parse(json);
    return value && typeof value.s === "string" && typeof value.v === "string" ? value : null;
  } catch {
    return null;
  }
}

export function clearOAuthCookie(requestUrl) {
  const secure = new URL(requestUrl).protocol === "https:" ? " Secure;" : "";
  return `${OAUTH_COOKIE}=; Path=/api/auth/oauth; HttpOnly;${secure} SameSite=Lax; Max-Age=0`;
}

/** Exchanges the code and returns { providerUserId, email, firstName, lastName } with a verified email, or throws. */
export async function fetchVerifiedProfile(cfg, requestUrl, code, verifier) {
  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    code,
    redirect_uri: callbackUrl(requestUrl, cfg.name),
    grant_type: "authorization_code"
  });
  if (cfg.pkce) body.set("code_verifier", verifier);
  const tokenRes = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body
  });
  const token = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !token.access_token) {
    throw new OAuthError("token_exchange_failed", token.error || `HTTP ${tokenRes.status}`);
  }
  const auth = { authorization: `Bearer ${token.access_token}`, accept: "application/json", "user-agent": "election-countdown" };

  if (cfg.name === "google") {
    const info = await (await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: auth })).json();
    if (!info.sub) throw new OAuthError("profile_failed", "no sub");
    if (!info.email || info.email_verified !== true) throw new OAuthError("unverified_email", "Google email not verified");
    return { providerUserId: String(info.sub), email: info.email, firstName: info.given_name || null, lastName: info.family_name || null };
  }

  const user = await (await fetch("https://api.github.com/user", { headers: auth })).json();
  if (!user.id) throw new OAuthError("profile_failed", "no id");
  const emails = await (await fetch("https://api.github.com/user/emails", { headers: auth })).json();
  const primary = Array.isArray(emails) ? emails.find((e) => e.primary && e.verified) : null;
  if (!primary) throw new OAuthError("unverified_email", "GitHub has no verified primary email");
  const [firstName, ...rest] = String(user.name || "").trim().split(/\s+/);
  return { providerUserId: String(user.id), email: primary.email, firstName: firstName || null, lastName: rest.join(" ") || null };
}

export class OAuthError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.code = code;
  }
}

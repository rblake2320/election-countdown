const SESSION_COOKIE = "ec_session";
const SESSION_DAYS = 30;
const MIN_PUBLIC_BREAKDOWN = 50000;
const MIN_SEGMENT_BREAKDOWN = 50;
const MAX_JSON_BYTES = 32 * 1024;
const MIN_PROD_SECRET_LENGTH = 32;
const PASSWORD_HASH_ITERATIONS = 100000;
const INTENTS = new Set(["red", "blue", "independent", "undecided"]);
let schemaReady = false;
const STATES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC"
]);

export async function onRequest(context) {
  try {
    const { request, env } = context;
    if (!env.DB) {
      return json({ message: "D1 binding DB is not configured" }, 500);
    }
    await ensureSchema(env);

    const url = new URL(request.url);
    const rawPath = context.params.path;
    const pathValue = Array.isArray(rawPath) ? rawPath.join("/") : rawPath || "";
    const path = "/" + pathValue.replace(/^\/+/, "");
    const user = await currentUser(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: securityHeaders() });
    }

    if (path === "/health" && request.method === "GET") return health(request, env);
    if ((path === "/auth/user" || path === "/auth/me" || path === "/auth/session" || path === "/me") && request.method === "GET") return json(user);
    if (path === "/auth/register" && request.method === "POST") return register(request, env);
    if ((path === "/login" || path === "/auth/login") && request.method === "POST") return login(request, env);
    if ((path === "/logout" || path === "/auth/logout" || path === "/auth/signout") && request.method === "POST") return csrfProtected(request, () => logout(request, env));
    if (path === "/account" && request.method === "GET") return account(user, env);
    if (path === "/account" && request.method === "DELETE") return csrfProtected(request, () => deleteAccount(request, user, env));
    if (path === "/intent" && request.method === "GET") return getIntent(user, env);
    if (path === "/intent" && request.method === "POST") return csrfProtected(request, () => saveIntent(request, user, env));
    if (path === "/intent/history" && request.method === "GET") return intentHistory(user, env);
    if (path === "/intent/aggregate" && request.method === "GET") return stats(env);
    if (path === "/stats" && request.method === "GET") return stats(env);
    if (path === "/donations" && request.method === "GET") return donations(user, env);
    if (path === "/donor/analytics" && request.method === "GET") return donorAnalytics(user, env);
    if (path === "/admin/analytics" && request.method === "GET") return adminAnalytics(request, env);
    if (path === "/admin/export/votes.csv" && request.method === "GET") return exportVotes(request, env);
    if (path.startsWith("/track/") && request.method === "POST") return track(path.slice(7), request, user, env);
    if (path === "/verify/status" && request.method === "GET") return verifyStatus(user);
    if (path.startsWith("/verify/") && request.method === "POST") return verificationStub(path, user, env);

    return json({ message: "Not found" }, 404);
  } catch (error) {
    return json({ message: "Server error" }, 500);
  }
}

function csrfProtected(request, action) {
  if (!isTrustedStateChange(request)) {
    return json({ message: "Same-origin request required" }, 403);
  }
  return action();
}

function isTrustedStateChange(request) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin) return origin === url.origin;

  const referer = request.headers.get("referer");
  if (!referer) return false;
  try {
    return new URL(referer).origin === url.origin;
  } catch {
    return false;
  }
}

function health(request, env) {
  const prod = isProductionRequest(request);
  const adminConfigured = validAdminSecret(env.ADMIN_SECRET, prod);
  const ipHashConfigured = !!String(env.IP_HASH_SECRET || env.ADMIN_SECRET || "").trim();
  return json({
    ok: !!env.DB && adminConfigured && ipHashConfigured,
    database: !!env.DB,
    adminSecret: adminConfigured,
    ipHashSecret: ipHashConfigured,
    mode: prod ? "production" : "local"
  }, env.DB && adminConfigured && ipHashConfigured ? 200 : 503);
}

async function ensureSchema(env) {
  if (schemaReady) return;
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      ec_id TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      phone TEXT,
      email_verified INTEGER NOT NULL DEFAULT 0,
      phone_verified INTEGER NOT NULL DEFAULT 0,
      is_fully_verified INTEGER NOT NULL DEFAULT 0,
      verified_at TEXT,
      trust_score INTEGER NOT NULL DEFAULT 0,
      flagged_as_bot INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      user_agent TEXT,
      ip_hash TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS vote_intents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      intent TEXT NOT NULL,
      state TEXT NOT NULL,
      age_range TEXT,
      city TEXT,
      sex TEXT,
      custom_candidate TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS vote_intent_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      previous_intent TEXT,
      new_intent TEXT NOT NULL,
      previous_state TEXT,
      new_state TEXT NOT NULL,
      previous_payload_json TEXT,
      new_payload_json TEXT NOT NULL,
      changed_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS tracking_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      user_id TEXT,
      payload_json TEXT NOT NULL DEFAULT '{}',
      path TEXT,
      referrer TEXT,
      user_agent TEXT,
      ip_hash TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS verification_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      action TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS donations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      provider TEXT,
      provider_ref TEXT,
      created_at TEXT NOT NULL
    )`,
    "CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)",
    "CREATE INDEX IF NOT EXISTS idx_vote_intents_state ON vote_intents(state)",
    "CREATE INDEX IF NOT EXISTS idx_vote_intents_age ON vote_intents(age_range)",
    "CREATE INDEX IF NOT EXISTS idx_vote_intents_intent ON vote_intents(intent)",
    "CREATE INDEX IF NOT EXISTS idx_vote_intent_history_user ON vote_intent_history(user_id, changed_at)",
    "CREATE INDEX IF NOT EXISTS idx_tracking_events_type_created ON tracking_events(event_type, created_at)"
  ];
  await env.DB.batch(statements.map((statement) => env.DB.prepare(statement)));
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
  schemaReady = true;
}

async function register(request, env) {
  const input = await readJson(request);
  const email = normalizeEmail(input.email);
  if (!email || !input.password || String(input.password).length < 8) {
    return json({ message: "Valid email and 8+ character password are required" }, 400);
  }

  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) return json({ message: "If this email is available, your account has been created. Check your inbox." }, 200);

  const now = new Date().toISOString();
  const salt = randomToken(24);
  const user = {
    id: crypto.randomUUID(),
    ecId: ecId(),
    email,
    firstName: cleanText(input.firstName, 80),
    lastName: cleanText(input.lastName, 80),
    phone: null,
    emailVerified: false,
    phoneVerified: false,
    isFullyVerified: false,
    verifiedAt: null,
    trustScore: 0,
    flaggedAsBot: false,
    createdAt: now,
    updatedAt: now
  };
  const passwordHash = await hashPassword(input.password, salt);

  await env.DB.prepare(
    `INSERT INTO users (
      id, ec_id, email, password_hash, password_salt, first_name, last_name, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(user.id, user.ecId, user.email, passwordHash, salt, user.firstName, user.lastName, now, now).run();

  return withSession(json(user, 200), await createSession(request, env, user.id));
}

async function login(request, env) {
  const input = await readJson(request);
  const email = normalizeEmail(input.email);
  const row = email
    ? await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first()
    : null;
  if (!row || !(await verifyPassword(input.password || "", row.password_salt, row.password_hash))) {
    return json({ message: "Invalid email or password" }, 401);
  }

  const user = publicUser(row);
  return withSession(json(user, 200), await createSession(request, env, user.id));
}

async function logout(request, env) {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
  }
  const response = json({ ok: true });
  const secure = new URL(request.url).protocol === "https:" ? " Secure;" : "";
  response.headers.append("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=0`);
  return response;
}

async function deleteAccount(request, user, env) {
  if (!user) return json({ message: "Sign in required" }, 401);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM verification_events WHERE user_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM donations WHERE user_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM vote_intent_history WHERE user_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM vote_intents WHERE user_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM tracking_events WHERE user_id = ?").bind(user.id),
    env.DB.prepare("DELETE FROM users WHERE id = ?").bind(user.id)
  ]);
  const response = json({ ok: true });
  const secure = new URL(request.url).protocol === "https:" ? " Secure;" : "";
  response.headers.append("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=0`);
  return response;
}

async function account(user, env) {
  if (!user) return json({ message: "Sign in required" }, 401);
  const intentRow = await env.DB.prepare("SELECT * FROM vote_intents WHERE user_id = ?").bind(user.id).first();
  const intent = intentRow ? publicIntent(intentRow) : null;
  const intentHistory = await readIntentHistory(user, env);
  return json({
    user,
    verification: verificationPayload(user),
    intent,
    intentHistory
  });
}

async function getIntent(user, env) {
  if (!user) return json(null, 401);
  const row = await env.DB.prepare("SELECT * FROM vote_intents WHERE user_id = ?").bind(user.id).first();
  return json(row ? publicIntent(row) : null);
}

async function intentHistory(user, env) {
  if (!user) return json({ message: "Sign in required" }, 401);
  return json(await readIntentHistory(user, env));
}

async function readIntentHistory(user, env) {
  const rows = await env.DB.prepare(
    `SELECT id, previous_intent AS previousIntent, new_intent AS newIntent,
            previous_state AS previousState, new_state AS newState, changed_at AS changedAt
     FROM vote_intent_history
     WHERE user_id = ?
     ORDER BY changed_at DESC
     LIMIT 25`
  ).bind(user.id).all();
  return rows.results || [];
}

async function saveIntent(request, user, env) {
  if (!user) return json({ message: "Sign in required" }, 401);
  const input = await readJson(request);
  if (!INTENTS.has(input.intent) || !STATES.has(input.state)) {
    return json({ message: "Valid intent and state are required" }, 400);
  }

  const now = new Date().toISOString();
  const existing = await env.DB.prepare("SELECT * FROM vote_intents WHERE user_id = ?").bind(user.id).first();
  const record = {
    id: existing?.id || crypto.randomUUID(),
    createdAt: existing?.created_at || now,
    updatedAt: now,
    intent: input.intent,
    state: input.state,
    ageRange: cleanText(input.ageRange, 20),
    city: cleanText(input.city, 80),
    sex: cleanText(input.sex, 30),
    customCandidate: cleanText(input.customCandidate, 100)
  };

  await env.DB.prepare(
    `INSERT INTO vote_intents (
      id, user_id, intent, state, age_range, city, sex, custom_candidate, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      intent = excluded.intent,
      state = excluded.state,
      age_range = excluded.age_range,
      city = excluded.city,
      sex = excluded.sex,
      custom_candidate = excluded.custom_candidate,
      updated_at = excluded.updated_at`
  ).bind(
    record.id,
    user.id,
    record.intent,
    record.state,
    record.ageRange,
    record.city,
    record.sex,
    record.customCandidate,
    record.createdAt,
    record.updatedAt
  ).run();

  const previousPayload = existing ? publicIntent(existing) : null;
  const newPayload = { ...record, state: record.state };
  await env.DB.prepare(
    `INSERT INTO vote_intent_history (
      id, user_id, previous_intent, new_intent, previous_state, new_state,
      previous_payload_json, new_payload_json, changed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    crypto.randomUUID(),
    user.id,
    existing?.intent || null,
    record.intent,
    existing?.state || null,
    record.state,
    JSON.stringify(previousPayload),
    JSON.stringify(newPayload),
    now
  ).run();

  await writeEvent(env, request, user, existing ? "intent_changed" : "intent_saved", {
    previousIntent: existing?.intent || null,
    newIntent: input.intent,
    previousState: existing?.state || null,
    newState: input.state
  });
  return json({ ...record, state: record.state });
}

async function stats(env) {
  const total = await scalar(env, "SELECT COUNT(*) FROM vote_intents");
  const counts = await env.DB.prepare(
    "SELECT intent, COUNT(*) AS count FROM vote_intents GROUP BY intent"
  ).all();
  const byIntent = Object.fromEntries((counts.results || []).map((row) => [row.intent, row.count]));
  const thresholdMet = total >= MIN_PUBLIC_BREAKDOWN;
  const red = byIntent.red || 0;
  const blue = byIntent.blue || 0;

  return json({
    total,
    showBar: thresholdMet,
    threshold: MIN_PUBLIC_BREAKDOWN,
    message: `${MIN_PUBLIC_BREAKDOWN.toLocaleString()} participants needed to show results`,
    redPercent: thresholdMet && total ? Math.round((red / total) * 100) : 0,
    bluePercent: thresholdMet && total ? Math.round((blue / total) * 100) : 0,
    redRange: thresholdMet ? percentRange(red, total) : null,
    blueRange: thresholdMet ? percentRange(blue, total) : null,
    undecided: thresholdMet ? byIntent.undecided || 0 : 0
  });
}

async function donations(user, env) {
  if (!user) return json([], 401);
  const rows = await env.DB.prepare(
    "SELECT id, amount, provider, created_at AS createdAt FROM donations WHERE user_id = ? ORDER BY created_at DESC"
  ).bind(user.id).all();
  return json(rows.results || []);
}

async function donorAnalytics(user, env) {
  if (!user) return json({ message: "Sign in required" }, 401);
  const donated = await scalar(env, "SELECT COALESCE(SUM(amount), 0) FROM donations WHERE user_id = ?", [user.id]);
  if (donated < 100) return json({ message: "Donate at least $1 to access detailed analytics." }, 403);

  const total = await scalar(env, "SELECT COUNT(*) FROM vote_intents");
  const intentCounts = await countsBy(env, "intent");
  return json({
    donorTier: donated >= 10000 ? "premium" : donated >= 2500 ? "supporter" : "basic",
    thresholdMet: total >= MIN_PUBLIC_BREAKDOWN,
    votesByIntent: {
      total,
      redRange: percentRange(intentCounts.red || 0, total),
      blueRange: percentRange(intentCounts.blue || 0, total),
      undecidedRange: percentRange(intentCounts.undecided || 0, total)
    },
    votesByState: await segmentedBreakdown(env, "state"),
    votesByAge: await segmentedBreakdown(env, "age_range")
  });
}

async function adminAnalytics(request, env) {
  if (!isAdmin(request, env)) return json({ message: "Invalid admin credentials" }, 401);
  const total = await scalar(env, "SELECT COUNT(*) FROM vote_intents");
  const byIntent = await countsBy(env, "intent");
  const flipStats = await env.DB.prepare(
    `SELECT substr(created_at, 1, 10) AS date, COUNT(*) AS count
     FROM tracking_events
     WHERE event_type = 'flip'
     GROUP BY date
     ORDER BY date DESC
     LIMIT 30`
  ).all();

  return json({
    sessionStats: {
      totalLogins: await scalar(env, "SELECT COUNT(*) FROM tracking_events WHERE event_type = 'login'"),
      uniqueActiveUsersToday: await scalar(env, "SELECT COUNT(DISTINCT user_id) FROM tracking_events WHERE created_at >= date('now') AND user_id IS NOT NULL")
    },
    votesByIntent: {
      red: byIntent.red || 0,
      blue: byIntent.blue || 0,
      independent: byIntent.independent || 0,
      undecided: byIntent.undecided || 0,
      total
    },
    intentChanges: await scalar(env, "SELECT COUNT(*) FROM vote_intent_history WHERE previous_intent IS NOT NULL"),
    flipStats: flipStats.results || []
  });
}

async function exportVotes(request, env) {
  if (!isAdmin(request, env)) return json({ message: "Invalid admin credentials" }, 401);
  const rows = await env.DB.prepare(
    `SELECT v.id, u.ec_id, u.email, v.intent, v.state, v.age_range, v.city, v.sex,
            v.custom_candidate, v.created_at, v.updated_at
     FROM vote_intents v
     JOIN users u ON u.id = v.user_id
     ORDER BY v.updated_at DESC`
  ).all();
  const header = ["id","ec_id","email","intent","state","age_range","city","sex","custom_candidate","created_at","updated_at"];
  const csv = [header.join(","), ...(rows.results || []).map((row) => header.map((key) => csvCell(row[key])).join(","))].join("\n");
  return new Response(csv, {
    headers: {
      ...securityHeaders(),
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=votes_export.csv"
    }
  });
}

async function track(type, request, user, env) {
  const cleanType = type.replace(/[^a-z0-9_-]/gi, "").slice(0, 40);
  const payload = await safeJson(request);
  if (cleanType === "batch" && Array.isArray(payload.events)) {
    const events = payload.events.slice(0, 50);
    for (const event of events) {
      const eventType = String(event.type || event.eventType || "event").replace(/[^a-z0-9_-]/gi, "").slice(0, 40) || "event";
      await writeEvent(env, request, user, eventType, trimPayload(event.payload || event));
    }
    return json({ ok: true, stored: events.length });
  }
  await writeEvent(env, request, user, cleanType || "event", trimPayload(payload));
  return json({ ok: true });
}

function verifyStatus(user) {
  if (!user) return json({ message: "Sign in required" }, 401);
  return json(verificationPayload(user));
}

function verificationPayload(user) {
  return {
    emailVerified: !!user.emailVerified,
    phoneVerified: !!user.phoneVerified,
    isFullyVerified: !!user.isFullyVerified,
    trustScore: user.trustScore || 0,
    providerConfigured: false,
    message: "Verification provider is not configured yet"
  };
}

async function verificationStub(path, user, env) {
  if (!user) return json({ message: "Sign in required" }, 401);
  await env.DB.prepare(
    "INSERT INTO verification_events (id, user_id, channel, action, created_at) VALUES (?, ?, ?, ?, ?)"
  ).bind(
    crypto.randomUUID(),
    user.id,
    path.includes("/email/") ? "email" : "phone",
    path.endsWith("/send") ? "send" : "confirm",
    new Date().toISOString()
  ).run();
  return json({
    ok: false,
    code: "verification_provider_not_configured",
    message: "Verification is not enabled yet"
  }, 503);
}

async function currentUser(request, env) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT u.*
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`
  ).bind(await sha256(token), new Date().toISOString()).first();
  return row ? publicUser(row) : null;
}

async function createSession(request, env, userId) {
  const token = randomToken(32);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await env.DB.prepare(
    "INSERT INTO sessions (token_hash, user_id, created_at, expires_at, user_agent, ip_hash) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(
    await sha256(token),
    userId,
    now.toISOString(),
    expires.toISOString(),
    request.headers.get("user-agent") || "",
    await ipHash(request, env)
  ).run();
  const secure = new URL(request.url).protocol === "https:" ? " Secure;" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=${SESSION_DAYS * 24 * 60 * 60}`;
}

function withSession(response, cookie) {
  response.headers.append("Set-Cookie", cookie);
  return response;
}

async function writeEvent(env, request, user, type, payload) {
  const url = new URL(request.url);
  await env.DB.prepare(
    `INSERT INTO tracking_events (
      id, event_type, user_id, payload_json, path, referrer, user_agent, ip_hash, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    crypto.randomUUID(),
    type,
    user?.id || null,
    JSON.stringify(payload || {}),
    url.pathname,
    request.headers.get("referer") || "",
    request.headers.get("user-agent") || "",
    await ipHash(request, env),
    new Date().toISOString()
  ).run();
}

function isAdmin(request, env) {
  const expected = String(env.ADMIN_SECRET || "");
  if (!validAdminSecret(expected, isProductionRequest(request))) return false;
  return !!expected && request.headers.get("x-admin-secret") === expected;
}

function validAdminSecret(secret, production) {
  const value = String(secret || "");
  return production ? value.length >= MIN_PROD_SECRET_LENGTH : value.length > 0;
}

async function countsBy(env, field) {
  const allowed = new Set(["intent", "state", "age_range"]);
  if (!allowed.has(field)) throw new Error("Unsupported count field");
  const rows = await env.DB.prepare(`SELECT ${field} AS key, COUNT(*) AS count FROM vote_intents GROUP BY ${field}`).all();
  return Object.fromEntries((rows.results || []).map((row) => [row.key || "not_provided", row.count]));
}

async function segmentedBreakdown(env, field) {
  const allowed = new Set(["state", "age_range"]);
  if (!allowed.has(field)) throw new Error("Unsupported segment field");
  const rows = await env.DB.prepare(
    `SELECT ${field} AS segment, intent, COUNT(*) AS count
     FROM vote_intents
     GROUP BY ${field}, intent`
  ).all();
  const out = {};
  for (const row of rows.results || []) {
    const key = row.segment || "not_provided";
    out[key] ||= { total: 0, red: 0, blue: 0, independent: 0, undecided: 0 };
    out[key][row.intent] = row.count;
    out[key].total += row.count;
  }
  for (const [key, value] of Object.entries(out)) {
    if (value.total < MIN_SEGMENT_BREAKDOWN) {
      delete out[key];
      continue;
    }
    value.redRange = percentRange(value.red || 0, value.total);
    value.blueRange = percentRange(value.blue || 0, value.total);
    value.undecidedRange = percentRange(value.undecided || 0, value.total);
  }
  return out;
}

async function scalar(env, sql, params = []) {
  const row = await env.DB.prepare(sql).bind(...params).first();
  return Number(row ? Object.values(row)[0] : 0);
}

function percentRange(count, total) {
  if (!total) return "0-5%";
  const pct = Math.floor((count / total) * 100);
  const start = Math.floor(pct / 5) * 5;
  return `${start}-${Math.min(start + 5, 100)}%`;
}

function publicUser(row) {
  return {
    id: row.id,
    ecId: row.ec_id,
    email: row.email,
    phone: row.phone,
    firstName: row.first_name,
    lastName: row.last_name,
    profileImageUrl: null,
    emailVerified: !!row.email_verified,
    phoneVerified: !!row.phone_verified,
    isFullyVerified: !!row.is_fully_verified,
    verifiedAt: row.verified_at,
    trustScore: row.trust_score || 0,
    flaggedAsBot: !!row.flagged_as_bot,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function publicIntent(row) {
  return {
    id: row.id,
    intent: row.intent,
    state: row.state,
    ageRange: row.age_range,
    city: row.city,
    sex: row.sex,
    customCandidate: row.custom_candidate,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function readJson(request) {
  try {
    const declaredLength = Number(request.headers.get("content-length") || 0);
    if (declaredLength > MAX_JSON_BYTES) return {};
    const text = await request.text();
    if (!text || text.length > MAX_JSON_BYTES) return {};
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function safeJson(request) {
  if ((request.headers.get("content-type") || "").includes("application/json")) {
    return readJson(request);
  }
  return {};
}

function normalizeEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : "";
}

function cleanText(value, max) {
  if (value == null) return null;
  const text = String(value).replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return text ? text.slice(0, max) : null;
}

async function hashPassword(password, salt) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(password)),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: PASSWORD_HASH_ITERATIONS, hash: "SHA-256" },
    material,
    256
  );
  return hex(new Uint8Array(bits));
}

async function verifyPassword(password, salt, expected) {
  return timingSafeEqual(await hashPassword(password, salt), expected);
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return hex(new Uint8Array(digest));
}

async function ipHash(request, env) {
  const ip = request.headers.get("cf-connecting-ip") || "";
  const secret = String(env?.IP_HASH_SECRET || env?.ADMIN_SECRET || "");
  const salt = secret + ":" + String(request.cf?.colo || "") + ":" + String(request.headers.get("x-forwarded-proto") || "") + ":";
  return ip ? sha256(salt + ip) : "";
}

function trimPayload(value) {
  const jsonText = JSON.stringify(value || {});
  if (jsonText.length <= MAX_JSON_BYTES) return value || {};
  return { truncated: true, originalBytes: jsonText.length };
}

function isProductionRequest(request) {
  const hostname = new URL(request.url).hostname;
  return !["localhost", "127.0.0.1", "::1"].includes(hostname);
}

function randomToken(bytes) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return btoa(String.fromCharCode(...data)).replace(/[+/=]/g, "");
}

function ecId() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `EC-${code}`;
}

function readCookie(request, name) {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return "";
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...securityHeaders(),
      "content-type": "application/json; charset=utf-8"
    }
  });
}

function securityHeaders() {
  return {
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-frame-options": "DENY",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "cross-origin-opener-policy": "same-origin",
    "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'",
    "strict-transport-security": "max-age=31536000; includeSubDomains"
  };
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function hex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

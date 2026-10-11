// Applies migrations/0001_election_id.sql to an in-memory SQLite DB built from the OLD
// (pre-migration, main) schema with seeded rows, then asserts nothing was lost.
// Usage: node migration-test.mjs <old_schema.sql> <migration.sql>
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const [oldSchemaPath, migrationPath] = process.argv.slice(2);
const db = new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys = ON");
db.exec(readFileSync(oldSchemaPath, "utf8"));
db.exec(`
INSERT INTO users (id, ec_id, email, password_hash, password_salt, created_at, updated_at) VALUES
 ('u1','EC-1','a@x.com','h','s','2026-06-01T00:00:00Z','2026-06-01T00:00:00Z'),
 ('u2','EC-2','b@x.com','h','s','2026-06-02T00:00:00Z','2026-06-02T00:00:00Z');
INSERT INTO vote_intents (id, user_id, intent, state, age_range, city, sex, custom_candidate, created_at, updated_at) VALUES
 ('v1','u1','blue','CA','25-34','LA','f',NULL,'2026-06-01T00:00:00Z','2026-06-03T00:00:00Z'),
 ('v2','u2','red','TX',NULL,NULL,NULL,'Someone','2026-06-02T00:00:00Z','2026-06-02T00:00:00Z');
INSERT INTO vote_intent_history (id, user_id, previous_intent, new_intent, previous_state, new_state, previous_payload_json, new_payload_json, changed_at) VALUES
 ('h1','u1',NULL,'red',NULL,'CA','null','{}','2026-06-01T00:00:00Z'),
 ('h2','u1','red','blue','CA','CA','{}','{}','2026-06-03T00:00:00Z');
`);

const cols = "id,user_id,intent,state,age_range,city,sex,custom_candidate,created_at,updated_at";
const before = db.prepare(`SELECT ${cols} FROM vote_intents ORDER BY id`).all();

// Control: the old schema really does reject a second intent for the same user.
assert.throws(
  () => db.exec("INSERT INTO vote_intents (id,user_id,intent,state,created_at,updated_at) VALUES ('x','u1','red','CA','t','t')"),
  /UNIQUE/, "control: old schema should reject a 2nd intent per user"
);

db.exec(readFileSync(migrationPath, "utf8"));

const after = db.prepare(`SELECT ${cols} FROM vote_intents ORDER BY id`).all();
assert.deepEqual(after, before, "every pre-migration column value is preserved");
const elections = db.prepare("SELECT DISTINCT election_id FROM vote_intents").all().map((r) => r.election_id);
assert.deepEqual(elections, ["midterm-2026"], "existing intents backfilled as midterm-2026");
const hist = db.prepare("SELECT id, election_id FROM vote_intent_history ORDER BY id").all();
assert.deepEqual(hist.map((r) => r.election_id), ["midterm-2026", "midterm-2026"], "history backfilled");

// New behaviour: same user can hold one intent per election, but not two for the same election.
db.exec("INSERT INTO vote_intents (id,user_id,election_id,intent,state,created_at,updated_at) VALUES ('v3','u1','presidential-2028','red','CA','t','t')");
assert.throws(
  () => db.exec("INSERT INTO vote_intents (id,user_id,election_id,intent,state,created_at,updated_at) VALUES ('v4','u1','midterm-2026','red','CA','t','t')"),
  /UNIQUE/, "duplicate (user, election) rejected"
);
assert.throws(
  () => db.exec("INSERT INTO vote_intents (id,user_id,election_id,intent,state,created_at,updated_at) VALUES ('v5','u2','presidential-2028','purple','TX','t','t')"),
  /CHECK/, "intent CHECK constraint kept"
);
const u1 = db.prepare("SELECT election_id, intent FROM vote_intents WHERE user_id='u1' ORDER BY election_id").all();
assert.deepEqual(u1.map((r) => [r.election_id, r.intent]), [["midterm-2026", "blue"], ["presidential-2028", "red"]], "u1 keeps both answers");

const idx = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_vote%' ORDER BY name").all().map((r) => r.name);
for (const name of ["idx_vote_intents_election_intent", "idx_vote_intents_election_state", "idx_vote_intents_election_age", "idx_vote_intent_history_user_election"]) {
  assert.ok(idx.includes(name), `index ${name} exists`);
}
const plan = db.prepare("EXPLAIN QUERY PLAN SELECT intent, COUNT(*) FROM vote_intents WHERE election_id = ? GROUP BY intent").all("midterm-2026");
assert.ok(plan.some((p) => /idx_vote_intents_election_intent/.test(p.detail)), "stats query uses the election index");

console.log("rows before:", before.length, "after:", after.length);
console.log("indexes:", idx.join(", "));
console.log("stats plan:", plan.map((p) => p.detail).join(" | "));
console.log("MIGRATION TEST PASSED (9 assertions + 1 control)");

// Nightly job: roll up yesterday (UTC) into daily_rollups and dump the raw data to R2
// as gzipped NDJSON under daily/YYYY-MM-DD/. No public HTTP surface.
import { computeDailyRollup, buildDailyDump, previousUtcDay } from "../../../lib/analytics.js";

async function gzip(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).arrayBuffer();
}

export async function runNightly(env, scheduledTime) {
  // NIGHTLY_DAY_OFFSET: 1 = yesterday (default); 0 = today so far; N = re-run N days back.
  const offset = Number(env.NIGHTLY_DAY_OFFSET ?? 1);
  const day = previousUtcDay(scheduledTime - (offset - 1) * 24 * 60 * 60 * 1000);
  const rollup = await computeDailyRollup(env.DB, day);
  const dump = await buildDailyDump(env.DB, day);
  const prefix = `daily/${day}/`;
  for (const [name, text] of Object.entries(dump.files)) {
    await env.EXPORTS.put(prefix + name + ".gz", await gzip(text), {
      httpMetadata: { contentType: "application/x-ndjson", contentEncoding: "gzip" }
    });
  }
  const manifest = { day, generatedAt: new Date().toISOString(), counts: dump.counts, rollupRows: rollup.length };
  await env.EXPORTS.put(prefix + "manifest.json", JSON.stringify(manifest, null, 2), {
    httpMetadata: { contentType: "application/json" }
  });
  return manifest;
}

export default {
  async scheduled(event, env, ctx) {
    const manifest = await runNightly(env, event.scheduledTime);
    console.log("nightly done", JSON.stringify(manifest));
  },
  async fetch() {
    return new Response("Not found", { status: 404 });
  }
};

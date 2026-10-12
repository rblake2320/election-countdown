import { canonicalRedirect } from "../lib/canonical.js";

export async function onRequest({ request, env, next }) {
  const target = canonicalRedirect(request.url, request.method, env);
  return target ? Response.redirect(target, 301) : next();
}

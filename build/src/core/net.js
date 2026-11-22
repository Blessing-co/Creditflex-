/* Network layer: timeouts, retries, friendly error messages. */
const CF_NET = { read: 20000, write: 45000, upload: 90000, retries: 2, backoff: 400 };
const cfSleep = ms => new Promise(r => setTimeout(r, ms));
async function cfFetch(url, opts) {
  opts = opts || {};
  const method = String(opts.method || "GET").toUpperCase(), isRead = method === "GET" || method === "HEAD";
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw new TypeError("Failed to fetch (offline)");
  const limit = isRead ? CF_NET.read : (String(url).includes("/storage/v1/") ? CF_NET.upload : CF_NET.write);
  const tries = isRead ? CF_NET.retries + 1 : 1;
  let last;
  for (let i = 0; i < tries; i++) {
    const ctl = new AbortController(); let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctl.abort(); }, limit);
    const outer = opts.signal, fwd = () => ctl.abort();
    if (outer) { if (outer.aborted) ctl.abort(); else outer.addEventListener("abort", fwd, { once: true }); }
    try {
      const res = await fetch(url, { ...opts, signal: ctl.signal });
      clearTimeout(timer);
      if (isRead && res.status >= 500 && i < tries - 1) { await cfSleep(CF_NET.backoff * 2 ** i); continue; }
      return res;
    } catch (e) {
      clearTimeout(timer);
      if (outer && outer.aborted) throw e;
      last = timedOut ? new TypeError("Failed to fetch: the server took too long (timeout)") : e;
      if (isRead && i < tries - 1) { await cfSleep(CF_NET.backoff * 2 ** i); continue; }
    } finally { if (outer) outer.removeEventListener("abort", fwd); }
  }
  throw last;
}
/* Turn any error into a short message a customer-facing agent can understand. */
function cfErr(e) {
  if (!e) return "";
  const m = String(e.message || e), c = String(e.code || ""), n = String(e.name || "");
  if (/failed to fetch|networkerror|network request failed|load failed|timeout|offline/i.test(m)) return "Cannot reach the server. Check your internet and try again.";
  if (/jwt|token.*expired|not authenticated/i.test(m)) return "Your session has expired. Please sign out and sign in again.";
  if (c === "P0001" || /^(Auth|Storage)/.test(n)) return m;
  if (c === "42501" || /row-level security|permission denied/i.test(m)) return "You do not have permission to do that.";
  if (c === "23505") return "That already exists.";
  if (c === "23503") return "That item is linked to other records or no longer exists.";
  if (["23514", "23502", "22P02", "22003", "22007"].includes(c)) return "One of the values is not allowed. Check it and try again.";
  console.warn("Unexpected error", e);
  return "Something went wrong. Please try again, and call us if it keeps happening.";
}

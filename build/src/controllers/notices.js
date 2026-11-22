/* Creditflex announcements: admin writes a message to all agents (or one agent); agents see a bell with a count and an inbox. */
(function () {
"use strict";
const ago = iso => { const m = Math.round((Date.now() - new Date(iso)) / 60000); if (m < 1) return "just now"; if (m < 60) return m + " min ago"; const h = Math.round(m / 60); if (h < 24) return h + " h ago"; return new Date(iso).toLocaleDateString(); };

async function loadNotices() {
  const a = await Announcements.listMine();
  const r = await Announcements.myReads(S.me.id);
  const seen = new Set((r.data || []).map(x => String(x.announcement_id)));
  return { list: a.data || [], seen, error: a.error, stale: a.stale };
}

/* bell badge in the header (agents only) */
window.cfBellRefresh = async function () {
  const b = document.getElementById("bellBadge"); if (!b || !S.me) return;
  try { const { list, seen } = await loadNotices(); const n = list.filter(x => !seen.has(String(x.id))).length; b.textContent = n > 9 ? "9+" : String(n); b.classList.toggle("hidden", n === 0); const btn = document.getElementById("bellBtn"); if (btn) btn.setAttribute("aria-label", n ? n + " new announcements" : "Announcements"); } catch (e) {}
};
setInterval(() => { if (!document.hidden && window.cfBellRefresh) window.cfBellRefresh(); }, 300000);
document.addEventListener("visibilitychange", () => { if (!document.hidden && window.cfBellRefresh) window.cfBellRefresh(); });


/* ---- phone notifications (Web Push). Works when the app is closed. iPhone needs the app added to the Home Screen first. ---- */
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const u8 = s => { const p = "=".repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(r, c => c.charCodeAt(0)); };
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function pushReg() { return Promise.race([navigator.serviceWorker.ready, new Promise((_, rej) => setTimeout(() => rej(Error("The app is still getting ready. Try again in a moment.")), 4000))]); }
async function pushCurrent() { try { const r = await pushReg(); return await r.pushManager.getSubscription(); } catch (e) { return null; } }
window.cfPushEnable = async function () {
  if (!pushSupported()) throw Error(isIOS && !standalone() ? "On iPhone, first tap Share, then Add to Home Screen, and open Creditflex from the new icon." : "This browser does not support notifications.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw Error("Notifications are blocked. Allow them in your phone or browser settings for this app.");
  const k = await Announcements.pushKey();
  const key = k.data && k.data.key; if (!key) throw Error("Notifications are not ready yet. Try again in a minute.");
  const reg = await pushReg();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(key) });
  const j = sub.toJSON();
  const { error } = await Announcements.saveSubscription(j.endpoint, j.keys.p256dh, j.keys.auth, navigator.userAgent);
  if (error) throw error;
  try { localStorage.setItem("cf-push-on", "1"); } catch (e) {}
};
window.cfPushDisable = async function () {
  const sub = await pushCurrent();
  if (sub) { try { await Announcements.removeSubscription(sub.endpoint); } catch (e) {} try { await sub.unsubscribe(); } catch (e) {} }
  try { localStorage.removeItem("cf-push-on"); } catch (e) {}
};
/* called when someone signs out so the next person on this phone does not receive their messages */
window.cfPushSignOutCleanup = async function () { try { if (localStorage.getItem("cf-push-on")) await cfPushDisable(); } catch (e) {} };
window.cfPushSlot = async function (id) {
  const el = document.getElementById(id); if (!el) return;
  if (S.me.role === "admin") return;
  const sub = pushSupported() ? await pushCurrent().catch(() => null) : null, on = !!sub && Notification.permission === "granted";
  if (!document.getElementById(id)) return;
  const hint = isIOS && !standalone() ? `<p class="${C.mute}">On iPhone: tap Share, then Add to Home Screen, and open Creditflex from that icon. Then turn notifications on here.</p>` : "";
  const el2 = document.getElementById(id); if (!el2) return;
  el2.innerHTML = `<p class="${C.mute}">${on ? "Notifications are on. You will get a message on this phone when the admin sends an announcement, even when the app is closed." : "Get a message on this phone when the admin sends an announcement, even when the app is closed."}</p>${hint}<button id="${id}-btn" type="button" class="${C.btn2} w-full">${ic("notifications", "text-[20px]")}<span>${on ? "Turn off notifications" : "Turn on notifications"}</span></button><div id="${id}-msg"></div>`;
  document.getElementById(id + "-btn").onclick = async () => { const b = document.getElementById(id + "-btn"); busy(b, true); try { if (on) await cfPushDisable(); else await cfPushEnable(); } catch (e) { busy(b, false); return say(id + "-msg", e.message || cfErr(e)); } cfPushSlot(id); };
};

/* agent inbox */
window.viewCreditflexInbox = async function () {
  const v = $("view"); v.innerHTML = `<h1 class="${C.h1}">Announcements</h1>${loading}`;
  const { list, seen, error, stale } = await loadNotices();
  if (error) return v.innerHTML = `<h1 class="${C.h1}">Announcements</h1><div class="bg-error-container text-on-error-container rounded-xl p-4 text-label-lg">${esc(cfErr(error))}</div>`;
  v.innerHTML = `<h1 class="${C.h1}">Announcements</h1>${cfStaleNote(stale)}<section class="${C.card} space-y-2"><h2 class="text-title-md">Notifications</h2><div id="inbox-push"></div></section>` + (list.length ? list.map(x => { const fresh = !seen.has(String(x.id)); return `<section class="${C.card} space-y-1 ${fresh ? "border-l-4 border-primary" : ""}"><div class="flex items-start justify-between gap-2"><b class="text-body-lg">${esc(x.title)}</b>${fresh ? `<span class="text-label-md rounded-full px-2.5 py-0.5 bg-primary-fixed text-on-primary-fixed shrink-0">New</span>` : ""}</div><p class="text-body-md whitespace-pre-wrap break-words">${esc(x.body)}</p><p class="${C.mute}">${esc(ago(x.created_at))}${x.audience_agent_id ? " · just for you" : ""}</p></section>`; }).join("") : `<div class="${C.card} text-center ${C.mute}">No announcements yet.</div>`);
  cfPushSlot("inbox-push");
  const fresh = list.filter(x => !seen.has(String(x.id)));
  if (fresh.length && navigator.onLine) { try { await Announcements.markRead(fresh.map(x => x.id), S.me.id); } catch (e) {} const b = document.getElementById("bellBadge"); if (b) b.classList.add("hidden"); }
};

/* admin: write and manage announcements */
window.viewCreditflexAnnounce = async function () {
  if (S.me.role !== "admin") { return go("collections"); }
  const v = $("view"); v.innerHTML = `<h1 class="${C.h1}">Announcements</h1>${loading}`;
  const [ag, an, rd] = await Promise.all([
    Staff.activeAgents(),
    Announcements.listSent(),
    Announcements.allReads()
  ]);
  const agents = ag.data || [], list = an.data || [], reads = rd.data || [];
  const nameOf = id => (agents.find(a => a.id === id) || {}).full_name || "one agent";
  v.innerHTML = `<h1 class="${C.h1}">Announcements</h1>
  <section class="${C.card} space-y-3"><p class="${C.mute}">Write a message your agents will see when they open the app. A bell with a number shows on their screen until they read it.</p>
    <form id="an-f" class="space-y-3">
      <div><label class="${C.lbl}" for="an-t">Title</label><input id="an-t" class="${C.inp}" maxlength="80" required placeholder="e.g. New price list"></div>
      <div><label class="${C.lbl}" for="an-b">Message</label><textarea id="an-b" class="${C.inp}" rows="4" maxlength="600" required placeholder="Write your message"></textarea><div id="an-c" class="${C.mute} text-right">0 / 600</div></div>
      <div><label class="${C.lbl}" for="an-a">Send to</label><select id="an-a" class="${C.inp}"><option value="">All agents</option>${agents.map(a => `<option value="${esc(a.id)}">${esc(a.full_name)} only</option>`).join("")}</select></div>
      <button class="${C.btn}" id="an-s">${ic("send", "text-[22px]")}<span>Send announcement</span></button><div id="an-m"></div>
    </form></section>
  <h2 class="text-title-md px-1">Sent</h2>` + (list.length ? list.map(x => { const n = reads.filter(r => r.announcement_id === x.id).length, total = x.audience_agent_id ? 1 : agents.length;
    return `<section class="${C.card} space-y-1"><div class="flex items-start justify-between gap-2"><b class="text-body-lg">${esc(x.title)}</b><button type="button" data-arch="${x.id}" class="text-label-md text-error min-h-[40px] px-2">Remove</button></div><p class="text-body-md whitespace-pre-wrap break-words">${esc(x.body)}</p><p class="${C.mute}">${esc(ago(x.created_at))} · ${x.audience_agent_id ? esc(nameOf(x.audience_agent_id)) : "All agents"} · read by ${n} of ${total}</p></section>`; }).join("") : `<div class="${C.card} text-center ${C.mute}">Nothing sent yet.</div>`);
  $("an-b").oninput = () => { $("an-c").textContent = $("an-b").value.length + " / 600"; };
  $("an-f").onsubmit = async e => {
    e.preventDefault(); const b = $("an-s"); busy(b, true);
    const row = { title: $("an-t").value.trim(), body: $("an-b").value.trim(), audience_agent_id: $("an-a").value || null, created_by: S.me.id };
    const ins = await Announcements.send(row);
    if (ins.error) { busy(b, false); return say("an-m", cfErr(ins.error)); }
    let note = "Announcement sent. Agents will see it when they open the app.";
    try { const r = await Announcements.pushSend(ins.data && ins.data.id); const d = r.data || {}; if (d.ok) note = d.devices ? "Announcement sent. Phone notification delivered to " + d.sent + " of " + d.devices + " phones." : "Announcement sent. No agent has turned on phone notifications yet, so they will see it when they open the app."; } catch (e) {}
    busy(b, false);
    await viewCreditflexAnnounce(); say("an-m", note, true);
  };
  v.querySelectorAll("[data-arch]").forEach(b => b.onclick = async () => {
    if (!confirm("Remove this announcement for everyone?")) return;
    const { error } = await Announcements.archive(Number(b.dataset.arch));
    if (error) return alert(cfErr(error)); viewCreditflexAnnounce();
  });
};
})();

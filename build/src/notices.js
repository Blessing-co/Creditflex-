/* Creditflex announcements: admin writes a message to all agents (or one agent); agents see a bell with a count and an inbox. */
(function () {
"use strict";
const ago = iso => { const m = Math.round((Date.now() - new Date(iso)) / 60000); if (m < 1) return "just now"; if (m < 60) return m + " min ago"; const h = Math.round(m / 60); if (h < 24) return h + " h ago"; return new Date(iso).toLocaleDateString(); };

async function loadNotices() {
  const a = await cfRead("notices", () => sb.from("announcements").select("id,title,body,created_at,audience_agent_id").is("archived_at", null).order("created_at", { ascending: false }).limit(40));
  const r = await cfRead("notice-reads", () => sb.from("announcement_reads").select("announcement_id").eq("staff_id", S.me.id));
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

/* agent inbox */
window.viewCreditflexInbox = async function () {
  const v = $("view"); v.innerHTML = `<h1 class="${C.h1}">Announcements</h1>${loading}`;
  const { list, seen, error, stale } = await loadNotices();
  if (error) return v.innerHTML = `<h1 class="${C.h1}">Announcements</h1><div class="bg-error-container text-on-error-container rounded-xl p-4 text-label-lg">${esc(cfErr(error))}</div>`;
  v.innerHTML = `<h1 class="${C.h1}">Announcements</h1>${cfStaleNote(stale)}` + (list.length ? list.map(x => { const fresh = !seen.has(String(x.id)); return `<section class="${C.card} space-y-1 ${fresh ? "border-l-4 border-primary" : ""}"><div class="flex items-start justify-between gap-2"><b class="text-body-lg">${esc(x.title)}</b>${fresh ? `<span class="text-label-md rounded-full px-2.5 py-0.5 bg-primary-fixed text-on-primary-fixed shrink-0">New</span>` : ""}</div><p class="text-body-md whitespace-pre-wrap break-words">${esc(x.body)}</p><p class="${C.mute}">${esc(ago(x.created_at))}${x.audience_agent_id ? " · just for you" : ""}</p></section>`; }).join("") : `<div class="${C.card} text-center ${C.mute}">No announcements yet.</div>`);
  const fresh = list.filter(x => !seen.has(String(x.id)));
  if (fresh.length && navigator.onLine) { try { await sb.from("announcement_reads").upsert(fresh.map(x => ({ announcement_id: x.id, staff_id: S.me.id })), { onConflict: "announcement_id,staff_id", ignoreDuplicates: true }); } catch (e) {} const b = document.getElementById("bellBadge"); if (b) b.classList.add("hidden"); }
};

/* admin: write and manage announcements */
window.viewCreditflexAnnounce = async function () {
  if (S.me.role !== "admin") { S.tab = "collections"; return renderShell(); }
  const v = $("view"); v.innerHTML = `<h1 class="${C.h1}">Announcements</h1>${loading}`;
  const [ag, an, rd] = await Promise.all([
    sb.from("staff").select("id,full_name").eq("role", "agent").eq("status", "active").order("full_name"),
    sb.from("announcements").select("id,title,body,created_at,audience_agent_id").is("archived_at", null).order("created_at", { ascending: false }).limit(30),
    sb.from("announcement_reads").select("announcement_id,staff_id")
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
    const { error } = await sb.from("announcements").insert(row);
    busy(b, false);
    if (error) return say("an-m", cfErr(error));
    await viewCreditflexAnnounce(); say("an-m", "Announcement sent.", true);
  };
  v.querySelectorAll("[data-arch]").forEach(b => b.onclick = async () => {
    if (!confirm("Remove this announcement for everyone?")) return;
    const { error } = await sb.from("announcements").update({ archived_at: new Date().toISOString() }).eq("id", Number(b.dataset.arch));
    if (error) return alert(cfErr(error)); viewCreditflexAnnounce();
  });
};
})();

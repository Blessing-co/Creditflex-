/* CONTROLLER: Report a problem (everyone) and Problem reports (admin). */
(function () {
"use strict";
const when = iso => new Date(iso).toLocaleString();

window.viewCreditflexReport = async function () {
  const v = $("view");
  v.innerHTML = `<h1 class="${C.h1}">Report a problem</h1>
  <section class="${C.card} space-y-3"><p class="${C.mute}">Something not working, confusing or slow? Tell us what you were doing and what happened. We add your phone model, the app version and recent error messages to help fix it. We never send passwords or customer details.</p>
    <form id="rp-f" class="space-y-3"><div><label class="${C.lbl}" for="rp-m">What went wrong?</label><textarea id="rp-m" class="${C.inp}" rows="5" maxlength="1000" required placeholder="Example: I tapped Save payment and it kept loading"></textarea><div id="rp-c" class="${C.mute} text-right">0 / 1000</div></div>
    <button class="${C.btn}" id="rp-s">${ic("send", "text-[22px]")}<span>Send report</span></button><div id="rp-msg"></div></form></section>
  <div id="rp-mine"></div>`;
  $("rp-m").oninput = () => { $("rp-c").textContent = $("rp-m").value.length + " / 1000"; };
  $("rp-f").onsubmit = async e => {
    e.preventDefault(); const b = $("rp-s"); busy(b, true);
    const { error } = await Reports.send({ reporter_id: S.me.id, message: $("rp-m").value.trim(), page: String(S.tab).slice(0, 60), user_agent: navigator.userAgent.slice(0, 300), app_build: APP_BUILD, recent_errors: CF_ERRORS.join("\n").slice(0, 2000) || null });
    busy(b, false);
    if (error) return say("rp-msg", navigator.onLine ? cfErr(error) : "No internet. Your text is still here. Try again when you are online.");
    $("rp-f").reset(); $("rp-c").textContent = "0 / 1000"; say("rp-msg", "Thank you. Your report was sent.", true); mine();
  };
  async function mine() {
    const r = await Reports.mine(S.me.id); const box = $("rp-mine"); if (!box || r.error || !(r.data || []).length) return;
    box.innerHTML = `<h2 class="text-title-md px-1">Your recent reports</h2>` + r.data.map(x => `<section class="${C.card} space-y-1"><p class="text-body-md whitespace-pre-wrap break-words">${esc(x.message)}</p><p class="${C.mute}">${esc(when(x.created_at))} · ${x.status === "done" ? "Fixed or answered" : "Waiting"}</p></section>`).join("");
  }
  mine();
};

window.viewCreditflexReports = async function () {
  if (S.me.role !== "admin") return go("collections");
  const v = $("view"); v.innerHTML = `<h1 class="${C.h1}">Problem reports</h1>${loading}`;
  const [rp, st] = await Promise.all([Reports.all(), Staff.names()]);
  if (rp.error) return v.innerHTML = `<h1 class="${C.h1}">Problem reports</h1><div class="bg-error-container text-on-error-container rounded-xl p-4 text-label-lg">${esc(cfErr(rp.error))}</div>`;
  const names = {}; (st.data || []).forEach(s => names[s.id] = s.full_name);
  const list = rp.data || [];
  v.innerHTML = `<h1 class="${C.h1}">Problem reports</h1>` + (list.length ? list.map(x => `<section class="${C.card} space-y-2 ${x.status === "new" ? "border-l-4 border-primary" : "opacity-80"}">
    <div class="flex items-start justify-between gap-2"><b class="text-body-lg">${esc(names[x.reporter_id] || "Agent")}</b><span class="text-label-md rounded-full px-2.5 py-0.5 ${x.status === "new" ? "bg-primary-fixed text-on-primary-fixed" : "bg-surface-container-high"}">${x.status === "new" ? "New" : "Done"}</span></div>
    <p class="text-body-md whitespace-pre-wrap break-words">${esc(x.message)}</p>
    <p class="${C.mute}">${esc(when(x.created_at))} · page: ${esc(x.page || "?")} · build ${esc(x.app_build || "?")}</p>
    <details><summary class="text-label-md text-primary min-h-[40px] flex items-center">Phone and error details</summary><p class="${C.mute} break-words">${esc(x.user_agent || "")}</p>${x.recent_errors ? `<pre class="text-[12px] whitespace-pre-wrap break-words bg-surface-container-high rounded-lg p-2 mt-1">${esc(x.recent_errors)}</pre>` : `<p class="${C.mute}">No error messages were recorded.</p>`}</details>
    <button type="button" data-st="${x.id}" data-to="${x.status === "new" ? "done" : "new"}" class="${C.btn2}">${x.status === "new" ? "Mark as done" : "Reopen"}</button></section>`).join("") : `<div class="${C.card} text-center ${C.mute}">No reports yet.</div>`);
  v.querySelectorAll("[data-st]").forEach(b => b.onclick = async () => { busy(b, true); const { error } = await Reports.setStatus(Number(b.dataset.st), b.dataset.to); if (error) { busy(b, false); return alert(cfErr(error)); } viewCreditflexReports(); });
};
})();

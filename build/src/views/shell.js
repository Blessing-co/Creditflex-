/* VIEW: the page frame: header, bell, Menu button and menu, Back bar, and the area where the current page is drawn. */
function renderShell() {
  syncHistory();
  if (window.cfIdleStart) cfIdleStart();
  const admin = S.me.role === "admin";
  const items = menuRoutes(admin).map(([k, r]) => [k, r.label, r.icon]), par = parentOf(S.tab), cur = par || S.tab;
  const row = ([k, l, i]) => { const on = cur === k; return `<button data-t="${k}" type="button" role="menuitem" class="w-full flex items-center gap-3 px-4 min-h-[48px] text-left ${on ? "bg-primary-fixed text-on-primary-fixed font-extrabold" : "text-on-surface font-semibold"} active:bg-surface-container-high">${ic(i, "text-[22px] " + (on ? "fill" : ""))}<span class="text-label-lg">${l}</span></button>`; };
  $app.innerHTML = `
  <header class="fixed top-0 inset-x-0 z-50 bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
    <div class="h-16 max-w-2xl mx-auto px-4 flex items-center justify-between gap-2 relative">
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shrink-0">${ic("payments", "fill text-[22px]")}</div>
        <div class="min-w-0 leading-tight"><div class="text-label-lg text-on-surface">Creditflex</div><div class="text-label-md text-on-surface-variant truncate">${esc(S.me.full_name)} · ${esc(S.me.role)}</div></div>
      </div>
      <div class="flex items-center gap-2">${admin ? "" : `<button id="bellBtn" type="button" aria-label="Announcements" class="relative min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-surface-container-high text-on-surface active:scale-95">${ic("notifications", "text-[24px]")}<span id="bellBadge" class="hidden absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-error text-on-error text-[11px] font-bold leading-[18px] text-center"></span></button>`}
      <button id="menuBtn" type="button" aria-haspopup="true" aria-expanded="false" aria-label="Open menu" class="min-h-[48px] min-w-[48px] px-3 flex items-center justify-center gap-1 rounded-xl bg-primary-fixed text-on-primary-fixed active:scale-95">${ic("menu", "text-[24px]")}<span class="text-label-md">Menu</span></button></div>
      <nav id="menuPanel" role="menu" class="hidden absolute right-4 top-[60px] w-64 max-w-[calc(100vw-2rem)] max-h-[75vh] overflow-y-auto rounded-2xl bg-surface shadow-xl border border-outline-variant/50 py-2 z-50">
        ${items.map(row).join("")}
        <div class="my-1 border-t border-outline-variant/50"></div>
        <button id="lo" class="w-full flex items-center gap-3 px-4 min-h-[48px] text-left text-error active:bg-error-container/50" type="button">${ic("logout", "text-[22px]")}<span class="text-label-lg">Sign out</span></button>
      </nav>
    </div>
  </header>
  <div id="backbar" class="max-w-2xl mx-auto px-4 pt-20"></div><main id="view" class="max-w-2xl mx-auto px-4 pt-2 pb-10 space-y-4"></main>`;
  if (par) { const pl = (ROUTES[par] || {}).label || "Back"; $("backbar").innerHTML = `<button id="back" type="button" class="min-h-[44px] flex items-center gap-1 text-label-lg text-primary">${ic("arrow_back", "text-[20px]")}<span>${pl}</span></button>`; $("back").onclick = () => goBack(par); } else $("backbar").style.paddingTop = "4.5rem";
  const panel = $("menuPanel"), mb = $("menuBtn");
  const close = () => { panel.classList.add("hidden"); mb.setAttribute("aria-expanded", "false"); };
  mb.onclick = e => { e.stopPropagation(); const open = panel.classList.toggle("hidden") === false; mb.setAttribute("aria-expanded", String(open)); };
  panel.onclick = e => e.stopPropagation();
  if (window.cfMenuClose) document.removeEventListener("click", window.cfMenuClose);
  window.cfMenuClose = close; document.addEventListener("click", close);
  $("lo").onclick = logout;
  if ($("bellBtn")) { $("bellBtn").onclick = () => go("inbox"); if (window.cfBellRefresh) cfBellRefresh(); }
  panel.querySelectorAll("button[data-t]").forEach(b => b.onclick = () => go(b.dataset.t));
  drawRoute();
}

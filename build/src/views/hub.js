/* VIEW: a hub page (Help, Manage): a list of links to the pages inside it. */
function viewHub(key) {
  const r = ROUTES[key];
  $("view").innerHTML = `<h1 class="${C.h1}">${r.label}</h1><section class="${C.card} divide-y divide-outline-variant/40">${r.hub.map(([k, l, i, d]) => `<button type="button" data-go="${k}" class="w-full flex items-center gap-3 py-3 text-left min-h-[56px] active:bg-surface-container-high">${ic(i, "text-[24px] text-primary")}<span class="min-w-0 flex-1"><span class="block text-label-lg">${l}</span><span class="block text-label-md text-on-surface-variant">${d}</span></span></button>`).join("")}</section>`;
  $("view").querySelectorAll("[data-go]").forEach(b => b.onclick = () => { const item = r.hub.find(x => x[0] === b.dataset.go); if (item && item[4]) return item[4](); go(b.dataset.go); });
}

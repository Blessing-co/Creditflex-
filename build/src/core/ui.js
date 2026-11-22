/* Small helpers every screen uses: formatting, icons, messages, buttons, CSV download. */
const money = n => "GH₵ " + Number(n || 0).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toLocaleDateString("en-CA");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = id => document.getElementById(id);
const ic = (n, cls = "") => `<span class="ms ${cls}" aria-hidden="true">${n}</span>`;
const initials = n => String(n || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0] || "").join("").toUpperCase();
const C = {
  h1: "text-headline-xl-mobile text-on-surface",
  card: "bg-surface-container-lowest rounded-xl p-4 shadow-sm",
  lbl: "block text-label-lg text-on-surface mb-1.5",
  inpBase: "w-full h-14 px-4 rounded-xl bg-surface text-on-surface shadow-inner focus:outline-none focus:ring-2 focus:ring-primary-container placeholder:text-on-surface-variant/60",
  inp: "w-full h-14 px-4 rounded-xl bg-surface text-on-surface text-body-lg shadow-inner focus:outline-none focus:ring-2 focus:ring-primary-container placeholder:text-on-surface-variant/60",
  btn: "w-full min-h-[54px] rounded-xl bg-primary-container text-on-primary text-label-lg flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] hover:bg-primary transition-all disabled:opacity-60",
  btn2: "min-h-[44px] px-4 rounded-xl bg-surface-container-high text-primary text-label-lg flex items-center justify-center gap-2 active:scale-95 transition-all",
  link: "min-h-[44px] px-2 text-primary-container text-label-lg underline",
  stat: "bg-surface-container-low rounded-xl p-3",
  mute: "text-body-md text-on-surface-variant"
};
const loading = `<div class="${C.card} ${C.mute} flex items-center gap-3"><span class="inline-block w-5 h-5 rounded-full border-2 border-primary-container border-t-transparent spin"></span>Loading…</div>`;
function cfBuzz() { try { if (localStorage.getItem("creditflex-buzz") !== "off" && navigator.vibrate) navigator.vibrate(60); } catch (e) {} }
function say(id, text, ok) {
  const el = $(id); if (!el) return;
  el.innerHTML = text ? (ok
    ? `<div class="bg-primary-container text-on-primary rounded-xl p-4 shadow-md flex items-start gap-3 mt-3">${ic("check_circle", "fill text-[24px] shrink-0")}<span class="text-label-lg flex-1">${esc(text)}</span></div>`
    : `<div class="bg-error-container text-on-error-container rounded-xl p-4 flex items-start gap-3 mt-3">${ic("error", "fill text-[22px] shrink-0")}<span class="text-label-lg flex-1">${esc(text)}</span></div>`) : "";
}
function busy(btn, on) {
  if (on) { btn._h = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="inline-block w-5 h-5 rounded-full border-2 border-current border-t-transparent spin"></span><span>Please wait…</span>`; }
  else { btn.disabled = false; if (btn._h != null) btn.innerHTML = btn._h; }
}

/* ---------- boot ---------- */
function cfCsvDownload(name, rows) {
  const cell = v => { let t = String(v ?? ""); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; };
  const body = rows.map(r => r.map(cell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff" + body], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/* Reads EVERY row, 1000 at a time (Supabase silently stops at 1000 per request). */
function cfStaleNote(at) { return at ? `<div class="bg-surface-container-high text-on-surface-variant rounded-xl px-3 py-2 text-label-md flex items-center gap-2">${ic("info", "text-[18px]")}<span>Saved copy from ${esc(new Date(at).toLocaleString())}. It updates when you are online.</span></div>` : ""; }

/* ---------- shell ---------- */
/* Menu: 7 tabs for agents, 8 for admin. Everything else lives one tap deeper in Help, Manage or Settings. */

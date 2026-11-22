/* Show/hide eye on every password box (sign-in, sign-up, new password, change password). Add data-noeye to opt out. */
function cfEyeAttach(inp) {
  if (inp.dataset.eye || inp.dataset.noeye) return;
  inp.dataset.eye = "1";
  const wrap = document.createElement("div"); wrap.className = "relative";
  inp.parentNode.insertBefore(wrap, inp); wrap.appendChild(inp); inp.classList.add("pr-12");
  const b = document.createElement("button");
  b.type = "button"; b.className = "cf-eye absolute right-1 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-on-surface-variant";
  b.setAttribute("aria-label", "Show password"); b.innerHTML = ic("visibility", "text-[22px]");
  b.onclick = () => {
    const show = inp.type === "password";
    inp.type = show ? "text" : "password";
    b.innerHTML = ic(show ? "visibility_off" : "visibility", "text-[22px]");
    b.setAttribute("aria-label", show ? "Hide password" : "Show password");
    inp.focus();
  };
  wrap.appendChild(b);
}
(function () {
  const scan = () => document.querySelectorAll("input[type=password]:not([data-eye]):not([data-noeye])").forEach(cfEyeAttach);
  const start = () => { scan(); new MutationObserver(scan).observe(document.body, { childList: true, subtree: true }); };
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();

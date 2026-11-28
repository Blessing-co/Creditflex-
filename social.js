/* "Continue with Google / Apple" on the sign-in page. Loaded after app.js.
   A button appears only when that provider is switched on in Supabase. */
(function () {
  const PROVIDERS = [["google", "Continue with Google"], ["apple", "Continue with Apple"]];
  let enabled = {};

  function draw() {
    const app = document.getElementById("app");
    const pass = app && app.querySelector('input[type="password"]');
    const on = PROVIDERS.filter(([id]) => enabled[id]);
    if (!pass || !on.length || document.getElementById("social") || (window.S && S.me)) return;
    const form = pass.closest("form");
    if (!form) return;
    const box = document.createElement("div");
    box.id = "social";
    box.className = "space-y-2 mt-3";
    on.forEach(([id, label]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = C.btn2 + " w-full";
      b.textContent = label;
      if (id === "google") {
        // Shows Google's official icon once it is saved as icons/google.svg
        const img = new Image(20, 20);
        img.alt = "";
        img.className = "inline-block align-middle mr-2";
        img.onload = () => b.prepend(img);
        img.src = "/icons/google.svg";
      }
      b.onclick = async () => {
        b.disabled = true;
        const { error } = await sb.auth.signInWithOAuth({ provider: id, options: { redirectTo: location.origin } });
        if (error) { b.disabled = false; msg.textContent = "Could not start sign-in. Please try again."; }
      };
      box.appendChild(b);
    });
    const msg = document.createElement("p");
    msg.className = "text-label-md text-error";
    box.appendChild(msg);
    form.after(box);
  }

  new MutationObserver(draw).observe(document.getElementById("app"), { childList: true, subtree: true });

  fetch(sb.supabaseUrl + "/auth/v1/settings", { headers: { apikey: sb.supabaseKey } })
    .then(r => r.json())
    .then(s => { enabled = s.external || {}; draw(); })
    .catch(() => {});
})();

/* VIEW: sign-in, new password and blocked-account screens. */
function brand() {
  return `<div class="flex items-center gap-3"><div class="w-12 h-12 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shadow-md">${ic("payments", "fill text-[26px]")}</div><div class="leading-tight"><div class="text-headline-lg text-on-surface">Creditflex</div><div class="text-label-md text-on-surface-variant uppercase">Agent portal</div></div></div>`;
}
function renderLogin(note) {
  $app.innerHTML = `
  <main class="min-h-screen max-w-md mx-auto px-4 py-8 flex flex-col justify-center gap-6">
    ${brand()}
    <section class="${C.card} p-5 shadow-lg">
      <h1 class="text-headline-lg-mobile text-on-surface">Creditflex Agents</h1>
      <p class="${C.mute} mt-1 mb-4">${S.signup ? "Create your staff account. An admin must approve it before you can log in." : "Sign in with your staff email and password."}</p>
      <form id="authForm" class="space-y-3.5">
        ${S.signup ? `<div><label class="${C.lbl}" for="fn">Full name</label><input id="fn" class="${C.inp}" required minlength="2" autocomplete="name"></div>
        <div><label class="${C.lbl}" for="ph">Phone</label><input id="ph" class="${C.inp}" inputmode="tel" autocomplete="tel"></div>` : ""}
        <div><label class="${C.lbl}" for="em">Email</label><input id="em" class="${C.inp}" type="email" autocomplete="email" required></div>
        <div><label class="${C.lbl}" for="pw">Password</label><input id="pw" class="${C.inp}" type="password" autocomplete="${S.signup ? "new-password" : "current-password"}" required minlength="8"></div>
        <button class="${C.btn}" id="authBtn">${S.signup ? "Sign up" : "Sign in"}</button>
      </form>
      <div id="authMsg">${note ? `<div class="bg-error-container text-on-error-container rounded-xl p-4 flex items-start gap-3 mt-3">${ic("error", "fill text-[22px] shrink-0")}<span class="text-label-lg flex-1">${esc(note)}</span></div>` : ""}</div>
      ${S.signup ? "" : `<div class="text-center -mt-1"><button class="${C.link}" id="fp" type="button">Forgot password?</button></div>`}
      <div class="text-center -mt-2"><button class="${C.link}" id="lg" type="button">Privacy &amp; terms</button></div>
      <div class="text-center mt-2"><button class="${C.link}" id="swap" type="button">${S.signup ? "I already have an account" : "New staff? Sign up"}</button></div>
    </section>
  </main>`;
  $("swap").onclick = () => { S.signup = !S.signup; renderLogin(); };
  $("lg").onclick = () => cfOpenLegal();
  if ($("fp")) $("fp").onclick = async () => {
    const email = $("em").value.trim();
    if (!email) return say("authMsg", "Type your email above first, then tap Forgot password.");
    const b = $("fp"); busy(b, true);
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    busy(b, false);
    if (error) return say("authMsg", error.message);
    say("authMsg", "If that email has an account, a reset link is on its way. Open it on this phone.", true);
  };
  $("authForm").onsubmit = async e => {
    e.preventDefault();
    const b = $("authBtn"); busy(b, true);
    const email = $("em").value.trim(), password = $("pw").value;
    if (S.signup) {
      const pwIssue = cfPwIssue(password);
      if (pwIssue) { busy(b, false); return say("authMsg", pwIssue); }
      const { error } = await sb.auth.signUp({ email, password, options: { data: { full_name: $("fn").value.trim(), phone: $("ph").value.trim() } } });
      busy(b, false);
      if (error) return say("authMsg", error.message);
      S.signup = false;
      return renderLogin("Account created. Ask an admin to approve it, then sign in.");
    }
    const { error } = await sb.auth.signInWithPassword({ email, password });
    busy(b, false);
    if (error) return say("authMsg", error.message);
    await loadMe();
  };
}
function renderNewPassword() {
  $app.innerHTML = `<main class="min-h-screen max-w-md mx-auto px-4 py-8 flex flex-col justify-center gap-6">${brand()}
    <section class="${C.card} p-5 shadow-lg">
      <h1 class="text-headline-lg-mobile text-on-surface">Choose a new password</h1>
      <p class="${C.mute} mt-1 mb-4">At least 6 characters.</p>
      <form id="npForm" class="space-y-3.5">
        <div><label class="${C.lbl}" for="np1">New password</label><input id="np1" class="${C.inp}" type="password" autocomplete="new-password" required minlength="8"></div>
        <div><label class="${C.lbl}" for="np2">Repeat password</label><input id="np2" class="${C.inp}" type="password" autocomplete="new-password" required minlength="8"></div>
        <button class="${C.btn}" id="npBtn">Save password</button>
      </form><div id="npMsg"></div>
    </section></main>`;
  $("npForm").onsubmit = async e => {
    e.preventDefault();
    if ($("np1").value !== $("np2").value) return say("npMsg", "The two passwords do not match.");
    { const pwIssue = cfPwIssue($("np1").value); if (pwIssue) return say("npMsg", pwIssue); }
    const b = $("npBtn"); busy(b, true);
    const { error } = await sb.auth.updateUser({ password: $("np1").value });
    busy(b, false);
    if (error) return say("npMsg", error.message);
    S.recovery = false; history.replaceState(null, "", location.pathname);
    await loadMe();
  };
}
function renderBlocked() {
  const pend = S.me.status === "pending";
  $app.innerHTML = `<main class="min-h-screen max-w-md mx-auto px-4 py-8 flex flex-col justify-center gap-6">${brand()}
    <section class="${C.card} p-6 text-center shadow-lg">
      <div class="w-16 h-16 mx-auto rounded-full ${pend ? "bg-tertiary-fixed text-on-tertiary-fixed" : "bg-error-container text-on-error-container"} flex items-center justify-center">${ic(pend ? "hourglass_top" : "block", "text-[32px]")}</div>
      <h1 class="text-headline-lg-mobile mt-4">${pend ? "Waiting for approval" : "Account disabled"}</h1>
      <p class="${C.mute} mt-1">${pend ? "An admin needs to approve your account before you can use the app." : "Please contact your admin."}</p>
      <button class="${C.btn2} w-full mt-5" id="lo" type="button">Sign out</button>
    </section></main>`;
  $("lo").onclick = () => logout();
}

/* ---------- password rules ---------- */

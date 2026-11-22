/* CONTROLLER: start-up, loading the signed-in person, sign-out. */
async function boot() {
  const { data: { session } } = await Auth.getSession();
  if (!session) { let m; try { m = HASHERR ? decodeURIComponent(HASHERR) + ". Tap Forgot password to get a new link." : undefined; } catch (e) {} if (HASHERR) history.replaceState(null, "", location.pathname); return renderLogin(m); }
  if (S.recovery) return renderNewPassword();
  await loadMe();
}
async function loadMe() {
  const { data: { user } } = await Auth.getUser();
  if (!user) return renderLogin();
  const { data, error } = await Staff.me(user.id);
  if (error || !data) { await Auth.signOut(); return renderLogin("Could not load your staff account."); }
  S.me = data;
  if (data.status !== "active") return renderBlocked();
  renderShell();
  if (data.role === "agent" && !data.onboarding_completed_at) setTimeout(() => startCreditflexTour(), 450);
  setTimeout(() => syncCreditflexOfflineQueue(), 700);
}
async function logout(note) { try { if (window.cfPushSignOutCleanup) await cfPushSignOutCleanup(); } catch (e) {} try { await Auth.signOut(); } catch (e) {} S.me = null; if (window.cfIdleStop) cfIdleStop(); renderLogin(typeof note === "string" ? note : undefined); }

/* ---------- auth screens ---------- */

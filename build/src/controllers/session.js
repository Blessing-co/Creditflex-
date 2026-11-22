/* CONTROLLER: start-up, loading the signed-in person, sign-out. */
async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { let m; try { m = HASHERR ? decodeURIComponent(HASHERR) + ". Tap Forgot password to get a new link." : undefined; } catch (e) {} if (HASHERR) history.replaceState(null, "", location.pathname); return renderLogin(m); }
  if (S.recovery) return renderNewPassword();
  await loadMe();
}
async function loadMe() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return renderLogin();
  const { data, error } = await sb.from("staff").select("id,full_name,email,phone,role,status,supervisor_id,onboarding_completed_at").eq("id", user.id).maybeSingle();
  if (error || !data) { await sb.auth.signOut(); return renderLogin("Could not load your staff account."); }
  S.me = data;
  if (data.status !== "active") return renderBlocked();
  renderShell();
  if (data.role === "agent" && !data.onboarding_completed_at) setTimeout(() => startCreditflexTour(), 450);
  setTimeout(() => syncCreditflexOfflineQueue(), 700);
}
async function logout(note) { try { if (window.cfPushSignOutCleanup) await cfPushSignOutCleanup(); } catch (e) {} try { await sb.auth.signOut(); } catch (e) {} S.me = null; if (window.cfIdleStop) cfIdleStop(); renderLogin(typeof note === "string" ? note : undefined); }

/* ---------- auth screens ---------- */

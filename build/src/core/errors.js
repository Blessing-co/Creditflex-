/* Remembers the last few error messages so "Report a problem" can attach them. Nothing is sent unless the person sends a report. */
const CF_ERRORS = [];
function cfPushErr(s) { CF_ERRORS.push(new Date().toISOString().slice(11, 19) + " " + String(s).slice(0, 200)); if (CF_ERRORS.length > 5) CF_ERRORS.shift(); }
window.addEventListener("error", e => cfPushErr((e.message || "error") + " @" + String(e.filename || "").split("/").pop() + ":" + (e.lineno || 0)));
window.addEventListener("unhandledrejection", e => cfPushErr("promise: " + String((e.reason && e.reason.message) || e.reason)));

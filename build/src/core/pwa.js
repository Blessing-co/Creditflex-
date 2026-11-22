/* Installable-app plumbing: icon font check and service worker registration. */
window.addEventListener("load", () => {
  try { document.fonts.load('24px "Material Symbols Outlined"', "payments").then(f => { if (f && f.length) document.documentElement.classList.add("icons"); }); } catch (e) {}
});
window.addEventListener("load",()=>{if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js").catch(e=>console.warn("Offline app shell unavailable",e));});

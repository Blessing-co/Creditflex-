/* Privacy notice and terms of use, shown as a page in the menu and as a pop-up on the sign-in screen. */
(function () {
"use strict";
const UPDATED = "18 November 2026";

const sec = (title, body, open) => `<details class="rounded-xl bg-surface-container-low px-3 py-2"${open ? " open" : ""}><summary class="font-bold cursor-pointer min-h-[40px] flex items-center">${title}</summary><div class="space-y-2 pb-2 text-body-md">${body}</div></details>`;
const p = t => `<p>${t}</p>`;
const ul = a => `<ul class="list-disc pl-5 space-y-1">${a.map(x => `<li>${x}</li>`).join("")}</ul>`;

window.cfLegalHtml = function () {
  const privacy = [
    sec("Who we are", p("Creditflex runs this app so its sales agents and managers can record instalment sales and the payments customers make. If you have a question about your information, call or WhatsApp <b>020 670 9055</b> or email <b>Blisscoenergy001@gmail.com</b>."), true),
    sec("What we keep", p("<b>About staff (agents and admins):</b>") + ul(["name, email address, phone number and role", "your password (kept scrambled by our login provider, so nobody can read it)", "sign-in records"]) + p("<b>About customers (recorded by agents):</b>") + ul(["name, phone number and location", "what they bought and the payment plan", "every payment: amount, date and which agent collected it", "the reason, if a payment was cancelled by the admin"])),
    sec("Why we use it", ul(["to record sales and instalment payments and show each customer's balance and statement", "to check that the cash agents collect matches what is recorded", "to prevent mistakes and fraud: every payment and cancellation is written in a log that cannot be edited", "to contact customers about their account"]) + p("We do not sell your information and we do not use it for advertising.")),
    sec("Who can see it", ul(["an <b>agent</b> sees only their own customers, purchases and payments", "a <b>supervisor</b> also sees the agents they look after", "the <b>admin</b> sees everything and is the only person who can cancel a payment"]) + p("Our service providers also handle data for us: <b>Supabase</b> (database and sign-in, servers in Ireland), <b>Vercel</b> (hosts the app), and <b>Google Fonts</b> and <b>jsDelivr</b> (load the text style and app code, so they can see your device's internet address). When staff share a statement, it goes through <b>WhatsApp</b> to the customer.")),
    sec("Saved on your phone", p("When there is no internet, payments wait on the phone until they can be sent. Customer balances you have looked at are also kept on the phone so you can work offline. You can clear this in <b>Settings</b>. Sign out on any phone that is not yours.")),
    sec("How long we keep it", p("Payment records are kept for as long as Creditflex needs them for its accounts and the law. For this reason a payment can never be deleted, only cancelled with a written reason. A customer or staff member can ask us to correct wrong details at any time.")),
    sec("Keeping it safe", p("The app uses a secure (HTTPS) connection, strict rules on who can see what, an admin-only cancel process and a permanent audit trail. No system is perfectly safe, so please keep your password private and tell us at once if you think someone else has used your account.")),
    sec("Your rights", p("Under Ghana's Data Protection Act, 2012 (Act 843) you can ask to see the information we hold about you, ask us to correct it, and object to how it is used. If you are not happy with our answer you can complain to the Data Protection Commission of Ghana. This app is not meant for anyone under 18.")),
  ].join("");
  const terms = [
    sec("Who may use the app", p("Only Creditflex staff whose account the admin has approved. The admin may switch off an account at any time."), true),
    sec("Your account", p("Keep your password to yourself. You are responsible for everything done with your account, so sign out on shared phones.")),
    sec("Recording money", ul(["Record a payment only when you have really received the money, and record it straight away with the right amount and date.", "Never record a payment you did not receive.", "If you make a mistake, tell the admin. Only the admin can cancel a payment, and every cancellation is kept in the log.", "False records may lead to disciplinary action and, where the law allows, legal action."])),
    sec("Customer information", p("Use customer details only for Creditflex business. Do not copy, share or sell them for any other reason.")),
    sec("Offline payments", p("A payment saved while offline is not recorded on the server until it has been sent. Keep the app and the phone safe until it syncs.")),
    sec("Availability", p("We work to keep the app running but cannot promise it will always be available. Keep your own cash notes if the app is down.")),
    sec("Breaking the rules", p("We may suspend or remove an account that breaks these terms. These terms are governed by the laws of Ghana.")),
  ].join("");
  return `<section class="${C.card} space-y-3"><h2 class="text-title-md">Privacy notice</h2><p class="${C.mute}">What information we keep, why, and who can see it. Last updated ${UPDATED}.</p><div class="space-y-2">${privacy}</div></section>
    <section class="${C.card} space-y-3"><h2 class="text-title-md">Terms of use</h2><p class="${C.mute}">The simple rules for using the app.</p><div class="space-y-2">${terms}</div></section>`;
};

window.viewCreditflexPrivacy = function () {
  $("view").innerHTML = `<h1 class="${C.h1}">Privacy &amp; terms</h1>` + cfLegalHtml();
};

/* pop-up version, used before signing in */
window.cfOpenLegal = function () {
  if (document.getElementById("cf-legal")) return;
  const d = document.createElement("div"); d.id = "cf-legal";
  d.style.cssText = "position:fixed;inset:0;z-index:1100;overflow-y:auto;-webkit-overflow-scrolling:touch";
  d.className = "bg-surface text-on-surface";
  d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-label", "Privacy and terms");
  d.innerHTML = `<div class="max-w-2xl mx-auto px-4 py-5 space-y-4"><div class="flex items-center justify-between gap-3"><h1 class="${C.h1}">Privacy &amp; terms</h1><button id="cf-legal-x" type="button" class="${C.btn2}">Close</button></div>${cfLegalHtml()}<button id="cf-legal-x2" type="button" class="${C.btn}">Close</button></div>`;
  document.body.appendChild(d); d.scrollTop = 0;
  const close = () => d.remove();
  d.querySelector("#cf-legal-x").onclick = close; d.querySelector("#cf-legal-x2").onclick = close;
};
})();

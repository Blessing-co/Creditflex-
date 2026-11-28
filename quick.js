/* Shortcuts to Record payment and Register customer on related pages. Loaded after app.js. */
(function () {
  const PAGES = {
    collections: ["pay", "new"], catalogue: ["pay", "new"],
    analytics: ["pay", "new"], inbox: ["pay", "new"],
    pay: ["new"], register: ["pay"]
  };
  const BUTTONS = {
    pay: ["payments", "Record payment", () => { S.selPurchase = null; go("pay"); }],
    new: ["person_add", "Register customer", () => { S.cmode = "new"; go("register"); }]
  };
  const original = renderShell;
  renderShell = function () {
    original();
    const keys = PAGES[S.tab], view = document.getElementById("view");
    if (!keys || !view) return;
    const bar = document.createElement("div");
    bar.id = "quick";
    bar.className = "max-w-2xl mx-auto px-4 pb-2 grid gap-2 " + (keys.length > 1 ? "grid-cols-2" : "grid-cols-1");
    keys.forEach(k => {
      const [icon, label, open] = BUTTONS[k];
      const b = document.createElement("button");
      b.type = "button";
      b.className = C.btn2;
      b.innerHTML = ic(icon, "text-[20px]") + "<span>" + label + "</span>";
      b.onclick = open;
      bar.appendChild(b);
    });
    view.before(bar);
  };
})();

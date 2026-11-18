// Draws the app icons from icon.svg. Run: node make-icons.js  (writes ../icons/*.png)
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
(async () => {
  const svg = fs.readFileSync(path.join(__dirname, "icon.svg"), "utf8");
  const out = path.join(__dirname, "..", "icons");
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "icon.svg"), svg);
  const browser = await chromium.launch(); const page = await browser.newPage();
  for (const [name, size] of [["icon-192", 192], ["icon-512", 512], ["icon-maskable-512", 512], ["apple-touch-icon", 180], ["favicon-32", 32]]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>html,body{margin:0;padding:0;overflow:hidden}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
    await page.screenshot({ path: path.join(out, name + ".png") });
  }
  await browser.close(); console.log("icons written to", out);
})();

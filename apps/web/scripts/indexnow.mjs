// Tells Bing (which ChatGPT search and Copilot draw on), Yandex, Seznam and other IndexNow engines
// that every page in the live sitemap is new or changed, so they recrawl it soon.
// Google doesn't use IndexNow; it reads the sitemap submitted in Search Console instead.
//
//   node scripts/indexnow.mjs            submits https://www.postcompass.cloud
//   node scripts/indexnow.mjs https://…   submits another deployment of the site
//
// The key is public by design: engines check it against /<key>.txt on the site before accepting a submission.

const KEY = "34c61c9df1cdd1d7e7e9475bd04bff06";
/* global process */
const site = (process.argv[2] ?? "https://www.postcompass.cloud").replace(/\/$/, "");
const host = new URL(site).host;

const keyFile = await fetch(`${site}/${KEY}.txt`);
if (!keyFile.ok || (await keyFile.text()).trim() !== KEY) {
  throw new Error(`${site}/${KEY}.txt isn't live yet; deploy the site first`);
}

const sitemap = await (await fetch(`${site}/sitemap.xml`)).text();
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
if (!urlList.length) throw new Error("No URLs found in the sitemap");

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host, key: KEY, keyLocation: `${site}/${KEY}.txt`, urlList }),
});

// 200 and 202 both mean accepted (202: the key is still being verified)
if (res.status !== 200 && res.status !== 202) {
  throw new Error(`IndexNow answered ${res.status}: ${await res.text()}`);
}
console.log(`IndexNow accepted ${urlList.length} URLs (HTTP ${res.status}):\n${urlList.join("\n")}`);

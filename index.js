import puppeteer from "puppeteer";

// এখানে চাইলে তুমি নিজের Google News URL default হিসেবে বসাতে পারো
const DEFAULT_GOOGLE_NEWS_URL ="https://news.google.com/rss/articles/CBMilgFBVV95cUxQTWpEMDRMWHpnWVlMLXlTOXlwODdvUnJqOGYtT25sVXRjdlA3UklidURqbVJST1JPbmFPbXk1UEx3d0FDbzdURHlmN0JrYVhjalZnMFdzUHdpbUF0THJJbC1HQl9OYUlXNm4zUmx0OF84Um95aEFUQ0QzUWFjTVVUV3o4M0FFeU80YWtScVFLMEx2b2tWV3c?oc=5"

// কোন কোন host কে ignore করব (এগুলো হলে এগুলোকে article ধরি না)
const BLOCKED_HOSTS = [
  "google.com",
  "news.google.com",
  "www.google.com",
  "gstatic.com",
  "cloudflare.com",
  "www.cloudflare.com",
  "challenges.cloudflare.com"
];

function isBlockedUrl(urlString) {
  try {
    const u = new URL(urlString);
    return BLOCKED_HOSTS.some(
      (h) => u.hostname === h || u.hostname.endsWith("." + h)
    );
  } catch {
    return true;
  }
}

// main IIFE
(async () => {
  const targetUrl = process.argv[2] || DEFAULT_GOOGLE_NEWS_URL;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    await page.goto(targetUrl, {
      waitUntil: "networkidle2",
      timeout: 30000
    });

    // JS redirect / iframe load হওয়ার জন্য একটু সময়
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const currentUrl = page.url();

    // 1) যদি সরাসরি non-google/non-cloudflare domain এ redirect হয়ে যায় → এইটাই article
    if (!isBlockedUrl(currentUrl)) {
      console.log(currentUrl);
      return;
    }

    // 2) নাহলে DOM থেকে canonical/iframe/anchor দেখে external URL বের করি
    const originalUrl = await page.evaluate(() => {
      const blockedHosts = [
        "google.com",
        "news.google.com",
        "www.google.com",
        "gstatic.com",
        "cloudflare.com",
        "www.cloudflare.com",
        "challenges.cloudflare.com"
      ];

      const isRealArticle = (url) => {
        try {
          const u = new URL(url);
          return !blockedHosts.some(
            (h) => u.hostname === h || u.hostname.endsWith("." + h)
          );
        } catch {
          return false;
        }
      };

      const candidates = [];

      // 1) canonical
      const canonical = document.querySelector('link[rel="canonical"]');
      if (canonical && canonical.href) {
        candidates.push(canonical.href);
      }

      // 2) og:url meta tags
      const ogMeta = document.querySelector('meta[property="og:url"], meta[name="og:url"]');
      if (ogMeta && (ogMeta.content || ogMeta.getAttribute("content"))) {
        candidates.push(ogMeta.content || ogMeta.getAttribute("content"));
      }

      // 3) সব iframe src
      const iframes = Array.from(document.querySelectorAll("iframe[src]"));
      for (const f of iframes) {
        candidates.push(f.src);
      }

      // 4) সব anchor href
      const anchors = Array.from(document.querySelectorAll('a[href^="http"]'));
      for (const a of anchors) {
        candidates.push(a.href);
      }

      const unique = [...new Set(candidates)];

      const found = unique.find((u) => isRealArticle(u));
      return found || null;
    });

    if (originalUrl && !isBlockedUrl(originalUrl)) {
      // ✅ শুধু article URL print
      console.log(originalUrl);
    } else {
      // আর কিছু পাওয়া না গেলে, যতটুকু পারি করি:
      // যদি currentUrl article না হয়, তবে error
      console.error(
        "Could not detect external article URL (only Google/Cloudflare or no external link found)."
      );
    }
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await browser.close();
  }
})();

// controller/resolveController.js
import puppeteer from "puppeteer";

const BLOCKED_HOSTS = [
  "google.com",
  "news.google.com",
  "www.google.com",
  "gstatic.com",
  "cloudflare.com",
  "www.cloudflare.com",
  "challenges.cloudflare.com",
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

// Puppeteer একবার launch করে সারা অ্যাপে reuse করব
const browserPromise = puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

// ভেতরের helper: আসল article URL resolve করার কাজ
async function resolveArticleUrl(targetUrl) {
  const browser = await browserPromise;
  const page = await browser.newPage();

  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    await page.goto(targetUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // JS redirect / iframe লোড হওয়ার জন্য একটু সময়
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const currentUrl = page.url();

    // 1) সরাসরি external domain হলে সেটাই article
    if (!isBlockedUrl(currentUrl)) {
      return currentUrl;
    }

    // 2) না হলে DOM থেকে article URL খুঁজে আনি
    const originalUrl = await page.evaluate(() => {
      const blockedHosts = [
        "google.com",
        "news.google.com",
        "www.google.com",
        "gstatic.com",
        "cloudflare.com",
        "www.cloudflare.com",
        "challenges.cloudflare.com",
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

      // 2) og:url meta
      const ogMeta = document.querySelector(
        'meta[property="og:url"], meta[name="og:url"]'
      );
      if (ogMeta && (ogMeta.content || ogMeta.getAttribute("content"))) {
        candidates.push(ogMeta.content || ogMeta.getAttribute("content"));
      }

      // 3) সব iframe src
      const iframes = Array.from(document.querySelectorAll("iframe[src]"));
      for (const f of iframes) {
        candidates.push(f.src);
      }

      // 4) সব anchor href
      const anchors = Array.from(
        document.querySelectorAll('a[href^="http"]')
      );
      for (const a of anchors) {
        candidates.push(a.href);
      }

      const unique = [...new Set(candidates)];
      const found = unique.find((u) => isRealArticle(u));
      return found || null;
    });

    if (originalUrl && !isBlockedUrl(originalUrl)) {
      return originalUrl;
    }

    throw new Error(
      "Could not detect external article URL (only Google/Cloudflare or no external link found)."
    );
  } finally {
    await page.close();
  }
}

// ---------- main controller (route-এর জন্য single ফাংশন) ----------
export async function resolveArticleController(req, res) {
  try {
    let targetUrl = null;

    // body = "https://news.google.com/..."  (JSON string)
    if (typeof req.body === "string") {
      targetUrl = req.body.trim();
    }
    // body = { "url": "https://news.google.com/..." }
    else if (req.body && typeof req.body.url === "string") {
      targetUrl = req.body.url.trim();
    }

    if (!targetUrl) {
      return res.status(400).json({
        error: 'Send JSON string ("url") or { "url": "..." } as body.',
      });
    }

    const resolved = await resolveArticleUrl(targetUrl);

    return res.json({
      input: targetUrl,
      resolved,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: err.message || "Failed to resolve article URL",
    });
  }
}

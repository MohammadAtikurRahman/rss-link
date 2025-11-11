// controller/searchController.js
import axios from "axios";
import { parseStringPromise } from "xml2js";
import puppeteer from "puppeteer";

// ---------- helpers ----------

function formatDate(d) {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) {
    return {
      pubDate: null,
      isoDate: null,
      year: null,
      month: null,
      day: null,
    };
  }
  return {
    pubDate: dt.toUTCString(),
    isoDate: dt.toISOString(),
    year: dt.getFullYear(),
    month: dt.toLocaleString("en-US", { month: "long" }),
    day: String(dt.getDate()).padStart(2, "0"),
  };
}

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

/**
 * Use Puppeteer to open a Google News link and find the *real* article URL.
 * Reuses the same page instance for speed.
 */
async function resolveFinalUrlWithPuppeteer(page, googleUrl) {
  if (!googleUrl) return null;

  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    await page.goto(googleUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // allow JS redirects / iframes to load
    await new Promise((r) => setTimeout(r, 2000));

    const currentUrl = page.url();

    // 1) if already non-google/non-cloudflare → treat as article URL
    if (!isBlockedUrl(currentUrl)) {
      return currentUrl;
    }

    // 2) otherwise scan DOM for canonical / og:url / iframe / anchor href
    const originalUrl = await page.evaluate((blockedHosts) => {
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

      // canonical
      const canonical = document.querySelector('link[rel="canonical"]');
      if (canonical && canonical.href) {
        candidates.push(canonical.href);
      }

      // og:url meta
      const ogMeta = document.querySelector(
        'meta[property="og:url"], meta[name="og:url"]'
      );
      if (ogMeta) {
        const content = ogMeta.content || ogMeta.getAttribute("content");
        if (content) candidates.push(content);
      }

      // iframe src
      const iframes = Array.from(document.querySelectorAll("iframe[src]"));
      for (const f of iframes) {
        candidates.push(f.src);
      }

      // anchor href
      const anchors = Array.from(
        document.querySelectorAll('a[href^="http"]')
      );
      for (const a of anchors) {
        candidates.push(a.href);
      }

      const unique = [...new Set(candidates)];
      const found = unique.find((u) => isRealArticle(u));
      return found || null;
    }, BLOCKED_HOSTS);

    if (originalUrl && !isBlockedUrl(originalUrl)) {
      return originalUrl;
    }

    // fallback: nothing better found
    return googleUrl;
  } catch (err) {
    console.error("Puppeteer resolve error for", googleUrl, "-", err.message);
    return googleUrl;
  }
}

/**
 * Fetch one Google News RSS page for a given query string.
 * (No Puppeteer here, just RSS → items with googleLink + date info.)
 */
async function fetchRssOnce(rawQuery) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
    rawQuery
  )}&hl=bn&gl=BD&ceid=BD:bn`;

  const res = await axios.get(url, { timeout: 15000 });
  const xml = res.data;

  const parsed = await parseStringPromise(xml, {
    trim: true,
    explicitArray: true,
  });

  const itemsRaw =
    parsed?.rss?.channel?.[0]?.item &&
    Array.isArray(parsed.rss.channel[0].item)
      ? parsed.rss.channel[0].item
      : [];

  const channelTitle = parsed?.rss?.channel?.[0]?.title?.[0] || "Google News";

  const baseItems = itemsRaw.map((item) => {
    const dates = formatDate(item.pubDate?.[0] || item.pubDate || null);
    return {
      title: item.title?.[0] || item.title || null,
      description: item.description?.[0] || item.description || "",
      googleLink: item.link?.[0] || item.link || null, // Google News URL
      link: null, // will fill with real publisher URL
      source:
        item.source?.[0]?._ ||
        item.source?._ ||
        channelTitle ||
        "Google News",
      sourceUrl: item.source?.[0]?.$?.url || null,
      pubDate: dates.pubDate,
      isoDate: dates.isoDate,
      year: dates.year,
      month: dates.month,
      day: dates.day,
    };
  });

  return baseItems;
}

// ------------------ Express controller ------------------

/**
 * POST /search
 * Body:
 * {
 *   "query": "শেখ হাসিনা",
 *   "subQuery": "বাংলাদেশ, ঢাকা, প্রধানমন্ত্রী" OR ["বাংলাদেশ","ঢাকা","প্রধানমন্ত্রী"],
 *   "limit": 500,
 *   "fromYear": 2001,
 *   "toYear": 2025
 * }
 */
export async function searchController(req, res) {
  try {
    const { query, subQuery, limit, fromYear, toYear } = req.body || {};

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "query is required (string)" });
    }

    // build base query with optional subQuery terms
    const baseParts = [query];

    const extraTerms = [];
    if (typeof subQuery === "string") {
      subQuery
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((s) => extraTerms.push(s));
    } else if (Array.isArray(subQuery)) {
      subQuery
        .map((s) => String(s).trim())
        .filter(Boolean)
        .forEach((s) => extraTerms.push(s));
    }

    extraTerms.forEach((term) => {
      if (!term) return;
      baseParts.push(term);
    });

    const baseQuery = baseParts.join(" ");

    // -------- 1) Collect RSS items across years --------

    const allBaseItems = [];

    const fromY = fromYear ? parseInt(fromYear, 10) : null;
    const toY = toYear ? parseInt(toYear, 10) : null;

    if (fromY && toY) {
      const start = Math.min(fromY, toY);
      const end = Math.max(fromY, toY);
      // loop from newest year downwards (like your service)
      for (let y = end; y >= start; y--) {
        const qWithYear = `${baseQuery} ${y}`;
        const batch = await fetchRssOnce(qWithYear);
        allBaseItems.push(...batch);
        // polite pause between year queries
        await new Promise((r) => setTimeout(r, 300));
      }
    } else {
      const batch = await fetchRssOnce(baseQuery);
      allBaseItems.push(...batch);
    }

    if (!allBaseItems.length) {
      return res.json({
        query,
        subQuery: subQuery || null,
        fromYear: fromY,
        toYear: toY,
        total: 0,
        count: 0,
        items: [],
      });
    }

    // -------- 2) Resolve each Google URL to real article URL (Puppeteer) --------

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    const resolvedItems = [];

    try {
      for (const item of allBaseItems) {
        const realUrl = await resolveFinalUrlWithPuppeteer(
          page,
          item.googleLink
        );
        resolvedItems.push({ ...item, link: realUrl });
        // small delay so we don't hammer the site
        await new Promise((r) => setTimeout(r, 150));
      }
    } finally {
      await browser.close();
    }

    // -------- 3) De-dupe by real link (fallback to googleLink) --------

    const seen = new Set();
    const unique = resolvedItems.filter((r) => {
      const key = r.link || r.googleLink;
      if (!key) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // -------- 4) Sort newest → oldest --------

    unique.sort((a, b) => {
      const ta = a.isoDate ? +new Date(a.isoDate) : 0;
      const tb = b.isoDate ? +new Date(b.isoDate) : 0;
      return tb - ta;
    });

    // -------- 5) Limit + response --------

    let finalLimit =
      typeof limit === "number" ? limit : parseInt(limit, 10) || 50;
    if (finalLimit <= 0) finalLimit = 50;

    const trimmed = unique.slice(0, finalLimit);

    return res.json({
      query,
      subQuery: subQuery || null,
      baseQuery,
      fromYear: fromY,
      toYear: toY,
      total: unique.length,
      count: trimmed.length,
      items: trimmed,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: err.message || "Search failed",
    });
  }
}

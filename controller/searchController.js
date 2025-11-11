// // controller/searchController.js
// import axios from "axios";
// import { parseStringPromise } from "xml2js";

// // ---------- helpers ----------

// function formatDate(d) {
//   const dt = new Date(d);
//   if (Number.isNaN(dt.getTime())) {
//     return {
//       pubDate: null,
//       isoDate: null,
//       year: null,
//       month: null,
//       day: null,
//     };
//   }
//   return {
//     pubDate: dt.toUTCString(),
//     isoDate: dt.toISOString(),
//     year: dt.getFullYear(),
//     month: dt.toLocaleString("en-US", { month: "long" }),
//     day: String(dt.getDate()).padStart(2, "0"),
//   };
// }

// /**
//  * Fetch one Google News RSS page for a given query string.
//  * Bangla edition: hl=bn, gl=BD, ceid=BD:bn
//  */
// async function fetchRssOnce(rawQuery) {
//   const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
//     rawQuery
//   )}&hl=bn&gl=BD&ceid=BD:bn`;

//   const res = await axios.get(url, { timeout: 15000 });
//   const xml = res.data;

//   const parsed = await parseStringPromise(xml, {
//     trim: true,
//     explicitArray: true,
//   });

//   const itemsRaw =
//     parsed?.rss?.channel?.[0]?.item &&
//     Array.isArray(parsed.rss.channel[0].item)
//       ? parsed.rss.channel[0].item
//       : [];

//   const channelTitle = parsed?.rss?.channel?.[0]?.title?.[0] || "Google News";

//   const baseItems = itemsRaw.map((item) => {
//     const pub = item.pubDate?.[0] || item.pubDate || null;
//     const dates = formatDate(pub);

//     return {
//       title: item.title?.[0] || item.title || "",
//       description: item.description?.[0] || item.description || "",
//       link: item.link?.[0] || item.link || null, // Google News URL (not resolved!)
//       source:
//         item.source?.[0]?._ ||
//         item.source?._ ||
//         channelTitle ||
//         "Google News",
//       sourceUrl: item.source?.[0]?.$?.url || null,
//       pubDate: dates.pubDate,
//       isoDate: dates.isoDate,
//       year: dates.year,
//       month: dates.month,
//       day: dates.day,
//     };
//   });

//   return baseItems;
// }

// // ------------------ Express controller ------------------

// /**
//  * POST /search
//  * Body:
//  * {
//  *   "query": "শেখ হাসিনা",
//  *   "subQuery": "বাংলাদেশ, ঢাকা, প্রধানমন্ত্রী"  OR ["বাংলাদেশ","ঢাকা","প্রধানমন্ত্রী"],
//  *   "limit": 500,
//  *   "fromYear": 2001,
//  *   "toYear": 2025
//  * }
//  */
// export async function searchController(req, res) {
//   try {
//     const { query, subQuery, limit, fromYear, toYear } = req.body || {};

//     if (!query || typeof query !== "string") {
//       return res.status(400).json({ error: "query is required (string)" });
//     }

//     // ---------- 1) Build base query with optional subQuery terms ----------

//     const baseParts = [query];

//     const extraTerms = [];
//     if (typeof subQuery === "string") {
//       subQuery
//         .split(",")
//         .map((s) => s.trim())
//         .filter(Boolean)
//         .forEach((s) => extraTerms.push(s));
//     } else if (Array.isArray(subQuery)) {
//       subQuery
//         .map((s) => String(s).trim())
//         .filter(Boolean)
//         .forEach((s) => extraTerms.push(s));
//     }

//     extraTerms.forEach((term) => {
//       if (!term) return;
//       baseParts.push(term);
//     });

//     const baseQuery = baseParts.join(" ");

//     // ---------- 2) Collect RSS items across years (year by year) ----------

//     const allItems = [];

//     const fromY = fromYear ? parseInt(fromYear, 10) : null;
//     const toY = toYear ? parseInt(toYear, 10) : null;

//     if (fromY && toY) {
//       const start = Math.min(fromY, toY);
//       const end = Math.max(fromY, toY);

//       // newest year first (like your service)
//       for (let y = end; y >= start; y--) {
//         const qWithYear = `${baseQuery} ${y}`;
//         const batch = await fetchRssOnce(qWithYear);
//         allItems.push(...batch);
//         // small pause so we don't spam Google
//         await new Promise((r) => setTimeout(r, 300));
//       }
//     } else {
//       const batch = await fetchRssOnce(baseQuery);
//       allItems.push(...batch);
//     }

//     if (!allItems.length) {
//       return res.json({
//         query,
//         subQuery: subQuery || null,
//         baseQuery,
//         fromYear: fromY,
//         toYear: toY,
//         total: 0,
//         count: 0,
//         items: [],
//       });
//     }

//     // ---------- 3) De-dupe by Google News link ----------

//     const seen = new Set();
//     const unique = allItems.filter((item) => {
//       const key = item.link;
//       if (!key) return false;
//       if (seen.has(key)) return false;
//       seen.add(key);
//       return true;
//     });

//     // ---------- 4) Sort newest → oldest ----------

//     unique.sort((a, b) => {
//       const ta = a.isoDate ? +new Date(a.isoDate) : 0;
//       const tb = b.isoDate ? +new Date(b.isoDate) : 0;
//       return tb - ta;
//     });

//     // ---------- 5) Limit + response ----------

//     let finalLimit =
//       typeof limit === "number" ? limit : parseInt(limit, 10) || 50;
//     if (finalLimit <= 0) finalLimit = 50;

//     const trimmed = unique.slice(0, finalLimit);

//     return res.json({
//       query,
//       subQuery: subQuery || null,
//       baseQuery,
//       fromYear: fromY,
//       toYear: toY,
//       total: unique.length, // all unique items we found across years
//       count: trimmed.length, // how many we returned
//       items: trimmed,
//     });
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({
//       error: err.message || "Search failed",
//     });
//   }
// }



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

/**
 * Fetch one Google News RSS page for a given query string.
 * Bangla edition: hl=bn, gl=BD, ceid=BD:bn
 * NOTE: description intentionally removed from result.
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
    const pub = item.pubDate?.[0] || item.pubDate || null;
    const dates = formatDate(pub);

    return {
      title: item.title?.[0] || item.title || "",
      // description removed on purpose
      link: item.link?.[0] || item.link || null, // Google News URL
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

/**
 * Core search logic reused by /search and /resolved-search.
 * Returns { baseQuery, fromYear, toYear, items }
 * items: unique, sorted newest → oldest, link = Google News URL
 */
async function coreSearch({ query, subQuery, fromYear, toYear }) {
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

  const fromY = fromYear ? parseInt(fromYear, 10) : null;
  const toY = toYear ? parseInt(toYear, 10) : null;

  // collect RSS items across years
  const allItems = [];

  if (fromY && toY) {
    const start = Math.min(fromY, toY);
    const end = Math.max(fromY, toY);

    // newest year first
    for (let y = end; y >= start; y--) {
      const qWithYear = `${baseQuery} ${y}`;
      const batch = await fetchRssOnce(qWithYear);
      allItems.push(...batch);
      // polite pause
      await new Promise((r) => setTimeout(r, 300));
    }
  } else {
    const batch = await fetchRssOnce(baseQuery);
    allItems.push(...batch);
  }

  if (!allItems.length) {
    return { baseQuery, fromYear: fromY, toYear: toY, items: [] };
  }

  // de-dupe by Google News link
  const seen = new Set();
  const unique = allItems.filter((item) => {
    const key = item.link;
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // newest → oldest
  unique.sort((a, b) => {
    const ta = a.isoDate ? +new Date(a.isoDate) : 0;
    const tb = b.isoDate ? +new Date(b.isoDate) : 0;
    return tb - ta;
  });

  return { baseQuery, fromYear: fromY, toYear: toY, items: unique };
}

// ---------- Puppeteer helpers (for resolved-search only) ----------

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
 * Timeout & waitUntil are relaxed; on error we just return googleUrl.
 */
async function resolveFinalUrlWithPuppeteer(page, googleUrl) {
  if (!googleUrl) return null;

  try {
    await page.goto(googleUrl, {
      // lighter than "networkidle2", faster & less error-prone
      waitUntil: "domcontentloaded",
      timeout: 15000, // shorter timeout to avoid long hangs
    });

    // small wait, not too long
    await new Promise((r) => setTimeout(r, 1500));

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
    // soft log, no crash
    console.warn(
      "Puppeteer resolve error for",
      googleUrl,
      "-",
      err.message || err
    );
    return googleUrl;
  }
}

// ------------------ Controllers ------------------

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
 * Returns only Google News links (no Puppeteer, no description).
 */
export async function searchController(req, res) {
  try {
    const { query, subQuery, limit, fromYear, toYear } = req.body || {};

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "query is required (string)" });
    }

    const { baseQuery, fromYear: fromY, toYear: toY, items } =
      await coreSearch({ query, subQuery, fromYear, toYear });

    if (!items.length) {
      return res.json({
        query,
        subQuery: subQuery || null,
        baseQuery,
        fromYear: fromY,
        toYear: toY,
        total: 0,
        count: 0,
        items: [],
      });
    }

    let finalLimit =
      typeof limit === "number" ? limit : parseInt(limit, 10) || 50;
    if (finalLimit <= 0) finalLimit = 50;

    const trimmed = items.slice(0, finalLimit);

    return res.json({
      query,
      subQuery: subQuery || null,
      baseQuery,
      fromYear: fromY,
      toYear: toY,
      total: items.length,
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

/**
 * POST /resolved-search
 * Same body as /search.
 * Runs the same search, then resolves each Google News link
 * to the real article URL using Puppeteer.
 *
 * items: {
 *   title,
 *   link: <original article URL>,
 *   googleLink: <Google News URL>,
 *   source,
 *   sourceUrl,
 *   pubDate,
 *   isoDate,
 *   year,
 *   month,
 *   day
 * }
 * (No description.)
 */
export async function resolvedSearchController(req, res) {
  try {
    const { query, subQuery, limit, fromYear, toYear } = req.body || {};

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "query is required (string)" });
    }

    const { baseQuery, fromYear: fromY, toYear: toY, items } =
      await coreSearch({ query, subQuery, fromYear, toYear });

    if (!items.length) {
      return res.json({
        query,
        subQuery: subQuery || null,
        baseQuery,
        fromYear: fromY,
        toYear: toY,
        total: 0,
        count: 0,
        items: [],
      });
    }

    let finalLimit =
      typeof limit === "number" ? limit : parseInt(limit, 10) || 50;
    if (finalLimit <= 0) finalLimit = 50;

    const limited = items.slice(0, finalLimit);

    // ---- Puppeteer: resolve each Google News link ----

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    const resolvedItems = [];

    try {
      for (const item of limited) {
        const googleLink = item.link;
        const realUrl = await resolveFinalUrlWithPuppeteer(page, googleLink);
        resolvedItems.push({
          ...item,
          googleLink,
          link: realUrl, // now real article URL
        });
        // small delay so we don't hammer sites
        await new Promise((r) => setTimeout(r, 150));
      }
    } finally {
      await browser.close();
    }

    return res.json({
      query,
      subQuery: subQuery || null,
      baseQuery,
      fromYear: fromY,
      toYear: toY,
      total: items.length,
      count: resolvedItems.length,
      items: resolvedItems,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: err.message || "Resolved search failed",
    });
  }
}

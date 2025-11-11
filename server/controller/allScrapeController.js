// controller/allScrapeController.js
import fs from "fs";
import path from "path";
import axios from "axios";
import * as cheerio from "cheerio";
import slugify from "slugify";
import { parseStringPromise } from "xml2js";
import puppeteer from "puppeteer";

// ---------- shared helpers ----------

const clean = (s) => (s ? s.replace(/\s+/g, " ").trim() : "");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function safeFileName(str, fallback = "article") {
  const a =
    slugify(str || "", { lower: true, strict: true, trim: true }) ||
    slugify(fallback, { lower: true, strict: true });
  return a.replace(/^\.+/, "").slice(0, 120);
}

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

// ---------- HTML fetch & parse for scraping ----------

async function fetchHtml(url) {
  const resp = await axios.get(url, {
    timeout: 30000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    maxRedirects: 5,
  });
  return {
    html: resp.data,
    // axios follows redirects, so final URL may differ from requested
    finalUrl:
      resp.request?.res?.responseUrl || resp.request?._currentUrl || url,
  };
}

// likely article body containers
const BODY_SELECTORS = [
  "article .entry-content",
  "article .post-content",
  ".single-post .entry-content",
  ".td-post-content",
  ".tdb-block-inner .tdb-block-content",
  ".post-content",
  "article",
  ".content-area",
  ".main-content",
];

function parseArticle(html, url) {
  const $ = cheerio.load(html);

  const title =
    clean($("meta[property='og:title']").attr("content")) ||
    clean($("h1.entry-title").text()) ||
    clean($("h1").first().text()) ||
    null;

  const author =
    clean($("meta[name='author']").attr("content")) ||
    clean($("[class*='author'] a").first().text()) ||
    clean($("[class*='author']").first().text()) ||
    null;

  const publishedAt =
    clean($("meta[property='article:published_time']").attr("content")) ||
    clean($("time[datetime]").attr("datetime")) ||
    clean($("time").first().text()) ||
    null;

  // optional canonical URL as the most "resolved" link
  const canonical =
    clean($("link[rel='canonical']").attr("href")) ||
    clean($("meta[property='og:url']").attr("content")) ||
    null;

  let $body = null;
  for (const sel of BODY_SELECTORS) {
    if ($(sel).length) {
      $body = $(sel).first();
      break;
    }
  }
  if (!$body) $body = $("article").first();

  const blocks = [];
  $body.find("h2, h3").each((_, el) => {
    const t = clean($(el).text());
    if (t) blocks.push(t);
  });
  $body.find("p").each((_, el) => {
    const t = clean($(el).text());
    if (t) blocks.push(t);
  });

  if (blocks.length === 0) {
    $("p").each((_, el) => {
      const t = clean($(el).text());
      if (t) blocks.push(t);
    });
  }

  const text = blocks.join("\n\n");
  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;

  return {
    url, // the URL we scraped (resolved)
    canonical: canonical || null,
    title,
    author,
    publishedAt,
    wordCount,
    paragraphs: blocks,
    text,
  };
}

async function scrapeArticle(url) {
  const { html, finalUrl } = await fetchHtml(url);
  const parsed = parseArticle(html, finalUrl || url);
  return parsed;
}

// ---------- Google News RSS search (like /search) ----------

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
 * Core search: build query + year-wise Google News RSS + de-dupe + sort.
 * Returns { baseQuery, fromYear, toYear, items }
 */
async function coreSearch({ query, subQuery, fromYear, toYear }) {
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

  const allItems = [];

  if (fromY && toY) {
    const start = Math.min(fromY, toY);
    const end = Math.max(fromY, toY);

    for (let y = end; y >= start; y--) {
      const qWithYear = `${baseQuery} ${y}`;
      const batch = await fetchRssOnce(qWithYear);
      allItems.push(...batch);
      await new Promise((r) => setTimeout(r, 300));
    }
  } else {
    const batch = await fetchRssOnce(baseQuery);
    allItems.push(...batch);
  }

  if (!allItems.length) {
    return { baseQuery, fromYear: fromY, toYear: toY, items: [] };
  }

  // de-dupe by Google News URL
  const seen = new Set();
  const unique = allItems.filter((item) => {
    const key = item.link;
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  unique.sort((a, b) => {
    const ta = a.isoDate ? +new Date(a.isoDate) : 0;
    const tb = b.isoDate ? +new Date(b.isoDate) : 0;
    return tb - ta;
  });

  return { baseQuery, fromYear: fromY, toYear: toY, items: unique };
}

// ---------- Puppeteer helpers for resolving Google News link ----------

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

async function resolveFinalUrlWithPuppeteer(page, googleUrl) {
  if (!googleUrl) return null;

  try {
    await page.goto(googleUrl, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    await new Promise((r) => setTimeout(r, 1500));

    const currentUrl = page.url();

    if (!isBlockedUrl(currentUrl)) {
      return currentUrl;
    }

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

      const canonical = document.querySelector('link[rel="canonical"]');
      if (canonical && canonical.href) {
        candidates.push(canonical.href);
      }

      const ogMeta = document.querySelector(
        'meta[property="og:url"], meta[name="og:url"]'
      );
      if (ogMeta) {
        const content = ogMeta.content || ogMeta.getAttribute("content");
        if (content) candidates.push(content);
      }

      const iframes = Array.from(document.querySelectorAll("iframe[src]"));
      for (const f of iframes) {
        candidates.push(f.src);
      }

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

    return googleUrl;
  } catch (err) {
    console.warn(
      "Puppeteer resolve error for",
      googleUrl,
      "-",
      err.message || err
    );
    return googleUrl;
  }
}

// ------------------ Controller: POST /all-scrape ------------------

/**
 * POST /all-scrape
 * Body:
 * {
 *   "query": "শেখ হাসিনা",
 *   "subQuery": "বাংলাদেশ, ঢাকা, প্রধানমন্ত্রী",
 *   "limit": 2000,
 *   "fromYear": 2001,
 *   "toYear": 2025,
 *   "name": "hasina-2001-2025"  // optional file name
 * }
 *
 * Steps:
 *  - search Google News (year-wise)
 *  - resolve each link to real article URL
 *  - scrape article (title, author, publishedAt, full text)
 *  - save ONE combined JSON file under ./data (by default)
 */
export async function allScrapeController(req, res) {
  try {
    const { query, subQuery, limit, fromYear, toYear, name, outDir } =
      req.body || {};

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "query is required (string)" });
    }

    // 1) search
    const { baseQuery, fromYear: fromY, toYear: toY, items } =
      await coreSearch({ query, subQuery, fromYear, toYear });

    if (!items.length) {
      return res.json({
        query,
        subQuery: subQuery || null,
        baseQuery,
        fromYear: fromY,
        toYear: toY,
        totalFound: 0,
        scrapedCount: 0,
        failed: 0,
        items: [],
        errors: [],
      });
    }

    // 2) respect limit, but hard-cap for safety
    const MAX_SCRAPE_LIMIT = 200; // change if you really want more
    let finalLimit =
      typeof limit === "number" ? limit : parseInt(limit, 10) || 50;
    if (finalLimit <= 0) finalLimit = 50;
    if (finalLimit > MAX_SCRAPE_LIMIT) finalLimit = MAX_SCRAPE_LIMIT;

    const limited = items.slice(0, finalLimit);

    // 3) resolve + scrape with Puppeteer + axios/cheerio

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    const scrapedItems = [];
    const errors = [];

    try {
      for (const it of limited) {
        const googleLink = it.link;
        try {
          const resolvedUrl = await resolveFinalUrlWithPuppeteer(
            page,
            googleLink
          );

          const articleData = await scrapeArticle(resolvedUrl);

          scrapedItems.push({
            // search metadata
            googleLink,
            source: it.source,
            sourceUrl: it.sourceUrl,
            pubDate: it.pubDate,
            isoDate: it.isoDate,
            year: it.year,
            month: it.month,
            day: it.day,
            // resolved / scraped
            resolvedUrl: articleData.url,
            canonical: articleData.canonical,
            title: articleData.title,
            author: articleData.author,
            publishedAt: articleData.publishedAt,
            wordCount: articleData.wordCount,
            paragraphs: articleData.paragraphs,
            text: articleData.text,
          });

          await new Promise((r) => setTimeout(r, 300));
        } catch (e) {
          errors.push({
            googleLink,
            error: e.message || String(e),
          });
        }
      }
    } finally {
      await browser.close();
    }

    // 4) save combined file

  const targetDir = outDir || path.join(process.cwd(), "data");
ensureDir(targetDir);

const givenName = name || "all-scrape";
const fileStem = safeFileName(givenName);
const outPath = path.join(targetDir, `${fileStem}.json`);


    const doc = {
      query,
      subQuery: subQuery || null,
      baseQuery,
      fromYear: fromY,
      toYear: toY,
      totalFound: items.length,
      scrapedCount: scrapedItems.length,
      failed: errors.length,
      generatedAt: new Date().toISOString(),
      items: scrapedItems,
      errors,
    };

    fs.writeFileSync(outPath, JSON.stringify(doc, null, 2), "utf-8");

    return res.json({
      outPath,
      ...doc,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: err.message || "All-scrape failed",
    });
  }
}

// controller/scrapeController.js
import fs from "fs";
import path from "path";
import axios from "axios";
import * as cheerio from "cheerio";
import slugify from "slugify";

// ---------- helpers ----------

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
  return resp.data;
}

// Try multiple likely containers for the article body
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
    url,
    title,
    author,
    publishedAt,
    wordCount,
    paragraphs: blocks,
    text,
  };
}

// ---- internal helpers matching your service logic ----

async function scrapeOne(url) {
  const html = await fetchHtml(url);
  return parseArticle(html, url);
}

/**
 * Scrape MANY urls and save EVERYTHING into ONE combined JSON file.
 * - urls: string[]
 * - outDir: folder to write JSON file (default: <cwd>/data)
 * - combinedName: name like "hasina-2025" -> data/hasina-2025.json
 */
async function scrapeBatchCombined(urls, outDir, combinedName) {
  ensureDir(outDir);
  const items = [];
  const errors = [];

  for (const url of urls) {
    try {
      const payload = await scrapeOne(url); // no per-url file
      items.push(payload);
      await new Promise((r) => setTimeout(r, 300)); // gentle delay
    } catch (e) {
      errors.push({ url, error: e.message });
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const name = combinedName
    ? safeFileName(combinedName)
    : `batch-${stamp}`;

  const outPath = path.join(outDir, `${name}.json`);
  const doc = {
    generatedAt: new Date().toISOString(),
    count: items.length,
    failed: errors.length,
    items,
    errors,
  };

  fs.writeFileSync(outPath, JSON.stringify(doc, null, 2), "utf-8");
  return { outPath, ...doc };
}

// ------------------ Express controller ------------------

/**
 * POST /scrape
 * Body options:
 * 1) Single URL:
 *    {
 *      "url": "https://example.com/article",
 *      "name": "hasina-2025"   // optional, for file name
 *    }
 *
 * 2) Multiple URLs:
 *    {
 *      "urls": [
 *        "https://example.com/a",
 *        "https://example.com/b"
 *      ],
 *      "name": "hasina-2025"   // optional, for file name
 *    }
 *
 * Writes ONE combined JSON file in ./data by default and returns metadata.
 */
export async function scrapeController(req, res) {
  try {
    const { url, urls, name, outDir } = req.body || {};

    let urlList = [];

    if (Array.isArray(urls) && urls.length) {
      urlList = urls.map((u) => String(u).trim()).filter(Boolean);
    } else if (typeof url === "string" && url.trim()) {
      urlList = [url.trim()];
    }

    if (!urlList.length) {
      return res.status(400).json({
        error: "Provide 'url' (string) or 'urls' (array of strings).",
      });
    }

    const targetDir = outDir || path.join(process.cwd(), "data");

    const result = await scrapeBatchCombined(urlList, targetDir, name);

    return res.json({
      name: name || null,
      outDir: targetDir,
      outPath: result.outPath,
      generatedAt: result.generatedAt,
      count: result.count,
      failed: result.failed,
      items: result.items,
      errors: result.errors,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: err.message || "Scrape failed",
    });
  }
}

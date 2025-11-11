// controller/searchController.js
import axios from "axios";
import { parseStringPromise } from "xml2js";

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
      description: item.description?.[0] || item.description || "",
      link: item.link?.[0] || item.link || null, // Google News URL (not resolved!)
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
 *   "subQuery": "বাংলাদেশ, ঢাকা, প্রধানমন্ত্রী"  OR ["বাংলাদেশ","ঢাকা","প্রধানমন্ত্রী"],
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

    // ---------- 1) Build base query with optional subQuery terms ----------

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

    // ---------- 2) Collect RSS items across years (year by year) ----------

    const allItems = [];

    const fromY = fromYear ? parseInt(fromYear, 10) : null;
    const toY = toYear ? parseInt(toYear, 10) : null;

    if (fromY && toY) {
      const start = Math.min(fromY, toY);
      const end = Math.max(fromY, toY);

      // newest year first (like your service)
      for (let y = end; y >= start; y--) {
        const qWithYear = `${baseQuery} ${y}`;
        const batch = await fetchRssOnce(qWithYear);
        allItems.push(...batch);
        // small pause so we don't spam Google
        await new Promise((r) => setTimeout(r, 300));
      }
    } else {
      const batch = await fetchRssOnce(baseQuery);
      allItems.push(...batch);
    }

    if (!allItems.length) {
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

    // ---------- 3) De-dupe by Google News link ----------

    const seen = new Set();
    const unique = allItems.filter((item) => {
      const key = item.link;
      if (!key) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // ---------- 4) Sort newest → oldest ----------

    unique.sort((a, b) => {
      const ta = a.isoDate ? +new Date(a.isoDate) : 0;
      const tb = b.isoDate ? +new Date(b.isoDate) : 0;
      return tb - ta;
    });

    // ---------- 5) Limit + response ----------

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
      total: unique.length, // all unique items we found across years
      count: trimmed.length, // how many we returned
      items: trimmed,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: err.message || "Search failed",
    });
  }
}

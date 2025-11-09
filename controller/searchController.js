// controller/searchController.js
import axios from "axios";
import { parseStringPromise } from "xml2js";

// POST /search
// Body: { query, subQuery?, limit?, fromYear?, toYear? }
// - subQuery can be:
//    - string: "Bangladesh, Dhaka, Prime minister"
//    - array: ["Bangladesh", "Dhaka", "Prime minister"]
export async function searchController(req, res) {
  try {
    const { query, subQuery, limit, fromYear, toYear } = req.body || {};

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "query is required (string)" });
    }

    // Build search query parts
    const qParts = [query];

    // subQuery as string: "Bangladesh, Dhaka, Prime minister"
    if (typeof subQuery === "string") {
      subQuery
        .split(",")               // split by comma
        .map((s) => s.trim())     // trim spaces
        .filter(Boolean)          // remove empty strings
        .forEach((s) => qParts.push(s));
    }

    // subQuery as array: ["Bangladesh", "Dhaka", "Prime minister"]
    if (Array.isArray(subQuery)) {
      subQuery
        .map((s) => String(s).trim())
        .filter(Boolean)
        .forEach((s) => qParts.push(s));
    }

    const qParam = encodeURIComponent(qParts.join(" "));

    const url = `https://news.google.com/rss/search?q=${qParam}&hl=en-US&gl=US&ceid=US:en`;

    const response = await axios.get(url);
    const xml = response.data;

    const parsed = await parseStringPromise(xml, {
      trim: true,
      explicitArray: true,
    });

    const itemsRaw =
      parsed?.rss?.channel?.[0]?.item &&
      Array.isArray(parsed.rss.channel[0].item)
        ? parsed.rss.channel[0].item
        : [];

    let items = itemsRaw.map((item) => ({
      title: item.title?.[0] || "",
      link: item.link?.[0] || "",
      pubDate: item.pubDate?.[0] || null,
      description: item.description?.[0] || "",
      source: item.source?.[0]?._ || null,
      sourceUrl: item.source?.[0]?.$?.url || null,
    }));

    // year filter
    const fromY = fromYear ? parseInt(fromYear, 10) : null;
    const toY = toYear ? parseInt(toYear, 10) : null;

    if (fromY || toY) {
      items = items.filter((it) => {
        if (!it.pubDate) return false;
        const d = new Date(it.pubDate);
        if (Number.isNaN(d.getTime())) return false;
        const y = d.getFullYear();
        if (fromY && y < fromY) return false;
        if (toY && y > toY) return false;
        return true;
      });
    }

    let finalLimit =
      typeof limit === "number" ? limit : parseInt(limit, 10) || 20;
    if (finalLimit <= 0) finalLimit = 20;

    const sliced = items.slice(0, finalLimit);

    return res.json({
      query,
      subQuery: subQuery || null,
      fromYear: fromY,
      toYear: toY,
      total: items.length,
      count: sliced.length,
      items: sliced,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: err.message || "Search failed",
    });
  }
}

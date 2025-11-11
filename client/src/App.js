// client/src/App.js
import React, { useState } from "react";

const API_BASE = "http://localhost:2000/api";

function App() {
  // form state for SEARCH
  const [query, setQuery] = useState("");
  const [fromYear, setFromYear] = useState("");
  const [toYear, setToYear] = useState("");
  const [limit, setLimit] = useState("40");
  const [searchFilename, setSearchFilename] = useState("links-output");

  // SCRAPE filename
  const [scrapeFilename, setScrapeFilename] = useState("scraped-articles");

  // data state
  const [searchResults, setSearchResults] = useState([]);
  const [searchMeta, setSearchMeta] = useState(null);
  const [searchFile, setSearchFile] = useState(null);

  const [scrapeSummary, setScrapeSummary] = useState(null);

  // UI state
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingScrape, setLoadingScrape] = useState(false);
  const [error, setError] = useState(null);

  // ----------------- handlers -----------------

  const handleSearch = async (e) => {
    e.preventDefault();
    setError(null);
    setScrapeSummary(null);
    setSearchResults([]);
    setSearchMeta(null);
    setSearchFile(null);

    if (!query.trim()) {
      setError("Please enter a search query.");
      return;
    }
    if (!searchFilename.trim()) {
      setError("Please provide a filename for saving search results.");
      return;
    }

    setLoadingSearch(true);
    try {
      const body = {
        query: query.trim(),
        limit: Number(limit) || 40,
        filename: searchFilename.trim(),
      };

      if (fromYear) body.from = Number(fromYear);
      if (toYear) body.to = Number(toYear);

      const res = await fetch(`${API_BASE}/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Search failed (${res.status})`);
      }

      const data = await res.json();
      setSearchResults(data.items || []);
      setSearchMeta({
        query: data.query,
        range: data.range,
        total: data.total,
        generatedAt: data.generatedAt,
      });
      setSearchFile(data.file || null);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleScrapeAll = async () => {
    setError(null);
    setScrapeSummary(null);

    if (!searchResults.length) {
      setError("No search results to scrape. Run a search first.");
      return;
    }
    if (!scrapeFilename.trim()) {
      setError("Please provide a filename for scraped articles.");
      return;
    }

    const urls = searchResults
      .map((r) => r.link)
      .filter((u) => typeof u === "string" && u.startsWith("http"));

    if (!urls.length) {
      setError("Search results have no valid links to scrape.");
      return;
    }

    setLoadingScrape(true);
    try {
      const res = await fetch(`${API_BASE}/scrape-batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          urls,
          filename: scrapeFilename.trim(),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Scrape failed (${res.status})`);
      }

      const data = await res.json();
      setScrapeSummary(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoadingScrape(false);
    }
  };

  // ----------------- render helpers -----------------

  const renderSearchMeta = () => {
    if (!searchMeta) return null;
    return (
      <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
        <div>
          <strong>Query:</strong> {searchMeta.query}
        </div>
        {searchMeta.range && (
          <div>
            <strong>Years:</strong> {searchMeta.range.from} –{" "}
            {searchMeta.range.to}
          </div>
        )}
        <div>
          <strong>Total items:</strong> {searchMeta.total}
        </div>
        <div>
          <strong>Generated at:</strong>{" "}
          {new Date(searchMeta.generatedAt).toLocaleString()}
        </div>
        {searchFile && (
          <div className="mt-1">
            <strong>Saved file:</strong>{" "}
            <span className="font-mono break-all">{searchFile}</span>
          </div>
        )}
      </div>
    );
  };

  const renderScrapeSummary = () => {
    if (!scrapeSummary) return null;
    return (
      <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
        <div>
          <strong>Status:</strong> {scrapeSummary.status || "ok"}
        </div>
        {scrapeSummary.summary && (
          <>
            <div>
              <strong>Saved:</strong> {scrapeSummary.summary.saved} &nbsp; |{" "}
              <strong>Failed:</strong> {scrapeSummary.summary.failed}
            </div>
            <div>
              <strong>Scrape file:</strong>{" "}
              <span className="font-mono break-all">
                {scrapeSummary.file || scrapeSummary.summary.filename}
              </span>
            </div>
          </>
        )}
      </div>
    );
  };

  // ----------------- JSX -----------------

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center py-8">
      <div className="w-full max-w-5xl bg-white shadow-xl rounded-2xl p-6 md:p-8">
        <h1 className="text-2xl md:text-3xl font-bold text-center text-slate-800 mb-2">
          📰 Search & Scrape News
        </h1>
        <p className="text-center text-slate-500 mb-6 text-sm md:text-base">
          Uses <code>http://localhost:2000/api</code> to search Google News and
          scrape full articles.
        </p>

        {/* ERROR */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* SEARCH FORM */}
        <form
          onSubmit={handleSearch}
          className="bg-slate-50 border border-slate-200 rounded-xl p-4 md:p-5 mb-6"
        >
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Query
              </label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. শেখ হাসিনা"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                From year (optional)
              </label>
              <input
                type="number"
                value={fromYear}
                onChange={(e) => setFromYear(e.target.value)}
                placeholder="2011"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                To year (optional)
              </label>
              <input
                type="number"
                value={toYear}
                onChange={(e) => setToYear(e.target.value)}
                placeholder="2025"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Limit
              </label>
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                min="1"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Filename for search results (saved in /data)
              </label>
              <input
                type="text"
                value={searchFilename}
                onChange={(e) => setSearchFilename(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loadingSearch}
              className={`px-5 py-2 rounded-lg text-sm font-semibold text-white ${
                loadingSearch
                  ? "bg-blue-300 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {loadingSearch ? "Searching..." : "Search & Save"}
            </button>
          </div>
        </form>

        {renderSearchMeta()}

        {/* SCRAPE CONTROLS */}
        {searchResults.length > 0 && (
          <div className="mt-6 bg-slate-50 border border-slate-200 rounded-xl p-4 md:p-5">
            <h2 className="text-lg font-semibold text-slate-800 mb-3">
              Scrape all search results
            </h2>

            <div className="flex flex-col md:flex-row gap-4 items-end mb-4">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Filename for scraped articles (combined JSON in /data)
                </label>
                <input
                  type="text"
                  value={scrapeFilename}
                  onChange={(e) => setScrapeFilename(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <button
                type="button"
                onClick={handleScrapeAll}
                disabled={loadingScrape}
                className={`px-5 py-2 rounded-lg text-sm font-semibold text-white ${
                  loadingScrape
                    ? "bg-green-300 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {loadingScrape ? "Scraping..." : "Scrape ALL Results"}
              </button>
            </div>

            {renderScrapeSummary()}
          </div>
        )}

        {/* RESULTS TABLE */}
        {searchResults.length > 0 && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-3">
              Search Results ({searchResults.length})
            </h2>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="max-h-[420px] overflow-y-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                        #
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                        Title
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                        Source
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((item, idx) => (
                      <tr
                        key={item.link || idx}
                        className={
                          idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                        }
                      >
                        <td className="px-3 py-2 align-top text-xs text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2 align-top">
                          {item.link ? (
                            <a
                              href={item.link}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              {item.title || "(no title)"}
                            </a>
                          ) : (
                            <span>{item.title || "(no title)"}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top text-xs text-slate-600 whitespace-nowrap">
                          {item.source || "-"}
                        </td>
                        <td className="px-3 py-2 align-top text-xs text-slate-600 whitespace-nowrap">
                          {item.day && item.month && item.year
                            ? `${item.day} ${item.month} ${item.year}`
                            : item.pubDate || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <footer className="mt-8 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Scraper UI – React + Tailwind
        </footer>
      </div>
    </div>
  );
}

export default App;

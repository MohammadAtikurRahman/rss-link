// src/components/AllScrapeForm.jsx
import { useState } from "react";

const API_BASE = "http://localhost:2000";

export default function AllScrapeForm() {
  const [query, setQuery] = useState("শেখ হাসিনা");
  const [subQuery, setSubQuery] = useState("বাংলাদেশ, ঢাকা, প্রধানমন্ত্রী");
  const [limit, setLimit] = useState(200);
  const [fromYear, setFromYear] = useState(2001);
  const [toYear, setToYear] = useState(2025);
  const [name, setName] = useState("Scrape-Batch");

  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setResult(null);

    if (!query.trim()) {
      setError("Query লাগবে।");
      return;
    }

    const body = {
      query: query.trim(),
      subQuery: subQuery.trim() || undefined,
      limit: Number(limit) || undefined,
      fromYear: Number(fromYear) || undefined,
      toYear: Number(toYear) || undefined,
      name: name.trim() || undefined,
    };

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/all-scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "All-scrape failed");
      }
      setResult(data);
    } catch (err) {
      setError(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4">
      <h2 className="mb-2 text-base font-semibold">/all-scrape</h2>
      <p className="mb-3 text-xs text-slate-300">
        Search → resolve → scrape → একটায় JSON file সেভ করবে।
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs text-slate-200">Query</label>
          <input
            className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs outline-none focus:border-emerald-400"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-200">
            Sub Query (কমা দিয়ে আলাদা)
          </label>
          <input
            className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs outline-none focus:border-emerald-400"
            value={subQuery}
            onChange={(e) => setSubQuery(e.target.value)}
          />
        </div>

        <div className="grid gap-3 grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs text-slate-200">Limit</label>
            <input
              type="number"
              className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs outline-none focus:border-emerald-400"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-200">From</label>
            <input
              type="number"
              className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs outline-none focus:border-emerald-400"
              value={fromYear}
              onChange={(e) => setFromYear(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-200">To</label>
            <input
              type="number"
              className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs outline-none focus:border-emerald-400"
              value={toYear}
              onChange={(e) => setToYear(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-200">Save name</label>
          <input
            className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs outline-none focus:border-emerald-400"
            value={name}
            placeholder="Save File Name"
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <button
          type="submit"
          className="rounded bg-emerald-500 px-3 py-1 text-xs font-medium text-slate-900 disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Working..." : "Run /all-scrape"}
        </button>
      </form>

      {error && (
        <p className="mt-2 text-xs text-red-400">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-3">
          {result.outPath && (
            <p className="mb-1 text-[11px] text-emerald-300">
              Saved file: <span className="font-mono">{result.outPath}</span>
            </p>
          )}
          <pre className="max-h-64 overflow-auto rounded bg-slate-900 p-2 text-[11px]">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

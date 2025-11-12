// src/components/ScrapeForm.jsx
import { useState } from "react";

const API_BASE = "http://localhost:2000";

export default function ScrapeForm() {
  const [url, setUrl] = useState("");
  const [urlsText, setUrlsText] = useState("");
  const [name, setName] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setResult(null);

    const body = {};

    if (urlsText.trim()) {
      const list = urlsText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (!list.length) {
        setError("কমপক্ষে একটা URL দিন (multi lines এ).");
        return;
      }
      body.urls = list;
    } else if (url.trim()) {
      body.url = url.trim();
    } else {
      setError("একটা URL বা একাধিক URL দিতে হবে।");
      return;
    }

    if (name.trim()) body.name = name.trim();

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Scrape failed");
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
      <h2 className="mb-2 text-base font-semibold">/scrape</h2>
      <p className="mb-3 text-xs text-slate-300">
        এক বা একাধিক URL দিয়ে সরাসরি স্ক্র্যাপ করবে।
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs text-slate-200">Single URL (optional)</label>
          <input
            className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs outline-none focus:border-emerald-400"
            placeholder="https://example.com/article"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-200">
            Multiple URLs (one per line, optional)
          </label>
          <textarea
            className="h-24 w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs outline-none focus:border-emerald-400"
            placeholder={"https://example.com/a\nhttps://example.com/b"}
            value={urlsText}
            onChange={(e) => setUrlsText(e.target.value)}
          />
          <p className="text-[10px] text-slate-400">
            যদি multi URLs দেন, single URL ফিল্ড ignore হবে।
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-200">Save name (optional)</label>
          <input
            className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs outline-none focus:border-emerald-400"
            placeholder="hasina-2025"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <button
          type="submit"
          className="rounded bg-emerald-500 px-3 py-1 text-xs font-medium text-slate-900 disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Working..." : "Run /scrape"}
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

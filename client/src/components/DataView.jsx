// src/components/DataView.jsx
import { useMemo, useState } from "react";

// --- helpers ---
const getHost = (u) => {
  try { return new URL(u).hostname.replace(/^www\./, ""); }
  catch { return ""; }
};

const getYear = (isoOrDate) => {
  if (!isoOrDate) return null;
  const d = new Date(isoOrDate);
  return Number.isNaN(d.getTime()) ? null : d.getFullYear();
};

const pickText = (item) => {
  if (Array.isArray(item.paragraphs) && item.paragraphs.length) {
    return item.paragraphs.join("\n\n");
  }
  return item.text || "";
};

export default function DataView() {
  const [fileName, setFileName] = useState("");
  const [raw, setRaw] = useState(null);
  const [error, setError] = useState("");

  // filters
  const [yearFilter, setYearFilter] = useState("");
  const [paperFilter, setPaperFilter] = useState("");
  const [search, setSearch] = useState("");

  // selection (for details drawer)
  const [active, setActive] = useState(null);

  function handlePick(e) {
    setError("");
    setRaw(null);
    setActive(null);

    const f = e.target.files?.[0];
    if (!f) return;

    if (!f.name.toLowerCase().endsWith(".json")) {
      setError("Please select a .json file.");
      return;
    }

    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        setRaw(parsed);
      } catch {
        setError("Invalid JSON.");
      }
    };
    reader.onerror = () => setError("Failed to read file.");
    reader.readAsText(f);
  }

  // normalize rows (works for /scrape and /all-scrape)
  const rows = useMemo(() => {
    const items = Array.isArray(raw?.items) ? raw.items : [];
    return items.map((it, idx) => {
      // common fields across both payloads
      const title = it.title || "(No title)";
      const link = it.resolvedUrl || it.canonical || it.url || it.link || it.googleLink || "";
      const paper = it.source || getHost(link) || getHost(it.googleLink || "");
      const text = pickText(it);
      const year = it.year ?? getYear(it.isoDate || it.pubDate || it.publishedAt);
      const date = it.isoDate || it.pubDate || it.publishedAt || null;

      return {
        id: idx + "-" + (link || title),
        title,
        paper,
        link,
        google: it.googleLink || null,
        year,
        date,
        text,
        raw: it,
      };
    });
  }, [raw]);

  // distinct filter choices
  const years = useMemo(() => {
    const set = new Set(rows.map(r => r.year).filter(Boolean));
    return Array.from(set).sort((a,b)=>b-a);
  }, [rows]);

  const papers = useMemo(() => {
    const set = new Set(rows.map(r => r.paper).filter(Boolean));
    return Array.from(set).sort((a,b)=> a.localeCompare(b));
  }, [rows]);

  // apply filters + search
  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (yearFilter && String(r.year) !== String(yearFilter)) return false;
      if (paperFilter && r.paper !== paperFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${r.title} ${r.paper} ${r.text}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, yearFilter, paperFilter, search]);

  return (
    <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <h2 className="mb-1 text-lg font-semibold">Data View</h2>
      <p className="mb-4 text-xs text-slate-400">
        Pick a saved <span className="font-mono">.json</span>, then filter by Year/Paper. Click a row to read the scraped text.
      </p>

      {/* file picker */}
      <div className="mb-4">
        <label className="text-xs">Choose JSON file</label>
        <input
          type="file"
          accept=".json,application/json"
          onChange={handlePick}
          className="mt-2 block w-full cursor-pointer rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 file:mr-3 file:rounded file:border-0 file:bg-slate-800 file:px-3 file:py-1 file:text-xs file:text-slate-100 hover:file:bg-slate-700"
        />
        {fileName && (
          <p className="mt-2 text-[11px] text-slate-400">Selected: {fileName}</p>
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* controls */}
      {rows.length > 0 && (
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[11px] text-slate-300">Year</label>
            <select
              value={yearFilter}
              onChange={(e)=>setYearFilter(e.target.value)}
              className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs outline-none"
            >
              <option value="">All</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-300">Paper</label>
            <select
              value={paperFilter}
              onChange={(e)=>setPaperFilter(e.target.value)}
              className="min-w-[12rem] rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs outline-none"
            >
              <option value="">All</option>
              {papers.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-[11px] text-slate-300">Search (title/text)</label>
            <input
              value={search}
              onChange={(e)=>setSearch(e.target.value)}
              placeholder="type to filter…"
              className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs outline-none"
            />
          </div>

          <div className="ml-auto text-[11px] text-slate-400">
            Showing <span className="text-emerald-300">{filtered.length}</span> of {rows.length}
          </div>
        </div>
      )}

      {/* table */}
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="min-w-full text-left text-[12px]">
            <thead className="bg-slate-950/70 text-slate-300">
              <tr>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2 w-40">Paper</th>
                <th className="px-3 py-2 w-20">Year</th>
                <th className="px-3 py-2 w-20">Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-800/40">
                  <td className="px-3 py-2">
                    <button
                      className="text-left text-emerald-300 hover:underline"
                      onClick={() => setActive(r)}
                      title="Click to view scraped text"
                    >
                      {r.title}
                    </button>
                  </td>
                  <td className="px-3 py-2">{r.paper || "-"}</td>
                  <td className="px-3 py-2">{r.year ?? "-"}</td>
                  <td className="px-3 py-2">
                    {r.link ? (
                      <a
                        href={r.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-300 hover:underline"
                        title={r.link}
                      >
                        open
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* drawer / details */}
      {active && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40">
          <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-slate-800 bg-slate-900 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold leading-5">{active.title}</h3>
              <button
                onClick={()=>setActive(null)}
                className="rounded bg-slate-800 px-2 py-1 text-[12px] text-slate-100 hover:bg-slate-700"
              >
                Close
              </button>
            </div>

            <div className="mb-3 text-[12px] text-slate-300">
              <div className="mb-1">
                <span className="text-slate-400">Paper:</span> {active.paper || "-"}
              </div>
              <div className="mb-1">
                <span className="text-slate-400">Year:</span> {active.year ?? "-"}
              </div>
              <div className="mb-1">
                <span className="text-slate-400">Link:</span>{" "}
                {active.link ? (
                  <a href={active.link} target="_blank" rel="noreferrer" className="text-emerald-300 hover:underline">
                    {active.link}
                  </a>
                ) : "-"}
              </div>
              {active.google && (
                <div className="mb-1">
                  <span className="text-slate-400">Google:</span>{" "}
                  <a href={active.google} target="_blank" rel="noreferrer" className="text-slate-300 hover:underline">
                    {active.google}
                  </a>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-950">
              <div className="border-b border-slate-800 px-3 py-2 text-[12px] text-slate-300">
                Scraped Text
              </div>
              <div className="max-h-[70vh] overflow-y-auto">
                <pre className="whitespace-pre-wrap px-3 py-3 text-[12px] leading-6 text-slate-100">
                  {active.text || "(no text found)"}
                </pre>
              </div>
            </div>

            <div className="mt-3 text-[11px]">
              <button
                onClick={() => navigator.clipboard.writeText(active.text || "")}
                className="rounded bg-slate-800 px-2 py-1 text-slate-100 hover:bg-slate-700"
              >
                Copy text
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

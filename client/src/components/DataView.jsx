import { useState } from "react";

export default function DataView() {
  const [fileName, setFileName] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  function handlePick(e) {
    setError("");
    setData(null);

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
        setData(parsed);
      } catch (err) {
        setError("Invalid JSON file.");
      }
    };
    reader.onerror = () => setError("Failed to read file.");
    reader.readAsText(f);
  }

  function copyJson() {
    if (!data) return;
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  }

  // small helpers to show some quick stats if present
  const items = Array.isArray(data?.items) ? data.items : [];
  const stats = {
    total: data?.total ?? data?.totalFound,
    count: data?.count ?? data?.scrapedCount ?? items.length,
    failed: data?.failed,
  };

  return (
    <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <h2 className="mb-1 text-lg font-semibold">Data View</h2>
      <p className="mb-4 text-xs text-slate-400">
        Pick any <span className="font-mono">.json</span> file (e.g., a file saved by <em>/all-scrape</em> or <em>/scrape</em>) and preview it here.
      </p>

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

      {data && (
        <div className="mt-4 min-w-0">
          {/* Quick header / stats */}
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px]">
            {typeof stats.total !== "undefined" && (
              <span className="rounded bg-slate-800 px-2 py-1">total: <span className="text-emerald-300">{String(stats.total)}</span></span>
            )}
            {typeof stats.count !== "undefined" && (
              <span className="rounded bg-slate-800 px-2 py-1">count: <span className="text-emerald-300">{String(stats.count)}</span></span>
            )}
            {typeof stats.failed !== "undefined" && (
              <span className="rounded bg-slate-800 px-2 py-1">failed: <span className="text-emerald-300">{String(stats.failed)}</span></span>
            )}
            {data.outPath && (
              <span className="rounded bg-emerald-900/30 px-2 py-1 text-emerald-200">
                saved: <span className="font-mono">{data.outPath}</span>
              </span>
            )}
          </div>

          {/* Scrollable JSON viewer */}
          <div className="rounded-xl border border-slate-700 bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2 text-[12px]">
              <span className="text-slate-300">Preview JSON</span>
              <button
                onClick={copyJson}
                className="rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-100 hover:bg-slate-700"
              >
                Copy
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              <div className="overflow-x-auto">
                <pre className="m-0 whitespace-pre p-3 text-[11px] leading-5 text-slate-200">
{JSON.stringify(data, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

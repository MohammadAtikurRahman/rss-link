import { useState } from "react";
import ScrapeForm from "./components/ScrapeForm.jsx";
import AllScrapeForm from "./components/AllScrapeForm.jsx";
import DataView from "./components/DataView.jsx"; // 👈 NEW

function NavButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg px-3 py-2 text-sm transition
        ${active ? "bg-emerald-500 text-slate-900" : "bg-slate-800/60 text-slate-200 hover:bg-slate-800"}`}
    >
      {children}
    </button>
  );
}

export default function App() {
  const [active, setActive] = useState("scrape"); // "scrape" | "all" | "dataview"

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="mx-auto flex max-w-6xl gap-4 px-4 py-6">

        {/* Sidebar */}
        <aside className="w-56 shrink-0">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <h1 className="mb-3 text-lg font-semibold">News Scraper</h1>
            <div className="space-y-2">
              <NavButton active={active === "scrape"} onClick={() => setActive("scrape")}>
                Scrape
              </NavButton>
              <NavButton active={active === "all"} onClick={() => setActive("all")}>
                All Scrap
              </NavButton>
              <NavButton active={active === "dataview"} onClick={() => setActive("dataview")}>
                Data View
              </NavButton>
            </div>

            <div className="mt-6 rounded-lg bg-slate-800/40 p-3 text-[11px] leading-5">
              <div className="text-slate-300">API</div>
              <div className="font-mono text-emerald-300">http://localhost:2000</div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {active === "scrape" && <ScrapeForm />}
          {active === "all" && <AllScrapeForm />}
          {active === "dataview" && <DataView />}   {/* 👈 NEW */}
        </main>
      </div>
    </div>
  );
}

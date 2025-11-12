// src/App.jsx
import { useState } from "react";
import ScrapeForm from "./components/ScrapeForm.jsx";
import AllScrapeForm from "./components/AllScrapeForm.jsx";

export default function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="mx-auto max-w-4xl px-4 py-6">
        <h1 className="mb-2 text-2xl font-semibold">News Scraper</h1>
        <p className="mb-6 text-sm text-slate-400">
          Backend running on <span className="font-mono text-emerald-300">http://localhost:2000</span>
        </p>

        <div className="grid gap-6 md:grid-cols-2">
          <ScrapeForm />
          <AllScrapeForm />
        </div>
      </div>
    </div>
  );
}

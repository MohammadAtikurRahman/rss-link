// route.js
import { Router } from "express";
import { resolveArticleController } from "./controller/resolveController.js";
import {
  searchController,
  resolvedSearchController,
} from "./controller/searchController.js";
import { scrapeController } from "./controller/scrapeController.js";
import { allScrapeController } from "./controller/allScrapeController.js";

const router = Router();

router.post("/resolve", resolveArticleController);
router.post("/search", searchController);
router.post("/resolved-search", resolvedSearchController);

// NEW: scrape API
router.post("/scrape", scrapeController);
router.post("/all-scrape", allScrapeController);

export default router;

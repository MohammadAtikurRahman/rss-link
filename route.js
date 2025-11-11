// route.js
import { Router } from "express";
import { resolveArticleController } from "./controller/resolveController.js";
import {
  searchController,
  resolvedSearchController,
} from "./controller/searchController.js";

import { scrapeController } from "./controller/scrapeController.js";

const router = Router();

// main resolve API: POST /resolve
router.post("/resolve", resolveArticleController);

// search API: POST /search
router.post("/search", searchController);

// resolved-search API: POST /resolved-search
router.post("/resolved-search", resolvedSearchController);

// NEW: scrape API: POST /scrape
router.post("/scrape", scrapeController);

export default router;

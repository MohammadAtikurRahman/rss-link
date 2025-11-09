// route.js
import { Router } from "express";
import { resolveArticleController } from "./controller/resolveController.js";
import { searchController } from "./controller/searchController.js";

const router = Router();

// main resolve: POST /resolve
router.post("/", resolveArticleController);

// search API: POST /resolve/search
router.post("/resolved",resolveArticleController)
router.post("/search",searchController);

export default router;

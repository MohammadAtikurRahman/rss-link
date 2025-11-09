// route.js
import { Router } from "express";
import { resolveArticleController } from "./controller/resolveController.js";

const router = Router();

// এই রাউটের main function = একটাই controller
router.post("/", resolveArticleController);

export default router;

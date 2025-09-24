import { Router } from "express";
import stats from "../controllers/stats.js";
import rateLimit from "express-rate-limit";

const router = Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { error: "Занадто багато запитів. Спробуйте через хвилину." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get("/conversions", stats.getConversions, limiter);

export default router;

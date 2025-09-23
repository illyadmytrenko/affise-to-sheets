import { Router } from "express";
import stats from "../controllers/stats.js";

const router = Router();

router.get("/conversions", stats.getConversions);

export default router;

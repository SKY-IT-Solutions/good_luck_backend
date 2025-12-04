import express from "express";
import { getAffiliateByPhone } from "../../controllers/affiliate/affiliate.controller.js";

const router = express.Router();

router.get("/phone/:phone", getAffiliateByPhone);

export default router;

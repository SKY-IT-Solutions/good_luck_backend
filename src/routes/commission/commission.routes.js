import express from "express";
import {
  getCommissionHistory,
} from "../../controllers/commission/commission.controller.js";

const router = express.Router();

// Commission history routes
router.get("/:promoterType/:promoterId", getCommissionHistory);


export default router;

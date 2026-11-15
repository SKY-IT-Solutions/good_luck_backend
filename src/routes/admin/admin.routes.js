import express from "express";
import { getAdminTotalBalance, getAdminTransactionHistory } from "../../controllers/admin/admin.controller.js";
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const router = express.Router();

// Route to create a HomeBanner ad and a corresponding ServiceAd
router.get("/getBalance/:adminId", getAdminTotalBalance);
router.get("/transaction/:adminId", getAdminTransactionHistory);


export default router;

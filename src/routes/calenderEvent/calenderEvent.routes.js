import express from "express";
import { addImageToEvent, createCalendarEvent, deleteCalendarEventById, getAllCalendarEvents, getEventsByType, removeImageFromEvent, updateCalendarEventById } from './../../controllers/calenderEvent/calenderEvent.controller.js';


const router = express.Router();

router.post("/", createCalendarEvent);
router.get("/", getAllCalendarEvents);
router.get("/type/:eventType", getEventsByType);
router.put("/:id", updateCalendarEventById);
router.patch("/:id/add-image", addImageToEvent);
router.patch("/:id/remove-image", removeImageFromEvent);
router.delete("/:id", deleteCalendarEventById);

export default router;

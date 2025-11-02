import { CalendarEvent } from "../../models/calenderEvent/calenderEvent.model.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

// Create new calendar event
export const createCalendarEvent = asyncHandler(async (req, res) => {
  const { eventType, images } = req.body;

  // Check required fields
  if (!eventType) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Event type is required"));
  }

  // Event type validation
  const validEventTypes = [
    "pujodate",
    "bibahodate",
    "omabossya",
    "purnima",
    "ekadosi",
    "suvodin",
    "sastrokotha",
  ];

  if (!validEventTypes.includes(eventType)) {
    return res
      .status(400)
      .json(
        new ApiResponse(
          400,
          null,
          `Invalid event type. Please choose from: ${validEventTypes.join(", ")}`
        )
      );
  }

  // Create event
  const calendarEvent = await CalendarEvent.create({
    eventType,
    images: images || [],
  });

  return res
    .status(201)
    .json(
      new ApiResponse(201, calendarEvent, "Calendar event created successfully")
    );
});

// Get all calendar events
export const getAllCalendarEvents = asyncHandler(async (req, res) => {
  const calendarEvents = await CalendarEvent.find().sort({ createdAt: -1 });
  res.status(200).json(new ApiResponse(200, calendarEvents, "Success"));
});

// Get events by type
export const getEventsByType = asyncHandler(async (req, res) => {
  const { eventType } = req.params;

  if (!eventType) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Event type parameter is required"));
  }

  const events = await CalendarEvent.find({ eventType }).sort({
    createdAt: -1,
  });

  if (events.length === 0) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "No events found for this type"));
  }

  res
    .status(200)
    .json(new ApiResponse(200, events, "Events retrieved successfully"));
});

// Update calendar event by ID
export const updateCalendarEventById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { eventType, images } = req.body;

  // Check required fields
  if (!eventType) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Event type is required"));
  }

  // Event type validation
  const validEventTypes = [
    "pujodate",
    "bibahodate",
    "omabossya",
    "purnima",
    "ekadosi",
    "suvodin",
    "sastrokotha",
  ];

  if (!validEventTypes.includes(eventType)) {
    return res
      .status(400)
      .json(
        new ApiResponse(
          400,
          null,
          `Invalid event type. Please choose from: ${validEventTypes.join(", ")}`
        )
      );
  }

  // Update event
  const updatedEvent = await CalendarEvent.findByIdAndUpdate(
    id,
    { eventType, images: images || [] },
    { new: true, runValidators: true }
  );

  // If event not found
  if (!updatedEvent) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Calendar event not found"));
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedEvent, "Calendar event updated successfully")
    );
});

// Add image to event
export const addImageToEvent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { imageUrl } = req.body;

  if (!imageUrl) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Image URL is required"));
  }

  const updatedEvent = await CalendarEvent.findByIdAndUpdate(
    id,
    { $push: { images: imageUrl } },
    { new: true, runValidators: true }
  );

  if (!updatedEvent) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Calendar event not found"));
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedEvent, "Image added to event successfully")
    );
});

// Remove image from event
export const removeImageFromEvent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { imageUrl } = req.body;

  if (!imageUrl) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Image URL is required"));
  }

  const updatedEvent = await CalendarEvent.findByIdAndUpdate(
    id,
    { $pull: { images: imageUrl } },
    { new: true }
  );

  if (!updatedEvent) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Calendar event not found"));
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedEvent,
        "Image removed from event successfully"
      )
    );
});

// Delete calendar event by ID
export const deleteCalendarEventById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const deletedEvent = await CalendarEvent.findByIdAndDelete(id);

  if (!deletedEvent) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Calendar event not found"));
  }

  res
    .status(200)
    .json(new ApiResponse(200, null, "Calendar event deleted successfully"));
});

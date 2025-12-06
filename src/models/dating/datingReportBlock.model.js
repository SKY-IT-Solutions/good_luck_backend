import mongoose, { Schema } from "mongoose";

const datingReportBlockSchema = new Schema(
  {
    reporterId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reportedId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    blockerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    blockedId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reportReason: {
      type: String,
      enum: [
        "inappropriate_content",
        "fake_profile",
        "harassment",
        "spam",
        "underage",
        "other",
      ],
    },
    reportDescription: {
      type: String,
      maxlength: 500,
    },
    reportStatus: {
      type: String,
      enum: ["pending", "reviewed", "resolved", "dismissed"],
      default: "pending",
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    blockedAt: {
      type: Date,
    },
    unblockedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate reports for the same user pair
datingReportBlockSchema.index(
  { reporterId: 1, reportedId: 1 },
  { unique: true, partialFilterExpression: { reportReason: { $exists: true } } }
);

// Prevent duplicate blocks for the same user pair
datingReportBlockSchema.index(
  { blockerId: 1, blockedId: 1 },
  { unique: true, partialFilterExpression: { isBlocked: true } }
);

export const DatingReportBlock = mongoose.model(
  "DatingReportBlock",
  datingReportBlockSchema
);

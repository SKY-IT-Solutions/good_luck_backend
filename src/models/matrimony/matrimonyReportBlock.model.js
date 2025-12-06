import mongoose, { Schema } from "mongoose";

const matrimonyReportBlockSchema = new Schema(
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
        "fake_profile",
        "harassment",
        "financial_fraud",
        "misinformation",
        "inappropriate_content",
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
      enum: ["pending", "investigating", "resolved", "dismissed"],
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
    adminNotes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
matrimonyReportBlockSchema.index(
  { reporterId: 1, reportedId: 1 },
  { unique: true, partialFilterExpression: { reportReason: { $exists: true } } }
);

matrimonyReportBlockSchema.index(
  { blockerId: 1, blockedId: 1 },
  { unique: true, partialFilterExpression: { isBlocked: true } }
);

export const MatrimonyReportBlock = mongoose.model(
  "MatrimonyReportBlock",
  matrimonyReportBlockSchema
);

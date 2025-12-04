import mongoose from "mongoose";

const { Schema, model } = mongoose;

const commissionHistorySchema = new Schema(
  {
    promoterId: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: "promoterType",
    },
    promoterType: {
      type: String,
      required: true,
      enum: ["Astrologer", "AffiliateMarketer"],
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    promoCode: {
      type: String,
      required: true,
    },
    orderAmount: {
      type: Number,
      required: true,
    },
    commissionAmount: {
      type: Number,
      required: true,
    },
    commissionPercentage: {
      type: Number,
      default: 30,
    },
    transactionId: {
      type: String,
      required: true,
    },
    orderDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["pending", "credited", "cancelled"],
      default: "credited",
    },
  },
  {
    timestamps: true,
  }
);

const CommissionHistory = model("CommissionHistory", commissionHistorySchema);

export default CommissionHistory;

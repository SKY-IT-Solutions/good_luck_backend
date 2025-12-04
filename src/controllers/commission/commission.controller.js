import AffiliateMarketer from "../../models/affiliateMarketer/affiliateMarketer.model.js";
import { Astrologer } from "../../models/astrologer/astroler.model.js";
import CommissionHistory from "../../models/commission/commission.model.js";
import mongoose from "mongoose";
import { ApiResponse } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

// Get Commission History for Promoter (Astrologer/Affiliate)
export const getCommissionHistory = asyncHandler(async (req, res) => {
  try {
    const { promoterId, promoterType } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Validate promoter type
    if (!["Astrologer", "AffiliateMarketer"].includes(promoterType)) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Invalid promoter type"));
    }

    // Verify promoter exists
    let promoter;
    if (promoterType === "Astrologer") {
      promoter = await Astrologer.findById(promoterId);
    } else {
      promoter = await AffiliateMarketer.findById(promoterId);
    }

    if (!promoter) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Promoter not found"));
    }

    // Get total count for pagination
    const totalCount = await CommissionHistory.countDocuments({
      promoterId: promoterId,
      promoterType: promoterType,
    });

    // Get commission history with populated data
    const commissionHistory = await CommissionHistory.find({
      promoterId: promoterId,
      promoterType: promoterType,
    })
      .populate({
        path: "orderId",
        select:
          "name city state phone quantity total_price payment_method delivery_date createdAt transaction_id",
        populate: {
          path: "order_details",
          select: "productName image productDescription category brand weight originalPrice displayPrice",
          populate: {
            path: "category",
            select: "categoryName description",
          },
        },
      })
      .populate({
        path: "userId",
        select: "Fname Lname phone profile_picture email",
      })
      .populate({
        path: "productId",
        select: "productName image productDescription category brand weight originalPrice displayPrice",
        populate: {
          path: "category",
          select: "categoryName description",
        },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get aggregated statistics
    const stats = await CommissionHistory.aggregate([
      {
        $match: {
          promoterId: new mongoose.Types.ObjectId(promoterId), // Fixed: use new keyword
          promoterType: promoterType,
        },
      },
      {
        $group: {
          _id: null,
          totalCommission: { $sum: "$commissionAmount" },
          totalOrders: { $sum: 1 },
          pendingCommission: {
            $sum: {
              $cond: [{ $eq: ["$status", "pending"] }, "$commissionAmount", 0],
            },
          },
          creditedCommission: {
            $sum: {
              $cond: [{ $eq: ["$status", "credited"] }, "$commissionAmount", 0],
            },
          },
        },
      },
    ]);

    // Get monthly earnings for the last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyEarnings = await CommissionHistory.aggregate([
      {
        $match: {
          promoterId: new mongoose.Types.ObjectId(promoterId), // Fixed: use new keyword
          promoterType: promoterType,
          createdAt: { $gte: sixMonthsAgo },
          status: "credited",
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          monthlyCommission: { $sum: "$commissionAmount" },
          orderCount: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 }, // Changed to ascending for chronological order
      },
      {
        $limit: 6,
      },
    ]);

    // Format monthly earnings
    const formattedMonthlyEarnings = monthlyEarnings.map((item) => ({
      month: new Date(item._id.year, item._id.month - 1).toLocaleString(
        "default",
        { month: "short", year: "2-digit" }
      ),
      commission: item.monthlyCommission,
      orders: item.orderCount,
    }));

    const statsData = stats[0] || {
      totalCommission: 0,
      totalOrders: 0,
      pendingCommission: 0,
      creditedCommission: 0,
    };

    // Calculate average commission
    const averageCommission =
      statsData.totalOrders > 0
        ? statsData.totalCommission / statsData.totalOrders
        : 0;

    // Get successful orders count
    const successfulOrders = commissionHistory.filter(
      (record) => record.status === "credited"
    ).length;

    // Format commission history with better structure
    const formattedHistory = commissionHistory.map((record) => {
      // Safely handle product data from order_details
      let productFromOrder = null;
      if (record.orderId?.order_details) {
        const product = record.orderId.order_details;
        productFromOrder = {
          id: product._id,
          name: product.productName,
          image: product.image,
          description: product.productDescription,
          category: product.category?.categoryName || "Uncategorized",
          brand: product.brand,
          weight: product.weight,
          originalPrice: product.originalPrice,
          displayPrice: product.displayPrice,
        };
      }

      // Safely handle product data from productId
      let productFromProductId = null;
      if (record.productId) {
        const product = record.productId;
        productFromProductId = {
          id: product._id,
          name: product.productName,
          image: product.image,
          description: product.productDescription,
          category: product.category?.categoryName || "Uncategorized",
          brand: product.brand,
          weight: product.weight,
          originalPrice: product.originalPrice,
          displayPrice: product.displayPrice,
        };
      }

      return {
        id: record._id,
        promoterId: record.promoterId,
        promoterType: record.promoterType,
        order: {
          id: record.orderId?._id || null,
          details: {
            name: record.orderId?.name || "N/A",
            city: record.orderId?.city || "N/A",
            state: record.orderId?.state || "N/A",
            phone: record.orderId?.phone || "N/A",
            deliveryDate: record.orderId?.delivery_date
              ? new Date(record.orderId.delivery_date).toISOString().split("T")[0]
              : null,
            quantity: record.orderId?.quantity || 1,
            totalPrice: record.orderId?.total_price || 0,
            paymentMethod: record.orderId?.payment_method || "N/A",
            transactionId: record.orderId?.transaction_id || "N/A",
            orderDate: record.orderId?.createdAt
              ? new Date(record.orderId.createdAt).toISOString()
              : null,
          },
          product: productFromOrder,
        },
        user: record.userId
          ? {
              id: record.userId._id,
              name: `${record.userId.Fname || ""} ${record.userId.Lname || ""}`.trim(),
              phone: record.userId.phone,
              email: record.userId.email || "N/A",
              profilePicture: record.userId.profile_picture || null,
            }
          : null,
        productDetails: productFromProductId,
        commissionDetails: {
          promoCode: record.promoCode || "N/A",
          orderAmount: record.orderAmount || 0,
          commissionAmount: record.commissionAmount || 0,
          commissionPercentage: record.commissionPercentage || 0,
          status: record.status || "pending",
          transactionId: record.transactionId || "N/A",
          orderDate: record.orderDate ? new Date(record.orderDate).toISOString() : null,
        },
        timeline: {
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        },
      };
    });

    // Build promoter info
    const promoterInfo = {
      id: promoter._id,
      name: `${promoter.Fname || ""} ${promoter.Lname || ""}`.trim() || "Unnamed Promoter",
      phone: promoter.phone || "N/A",
      email: promoter.email || "N/A",
      profilePicture: promoter.profile_picture || null,
      promoCode: promoter.promo_code || promoter.promoCode || "N/A",
      type: promoterType,
      joinDate: promoter.createdAt || new Date().toISOString(),
      isActive: promoter.isActive !== false,
    };

    const response = {
      promoterInfo,
      statistics: {
        total: {
          commission: statsData.totalCommission,
          orders: statsData.totalOrders,
          averageCommission: averageCommission.toFixed(2),
        },
        byStatus: {
          pending: statsData.pendingCommission,
          credited: statsData.creditedCommission,
        },
        monthlyEarnings: formattedMonthlyEarnings,
      },
      commissionHistory: formattedHistory,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalItems: totalCount,
        itemsPerPage: parseInt(limit),
        hasNextPage: skip + parseInt(limit) < totalCount,
        hasPreviousPage: parseInt(page) > 1,
      },
      summary: {
        totalOrders: statsData.totalOrders,
        totalCommission: statsData.totalCommission,
        pendingCommission: statsData.pendingCommission,
        availableCommission: statsData.creditedCommission,
        averageCommission: averageCommission.toFixed(2),
        successRate: statsData.totalOrders > 0 
          ? ((successfulOrders / statsData.totalOrders) * 100).toFixed(2)
          : "0.00",
      },
    };

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          response,
          "Commission history retrieved successfully"
        )
      );
  } catch (error) {
    console.error("Error getting commission history:", error);
    return res
      .status(500)
      .json(
        new ApiResponse(
          500, 
          null, 
          "Internal Server Error", 
          error.message
        )
      );
  }
});
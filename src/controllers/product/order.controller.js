import { Admin } from "../../models/admin/admin.model.js";
import AffiliateMarketer from "../../models/affiliateMarketer/affiliateMarketer.model.js";
import { Astrologer } from "../../models/astrologer/astroler.model.js";
import { User } from "../../models/auth/user.model.js";
import CommissionHistory from "../../models/commission/commission.model.js";
import Order from "../../models/product/order.model.js";
import Product from "../../models/product/product.model.js";
import { ApiError } from "../../utils/apiError.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { generateTransactionId } from "../../utils/generateTNX.js";

// Create Order
export const createOrder = asyncHandler(async (req, res) => {
  try {
    const {
      userId,
      name,
      city,
      state,
      phone,
      order_details,
      delivery_date,
      quantity,
      total_price,
      payment_method,
      is_payment_done,
      transaction_id,
      promo_code,
      isSuperNoteApplied = false,
    } = req.body;

    const requiredFields = [
      { name: "name", message: "Name is required" },
      { name: "city", message: "City name is required" },
      { name: "state", message: "State description is required" },
      {
        name: "order_details",
        message: "Order details(Product id) are required",
      },
      { name: "total_price", message: "Total price is required" },
      { name: "payment_method", message: "Payment method is required" },
    ];

    for (const field of requiredFields) {
      if (!req.body[field.name]) {
        return res.status(400).json(new ApiResponse(400, null, field.message));
      }
    }

    const user = await User.findById(userId);
    const product = await Product.findById(order_details);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    if (!product) {
      throw new ApiError(404, "Product not found");
    }

    // Generate transaction ID if not provided
    const finalTransactionId = transaction_id || generateTransactionId();

    let commission = 0;
    let promoUser = null;
    let promoterType = null;

    // Create order first
    const newOrder = new Order({
      userId,
      name,
      city,
      state,
      phone,
      order_details,
      delivery_date,
      quantity,
      total_price,
      payment_method,
      is_payment_done,
      transaction_id: finalTransactionId,
      isPromoCodeApplied: promo_code !== undefined,
      isSuperNoteApplied,
    });

    await newOrder.save();

    if (promo_code) {
      // Check if the promo code belongs to an astrologer
      promoUser = await Astrologer.findOne({ promo_code });
      if (promoUser) {
        promoterType = "Astrologer";
      } else {
        // Check if the promo code belongs to an affiliate marketer
        promoUser = await AffiliateMarketer.findOne({ promo_code });
        if (promoUser) {
          promoterType = "AffiliateMarketer";
        }
      }

      if (!promoUser) {
        return res
          .status(404)
          .json(new ApiResponse(404, null, "Promo code is not available"));
      }

      commission = total_price * 0.3; // 30% commission

      // Update promoter's wallet
      promoUser.wallet.balance += commission;
      promoUser.wallet.transactionHistory.push({
        transactionId: finalTransactionId,
        timestamp: Date.now(),
        type: "credit",
        credit_type: "Ecom",
        amount: commission,
        description: "Commission for order",
      });
      await promoUser.save();

      // ✅ Create Commission History Record
      const commissionHistory = new CommissionHistory({
        promoterId: promoUser._id,
        promoterType: promoterType,
        orderId: newOrder._id,
        userId: userId,
        productId: order_details,
        promoCode: promo_code,
        orderAmount: total_price,
        commissionAmount: commission,
        commissionPercentage: 30,
        transactionId: finalTransactionId,
        orderDate: new Date(),
        status: "credited",
      });

      await commissionHistory.save();
      console.log("Commission History created:", commissionHistory);
    }

    // Add the remaining amount to the admin wallet
    const admin = await Admin.findOne();
    const adminCommission = total_price - commission;
    admin.wallet.balance += adminCommission;
    admin.wallet.transactionHistory.push({
      transactionId: finalTransactionId,
      timestamp: Date.now(),
      type: "credit",
      credit_type: "Ecom",
      amount: adminCommission,
      description: "Admin commission for order",
    });
    await admin.save();

    // Add transaction to user's wallet history
    user.wallet.transactionHistory.push({
      transactionId: finalTransactionId,
      timestamp: Date.now(),
      type: "debit",
      debit_type: "Ecom",
      amount: total_price,
      description: "Payment for order",
    });
    await user.save();

    // Populate the order data for response
    const populatedOrder = await Order.findById(newOrder._id)
      .populate("order_details")
      .populate("userId", "Fname Lname phone");

    return res
      .status(201)
      .json(new ApiResponse(201, populatedOrder, "Order created successfully"));
  } catch (error) {
    console.error("Error creating order:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Internal Server Error", error.message));
  }
});

// Get All Orders
export const getAllOrders = asyncHandler(async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("order_details")
      .populate("userId");

    if (!orders || orders.length === 0) {
      return res
        .status(200)
        .json(new ApiResponse(200, null, "No orders found"));
    }

    return res
      .status(200)
      .json(new ApiResponse(200, orders, "Orders retrieved successfully"));
  } catch (error) {
    throw new ApiError(500, error.message);
  }
});

// Get Order by ID
export const getOrderById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id)
      .populate("order_details")
      .populate("userId");

    if (!order) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Order not found"));
    }

    return res
      .status(200)
      .json(new ApiResponse(200, order, "Order retrieved successfully"));
  } catch (error) {
    throw new ApiError(500, error.message);
  }
});

// Get Orders by User ID
export const getOrdersByUserId = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    // Find orders for the given userId
    const orders = await Order.find({ userId: id })
      .populate("order_details")
      .populate("userId");

    // Check if no orders found
    if (orders.length === 0) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "No orders found for this user"));
    }

    return res
      .status(200)
      .json(new ApiResponse(200, orders, "Orders retrieved successfully"));
  } catch (error) {
    throw new ApiError(500, error.message);
  }
});

// Update Order by ID
export const updateOrderById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const {
      city,
      state,
      phone,
      delivery_date,
      quantity,
      total_price,
      payment_method,
      is_order_complete,
      is_payment_done,
      transaction_id,
    } = req.body;

    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      {
        city,
        state,
        phone,
        delivery_date,
        quantity,
        total_price,
        payment_method,
        is_order_complete,
        is_payment_done,
        transaction_id,
      },
      { new: true, runValidators: true }
    );

    if (!updatedOrder) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Order not found"));
    }

    return res
      .status(200)
      .json(new ApiResponse(200, updatedOrder, "Order updated successfully"));
  } catch (error) {
    throw new ApiError(500, error.message);
  }
});

// // Cancel Order
// export const cancelOrder = asyncHandler(async (req, res) => {
//   try {
//     const { id } = req.params;

//     const order = await Order.findById(id);

//     if (!order) {
//       return res
//         .status(404)
//         .json(new ApiResponse(404, null, "Order not found"));
//     }

//     if (order.is_order_complete) {
//       return res
//         .status(400)
//         .json(new ApiResponse(400, null, "Cannot cancel a completed order"));
//     }

//     order.cancel_order.isCancel = true;
//     order.cancel_order.cancel_date_time = new Date();
//     await order.save();

//     return res
//       .status(200)
//       .json(new ApiResponse(200, order, "Order canceled successfully"));
//   } catch (error) {
//     throw new ApiError(500, error.message);
//   }
// });

// Delete Order
export const deleteOrder = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findByIdAndDelete(id);

    if (!order) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Order not found"));
    }

    return res
      .status(200)
      .json(new ApiResponse(200, null, "Order deleted successfully"));
  } catch (error) {
    throw new ApiError(500, error.message);
  }
});

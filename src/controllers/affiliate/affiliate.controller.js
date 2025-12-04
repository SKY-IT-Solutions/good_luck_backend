import AffiliateMarketer from "../../models/affiliateMarketer/affiliateMarketer.model.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

// GET /api/affiliates/phone/:phone
export const getAffiliateByPhone = asyncHandler(async (req, res) => {
  try {
    const { phone } = req.params;

    if (!phone) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Phone number is required"));
    }

    // Find affiliate by phone number
    const affiliate = await AffiliateMarketer.findOne({ phone });

    if (!affiliate) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Affiliate not found"));
    }

    // Return only required fields
    const responseData = {
      id: affiliate._id,
      Fname: affiliate.Fname || "",
      Lname: affiliate.Lname || "",
      phone: affiliate.phone,
      profile_picture: affiliate.profile_picture,
      promo_code: affiliate.promo_code,
    };

    return res
      .status(200)
      .json(
        new ApiResponse(200, responseData, "Affiliate retrieved successfully")
      );
  } catch (error) {
    console.error("Error getting affiliate:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Internal server error"));
  }
});

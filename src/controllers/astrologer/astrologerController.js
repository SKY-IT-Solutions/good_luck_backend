import { v4 as uuidv4 } from "uuid";
import { ApiError } from "../../utils/apiError.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { UpdateAstrologerProfile } from "../../models/astrologer/updateAstrologer.model.js";
import generateOtp from "../../utils/otpGenerate.js";
import { User } from "../../models/auth/user.model.js";
import { Astrologer } from "../../models/astrologer/astroler.model.js";
import { Auth } from "../../models/auth/auth.model.js";
import AstrologerRequest from "../../models/astrologer/astrologerRequest.model.js";
import { generateTransactionId } from "../../utils/generateTNX.js";

// Function to generate a unique 4-digit promo code
const generateUniquePromoCode = async () => {
  let promoCode;
  let isUnique = false;

  while (!isUnique) {
    promoCode = Math.floor(1000 + Math.random() * 9000); // Generate a 4-digit number
    const existingAstrologer = await Astrologer.findOne({
      promo_code: promoCode,
    });
    if (!existingAstrologer) {
      isUnique = true;
    }
  }

  return promoCode;
};

// Create Astrologer Request
export const createAstrologerRequest = asyncHandler(async (req, res) => {
  try {
    console.log("=== CREATE ASTROLOGER REQUEST ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    const {
      Fname,
      Lname,
      phone,
      specialisation,
      chat_price,
      video_price,
      call_price,
      years_of_experience,
      profile_picture,
      description,
      language,
      certifications,
      adhar_card,
      pan_card,
    } = req.body;

    // Validate required fields
    const requiredFields = [
      "Fname",
      "Lname",
      "phone",
      "specialisation",
      "chat_price",
      "years_of_experience",
      "profile_picture",
      "description",
      "language",
      "adhar_card",
      "pan_card",
    ];

    const missingFields = requiredFields.filter((field) => {
      const value = req.body[field];
      if (value === undefined || value === null || value === "") return true;
      if (Array.isArray(value) && value.length === 0) return true;
      return false;
    });

    console.log("Missing fields:", missingFields);

    if (missingFields.length > 0) {
      console.log("Returning 400 - Missing required fields:", missingFields);
      return res.status(400).json(
        new ApiResponse(400, null, `Missing required fields: ${missingFields.join(", ")}`, {
          missingFields,
        })
      );
    }

    const existsAuth = await Auth.findOne({ phone });
    const existsUser = await User.findOne({ phone });
    const existsAstrologer = await Astrologer.findOne({ phone });

    if (!existsUser) {
      return res.status(404).json(new ApiResponse(404, null, "User not found"));
    }

    // If user already has an Astrologer record, update it with the form data
    if (existsAstrologer) {
      Object.assign(existsAstrologer, {
        Fname,
        Lname,
        specialisation,
        chat_price,
        video_price,
        call_price: call_price || 200,
        years_of_experience,
        profile_picture,
        description,
        language,
        certifications: certifications || [],
        adhar_card,
        pan_card,
      });

      await existsAstrologer.save();

      // Ensure user is marked as astrologer
      if (!existsUser.isAstrologer) {
        await User.findByIdAndUpdate(existsUser._id, { isAstrologer: true });
      }

      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            existsAstrologer,
            "Astrologer profile updated successfully"
          )
        );
    }

    // If user already has a pending astrologer request, update it
    const existingRequest = await AstrologerRequest.findOne({ phone });
    if (existingRequest) {
      Object.assign(existingRequest, {
        authId: existsAuth ? existsAuth._id : existingRequest.authId,
        userId: existsUser._id,
        Fname,
        Lname,
        specialisation,
        chat_price,
        video_price,
        call_price: call_price || 200,
        years_of_experience,
        profile_picture,
        description,
        language,
        certifications: certifications || [],
        adhar_card,
        pan_card,
        request_status: "pending",
      });

      await existingRequest.save();

      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            existingRequest,
            "Astrologer request updated successfully"
          )
        );
    }

    // Create new astrologer request
    const astrologer = new AstrologerRequest({
      authId: existsAuth ? existsAuth._id : null,
      userId: existsUser._id,
      Fname: Fname,
      Lname: Lname,
      phone: existsUser.phone,
      specialisation,
      rating: 2,
      total_number_service_provide: 0,
      total_earning: 0,
      chat_price,
      video_price,
      call_price: call_price || 200,
      years_of_experience,
      profile_picture,
      description,
      language,
      certifications: certifications || [],
      adhar_card,
      pan_card,
    });

    await astrologer.save();

    return res
      .status(201)
      .json(
        new ApiResponse(
          201,
          astrologer,
          "Astrologer request created successfully"
        )
      );
  } catch (error) {
    // Handle unexpected errors
    if (error.name === "ValidationError") {
      // Mongoose validation error
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Validation error", error.errors));
    }
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Internal Server Error", error.message));
  }
});

// Get all pending astrologer requests
export const getAllPendingRequests = asyncHandler(async (req, res) => {
  const pendingRequests = await AstrologerRequest.find({
    request_status: "pending",
  });
  if (pendingRequests.length === 0) {
    return res
      .status(200)
      .json(new ApiResponse(200, [], "No pending astrologers"));
  }
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        pendingRequests,
        "All pending astrologer requests retrieved successfully"
      )
    );
});

// Get pending astrologer request by ID
export const getPendingRequestById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const pendingRequest = await AstrologerRequest.findOne({
    _id: id,
    request_status: "pending",
  });
  if (!pendingRequest) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Pending astrologer request not found"));
  }
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        pendingRequest,
        "Pending astrologer request retrieved successfully"
      )
    );
});

// Get all rejected astrologer requests
export const getAllRejectedRequests = asyncHandler(async (req, res) => {
  const rejectedRequests = await AstrologerRequest.find({
    request_status: "rejected",
  });

  if (rejectedRequests.length === 0) {
    return res
      .status(200)
      .json(new ApiResponse(200, [], "No rejected astrologers"));
  }
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        rejectedRequests,
        "All rejected astrologer requests retrieved successfully"
      )
    );
});

// Get rejected astrologer request by ID
export const getRejectedRequestById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const rejectedRequest = await AstrologerRequest.findOne({
    _id: id,
    request_status: "rejected",
  });
  if (!rejectedRequest) {
    return res
      .status(404)
      .json(
        new ApiResponse(404, null, "Rejected astrologer request not found")
      );
  }
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        rejectedRequest,
        "Rejected astrologer request retrieved successfully"
      )
    );
});

// Get all astrologers
export const getAllAstrologers = asyncHandler(async (req, res) => {
  try {
    const astrologers = await Astrologer.find();

    if (astrologers.length === 0) {
      return res
        .status(200)
        .json(new ApiResponse(200, [], "No astrologers found"));
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          astrologers,
          "All astrologers retrieved successfully"
        )
      );
  } catch (error) {
    throw error;
  }
});

// Get Astrologer by ID
export const getAstrologerById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new ApiError(400, "Astrologer ID is required");
    }

    const astrologer = await Astrologer.findById(id);

    if (!astrologer) {
      throw new ApiError(404, "Astrologer not found");
    }

    return res
      .status(200)
      .json(
        new ApiResponse(200, astrologer, "Astrologer retrieved successfully")
      );
  } catch (error) {
    // Let the errorHandler middleware handle the error
    throw error;
  }
});

export const updateRequestAstrologerProfile = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    Fname,
    Lname,
    phone,
    specialisation,
    chat_price,
    video_price,
    call_price,
    years_of_experience,
    profile_picture,
    description,
    language,
    certifications,
  } = req.body;

  if (!phone) {
    throw new ApiError(400, "Phone number is required");
  }

  const astrologer = await Astrologer.findOne({ authId: id });
  if (!astrologer) {
    throw new ApiError(404, "Astrologer not found");
  }

  let updateRequest = await UpdateAstrologerProfile.findOne({ phone });

  if (!updateRequest) {
    updateRequest = new UpdateAstrologerProfile({
      astrologerId: astrologer._id, // Associate request with astrologer
      Fname,
      Lname,
      phone,
      specialisation,
      chat_price,
      video_price,
      call_price,
      years_of_experience,
      profile_picture,
      description,
      language,
      certifications,
    });
  } else {
    Object.assign(updateRequest, {
      Fname,
      Lname,
      phone,
      specialisation,
      chat_price,
      video_price,
      call_price,
      years_of_experience,
      profile_picture,
      description,
      language,
      certifications,
    });
  }

  await updateRequest.save();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updateRequest,
        "Profile update request submitted successfully"
      )
    );
});

// Get all update request astrologers
export const getAllUpdateRequestAstrologers = asyncHandler(async (req, res) => {
  try {
    console.log("hello");
    const updateRequests = await UpdateAstrologerProfile.find();

    if (updateRequests.length === 0) {
      return res
        .status(200)
        .json(new ApiResponse(200, [], "No update request astrologers found"));
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          updateRequests,
          "All update request astrologers retrieved successfully"
        )
      );
  } catch (error) {
    console.log(error.message);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Internal Server Error", error.message));
  }
});

// Get update request astrologer by ID
export const getUpdateRequestAstrologerById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateRequest = await UpdateAstrologerProfile.findById(id);

  if (!updateRequest) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Update request astrologer not found"));
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updateRequest,
        "Update request astrologer retrieved successfully"
      )
    );
});

// Approve Astrologer Update Request
export const approveUpdateRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Find the update request by ID
  const updateRequest = await UpdateAstrologerProfile.findById(id);
  if (!updateRequest) {
    throw new ApiError(404, "Update request not found");
  }

  // Find the astrologer by phone number
  const astrologer = await Astrologer.findOne({ phone: updateRequest.phone });
  if (!astrologer) {
    throw new ApiError(404, "Astrologer not found");
  }

  // Update the astrologer profile with the new data
  Object.assign(astrologer, {
    Fname: updateRequest.Fname,
    Lname: updateRequest.Lname,
    phone: updateRequest.phone,
    specialisation: updateRequest.specialisation,
    chat_price: updateRequest.chat_price,
    video_price: updateRequest.video_price,
    call_price: updateRequest.call_price,
    years_of_experience: updateRequest.years_of_experience,
    profile_picture: updateRequest.profile_picture,
    description: updateRequest.description,
    language: updateRequest.language,
    certifications: updateRequest.certifications,
    adhar_card: updateRequest.adhar_card,
    pan_card: updateRequest.pan_card,
  });

  await astrologer.save();

  // Delete the update request after successful update
  await UpdateAstrologerProfile.findByIdAndDelete(id);

  return res
    .status(200)
    .json(new ApiResponse(200, [], "Astrologer profile updated successfully"));
});

// Approve Astrologer Request
export const approveAstrologer = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Find the AstrologerRequest by ID
  const astrologerRequest = await AstrologerRequest.findById(id);
  if (!astrologerRequest) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Astrologer not found"));
  }

  // Generate a unique promo code
  const promoCode = await generateUniquePromoCode();

  // Create a new Astrologer record
  const newAstrologer = new Astrologer({
    authId: astrologerRequest.authId,
    userId: astrologerRequest.userId,
    Fname: astrologerRequest.Fname,
    Lname: astrologerRequest.Lname,
    phone: astrologerRequest.phone,
    specialisation: astrologerRequest.specialisation,
    rating: 0,
    total_number_service_provide: 0,
    total_earning: 0,
    wallet: {
      transactionHistory: [
        {
          transactionId: generateTransactionId(),
          timestamp: Date.now(),
          type: "credit",
          credit_type: "others",
          amount: 0,
          description: "Initial wallet setup",
        },
      ],
    },
    chat_price: astrologerRequest.chat_price,
    video_price: astrologerRequest.video_price,
    call_price: astrologerRequest.call_price || 200,
    years_of_experience: astrologerRequest.years_of_experience,
    profile_picture: astrologerRequest.profile_picture,
    description: astrologerRequest.description,
    language: astrologerRequest.language,
    certifications: astrologerRequest.certifications,
    adhar_card: astrologerRequest.adhar_card,
    pan_card: astrologerRequest.pan_card,
    promo_code: promoCode,
  });

  await newAstrologer.save();

  // Mark the user as an astrologer
  await User.findByIdAndUpdate(astrologerRequest.userId, { isAstrologer: true });

  // Delete the AstrologerRequest record
  await astrologerRequest.deleteOne();

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        newAstrologer,
        "Astrologer approved and created successfully"
      )
    );
});

// Reject Astrologer Request
export const rejectAstrologer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rejectMessage } = req.body;

  // Find the AstrologerRequest by ID
  const astrologerRequest = await AstrologerRequest.findById(id);
  if (!astrologerRequest) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Astrologer request not found"));
  }

  // Update the AstrologerRequest record
  astrologerRequest.request_status = "rejected";
  astrologerRequest.request_status_message =
    rejectMessage || "Astrologer request rejected";
  await astrologerRequest.save();

  // Schedule the deletion of the astrologer request after 24 hours
  setTimeout(
    async () => {
      const requestToDelete = await AstrologerRequest.findById(id);
      if (requestToDelete && requestToDelete.request_status === "rejected") {
        await requestToDelete.deleteOne();
        console.log(`AstrologerRequest with ID ${id} deleted after 24 hours.`);
      }
    },
    24 * 60 * 60 * 1000
  ); // 24 hours in milliseconds

  return res
    .status(200)
    .json(
      new ApiResponse(200, null, "Astrologer request rejected successfully")
    );
});

// Add balance to astrologer's wallet using userId
export const addBalanceToAstrologerWallet = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params; // Extract userId from URL params
    const { amount, description, reference, transactionId } = req.body; // Extract details from request body

    // Ensure the amount is positive
    if (amount <= 0) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Amount must be greater than zero"));
    }

    // Find the astrologer by userId
    const astrologer = await Astrologer.findById(id); // Use the userId in the URL params

    if (!astrologer) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Astrologer not found"));
    }

    // Add balance to astrologer's wallet
    astrologer.wallet.balance += amount;

    // Create the transaction entry
    const transaction = {
      type: "credit", // Since we are adding balance, it's a credit transaction
      amount,
      description: description || "Balance added",
      reference: reference || "N/A",
      transactionId, // Include the generated transactionId here
    };

    // Add the transaction to the astrologer's transaction history
    astrologer.wallet.transactionHistory.push(transaction);

    // Save the updated astrologer document
    await astrologer.save();

    // Return the updated wallet balance
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { balance: astrologer.wallet.balance },
          "Balance added successfully"
        )
      );
  } catch (error) {
    console.error("Error adding balance:", error.message);
    const statusCode = error.statusCode || 500;
    const message =
      error.message || "An error occurred while adding balance to wallet";
    res
      .status(statusCode)
      .json(new ApiResponse(statusCode, null, message, error));
  }
});

// Update Astrologer by ID
export const updateAstrologerById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const {
      specialisation,
      chat_price,
      video_price,
      call_price,
      years_of_experience,
      profile_picture,
      description,
      language,
      certifications,
    } = req.body;

    if (!id) {
      throw new ApiError(400, "Astrologer ID is required");
    }

    const astrologer = await Astrologer.findByIdAndUpdate(
      id,
      {
        specialisation,
        chat_price,
        video_price,
        call_price,
        years_of_experience,
        profile_picture,
        description,
        language,
        certifications,
      },
      { new: true, runValidators: true }
    );

    if (!astrologer) {
      throw new ApiError(404, "Astrologer not found");
    }

    return res
      .status(200)
      .json(
        new ApiResponse(200, astrologer, "Astrologer updated successfully")
      );
  } catch (error) {
    throw error;
  }
});

// Filter astrologers by multiple specializations
export const filterAstrologersBySpecialization = asyncHandler(
  async (req, res) => {
    try {
      // Get the specializations from the request body
      const { specializations } = req.body;
      console.log(specializations);

      // Validate that specializations are provided and is an array
      if (
        !specializations ||
        !Array.isArray(specializations) ||
        specializations.length === 0
      ) {
        return res
          .status(400)
          .json(
            new ApiResponse(
              400,
              null,
              "Specializations must be a non-empty array"
            )
          );
      }

      // Query the astrologers based on the multiple specializations
      const astrologers = await Astrologer.find({
        specialisation: { $in: specializations },
      })
        .select("-wallet") // Exclude wallet from response
        .populate("specialisation"); // Populate the specialisation field

      // If no astrologers are found, return a 404 response
      if (astrologers.length === 0) {
        return res
          .status(404)
          .json(
            new ApiResponse(
              404,
              null,
              "No astrologers found for the given specializations"
            )
          );
      }

      // Return the filtered astrologers
      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            astrologers,
            "Astrologers filtered by specializations successfully"
          )
        );
    } catch (error) {
      // Handle any errors
      console.error("Error filtering astrologers by specializations:", error);
      return res
        .status(500)
        .json(
          new ApiResponse(500, null, "Internal Server Error", error.message)
        );
    }
  }
);

// Delete Astrologer by ID
export const deleteAstrologerById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new ApiError(400, "Astrologer ID is required");
    }

    const astrologer = await Astrologer.findById(id);
    if (!astrologer) {
      throw new ApiError(404, "Astrologer not found");
    }

    const { phone } = astrologer;

    await astrologer.deleteOne();

    const authRecord = await Auth.findOneAndDelete({ phone });
    if (!authRecord) {
      throw new ApiError(404, "Auth record not found for the astrologer");
    }

    const userRecord = await User.findOneAndDelete({ phone });
    if (!userRecord) {
      throw new ApiError(404, "User record not found for the astrologer");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, null, "Your account deleted successfully"));
  } catch (error) {
    throw error;
  }
});

// Get wallet balance by ID
export const getWalletBalanceById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Find the Astrologer by ID
  const astrologer = await Astrologer.findById(id);
  if (!astrologer) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Astrologer not found"));
  }

  // Get the wallet balance
  const walletBalance = astrologer.wallet.balance;

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { balance: walletBalance },
        "Wallet balance retrieved successfully"
      )
    );
});

// Add a review to an astrologer
export const giveReviewToAstrologer = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params; // Astrologer ID
    const { userId, rating, comment } = req.body; // Review details

    // Validate inputs
    if (!userId || !rating || !comment) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "All fields are required"));
    }

    if (rating < 1 || rating > 5) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Rating must be between 1 and 5"));
    }

    const user = await User.findById(userId);
    // Find the astrologer by ID
    const astrologer = await Astrologer.findById(id);
    if (!astrologer) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Astrologer not found"));
    }

    // Add the review to the astrologer's reviews array
    const newReview = {
      userId,
      rating,
      comment,
      Fname: user.Fname,
      Lname: user.Lname,
      profile_picture: user.profile_picture,
    };

    astrologer.reviews.push(newReview);
    await astrologer.save();

    return res
      .status(200)
      .json(new ApiResponse(200, newReview, "Review added successfully"));
  } catch (error) {
    console.error("Error adding review:", error);
    return res
      .status(500)
      .json(
        new ApiResponse(500, null, "An error occurred while adding the review")
      );
  }
});

// Get all reviews for an astrologer by their ID
export const getAllReviewsByAstrologerId = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params; // Astrologer ID

    // Validate ID
    if (!id) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Astrologer ID is required"));
    }

    // Find the astrologer by ID and populate reviews
    const astrologer = await Astrologer.findById(id, "reviews").lean();

    if (!astrologer) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Astrologer not found"));
    }

    // Check if there are no reviews
    if (!astrologer.reviews || astrologer.reviews.length === 0) {
      return res
        .status(200)
        .json(new ApiResponse(200, [], "No reviews found for this astrologer"));
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          astrologer.reviews,
          "Reviews retrieved successfully"
        )
      );
  } catch (error) {
    console.error("Error retrieving reviews:", error);
    return res
      .status(500)
      .json(
        new ApiResponse(500, null, "An error occurred while fetching reviews")
      );
  }
});

// Get wallet transaction history by ID with pagination
export const getWalletTransactionHistoryById = asyncHandler(
  async (req, res) => {
    try {
      const { id } = req.params;

      // Get pagination parameters from query
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      // Optional filters
      const { type, startDate, endDate, transactionId } = req.query;

      // Find the Astrologer by ID
      const astrologer = await Astrologer.findById(id);
      if (!astrologer) {
        return res
          .status(404)
          .json(new ApiResponse(404, null, "Astrologer not found"));
      }

      // Get all transactions from wallet
      let transactions = astrologer.wallet.transactionHistory || [];

      // Apply filters if provided
      if (type) {
        transactions = transactions.filter((t) => t.type === type);
      }

      if (transactionId) {
        transactions = transactions.filter(
          (t) =>
            t.transactionId &&
            t.transactionId.toString().includes(transactionId)
        );
      }

      // Date filtering
      if (startDate || endDate) {
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;

        transactions = transactions.filter((t) => {
          const transactionDate = new Date(t.timestamp || t.createdAt);

          if (start && end) {
            return transactionDate >= start && transactionDate <= end;
          } else if (start) {
            return transactionDate >= start;
          } else if (end) {
            return transactionDate <= end;
          }
          return true;
        });
      }

      // Sort by timestamp (newest first)
      transactions.sort((a, b) => {
        const dateA = new Date(a.timestamp || a.createdAt);
        const dateB = new Date(b.timestamp || b.createdAt);
        return dateB - dateA;
      });

      // Get total count for pagination
      const totalTransactions = transactions.length;

      // Apply pagination
      const paginatedTransactions = transactions.slice(skip, skip + limit);

      // Calculate summary statistics
      const totalCredit = transactions
        .filter((t) => t.type === "credit")
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      const totalDebit = transactions
        .filter((t) => t.type === "debit")
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      // Group by date for chart data
      const transactionsByDate = {};
      paginatedTransactions.forEach((t) => {
        const date = new Date(t.timestamp || t.createdAt)
          .toISOString()
          .split("T")[0];
        if (!transactionsByDate[date]) {
          transactionsByDate[date] = {
            date: date,
            credit: 0,
            debit: 0,
            count: 0,
          };
        }

        if (t.type === "credit") {
          transactionsByDate[date].credit += t.amount || 0;
        } else if (t.type === "debit") {
          transactionsByDate[date].debit += t.amount || 0;
        }
        transactionsByDate[date].count++;
      });

      const response = {
        astrologerInfo: {
          id: astrologer._id,
          name: `${astrologer.Fname || ""} ${astrologer.Lname || ""}`.trim(),
          phone: astrologer.phone,
          currentBalance: astrologer.wallet.balance || 0,
        },
        transactions: paginatedTransactions,
        summary: {
          totalTransactions: totalTransactions,
          totalCredit: totalCredit,
          totalDebit: totalDebit,
          netBalance: totalCredit - totalDebit,
          currentBalance: astrologer.wallet.balance || 0,
        },
        chartData: Object.values(transactionsByDate),
        pagination: {
          currentPage: page,
          limit: limit,
          totalPages: Math.ceil(totalTransactions / limit),
          totalRecords: totalTransactions,
          hasNextPage: page < Math.ceil(totalTransactions / limit),
          hasPrevPage: page > 1,
        },
        filters: {
          type: type || null,
          startDate: startDate || null,
          endDate: endDate || null,
          transactionId: transactionId || null,
        },
      };

      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            response,
            "Wallet transaction history retrieved successfully"
          )
        );
    } catch (error) {
      console.error("Error fetching wallet transaction history:", error);
      return res
        .status(500)
        .json(
          new ApiResponse(500, null, "Internal Server Error", error.message)
        );
    }
  }
);

export const toggleAstrologerStatus = asyncHandler(async (req, res) => {
  try {
    const { astrologerId, isActive } = req.body;

    // Validate input
    if (!astrologerId || typeof isActive !== "boolean") {
      return res
        .status(400)
        .json(
          new ApiResponse(
            400,
            null,
            "astrologerId and isActive (boolean) are required"
          )
        );
    }

    // Find the astrologer by ID
    const astrologer = await Astrologer.findById(astrologerId);

    if (!astrologer) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Astrologer not found"));
    }

    // Check if astrologer is currently busy
    if (astrologer.status === "busy") {
      return res
        .status(400)
        .json(
          new ApiResponse(
            400,
            null,
            "Cannot change status while astrologer is busy in a call/chat"
          )
        );
    }

    // Update isActive status
    astrologer.isActive = isActive;

    // Update status based on isActive value
    if (isActive === false) {
      astrologer.status = "offline";
    } else {
      // If making active, you might want to set status to "available" or keep current
      astrologer.status = "available"; // or astrologer.status = astrologer.status;
    }

    await astrologer.save();

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          {
            isActive: astrologer.isActive,
            status: astrologer.status
          },
          "Astrologer status updated successfully"
        )
      );
  } catch (error) {
    console.error("Error updating astrologer status:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Internal Server Error", error.message));
  }
});

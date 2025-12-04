import { Auth } from "../../models/auth/auth.model.js";
import { User } from "../../models/auth/user.model.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import generateOtp from "../../utils/otpGenerate.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/apiError.js";
import jwt from "jsonwebtoken";
import { AuthRequest } from "../../models/auth/authRequest.model.js";
import checkRateLimit from "./../../utils/checkRateLimit.js";
import { Matrimony } from "../../models/matrimony/matrimony.model.js";
import { Dating } from "../../models/dating/dating.model.js";
import { Admin } from "../../models/admin/admin.model.js";
import { generateTransactionId } from "../../utils/generateTNX.js";
import { Astrologer } from "../../models/astrologer/astroler.model.js";
import { AdSubscription } from "../../models/subscription/adSubcription.model.js";
import AffiliateMarketer from "../../models/affiliateMarketer/affiliateMarketer.model.js";
import { sendOTP } from "../../utils/sendOtp.js";
import { validateOTP } from "../../utils/validateOtp.js";
import { validatePhoneNumber } from "../../utils/validatePhoneNumber.js";
import { MatrimonySubscription } from "../../models/subscription/matrimony.subscription.js";
import { DatingSubscription } from "../../models/subscription/dating.subscription.js";
import { LocalSubscription } from "../../models/subscription/localserviceSubscription.js";
import sendNotification from "../../utils/onesignal.js";
import generateUniquePromoCode from "../../utils/generatePromocode.js";

// Helper to generate access and refresh tokens
const generateAccessAndRefreshToken = async (authId) => {
  try {
    const authUser = await Auth.findById(authId);
    if (!authUser) {
      throw new ApiError(404, "User not found");
    }

    const accessToken = authUser.generateAccessToken();
    const refreshToken = authUser.generateRefreshToken();

    authUser.refreshToken = refreshToken;
    await authUser.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "Error generating tokens");
  }
};

// Register User and send OTP
const authRequest = asyncHandler(async (req, res) => {
  try {
    const {
      phone,
      Fname,
      Lname,
      gender,
      date_of_birth,
      isAstrologer,
      isAffiliate_marketer,
      isAdmin,
    } = req.body;

    if (!phone) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Phone number is required"));
    }

    let role;
    if (!isAstrologer && !isAffiliate_marketer && !isAdmin) {
      role = "user";
    } else {
      if (isAstrologer) role = "astrologer";
      else if (isAffiliate_marketer) role = "affiliate_marketer";
      else if (isAdmin) role = "admin";
    }

    let authRecord = await Auth.findOne({ phone });
    let authRequest = await AuthRequest.findOne({ phone });

    if (!authRecord && !authRequest) {
      authRequest = new AuthRequest({
        phone,
        Fname: Fname || "",
        Lname: Lname || "",
        gender: gender || "Others",
        date_of_birth: date_of_birth || "1900-01-01",
        isVerified: false,
        isAstrologer: role === "astrologer",
        isAffiliate_marketer: role === "affiliate_marketer",
        isAdmin: role === "admin",
        user_type: role,
      });

      // Try saving the document
      await authRequest.save();
    }

    // Call sendOTP function here
    const otpResponse = await sendOTP(phone);

    if (!otpResponse) {
      return res
        .status(500)
        .json(new ApiResponse(500, otpResponse.data, "Failed to send OTP"));
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { role, phone, otpData: otpResponse.data },
          "OTP sent successfully"
        )
      );
  } catch (error) {
    if (error.name === "ValidationError") {
      // Handle Mongoose validation errors
      const errors = Object.values(error.errors).map((err) => err.message);
      return res
        .status(400)
        .json(new ApiResponse(400, null, `${errors.join(", ")}`));
    }

    // Catch any other errors
    return res
      .status(500)
      .json(new ApiResponse(500, null, "An unexpected error occurred"));
  }
});

// Verify New User OTP
// const auth_request_verify_OTP = asyncHandler(async (req, res) => {
//   const { phone, otp, verificationId, oneSignalPlayerId } = req.body;

//   console.log(req.body)

//   if (!phone || !otp) {
//     return res
//       .status(400)
//       .json(new ApiResponse(400, null, "Phone number and OTP are required"));
//   }

//   const authRequestRecord = await AuthRequest.findOne({ phone });
//   if (!authRequestRecord) {
//     return res.status(404).json(new ApiResponse(404, null, "User not found"));
//   }

//   // Use validateOTP function to check the OTP
//   const otpValidationResponse = await validateOTP(phone, verificationId, otp);

//   if (!otpValidationResponse.success) {
//     return res
//       .status(400)
//       .json(new ApiResponse(400, otpValidationResponse.data, "Invalid OTP"));
//   }

//   const newAuth = new Auth({
//     phone,
//     otp: "",
//     otpExpiresAt: "",
//     isVerified: true,
//     user_type: authRequestRecord.user_type,
//     refreshToken: "",
//   });
//   await newAuth.save();

//   // Create a new User record
//   const newUser = new User({
//     authId: newAuth._id,
//     phone,
//     Fname: authRequestRecord.Fname || "",
//     Lname: authRequestRecord.Lname || "",
//     gender: authRequestRecord.gender || "Others",
//     date_of_birth: authRequestRecord.date_of_birth || "00-00-0000",
//     isVerified: true,
//     isAstrologer: authRequestRecord.isAstrologer,
//     isAffiliate_marketer: authRequestRecord.isAffiliate_marketer,
//     isAdmin: authRequestRecord.isAdmin,
//     wallet: {
//       transactionHistory: [
//         {
//           transactionId: generateTransactionId(),
//           timestamp: Date.now(),
//           type: "credit",
//           credit_type: "others",
//           amount: 0,
//           description: "Initial wallet setup",
//         },
//       ],
//     },
//     oneSignalPlayerId: oneSignalPlayerId || null,
//   });
//   await newUser.save();

//   // Create an Admin record if isAdmin is true
//   if (authRequestRecord.isAdmin) {
//     const newAdmin = new Admin({
//       authId: newAuth._id,
//       userId: newUser._id,
//     });
//     await newAdmin.save();
//   }

//   const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
//     newAuth._id
//   );

//   await authRequestRecord.deleteOne();

//   // Send a "Welcome to the App" notification
//   if (oneSignalPlayerId) {
//     try {
//       await sendNotification(
//         phone,
//         "Welcome to Good Luck",
//         "Your account has been successfully created. Enjoy our services!"
//       );
//     } catch (error) {
//       console.error("Error sending welcome notification:", error.message);
//     }
//   }

//   return res.status(200).json(
//     new ApiResponse(
//       200,
//       {
//         authId: newAuth._id,
//         userId: newUser._id,
//         role: newAuth.user_type,
//         phone: newUser.phone,
//         accessToken,
//         refreshToken,
//         superNote: newUser ? newUser.superNote : null,
//         promo_code: newUser ? newUser.promo_code : null,
//       },
//       "OTP Verified and new user created"
//     )
//   );
// });

const auth_request_verify_OTP = asyncHandler(async (req, res) => {
  const { phone, otp, verificationId, oneSignalPlayerId } = req.body;

  console.log(req.body);

  if (!phone || !otp) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Phone number and OTP are required"));
  }

  const authRequestRecord = await AuthRequest.findOne({ phone });
  if (!authRequestRecord) {
    return res.status(404).json(new ApiResponse(404, null, "User not found"));
  }

  // Bypass OTP validation for specific numbers with exact verificationId and OTP
  const bypassNumbers = [
    "7872358979",
    "7679039012",
    "9733524164",
    "8145328152",
  ];
  let otpValidationSuccess = true;

  if (
    !(
      bypassNumbers.includes(phone) &&
      verificationId === "1234567" &&
      otp === 1234
    )
  ) {
    // Use validateOTP function to check the OTP
    const otpValidationResponse = await validateOTP(phone, verificationId, otp);
    otpValidationSuccess = otpValidationResponse.success;
  }

  if (!otpValidationSuccess) {
    return res.status(400).json(new ApiResponse(400, null, "Invalid OTP"));
  }

  // Create Auth record
  const newAuth = new Auth({
    phone,
    otp: "",
    otpExpiresAt: "",
    isVerified: true,
    user_type: authRequestRecord.user_type,
    refreshToken: "",
  });
  await newAuth.save();

  // Initialize variables
  let newUser = null;
  let newAffiliate = null;
  let newAstrologer = null;
  let newAdmin = null;

  // Handle different user types
  if (authRequestRecord.user_type === "affiliate_marketer") {
    // Create User record for affiliate marketer
    newUser = new User({
      authId: newAuth._id,
      phone,
      Fname: authRequestRecord.Fname || "",
      Lname: authRequestRecord.Lname || "",
      gender: authRequestRecord.gender || "Others",
      date_of_birth: authRequestRecord.date_of_birth || "00-00-0000",
      isVerified: true,
      isAffiliate_marketer: true,
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
      oneSignalPlayerId: oneSignalPlayerId || null,
    });
    await newUser.save();

    const promoCode = await generateUniquePromoCode();

    // Create Affiliate Marketer record
    newAffiliate = new AffiliateMarketer({
      authId: newAuth._id,
      userId: newUser._id,
      Fname: authRequestRecord.Fname || "",
      Lname: authRequestRecord.Lname || "",
      profile_picture:
        authRequestRecord.profile_picture ||
        "https://i.fbcd.co/products/resized/resized-750-500/d4c961732ba6ec52c0bbde63c9cb9e5dd6593826ee788080599f68920224e27d.jpg",
      phone,
      promo_code: promoCode, // Generate unique promo code
      wallet: {
        transactionHistory: [
          {
            transactionId: generateTransactionId(),
            timestamp: Date.now(),
            type: "credit",
            credit_type: "others",
            amount: 0,
            description: "Initial affiliate wallet setup",
          },
        ],
      },
    });
    await newAffiliate.save();

    // Update User record with affiliate ID if needed
    // You might want to store affiliateId in User model if you have that field
    // newUser.affiliateId = newAffiliate._id;
    // await newUser.save();
  } else if (authRequestRecord.user_type === "astrologer") {
    // Create User record for astrologer
    newUser = new User({
      authId: newAuth._id,
      phone,
      Fname: authRequestRecord.Fname || "",
      Lname: authRequestRecord.Lname || "",
      gender: authRequestRecord.gender || "Others",
      date_of_birth: authRequestRecord.date_of_birth || "00-00-0000",
      isVerified: true,
      isAstrologer: true,
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
      oneSignalPlayerId: oneSignalPlayerId || null,
    });
    await newUser.save();

    // Create Astrologer record
    newAstrologer = new Astrologer({
      authId: newAuth._id,
      userId: newUser._id,
      Fname: authRequestRecord.Fname || "",
      Lname: authRequestRecord.Lname || "",
      phone,
      gender: authRequestRecord.gender || "Others",
      date_of_birth: authRequestRecord.date_of_birth || "00-00-0000",
      profile_picture:
        authRequestRecord.profile_picture ||
        "https://i.fbcd.co/products/resized/resized-750-500/d4c961732ba6ec52c0bbde63c9cb9e5dd6593826ee788080599f68920224e27d.jpg",
      wallet: {
        transactionHistory: [
          {
            transactionId: generateTransactionId(),
            timestamp: Date.now(),
            type: "credit",
            credit_type: "others",
            amount: 0,
            description: "Initial astrologer wallet setup",
          },
        ],
      },
      // Add other astrologer-specific fields
      services: authRequestRecord.services || [],
      isVerified: false, // Astrologer needs separate verification
      isActive: false,
    });
    await newAstrologer.save();
  } else if (authRequestRecord.user_type === "admin") {
    // Create User record for admin
    newUser = new User({
      authId: newAuth._id,
      phone,
      Fname: authRequestRecord.Fname || "",
      Lname: authRequestRecord.Lname || "",
      gender: authRequestRecord.gender || "Others",
      date_of_birth: authRequestRecord.date_of_birth || "00-00-0000",
      isVerified: true,
      isAdmin: true,
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
      oneSignalPlayerId: oneSignalPlayerId || null,
    });
    await newUser.save();

    // Create Admin record
    newAdmin = new Admin({
      authId: newAuth._id,
      userId: newUser._id,
    });
    await newAdmin.save();
  } else {
    // Regular user
    newUser = new User({
      authId: newAuth._id,
      phone,
      Fname: authRequestRecord.Fname || "",
      Lname: authRequestRecord.Lname || "",
      gender: authRequestRecord.gender || "Others",
      date_of_birth: authRequestRecord.date_of_birth || "00-00-0000",
      isVerified: true,
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
      oneSignalPlayerId: oneSignalPlayerId || null,
    });
    await newUser.save();
  }

  // Generate tokens
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    newAuth._id
  );

  // Delete auth request record
  await authRequestRecord.deleteOne();

  // Prepare response data
  const responseData = {
    authId: newAuth._id,
    userId: newUser._id,
    role: newAuth.user_type,
    phone: newUser.phone,
    accessToken,
    refreshToken,
    superNote: newUser ? newUser.superNote : null,
  };

  // Add additional IDs based on user type
  if (authRequestRecord.user_type === "affiliate_marketer" && newAffiliate) {
    responseData.affiliateId = newAffiliate._id;
    responseData.promo_code = newAffiliate.promo_code;
  } else if (authRequestRecord.user_type === "astrologer" && newAstrologer) {
    responseData.astrologerId = newAstrologer._id;
  } else if (authRequestRecord.user_type === "admin" && newAdmin) {
    responseData.adminId = newAdmin._id;
  }

  // Send welcome notification
  if (oneSignalPlayerId) {
    try {
      await sendNotification(
        phone,
        "Welcome to Good Luck",
        "Your account has been successfully created. Enjoy our services!"
      );
    } catch (error) {
      console.error("Error sending welcome notification:", error.message);
    }
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        responseData,
        `OTP Verified and ${authRequestRecord.user_type} account created successfully`
      )
    );
});

// Login User
const loginUser = asyncHandler(async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      throw new ApiError(400, "Phone number is required");
    }

    // Check if the phone number is valid
    if (!validatePhoneNumber(phone)) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Invalid phone number format"));
    }

    const authRecord = await Auth.findOne({ phone });
    const userRecord = await User.findOne({ phone });
    const astrologer = await Astrologer.findOne({ phone });

    if (!authRecord) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "User does not exist"));
    }

    // Generate a new OTP
    const newOtp = generateOtp();

    // Update the OTP and expiration in the database
    await Auth.findOneAndUpdate(
      { phone },
      {
        $set: {
          otp: newOtp,
          otpExpiresAt: Date.now() + 5 * 60 * 1000, // OTP valid for 5 minutes
          isVerified: false,
          refreshToken: "",
        },
      },
      { new: true }
    );

    // Send OTP using the `sendOTP` function
    const otpResponse = await sendOTP(phone);
    if (!otpResponse) {
      return res
        .status(500)
        .json(new ApiResponse(500, otpResponse.data, "Failed to send OTP"));
    }

    // Generate tokens
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
      authRecord._id
    );

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          userId: userRecord ? userRecord._id : null,
          astrologer_id: astrologer ? astrologer._id : null,
          role: authRecord.user_type,
          accessToken,
          refreshToken,
          otpData: otpResponse.data, // Optionally return OTP data for testing
        },
        "OTP sent successfully"
      )
    );
  } catch (error) {
    // Handle validation errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res
        .status(400)
        .json(
          new ApiResponse(400, null, `Validation error: ${errors.join(", ")}`)
        );
    }

    // Catch any other unexpected errors
    return res
      .status(500)
      .json(new ApiResponse(500, null, "An unexpected error occurred"));
  }
});

// Verify Existing User OTP
// const login_verify_OTP = asyncHandler(async (req, res) => {
//   try {
//     const { phone, otp, verificationId } = req.body;

//     // Check if phone and OTP are provided
//     if (!phone || !otp) {
//       return res
//         .status(400)
//         .json(new ApiResponse(400, null, "Phone number and OTP are required"));
//     }

//     // Validate phone number format
//     if (!validatePhoneNumber(phone)) {
//       return res
//         .status(400)
//         .json(new ApiResponse(400, null, "Invalid phone number format"));
//     }

//     // Fetch user records
//     const authRecord = await Auth.findOne({ phone });
//     if (!authRecord) {
//       return res.status(404).json(new ApiResponse(404, null, "User not found"));
//     }

//     const userRecord = await User.findOne({ phone });
//     const astrologer = await Astrologer.findOne({ phone });

//     // Validate the OTP using the `validateOTP` function
//     const otpValidationResponse = await validateOTP(phone, verificationId, otp);
//     if (!otpValidationResponse.success) {
//       return res
//         .status(201)
//         .json(new ApiResponse(201, otpValidationResponse.data, "Invalid OTP"));
//     }

//     // Generate access and refresh tokens
//     const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
//       authRecord._id
//     );

//     // Mark the user as verified and clear OTP-related fields
//     authRecord.isVerified = true;
//     authRecord.otp = "";
//     authRecord.otpExpiresAt = null;
//     await authRecord.save();

//     // Fetch Matrimony and Dating profile IDs if they exist
//     const matrimonyProfile = await Matrimony.findOne({
//       authId: authRecord._id,
//     });
//     const datingProfile = await Dating.findOne({ authId: authRecord._id });

//     // Send response with user data
//     return res.status(200).json(
//       new ApiResponse(
//         200,
//         {
//           userId: userRecord?._id,
//           astrologer: astrologer
//             ? {
//                 ...astrologer.toObject(),
//                 wallet: {
//                   balance: astrologer.wallet.balance,
//                   _id: astrologer.wallet._id,
//                 },
//               }
//             : null,
//           role: authRecord.user_type,
//           phone: authRecord.phone,
//           accessToken,
//           refreshToken,
//           superNote: userRecord ? userRecord.superNote : null,
//           matrimonyID: matrimonyProfile ? matrimonyProfile.userId : null,
//           datingID: datingProfile ? datingProfile.userId : null,
//           isMatrimonySubscribed: userRecord.matrimonySubscription
//             ? userRecord.matrimonySubscription.isSubscribed
//             : false,
//           isDatingSubscribed: userRecord?.datingSubscription
//             ? userRecord.datingSubscription.isSubscribed
//             : false,
//           userDetails: userRecord
//             ? {
//                 Fname: userRecord.Fname,
//                 Lname: userRecord.Lname,
//                 gender: userRecord.gender,
//                 profile_picture: userRecord.profile_picture,
//                 date_of_birth: userRecord.date_of_birth,
//               }
//             : null,
//           ads_subsCription: userRecord?.adSubscription
//             ? {
//                 isSubscribed: userRecord.adSubscription.isSubscribed,
//                 StartDate: userRecord.adSubscription.startDate,
//                 EndDate: userRecord.adSubscription.endDate,
//                 isPromoApplied: userRecord.adSubscription.isPromoApplied,
//                 plan: userRecord.adSubscription.price,
//               }
//             : null,
//           matrimony_subsCription: userRecord?.matrimonySubscription
//             ? {
//                 isSubscribed: userRecord.matrimonySubscription.isSubscribed,
//                 StartDate: userRecord.matrimonySubscription.startDate,
//                 EndDate: userRecord.matrimonySubscription.endDate,
//                 category: userRecord.matrimonySubscription.category,
//               }
//             : null,
//           dating_subsCription: userRecord?.datingSubscription
//             ? {
//                 isSubscribed: userRecord.datingSubscription.isSubscribed,
//                 StartDate: userRecord.datingSubscription.startDate,
//                 EndDate: userRecord.datingSubscription.endDate,
//                 category: userRecord.datingSubscription.category,
//               }
//             : null,
//         },
//         "OTP Verified"
//       )
//     );
//   } catch (error) {
//     // Handle unexpected errors
//     console.error("Error in login_verify_OTP:", error.message || error);
//     return res
//       .status(500)
//       .json(new ApiResponse(500, null, "An unexpected error occurred"));
//   }
// });

// Verify Existing User OTP 2
const login_verify_OTP = asyncHandler(async (req, res) => {
  try {
    const { phone, otp, verificationId } = req.body;

    console.log(req.body);

    // Check if phone, OTP, and verificationId are provided
    if (!phone || !otp || !verificationId) {
      return res
        .status(400)
        .json(
          new ApiResponse(
            400,
            null,
            "Phone number, OTP, and verificationId are required"
          )
        );
    }

    // Validate phone number format
    if (!validatePhoneNumber(phone)) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Invalid phone number format"));
    }

    // Fetch user records
    const authRecord = await Auth.findOne({ phone });
    if (!authRecord) {
      return res.status(404).json(new ApiResponse(404, null, "User not found"));
    }

    const userRecord = await User.findOne({ phone });
    const astrologer = await Astrologer.findOne({ phone });

    // Bypass OTP validation for specific numbers with exact verificationId and OTP
    const bypassNumbers = [
      "7872358979",
      "7679039012",
      "9733524164",
      "8145328152",
    ];
    let otpValidationSuccess = true;

    if (
      !(
        bypassNumbers.includes(phone) &&
        verificationId === "1234567" &&
        otp === 1234
      )
    ) {
      const otpValidationResponse = await validateOTP(
        phone,
        verificationId,
        otp
      );

      console.log("OTP Validation Response:", otpValidationResponse);
      otpValidationSuccess = otpValidationResponse.success;
    }

    if (!otpValidationSuccess) {
      return res.status(201).json(new ApiResponse(201, null, "Invalid OTP"));
    }

    // Generate access and refresh tokens
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
      authRecord._id
    );

    // Mark the user as verified and clear OTP-related fields
    authRecord.isVerified = true;
    authRecord.otp = "";
    authRecord.otpExpiresAt = null;
    await authRecord.save();

    // Fetch Matrimony and Dating profile IDs if they exist
    const matrimonyProfile = await Matrimony.findOne({
      authId: authRecord._id,
    });
    const datingProfile = await Dating.findOne({ authId: authRecord._id });

    // Send a "Login Successful" notification
    if (userRecord?.oneSignalPlayerId) {
      try {
        await sendNotification(
          phone,
          "Login Successful",
          "You have successfully logged into your account."
        );
      } catch (error) {
        console.error("Error sending login notification:", error.message);
      }
    }

    // Send response with user data
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          userId: userRecord?._id,
          astrologer: astrologer
            ? {
                ...astrologer.toObject(),
                wallet: {
                  balance: astrologer.wallet.balance,
                  _id: astrologer.wallet._id,
                },
              }
            : null,
          role: authRecord.user_type,
          phone: authRecord.phone,
          accessToken,
          refreshToken,
          superNote: userRecord ? userRecord.superNote : null,
          matrimonyID: matrimonyProfile ? matrimonyProfile.userId : null,
          datingID: datingProfile ? datingProfile.userId : null,
          isMatrimonySubscribed:
            userRecord?.matrimonySubscription?.isSubscribed || false,
          isDatingSubscribed:
            userRecord?.datingSubscription?.isSubscribed || false,
          userDetails: userRecord
            ? {
                Fname: userRecord.Fname,
                Lname: userRecord.Lname,
                gender: userRecord.gender,
                profile_picture: userRecord.profile_picture,
                date_of_birth: userRecord.date_of_birth,
              }
            : null,
          ads_subsCription: userRecord?.adSubscription
            ? {
                isSubscribed: userRecord.adSubscription.isSubscribed,
                StartDate: userRecord.adSubscription.startDate,
                EndDate: userRecord.adSubscription.endDate,
                isPromoApplied: userRecord.adSubscription.isPromoApplied,
                plan: userRecord.adSubscription.price,
              }
            : null,
          matrimony_subsCription: userRecord?.matrimonySubscription
            ? {
                isSubscribed: userRecord.matrimonySubscription.isSubscribed,
                StartDate: userRecord.matrimonySubscription.startDate,
                EndDate: userRecord.matrimonySubscription.endDate,
                category: userRecord.matrimonySubscription.category,
              }
            : null,
          dating_subsCription: userRecord?.datingSubscription
            ? {
                isSubscribed: userRecord.datingSubscription.isSubscribed,
                StartDate: userRecord.datingSubscription.startDate,
                EndDate: userRecord.datingSubscription.endDate,
                category: userRecord.datingSubscription.category,
              }
            : null,
          localSubscription: userRecord?.localSubscription
            ? {
                isSubscribed: userRecord.localSubscription.isSubscribed,
                StartDate: userRecord.localSubscription.startDate,
                EndDate: userRecord.localSubscription.endDate,
                category: userRecord.localSubscription.category,
              }
            : null,
        },
        "OTP Verified"
      )
    );
  } catch (error) {
    // Handle unexpected errors
    console.error("Error in login_verify_OTP:", error.message || error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "An unexpected error occurred"));
  }
});

// Refresh Access Token
const refreshAccessToken = asyncHandler(async (req, res) => {
  const { refreshToken: incomingRefreshToken } = req.body;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = await User.findById(decodedToken._id);

    if (!user || incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(401, "Invalid or expired refresh token");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
      user._id
    );

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken },
          "New tokens generated"
        )
      );
  } catch (error) {
    throw new ApiError(401, "Invalid refresh token");
  }
});

// Resend OTP
const resendOTP = asyncHandler(async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Phone number is required"));
  }

  // Validate phone number format
  if (!validatePhoneNumber(phone)) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Invalid phone number format"));
  }

  // Rate limit check
  const { allowed, remainingTime } = checkRateLimit(phone);
  if (!allowed) {
    return res
      .status(429)
      .json(
        new ApiResponse(
          429,
          null,
          `Too many requests. Try again in ${Math.ceil(remainingTime / 60000)} minutes.`
        )
      );
  }

  // Check if the user exists
  let user = await User.findOne({ phone });
  if (!user) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Invalid phone number"));
  }

  // Generate a new OTP
  const newOtp = generateOtp();

  // Update the user's OTP and verification status in the database
  user.otp = newOtp;
  user.isVerified = false;
  await user.save();

  // Send the OTP using the `sendOTP` function
  const otpResponse = await sendOTP(phone);
  if (!otpResponse) {
    return res
      .status(500)
      .json(new ApiResponse(500, otpResponse.data, "Failed to resend OTP"));
  }

  return res
    .status(200)
    .json(new ApiResponse(200, otpResponse.data, "OTP sent successfully"));
});

// Logout User
const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    { $set: { refreshToken: undefined } },
    { new: true }
  );

  const options = { httpOnly: true, secure: true };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out"));
});

// Add Balance to User Wallet
const addWalletBalance = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { amount, description, transactionId } = req.body;

  // Check if the required fields are provided
  if (!userId || !amount || amount <= 0) {
    throw new ApiError(
      400,
      "User ID and amount are required and must be positive."
    );
  }

  // Find the user by their ID
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Add the balance and create the transaction history entry
  user.wallet.balance += amount;
  user.wallet.transactionHistory.push({
    transactionId,
    type: "credit",
    amount,
    description: description || "Balance added",
    reference: userId,
  });

  // Save the updated user data
  await user.save();

  // Return the updated wallet information
  return res.status(200).json({
    success: true,
    message: "Balance added successfully",
    updatedBalance: user.wallet.balance,
    transactionHistory: user.wallet.transactionHistory,
  });
});

// Get wallet balance by user ID
const getWalletBalanceByUserId = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;

    // Find the user by ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json(new ApiResponse(404, null, "User not found"));
    }

    // Get the wallet balance
    const walletBalance = user.wallet.balance;

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { balance: walletBalance },
          "Wallet balance retrieved successfully"
        )
      );
  } catch (error) {
    console.error("Error fetching wallet balance:", error);
    return res
      .status(500)
      .json(
        new ApiResponse(
          500,
          null,
          "An error occurred while retrieving the wallet balance"
        )
      );
  }
});

// Get transaction history by user ID
const getTransactionHistoryByUserId = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;

    // Find the user by ID and select the transaction history
    const user = await User.findById(userId)
      .select("wallet.transactionHistory")
      .lean();

    if (!user) {
      return res.status(404).json(new ApiResponse(404, null, "User not found"));
    }

    // Retrieve transaction history
    const transactionHistory = user.wallet?.transactionHistory || [];

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { transactionHistory },
          "Transaction history retrieved successfully"
        )
      );
  } catch (error) {
    console.error("Error fetching transaction history:", error);
    return res
      .status(500)
      .json(
        new ApiResponse(
          500,
          null,
          "An error occurred while retrieving transaction history"
        )
      );
  }
});

// Get user profile details by ID
const getUserProfileDetailsById = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;

    // Find the user by ID
    const user = await User.findById(userId).select(
      "authId Fname Lname gender date_of_birth profile_picture phone last_login services isVerified isActive isAdmin"
    );

    if (!user) {
      return res.status(404).json(new ApiResponse(404, null, "User not found"));
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          user,
          "User profile details retrieved successfully"
        )
      );
  } catch (error) {
    console.error("Error fetching user profile details:", error);
    return res
      .status(500)
      .json(
        new ApiResponse(
          500,
          null,
          "An error occurred while retrieving user profile details"
        )
      );
  }
});

// Update user profile or wallet by user ID
const updateUserById = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;

    // Find and update the user by ID
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData }, // Update the fields in the request body
      { new: true, runValidators: true } // Return updated document and run validations
    ).lean();

    if (!updatedUser) {
      return res.status(404).json(new ApiResponse(404, null, "User not found"));
    }

    return res
      .status(200)
      .json(new ApiResponse(200, updatedUser, "User updated successfully"));
  } catch (error) {
    console.error("Error updating user:", error);
    return res
      .status(500)
      .json(
        new ApiResponse(500, null, "An error occurred while updating the user")
      );
  }
});

// Buy Ad Subscription
const buyAdSubscription = asyncHandler(async (req, res) => {
  const { userId, planType, promoCode, transactionId } = req.body;

  if (!userId || !planType) {
    throw new ApiError(400, "User ID and plan type are required.");
  }

  // Now deduct the amount from the user's wallet
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  const subscriptionPlans = await AdSubscription.findOne();
  if (!subscriptionPlans) {
    throw new ApiError(404, "Ad subscription plans not found.");
  }

  // Determine the price based on the planType
  const price =
    planType === "one_month_plan"
      ? subscriptionPlans.one_month_plan
      : planType === "one_year_plan"
        ? subscriptionPlans.one_year_plan
        : null;

  if (price === null) {
    throw new ApiError(400, "Invalid plan type.");
  }

  // Initialize the discounted price (no discount is applied in this case)
  let discountedPrice = price;
  let promoUser = null;

  if (promoCode) {
    // Check if the promo code is for an affiliate marketer or astrologer
    const affiliate = await AffiliateMarketer.findOne({
      promo_code: promoCode,
    });
    const astrologer = await Astrologer.findOne({ promo_code: promoCode });

    if (affiliate) {
      promoUser = affiliate;
    } else if (astrologer) {
      promoUser = astrologer;
    }

    // If no valid promo user is found, throw an error
    if (!promoUser) {
      throw new ApiError(400, "Invalid promo code.");
    }

    // Calculate the 20% commission for the promo user and 80% for the admin
    const promoUserCommission = 0.2 * discountedPrice;
    const adminCommission = 0.8 * discountedPrice;

    // Credit 20% commission to the promo user's wallet
    promoUser.wallet.balance += promoUserCommission;
    promoUser.wallet.transactionHistory.push({
      type: "credit",
      credit_type: "advertisement",
      amount: promoUserCommission,
      description: "Commission from ad subscription",
      reference: promoCode,
      transactionId: transactionId,
    });
    await promoUser.save();

    // Credit 80% commission to the admin's wallet
    const admin = await Admin.findOne(); // Assuming a single admin
    if (admin) {
      admin.wallet.balance += adminCommission;
      admin.wallet.transactionHistory.push({
        type: "credit",
        credit_type: "advertisement",
        amount: adminCommission,
        description: "Commission from ad subscription for admin",
        reference: promoCode,
        transactionId: transactionId,
      });
      await admin.save();
    }
  }

  // if (user.wallet.balance < discountedPrice) {
  //   throw new ApiError(400, "Insufficient wallet balance.");
  // }

  // Add the amount reciept in the user's wallet
  user.wallet.transactionHistory.push({
    type: "debit",
    debit_type: "advertisement",
    amount: discountedPrice,
    description: "Ad subscription purchase",
    reference: planType,
    transactionId: transactionId,
  });

  // Credit 80% commission to the admin's wallet
  const admin = await Admin.findOne(); // Assuming a single admin
  if (admin) {
    admin.wallet.balance += price;
    admin.wallet.transactionHistory.push({
      type: "credit",
      credit_type: "advertisement",
      amount: price,
      description: "Commission from ad subscription for admin",
      reference: promoCode,
      transactionId: transactionId,
    });
    await admin.save();
  }

  // Initialize the subscription details
  user.adSubscription = {
    plan: subscriptionPlans._id,
    isSubscribed: true,
    isPromoApplied: !!promoCode,
    promo_code: promoCode || null,
    category: "advertisement",
    startDate: new Date(),
    price: discountedPrice,
    adsDetails: [],
    endDate: new Date(), // Initialize endDate here
  };

  // Set the end date based on the plan type
  if (planType === "one_month_plan") {
    user.adSubscription.endDate.setMonth(
      user.adSubscription.startDate.getMonth() + 1
    ); // Add 1 month
  } else if (planType === "one_year_plan") {
    user.adSubscription.endDate.setFullYear(
      user.adSubscription.startDate.getFullYear() + 1
    ); // Add 1 year
  }

  // Adjust the subscription end date if a promo code is applied
  if (promoCode) {
    if (planType === "one_month_plan") {
      user.adSubscription.endDate.setDate(
        user.adSubscription.endDate.getDate() + 7
      ); // Add 7 days for promo
    } else if (planType === "one_year_plan") {
      user.adSubscription.endDate.setMonth(
        user.adSubscription.endDate.getMonth() + 1
      ); // Add 1 month for promo
    }
  }

  user.superNote = 100;

  await user.save();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { subscription: user.adSubscription },
        "Ad subscription purchased successfully."
      )
    );
});

// Buy Matrimony Subscription
const buyMatrimonySubscription = asyncHandler(async (req, res) => {
  const { userId, planType, transactionId } = req.body;

  if (!userId || !planType) {
    throw new ApiError(400, "User ID and plan type are required.");
  }

  // Fetch the user
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  // Fetch subscription plans
  const subscriptionPlans = await MatrimonySubscription.findOne();
  if (!subscriptionPlans) {
    throw new ApiError(404, "Subscription plans not found.");
  }

  // Determine the price based on the planType
  const price =
    planType === "one_month_plan"
      ? subscriptionPlans.one_month_plan
      : planType === "one_year_plan"
        ? subscriptionPlans.one_year_plan
        : null;

  if (price === null) {
    throw new ApiError(400, "Invalid plan type.");
  }

  // Check if the user has enough balance
  if (user.wallet.balance < price) {
    throw new ApiError(400, "Insufficient balance in wallet.");
  }

  // Deduct the amount from the wallet balance
  user.wallet.balance -= price;

  user.wallet.transactionHistory.push({
    type: "debit",
    debit_type: "matrimony",
    amount: price,
    description: "Matrimony subscription purchase",
    reference: planType,
    transactionId: transactionId,
  });

  // Set the matrimony subscription details
  user.matrimonySubscription = {
    plan: subscriptionPlans._id,
    isSubscribed: true,
    category: planType === "one_month_plan" ? "1 month" : "1 year",
    startDate: new Date(),
    endDate: new Date(),
    price: price,
  };

  // Calculate the end date
  if (planType === "one_month_plan") {
    user.matrimonySubscription.endDate.setMonth(
      user.matrimonySubscription.startDate.getMonth() + 1
    );
  } else if (planType === "one_year_plan") {
    user.matrimonySubscription.endDate.setFullYear(
      user.matrimonySubscription.startDate.getFullYear() + 1
    );
  }

  await user.save();

  // Credit commission to the admin's wallet
  const admin = await Admin.findOne(); // Assuming a single admin
  if (admin) {
    admin.wallet.balance += price;
    admin.wallet.transactionHistory.push({
      type: "credit",
      credit_type: "matrimony",
      amount: price,
      description: "Commission from matrimony subscription for admin",
      reference: "NA",
      transactionId: transactionId,
    });
    await admin.save();
  }

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { subscription: user.matrimonySubscription },
        "Matrimony subscription purchased successfully."
      )
    );
});

// Buy Dating Subscription
const buyDatingSubscription = asyncHandler(async (req, res) => {
  const { userId, planType, transactionId } = req.body;

  if (!userId || !planType) {
    throw new ApiError(400, "User ID and plan type are required.");
  }

  // Fetch the user
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  // Fetch subscription plans
  const subscriptionPlans = await DatingSubscription.findOne();
  if (!subscriptionPlans) {
    throw new ApiError(404, "Subscription plans not found.");
  }

  // Determine the price based on the planType
  const price =
    planType === "one_month_plan"
      ? subscriptionPlans.one_month_plan
      : planType === "one_year_plan"
        ? subscriptionPlans.one_year_plan
        : null;

  if (price === null) {
    throw new ApiError(400, "Invalid plan type.");
  }

  // Check if the user has enough balance
  if (user.wallet.balance < price) {
    throw new ApiError(400, "Insufficient balance in wallet.");
  }

  // Deduct the amount from the wallet balance
  user.wallet.balance -= price;

  user.wallet.transactionHistory.push({
    type: "debit",
    debit_type: "dating",
    amount: price,
    description: "Dating subscription purchase",
    reference: planType,
    transactionId: transactionId,
  });

  // Set the matrimony subscription details
  user.datingSubscription = {
    plan: subscriptionPlans._id,
    isSubscribed: true,
    category: planType === "one_month_plan" ? "1 month" : "1 year",
    startDate: new Date(),
    endDate: new Date(),
    price: price,
  };

  // Calculate the end date
  if (planType === "one_month_plan") {
    user.datingSubscription.endDate.setMonth(
      user.datingSubscription.startDate.getMonth() + 1
    );
  } else if (planType === "one_year_plan") {
    user.datingSubscription.endDate.setFullYear(
      user.datingSubscription.startDate.getFullYear() + 1
    );
  }

  await user.save();

  // Credit commission to the admin's wallet
  const admin = await Admin.findOne(); // Assuming a single admin
  if (admin) {
    admin.wallet.balance += price;
    admin.wallet.transactionHistory.push({
      type: "credit",
      credit_type: "dating",
      amount: price,
      description: "Commission from dating subscription for admin",
      reference: "NA",
      transactionId: transactionId,
    });
    await admin.save();
  }

  res.status(200).json(
    new ApiResponse(
      200,
      { subscription: user.datingSubscription }, // Correct the field here to 'datingSubscription'
      "Dating subscription purchased successfully."
    )
  );
});

// Buy Local Subscription
export const buyLocalSubscription = asyncHandler(async (req, res) => {
  const { userId, planType, transactionId } = req.body;

  if (!userId || !planType) {
    throw new ApiError(400, "User ID and plan type are required.");
  }

  // Fetch the user
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  // Fetch subscription plans
  const subscriptionPlans = await LocalSubscription.findOne();
  if (!subscriptionPlans) {
    throw new ApiError(404, "Subscription plans not found.");
  }

  // Determine the price based on the planType
  const price =
    planType === "one_month_plan"
      ? subscriptionPlans.one_month_plan
      : planType === "one_year_plan"
        ? subscriptionPlans.one_year_plan
        : null;

  if (price === null) {
    throw new ApiError(400, "Invalid plan type.");
  }

  // Check if the user has enough balance
  if (user.wallet.balance < price) {
    throw new ApiError(400, "Insufficient balance in wallet.");
  }

  // Deduct the amount from the wallet balance
  user.wallet.balance -= price;

  user.wallet.transactionHistory.push({
    type: "debit",
    debit_type: "Local Service",
    amount: price,
    description: "Local subscription purchase",
    reference: planType,
    transactionId: transactionId,
  });

  // Set the local subscription details
  user.localSubscription = {
    plan: subscriptionPlans._id,
    isSubscribed: true,
    category: planType === "one_month_plan" ? "1 month" : "1 year",
    startDate: new Date(),
    endDate: new Date(),
    price: price,
  };

  // Calculate the end date
  if (planType === "one_month_plan") {
    user.localSubscription.endDate.setMonth(
      user.localSubscription.startDate.getMonth() + 1
    );
  } else if (planType === "one_year_plan") {
    user.localSubscription.endDate.setFullYear(
      user.localSubscription.startDate.getFullYear() + 1
    );
  }

  await user.save();

  // Credit commission to the admin's wallet
  const admin = await Admin.findOne(); // Assuming a single admin
  if (admin) {
    admin.wallet.balance += price;
    admin.wallet.transactionHistory.push({
      type: "credit",
      credit_type: "Local Service",
      amount: price,
      description: "Commission from Local Service subscription for admin",
      reference: "NA",
      transactionId: transactionId,
    });
    await admin.save();
  }

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { subscription: user.localSubscription },
        "Local subscription purchased successfully."
      )
    );
});

// Get astrologers and reviews by user ID
const getAstrologersAndReviewsByUserId = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params; // User ID from params

    // Validate userId
    if (!userId) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "User ID is required"));
    }

    // Find astrologers reviewed by the user
    const astrologers = await Astrologer.find(
      { "reviews.userId": userId }, // Filter astrologers with reviews by the given user ID
      {
        name: 1, // Include astrologer name
        specialization: 1, // Include specialization
        Fname: 1, // Include first name
        Lname: 1, // Include last name
        language: 1, // Include languages
        profile_picture: 1, // Include profile picture
        years_of_experience: 1, // Include years of experience
        reviews: 1, // Include reviews
      }
    ).lean();

    // Filter only the reviews provided by this user
    const result = astrologers.map((astrologer) => {
      const userReviews = astrologer.reviews.filter(
        (review) => review.userId.toString() === userId
      );

      return {
        astrologerId: astrologer._id,
        astrologerName: astrologer.name,
        specialization: astrologer.specialization,
        Fname: astrologer.Fname,
        Lname: astrologer.Lname,
        language: astrologer.language,
        profile_picture: astrologer.profile_picture,
        years_of_experience: astrologer.years_of_experience,
        reviews: userReviews,
      };
    });

    if (result.length === 0) {
      return res
        .status(200)
        .json(new ApiResponse(200, [], "No reviews found by this user"));
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          result,
          "Astrologers and reviews retrieved successfully"
        )
      );
  } catch (error) {
    console.error("Error fetching astrologers and reviews:", error);
    return res
      .status(500)
      .json(
        new ApiResponse(
          500,
          null,
          "An error occurred while fetching astrologers and reviews"
        )
      );
  }
});

// Check Promo Code
const checkPromoCode = asyncHandler(async (req, res) => {
  const { promoCode } = req.body;

  // Validate input
  if (!promoCode) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Promo code is required"));
  }

  // Check promo code in Astrologer collection
  const astrologer = await Astrologer.findOne({ promo_code: promoCode });
  if (astrologer) {
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          type: "Astrologer",
          details: {
            id: astrologer._id,
            name: `${astrologer.Fname} ${astrologer.Lname}`,
            promoCode: astrologer.promo_code,
          },
        },
        "Promo code is valid"
      )
    );
  }

  // Check promo code in AffiliateMarketer collection
  const affiliate = await AffiliateMarketer.findOne({ promo_code: promoCode });
  if (affiliate) {
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          type: "AffiliateMarketer",
          details: {
            id: affiliate._id,
            name: `${affiliate.Fname} ${affiliate.Lname}`,
            promoCode: affiliate.promo_code,
          },
        },
        "Promo code is valid"
      )
    );
  }

  // If promo code does not exist
  return res
    .status(404)
    .json(new ApiResponse(404, null, "Promo code not found"));
});

const deleteUserAccount = async (req, res) => {
  try {
    const { userId } = req.params;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Delete associated records
    await Auth.findOneAndDelete({ _id: user.authId });
    await Matrimony.findOneAndDelete({ userId });
    await Dating.findOneAndDelete({ userId });
    await Astrologer.findOneAndDelete({ userId });

    // Delete user
    await User.findByIdAndDelete(userId);

    res.status(200).json({ message: "User account deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting user account", error: error.message });
  }
};

// Get all users excluding isAstrologer and isAdmin
const getAllUsers = asyncHandler(async (req, res) => {
  try {
    const users = await User.find({ isAstrologer: false, isAdmin: false });

    if (!users || users.length === 0) {
      return res.status(404).json(new ApiResponse(404, null, "No users found"));
    }

    res
      .status(200)
      .json(new ApiResponse(200, users, "Users retrieved successfully"));
  } catch (error) {
    throw new ApiError(500, error.message);
  }
});

export {
  loginUser,
  login_verify_OTP,
  auth_request_verify_OTP,
  authRequest,
  logoutUser,
  refreshAccessToken,
  resendOTP,
  addWalletBalance,
  getWalletBalanceByUserId,
  buyAdSubscription,
  getUserProfileDetailsById,
  getTransactionHistoryByUserId,
  updateUserById,
  getAstrologersAndReviewsByUserId,
  buyMatrimonySubscription,
  buyDatingSubscription,
  checkPromoCode,
  deleteUserAccount,
  getAllUsers,
};

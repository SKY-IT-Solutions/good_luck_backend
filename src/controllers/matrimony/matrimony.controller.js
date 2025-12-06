import { User } from "../../models/auth/user.model.js";
import { Matrimony } from "../../models/matrimony/matrimony.model.js";
import { MatrimonyReportBlock } from "../../models/matrimony/matrimonyReportBlock.model.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { mongoose } from "mongoose";

// Create Matrimony Profile
export const createMatrimonyProfile = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const {
    Fname,
    Lname,
    photo,
    city,
    state,
    gender,
    salary,
    age,
    bio,
    isDivorce,
    cast,
    interests,
    searching_for,
    whatsappNumber,
    facebookLink,
  } = req.body;

  const existsUser = await User.findById(id);

  if (!existsUser) {
    return res.status(404).json(new ApiResponse(404, null, "User not found"));
  }

  // // Check if the user has an active matrimony subscription
  // const { matrimonySubscription } = existsUser;
  // const currentDate = new Date();

  // if (!matrimonySubscription || !matrimonySubscription.isSubscribed || matrimonySubscription.endDate < currentDate) {
  //   return res.status(403).json(
  //     new ApiResponse(403, null, "User must have an active matrimony subscription to create a matrimony profile")
  //   );
  // }

  const existingMatrimonyProfile = await Matrimony.findOne({ userId: id });

  if (existingMatrimonyProfile) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Matrimony profile already exists"));
  }

  const { isAstrologer, isAffiliate_marketer, isAdmin } = existsUser;

  if (!isAstrologer && !isAffiliate_marketer && !isAdmin) {
    try {
      const newMatrimonyProfile = new Matrimony({
        authId: existsUser.authId,
        userId: existsUser._id,
        Fname,
        Lname,
        photo,
        city,
        state,
        salary: salary ? salary : 0,
        age,
        gender,
        bio,
        isDivorce,
        cast,
        interests,
        searching_for,
        facebookLink: facebookLink || null,
        whatsappNumber: whatsappNumber || existsUser.phone,
        isVerified: true,
      });

      await newMatrimonyProfile.save();

      return res
        .status(201)
        .json(
          new ApiResponse(
            201,
            newMatrimonyProfile,
            "Matrimony profile created successfully"
          )
        );
    } catch (error) {
      if (error.name === "ValidationError") {
        const errorMessages = Object.values(error.errors).map(
          (err) => err.message
        );
        console.log(errorMessages);
        return res
          .status(400)
          .json(new ApiResponse(400, null, "Validation error", errorMessages));
      }
      return res
        .status(500)
        .json(new ApiResponse(500, null, "An unexpected error occurred"));
    }
  } else {
    return res
      .status(403)
      .json(
        new ApiResponse(
          403,
          null,
          "This user cannot create a matrimony profile"
        )
      );
  }
});

// Get all Matrimony Profiles
export const getAllProfile = asyncHandler(async (req, res) => {
  try {
    const matrimonyProfiles = await Matrimony.find();

    if (!matrimonyProfiles.length) {
      return res
        .status(200)
        .json(new ApiResponse(200, [], "No matrimony profiles found"));
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          matrimonyProfiles,
          "Matrimony profiles retrieved successfully"
        )
      );
  } catch (error) {
    return res
      .status(500)
      .json(
        new ApiResponse(500, [], "An error occurred while retrieving profiles")
      );
  }
});

// Get all Matrimony Profiles
export const getAllMatrimonyProfile = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    // Find the user's own matrimony profile
    const ownMatrimonyProfile = await Matrimony.findOne({ userId: id });

    if (!ownMatrimonyProfile) {
      return res
        .status(404)
        .json(new ApiResponse(404, [], "User profile not found"));
    }

    // Ensure likedProfiles and pending_likes_id are arrays
    const likedProfiles = Array.isArray(ownMatrimonyProfile.likedProfiles)
      ? ownMatrimonyProfile.likedProfiles
      : [];
    const pendingLikes = Array.isArray(ownMatrimonyProfile.pending_likes_id)
      ? ownMatrimonyProfile.pending_likes_id
      : [];

    // Get blocked users
    const blockedRecords = await MatrimonyReportBlock.find({
      $or: [
        { blockerId: id, isBlocked: true },
        { blockedId: id, isBlocked: true },
      ],
    });

    const blockedUserIds = blockedRecords.map((record) =>
      record.blockerId.toString() === id ? record.blockedId : record.blockerId
    );

    // Get matrimony IDs of users we shouldn't show
    const excludedMatrimonyProfiles = await Matrimony.find({
      $or: [
        { userId: { $in: likedProfiles } }, // Users we've liked
        { userId: { $in: blockedUserIds } }, // Blocked users
        { userId: id }, // Own profile
      ],
    }).select("_id");

    const excludedMatrimonyIds = excludedMatrimonyProfiles.map(
      (profile) => profile._id
    );

    // Use aggregation pipeline for filtering
    const filteredMatrimonyProfiles = await Matrimony.aggregate([
      {
        $match: {
          _id: { $nin: [...excludedMatrimonyIds] }, // Exclude by matrimony ID
          searching_for: {
            $ne: ownMatrimonyProfile.searching_for,
          }, // Looking for opposite gender
          gender:
            ownMatrimonyProfile.searching_for === "groom" ? "Male" : "Female", // Gender validation
        },
      },
      {
        $addFields: {
          // Calculate age difference if needed
          ageDifference: {
            $abs: { $subtract: ["$age", ownMatrimonyProfile.age] },
          },
        },
      },
      {
        $sort: {
          // Example: Sort by recently active or age similarity
          createdAt: -1,
          ageDifference: 1,
        },
      },
      {
        $project: {
          _id: 1,
          userId: 1,
          Fname: 1,
          Lname: 1,
          photo: 1,
          city: 1,
          state: 1,
          salary: 1,
          age: 1,
          bio: 1,
          gender: 1,
          isDivorce: 1,
          cast: 1,
          interests: 1,
          searching_for: 1,
          facebookLink: 1,
          whatsappNumber: 1,
          createdAt: 1,
          // Include any calculated fields
          ageDifference: 1,
        },
      },
    ]);

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          filteredMatrimonyProfiles,
          "Matrimony profiles retrieved successfully"
        )
      );
  } catch (error) {
    console.log(error.message);
    return res
      .status(500)
      .json(
        new ApiResponse(500, [], "An error occurred while retrieving profiles")
      );
  }
});

// Get Matrimony Profile by User ID
export const getMatrimonyProfileByUserId = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const matrimonyProfile = await Matrimony.findOne({ userId: id });

  if (!matrimonyProfile) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Matrimony profile not found"));
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        matrimonyProfile,
        "Matrimony profile retrieved successfully"
      )
    );
});

// Update Matrimony Profile by User ID
export const updateMatrimonyProfileByUserId = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const updatedProfile = await Matrimony.findOneAndUpdate(
      { userId: id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedProfile) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Matrimony profile not found"));
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          updatedProfile,
          "Matrimony profile updated successfully"
        )
      );
  } catch (error) {
    if (error.name === "ValidationError") {
      const errorMessages = Object.values(error.errors).map(
        (err) => err.message
      );
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Validation error", errorMessages));
    }
    return res
      .status(500)
      .json(new ApiResponse(500, null, "An unexpected error occurred"));
  }
});

// Get 5 Random Groom Profiles
export const getRandomGrooms = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  // Find the requesting user's profile
  const userProfile = await Matrimony.findOne({ userId });

  if (!userProfile) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "User profile not found"));
  }

  try {
    // Get the IDs of profiles the user has liked
    const likedProfileIds = userProfile.sent_likes_id || [];

    // Get the IDs of profiles where the user is in their pending_likes_id
    const pendingLikeProfiles = await Matrimony.find({
      pending_likes_id: { $in: [userId] },
    }).select("_id");

    const pendingLikeIdsArray = pendingLikeProfiles.map(
      (profile) => profile._id
    );

    // Fetch 5 random groom profiles excluding:
    // 1. Profiles the user has liked
    // 2. The user's own profile
    // 3. Profiles where the user is in their pending_likes_id
    // 4. Ensure the profile is looking for a bride (since the user is searching for a groom)
    const randomGrooms = await Matrimony.aggregate([
      {
        $match: {
          _id: {
            $nin: [...likedProfileIds, userProfile._id, ...pendingLikeIdsArray],
          }, // Exclude liked, own, and pending profiles
          searching_for:
            userProfile.searching_for === "groom" ? "bride" : "groom", // Ensure the profile matches the user's search criteria
        },
      },
      { $sample: { size: 5 } }, // Get 5 random profiles
      {
        $project: {
          userId: 1,
          Fname: 1,
          Lname: 1,
          photo: 1,
          city: 1,
          state: 1,
          salary: 1,
          age: 1,
          bio: 1,
          gender: 1,
          isDivorce: 1,
          cast: 1,
          interests: 1,
          searching_for: 1,
          facebookLink: 1,
          whatsappNumber: 1,
        },
      },
    ]);

    return res
      .status(200)
      .json(
        new ApiResponse(200, randomGrooms, "Random grooms fetched successfully")
      );
  } catch (error) {
    return res
      .status(500)
      .json(
        new ApiResponse(500, null, "An error occurred while fetching grooms")
      );
  }
});

// Get 5 Random Bride Profiles
export const getRandomBrides = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  // Find the requesting user's profile
  const userProfile = await Matrimony.findOne({ userId });

  if (!userProfile) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "User profile not found"));
  }

  try {
    // Get the IDs of profiles the user has liked
    const likedProfileIds = userProfile.sent_likes_id || [];

    // Get the IDs of profiles where the user is in their pending_likes_id
    const pendingLikeProfiles = await Matrimony.find({
      pending_likes_id: { $in: [userId] },
    }).select("_id");

    const pendingLikeIdsArray = pendingLikeProfiles.map(
      (profile) => profile._id
    );

    // Fetch 5 random bride profiles excluding:
    // 1. Profiles the user has liked
    // 2. The user's own profile
    // 3. Profiles where the user is in their pending_likes_id
    // 4. Ensure the profile is looking for a bride/groom (based on user's search criteria)
    const randomBrides = await Matrimony.aggregate([
      {
        $match: {
          _id: {
            $nin: [...likedProfileIds, userProfile._id, ...pendingLikeIdsArray],
          }, // Exclude liked, own, and pending profiles
          searching_for:
            userProfile.searching_for === "bride" ? "groom" : "bride", // Ensure the profile matches the user's search criteria
        },
      },
      { $sample: { size: 5 } }, // Get 5 random profiles
      {
        $project: {
          userId: 1,
          Fname: 1,
          Lname: 1,
          photo: 1,
          city: 1,
          state: 1,
          salary: 1,
          age: 1,
          bio: 1,
          gender: 1,
          isDivorce: 1,
          cast: 1,
          interests: 1,
          searching_for: 1,
          facebookLink: 1,
          whatsappNumber: 1,
        },
      },
    ]);

    return res
      .status(200)
      .json(
        new ApiResponse(200, randomBrides, "Random brides fetched successfully")
      );
  } catch (error) {
    return res
      .status(500)
      .json(
        new ApiResponse(500, null, "An error occurred while fetching brides")
      );
  }
});

// Send Like to a Matrimony Profile with senderId and receiverId from params
export const sendLikeMatrimony = asyncHandler(async (req, res) => {
  const { senderId, receiverId } = req.params;

  const senderProfile = await Matrimony.findOne({ userId: senderId });
  const receiverProfile = await Matrimony.findOne({ userId: receiverId });

  if (!senderProfile) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Sender profile not found"));
  }

  if (!receiverProfile) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Receiver profile not found"));
  }

  // Ensure sent_likes_id and pending_likes_id are arrays
  senderProfile.sent_likes_id = senderProfile.sent_likes_id || [];
  receiverProfile.pending_likes_id = receiverProfile.pending_likes_id || [];

  // Check if the like has already been sent
  if (senderProfile.sent_likes_id.includes(receiverId)) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Like already sent to this profile"));
  }

  try {
    senderProfile.sent_likes_id.push(receiverId);
    await senderProfile.save({ validateModifiedOnly: true });

    receiverProfile.pending_likes_id.push(senderId);
    await receiverProfile.save({ validateModifiedOnly: true });

    return res
      .status(200)
      .json(new ApiResponse(200, null, "Like sent successfully"));
  } catch (error) {
    return res
      .status(500)
      .json(new ApiResponse(500, null, "An error occurred while sending like"));
  }
});

// Fetch Pending Likes Excluding Sent Likes
export const getPendingLikesProfilesMatrimony = asyncHandler(
  async (req, res) => {
    const { userId } = req.params;

    // Fetch the user’s profile to access pending_likes_id and sent_likes_id
    const userProfile = await Matrimony.findOne({ userId });

    if (!userProfile) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "User profile not found"));
    }

    // Ensure sent_likes_id and pending_likes_id are initialized
    const sentLikes = userProfile.sent_likes_id || [];
    const pendingLikes = userProfile.pending_likes_id || [];

    // Filter pending likes to exclude those already in sent likes
    const filteredPendingLikes = pendingLikes.filter(
      (likeId) => !sentLikes.includes(likeId.toString())
    );

    // If there are no pending likes, send a specific message
    if (filteredPendingLikes.length === 0) {
      return res
        .status(200)
        .json(new ApiResponse(200, null, "No pending likes found"));
    }

    // Fetch detailed profiles for each filtered pending like ID
    const pendingLikeProfiles = await Matrimony.find({
      userId: { $in: filteredPendingLikes },
    }).select(
      "Fname Lname photo city state age gender bio cast salary interests isDivorce userId"
    );

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          pendingLikeProfiles,
          "Pending likes retrieved successfully, excluding sent likes"
        )
      );
  }
);

// Fetch Sent Likes Profiles
export const getSentLikesProfilesMatrimony = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  // Fetch the user’s matrimony profile to access sent_likes_id
  const userProfile = await Matrimony.findOne({ userId });

  if (!userProfile) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "User profile not found"));
  }

  // Ensure sent_likes_id is initialized
  const sentLikes = userProfile.sent_likes_id || [];

  // Check if there are no sent likes
  if (sentLikes.length === 0) {
    return res
      .status(200)
      .json(new ApiResponse(200, null, "No sent likes found"));
  }

  // Fetch detailed profiles for each user in sent_likes_id
  const sentLikeProfiles = await Matrimony.find({
    userId: { $in: sentLikes },
  }).select(
    "Fname Lname photo city state age gender bio cast salary interests isDivorce userId"
  );

  // If no profiles are found for sent likes, return null with a relevant message
  if (sentLikeProfiles.length === 0) {
    return res
      .status(200)
      .json(new ApiResponse(200, null, "No sent likes profiles found"));
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        sentLikeProfiles,
        "Sent likes profiles retrieved successfully"
      )
    );
});

// Delete Matrimony Profile by User ID
export const deleteMatrimonyProfileByUserId = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Find and delete the Matrimony profile by userId
  const deletedProfile = await Matrimony.findOneAndDelete({ userId: id });

  if (!deletedProfile) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Matrimony profile not found"));
  }

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Matrimony profile deleted successfully"));
});

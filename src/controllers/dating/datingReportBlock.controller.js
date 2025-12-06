import mongoose from "mongoose";
import { DatingReportBlock } from "../../models/dating/datingReportBlock.model.js";
import { Dating } from "../../models/dating/dating.model.js";
import { MatchedProfileDating } from "../../models/dating/matchedProfileDating.model.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/apiResponse.js";


// Report a user
export const reportUser = asyncHandler(async (req, res) => {
  try {
    const { reporterId, reportedId } = req.params;
    const { reportReason, reportDescription } = req.body;

    // Validate IDs
    if (!reporterId || !reportedId) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Both user IDs are required"));
    }

    // Check if reporter and reported are the same user
    if (reporterId === reportedId) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Cannot report yourself"));
    }

    // Check if both users exist in Dating collection
    const reporterExists = await Dating.findOne({ userId: reporterId });
    const reportedExists = await Dating.findOne({ userId: reportedId });

    if (!reporterExists || !reportedExists) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "One or both users not found"));
    }

    // Check if already reported
    const existingReport = await DatingReportBlock.findOne({
      reporterId,
      reportedId,
      reportReason: { $exists: true },
    });

    if (existingReport) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "User already reported"));
    }

    // Create new report
    const newReport = await DatingReportBlock.create({
      reporterId,
      reportedId,
      reportReason,
      reportDescription,
      reportStatus: "pending",
    });

    return res
      .status(201)
      .json(new ApiResponse(201, newReport, "User reported successfully"));
  } catch (error) {
    console.error("Error reporting user:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Error reporting user"));
  }
});

// Block a user
export const blockUser = asyncHandler(async (req, res) => {
  try {
    const { blockerId, blockedId } = req.params;

    // Validate IDs
    if (!blockerId || !blockedId) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Both user IDs are required"));
    }

    // Check if blocking self
    if (blockerId === blockedId) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Cannot block yourself"));
    }

    // Check if both users exist in Dating collection
    const blockerExists = await Dating.findOne({ userId: blockerId });
    const blockedExists = await Dating.findOne({ userId: blockedId });

    if (!blockerExists || !blockedExists) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "One or both users not found"));
    }

    // Check if already blocked
    const existingBlock = await DatingReportBlock.findOne({
      blockerId,
      blockedId,
      isBlocked: true,
    });

    if (existingBlock) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "User already blocked"));
    }

    // Deactivate any existing match between users
    await MatchedProfileDating.updateMany(
      {
        $or: [
          { user1: blockerId, user2: blockedId },
          { user1: blockedId, user2: blockerId },
        ],
        isActive: true,
      },
      { isActive: false }
    );

    // Create or update block record
    const blockRecord = await DatingReportBlock.findOneAndUpdate(
      { blockerId, blockedId },
      {
        blockerId,
        blockedId,
        isBlocked: true,
        blockedAt: new Date(),
        unblockedAt: null,
      },
      { upsert: true, new: true }
    );

    return res
      .status(200)
      .json(new ApiResponse(200, blockRecord, "User blocked successfully"));
  } catch (error) {
    console.error("Error blocking user:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Error blocking user"));
  }
});

// Unblock a user
export const unblockUser = asyncHandler(async (req, res) => {
  try {
    const { blockerId, blockedId } = req.params;

    // Validate IDs
    if (!blockerId || !blockedId) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Both user IDs are required"));
    }

    // Find existing block
    const existingBlock = await DatingReportBlock.findOne({
      blockerId,
      blockedId,
      isBlocked: true,
    });

    if (!existingBlock) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Block record not found"));
    }

    // Update block record
    existingBlock.isBlocked = false;
    existingBlock.unblockedAt = new Date();
    await existingBlock.save();

    return res
      .status(200)
      .json(new ApiResponse(200, existingBlock, "User unblocked successfully"));
  } catch (error) {
    console.error("Error unblocking user:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Error unblocking user"));
  }
});

// Get blocked users list
export const getBlockedUsers = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;

    // Get all users blocked by this user
    const blockedRecords = await DatingReportBlock.find({
      blockerId: userId,
      isBlocked: true,
    }).populate({
      path: "blockedId",
      select: "Fname Lname photos",
    });

    // Filter out records where blockedId is null or doesn't exist
    const validBlockedRecords = blockedRecords.filter(
      (record) => record.blockedId && record.blockedId._id
    );

    if (validBlockedRecords.length === 0) {
      return res
        .status(200)
        .json(
          new ApiResponse(200, [], "No blocked users found")
        );
    }

    // Extract user details with null checking
    const blockedUsers = validBlockedRecords.map((record) => ({
      blockId: record._id,
      userId: record.blockedId._id,
      Fname: record.blockedId.Fname || "User",
      Lname: record.blockedId.Lname || "",
      photos: record.blockedId.photos || [],
      blockedAt: record.blockedAt,
    }));

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          blockedUsers,
          "Blocked users retrieved successfully"
        )
      );
  } catch (error) {
    console.error("Error fetching blocked users:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Error fetching blocked users"));
  }
});


// Get reports for a user (Admin only)
export const getUserReports = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;

    // Get all reports for this user (both as reporter and reported)
    const reports = await DatingReportBlock.find({
      $or: [{ reporterId: userId }, { reportedId: userId }],
      reportReason: { $exists: true },
    })
      .populate("reporterId", "Fname Lname photos")
      .populate("reportedId", "Fname Lname photos")
      .sort({ createdAt: -1 });

    return res
      .status(200)
      .json(new ApiResponse(200, reports, "Reports retrieved successfully"));
  } catch (error) {
    console.error("Error fetching reports:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Error fetching reports"));
  }
});

// Update report status (Admin only)
export const updateReportStatus = asyncHandler(async (req, res) => {
  try {
    const { reportId } = req.params;
    const { reportStatus, adminNotes } = req.body;

    const report = await DatingReportBlock.findById(reportId);

    if (!report) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Report not found"));
    }

    report.reportStatus = reportStatus;
    if (adminNotes) {
      report.adminNotes = adminNotes;
    }

    await report.save();

    return res
      .status(200)
      .json(new ApiResponse(200, report, "Report status updated successfully"));
  } catch (error) {
    console.error("Error updating report status:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Error updating report status"));
  }
});

// Check if user is blocked
export const checkIfBlocked = asyncHandler(async (req, res) => {
  try {
    const { userId1, userId2 } = req.params;

    // Check both directions
    const block1 = await DatingReportBlock.findOne({
      blockerId: userId1,
      blockedId: userId2,
      isBlocked: true,
    });

    const block2 = await DatingReportBlock.findOne({
      blockerId: userId2,
      blockedId: userId1,
      isBlocked: true,
    });

    const isBlocked = !!(block1 || block2);
    const blockedByMe = !!block1;
    const blockedByThem = !!block2;

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          isBlocked,
          blockedByMe,
          blockedByThem,
          blockDetails: {
            myBlock: block1,
            theirBlock: block2,
          },
        },
        "Block status checked successfully"
      )
    );
  } catch (error) {
    console.error("Error checking block status:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Error checking block status"));
  }
});

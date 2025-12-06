import mongoose from "mongoose";
import { MatrimonyReportBlock } from "../../models/matrimony/matrimonyReportBlock.model.js";
import { Matrimony } from "../../models/matrimony/matrimony.model.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

// Report a Matrimony User
export const reportMatrimonyUser = asyncHandler(async (req, res) => {
  try {
    const { reporterId, reportedId } = req.params;
    const { reportReason, reportDescription } = req.body;

    if (!reporterId || !reportedId) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Both user IDs are required"));
    }

    if (reporterId === reportedId) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Cannot report yourself"));
    }

    const reporterExists = await Matrimony.findOne({ userId: reporterId });
    const reportedExists = await Matrimony.findOne({ userId: reportedId });

    if (!reporterExists || !reportedExists) {
      return res
        .status(404)
        .json(
          new ApiResponse(404, null, "One or both users not found in matrimony")
        );
    }

    const existingReport = await MatrimonyReportBlock.findOne({
      reporterId,
      reportedId,
      reportReason: { $exists: true },
    });

    if (existingReport) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "User already reported"));
    }

    const newReport = await MatrimonyReportBlock.create({
      reporterId,
      reportedId,
      reportReason,
      reportDescription,
      reportStatus: "pending",
    });

    return res
      .status(201)
      .json(
        new ApiResponse(201, newReport, "Matrimony user reported successfully")
      );
  } catch (error) {
    console.error("Error reporting matrimony user:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Error reporting user"));
  }
});

// Block a Matrimony User
export const blockMatrimonyUser = asyncHandler(async (req, res) => {
  try {
    const { blockerId, blockedId } = req.params;

    if (!blockerId || !blockedId) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Both user IDs are required"));
    }

    if (blockerId === blockedId) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Cannot block yourself"));
    }

    const blockerExists = await Matrimony.findOne({ userId: blockerId });
    const blockedExists = await Matrimony.findOne({ userId: blockedId });

    if (!blockerExists || !blockedExists) {
      return res
        .status(404)
        .json(
          new ApiResponse(404, null, "One or both users not found in matrimony")
        );
    }

    const existingBlock = await MatrimonyReportBlock.findOne({
      blockerId,
      blockedId,
      isBlocked: true,
    });

    if (existingBlock) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "User already blocked"));
    }

    // Remove from sent_likes_id and pending_likes_id
    await Matrimony.updateOne(
      { userId: blockerId },
      {
        $pull: {
          sent_likes_id: blockedId,
          pending_likes_id: blockedId,
        },
      }
    );

    await Matrimony.updateOne(
      { userId: blockedId },
      {
        $pull: {
          sent_likes_id: blockerId,
          pending_likes_id: blockerId,
        },
      }
    );

    const blockRecord = await MatrimonyReportBlock.findOneAndUpdate(
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
      .json(
        new ApiResponse(200, blockRecord, "Matrimony user blocked successfully")
      );
  } catch (error) {
    console.error("Error blocking matrimony user:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Error blocking user"));
  }
});

// Unblock a Matrimony User
export const unblockMatrimonyUser = asyncHandler(async (req, res) => {
  try {
    const { blockerId, blockedId } = req.params;

    if (!blockerId || !blockedId) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Both user IDs are required"));
    }

    const existingBlock = await MatrimonyReportBlock.findOne({
      blockerId,
      blockedId,
      isBlocked: true,
    });

    if (!existingBlock) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Block record not found"));
    }

    existingBlock.isBlocked = false;
    existingBlock.unblockedAt = new Date();
    await existingBlock.save();

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          existingBlock,
          "Matrimony user unblocked successfully"
        )
      );
  } catch (error) {
    console.error("Error unblocking matrimony user:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Error unblocking user"));
  }
});

// Get Blocked Matrimony Users
export const getBlockedMatrimonyUsers = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;

    const blockedRecords = await MatrimonyReportBlock.find({
      blockerId: userId,
      isBlocked: true,
    }).populate({
      path: "blockedId",
      select: "Fname Lname",
    });

    // Filter out records where blockedId is null
    const validBlockedRecords = blockedRecords.filter(
      (record) => record.blockedId && record.blockedId._id
    );

    if (validBlockedRecords.length === 0) {
      return res
        .status(200)
        .json(new ApiResponse(200, [], "No blocked matrimony users found"));
    }

    // Fetch full matrimony profiles for blocked users
    const blockedUsers = await Promise.all(
      validBlockedRecords.map(async (record) => {
        try {
          const matrimonyProfile = await Matrimony.findOne({
            userId: record.blockedId._id,
          }).select("Fname Lname photo city state age gender");

          if (!matrimonyProfile) {
            return {
              blockId: record._id,
              userId: record.blockedId._id,
              Fname: record.blockedId.Fname || "User",
              Lname: record.blockedId.Lname || "",
              photo: [],
              city: "Not available",
              state: "Not available",
              age: null,
              gender: "Not available",
              blockedAt: record.blockedAt,
              profileExists: false,
            };
          }

          return {
            blockId: record._id,
            userId: record.blockedId._id,
            Fname: matrimonyProfile.Fname || "User",
            Lname: matrimonyProfile.Lname || "",
            photo: matrimonyProfile.photo || [],
            city: matrimonyProfile.city || "",
            state: matrimonyProfile.state || "",
            age: matrimonyProfile.age || null,
            gender: matrimonyProfile.gender || "",
            blockedAt: record.blockedAt,
            profileExists: true,
          };
        } catch (error) {
          console.error(
            `Error fetching profile for user ${record.blockedId._id}:`,
            error
          );
          return null;
        }
      })
    );

    // Filter out any null results from the map
    const filteredBlockedUsers = blockedUsers.filter((user) => user !== null);

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          filteredBlockedUsers,
          "Blocked matrimony users retrieved successfully"
        )
      );
  } catch (error) {
    console.error("Error fetching blocked matrimony users:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Error fetching blocked users"));
  }
});

// Check Matrimony Block Status
export const checkMatrimonyBlockStatus = asyncHandler(async (req, res) => {
  try {
    const { userId1, userId2 } = req.params;

    const block1 = await MatrimonyReportBlock.findOne({
      blockerId: userId1,
      blockedId: userId2,
      isBlocked: true,
    });

    const block2 = await MatrimonyReportBlock.findOne({
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
        "Matrimony block status checked successfully"
      )
    );
  } catch (error) {
    console.error("Error checking matrimony block status:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Error checking block status"));
  }
});

// Get Matrimony Reports (Admin)
export const getMatrimonyUserReports = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;

    const reports = await MatrimonyReportBlock.find({
      $or: [{ reporterId: userId }, { reportedId: userId }],
      reportReason: { $exists: true },
    })
      .populate("reporterId", "Fname Lname")
      .populate("reportedId", "Fname Lname")
      .sort({ createdAt: -1 });

    // Fetch matrimony profile details
    const reportsWithMatrimonyDetails = await Promise.all(
      reports.map(async (report) => {
        const reporterProfile = await Matrimony.findOne({
          userId: report.reporterId._id,
        }).select("photo city state");

        const reportedProfile = await Matrimony.findOne({
          userId: report.reportedId._id,
        }).select("photo city state");

        return {
          ...report.toObject(),
          reporterDetails: {
            ...report.reporterId.toObject(),
            photo: reporterProfile?.photo || [],
            city: reporterProfile?.city || "",
            state: reporterProfile?.state || "",
          },
          reportedDetails: {
            ...report.reportedId.toObject(),
            photo: reportedProfile?.photo || [],
            city: reportedProfile?.city || "",
            state: reportedProfile?.state || "",
          },
        };
      })
    );

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          reportsWithMatrimonyDetails,
          "Matrimony reports retrieved successfully"
        )
      );
  } catch (error) {
    console.error("Error fetching matrimony reports:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Error fetching reports"));
  }
});

// Update Matrimony Report Status (Admin)
export const updateMatrimonyReportStatus = asyncHandler(async (req, res) => {
  try {
    const { reportId } = req.params;
    const { reportStatus, adminNotes } = req.body;

    const report = await MatrimonyReportBlock.findById(reportId);

    if (!report) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Matrimony report not found"));
    }

    report.reportStatus = reportStatus;
    if (adminNotes) {
      report.adminNotes = adminNotes;
    }

    await report.save();

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          report,
          "Matrimony report status updated successfully"
        )
      );
  } catch (error) {
    console.error("Error updating matrimony report status:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Error updating report status"));
  }
});

// Get Reports by Status (Admin)
export const getMatrimonyReportsByStatus = asyncHandler(async (req, res) => {
  try {
    const { status } = req.params;

    const validStatuses = ["pending", "investigating", "resolved", "dismissed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json(new ApiResponse(400, null, "Invalid status"));
    }

    const reports = await MatrimonyReportBlock.find({
      reportStatus: status,
      reportReason: { $exists: true },
    })
      .populate("reporterId", "Fname Lname")
      .populate("reportedId", "Fname Lname")
      .sort({ createdAt: -1 });

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          reports,
          `Matrimony reports with status ${status} retrieved successfully`
        )
      );
  } catch (error) {
    console.error("Error fetching reports by status:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Error fetching reports"));
  }
});

// Check if user can interact (combined check)
export const canInteractWithMatrimonyUser = asyncHandler(async (req, res) => {
  try {
    const { userId1, userId2 } = req.params;

    // Check blocking in both directions
    const block1 = await MatrimonyReportBlock.findOne({
      blockerId: userId1,
      blockedId: userId2,
      isBlocked: true,
    });

    const block2 = await MatrimonyReportBlock.findOne({
      blockerId: userId2,
      blockedId: userId1,
      isBlocked: true,
    });

    // Check if either user has reported the other with unresolved report
    const unresolvedReport = await MatrimonyReportBlock.findOne({
      $or: [
        {
          reporterId: userId1,
          reportedId: userId2,
          reportStatus: { $in: ["pending", "investigating"] },
        },
        {
          reporterId: userId2,
          reportedId: userId1,
          reportStatus: { $in: ["pending", "investigating"] },
        },
      ],
    });

    const canInteract = !block1 && !block2 && !unresolvedReport;

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          canInteract,
          blocked: !!(block1 || block2),
          hasUnresolvedReport: !!unresolvedReport,
          blockingDetails: {
            iBlockedThem: !!block1,
            theyBlockedMe: !!block2,
          },
          reportDetails: unresolvedReport
            ? {
                reportId: unresolvedReport._id,
                reporterId: unresolvedReport.reporterId,
                reportStatus: unresolvedReport.reportStatus,
              }
            : null,
        },
        "Interaction status checked successfully"
      )
    );
  } catch (error) {
    console.error("Error checking interaction status:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Error checking interaction status"));
  }
});

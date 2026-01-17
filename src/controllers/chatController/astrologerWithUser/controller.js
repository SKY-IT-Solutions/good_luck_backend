import moment from "moment-timezone";
import { Astrologer } from "../../../models/astrologer/astroler.model.js";
import { User } from "../../../models/auth/user.model.js";
import { ChatRequest } from "../../../models/chatRequest/chatRequest.model.js";
import { AstrologerChat } from "../../../models/chatWithAstrologer/astrologerChat.model.js";
import { ApiResponse } from "../../../utils/apiResponse.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import {
  endCall,
  endChat,
  getChatPrice,
  pauseChat,
  resumeChat,
  startCall,
  startChat,
} from "./chatBilling.js";
import AgoraAccessToken from "agora-access-token";

// Function to handle chat requests
export async function handleChatRequest(io, data, socket) {
  try {
    const { userId, astrologerId, chatType } = data;
    // console.log(userId, astrologerId, chatType);

    // Retrieve the astrologer's details to get the socket ID and status
    const astrologer = await Astrologer.findById(astrologerId);
    if (!astrologer) {
      return socket.emit("error", { message: "Astrologer not found." });
    }

    // Check if the astrologer is busy or offline
    if (astrologer.status === "busy") {
      return socket.emit("error", {
        message: "Astrologer is currently busy.",
      });
    }

    if (!astrologer.socketId) {
      return socket.emit("error", { message: "Astrologer is not online." });
    }

    // Retrieve the user's wallet details to check balance
    const user = await User.findById(userId);
    if (!user) {
      return socket.emit("error", { message: "User not found." });
    }

    // Get the chat price for the requested chat type
    const costPerMinute = await getChatPrice(chatType, astrologerId);

    // Check if the user has sufficient funds
    if (user.wallet.balance < costPerMinute) {
      return io
        .to(user.socketId)
        .emit("chat-error", { message: "Insufficient funds." });
    }

    // console.log(costPerMinute);

    // Save the chat request in the database
    const chatRequest = new ChatRequest({ userId, astrologerId, chatType });
    await chatRequest.save();

    // console.log(chatRequest);

    // Notify the astrologer about the incoming chat request using their socket ID
    console.log(
      `Notifying astrologer ${astrologer.socketId} about incoming chat request from user ${userId}`
    );

    io.to(user.socketId).emit("chat-request-success", {
      requestId: chatRequest._id,
      astrologerId,
      chatType,
    });
    io.to(astrologer.socketId).emit("chat-request-from-user", {
      requestId: chatRequest._id,
      userId,
      chatType,
      Fname: user?.Fname,
      Lname: user?.Lname,
      profile_picture: user?.profile_picture,
    });

    // // Notify the astrologer about the incoming chat request using their socket ID
    // io.to(astrologer.socketId).emit("chat-request-from-user", {
    //   requestId: chatRequest._id,
    //   userId,
    //   chatType,
    // });

    console.log(
      `Chat request sent to astrologer: ${astrologerId}, Socket ID: ${astrologer.socketId}`
    );
  } catch (error) {
    console.error("Error handling chat request:", error);
    socket.emit("error", { message: "Error processing chat request." });
  }
}

// Function to handle astrologer's response to a chat request
export async function handleChatResponse(io, data) {
  try {
    const { requestId, response } = data;

    // Update chat request status in the database
    const chatRequest = await ChatRequest.findById(requestId);
    if (!chatRequest) {
      io.emit("error", { message: "Chat request not found" });
      return;
    }

    // Check if request was already cancelled by user
    if (chatRequest.status === "user_cancelled") {
      // Find astrologer and notify them
      const astrologer = await Astrologer.findById(chatRequest.astrologerId);
      if (astrologer && astrologer.socketId) {
        io.to(astrologer.socketId).emit("chat-request-expired", {
          requestId,
          message: "User has cancelled this chat request.",
        });
      }
      return;
    }

    // Check if request is no longer pending
    if (chatRequest.status !== "pending") {
      // Find astrologer and notify them
      const astrologer = await Astrologer.findById(chatRequest.astrologerId);
      if (astrologer && astrologer.socketId) {
        io.to(astrologer.socketId).emit("chat-request-expired", {
          requestId,
          message: `This request is already ${chatRequest.status}.`,
        });
      }
      return;
    }

    chatRequest.status = response;
    await chatRequest.save();

    if (response === "accepted") {
      const roomId = `room_${chatRequest.userId}_${chatRequest.astrologerId}`;
      chatRequest.roomId = roomId;
      await chatRequest.save();

      // Update the astrologer's status to "busy"
      const astrologer = await Astrologer.findById(chatRequest.astrologerId);
      astrologer.status = "busy";
      await astrologer.save();

      // Find the user and astrologer by their IDs to get the socketIds
      const user = await User.findById(chatRequest.userId);
      const astrologerUser = await Astrologer.findById(
        chatRequest.astrologerId
      );

      if (!user || !astrologerUser) {
        return io.emit("error", { message: "User or astrologer not found" });
      }

      // Get the socket IDs from the user and astrologer
      const userSocketId = user.socketId;
      const astrologerSocketId = astrologerUser.socketId;

      // Check if user is still online before creating chat room
      if (userSocketId) {
        // Notify the user about chat acceptance
        io.to(userSocketId).emit("chat-accepted", { roomId });
      } else {
        console.error("User is not online - cannot start chat");

        // Notify astrologer that user is offline
        if (astrologerSocketId) {
          io.to(astrologerSocketId).emit("user-offline-for-chat", {
            requestId,
            message: "User is not online. Chat cannot be started.",
          });
        }

        // Revert astrologer status
        astrologerUser.status = "available";
        await astrologerUser.save();

        // Update request status
        chatRequest.status = "expired";
        await chatRequest.save();

        return;
      }

      if (astrologerSocketId) {
        // Notify the astrologer about chat acceptance
        io.to(astrologerSocketId).emit("chat-accepted", { roomId });
      } else {
        console.error("Astrologer is not online");
      }

      // Start the chat billing process only if both are online
      if (userSocketId && astrologerSocketId) {
        startChat(
          io,
          roomId,
          chatRequest.chatType,
          chatRequest.userId,
          chatRequest.astrologerId
        );
      }
    } else {
      // Handle rejection logic
      const user = await User.findById(chatRequest.userId);
      if (user && user.socketId) {
        // Notify the user about the rejection
        io.to(user.socketId).emit("chat-rejected");
      } else {
        console.error("User is not online or socket ID not found");
      }
    }
  } catch (error) {
    console.error("Error handling chat response:", error);
  }
}

// // Function to handle saving and broadcasting chat messages
// export const handleChatMessage = async (data, io) => {
//   const { roomId, message, senderId, senderModel, duration } = data;

//   // Validate senderModel
//   if (!["User", "Astrologer"].includes(senderModel)) {
//     return { error: "Invalid sender model" };
//   }

//   try {
//     // Find or create the chat room
//     let chat = await AstrologerChat.findOne({ roomId });

//     if (!chat) {
//       chat = new AstrologerChat({ roomId, messages: [], duration });
//     }

//     // Add the new message to the messages array
//     const newMessage = {
//       senderId,
//       senderModel,
//       message,
//     };
//     chat.messages.push(newMessage);

//     // Save the updated chat document
//     await chat.save();

//     // Broadcast the message to the chat room
//     io.to(roomId).emit("received-message", {
//       senderId,
//       senderModel,
//       message,
//       timestamp: newMessage.timestamp,
//       duration,
//     });
//     console.log("Message broadcasted to room:", roomId);

//     return { success: true, timestamp: newMessage.timestamp };
//   } catch (error) {
//     console.error("Error saving message:", error);
//     return { error: "Could not save message" };
//   }
// };

// Function to handle saving and broadcasting chat messages
export const handleChatMessage = async (data, io) => {
  const {
    roomId,
    message,
    senderId,
    senderModel,
    receiverId,
    receiverModel,
    duration,
  } = data;

  // Validate sender and receiver models
  if (
    !["User", "Astrologer"].includes(senderModel) ||
    !["User", "Astrologer"].includes(receiverModel)
  ) {
    return { error: "Invalid sender or receiver model" };
  }

  try {
    let chat = await AstrologerChat.findOne({ roomId });

    if (!chat) {
      chat = new AstrologerChat({ roomId, messages: [], duration });
    }

    const newMessage = {
      senderId,
      senderModel,
      receiverId,
      receiverModel,
      message,
      timestamp: moment().tz("Asia/Kolkata").toDate(),
    };

    chat.messages.push(newMessage);
    await chat.save();

    io.to(roomId).emit("received-message", {
      senderId,
      senderModel,
      receiverId,
      receiverModel,
      message,
      timestamp: newMessage.timestamp,
      duration,
    });
    console.log("Message broadcasted to room:", roomId);

    return { success: true, timestamp: newMessage.timestamp };
  } catch (error) {
    console.error("Error saving message:", error);
    return { error: "Could not save message" };
  }
};

// Function to handle the end of the chat and update the astrologer's status
export async function handleEndChat(io, roomId, sender) {
  try {
    // End the chat and stop the timer, passing the sender information to determine the reason
    endChat(io, roomId, sender);

    // Find the chat request based on the roomId
    const chatRequest = await ChatRequest.findOne({ roomId });
    if (!chatRequest) {
      console.error("Chat request not found for roomId:", roomId);
      return;
    }

    // Find the astrologer based on the chat request
    const astrologer = await Astrologer.findById(chatRequest.astrologerId);
    if (!astrologer) {
      console.error("Astrologer not found:", chatRequest.astrologerId);
      return;
    }

    // Update the astrologer's status to 'available'
    astrologer.status = "available";
    await astrologer.save();

    console.log("Astrologer's status updated to available:", astrologer._id);
  } catch (error) {
    console.error("Error handling end of chat:", error);
  }
}

// Function to handle pausing the chat
export async function handlePauseChat(io, data) {
  const { roomId } = data;

  try {
    pauseChat(io, roomId);
  } catch (error) {
    console.error("Error pausing chat:", error);
    io.to(roomId).emit("chat-error", { message: "Error pausing chat." });
  }
}

// Function to handle resuming the chat
export async function handleResumeChat(io, data) {
  const { roomId, chatType, userId, astrologerId } = data;

  try {
    resumeChat(io, roomId, chatType, userId, astrologerId);
  } catch (error) {
    console.error("Error resuming chat:", error);
    io.to(roomId).emit("chat-error", { message: "Error resuming chat." });
  }
}

const appID = process.env.AGORA_APP_ID;
const appCertificate = process.env.APP_CERTIFICATE;

// Function to handle call requests
export async function handleCallRequest(io, data, socket) {
  try {
    const { userId, astrologerId, callType, channelId, userUid } = data; // 🔥 userUid receive করুন

    console.log("📞 Call request received:", {
      userId,
      astrologerId,
      userUid,
      channelId,
    });

    // Retrieve the astrologer's details to get the socket ID and status
    const astrologer = await Astrologer.findById(astrologerId);
    if (!astrologer) {
      return socket.emit("error", { message: "Astrologer not found." });
    }

    // Check if the astrologer is busy or offline
    if (astrologer.status === "busy") {
      return socket.emit("error", {
        message: "Astrologer is currently busy.",
      });
    }

    if (!astrologer.socketId) {
      return socket.emit("error", { message: "Astrologer is not online." });
    }

    // Retrieve the user's wallet details to check balance
    const user = await User.findById(userId);
    if (!user) {
      return socket.emit("error", { message: "User not found." });
    }

    // Get the call price for the requested call type
    const costPerMinute = await getChatPrice(callType, astrologerId);

    // Check if the user has sufficient funds
    if (user.wallet.balance < costPerMinute) {
      return io
        .to(user.socketId)
        .emit("call-error", { message: "Insufficient funds." });
    }

    // Save the call request in the database
    const callRequest = new ChatRequest({
      userId,
      astrologerId,
      chatType: callType,
    });
    await callRequest.save();

    const finalUserUid = userUid || Math.floor(Math.random() * 100000);
    const astrologerUid = Math.floor(Math.random() * 100000);

    // console.log(
    //   "🆔 UIDs for call - User:",
    //   finalUserUid,
    //   "Astrologer:",
    //   astrologerUid
    // );

    // Function to generate Agora token
    const generateAgoraToken = (
      channelName,
      appID,
      appCertificate,
      uid,
      role
    ) => {
      return AgoraAccessToken.RtcTokenBuilder.buildTokenWithUid(
        appID,
        appCertificate,
        channelName,
        uid,
        role,
        Math.floor(Date.now() / 1000) + 3600 // Token expires in 1 hour
      );
    };

    // Define the channel name from the passed `channelId`
    const channelName = channelId;

    // Generate tokens for both client (PUBLISHER) and astrologer (PUBLISHER)
    const clientToken = generateAgoraToken(
      channelName,
      appID,
      appCertificate,
      finalUserUid,
      AgoraAccessToken.RtcRole.PUBLISHER
    );
    const astrologerToken = generateAgoraToken(
      channelName,
      appID,
      appCertificate,
      astrologerUid,
      AgoraAccessToken.RtcRole.PUBLISHER
    );

    // Notify the astrologer about the incoming call request using their socket ID
    io.to(astrologer.socketId).emit("call-request-from-user", {
      requestId: callRequest._id,
      userId,
      Fname: user?.Fname,
      Lname: user?.Lname,
      profile_picture: user?.profile_picture,
      callType,
      channelName,
      userUid: finalUserUid,
      astrologerUid: astrologerUid,
      clientToken: astrologerToken,
      astrologerToken: astrologerToken,
      appId: appID,
    });

    io.to(user.socketId).emit("call-details", {
      requestId: callRequest._id,
      astrologerId,
      callType,
      channelName,
      userUid: finalUserUid,
      astrologerUid: astrologerUid,
      clientToken: clientToken,
      astrologerToken: astrologerToken,
      appId: appID,
    });

    // console.log("✅ Final verified call details:");
    // console.log(
    //   "📤 To ASTROLOGER - userUid:",
    //   finalUserUid,
    //   "astrologerUid:",
    //   astrologerUid
    // );
    // console.log(
    //   "📤 To USER - userUid:",
    //   finalUserUid,
    //   "astrologerUid:",
    //   astrologerUid
    // );

    // console.log("✅ Final call details summary:");
    // console.log("- User UID:", finalUserUid);
    // console.log("- Astrologer UID:", astrologerUid);
    // console.log("- Channel:", channelName);
    // console.log("- User Token:", clientToken?.substring(0, 20) + "...");
    // console.log(
    //   "- Astrologer Token:",
    //   astrologerToken?.substring(0, 20) + "..."
    // );

    // console.log("📤 Sending to USER:", {
    //   userUid: finalUserUid,
    //   astrologerUid: astrologerUid, // ✅ এই line নিশ্চিত করুন
    //   channelName: channelName,
    // });

    // console.log("📤 Sending to ASTROLOGER:", {
    //   userUid: finalUserUid,
    //   astrologerUid: astrologerUid,
    //   channelName: channelName,
    // });

    // console.log("✅ Call details sent to user with consistent UIDs");
  } catch (error) {
    console.error("❌ Error handling call request:", error);
    socket.emit("error", { message: "Error processing call request." });
  }
}

// Function to handle astrologer's response to a call request
export async function handleCallResponse(io, data, socket) {
  try {
    const { requestId, response, userId, astrologerId, callType } = data;

    console.log("📞 Call response received:", {
      requestId,
      response,
      userId,
      astrologerId,
    });

    const callRequest = await ChatRequest.findById(requestId);
    if (!callRequest) {
      return socket.emit("call-error", { message: "Call request not found" });
    }

    callRequest.status = response;
    await callRequest.save();

    if (response === "accepted") {
      // Astrologer status update করুন
      const astrologer = await Astrologer.findById(astrologerId);
      if (astrologer) {
        astrologer.status = "busy";
        await astrologer.save();
        console.log(`✅ Astrologer ${astrologerId} status updated to busy`);
      }

      const roomId = `room_${callRequest.userId}_${callRequest.astrologerId}`;
      callRequest.roomId = roomId;
      await callRequest.save();

      const user = await User.findById(userId);

      if (!user) {
        return socket.emit("call-error", { message: "User not found" });
      }

      const userSocketId = user.socketId;
      const astrologerSocketId = astrologer?.socketId;

      console.log("📢 Emitting call-accepted to:", {
        userSocketId,
        astrologerSocketId,
        roomId,
      });

      // User কে notify করুন
      if (userSocketId) {
        io.to(userSocketId).emit("call-accepted", {
          roomId,
          message: "Astrologer has joined the call.",
        });
        console.log("✅ call-accepted sent to user");
      }

      // Astrologer কে notify করুন
      if (astrologerSocketId) {
        io.to(astrologerSocketId).emit("call-accepted", {
          roomId,
          message: "Call started successfully.",
        });
        console.log("✅ call-accepted sent to astrologer");
      }

      // Call billing start করুন
      await startCall(io, roomId, callType, userId, astrologerId);
    } else if (response === "rejected") {
      const user = await User.findById(callRequest.userId);
      if (user && user.socketId) {
        io.to(user.socketId).emit("call-rejected", {
          message: "Astrologer rejected the call.",
        });
      }

      // Astrologer status revert করুন যদি reject হয়
      const astrologer = await Astrologer.findById(astrologerId);
      if (astrologer && astrologer.status === "busy") {
        astrologer.status = "online";
        await astrologer.save();
      }
    }
  } catch (error) {
    console.error("❌ Error handling call response:", error);
    socket.emit("call-error", { message: "Error handling call response." });
  }
}

// Function to handle the end of the call and update the astrologer's status
export async function handleEndCall(io, roomId, sender) {
  try {
    // End the call and stop the timer, passing the sender information to determine the reason
    endCall(io, roomId, sender);

    // Find the call request based on the roomId
    const callRequest = await ChatRequest.findOne({ roomId });
    if (!callRequest) {
      console.error("Call request not found for roomId:", roomId);
      return;
    }

    // Find the astrologer based on the call request
    const astrologer = await Astrologer.findById(callRequest.astrologerId);
    if (!astrologer) {
      console.error("Astrologer not found:", callRequest.astrologerId);
      return;
    }

    // Update the astrologer's status to 'available'
    astrologer.status = "available";
    await astrologer.save();

    console.log("Astrologer's status updated to available:", astrologer._id);
  } catch (error) {
    console.error("Error handling end of call:", error);
  }
}

// Function to handle cancellation of chat/call request by user
export async function handleCancelRequest(io, data, socket) {
  try {
    const { requestId, userId, requestType } = data;

    console.log(`Canceling ${requestType} request:`, { requestId, userId });

    // Find the request in the database
    const request = await ChatRequest.findById(requestId);
    if (!request) {
      return socket.emit("error", { message: "Request not found." });
    }

    // Verify that the request belongs to the user trying to cancel it
    if (request.userId.toString() !== userId) {
      return socket.emit("error", {
        message: "You are not authorized to cancel this request.",
      });
    }

    // Check if request is already processed
    if (request.status !== "pending") {
      return socket.emit("error", {
        message: `Request already ${request.status}. Cannot cancel.`,
      });
    }

    // Update request status to 'cancelled'
    request.status = "cancelled";
    await request.save();

    // Find the astrologer to notify
    const astrologer = await Astrologer.findById(request.astrologerId);
    if (astrologer && astrologer.socketId) {
      // Notify astrologer about the cancellation
      io.to(astrologer.socketId).emit("request-cancelled", {
        requestId,
        userId,
        requestType,
        message: `User cancelled the ${requestType} request.`,
      });
      console.log(`Notified astrologer about ${requestType} cancellation`);
    }

    // Also notify the user that cancellation was successful
    socket.emit("request-cancelled-success", {
      requestId,
      message: `${requestType} request cancelled successfully.`,
    });

    console.log(`${requestType} request cancelled successfully:`, requestId);
  } catch (error) {
    console.error("Error handling request cancellation:", error);
    socket.emit("error", { message: "Error cancelling request." });
  }
}

// Get chat history by user ID and astrologer ID
export const getAstrologerChatHistory = asyncHandler(async (req, res) => {
  const { userId, astrologerId } = req.params;

  // Find chat history where the userId and astrologerId match
  const chatHistory = await AstrologerChat.find({
    $and: [
      {
        messages: {
          $elemMatch: { senderId: userId, senderModel: "User" },
        },
      },
      {
        messages: {
          $elemMatch: { senderId: astrologerId, senderModel: "Astrologer" },
        },
      },
    ],
  });

  if (!chatHistory || chatHistory.length === 0) {
    return res
      .status(404)
      .json(
        new ApiResponse(
          404,
          null,
          "No chat history found for the user and astrologer"
        )
      );
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, chatHistory, "Chat history retrieved successfully")
    );
});

// Get chat list for a user or astrologer
export const getChatList = asyncHandler(async (req, res) => {
  const { id } = req.params;
  console.log("Fetching chat list for ID:", id);
  if (!id) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "User or Astrologer ID is required."));
  }

  try {
    // Find all chats involving the given ID
    const chats = await AstrologerChat.find({
      $or: [{ "messages.senderId": id }, { "messages.receiverId": id }],
    }).populate("messages.senderId messages.receiverId", "name profilePicture");

    if (!chats || chats.length === 0) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "No chat history found."));
    }

    // Determine if the ID belongs to a user or an astrologer
    const isUser = await User.findById(id);
    const isAstrologer = await Astrologer.findById(id);

    if (!isUser && !isAstrologer) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Invalid ID provided."));
    }

    // Function to calculate total chat time for each contact
    const calculateChatTime = (contactId, model) => {
      let totalChatTime = 0; // Total time in milliseconds

      chats.forEach((chat) => {
        const relevantMessages = chat.messages.filter(
          (msg) =>
            (msg.senderId.toString() === contactId &&
              msg.senderModel === model) ||
            (msg.receiverId.toString() === contactId &&
              msg.receiverModel === model)
        );

        for (let i = 1; i < relevantMessages.length; i++) {
          const previousMessage = relevantMessages[i - 1];
          const currentMessage = relevantMessages[i];
          if (previousMessage.timestamp && currentMessage.timestamp) {
            totalChatTime +=
              new Date(currentMessage.timestamp) -
              new Date(previousMessage.timestamp);
          }
        }
      });

      // Convert milliseconds to total seconds
      const totalSeconds = Math.floor(totalChatTime / 1000);

      // Extract minutes and seconds
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;

      // Format output as "X min Y sec"
      return `${minutes} min ${seconds} sec`;
    };

    // If ID is a user, fetch astrologer details
    if (isUser) {
      const astrologerIds = [
        ...new Set(
          chats.flatMap((chat) =>
            chat.messages
              .filter(
                (msg) => msg.senderModel === "Astrologer" && msg.senderId !== id
              )
              .map((msg) => msg.senderId.toString())
          )
        ),
      ];

      const astrologers = await Astrologer.find({
        _id: { $in: astrologerIds },
      }).select("Fname Lname profile_picture");

      const astrologerDetails = astrologers.map((astrologer) => ({
        ...astrologer.toObject(),
        totalChatTime: calculateChatTime(
          astrologer._id.toString(),
          "Astrologer"
        ),
        astrologerId: astrologer._id.toString(),
      }));

      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            astrologerDetails,
            "List of astrologers you've chatted with retrieved successfully."
          )
        );
    }

    // If ID is an astrologer, fetch user details
    if (isAstrologer) {
      const userIds = [
        ...new Set(
          chats.flatMap((chat) =>
            chat.messages
              .filter(
                (msg) => msg.senderModel === "User" && msg.senderId !== id
              )
              .map((msg) => msg.senderId.toString())
          )
        ),
      ];

      const users = await User.find({
        _id: { $in: userIds },
      }).select("Fname Lname profile_picture");

      const userDetails = users.map((user) => ({
        ...user.toObject(),
        totalChatTime: calculateChatTime(user._id.toString(), "User"),
        userId: user._id.toString(),
      }));

      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            userDetails,
            "List of users you've chatted with retrieved successfully."
          )
        );
    }
  } catch (error) {
    res.status(500).json(new ApiResponse(500, null, error.message));
  }
});

// Function to handle chat room rejoin
export async function handleRejoinChatRoom(io, data, socket) {
  try {
    const { roomId, userId, userType } = data; // userType: 'user' or 'astrologer'

    console.log(
      `Attempting to rejoin chat room: ${roomId} by ${userType}: ${userId}`
    );

    // Find the chat request/room
    const chatRequest = await ChatRequest.findOne({
      roomId,
      status: { $in: ["accepted", "ongoing"] }, // Allow both accepted and ongoing status
    });

    if (!chatRequest) {
      return socket.emit("rejoin-error", {
        message: "Chat session not found or has ended.",
      });
    }

    // Verify user's access to this room
    let hasAccess = false;
    if (userType === "user" && chatRequest.userId.toString() === userId) {
      hasAccess = true;
    } else if (
      userType === "astrologer" &&
      chatRequest.astrologerId.toString() === userId
    ) {
      hasAccess = true;
    }

    if (!hasAccess) {
      return socket.emit("rejoin-error", {
        message: "You are not authorized to join this chat.",
      });
    }

    // Update socket ID in database
    if (userType === "user") {
      const user = await User.findById(userId);
      if (user) {
        user.socketId = socket.id;
        await user.save();
        console.log(`User ${userId} socket updated: ${socket.id}`);
      }
    } else {
      const astrologer = await Astrologer.findById(userId);
      if (astrologer) {
        astrologer.socketId = socket.id;
        await astrologer.save();
        console.log(`Astrologer ${userId} socket updated: ${socket.id}`);
      }
    }

    // Join the socket room
    socket.join(roomId);

    // Get chat history
    const chatHistory = await AstrologerChat.findOne({ roomId });
    const messages = chatHistory?.messages || [];

    // Find other participant
    const otherParticipantId =
      userType === "user" ? chatRequest.astrologerId : chatRequest.userId;

    const otherParticipant =
      userType === "user"
        ? await Astrologer.findById(otherParticipantId)
        : await User.findById(otherParticipantId);

    // Notify other participant that this user has rejoined
    if (otherParticipant?.socketId) {
      io.to(otherParticipant.socketId).emit("participant-rejoined", {
        roomId,
        participantId: userId,
        participantType: userType,
        message: `${userType === "user" ? "User" : "Astrologer"} has rejoined the chat`,
      });

      console.log(`Notified ${otherParticipantId} about rejoin`);
    }

    // Send success response with chat data
    socket.emit("rejoin-success", {
      roomId,
      messages,
      otherParticipantId,
      chatType: chatRequest.chatType,
      status: "reconnected",
    });

    console.log(
      `✅ ${userType} ${userId} successfully rejoined room ${roomId}`
    );
  } catch (error) {
    console.error("❌ Error rejoining chat room:", error);
    socket.emit("rejoin-error", {
      message: "Error rejoining chat room. Please try again.",
    });
  }
}

// Function to get active chats for user/astrologer
export async function handleGetActiveChats(io, data, socket) {
  try {
    const { userId, userType } = data;

    console.log(`Fetching active chats for ${userType}: ${userId}`);

    let query = {};

    if (userType === "user") {
      query = {
        userId,
        status: "accepted",
        roomId: { $exists: true, $ne: null },
        endTime: { $exists: false }, // Chat hasn't ended yet
      };
    } else if (userType === "astrologer") {
      query = {
        astrologerId: userId,
        status: "accepted",
        roomId: { $exists: true, $ne: null },
        endTime: { $exists: false }, // Chat hasn't ended yet
      };
    } else {
      return socket.emit("active-chats-error", {
        message: "Invalid user type. Must be 'user' or 'astrologer'",
      });
    }

    // Find active chat rooms
    const activeChats = await ChatRequest.find(query)
      .select("roomId chatType startTime createdAt")
      .sort({ createdAt: -1 }) // Most recent first
      .limit(5); // Limit to 5 most recent active chats

    console.log(
      `Found ${activeChats.length} active chats for ${userType}: ${userId}`
    );

    // For each active chat, get the other participant's details
    const chatDetails = await Promise.all(
      activeChats.map(async (chat) => {
        let otherParticipant = null;

        if (userType === "user") {
          otherParticipant = await Astrologer.findById(
            chat.astrologerId
          ).select("Fname Lname profile_picture");
        } else {
          otherParticipant = await User.findById(chat.userId).select(
            "Fname Lname profile_picture"
          );
        }

        return {
          roomId: chat.roomId,
          chatType: chat.chatType,
          startTime: chat.startTime,
          otherParticipant: otherParticipant
            ? {
                _id: otherParticipant._id,
                name: `${otherParticipant.Fname || ""} ${otherParticipant.Lname || ""}`.trim(),
                profilePicture: otherParticipant.profile_picture,
              }
            : null,
        };
      })
    );

    socket.emit("active-chats-list", {
      chats: chatDetails,
      count: chatDetails.length,
    });
  } catch (error) {
    console.error("❌ Error fetching active chats:", error);
    socket.emit("active-chats-error", {
      message: "Error fetching active chats.",
    });
  }
}

// Add this function in controller.js
export async function handleUserCancelChatRequest(io, data, socket) {
  try {
    const { requestId, userId } = data;

    console.log(`User cancelling chat request:`, { requestId, userId });

    // Find the request in the database
    const chatRequest = await ChatRequest.findById(requestId);
    if (!chatRequest) {
      return socket.emit("request-cancel-error", {
        message: "Chat request not found.",
      });
    }

    // Verify that the request belongs to the user trying to cancel it
    if (chatRequest.userId.toString() !== userId) {
      return socket.emit("request-cancel-error", {
        message: "You are not authorized to cancel this request.",
      });
    }

    // Check if request is already processed (accepted/rejected)
    if (chatRequest.status !== "pending") {
      return socket.emit("request-cancel-error", {
        message: `Request already ${chatRequest.status}. Cannot cancel.`,
      });
    }

    // Update request status to 'user_cancelled'
    chatRequest.status = "user_cancelled";
    await chatRequest.save();

    // Find the astrologer to notify
    const astrologer = await Astrologer.findById(chatRequest.astrologerId);
    if (astrologer && astrologer.socketId) {
      // Notify astrologer about the cancellation

      console.log("cancelling call");
      io.to(astrologer.socketId).emit("chat-request-cancelled-by-user", {
        requestId,
        userId,
        message: "User cancelled the chat request.",
      });
      console.log(`Notified astrologer about chat request cancellation`);
    }

    // Notify the user that cancellation was successful
    socket.emit("chat-request-cancelled-success", {
      requestId,
      message: "Chat request cancelled successfully.",
    });

    console.log(`Chat request cancelled successfully:`, requestId);
  } catch (error) {
    console.error("Error handling chat request cancellation:", error);
    socket.emit("request-cancel-error", {
      message: "Error cancelling chat request.",
    });
  }
}

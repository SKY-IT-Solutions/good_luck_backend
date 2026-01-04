import { Server } from "socket.io";
import { Chat } from "./models/dating/chatModel.js";
import { Dating } from "./models/dating/dating.model.js";
import mongoose from "mongoose";
import { MatchedProfileDating } from "./models/dating/matchedProfileDating.model.js";
import { User } from "./models/auth/user.model.js";
import { Astrologer } from "./models/astrologer/astroler.model.js";
import {
  handleCallRequest,
  handleCallResponse,
  handleCancelRequest,
  handleChatMessage,
  handleChatRequest,
  handleChatResponse,
  handleEndCall,
  handleEndChat,
  handleGetActiveChats,
  handlePauseChat,
  handleRejoinChatRoom,
  handleResumeChat,
  handleUserCancelChatRequest,
} from "./controllers/chatController/astrologerWithUser/controller.js";

export const setupSocketIO = (server) => {
  const io = new Server(server, {
    cors: {
      origin: ["http://localhost:3000", "http://192.168.0.100:8081"],
      methods: ["GET", "POST", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type"],
      credentials: true,
    },
  });

  const activeUsers = new Map(); // Map to track active users and their socket IDs

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // Store user ID and socket ID on connection
    socket.on("register_user", async (userId) => {
      try {
        // First, check in the User model
        const user = await User.findOne({ _id: userId });

        if (user) {
          // Check if the user is not an astrologer, admin, or affiliate
          if (
            !user.isAstrologer &&
            !user.isAdmin &&
            !user.isAffiliate_marketer
          ) {
            user.socketId = socket.id; // Update socket ID
            user.isActive = true; // Set user as active
            await user.save(); // Save the user document
            activeUsers.set(userId, socket.id); // Track active users
            console.log(
              `User registered: ${userId} with socket ID: ${socket.id}`
            );

            // If not found in the User model, check in the Dating model
            const datingUser = await Dating.findOneAndUpdate(
              { userId },
              { socketId: socket.id }, // Update the socketId
              { new: true }
            );

            if (!datingUser) {
              return socket.emit("error", {
                message: "User not found in Dating model.",
              });
            }

            activeUsers.set(userId, socket.id); // Track active dating users
            console.log(
              `Dating user registered: ${userId} with socket ID: ${socket.id}`
            );
            return;
          } else {
            return socket.emit("error", {
              message: "User role not eligible for this action.",
            });
          }
        }
      } catch (error) {
        console.error("Error updating socketId:", error);
        socket.emit("error", { message: "Error registering user." });
      }
    });

    // Register astrologer and update socket ID
    socket.on("register_astrologer", async (astrologerId) => {
      try {
        // Find the astrologer by userId
        const astrologer = await Astrologer.findById(astrologerId);

        if (!astrologer) {
          return socket.emit("error", { message: "Astrologer not found." });
        }

        astrologer.socketId = socket.id; // Update socket ID
        // astrologer.isActive = true; // Set astrologer as active
        await astrologer.save(); // Save the astrologer document
        activeUsers.set(astrologerId, socket.id); // Track active astrologers
        console.log(
          `Astrologer registered: ${astrologerId} with socket ID: ${socket.id}`
        );
      } catch (error) {
        console.error("Error updating astrologer's socketId:", error);
        socket.emit("error", { message: "Error registering astrologer." });
      }
    });

    //================================= DATING CHAT PART====================================
    // Handle sending messages
    socket.on("send_message", async (messageData) => {
      const { senderId, matchId, message } = messageData;

      try {
        // Convert IDs to ObjectId format
        const senderObjectId = new mongoose.Types.ObjectId(senderId);
        const matchObjectId = new mongoose.Types.ObjectId(matchId);

        // Fetch the chat by matchId
        const chat = await Chat.findOne({ matchId: matchObjectId });

        if (!chat) {
          // If no chat is found for this matchId, emit an error and return
          return socket.emit("error", {
            message: "Chat not found for this matchId.",
          });
        }

        // Add the new message to the chat
        const newMessage = {
          senderId: senderObjectId,
          message,
          timestamp: Date.now(),
        };

        chat.messages.push(newMessage); // Add message to the array
        await chat.save(); // Save the updated chat

        console.log("Message added to chat:", chat);

        const existingMatch = await MatchedProfileDating.findById(matchId);

        if (!existingMatch) {
          // If no match is found for this matchId, emit an error and return
          return socket.emit("error", {
            message: "Match not found for this matchId.",
          });
        }

        // Use $or to find users by user1 and user2
        const matchedUsers = await Dating.find({
          $or: [
            { userId: existingMatch.user1 },
            { userId: existingMatch.user2 },
          ],
        });

        if (!matchedUsers || matchedUsers.length === 0) {
          // Handle the case where no users are found
          return socket.emit("error", { message: "Matched users not found." });
        }

        // Notify both users (sender and receiver)
        matchedUsers.forEach((user) => {
          if (user.socketId) {
            const isSender = String(user.userId) === senderId;

            io.to(user.socketId).emit("new_message", {
              senderId,
              matchId,
              message,
              timestamp: newMessage.timestamp,
              fromSender: isSender, // Indicates whether the message is sent by this user
            });

            console.log(
              `Message sent to ${isSender ? "sender" : "receiver"}:`,
              user.userId
            );
          } else {
            console.log(
              `User ${user.userId} is offline or socketId is not available.`
            );
          }
        });
      } catch (error) {
        console.error("Error sending message:", error);
        socket.emit("error", { message: "Error sending message." });
      }
    });

    //================================= ASTROLOGER CHAT PART====================================
    // Handle chat request from user
    socket.on("chat-request", (data) => {
      // Call the function to handle the chat request
      handleChatRequest(io, data, socket);
    });

    // Handle astrologer's response
    socket.on("chat-response", (data) => {
      // Call the function to handle the chat response
      handleChatResponse(io, data);
    });

    // Handle join room User and Astrologer
    socket.on("join-room", (roomId) => {
      console.log(`Socket ${socket.id} joined room: ${roomId}`);
      socket.join(roomId);
    });

    // Handle messages sent in the chat
    socket.on("send-message", async (data) => {
      console.log("Received message:", data);
      const result = await handleChatMessage(data, io);

      if (result.error) {
        socket.emit("error", result.error);
      }
    });

    // Handle pause chat
    socket.on("pause-chat", (data) => {
      handlePauseChat(io, data);
    });

    // Handle resume chat
    socket.on("resume-chat", (data) => {
      handleResumeChat(io, data);
    });

    // Handle chat termination
    socket.on("end-chat", async (data) => {
      const { roomId, sender } = data; // Extract sender from the data

      // Call the function to handle the end of the chat, passing the sender
      await handleEndChat(io, roomId, sender);
    });

    // Handle call request from user
    socket.on("call-request", (data) => {
      // Call the function to handle the chat request
      handleCallRequest(io, data, socket);
    });

    // Handle call request from user
    socket.on("call-response", (data) => {
      // Call the function to handle the chat request
      handleCallResponse(io, data, socket);
    });

    // Handle call termination
    socket.on("end-call", async (data) => {
      const { roomId, sender } = data; // Extract sender from the data

      // Call the function to handle the end of the chat, passing the sender
      await handleEndCall(io, roomId, sender);
    });

    // Handle cancel/close chat or call request by user
    socket.on("cancel-request", async (data) => {
      // const { requestId, userId, requestType } = data; // requestType: 'chat' or 'call'

      try {
        // Call the function to handle request cancellation
        await handleCancelRequest(io, data, socket);
      } catch (error) {
        console.error("Error canceling request:", error);
        socket.emit("error", { message: "Error canceling request." });
      }
    });

    // Handle chat room rejoin
    socket.on("rejoin-chat-room", (data) => {
      handleRejoinChatRoom(io, data, socket);
    });

    // Handle get active chats
    socket.on("get-active-chats", (data) => {
      handleGetActiveChats(io, data, socket);
    });

    socket.on("cancel-chat-request", (data) => {
      handleUserCancelChatRequest(io, data, socket);
    });

    // Handle user disconnection
// In your socket server file
socket.on("disconnect", async () => {
  console.log("A user disconnected:", socket.id);

  try {
    // Find and update the astrologer's status
    const updatedAstrologer = await Astrologer.findOneAndUpdate(
      { socketId: socket.id },
      { 
        $set: { 
          status: "offline",
          socketId: null, // Clear socketId when disconnected
          isActive: false // Also set isActive to false
        }
      },
      { new: true } // Return the updated document
    );
    
    if (updatedAstrologer) {
      console.log(`✅ Astrologer ${updatedAstrologer._id} (${socket.id}) set to offline`);
      
      // Also emit event to notify other users this astrologer went offline
      socket.broadcast.emit('astrologer_offline', {
        astrologerId: updatedAstrologer._id,
        socketId: socket.id
      });
    } else {
      console.log(`ℹ️ No astrologer found with socketId: ${socket.id}`);
    }
  } catch (error) {
    console.error("❌ Error updating astrologer status on disconnect:", error);
  }

  // More efficient way to remove user from activeUsers
  const userIdToRemove = Array.from(activeUsers.entries())
    .find(([userId, sockId]) => sockId === socket.id)?.[0];
  
  if (userIdToRemove) {
    activeUsers.delete(userIdToRemove);
    console.log(`🗑️ Removed user ${userIdToRemove} from active users`);
  }
});
  });

  return io;
};

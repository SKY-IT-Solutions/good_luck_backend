import express from "express";
import cors from "cors";
import http from "http";
import errorHandler from "./middlewares/errorMiddleware.js";
import { setupSocketIO } from "./socket.js";

const app = express();

// Create HTTP server and attach Express app
const server = http.createServer(app);

// Initialize Socket.IO by passing the server
setupSocketIO(server); // Use the same server for Socket.IO

app.use(cors());

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));

// Import routes
import adminRoutes from "./routes/admin/admin.routes.js";
import userRoutes from "./routes/auth/user.routes.js";
import astrologerRoutes from "./routes/astrologer/astrologer.route.js";
import astrologerCategoryRoutes from "./routes/astrologer/astrologercategory.routes.js";
import astrologerChatRoutes from "./routes/astrologerChatRoutes/astrologerChat.routes.js";
import withdraw from "./routes/astrologer/withdraw/withdrwal.routes.js";
import datingRoutes from "./routes/dating/dating.routes.js";
import datingMatchedRoutes from "./routes/dating/matches.routes.js";
import datingChatRoutes from "./routes/dating/chatRoutes.js";
import matrimonyRoutes from "./routes/matrimony/matrimony.routes.js";
import productCategoryRoutes from "./routes/product/productcategory.routes.js";
import productRoutes from "./routes/product/product.routes.js";
import orderRoutes from "./routes/product/order.routes.js";
import adSubcriptionRoutes from "./routes/subscription/adSubcription.routes.js";
import matrimonySubcriptionRoutes from "./routes/subscription/matrimonySubscription.routes.js";
import datingSubcriptionRoutes from "./routes/subscription/datingSubscription.routes.js";
import localSubcriptionRoutes from "./routes/subscription/localSubscription.routes.js";
import homeBannerRouter from "./routes/advertisement/homeLandBanner.routes.js";
import homeTextRouter from "./routes/advertisement/homeLandText.routes.js";
import jobBannerRouter from "./routes/advertisement/jobBanner.routes.js";
import jobTextRouter from "./routes/advertisement/jobText.routes.js";
import mariageMakingRouter from "./routes/marriageMaking/marriageMaking.routes.js";
import janamKundliRouter from "./routes/janamkundli/janamkundli.routes.js";
import dakshinaRouter from "./routes/dakshina/dakshina.routes.js";
import panchangRouter from "./routes/panchang/panchang.routes.js";
import rasifalRouter from "./routes/rasifal/rasifal.routes.js";
import calenderRouter from "./routes/calender/calender.routes.js";
import liveTvRouter from "./routes/liveTv/liveTv.routes.js";
import localCategoryRouter from "./routes/local services/localserviceCategory.routes.js";
import localServiceRouter from "./routes/local services/localservice.routes.js";
import adminAdRoutes from "./routes/advertisement/adminAd.routes.js";
import paymentRouter from "./routes/payment/payment.routes.js";
import razorpayRouter from "./routes/payment/razorpay.routes.js";
import calenderEventRouter from "./routes/calenderEvent/calenderEvent.routes.js";
import commissionRouter from "./routes/commission/commission.routes.js";
import affiliateRouter from "./routes/affiliate/affiliate.routes.js";

// Use routes
app.use("/good_luck/api/v1/admin", adminRoutes);
app.use("/good_luck/api/v1/auth", userRoutes);
app.use("/good_luck/api/v1/astrologer", astrologerRoutes);
app.use("/good_luck/api/v1/astrologer/category", astrologerCategoryRoutes);
app.use("/good_luck/api/v1/astrologerChat", astrologerChatRoutes);
app.use("/good_luck/api/v1/withdraw", withdraw);
app.use("/good_luck/api/v1/dating", datingRoutes);
app.use("/good_luck/api/v1/matchedProfile", datingMatchedRoutes);
app.use("/good_luck/api/v1/datingChat", datingChatRoutes);
app.use("/good_luck/api/v1/matrimony", matrimonyRoutes);
app.use("/good_luck/api/v1/productCategory", productCategoryRoutes);
app.use("/good_luck/api/v1/product", productRoutes);
app.use("/good_luck/api/v1/order", orderRoutes);
app.use("/good_luck/api/v1/advertisement", adSubcriptionRoutes);
app.use("/good_luck/api/v1/matrimony/subscription", matrimonySubcriptionRoutes);
app.use("/good_luck/api/v1/dating/subscription", datingSubcriptionRoutes);
app.use("/good_luck/api/v1/local/subscription", localSubcriptionRoutes);
app.use("/good_luck/api/v1/homeLandBanner", homeBannerRouter);
app.use("/good_luck/api/v1/homeLandText", homeTextRouter);
app.use("/good_luck/api/v1/jobBanner", jobBannerRouter);
app.use("/good_luck/api/v1/jobText", jobTextRouter);
app.use("/good_luck/api/v1/mariageMaking", mariageMakingRouter);
app.use("/good_luck/api/v1/janamKundli", janamKundliRouter);
app.use("/good_luck/api/v1/dakshina", dakshinaRouter);
app.use("/good_luck/api/v1/panchang", panchangRouter);
app.use("/good_luck/api/v1/rasifal", rasifalRouter);
app.use("/good_luck/api/v1/calender", calenderRouter);
app.use("/good_luck/api/v1/liveTv", liveTvRouter);
app.use("/good_luck/api/v1/localCategory", localCategoryRouter);
app.use("/good_luck/api/v1/localService", localServiceRouter);
app.use("/good_luck/api/v1/calender-event", calenderEventRouter);
app.use("/good_luck/api/v1/admin-ads", adminAdRoutes);
app.use("/good_luck/api/v1/commission", commissionRouter);
app.use("/good_luck/api/v1/affiliate", affiliateRouter);
app.use("/", paymentRouter);
app.use("/", razorpayRouter);

app.get("/", (req, res) => {
  res.send("Welcome to Good Luck API v2.0 !");
});

// Hello World

// Error handling middleware
app.use(errorHandler);

export { app, server };

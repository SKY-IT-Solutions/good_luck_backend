import dotenv from "dotenv";
import { app, server } from "./app.js";
import connectDB from "./db/index.js";

dotenv.config({
  path: "./.env",
});

connectDB()
  .then(() => {
    server.listen(process.env.PORT, () => {
      console.log(`Server and Socket.IO are running on port ${process.env.PORT}`);
    });
    server.on("error", (error) => {
      console.log("Server error", error);
      throw error;
    });
  })
  .catch((err) => {
    console.log("MONGO DB CONNECTION FAILED !!!", err);
  });

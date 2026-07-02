import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import path from "node:path";
import rootRouter from "./routes/index.js";
import { checkDbConnection } from "./db/index.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use(rootRouter);
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(port, async () => {
  console.log(`[server] running on port ${port}`);
  try {
    await checkDbConnection();
    console.log("[server] database connected");
  } catch (error) {
    console.warn("[server] database ping failed, keep running");
    console.warn(error);
  }
});

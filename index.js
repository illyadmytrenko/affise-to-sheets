import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import router from "./routes/index.js";

dotenv.config();

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(
  cors({
    origin: "*",
  })
);

app.use("/api", router);

const PORT = process.env.PORT || 5050;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

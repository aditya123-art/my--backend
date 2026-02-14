require("dotenv").config();

// =======================
// ENVIRONMENT CHECK
// =======================
const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET', 'ADMIN_USERNAME', 'ADMIN_PASSWORD'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars);
  process.exit(1);
}
console.log('✅ All required environment variables are set.');

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");

const app = express();

// =======================
// SECURITY MIDDLEWARE
// =======================
app.use(helmet());
app.use(cors({
  origin: ["https://valentinesbjit.in", "https://www.valentinesbjit.in", "http://localhost:3000"],
  methods: ["GET", "POST"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "10kb" }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: "Too many requests, please try again later." }
});
app.use(limiter);

// =======================
// CONNECT TO MONGODB (FIXED)
// =======================
console.log("🔗 Connecting to MongoDB...");
mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
.then(() => console.log("✅ MongoDB Connected Successfully"))
.catch(err => {
  console.error("❌ MongoDB Connection Error:", err);
  process.exit(1);
});

// =======================
// SCHEMAS WITH INDEXES
// =======================
const LoveTestSchema = new mongoose.Schema({
  userName: { type: String, required: true, maxlength: 50, index: true },
  userBranch: { type: String, index: true },
  crushName: { type: String, required: true, maxlength: 50 },
  crushBranch: String,
  year: String,
  lab: String,
  score: { type: Number, min: 0, max: 100, index: true },
  createdAt: { type: Date, default: Date.now, index: true }
});
const ReviewSchema = new mongoose.Schema({
  reviewerName: { type: String, required: true, maxlength: 50, index: true },
  reviewerBranch: { type: String, index: true },
  rating: { type: Number, min: 1, max: 5, index: true },
  reviewText: { type: String, maxlength: 500 },
  createdAt: { type: Date, default: Date.now, index: true }
});
const LoveTest = mongoose.model("LoveTest", LoveTestSchema);
const Review = mongoose.model("Review", ReviewSchema);

// =======================
// ADMIN VERIFY MIDDLEWARE
// =======================
function verifyAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ success: false, message: "No token provided" });
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

// =======================
// PUBLIC ROUTES
// =======================
app.get("/get-reviews", async (req, res) => {
  try {
    const data = await Review.find().sort({ createdAt: -1 }).limit(50);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/save-love-test", async (req, res) => {
  try {
    const { userName, crushName, score } = req.body;
    if (!userName || !crushName || typeof score !== "number" || score < 0 || score > 100 || userName.length > 50 || crushName.length > 50) {
      return res.status(400).json({ success: false, message: "Invalid input data" });
    }
    const newTest = await LoveTest.create(req.body);
    res.json({ success: true, message: "Love test saved successfully", data: newTest });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/save-review", async (req, res) => {
  try {
    const { reviewerName, rating, reviewText } = req.body;
    if (!reviewerName || typeof rating !== "number" || rating < 1 || rating > 5 || reviewerName.length > 50 || (reviewText && reviewText.length > 500)) {
      return res.status(400).json({ success: false, message: "Invalid review data" });
    }
    const newReview = await Review.create(req.body);
    res.json({ success: true, message: "Review saved successfully", data: newReview });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// =======================
// ADMIN LOGIN
// =======================
app.post("/admin-login", (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign({ role: "admin" }, process.env.JWT_SECRET, { expiresIn: "2h" });
    return res.json({ success: true, token });
  }
  return res.status(401).json({ success: false, message: "Invalid credentials" });
});

// =======================
// ADMIN ROUTES (PROTECTED)
// =======================
app.get("/get-love-tests", verifyAdmin, async (req, res) => {
  try {
    const data = await LoveTest.find().sort({ createdAt: -1 });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/get-reviews-admin", verifyAdmin, async (req, res) => {
  try {
    const data = await Review.find().sort({ createdAt: -1 });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/admin/export", verifyAdmin, async (req, res) => {
  try {
    const loveTests = await LoveTest.find();
    const reviews = await Review.find();
    res.json({
      success: true,
      data: { loveTests, reviews, exportedAt: new Date().toISOString(), totalRecords: loveTests.length + reviews.length }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/admin/clear", verifyAdmin, async (req, res) => {
  try {
    const { confirmation } = req.body;
    if (confirmation !== 'CONFIRM_DELETE_ALL') {
      return res.status(400).json({ success: false, message: "Confirmation required" });
    }
    const loveTestsCount = await LoveTest.countDocuments();
    const reviewsCount = await Review.countDocuments();
    await LoveTest.deleteMany({});
    await Review.deleteMany({});
    res.json({ success: true, message: "All data cleared successfully", deleted: { loveTests: loveTestsCount, reviews: reviewsCount } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// =======================
// HEALTH CHECK
// =======================
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "SBJIT Valentine Backend Running Securely",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

// =======================
// ERROR HANDLING & 404
// =======================
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ success: false, message: "Internal server error" });
});
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// =======================
// START SERVER AFTER DB CONNECTION
// =======================
mongoose.connection.once("open", () => {
  console.log("✅ MongoDB Connection Established");
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`✅ Server Running on port ${PORT}`);
    console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✅ Public Routes: /get-reviews, /save-love-test, /save-review`);
    console.log(`✅ Admin Routes: /admin-login, /get-love-tests, /get-reviews-admin`);
  });
});

mongoose.connection.on("error", (err) => console.error("❌ MongoDB Connection Error:", err));
mongoose.connection.on("disconnected", () => console.warn("⚠️ MongoDB Disconnected. Attempting to reconnect..."));

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Promise Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

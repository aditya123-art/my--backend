require("dotenv").config();

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
  origin: [
    "https://valentinesbjit.in",
    "https://www.valentinesbjit.in"
  ],
  methods: ["GET", "POST"],
  credentials: true
}));

app.use(express.json({ limit: "10kb" }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200
});
app.use(limiter);

// =======================
// CONNECT TO MONGODB
// =======================

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));

// =======================
// SCHEMAS
// =======================

const LoveTestSchema = new mongoose.Schema({
  userName: { type: String, required: true, maxlength: 50 },
  userBranch: String,
  crushName: { type: String, required: true, maxlength: 50 },
  crushBranch: String,
  year: String,
  lab: String,
  score: { type: Number, min: 0, max: 100 },
  createdAt: { type: Date, default: Date.now, index: true }
});

const ReviewSchema = new mongoose.Schema({
  reviewerName: { type: String, required: true, maxlength: 50 },
  reviewerBranch: String,
  rating: { type: Number, min: 1, max: 5 },
  reviewText: { type: String, maxlength: 500 },
  createdAt: { type: Date, default: Date.now, index: true }
});

const LoveTest = mongoose.model("LoveTest", LoveTestSchema);
const Review = mongoose.model("Review", ReviewSchema);

// =======================
// JWT VERIFY MIDDLEWARE
// =======================

function verifyAdmin(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

// =======================
// SAVE LOVE TEST
// =======================

app.post("/save-love-test", async (req, res) => {
  try {
    const { userName, crushName, score } = req.body;

    if (!userName || !crushName || score < 0 || score > 100) {
      return res.status(400).json({ message: "Invalid input data" });
    }

    const newTest = await LoveTest.create(req.body);
    res.json({ success: true, data: newTest });

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// =======================
// SAVE REVIEW
// =======================

app.post("/save-review", async (req, res) => {
  try {
    const { reviewerName, rating, reviewText } = req.body;

    if (!reviewerName || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Invalid review data" });
    }

    const newReview = await Review.create(req.body);
    res.json({ success: true, data: newReview });

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// =======================
// ADMIN LOGIN (JWT)
// =======================

app.post("/admin-login", (req, res) => {
  const { username, password } = req.body;

  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    const token = jwt.sign(
      { role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    return res.json({ success: true, token });
  }

  return res.status(401).json({ success: false, message: "Invalid credentials" });
});

// =======================
// PROTECTED ADMIN ROUTES
// =======================

app.get("/get-love-tests", verifyAdmin, async (req, res) => {
  const data = await LoveTest.find().sort({ createdAt: -1 });
  res.json(data);
});

app.get("/get-reviews", verifyAdmin, async (req, res) => {
  const data = await Review.find().sort({ createdAt: -1 });
  res.json(data);
});

// =======================
// HEALTH CHECK
// =======================

app.get("/", (req, res) => {
  res.send("SBJIT Valentine Backend Running Securely");
});

// =======================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server Running on port " + PORT));

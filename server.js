const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect("mongodb+srv://yashwantsirsate1_db_user:or0cl4PFHgbgJPVd@cluster0.fmsmvxc.mongodb.net/mydb?retryWrites=true&w=majority")
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));

const VisitSchema = new mongoose.Schema({
  page: String,
  userAgent: String,
  time: String
});

const Visit = mongoose.model("Visit", VisitSchema);

app.post("/track", async (req, res) => {
  await Visit.create(req.body);
  res.send("Saved");
});

app.get("/", (req, res) => {
  res.send("Server Running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server started on port " + PORT);
});

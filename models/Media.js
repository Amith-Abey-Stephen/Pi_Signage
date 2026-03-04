const mongoose = require("mongoose");

const MediaSchema = new mongoose.Schema({
  filename: String,
  type: String, // "image" or "video"
  title: String,
  url: String,
  duration: Number,
  order: Number,
  active: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Media", MediaSchema);

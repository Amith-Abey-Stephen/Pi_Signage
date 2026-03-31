const mongoose = require("mongoose");

const MediaSchema = new mongoose.Schema({
  filename: String,
  type: String, // "image", "video", or "url"
  title: String,
  url: String,
  rotation: {
    type: Number,
    default: 0, // 0, 90, 180, 270
  },
  duration: Number,
  order: Number,
  active: {
    type: Boolean,
    default: true,
  },
  schedule: {
    enabled: { type: Boolean, default: false },
    startDate: Date,
    endDate: Date,
    startTime: String, // e.g., "09:00"
    endTime: String,   // e.g., "17:00"
    daysOfWeek: {
      type: [Number],
      default: [0, 1, 2, 3, 4, 5, 6], // Sun-Sat
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Media", MediaSchema);

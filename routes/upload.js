const express = require("express");
const multer = require("multer");
const Media = require("../models/Media");
const cloudinary = require("../utils/cloudinary");
const asyncHandler = require("express-async-handler");

const router = express.Router();

// Store files in memory (not disk)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ================= UPLOAD TO CLOUDINARY =================
router.post("/", upload.array("file"), asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    res.status(400);
    throw new Error("No files uploaded");
  }

  let count = await Media.countDocuments();
  const savedFiles = [];

  for (const file of req.files) {
    // Upload buffer to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: "auto",
          folder: "digital-signage",
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      stream.end(file.buffer);
    });

    const type = file.mimetype.startsWith("video") ? "video" : "image";

    const media = new Media({
      type,
      title: file.originalname,
      url: result.secure_url,
      order: count++,
      active: true,
      schedule: { enabled: false }
    });

    await media.save();
    savedFiles.push(media);
  }

  res.json({
    success: true,
    message: "Upload successful",
    files: savedFiles,
  });
}));

module.exports = router;

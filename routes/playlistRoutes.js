const express = require("express");
const router = express.Router();
const Media = require("../models/Media");
const upload = require("../utils/multer");
const fs = require("fs");
const path = require("path");
const cloudinary = require("../utils/cloudinary");
const { protect } = require("../utils/authMiddleware");
const asyncHandler = require("express-async-handler");

// ================= Helper: Format Date =================
function formatDate(date) {
  return new Date(date).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ================= Helper: Is Scheduled =================
function isScheduled(media) {
  if (!media.schedule || !media.schedule.enabled) return true;

  const now = new Date();
  const { startDate, endDate, startTime, endTime, daysOfWeek } = media.schedule;

  // Check Dates
  if (startDate && now < new Date(startDate)) return false;
  if (endDate && now > new Date(endDate)) return false;

  // Check Days of Week
  if (daysOfWeek && daysOfWeek.length > 0) {
    if (!daysOfWeek.includes(now.getDay())) return false;
  }

  // Check Times
  if (startTime || endTime) {
    const currentStr = now.getHours().toString().padStart(2, '0') + ":" + 
                       now.getMinutes().toString().padStart(2, '0');
    
    if (startTime && currentStr < startTime) return false;
    if (endTime && currentStr > endTime) return false;
  }

  return true;
}

let displayVersion = 1;

// ================= FETCH VERSION =================
router.get("/version", (req, res) => {
  res.json({ version: displayVersion });
});

// ================= NOTIFY DISPLAY =================
router.post("/notify", protect, (req, res) => {
  displayVersion++;
  res.json({ success: true, version: displayVersion });
});

// ================= ROTATE ALL ASSETS =================
router.patch("/rotate-all", protect, asyncHandler(async (req, res) => {
  const { rotation } = req.body;
  if (![0, 90, 180, 270].includes(Number(rotation))) {
    res.status(400);
    throw new Error("Invalid rotation value");
  }
  
  await Media.updateMany({}, { rotation: Number(rotation) });
  res.json({ success: true, message: `All assets rotated to ${rotation}°` });
}));

// ================= GET PLAYLIST (Admin formatted) =================
router.get("/", asyncHandler(async (req, res) => {
  const playlist = await Media.find().sort({ order: 1 });

  const formatted = playlist.map((item) => ({
    id: item._id ? item._id.toString() : null,
    type: (item.type || "").toUpperCase(),
    title: item.title,
    url: item.url,
    duration: item.duration || null,
    order: item.order,
    active: item.active !== false,
    rotation: item.rotation || 0,
    created: formatDate(item.createdAt),
    status: item.active === false ? "Inactive" : "Active",
    schedule: item.schedule,
    preview:
      item.type === "image"
        ? `<img src="${item.url}" style="height:40px;border-radius:4px;">`
        : "—",
  }));

  res.json({
    pageTitle: "Playlist Data",
    subtitle: "Live playlist items fetched from the system",
    items: formatted,
  });
}));

// ================= GET RAW PLAYLIST (for /display) =================
router.get("/raw", asyncHandler(async (req, res) => {
  const playlist = await Media.find().sort({ order: 1 });

  // Filter by active and schedule
  const filtered = playlist.filter((item) => {
    return item.active !== false && isScheduled(item);
  });
  res.json(filtered);
}));

// ================= ADD ITEM TO PLAYLIST =================
router.post("/", protect, upload.array("file"), asyncHandler(async (req, res) => {
  // FILE UPLOAD
  if (req.files && req.files.length > 0) {
    let count = await Media.countDocuments();
    const savedFiles = [];

    for (const file of req.files) {
      const type = file.mimetype.startsWith("video") ? "video" : "image";
      const fileUrl = `/uploads/${file.filename}`;

      const media = new Media({
        type,
        title: file.originalname,
        url: fileUrl,
        duration: null,
        order: count,
        active: true,
      });

      await media.save();
      savedFiles.push(media);
      count++;
    }

    return res.json({
      success: true,
      message: "Files uploaded successfully",
      files: savedFiles,
    });
  }

  // JSON BODY
  const { type, url, title, duration, schedule } = req.body;

  if (!type || !url) {
    res.status(400);
    throw new Error("Missing required fields: type and url");
  }

  if (typeof url === 'string' && url.startsWith('/api/playlist')) {
    res.status(400);
    throw new Error('Invalid media URL');
  }

  const count = await Media.countDocuments();

  const media = new Media({
    type,
    title,
    url,
    duration: duration || null,
    order: count,
    active: true,
    schedule: schedule || { enabled: false }
  });

  await media.save();
  res.json({ success: true, media });
}));

// ================= REORDER PLAYLIST =================
router.post("/reorder", protect, asyncHandler(async (req, res) => {
  if (!Array.isArray(req.body)) {
    res.status(400);
    throw new Error("Request body must be an array");
  }

  for (let i = 0; i < req.body.length; i++) {
    await Media.findByIdAndUpdate(req.body[i].id, { order: i });
  }

  res.json({ success: true });
}));

// ================= FETCH SINGLE ITEM =================
router.get("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const media = await Media.findById(id);
  if (!media) {
    res.status(404);
    throw new Error("Not found");
  }

  if (typeof media.url === "string" && !media.url.startsWith("/api/playlist")) {
    return res.redirect(media.url);
  }

  return res.json(media);
}));

// ================= UPDATE SINGLE ITEM =================
router.patch("/:id", protect, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const update = {};

  if (Object.prototype.hasOwnProperty.call(req.body, "duration")) {
    const d = Number(req.body.duration);
    update.duration = Number.isFinite(d) && d > 0 ? d : null;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "active")) {
    update.active = Boolean(req.body.active);
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "schedule")) {
    update.schedule = req.body.schedule;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "rotation")) {
    const r = Number(req.body.rotation);
    if ([0, 90, 180, 270].includes(r)) {
      update.rotation = r;
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(req.body, "url") &&
    typeof req.body.url === "string" &&
    req.body.url.startsWith("/api/playlist")
  ) {
    res.status(400);
    throw new Error("Invalid media URL");
  }

  const media = await Media.findByIdAndUpdate(id, update, {
    new: true,
    runValidators: false,
  });

  if (!media) {
    res.status(404);
    throw new Error("Not found");
  }

  res.json({ success: true, media });
}));

// ================= DELETE SINGLE ITEM =================
router.delete("/:id", protect, asyncHandler(async (req, res) => {
  const id = req.params.id;
  const media = await Media.findById(id);

  if (!media) {
    res.status(404);
    throw new Error("Not found");
  }

  // Delete local file
  if (media.url && media.url.startsWith("/uploads/")) {
    const rel = media.url.replace(/^\//, "");
    const filePath = path.join(__dirname, "..", rel);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  // Delete from Cloudinary
  if (media.url && media.url.includes("res.cloudinary.com")) {
    try {
      const parts = media.url.split("/upload/");
      if (parts[1]) {
        let publicPath = parts[1];
        publicPath = publicPath.replace(/v\d+\//, "");
        publicPath = publicPath.replace(/\.[^/.]+$/, "");

        await cloudinary.uploader.destroy(publicPath, {
          resource_type: media.type === "video" ? "video" : "image",
        });
      }
    } catch (e) {
      console.warn("Cloudinary delete failed", e.message);
    }
  }

  await Media.findByIdAndDelete(id);

  // Reorder remaining
  const remaining = await Media.find().sort({ order: 1 });
  for (let i = 0; i < remaining.length; i++) {
    await Media.findByIdAndUpdate(remaining[i]._id, { order: i });
  }

  res.json({ success: true });
}));

// ================= DELETE ALL =================
router.delete("/", protect, asyncHandler(async (req, res) => {
  const all = await Media.find();

  for (const media of all) {
    if (media.url && media.url.startsWith("/uploads/")) {
      const rel = media.url.replace(/^\//, "");
      const filePath = path.join(__dirname, "..", rel);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    if (media.url && media.url.includes("res.cloudinary.com")) {
      try {
        const parts = media.url.split("/upload/");
        if (parts[1]) {
          let publicPath = parts[1];
          publicPath = publicPath.replace(/v\d+\//, "");
          publicPath = publicPath.replace(/\.[^/.]+$/, "");

          await cloudinary.uploader.destroy(publicPath, {
            resource_type: media.type === "video" ? "video" : "image",
          });
        }
      } catch (e) {
        console.warn("Cloudinary delete failed", e.message);
      }
    }
  }

  await Media.deleteMany({});
  res.json({ success: true, message: "Playlist cleared" });
}));


module.exports = router;
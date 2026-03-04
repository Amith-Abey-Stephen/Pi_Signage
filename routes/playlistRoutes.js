const express = require("express");
const router = express.Router();
const Media = require("../models/media");
const upload = require("../utils/multer");
const fs = require("fs");
const path = require("path");
const cloudinary = require("../utils/cloudinary");

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

// ================= GET PLAYLIST (Admin formatted) =================
router.get("/", async (req, res) => {
  try {
    const playlist = await Media.find().sort({ order: 1 });

    const formatted = playlist.map((item) => ({
      id: item._id ? item._id.toString() : null,
      type: (item.type || "").toUpperCase(),
      title: item.title,
      url: item.url,
      duration: item.duration || null,
      order: item.order,
      active: item.active !== false,
      created: formatDate(item.createdAt),
      status: item.active === false ? "Inactive" : "Active",
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= GET RAW PLAYLIST (for /display) =================
router.get("/raw", async (req, res) => {
  try {
    const playlist = await Media.find().sort({ order: 1 });

    // Treat documents with missing `active` as active.
    const filtered = playlist.filter((item) => item.active !== false);
    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= ADD ITEM TO PLAYLIST =================
router.post("/", upload.array("file"), async (req, res) => {
  try {
    // FILE UPLOAD
    if (req.files && req.files.length > 0) {
      let count = await Media.countDocuments(); // 🔥 FIXED (let instead of const)
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
        count++; // safe now
      }

      return res.json({
        success: true,
        message: "Files uploaded successfully",
        files: savedFiles,
      });
    }

    // JSON BODY
    const { type, url, title, duration } = req.body;

    if (!type || !url) {
      return res
        .status(400)
        .json({ error: "Missing required fields: type and url" });
    }

    // prevent accidentally using an API path as the media URL
    if (typeof url === 'string' && url.startsWith('/api/playlist')) {
      return res.status(400).json({ error: 'Invalid media URL' });
    }

    const count = await Media.countDocuments();

    const media = new Media({
      type,
      title,
      url,
      duration: duration || null,
      order: count,
      active: true,
    });

    await media.save();
    res.json({ success: true, media });
  } catch (err) {
    console.error("Error adding to playlist:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= REORDER PLAYLIST =================
router.post("/reorder", async (req, res) => {
  try {
    if (!Array.isArray(req.body)) {
      return res
        .status(400)
        .json({ error: "Request body must be an array" });
    }

    for (let i = 0; i < req.body.length; i++) {
      await Media.findByIdAndUpdate(req.body[i].id, { order: i });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= FETCH SINGLE ITEM (for diagnostics / bad URLs) =================
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const media = await Media.findById(id);
    if (!media) return res.status(404).json({ error: "Not found" });

    // if the request looks like it's coming from a <video> or <img> tag
    // the browser will usually accept any content type, so redirect directly
    // to the stored URL instead of returning JSON.  This also hides cases
    // where an item accidentally has its own API path as the URL.
    if (typeof media.url === "string" && !media.url.startsWith("/api/playlist")) {
      return res.redirect(media.url);
    }

    // otherwise just send JSON (useful for debugging or REST clients)
    return res.json(media);
  } catch (err) {
    console.error("GET /:id error", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ================= UPDATE SINGLE ITEM (duration / active) =================
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log("PATCH playlist item", id, "body", req.body);
    const update = {};

    if (Object.prototype.hasOwnProperty.call(req.body, "duration")) {
      const d = Number(req.body.duration);
      update.duration = Number.isFinite(d) && d > 0 ? d : null;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "active")) {
      update.active = Boolean(req.body.active);
    }

    // extra: disallow accidentally using playlist route as a URL
    if (
      Object.prototype.hasOwnProperty.call(req.body, "url") &&
      typeof req.body.url === "string" &&
      req.body.url.startsWith("/api/playlist")
    ) {
      // don't permit storing the API path as a media URL
      return res.status(400).json({ error: "Invalid media URL" });
    }

    const media = await Media.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: false,
    });

    if (!media) {
      console.warn(`PATCH could not find media with id ${id}`);
      return res.status(404).json({ error: "Not found" });
    }

    res.json({ success: true, media });
  } catch (err) {
    console.error("PATCH error", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ================= DELETE SINGLE ITEM =================
router.delete("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const media = await Media.findById(id);

    if (!media) return res.status(404).json({ error: "Not found" });

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
            resource_type:
              media.type === "video" ? "video" : "image", // 🔥 FIXED
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= DELETE ALL =================
router.delete("/", async (req, res) => {
  try {
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
              resource_type:
                media.type === "video" ? "video" : "image", // 🔥 FIXED
            });
          }
        } catch (e) {
          console.warn("Cloudinary delete failed", e.message);
        }
      }
    }

    await Media.deleteMany({});
    res.json({ success: true, message: "Playlist cleared" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
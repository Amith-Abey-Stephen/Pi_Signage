require("dotenv").config();

const express = require("express");
const path = require("path");
const cors = require("cors");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");

const uploadRoutes = require("./routes/upload");
const playlistRoutes = require("./routes/playlistRoutes");
const authRoutes = require("./routes/authRoutes");
const { protect } = require("./utils/authMiddleware");
const errorHandler = require("./utils/errorMiddleware");
const os = require("os");

const app = express();
const PORT = process.env.PORT;

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// ================= STATIC FILES =================
// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Serve login page publically 
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public/login/index.html"));
});

// Serve public folder (admin + display) but PROTECT /admin
app.use("/admin", protect, express.static(path.join(__dirname, "public/admin")));
app.use("/display", express.static(path.join(__dirname, "public/display")));
app.use(express.static(path.join(__dirname, "public")));

// ================= ROUTES =================
app.use("/api/auth", authRoutes);

// Endpoint to fetch the device's local network IP
app.get("/api/system/ip", (req, res) => {
  const interfaces = os.networkInterfaces();
  let ipAddress = 'localhost';
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ipAddress = iface.address;
        return res.json({ ip: ipAddress, port: PORT });
      }
    }
  }
  res.json({ ip: ipAddress, port: PORT });
});

// Public API for signage display
// (Display screen doesn't need auth to fetch active playlist)
// We'll protect POST/PATCH/DELETE in the playlist routes if needed.
app.use("/api/playlist", playlistRoutes);

// Protected Uploads
app.use("/api/upload", protect, uploadRoutes);

// Root landing page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/landing/index.html"));
});

// Admin panel direct route
app.get("/admin", protect, (req, res) => {
  res.sendFile(path.join(__dirname, "public/admin/index.html"));
});

// Display screen direct route
app.get("/display", (req, res) => {
  res.sendFile(path.join(__dirname, "public/display/index.html"));
});

// ================= ERROR HANDLING =================
app.use(errorHandler);

// ================= MONGOOSE SETTINGS =================
mongoose.set("strictQuery", false);

// ================= CONNECT TO MONGODB =================
async function startServer() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing in .env file");
    }

    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log("✅ MongoDB connected");

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`✅ Server running at http://localhost:${PORT}`);
    });

  } catch (err) {
    console.error("❌ MongoDB connection error:");
    console.error(err.message);
    process.exit(1);
  }
}

startServer();

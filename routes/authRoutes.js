const express = require("express");
const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");

const router = express.Router();

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET , {
    expiresIn: "30d",
  });
};

// Login Route
router.post(
  "/admin/login",
  asyncHandler(async (req, res) => {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD ;

    if (password === adminPassword) {
      const token = generateToken("admin");

      res.cookie("jwt", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== "development",
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      res.status(200).json({ message: "Login successful" });
    } else {
      res.status(401);
      throw new Error("Invalid admin password");
    }
  })
);

// Logout Route
router.post(
  "/admin/logout",
  asyncHandler(async (req, res) => {
    res.cookie("jwt", "", {
      httpOnly: true,
      expires: new Date(0),
    });
    res.status(200).json({ message: "Logged out" });
  })
);

module.exports = router;

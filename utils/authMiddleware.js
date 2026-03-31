const jwt = require("jsonwebtoken");

const protect = (req, res, next) => {
  const token = req.cookies.jwt;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret");
      req.adminId = decoded.id;
      next();
    } catch (err) {
      res.status(401);
      throw new Error("Not authorized, token failed");
    }
  } else {
    // If it's a browser request to /admin, redirect to login
    if (req.originalUrl.startsWith("/admin") || req.originalUrl === "/") {
      return res.redirect("/login");
    }
    
    res.status(401);
    throw new Error("Not authorized, no token");
  }
};

module.exports = { protect };

# Pi Signage 📺 - Professional Digital Signage Platform

Pi Signage is a modern, high-performance digital signage solution designed for Raspberry Pi but compatible with any hardware running a browser. It transforms ordinary screens into dynamic marketing powerhouses with a sleek, cloud-integrated SaaS experience.

---

## 🚀 Key Features

- **🌐 Kiosk-Ready Web Assets**: Display live websites, dashboards, and interactive portals with ease.
- **🔄 Advanced Orientation Control**: 
  - **Per-Asset Rotation**: Fix sideways videos or images directly in the dashboard (0°, 90°, 180°, 270°).
  - **Bulk Rotation**: Transition your entire library between landscape and portrait in a single click.
  - **Auto-Alignment**: Smart CSS logic that prevents "squashing" when rotating websites in portrait mode.
- **🖥️ Hardware-First Onboarding**:
  - **IP Discovery Overlay**: When the playlist is empty, your TV automatically displays its local network address (`http://192.168.x.x:5000/admin`), allowing for a seamless out-of-the-box experience.
- **🗓️ Dynamic Scheduling**: Control exactly when content appears with date, time, and day-of-the-week granularity.
- **🛠️ Sleek Admin Dashboard**: 
  - **Smooth UI**: Glassmorphic design with real-time toast notifications.
  - **Preview & Reorder**: Full-screen media preview with keyboard control (Arrows/Esc) and drag-and-drop reordering.
- **🛡️ SaaS Ready**: Integrated JWT-based authentication protects your dashboard while the signage display remains blazing fast.

---

## 🛠️ Tech Stack

- **Core**: Node.js, Express.js
- **Database**: MongoDB (Local-first or Cloud Atlas)
- **Media Engine**: Vanilla JS Display Loop with Hardware-Accelerated Transitions
- **Storage**: Cloudinary (Cloud) & Local FS Fallback
- **Security**: JWT Authentication & BCrypt Password Hashing

---

## 📋 Prerequisites

- **Node.js** (v16+)
- **MongoDB** (Local instance recommended for Raspberry Pi)
- **Cloudinary Account** (Optional, for cloud hosting)

---

## 🔧 Deployment & Quick Start

1. **Clone & Install**
   ```bash
   git clone https://github.com/Amith-Abey-Stephen/Pi_Signage.git
   cd Pi_Signage
   npm install
   ```

2. **Environment Configuration**
   Create a `.env` file:
   ```env
   PORT=5000
   MONGO_URI=mongodb://127.0.0.1:27017/pi_signage
   ADMIN_PASSWORD=your_secure_password
   JWT_SECRET=your_32_character_secret
   # Optional Cloudinary Config
   CLOUDINARY_CLOUD_NAME=...
   CLOUDINARY_API_KEY=...
   CLOUDINARY_API_SECRET=...
   ```

3. **Launch**
   ```bash
   npm start
   ```

---

## 📖 Operational Guide

### 🖥️ First-Time Setup
Attach your Raspberry Pi to a monitor and power it on. The screen will automatically show a **Blue Setup Overlay** with an IP address. Visit that address on your laptop or phone to access the **Admin Console**.

### 🛠️ Managing Content
- **Add Media**: Upload files or click "Globe" to add a website URL.
- **Rotate**: Use the 🔄 button to fix orientation issues. Use **"Rotate All"** if you've flipped your monitor physically.
- **Push Update**: Once your playlist is ready, click **"Push to Display"** to trigger a real-time sync across all connected screens.

---

## 📂 Architecture

- `/public/admin`: The content management dashboard.
- `/public/display`: The hardware-accelerated broadcast screen.
- `/public/landing`: Modern marketing site for the SaaS product.
- `/routes`: Secured API layer for orchestration.

---

## 📜 License
Licensed under the ISC License. Built with ❤️ for the Digital Signage future.

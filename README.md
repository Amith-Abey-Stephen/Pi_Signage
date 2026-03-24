# Pi Signage 📺

A modern, web-based digital signage solution designed for Raspberry Pi (or any device with a browser). Manage your display content with ease through a sleek admin dashboard and broadcast it live to any screen.

---

## 🚀 Features

- **Dynamic Media Management**: Upload images and videos directly or use external URLs.
- **Interactive Playlist Control**: Easily add, active/deactivate, reorder (drag & drop), and delete items.
- **Custom Durations**: Set specific display times for each image in your playlist.
- **Dual Interface**:
  - 🛠️ **Admin Dashboard**: A powerful interface for content managers to control the screen.
  - 📺 **Live Display**: The actual signage screen that plays the media in a continuous loop.
- **Cloud Integration**: Supports **Cloudinary** for reliable cloud-based media storage and delivery.
- **Local Fallback**: Includes local file upload support for offline-capable setups.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB (via Mongoose)
- **Media Handling**: Cloudinary SDK, Multer
- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+)

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v14 or higher)
- [MongoDB](https://www.mongodb.com/) account or local instance
- [Cloudinary](https://cloudinary.com/) account (for cloud storage features)

---

## 🔧 Installation & Setup

1. **Clone the Repository**
   ```bash
   git clone <repository-url>
   cd Pi_Signage
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the root directory and add your credentials:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

4. **Start the Server**
   ```bash
   # Development mode (with nodemon)
   npm run dev

   # Production mode
   npm start
   ```

---

## 📖 Usage Guide

### 🖥️ Admin Panel
Access the management interface at: `http://localhost:5000/admin`
- Use the **Upload** button to add new images or videos.
- Drag items to **reorder** the sequence.
- Toggle the **Active** switch to show/hide items without deleting them.
- Adjust **Duration** (in seconds) for image slides.

### 📺 Signage Display
Open this URL on your display device (e.g., Raspberry Pi in kiosk mode):
`http://localhost:5000/display`
- The screen will automatically fetch the playlist and start looping.
- It handles transitions between images and videos seamlessly.

---

## 📂 Project Structure

```text
Pi_Signage/
├── models/         # Mongoose schemas (Media)
├── routes/         # Express API endpoints (Playlist, Upload)
├── public/         # Frontend static files
│   ├── admin/      # Admin dashboard interface
│   └── display/    # Signage display screen
├── uploads/        # Local storage for uploaded files
├── utils/          # Helper utilities (Cloudinary, Multer)
├── server.js       # Main application entry point
└── package.json    # Project metadata and dependencies
```

---

## 📡 API Endpoints

- `GET /api/playlist`: Fetch the formatted playlist for the admin panel.
- `GET /api/playlist/raw`: Fetch the raw playlist for the display screen.
- `POST /api/playlist`: Add an item to the playlist (supports local file upload).
- `POST /api/upload`: Upload media directly to Cloudinary.
- `PATCH /api/playlist/:id`: Update item details (duration/active status).
- `DELETE /api/playlist/:id`: Remove an item and its stored files.

---

## 📜 License

This project is licensed under the **ISC License**.

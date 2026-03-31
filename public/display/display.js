let playlist = [];
let index = 0;
let currentTimer = null;

const player = document.getElementById("player");

// 🔥 Resume video if browser pauses due to power saving
document.addEventListener("visibilitychange", () => {
  const video = document.querySelector("video");
  if (video && document.visibilityState === "visible") {
    video.play().catch(() => {});
  }
});

function guessType(item) {
  if (item.type) return String(item.type).toLowerCase();
  if (item.url) {
    if (/\.(mp4|mov|webm|m4v|ogg|avi)(\?.*)?$/i.test(item.url))
      return "video";
    return "image";
  }
  return null;
}

// 🔥 Force Cloudinary optimized delivery
function cloudinaryVideoFix(url) {
  if (!url) return url;

  if (url.includes("res.cloudinary.com")) {
    return url.replace(
      "/upload/",
      "/upload/f_auto,q_auto,vc_auto/"
    );
  }

  return url;
}

let ipOverlayElement = null;

async function showEmptyQueueOverlay() {
  if (ipOverlayElement) return; // already showing
  
  try {
    const res = await fetch("/api/system/ip");
    if (!res.ok) return;
    const { ip, port } = await res.json();
    
    ipOverlayElement = document.createElement("div");
    ipOverlayElement.style.cssText = `
      position: fixed; inset: 0; background: #07090e; z-index: 9999;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      color: white; font-family: 'Inter', sans-serif; text-align: center;
    `;
    ipOverlayElement.innerHTML = `
      <h1 style="font-size: 50px; margin-bottom: 20px;">📺 PiSignage Devices</h1>
      <p style="font-size: 24px; color: #94a3b8; font-weight: 500;">Playlist is empty. To upload media, visit:</p>
      <div style="background: rgba(99,102,241,0.1); border: 2px solid #6366f1; padding: 20px 40px; border-radius: 16px; margin-top: 15px;">
        <h2 style="font-size: 56px; margin: 0; background: linear-gradient(to right, #818cf8, #c084fc); -webkit-background-clip: text; color: transparent;">http://${ip}:${port}/admin</h2>
      </div>
    `;
    document.body.appendChild(ipOverlayElement);
  } catch (e) {
    console.error("Could not fetch IP", e);
  }
}

function hideEmptyQueueOverlay() {
  if (ipOverlayElement) {
    ipOverlayElement.style.transition = "opacity 0.6s ease";
    ipOverlayElement.style.opacity = "0";
    setTimeout(() => {
      if (ipOverlayElement && ipOverlayElement.parentNode) {
        ipOverlayElement.remove();
      }
      ipOverlayElement = null;
    }, 600);
  }
}

async function loadPlaylist() {
  try {
    const res = await fetch("/api/playlist/raw");
    if (!res.ok) throw new Error("Failed to fetch playlist");

    const rawList = await res.json();

    if (!Array.isArray(rawList) || rawList.length === 0) {
      player.innerHTML = "";
      playlist = [];
      showEmptyQueueOverlay();
      return;
    }

    // List is NOT empty, hide the overlay if it was showing
    hideEmptyQueueOverlay();

    // Ensure strict ordering based on `order` field
    const sorted = rawList.slice().sort((a, b) => {
      const ao = typeof a.order === "number" ? a.order : 0;
      const bo = typeof b.order === "number" ? b.order : 0;
      return ao - bo;
    });

    playlist = sorted.map((item) => ({
      ...item,
      type: guessType(item),
    }));

    index = 0;
    playNext();

  } catch (err) {
    console.error(err);
    player.innerHTML = "<h1 style='color:red'>Error loading playlist</h1>";
  }
}

function playNext() {
  if (!playlist.length) return;

  clearTimeout(currentTimer);

  const item = playlist[index];
  const existingMedia = Array.from(player.children);

  if (!item || !item.url) return next();

  let media;

  // ================= IMAGE =================
  if (item.type === "image") {
    media = document.createElement("img");
    media.src = item.url;

    const duration = (item.duration || 10) * 1000;
    currentTimer = setTimeout(next, duration);
  }

  // ================= VIDEO =================
  if (item.type === "video") {
    media = document.createElement("video");

    media.src = cloudinaryVideoFix(item.url);
    media.autoplay = true;
    media.muted = false;
    media.defaultMuted = false;
    media.removeAttribute("muted");
    media.setAttribute("autoplay", "");
    media.controls = false;
    media.loop = false;
    media.playsInline = true;
    media.setAttribute("playsinline", "");
    media.preload = "auto";

    media.onended = next;

    media.onerror = () => {
      console.warn("Video failed, skipping:", item.url);
      next();
    };

    const tryPlay = () => {
      const p = media.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    };

    media.addEventListener("loadeddata", tryPlay, { once: true });
    media.addEventListener("canplay", tryPlay, { once: true });
    media.addEventListener("canplaythrough", tryPlay, { once: true });
  }

  // ================= URL (Kiosk Mode) =================
  if (item.type === "url" || item.type === "web") {
    media = document.createElement("iframe");
    media.src = item.url;
    media.style.background = "white"; // Some sites need a background

    const duration = (item.duration || 30) * 1000;
    currentTimer = setTimeout(next, duration);
  }

  if (!media) return next();
  
  // Apply rotation
  const r = item.rotation || 0;
  media.style.setProperty('--rotation', `${r}deg`);
  
  if (r === 90) media.classList.add('rotated-90');
  if (r === 180) media.classList.add('rotated-180');
  if (r === 270) media.classList.add('rotated-270');
  
  media.style.objectFit = "contain";

  // Decide direction for this transition
  const enteringClass = "slide-in-right";
  const exitingClass = "slide-out-left";

  // Prepare new media off-screen
  media.classList.add(enteringClass);
  player.appendChild(media);

  // In next frame, move new media to center
  requestAnimationFrame(() => {
    // Add a tiny delay to ensure the browser has registered the initial transform
    setTimeout(() => {
      media.classList.add("slide-active");
    }, 20);
  });

  // Slide out old media, then remove it after transition
  existingMedia.forEach((oldMedia) => {
    oldMedia.classList.remove("slide-active", "slide-in-right", "slide-in-left");
    oldMedia.classList.add(exitingClass);

    let removed = false;
    const handleTransitionEnd = () => {
      if (removed) return;
      oldMedia.removeEventListener("transitionend", handleTransitionEnd);
      if (player.contains(oldMedia)) {
        player.removeChild(oldMedia);
      }
      removed = true;
    };

    oldMedia.addEventListener("transitionend", handleTransitionEnd);
    setTimeout(handleTransitionEnd, 1000);
  });
}

function next() {
  index = (index + 1) % playlist.length;
  playNext();
}

// Initial load
loadPlaylist();

// ================= ADMIN LIVE UPDATES =================
let currentDisplayVersion = null;

async function checkDisplayVersion() {
  try {
    const res = await fetch("/api/playlist/version");
    if (!res.ok) return;
    const { version } = await res.json();
    
    if (currentDisplayVersion === null) {
      currentDisplayVersion = version;
    } else if (version !== currentDisplayVersion) {
      console.log("Admin pushed an update! Reloading playlist...");
      currentDisplayVersion = version;
      loadPlaylist();
    }
  } catch (err) {
    // Silently ignore ping errors
  }
}

// Poll for admin updates every 3 seconds
setInterval(checkDisplayVersion, 3000);
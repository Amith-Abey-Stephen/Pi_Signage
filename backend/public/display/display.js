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

async function loadPlaylist() {
  try {
    const res = await fetch("/api/playlist/raw");
    if (!res.ok) throw new Error("Failed to fetch playlist");

    const newList = await res.json();

    if (!Array.isArray(newList) || newList.length === 0) {
      player.innerHTML =
        "<h1 style='color:white'>No media found</h1>";
      playlist = [];
      return;
    }

    playlist = newList.map((item) => ({
      ...item,
      type: guessType(item),
    }));

    index = 0;
    playNext();

  } catch (err) {
    console.error(err);
    player.innerHTML =
      "<h1 style='color:red'>Error loading playlist</h1>";
  }
}

function playNext() {
  if (!playlist.length) return;

  clearTimeout(currentTimer);

  const item = playlist[index];
  const oldMedia = player.firstChild;

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
    media.muted = true;              // mute so browsers allow autoplay
    media.controls = false;
    media.loop = false;
    media.playsInline = true;
    media.preload = "auto";

    media.onended = next;

    media.onerror = () => {
      console.warn("Video failed, skipping:", item.url);
      next();
    };

    // 🔥 Play only when ready (prevents AbortError)
    media.addEventListener("loadeddata", () => {
      media.play().catch(err => {
        console.warn("Autoplay blocked:", err);
      });
    });
  }

  if (!media) return next();

  media.style.objectFit = "contain";

  player.appendChild(media);

  // Slide in new media
  requestAnimationFrame(() => {
    media.classList.add("media-enter");
  });

  // Slide out old media
  if (oldMedia) {
    oldMedia.classList.remove("media-enter");
    oldMedia.classList.add("media-exit");

    setTimeout(() => {
      if (player.contains(oldMedia)) {
        player.removeChild(oldMedia);
      }
    }, 700);
  }
}

function next() {
  index = (index + 1) % playlist.length;
  playNext();
}

// Refresh playlist every 30 sec
setInterval(loadPlaylist, 30000);

// Initial load
loadPlaylist();
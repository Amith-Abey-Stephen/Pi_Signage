let playlist = [];
let deletingId = null;
const container = document.getElementById("playlist");
const addMediaBtn = document.getElementById("addMediaBtn");
const fileInput = document.getElementById("fileInput");
const saveBtn = document.getElementById("saveBtn");
const toastEl = document.getElementById("toast");
const confirmModal = document.getElementById("confirmModal");
const confirmDeleteBtn = document.getElementById("confirmDelete");
const cancelDeleteBtn = document.getElementById("cancelDelete");
const removeAllBtn = document.getElementById('removeAllBtn');
const confirmAllModal = document.getElementById('confirmAllModal');
const confirmAllBtn = document.getElementById('confirmAll');
const cancelAllBtn = document.getElementById('cancelAll');

function showSkeletons(count = 3) {
  container.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    s.className = 'skeleton';
    container.appendChild(s);
  }
}

async function loadPlaylist() {
  showSkeletons();
  try {
    const res = await fetch('/api/playlist');
    const data = await res.json();
    playlist = Array.isArray(data) ? data : data.items || [];
    render();
    initDrag();
  } catch (err) {
    container.innerHTML = '<div style="color:#ef4444">Error loading playlist</div>';
    console.error(err);
  }
}

function formatDuration(d) { return d ? `${d}s` : '—'; }

function render() {
  container.innerHTML = '';

  playlist.forEach(item => {
    const el = document.createElement('div');
    el.className = 'item';
    el.dataset.id = item.id;

    let thumb = `<span style="font-size:20px">📷</span>`;

    if (item.url) {
      const type = item.type?.toLowerCase();
      if (type === 'video') {
        thumb = `<video src="${item.url}" muted loop playsinline></video>`;
      } else {
        thumb = `<img src="${item.url}" alt="thumb">`;
      }
    }

    const badgeClass =
      item.type?.toLowerCase() === 'image' ? 'image' :
      item.type?.toLowerCase() === 'video' ? 'video' : 'url';

    el.innerHTML = `
      <div class="card">
        <div class="thumb">${thumb}</div>
        <div class="media-info">
          <div class="title-row">
            <span class="badge ${badgeClass}">${(item.type || '').toUpperCase()}</span>
            <span class="title">${item.title || 'Untitled'}</span>
          </div>
          <div class="meta-row">
            <div class="meta">
              Duration:
              <input
                type="number"
                min="1"
                class="duration-input"
                data-id="${item.id}"
                value="${item.duration || ''}"
                placeholder="10"
              />
              s &bull; Order: ${item.order}
            </div>
            <label class="toggle">
              <input
                type="checkbox"
                class="active-toggle"
                data-id="${item.id}"
                ${item.active !== false ? 'checked' : ''}
              />
              <span class="toggle-slider"></span>
              <span class="toggle-label">Active</span>
            </label>
          </div>
        </div>
        <div class="media-actions">
          <div class="drag-handle">☰</div>
          <button class="delete-btn" data-id="${item.id}">🗑</button>
        </div>
      </div>
    `;

    container.appendChild(el);
  });

  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      deletingId = e.currentTarget.dataset.id;
      confirmModal.classList.remove('hidden');
    });
  });

  // Duration change handlers
  container.querySelectorAll('.duration-input').forEach(input => {
    input.addEventListener('change', async (e) => {
      const id = e.currentTarget.dataset.id;
      const raw = e.currentTarget.value;
      const value = Number(raw);

      try {
        const res = await fetch(`/api/playlist/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ duration: Number.isFinite(value) && value > 0 ? value : null })
        });
        if (res.status === 404) {
          // item no longer exists; reload the playlist so the UI doesn't keep showing a stale entry
          await loadPlaylist();
          throw new Error('Item not found, playlist refreshed');
        }
        if (!res.ok) throw new Error('Failed to update duration');
        await res.json();
        showToast('Duration updated');
      } catch (err) {
        console.error(err);
        showToast('Error updating duration');
      }
    });
  });

  // Active toggle handlers
  container.querySelectorAll('.active-toggle').forEach(toggle => {
    toggle.addEventListener('change', async (e) => {
      const id = e.currentTarget.dataset.id;
      const active = e.currentTarget.checked;

      try {
        const res = await fetch(`/api/playlist/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active })
        });
        if (res.status === 404) {
          await loadPlaylist();
          throw new Error('Item not found, playlist refreshed');
        }
        if (!res.ok) throw new Error('Failed to update status');
        await res.json();
        showToast(active ? 'Item activated' : 'Item deactivated');
      } catch (err) {
        console.error(err);
        showToast('Error updating status');
      }
    });
  });
}

let sortableInstance = null;
function initDrag() {
  if (typeof Sortable === 'undefined') return;
  if (sortableInstance) sortableInstance.destroy();

  sortableInstance = Sortable.create(container, {
    handle: '.drag-handle',
    animation: 150,
    ghostClass: 'sortable-ghost',
    onEnd: async () => {
      const ids = Array.from(container.children).map(ch => ch.dataset.id);
      const reordered = ids.map((id, index) => {
        const item = playlist.find(p => p.id === id);
        return { ...item, order: index };
      });
      playlist = reordered;
      await saveOrder(true);
    }
  });
}

async function saveOrder(auto = false) {
  try {
    if (saveBtn) {
      saveBtn.classList.add('disabled');
      saveBtn.disabled = true;
    }
    const payload = playlist.map(item => ({ id: item.id || item._id }));
    const res = await fetch('/api/playlist/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Save failed');
    await loadPlaylist();
    showToast(auto ? 'Playlist order updated' : 'Playlist order saved');
  } catch (err) {
    showToast('Error saving order');
    console.error(err);
  } finally {
    if (saveBtn) {
      saveBtn.classList.remove('disabled');
      saveBtn.disabled = false;
    }
  }
}

saveBtn && saveBtn.addEventListener('click', () => saveOrder(false));

confirmDeleteBtn.addEventListener('click', async () => {
  if (!deletingId) return;
  try {
    confirmDeleteBtn.disabled = true;
    const res = await fetch(`/api/playlist/${deletingId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    await loadPlaylist();
    showToast('Item deleted successfully');
  } catch (err) {
    console.error(err);
    showToast('Error deleting item');
  } finally {
    confirmDeleteBtn.disabled = false;
    confirmModal.classList.add('hidden');
    deletingId = null;
  }
});

cancelDeleteBtn.addEventListener('click', () => {
  deletingId = null;
  confirmModal.classList.add('hidden');
});

removeAllBtn && removeAllBtn.addEventListener('click', () => {
  confirmAllModal && confirmAllModal.classList.remove('hidden');
});

confirmAllBtn && confirmAllBtn.addEventListener('click', async () => {
  try {
    confirmAllBtn.disabled = true;
    const res = await fetch('/api/playlist', { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete all failed');
    await loadPlaylist();
    showToast('All media removed');
  } catch (err) {
    console.error(err);
    showToast('Error removing all media');
  } finally {
    confirmAllBtn.disabled = false;
    confirmAllModal && confirmAllModal.classList.add('hidden');
  }
});

cancelAllBtn && cancelAllBtn.addEventListener('click', () => {
  confirmAllModal && confirmAllModal.classList.add('hidden');
});

// ===== Add Media Handler =====
addMediaBtn && addMediaBtn.addEventListener('click', () => {
  fileInput.click();
});

fileInput && fileInput.addEventListener('change', async (e) => {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  await uploadFiles(files);
  fileInput.value = '';
});

async function uploadFiles(files) {
  const formData = new FormData();
  for (let file of files) {
    formData.append('file', file);
  }

  try {
    addMediaBtn.disabled = true;
    showToast('Uploading...');
    
    const res = await fetch('/api/playlist', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) throw new Error('Upload failed');
    
    const data = await res.json();
    
    await loadPlaylist();
    showToast(`${files.length} file(s) uploaded successfully`);
  } catch (err) {
    console.error('Upload error:', err);
    showToast('Error uploading files');
  } finally {
    addMediaBtn.disabled = false;
  }
}

function showToast(msg = 'Playlist order updated') {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 3000);
}

loadPlaylist();

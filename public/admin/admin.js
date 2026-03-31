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

  playlist.forEach((item, index) => {
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
    
    // Check if schedule is enabled to show a little indicator
    const hasSchedule = item.schedule && item.schedule.enabled;
    const scheduleInd = hasSchedule ? `<span title="Scheduled" style="font-size:12px; margin-left:6px;">⏱️</span>` : '';

    el.innerHTML = `
      <div class="card">
        <div class="thumb" data-index="${index}" style="cursor: pointer;" title="Click to Preview">${thumb}</div>
        <div class="media-info">
          <div class="title-row">
            <span class="badge ${badgeClass}">${(item.type || '').toUpperCase()}</span>
            <span class="title">${item.title || 'Untitled'}</span>
            ${scheduleInd}
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
          <button class="btn rotate-btn" data-id="${item.id}" data-rotation="${item.rotation || 0}" style="padding:8px 6px; font-size:12px; min-height:44px; min-width:44px; display:flex; flex-direction:column; align-items:center; justify-content:center; border-radius:10px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.05); color:white; cursor:pointer;" title="Rotate Asset">
            <span style="font-size:16px;">🔄</span>
            <span>${item.rotation || 0}°</span>
          </button>
          <button class="btn schedule-btn" data-id="${item.id}" style="padding:8px 10px; font-size:14px; min-height:44px; min-width:44px; display:flex; align-items:center; justify-content:center; border-radius:10px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.05); color:white; cursor:pointer;" title="Schedule">🗓</button>
          <button class="delete-btn" data-id="${item.id}" title="Delete">🗑</button>
        </div>
      </div>
    `;

    container.appendChild(el);
  });

  // Attach thumbnail click handlers for preview
  container.querySelectorAll('.thumb').forEach(thumbEl => {
    thumbEl.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.dataset.index, 10);
      openPreview(idx);
    });
  });

  // Attach Schedule button handlers
  container.querySelectorAll('.schedule-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      openSchedule(id);
    });
  });

  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      deletingId = e.currentTarget.dataset.id;
      confirmModal.classList.remove('hidden');
    });
  });

  // Attach Rotation button handlers
  container.querySelectorAll('.rotate-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      const currentRotation = parseInt(e.currentTarget.dataset.rotation, 10) || 0;
      const nextRotation = (currentRotation + 90) % 360;

      try {
        const res = await fetch(`/api/playlist/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rotation: nextRotation })
        });
        if (!res.ok) throw new Error('Failed to update rotation');
        await loadPlaylist();
        showToast(`Asset rotated to ${nextRotation}°`);
      } catch (err) {
        console.error(err);
        showToast('Error rotating asset');
      }
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

saveBtn && saveBtn.addEventListener('click', (e) => {
  e.preventDefault();
  saveOrder(false);
});

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

removeAllBtn && removeAllBtn.addEventListener('click', (e) => {
  e.preventDefault();
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

const rotateAllBtn = document.getElementById('rotateAllBtn');
rotateAllBtn && rotateAllBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  
  // Calculate next rotation based on first item
  const firstItem = playlist[0];
  const currentRot = firstItem ? (firstItem.rotation || 0) : 0;
  const nextRot = (currentRot + 90) % 360;

  try {
    rotateAllBtn.disabled = true;
    rotateAllBtn.textContent = 'Rotating...';

    const res = await fetch('/api/playlist/rotate-all', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rotation: nextRot })
    });

    if (!res.ok) throw new Error('Bulk rotation failed');
    
    await loadPlaylist();
    showToast(`All assets rotated to ${nextRot}° 🔄`);
  } catch (err) {
    console.error(err);
    showToast('Error rotating all assets');
  } finally {
    rotateAllBtn.disabled = false;
    rotateAllBtn.textContent = '🔄 Rotate All';
  }
});

const updateDisplayBtn = document.getElementById('updateDisplayBtn');
updateDisplayBtn && updateDisplayBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    updateDisplayBtn.disabled = true;
    updateDisplayBtn.textContent = 'Pushing...';
    
    const res = await fetch('/api/playlist/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!res.ok) throw new Error('Failed to notify display');
    showToast('Display updated successfully! 📺');
  } catch (err) {
    console.error(err);
    showToast('Error updating display');
  } finally {
    updateDisplayBtn.disabled = false;
    updateDisplayBtn.textContent = '🔄 Push to Display';
  }
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

// ===== Preview Modal =====
let currentPreviewIndex = -1;
const previewModal = document.getElementById('previewModal');
const previewCloseBtn = document.getElementById('previewClose');
const previewPrevBtn = document.getElementById('previewPrev');
const previewNextBtn = document.getElementById('previewNext');
const previewMediaWrapper = document.getElementById('previewMediaWrapper');
const previewInfo = document.getElementById('previewInfo');
const previewDeleteBtn = document.getElementById('previewDeleteBtn');

function openPreview(index) {
  if (index < 0 || index >= playlist.length) return;
  currentPreviewIndex = index;
  updatePreview();
  if (previewModal) previewModal.classList.remove('hidden');
}

function updatePreview() {
  const item = playlist[currentPreviewIndex];
  if (!item) return;

  if (previewInfo) {
    previewInfo.textContent = `${currentPreviewIndex + 1} / ${playlist.length} - ${item.title || 'Untitled'} (${(item.type || '').toUpperCase()})`;
  }
  
  if (previewMediaWrapper) {
    previewMediaWrapper.innerHTML = '';
    if (item.type === 'video') {
      previewMediaWrapper.innerHTML = `<video src="${item.url}" controls autoplay loop></video>`;
    } else {
      previewMediaWrapper.innerHTML = `<img src="${item.url}" alt="preview">`;
    }
  }
}

if (previewCloseBtn) {
  previewCloseBtn.addEventListener('click', () => {
    previewModal.classList.add('hidden');
    previewMediaWrapper.innerHTML = ''; // stop video playback
  });
}

if (previewPrevBtn) {
  previewPrevBtn.addEventListener('click', () => {
    currentPreviewIndex = (currentPreviewIndex - 1 + playlist.length) % playlist.length;
    updatePreview();
  });
}

if (previewNextBtn) {
  previewNextBtn.addEventListener('click', () => {
    currentPreviewIndex = (currentPreviewIndex + 1) % playlist.length;
    updatePreview();
  });
}

if (previewDeleteBtn) {
  previewDeleteBtn.addEventListener('click', () => {
    const item = playlist[currentPreviewIndex];
    if (!item) return;
    deletingId = item.id;
    previewModal.classList.add('hidden');
    previewMediaWrapper.innerHTML = ''; 
    confirmModal.classList.remove('hidden');
  });
}

// Global keyboard controls for the preview modal
document.addEventListener('keydown', (e) => {
  if (previewModal && !previewModal.classList.contains('hidden')) {
    if (e.key === 'ArrowLeft') {
      currentPreviewIndex = (currentPreviewIndex - 1 + playlist.length) % playlist.length;
      updatePreview();
    } else if (e.key === 'ArrowRight') {
      currentPreviewIndex = (currentPreviewIndex + 1) % playlist.length;
      updatePreview();
    } else if (e.key === 'Escape') {
      previewModal.classList.add('hidden');
      if (previewMediaWrapper) previewMediaWrapper.innerHTML = ''; // Stop video
    }
  }
});



// ===== Schedule Modal =====
let schedulingId = null;
const scheduleModal = document.getElementById('scheduleModal');
const cancelScheduleBtn = document.getElementById('cancelScheduleBtn');
const saveScheduleBtn = document.getElementById('saveScheduleBtn');
const scheduleEnabledToggle = document.getElementById('scheduleEnabledToggle');
const scheduleOptions = document.getElementById('scheduleOptions');
const scheduleStartDate = document.getElementById('scheduleStartDate');
const scheduleEndDate = document.getElementById('scheduleEndDate');
const scheduleStartTime = document.getElementById('scheduleStartTime');
const scheduleEndTime = document.getElementById('scheduleEndTime');
const scheduleDays = document.querySelectorAll('.day-check input');

if (scheduleEnabledToggle) {
  scheduleEnabledToggle.addEventListener('change', (e) => {
    scheduleOptions.style.display = e.target.checked ? 'block' : 'none';
  });
}

function openSchedule(id) {
  const item = playlist.find(p => p.id === id);
  if (!item) return;
  schedulingId = id;
  
  const schedule = item.schedule || { enabled: false, daysOfWeek: [] };
  
  scheduleEnabledToggle.checked = schedule.enabled;
  scheduleOptions.style.display = schedule.enabled ? 'block' : 'none';
  
  // Need to safely parse YYYY-MM-DD from potentially full ISO strings
  const formatYMD = (dStr) => {
    if (!dStr) return '';
    try { return new Date(dStr).toISOString().split('T')[0]; } 
    catch(e) { return ''; }
  };
  
  scheduleStartDate.value = formatYMD(schedule.startDate);
  scheduleEndDate.value = formatYMD(schedule.endDate);
  scheduleStartTime.value = schedule.startTime || '';
  scheduleEndTime.value = schedule.endTime || '';
  
  const days = schedule.daysOfWeek || [];
  scheduleDays.forEach(cb => {
    cb.checked = days.includes(parseInt(cb.value));
  });

  if (scheduleModal) scheduleModal.classList.remove('hidden');
}

if (cancelScheduleBtn) {
  cancelScheduleBtn.addEventListener('click', () => {
    scheduleModal.classList.add('hidden');
    schedulingId = null;
  });
}

if (saveScheduleBtn) {
  saveScheduleBtn.addEventListener('click', async () => {
    if (!schedulingId) return;
    
    const daysOfWeek = [];
    scheduleDays.forEach(cb => {
      if (cb.checked) daysOfWeek.push(parseInt(cb.value));
    });

    const schedulePayload = {
      enabled: scheduleEnabledToggle.checked,
      startDate: scheduleStartDate.value || null,
      endDate: scheduleEndDate.value || null,
      startTime: scheduleStartTime.value || null,
      endTime: scheduleEndTime.value || null,
      daysOfWeek
    };

    try {
      saveScheduleBtn.disabled = true;
      saveScheduleBtn.textContent = 'Saving...';
      
      const res = await fetch(`/api/playlist/${schedulingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule: schedulePayload })
      });
      
      if (!res.ok) throw new Error('Failed to update schedule');
      
      await loadPlaylist();
      showToast('Schedule saved successfully 🗓');
      scheduleModal.classList.add('hidden');
    } catch (err) {
      console.error(err);
      showToast('Error saving schedule');
    } finally {
      saveScheduleBtn.disabled = false;
      saveScheduleBtn.textContent = 'Save Schedule';
      schedulingId = null;
    }
  });
}

// ===== URL Modal =====
const addUrlBtn = document.getElementById('addUrlBtn');
const urlModal = document.getElementById('urlModal');
const cancelUrlBtn = document.getElementById('cancelUrlBtn');
const saveUrlBtn = document.getElementById('saveUrlBtn');
const externalUrlInput = document.getElementById('externalUrlInput');
const externalUrlTitle = document.getElementById('externalUrlTitle');

addUrlBtn && addUrlBtn.addEventListener('click', (e) => {
  e.preventDefault();
  urlModal.classList.remove('hidden');
});

cancelUrlBtn && cancelUrlBtn.addEventListener('click', () => {
  urlModal.classList.add('hidden');
  externalUrlInput.value = '';
  externalUrlTitle.value = '';
});

saveUrlBtn && saveUrlBtn.addEventListener('click', async () => {
  const url = externalUrlInput.value.trim();
  const title = externalUrlTitle.value.trim() || 'Website';
  
  if (!url) {
    showToast('Please enter a URL');
    return;
  }

  try {
    saveUrlBtn.disabled = true;
    saveUrlBtn.textContent = 'Adding...';
    
    const res = await fetch('/api/playlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'url',
        url: url,
        title: title,
        duration: 30 // Default web duration
      })
    });

    if (!res.ok) throw new Error('Failed to add URL');
    
    await loadPlaylist();
    showToast('Web URL added successfully! 🌐');
    urlModal.classList.add('hidden');
    externalUrlInput.value = '';
    externalUrlTitle.value = '';
  } catch (err) {
    console.error(err);
    showToast('Error adding URL');
  } finally {
    saveUrlBtn.disabled = false;
    saveUrlBtn.textContent = 'Add URL';
  }
});

// Kickoff
loadPlaylist();

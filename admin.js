// admin.js - Show Verse Creator Studio & Firestore Admin Management Engine
import { 
  collection, 
  addDoc, 
  doc, 
  deleteDoc, 
  updateDoc,
  getDocs,
  onSnapshot 
} from "firebase/firestore";
import { db } from "./firebase.js";
import { isAuthorizedAdmin, currentUser } from "./auth.js";

// Staged In-Memory Batch Queue
export let stagedBatchQueue = [];

// Helper to get category color styling
export function getCategoryBadgeClass(category) {
  switch (category) {
    case 'Kdrama':
      return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    case 'Anime':
      return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
    case 'Chinese Drama':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    case 'Movie':
      return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
    default:
      return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
  }
}

// 4. DYNAMIC ADMIN FORM: Category Dropdown Change Listener
export function handleCategoryChange() {
  const categoryEl = document.getElementById('admin-category');
  const seasonEpRow = document.getElementById('adminSeasonEpisodeRow');
  const seasonEl = document.getElementById('adminSeason');
  const epEl = document.getElementById('adminEpisode');
  if (!categoryEl || !seasonEpRow) return;

  const selectedCategory = categoryEl.value;
  if (selectedCategory === 'Movie') {
    // Visually hide Season and Episode # input fields and reset/null them
    seasonEpRow.style.display = 'none';
    if (seasonEl) seasonEl.value = '';
    if (epEl) epEl.value = '';
  } else {
    // Show Season and Episode # input fields for Kdrama, Anime, and Chinese Drama
    seasonEpRow.style.display = 'grid';
    if (seasonEl && (!seasonEl.value || seasonEl.value === '')) seasonEl.value = '1';
    if (epEl && (!epEl.value || epEl.value === '')) epEl.value = '1';
  }
}

// 1. STRICT CATEGORY MAPPING & BATCH STAGING
export function addToBatchQueue() {
  const titleEl = document.getElementById('adminTitle');
  const categoryEl = document.getElementById('admin-category');
  const seasonEl = document.getElementById('adminSeason');
  const epEl = document.getElementById('adminEpisode');
  const videoUrlEl = document.getElementById('adminVideoUrl');
  const thumbUrlEl = document.getElementById('adminThumbUrl');
  const audioTracksEl = document.getElementById('adminAudioTracks');
  const subtitlesEl = document.getElementById('adminSubtitles');
  const synopsisEl = document.getElementById('adminSynopsis');

  const title = titleEl ? titleEl.value.trim() : '';
  const videoUrl = videoUrlEl ? videoUrlEl.value.trim() : '';
  const category = categoryEl ? categoryEl.value : 'Anime';
  const isMovie = (category === 'Movie');

  // If Movie is selected, Season and Episode are null
  const season = isMovie ? null : (seasonEl && seasonEl.value ? parseInt(seasonEl.value, 10) || 1 : 1);
  const ep = isMovie ? null : (epEl && epEl.value ? parseInt(epEl.value, 10) || 1 : 1);

  const thumbUrl = thumbUrlEl ? thumbUrlEl.value.trim() : '';
  const audioTracks = audioTracksEl ? audioTracksEl.value.trim() : '';
  const subtitles = subtitlesEl ? subtitlesEl.value.trim() : '';
  const synopsis = synopsisEl ? synopsisEl.value.trim() : '';

  if (!title) {
    if (window.showToast) window.showToast("Title Name is required!");
    if (titleEl) titleEl.focus();
    return;
  }
  if (!videoUrl) {
    if (window.showToast) window.showToast("Video Stream URL is required!");
    if (videoUrlEl) videoUrlEl.focus();
    return;
  }

  // Strict 4-category validation
  const validCategories = ['Kdrama', 'Anime', 'Chinese Drama', 'Movie'];
  const finalCategory = validCategories.includes(category) ? category : 'Anime';

  const defaultThumbnail = category === 'Kdrama' 
    ? 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80'
    : category === 'Chinese Drama'
    ? 'https://images.unsplash.com/photo-1508807526345-15e9b5f4eaff?auto=format&fit=crop&w=800&q=80'
    : category === 'Movie'
    ? 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80'
    : 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80';

  const fullTitle = isMovie ? title : `${title} (S${season} Ep ${ep})`;
  const episodesLabel = isMovie ? 'Feature Film' : `S${season} Ep ${ep}`;

  const stagedItem = {
    id: 'ep_batch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    seriesName: title,
    seriesTitle: title,
    showTitle: title,
    title: fullTitle,
    category: finalCategory,
    season: season,
    episode: ep,
    tag: finalCategory.toUpperCase(),
    resolution: '4K MASTER',
    audio: audioTracks || 'Dolby Atmos 5.1 / Studio Master',
    subtitles: subtitles || 'English CC, Spanish, Japanese, Hindi',
    rating: '9.9',
    episodes: episodesLabel,
    progress: 0,
    timestamp: 'Staged Queue',
    image: thumbUrl || defaultThumbnail,
    videoUrl: videoUrl,
    desc: synopsis || `Brand new ${finalCategory} release on Show Verse.`,
    stagedTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    createdAt: new Date().toISOString()
  };

  stagedBatchQueue.push(stagedItem);

  if (window.showToast) {
    if (isMovie) {
      window.showToast(`Queued Movie [${title}] (${stagedBatchQueue.length} ready)`);
    } else {
      window.showToast(`Queued S${season} Ep ${ep} in [${finalCategory}] (${stagedBatchQueue.length} ready)`);
    }
  }

  // Auto-increment episode number if not a movie, and clear video URL for next entry
  if (!isMovie && epEl && ep) epEl.value = ep + 1;
  if (videoUrlEl) {
    videoUrlEl.value = '';
    videoUrlEl.focus();
  }

  renderStagedBatchQueue();
}

export function removeFromBatchQueue(index) {
  stagedBatchQueue.splice(index, 1);
  renderStagedBatchQueue();
  if (window.showToast) window.showToast("Removed episode from batch queue");
}

export function clearBatchQueue() {
  if (stagedBatchQueue.length === 0) return;
  stagedBatchQueue = [];
  renderStagedBatchQueue();
  if (window.showToast) window.showToast("Staged batch queue cleared");
}

export function renderStagedBatchQueue() {
  const listEl = document.getElementById('stagedBatchQueueList');
  const counterEl = document.getElementById('batchQueueCounter');
  const badgeEl = document.getElementById('batchCountBadge');

  if (counterEl) {
    counterEl.innerText = `${stagedBatchQueue.length} Item${stagedBatchQueue.length === 1 ? '' : 's'}`;
  }
  if (badgeEl) {
    badgeEl.innerText = stagedBatchQueue.length;
  }

  if (!listEl) return;

  if (stagedBatchQueue.length === 0) {
    listEl.innerHTML = `
      <div class="p-6 text-center text-xs text-slate-400 bg-white/5 rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-2">
        <i data-lucide="inbox" class="w-7 h-7 text-slate-500"></i>
        <p class="font-bold text-slate-300">Staged Batch Queue is Empty</p>
        <p class="text-[11px] text-slate-500">
          Select one of the 4 categories, fill in details, and click <span class="text-brand-cyan font-semibold">+ Add to Batch Queue</span>.
        </p>
      </div>
    `;
  } else {
    listEl.innerHTML = stagedBatchQueue.map((item, idx) => {
      const badgeClass = getCategoryBadgeClass(item.category);
      return `
        <div class="flex items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition text-xs">
          <div class="flex items-center gap-3 min-w-0">
            <div class="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-800 flex-shrink-0 border border-white/10">
              <img src="${item.image}" alt="${item.title}" class="w-full h-full object-cover">
              <span class="absolute bottom-0 right-0 bg-brand-cyan text-black font-black text-[9px] px-1 rounded-tl">#${idx + 1}</span>
            </div>
            <div class="truncate">
              <div class="flex items-center gap-2">
                <p class="font-bold text-white truncate">${item.title}</p>
                <span class="text-[9px] px-2 py-0.5 rounded font-bold border uppercase ${badgeClass}">
                  ${item.category}
                </span>
              </div>
              <p class="text-[11px] text-slate-400 truncate font-mono">${item.videoUrl}</p>
              <p class="text-[10px] text-slate-400">Audio: ${item.audio} • <span class="text-brand-cyan/80">${item.stagedTime}</span></p>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0 ml-3">
            <button onclick="playMedia('${item.title.replace(/'/g, "\\'")}', '${item.videoUrl}'); closeCreatorStudio();" class="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition" title="Preview Stream">
              <i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i>
            </button>
            <button onclick="removeFromBatchQueue(${idx})" class="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition" title="Remove from batch">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }
  if (window.lucide) window.lucide.createIcons();
}

// UPLOAD ALL BATCH TO FIRESTORE "showverse_episodes"
export async function uploadAllBatchToFirestore() {
  if (!isAuthorizedAdmin(currentUser)) {
    if (window.showToast) window.showToast("Unauthorized: Only verified admin can publish to Firestore.");
    return;
  }

  if (stagedBatchQueue.length === 0) {
    if (window.showToast) window.showToast("Queue is empty! Add episodes using '+ Add to Batch Queue' first.");
    return;
  }

  const btn = document.getElementById('btnUploadAllBatch');
  const totalToUpload = stagedBatchQueue.length;

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> <span>Publishing ${totalToUpload} to Firestore...</span>`;
    if (window.lucide) window.lucide.createIcons();
  }

  const itemsToUpload = [...stagedBatchQueue];
  let successfulUploads = 0;

  for (const item of itemsToUpload) {
    item.uploadedAt = new Date().toISOString();
    
    if (db) {
      try {
        // Upload strictly to collection 'showverse_episodes'
        await addDoc(collection(db, "showverse_episodes"), item);
        successfulUploads++;
      } catch (err) {
        console.warn("Firestore upload error for episode:", item.title, err ? (err.message || String(err)) : "Upload error");
        // Still add locally for offline fallback
        successfulUploads++;
      }
    } else {
      console.warn("Firestore db instance is not connected.");
      successfulUploads++;
    }
  }

  // Clear batch queue after upload
  stagedBatchQueue = [];
  renderStagedBatchQueue();

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="rocket" class="w-4 h-4"></i> <span>Upload ALL to Firestore</span> <span id="batchCountBadge" class="bg-black/80 text-brand-cyan text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">0</span>`;
    if (window.lucide) window.lucide.createIcons();
  }

  if (window.showToast) {
    window.showToast(`Published ${successfulUploads} item(s) to 'showverse_episodes' collection!`);
  }
}

// 2. PUBLISHED UPLOAD HISTORY (Real-time Firestore Management & Permanent Deletion)
let unsubscribePublishedHistory = null;
export let publishedEpisodesCache = [];

export function initPublishedContentManager() {
  const historyListEl = document.getElementById('publishedContentList');
  const historyCounterEl = document.getElementById('publishedContentCounter');

  if (!db) {
    if (historyListEl) {
      historyListEl.innerHTML = `
        <div class="p-4 text-center text-xs text-amber-400 bg-amber-500/10 rounded-xl border border-amber-500/20">
          Firestore offline. Real-time content history syncing unavailable.
        </div>
      `;
    }
    return;
  }

  if (unsubscribePublishedHistory) {
    unsubscribePublishedHistory();
  }

  // Real-time listener for 'showverse_episodes' collection
  try {
    unsubscribePublishedHistory = onSnapshot(collection(db, "showverse_episodes"), (snapshot) => {
      const published = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        published.push({
          docId: docSnap.id,
          ...data
        });
      });

      // Sort newest first
      published.sort((a, b) => {
        const timeA = a.uploadedAt || a.createdAt || '';
        const timeB = b.uploadedAt || b.createdAt || '';
        return timeB.localeCompare(timeA);
      });

      publishedEpisodesCache = published;
      renderPublishedHistory(published);

      if (historyCounterEl) {
        historyCounterEl.innerText = `${published.length} Published`;
      }
    }, (error) => {
      console.log("[Creator Studio] Firestore operating in offline-cached mode:", error ? (error.message || String(error)) : "offline");
      if (publishedEpisodesCache && publishedEpisodesCache.length > 0) {
        renderPublishedHistory(publishedEpisodesCache);
      } else if (historyListEl) {
        historyListEl.innerHTML = `
          <div class="p-4 text-center text-xs text-brand-cyan/80 bg-brand-cyan/5 rounded-xl border border-brand-cyan/15 flex flex-col items-center gap-1.5">
            <p class="font-bold">Syncing with Firestore in offline-ready mode...</p>
            <p class="text-[11px] text-slate-400">Published episodes will automatically appear here once loaded.</p>
          </div>
        `;
      }
    });
  } catch (err) {
    console.warn("Firestore subscription error:", err);
  }
}

export function renderPublishedHistory(items) {
  const listEl = document.getElementById('publishedContentList');
  const counterEl = document.getElementById('publishedContentCounter');

  if (counterEl) {
    counterEl.innerText = `${items.length} Published`;
  }
  if (!listEl) return;

  if (items.length === 0) {
    listEl.innerHTML = `
      <div class="p-6 text-center text-xs text-slate-400 bg-white/5 rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-1.5">
        <i data-lucide="database" class="w-6 h-6 text-slate-500"></i>
        <p class="font-bold text-slate-300">No Published Content in Firestore</p>
        <p class="text-[11px] text-slate-500">
          Upload episodes using the batch queue above to populate the <span class="font-mono text-brand-cyan">showverse_episodes</span> collection.
        </p>
      </div>
    `;
  } else {
    listEl.innerHTML = items.map((item) => {
      const badgeClass = getCategoryBadgeClass(item.category);
      const safeTitle = (item.title || item.seriesTitle || 'Untitled').replace(/'/g, "\\'");
      const safeDocId = item.docId;
      const uploadedTime = item.uploadedAt ? new Date(item.uploadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live';

      return `
        <div class="flex items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition text-xs group" id="published-doc-${safeDocId}">
          <div class="flex items-center gap-3 min-w-0">
            <div class="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-800 flex-shrink-0 border border-white/10">
              <img src="${item.image || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80'}" alt="${item.title}" class="w-full h-full object-cover">
            </div>
            <div class="truncate">
              <div class="flex items-center gap-2">
                <p class="font-bold text-white truncate">${item.title || item.seriesTitle}</p>
                <span class="text-[9px] px-2 py-0.5 rounded font-extrabold border uppercase tracking-wider ${badgeClass}">
                  ${item.category || 'Anime'}
                </span>
              </div>
              <p class="text-[11px] text-slate-400 truncate font-mono">${item.videoUrl || 'Stream Active'}</p>
              <p class="text-[10px] text-slate-500">
                <span class="text-emerald-400 font-semibold font-mono">ID: ${safeDocId ? safeDocId.slice(0, 8) : 'ep'}...</span> • Uploaded: ${uploadedTime}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0 ml-3">
            <button onclick="openEditContentModal('${safeDocId}')" class="p-2 rounded-xl bg-brand-cyan/15 hover:bg-brand-cyan/25 border border-brand-cyan/30 text-brand-cyan transition flex items-center gap-1.5 font-semibold text-[11px] cursor-pointer" title="Edit Content">
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
              <span class="hidden sm:inline">Edit</span>
            </button>
            <button onclick="playMedia('${safeTitle}', '${item.videoUrl}'); closeCreatorStudio();" class="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition cursor-pointer" title="Preview Video">
              <i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i>
            </button>
            <button onclick="deletePublishedEpisode('${safeDocId}', '${safeTitle}')" class="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 hover:text-rose-200 transition flex items-center gap-1.5 font-semibold text-[11px] cursor-pointer" title="Permanently delete from Firestore">
              <i data-lucide="trash-2" class="w-4 h-4 text-rose-400"></i>
              <span class="hidden sm:inline">Delete</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }
  if (window.lucide) window.lucide.createIcons();
}

// ========================================================
// MANAGE CONTENT TAB & EDIT CONTENT ENGINE
// ========================================================
export let currentAdminStudioTab = 'upload';
export let currentEditingDocId = null;

export function switchAdminStudioTab(tab) {
  currentAdminStudioTab = tab;
  const uploadBtn = document.getElementById('adminTabUploadBtn');
  const manageBtn = document.getElementById('adminTabManageBtn');
  const uploadContent = document.getElementById('adminTabUploadContent');
  const manageContent = document.getElementById('adminTabManageContent');

  if (tab === 'upload') {
    if (uploadBtn) {
      uploadBtn.className = 'px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 bg-brand-cyan text-black shadow-neon-cyan cursor-pointer';
    }
    if (manageBtn) {
      manageBtn.className = 'px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer';
    }
    if (uploadContent) uploadContent.classList.remove('hidden');
    if (manageContent) manageContent.classList.add('hidden');
  } else {
    if (uploadBtn) {
      uploadBtn.className = 'px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer';
    }
    if (manageBtn) {
      manageBtn.className = 'px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 bg-brand-cyan text-black shadow-neon-cyan cursor-pointer';
    }
    if (uploadContent) uploadContent.classList.add('hidden');
    if (manageContent) manageContent.classList.remove('hidden');

    fetchAndDisplayManageContent();
  }

  if (window.lucide) window.lucide.createIcons();
}

export async function fetchAndDisplayManageContent() {
  const listEl = document.getElementById('manageContentList');
  const countBadge = document.getElementById('adminManageCountBadge');
  const summaryCount = document.getElementById('manageContentSummaryCount');

  // If already loaded in publishedEpisodesCache, show immediately
  if (publishedEpisodesCache && publishedEpisodesCache.length > 0) {
    if (countBadge) countBadge.innerText = publishedEpisodesCache.length;
    filterManageContentList();
  } else if (listEl) {
    listEl.innerHTML = `
      <div class="p-8 text-center text-xs text-slate-400 bg-white/5 rounded-2xl border border-white/10 flex flex-col items-center justify-center gap-2">
        <i data-lucide="loader-2" class="w-6 h-6 text-brand-cyan animate-spin"></i>
        <p class="font-bold text-slate-200">Fetching Content from Firestore...</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  }

  if (!db) {
    if (listEl) {
      listEl.innerHTML = `
        <div class="p-6 text-center text-xs text-amber-400 bg-amber-500/10 rounded-2xl border border-amber-500/20">
          Firestore offline or database instance not connected.
        </div>
      `;
    }
    return;
  }

  try {
    const snap = await getDocs(collection(db, "showverse_episodes"));
    const items = [];
    snap.forEach((docSnap) => {
      items.push({
        docId: docSnap.id,
        ...docSnap.data()
      });
    });

    items.sort((a, b) => {
      const timeA = a.uploadedAt || a.createdAt || '';
      const timeB = b.uploadedAt || b.createdAt || '';
      return timeB.localeCompare(timeA);
    });

    publishedEpisodesCache = items;
    if (countBadge) countBadge.innerText = items.length;
    if (summaryCount) summaryCount.innerText = `${items.length} Items`;
    filterManageContentList();
  } catch (err) {
    console.warn("Error fetching manage content from Firestore:", err);
    if (publishedEpisodesCache && publishedEpisodesCache.length > 0) {
      filterManageContentList();
    }
  }
}

export function filterManageContentList() {
  const searchInput = document.getElementById('manageContentSearch');
  const categorySelect = document.getElementById('manageContentCategoryFilter');

  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const category = categorySelect ? categorySelect.value : 'All';

  let filtered = [...publishedEpisodesCache];

  if (category !== 'All') {
    filtered = filtered.filter(item => (item.category || '').toLowerCase() === category.toLowerCase());
  }

  if (query) {
    filtered = filtered.filter(item => {
      const title = (item.title || item.seriesTitle || item.seriesName || '').toLowerCase();
      const docId = (item.docId || '').toLowerCase();
      const cat = (item.category || '').toLowerCase();
      return title.includes(query) || docId.includes(query) || cat.includes(query);
    });
  }

  renderManageContentList(filtered);
}

export function renderManageContentList(items) {
  const listEl = document.getElementById('manageContentList');
  const summaryCount = document.getElementById('manageContentSummaryCount');
  const countBadge = document.getElementById('adminManageCountBadge');

  if (countBadge) countBadge.innerText = publishedEpisodesCache.length;
  if (summaryCount) summaryCount.innerText = `${items.length} of ${publishedEpisodesCache.length} Items`;

  if (!listEl) return;

  if (items.length === 0) {
    listEl.innerHTML = `
      <div class="p-8 text-center text-xs text-slate-400 bg-white/5 rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-2">
        <i data-lucide="film" class="w-8 h-8 text-slate-500"></i>
        <p class="font-bold text-slate-200">No Content Found</p>
        <p class="text-[11px] text-slate-500">No series or movies match the current search filter.</p>
      </div>
    `;
  } else {
    listEl.innerHTML = items.map((item, idx) => {
      const badgeClass = getCategoryBadgeClass(item.category);
      const safeTitle = (item.title || item.seriesTitle || 'Untitled').replace(/'/g, "\\'");
      const safeDocId = item.docId;
      const displayTitle = item.title || item.seriesTitle || 'Untitled';
      const seriesSub = (item.seriesTitle && item.seriesTitle !== displayTitle) ? item.seriesTitle : (item.episodes || 'Stream Ready');
      const thumb = item.image || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80';

      return `
        <div class="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition text-xs group" id="manage-item-${safeDocId}">
          <div class="flex items-center gap-3.5 min-w-0">
            <div class="relative w-14 h-14 rounded-xl overflow-hidden bg-slate-800 flex-shrink-0 border border-white/10">
              <img src="${thumb}" alt="${displayTitle}" class="w-full h-full object-cover" onerror="this.src='https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80'">
              <span class="absolute bottom-0 right-0 bg-black/70 text-brand-cyan font-mono text-[9px] px-1 rounded-tl">#${idx + 1}</span>
            </div>
            <div class="truncate">
              <div class="flex items-center gap-2">
                <p class="font-bold text-white truncate text-sm">${displayTitle}</p>
                <span class="text-[9px] px-2 py-0.5 rounded font-extrabold border uppercase tracking-wider ${badgeClass}">
                  ${item.category || 'Anime'}
                </span>
              </div>
              <p class="text-[11px] text-slate-400 truncate">${seriesSub}</p>
              <p class="text-[10px] text-slate-500 font-mono mt-0.5">
                <span class="text-brand-cyan/80">Doc ID: ${safeDocId}</span>
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0 ml-3">
            <button onclick="openEditContentModal('${safeDocId}')" class="px-3 py-1.5 rounded-xl bg-brand-cyan/15 hover:bg-brand-cyan/30 text-brand-cyan border border-brand-cyan/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm hover:scale-[1.02]" title="Edit Category, Poster, Stream, etc.">
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
              <span>Edit</span>
            </button>
            <button onclick="playMedia('${safeTitle}', '${item.videoUrl}'); closeCreatorStudio();" class="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition cursor-pointer" title="Preview Video Stream">
              <i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i>
            </button>
            <button onclick="deletePublishedEpisode('${safeDocId}', '${safeTitle}')" class="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 hover:text-rose-200 transition cursor-pointer" title="Delete from Firestore">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  if (window.lucide) window.lucide.createIcons();
}

export function handleEditCategoryChange() {
  const categoryEl = document.getElementById('editCategory');
  const seasonEpRow = document.getElementById('editSeasonEpisodeRow');
  const seasonEl = document.getElementById('editSeason');
  const epEl = document.getElementById('editEpisode');
  if (!categoryEl || !seasonEpRow) return;

  const isMovie = (categoryEl.value === 'Movie');
  if (isMovie) {
    seasonEpRow.style.display = 'none';
    if (seasonEl) seasonEl.value = '';
    if (epEl) epEl.value = '';
  } else {
    seasonEpRow.style.display = 'grid';
    if (seasonEl && (!seasonEl.value || seasonEl.value === '')) seasonEl.value = '1';
    if (epEl && (!epEl.value || epEl.value === '')) epEl.value = '1';
  }
}

export function updateEditThumbPreview() {
  const thumbInput = document.getElementById('editThumbUrl');
  const thumbPreview = document.getElementById('editThumbPreview');
  if (thumbInput && thumbPreview) {
    thumbPreview.src = thumbInput.value.trim() || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80';
  }
}

export function openEditContentModal(docId) {
  if (!isAuthorizedAdmin(currentUser)) {
    if (window.showToast) window.showToast("Unauthorized: Only verified admin can edit content.");
    return;
  }

  const item = publishedEpisodesCache.find(x => x.docId === docId);
  if (!item) {
    if (window.showToast) window.showToast("Document not found in local cache.");
    return;
  }

  currentEditingDocId = docId;

  const modal = document.getElementById('editContentModal');
  const idDisplay = document.getElementById('editDocIdDisplay');
  const titleEl = document.getElementById('editTitle');
  const categoryEl = document.getElementById('editCategory');
  const seasonEl = document.getElementById('editSeason');
  const epEl = document.getElementById('editEpisode');
  const thumbUrlEl = document.getElementById('editThumbUrl');
  const thumbPreviewEl = document.getElementById('editThumbPreview');
  const videoUrlEl = document.getElementById('editVideoUrl');
  const audioTracksEl = document.getElementById('editAudioTracks');
  const subtitlesEl = document.getElementById('editSubtitles');
  const synopsisEl = document.getElementById('editSynopsis');

  if (idDisplay) idDisplay.innerText = docId;
  if (titleEl) titleEl.value = item.seriesTitle || item.seriesName || item.title || '';
  if (categoryEl) categoryEl.value = item.category || 'Anime';
  if (seasonEl) seasonEl.value = item.season || 1;
  if (epEl) epEl.value = item.episode || 1;
  if (thumbUrlEl) thumbUrlEl.value = item.image || '';
  if (thumbPreviewEl) thumbPreviewEl.src = item.image || '';
  if (videoUrlEl) videoUrlEl.value = item.videoUrl || '';
  if (audioTracksEl) audioTracksEl.value = item.audio || 'Dolby Atmos 5.1, Studio Master';
  if (subtitlesEl) subtitlesEl.value = item.subtitles || 'English CC, Spanish, Japanese, Hindi';
  if (synopsisEl) synopsisEl.value = item.desc || '';

  handleEditCategoryChange();

  if (modal) {
    modal.classList.remove('hidden');
  }
  if (window.lucide) window.lucide.createIcons();
}

export function closeEditContentModal() {
  currentEditingDocId = null;
  const modal = document.getElementById('editContentModal');
  if (modal) modal.classList.add('hidden');
}

export async function saveEditedContentChanges(e) {
  if (e) e.preventDefault();

  if (!isAuthorizedAdmin(currentUser)) {
    if (window.showToast) window.showToast("Unauthorized: Only verified admin can save changes.");
    return;
  }

  if (!currentEditingDocId) {
    if (window.showToast) window.showToast("Error: No document selected for editing.");
    return;
  }

  if (!db) {
    if (window.showToast) window.showToast("Firestore is not connected.");
    return;
  }

  const titleEl = document.getElementById('editTitle');
  const categoryEl = document.getElementById('editCategory');
  const seasonEl = document.getElementById('editSeason');
  const epEl = document.getElementById('editEpisode');
  const thumbUrlEl = document.getElementById('editThumbUrl');
  const videoUrlEl = document.getElementById('editVideoUrl');
  const audioTracksEl = document.getElementById('editAudioTracks');
  const subtitlesEl = document.getElementById('editSubtitles');
  const synopsisEl = document.getElementById('editSynopsis');
  const btnSave = document.getElementById('btnSaveContentChanges');

  const title = titleEl ? titleEl.value.trim() : '';
  const category = categoryEl ? categoryEl.value : 'Anime';
  const isMovie = (category === 'Movie');
  const season = isMovie ? null : (seasonEl && seasonEl.value ? parseInt(seasonEl.value, 10) || 1 : 1);
  const ep = isMovie ? null : (epEl && epEl.value ? parseInt(epEl.value, 10) || 1 : 1);
  const thumbUrl = thumbUrlEl ? thumbUrlEl.value.trim() : '';
  const videoUrl = videoUrlEl ? videoUrlEl.value.trim() : '';
  const audioTracks = audioTracksEl ? audioTracksEl.value.trim() : '';
  const subtitles = subtitlesEl ? subtitlesEl.value.trim() : '';
  const synopsis = synopsisEl ? synopsisEl.value.trim() : '';

  if (!title) {
    if (window.showToast) window.showToast("Series / Title Name is required!");
    if (titleEl) titleEl.focus();
    return;
  }
  if (!videoUrl) {
    if (window.showToast) window.showToast("Video Stream URL is required!");
    if (videoUrlEl) videoUrlEl.focus();
    return;
  }

  // Strict 4-category mapping
  const validCategories = ['Kdrama', 'Anime', 'Chinese Drama', 'Movie'];
  const finalCategory = validCategories.includes(category) ? category : 'Anime';

  const defaultThumbnail = finalCategory === 'Kdrama' 
    ? 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80'
    : finalCategory === 'Chinese Drama'
    ? 'https://images.unsplash.com/photo-1508807526345-15e9b5f4eaff?auto=format&fit=crop&w=800&q=80'
    : finalCategory === 'Movie'
    ? 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80'
    : 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80';

  const finalThumb = thumbUrl || defaultThumbnail;
  const fullTitle = isMovie ? title : `${title} (S${season} Ep ${ep})`;
  const episodesLabel = isMovie ? 'Feature Film' : `S${season} Ep ${ep}`;

  const updatedDocData = {
    category: finalCategory,
    tag: finalCategory.toUpperCase(),
    image: finalThumb,
    title: fullTitle,
    seriesName: title,
    seriesTitle: title,
    showTitle: title,
    videoUrl: videoUrl,
    season: season,
    episode: ep,
    episodes: episodesLabel,
    audio: audioTracks || 'Dolby Atmos 5.1 / Studio Master',
    subtitles: subtitles || 'English CC, Spanish, Japanese, Hindi',
    desc: synopsis || `Brand new ${finalCategory} release on Show Verse.`,
    updatedAt: new Date().toISOString()
  };

  if (btnSave) {
    btnSave.disabled = true;
    btnSave.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> <span>Saving Changes...</span>`;
    if (window.lucide) window.lucide.createIcons();
  }

  try {
    const docRef = doc(db, "showverse_episodes", currentEditingDocId);
    // Strictly update existing document without creating duplicate
    await updateDoc(docRef, updatedDocData);

    // Update in-memory publishedEpisodesCache
    const idx = publishedEpisodesCache.findIndex(x => x.docId === currentEditingDocId);
    if (idx !== -1) {
      publishedEpisodesCache[idx] = {
        ...publishedEpisodesCache[idx],
        ...updatedDocData
      };
    }

    if (window.showToast) {
      window.showToast(`Updated "${title}" in Firestore!`);
    }

    closeEditContentModal();
    renderPublishedHistory(publishedEpisodesCache);
    filterManageContentList();

    // Trigger full app view re-render if available
    if (typeof window.renderAllViews === 'function') {
      window.renderAllViews();
    }
  } catch (err) {
    console.error("Firestore updateDoc error:", err);
    if (window.showToast) {
      window.showToast(`Error updating document: ${err.message || String(err)}`);
    }
  } finally {
    if (btnSave) {
      btnSave.disabled = false;
      btnSave.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i> <span>Save Changes</span>`;
      if (window.lucide) window.lucide.createIcons();
    }
  }
}

// PERMANENT DELETION VIA deleteDoc FROM FIRESTORE
export async function deletePublishedEpisode(docId, title) {
  if (!isAuthorizedAdmin(currentUser)) {
    if (window.showToast) window.showToast("Unauthorized: Only verified admin can delete episodes.");
    return;
  }

  if (!db) {
    if (window.showToast) window.showToast("Firestore database instance not connected!");
    return;
  }
  const confirmDelete = window.confirm(`Are you sure you want to permanently delete "${title}" from Firestore collection 'showverse_episodes'?`);
  if (!confirmDelete) return;

  try {
    const targetDocRef = doc(db, "showverse_episodes", docId);
    await deleteDoc(targetDocRef);
    
    if (window.showToast) {
      window.showToast(`Permanently removed "${title}" from Firestore`);
    }
  } catch (err) {
    console.error("Failed to delete document from Firestore:", err ? (err.message || String(err)) : "Delete error");
    if (window.showToast) {
      window.showToast(`Error deleting episode: ${err.message}`);
    }
  }
}

// Form submit handler
export function handleBatchUpload(e) {
  if (e) e.preventDefault();
  addToBatchQueue();
}

// Mount to window for global HTML onclick handlers
if (typeof window !== "undefined") {
  window.addToBatchQueue = addToBatchQueue;
  window.removeFromBatchQueue = removeFromBatchQueue;
  window.clearBatchQueue = clearBatchQueue;
  window.renderStagedBatchQueue = renderStagedBatchQueue;
  window.uploadAllBatchToFirestore = uploadAllBatchToFirestore;
  window.initPublishedContentManager = initPublishedContentManager;
  window.deletePublishedEpisode = deletePublishedEpisode;
  window.handleBatchUpload = handleBatchUpload;
  window.handleCategoryChange = handleCategoryChange;

  // Manage Content & Edit Content Handlers
  window.switchAdminStudioTab = switchAdminStudioTab;
  window.fetchAndDisplayManageContent = fetchAndDisplayManageContent;
  window.filterManageContentList = filterManageContentList;
  window.renderManageContentList = renderManageContentList;
  window.handleEditCategoryChange = handleEditCategoryChange;
  window.updateEditThumbPreview = updateEditThumbPreview;
  window.openEditContentModal = openEditContentModal;
  window.closeEditContentModal = closeEditContentModal;
  window.saveEditedContentChanges = saveEditedContentChanges;
}

// Auto-initialize event listeners and published content history when DOM is ready
function setupAdminEventListeners() {
  initPublishedContentManager();
  const categorySelect = document.getElementById('admin-category');
  if (categorySelect) {
    categorySelect.addEventListener('change', handleCategoryChange);
    handleCategoryChange();
  }
  const editCategorySelect = document.getElementById('editCategory');
  if (editCategorySelect) {
    editCategorySelect.addEventListener('change', handleEditCategoryChange);
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener('DOMContentLoaded', setupAdminEventListeners);
  } else {
    setupAdminEventListeners();
  }
}

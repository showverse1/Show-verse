// init.js - Core initialization, Profile (Me), Continue Watching & Modal Bindings
import { auth } from "./firebase.js";
import { 
  currentUser, 
  isAuthorizedAdmin, 
  SECRET_ADMIN_EMAIL, 
  updateAuthUI, 
  triggerGoogleSignIn, 
  handleEmailLogin,
  handleEmailSignUp,
  handleSendOtp,
  handleVerifyOtp,
  handleSignOut, 
  openCreatorStudio, 
  closeCreatorStudio 
} from "./auth.js";

export { 
  currentUser, 
  isAuthorizedAdmin, 
  SECRET_ADMIN_EMAIL, 
  triggerGoogleSignIn, 
  handleEmailLogin,
  handleEmailSignUp,
  handleSendOtp,
  handleVerifyOtp,
  handleSignOut, 
  openCreatorStudio, 
  closeCreatorStudio 
};

let currentPlayingMedia = null;
const CW_STORAGE_KEY = 'showverse_continue_watching';
const WATCH_HISTORY_KEY = 'showverse_watch_history_records';

export function getContinueWatchingList() {
  try {
    const raw = localStorage.getItem(CW_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function saveContinueWatchingProgress(current, duration) {
  if (!currentPlayingMedia || !currentPlayingMedia.title) return;
  if (!Number.isFinite(current) || current < 1) return;
  const dur = Number.isFinite(duration) && duration > 0 ? duration : (Number(currentPlayingMedia.duration) || 0);
  const progressPct = dur > 0 ? Math.min(100, Math.round((current / dur) * 100)) : 0;
  const mediaTitle = String(currentPlayingMedia.title);

  let list = getContinueWatchingList();
  list = list.filter(item => String(item.title) !== mediaTitle);

  if (progressPct < 95) {
    list.unshift({
      id: String(currentPlayingMedia.id || 'cw_' + Date.now()),
      title: mediaTitle,
      videoUrl: String(currentPlayingMedia.videoUrl || ''),
      image: currentPlayingMedia.image || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80',
      category: currentPlayingMedia.category || 'Anime',
      currentTime: Math.floor(current),
      duration: Math.floor(dur),
      progressPct: progressPct,
      savedAt: Date.now()
    });
  }

  recordWatchHistory({
    id: currentPlayingMedia.id,
    title: mediaTitle,
    videoUrl: currentPlayingMedia.videoUrl,
    image: currentPlayingMedia.image,
    category: currentPlayingMedia.category,
    currentTime: Math.floor(current)
  });

  try {
    localStorage.setItem(CW_STORAGE_KEY, JSON.stringify(list.slice(0, 12)));
  } catch (e) {}

  renderContinueWatching();
}

export function renderContinueWatching() {
  const container = document.getElementById('continueWatchingRow');
  const counter = document.getElementById('continueWatchingCount');
  if (!container) return;

  const items = getContinueWatchingList();
  if (counter) counter.innerText = `${items.length} In Progress`;

  if (items.length === 0) {
    container.innerHTML = `
      <div class="flex-shrink-0 w-80 p-6 text-center glass-card rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-2">
        <i data-lucide="play-circle" class="w-7 h-7 text-slate-500"></i>
        <p class="font-bold text-xs text-slate-300">No In-Progress Videos</p>
        <p class="text-[11px] text-slate-400">Play any title to resume playback right here automatically.</p>
      </div>
    `;
  } else {
    container.innerHTML = items.map((m) => {
      const safeTitle = (m.title || 'Untitled').replace(/'/g, "\\'");
      const safeUrl = (m.videoUrl || '').replace(/'/g, "\\'");
      const safeImage = (m.image || '').replace(/'/g, "\\'");
      const safeCat = (m.category || 'Anime').replace(/'/g, "\\'");
      const catColor = m.category === 'Kdrama' ? 'bg-rose-500 text-white' :
        m.category === 'Anime' ? 'bg-brand-cyan text-black' :
        m.category === 'Chinese Drama' ? 'bg-amber-400 text-black' : 'bg-purple-500 text-white';

      return `
        <div class="flex-shrink-0 w-64 sm:w-72 snap-start glass-card rounded-2xl overflow-hidden group border border-white/10 hover:border-brand-cyan/50 transition duration-300">
          <div class="relative aspect-video overflow-hidden bg-slate-900 cursor-pointer" onclick="resumeMedia('${safeTitle}', '${safeUrl}', ${m.currentTime}, '${safeImage}', '${safeCat}')">
            <img src="${m.image}" alt="${m.title}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
            <div class="absolute top-2.5 left-2.5 px-2 py-0.5 rounded text-[10px] font-black uppercase ${catColor}">
              ${m.category}
            </div>
            <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
              <div class="w-11 h-11 rounded-full bg-brand-cyan text-black flex items-center justify-center shadow-neon-cyan transform scale-90 group-hover:scale-100 transition">
                <i data-lucide="play" class="w-4 h-4 fill-black ml-0.5"></i>
              </div>
            </div>
            <div class="absolute bottom-0 left-0 right-0 h-1.5 bg-white/20">
              <div class="h-full bg-gradient-to-r from-brand-cyan to-brand-purple" style="width: ${m.progressPct}%"></div>
            </div>
          </div>
          <div class="p-3 flex items-center justify-between">
            <div class="min-w-0 flex-1 mr-2">
              <h3 class="font-bold text-xs text-white truncate hover:text-brand-cyan cursor-pointer transition" onclick="resumeMedia('${safeTitle}', '${safeUrl}', ${m.currentTime}, '${safeImage}', '${safeCat}')">
                ${m.title}
              </h3>
              <p class="text-[10px] text-slate-400 mt-0.5 flex items-center justify-between">
                <span class="text-brand-cyan font-mono font-semibold">Resume at ${formatTime(m.currentTime)}</span>
                <span class="text-slate-400 font-mono">${m.progressPct}%</span>
              </p>
            </div>
            <button onclick="removeFromContinueWatching('${safeTitle}')" class="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer" title="Dismiss">
              <i data-lucide="x" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }
  if (window.lucide) window.lucide.createIcons();
}

export function getWatchHistory() {
  try {
    const raw = localStorage.getItem(WATCH_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function recordWatchHistory(item) {
  if (!item || !item.title) return;
  let history = getWatchHistory();
  const strTitle = String(item.title);
  history = history.filter(h => String(h.title) !== strTitle);
  history.unshift({
    id: String(item.id || 'wh_' + Date.now()),
    title: strTitle,
    videoUrl: String(item.videoUrl || ''),
    image: item.image || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80',
    category: item.category || 'Anime',
    currentTime: Number(item.currentTime) || 0,
    playedAt: Date.now()
  });
  try {
    localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(history.slice(0, 25)));
  } catch (e) {}
  renderWatchHistory();
}

export function clearWatchHistory() {
  localStorage.removeItem(WATCH_HISTORY_KEY);
  renderWatchHistory();
  showToast("Watch History Cleared");
}

export function removeFromWatchHistory(title, e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  let history = getWatchHistory();
  history = history.filter(h => String(h.title) !== String(title));
  try {
    localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(history));
  } catch (e) {}
  renderWatchHistory();
  showToast("Removed from History");
}

export function renderWatchHistory() {
  const container = document.getElementById('meWatchHistoryList');
  if (!container) return;
  const history = getWatchHistory();
  if (history.length === 0) {
    container.innerHTML = `
      <div class="p-5 text-center bg-white/5 rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-1.5">
        <i data-lucide="film" class="w-6 h-6 text-slate-500"></i>
        <p class="text-xs font-bold text-slate-300">No Watch History Yet</p>
        <p class="text-[11px] text-slate-400">Recently clicked or watched videos will appear here.</p>
      </div>
    `;
  } else {
    container.innerHTML = history.map(item => {
      const safeTitle = (item.title || 'Untitled').replace(/'/g, "\\'");
      const safeUrl = (item.videoUrl || '').replace(/'/g, "\\'");
      const safeImg = (item.image || '').replace(/'/g, "\\'");
      const safeCat = (item.category || 'Anime').replace(/'/g, "\\'");
      const catColor = item.category === 'Kdrama' ? 'text-rose-400 bg-rose-500/10 border-rose-500/30' :
        item.category === 'Anime' ? 'text-brand-cyan bg-brand-cyan/10 border-brand-cyan/30' :
        item.category === 'Chinese Drama' ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' :
        'text-purple-400 bg-purple-500/10 border-purple-500/30';
      const resumeLabel = item.currentTime > 2 ? `Resume at ${formatTime(item.currentTime)}` : 'Watched';

      return `
        <div class="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-brand-cyan/30 transition group cursor-pointer" onclick="if(window.openShowPlayerPage){ openShowPlayerPage('${safeTitle}', 0, ${item.currentTime || 0}); } else { playMedia('${safeTitle}', '${safeUrl}', ${item.currentTime || 0}, { id: '${item.id || ''}', image: '${safeImg}', category: '${safeCat}' }); } closeMeModal();">
          <div class="flex items-center gap-3 overflow-hidden min-w-0">
            <div class="relative w-14 h-11 rounded-xl overflow-hidden bg-slate-900 flex-shrink-0">
              <img src="${item.image || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80'}" alt="${item.title}" class="w-full h-full object-cover">
              <div class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                <i data-lucide="play" class="w-3.5 h-3.5 text-brand-cyan fill-brand-cyan"></i>
              </div>
            </div>
            <div class="text-left overflow-hidden min-w-0">
              <h5 class="text-xs font-bold text-white truncate max-w-[200px] sm:max-w-[240px] group-hover:text-brand-cyan transition">${item.title}</h5>
              <div class="flex items-center gap-2 text-[10px] mt-0.5">
                <span class="px-1.5 py-0.2 rounded border font-semibold ${catColor}">${item.category || 'Video'}</span>
                <span class="text-slate-400 font-mono text-[10px]">${resumeLabel}</span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0 pl-2">
            <button onclick="removeFromWatchHistory('${safeTitle}', event)" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer" title="Remove from History">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }
  if (window.lucide) window.lucide.createIcons();
}

export function enforceSecretAdminRule(user) {
  updateAuthUI(user);
}

const video = document.getElementById('mainVideo');
let activeHls = null;

if (video) {
  video.addEventListener('error', () => {
    console.warn("Stream playback notice:", video.src);
    if (window.showToast) window.showToast("Stream could not be played. Check stream URL in Creator Studio.");
  });
}

export function playMedia(title, url, resumeTime = 0, meta = {}) {
  let targetUrl = typeof url === 'string' && url ? url.trim() : '';
  const strTitle = typeof title === 'string' ? title : 'Playing Media';
  const safeMeta = (meta && typeof meta === 'object') ? meta : {};

  if (!targetUrl) {
    if (window.showToast) window.showToast(`No stream URL configured for "${strTitle}".`);
    return;
  }

  currentPlayingMedia = {
    id: String(safeMeta.id || 'media_' + Date.now()),
    title: strTitle,
    videoUrl: targetUrl,
    image: typeof safeMeta.image === 'string' ? safeMeta.image : '',
    category: typeof safeMeta.category === 'string' ? safeMeta.category : 'Anime',
    duration: 0
  };

  recordWatchHistory({
    id: currentPlayingMedia.id,
    title: currentPlayingMedia.title,
    videoUrl: currentPlayingMedia.videoUrl,
    image: currentPlayingMedia.image,
    category: currentPlayingMedia.category,
    currentTime: Number(resumeTime) || 0
  });

  const modal = document.getElementById('playerModal');
  const titleEl = document.getElementById('playerTitle');
  if (titleEl) titleEl.innerText = title;
  if (modal) modal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');

  const mainVid = document.getElementById('mainVideo');
  if (!mainVid) return;

  let seekTo = Number(resumeTime) || 0;
  if (seekTo <= 0) {
    const cwList = getContinueWatchingList();
    const saved = cwList.find(x => x.title === title);
    if (saved && saved.currentTime > 2) seekTo = saved.currentTime;
  }

  mainVid.src = targetUrl;
  mainVid.load();

  const applyResume = () => {
    if (seekTo > 0 && Number.isFinite(seekTo) && mainVid.duration && seekTo < mainVid.duration) {
      mainVid.currentTime = seekTo;
      showToast(`Resumed from ${formatTime(seekTo)}`);
    }
  };
  mainVid.addEventListener('loadedmetadata', applyResume, { once: true });

  mainVid.play().then(() => {
    if (window.updatePlayIcon) window.updatePlayIcon(true);
  }).catch(() => {
    if (window.updatePlayIcon) window.updatePlayIcon(false);
  });

  initVideoListeners(mainVid);
}

export function closePlayer() {
  const modal = document.getElementById('playerModal');
  const mainVid = document.getElementById('mainVideo');
  if (mainVid) {
    saveContinueWatchingProgress(mainVid.currentTime, mainVid.duration);
    mainVid.pause();
  }
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  }
  if (window.unlockScreen) window.unlockScreen();
  if (modal) modal.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
}

function initVideoListeners(vid) {
  let lastSavedSecond = 0;
  vid.ontimeupdate = () => {
    const dur = vid.duration;
    const cur = vid.currentTime;
    if (!Number.isFinite(dur) || dur <= 0 || !Number.isFinite(cur)) return;
    const pct = Math.max(0, Math.min(100, (cur / dur) * 100));
    const progressBar = document.getElementById('progressBar');
    const timeDisplay = document.getElementById('timeDisplay');
    if (progressBar) progressBar.style.width = `${pct}%`;
    if (timeDisplay) timeDisplay.innerText = `${formatTime(cur)} / ${formatTime(dur)}`;

    const curSec = Math.floor(cur);
    if (curSec - lastSavedSecond >= 3) {
      lastSavedSecond = curSec;
      saveContinueWatchingProgress(cur, dur);
    }
  };
  vid.onpause = () => {
    saveContinueWatchingProgress(vid.currentTime, vid.duration);
  };
  vid.onended = () => {
    if (window.updatePlayIcon) window.updatePlayIcon(false);
    saveContinueWatchingProgress(vid.currentTime, vid.duration);
    showToast("Episode finished!");
  };
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

export function openMeModal() {
  const el = document.getElementById('meModal');
  if (el) el.classList.remove('hidden');
  updateAuthUI(currentUser);
  if (currentUser) {
    renderWatchHistory();
  }
  if (window.lucide) window.lucide.createIcons();
}

export function closeMeModal() {
  const el = document.getElementById('meModal');
  if (el) el.classList.add('hidden');
}

export function openDownloadsModal() {
  const modal = document.getElementById('downloadsModal');
  if (modal) modal.classList.remove('hidden');
}

export function closeDownloadsModal() {
  const modal = document.getElementById('downloadsModal');
  if (modal) modal.classList.add('hidden');
}

export function simulateLocalScan() {
  const btn = document.getElementById('scanBtn');
  const results = document.getElementById('localScanResults');
  if (btn) btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Scanning Storage...`;
  if (window.lucide) window.lucide.createIcons();
  setTimeout(() => {
    if (btn) btn.innerHTML = `<i data-lucide="check" class="w-4 h-4 text-emerald-400"></i> Scan Complete`;
    if (results) {
      results.classList.remove('hidden');
      results.innerHTML = `
        <div class="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-xs">
          <div>
            <p class="font-bold text-white">sample_video_1080p.mkv</p>
            <p class="text-[10px] text-slate-400">Found in /Movies/ • 1.4 GB</p>
          </div>
          <button onclick="playMedia('Local: Sample Video', 'https://vjs.zencdn.net/v/oceans.mp4'); closeDownloadsModal();" class="px-2.5 py-1 bg-brand-cyan text-black font-bold text-[11px] rounded-lg cursor-pointer">Play Local</button>
        </div>
      `;
    }
    if (window.lucide) window.lucide.createIcons();
    showToast("Discovered 1 local media file");
  }, 1000);
}

export function openSearchModal() {
  const modal = document.getElementById('searchModal');
  if (modal) modal.classList.remove('hidden');
  const input = document.getElementById('searchInput');
  if (input) input.focus();
  handleSearchQuery('');
}

export function closeSearchModal() {
  const modal = document.getElementById('searchModal');
  if (modal) modal.classList.add('hidden');
}

export function setSearchTerm(term) {
  const input = document.getElementById('searchInput');
  if (input) input.value = term;
  handleSearchQuery(term);
}

export function handleSearchQuery(query) {
  const container = document.getElementById('searchResults');
  if (!container) return;
  const catalog = (window.groupedShows && window.groupedShows.length > 0) 
    ? window.groupedShows 
    : (window.firestoreEpisodes || []);
  const q = (query || '').toLowerCase().trim();
  const filtered = catalog.filter(m => {
    const t = (m.title || m.seriesTitle || '').toLowerCase();
    const c = (m.category || '').toLowerCase();
    return !q || t.includes(q) || c.includes(q);
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="p-6 text-center text-xs text-slate-400">
        ${catalog.length === 0 ? 'No titles published yet.' : `No titles found matching "${query}".`}
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(m => {
    const safeTitle = (m.title || m.seriesTitle || 'Untitled').replace(/'/g, "\\'");
    const epCount = m.episodes ? (Array.isArray(m.episodes) ? m.episodes.length : m.episodes) : 'Stream Ready';
    const epLabel = typeof epCount === 'number' ? `${epCount} Episodes` : epCount;
    return `
      <div class="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition cursor-pointer" onclick="if(window.openShowPlayerPage){ openShowPlayerPage('${safeTitle}'); } closeSearchModal();">
        <div class="flex items-center gap-3">
          <img src="${m.image || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80'}" class="w-14 h-14 rounded-xl object-cover">
          <div>
            <h4 class="font-bold text-xs text-white">${m.title || m.seriesTitle}</h4>
            <p class="text-[11px] text-slate-400">${(m.category || 'Anime').toUpperCase()} • <span class="text-brand-cyan">${epLabel}</span> • ★ ${m.rating || '9.9'}</p>
          </div>
        </div>
        <button class="px-3 py-1.5 rounded-xl bg-brand-cyan text-black font-extrabold text-xs shadow-neon-cyan">
          Watch
        </button>
      </div>
    `;
  }).join('');
  if (window.lucide) window.lucide.createIcons();
}

export function showToast(msg) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  if (!toast || !toastMsg) return;
  toastMsg.innerText = msg;
  toast.classList.remove('translate-y-24', 'opacity-0');
  setTimeout(() => {
    toast.classList.add('translate-y-24', 'opacity-0');
  }, 3000);
}

export function toggleHeroMute() {
  showToast("Cinematic Sound FX: Toggled");
}

// Global Exports
if (typeof window !== "undefined") {
  window.getContinueWatchingList = getContinueWatchingList;
  window.saveContinueWatchingProgress = saveContinueWatchingProgress;
  window.renderContinueWatching = renderContinueWatching;
  window.getWatchHistory = getWatchHistory;
  window.recordWatchHistory = recordWatchHistory;
  window.clearWatchHistory = clearWatchHistory;
  window.removeFromWatchHistory = removeFromWatchHistory;
  window.renderWatchHistory = renderWatchHistory;
  window.enforceSecretAdminRule = enforceSecretAdminRule;
  window.playMedia = playMedia;
  window.closePlayer = closePlayer;
  window.openMeModal = openMeModal;
  window.closeMeModal = closeMeModal;
  window.triggerGoogleSignIn = triggerGoogleSignIn;
  window.handleEmailLogin = handleEmailLogin;
  window.handleEmailSignUp = handleEmailSignUp;
  window.handleSendOtp = handleSendOtp;
  window.handleVerifyOtp = handleVerifyOtp;
  window.handleSignOut = handleSignOut;
  window.openCreatorStudio = openCreatorStudio;
  window.closeCreatorStudio = closeCreatorStudio;
  window.openDownloadsModal = openDownloadsModal;
  window.closeDownloadsModal = closeDownloadsModal;
  window.simulateLocalScan = simulateLocalScan;
  window.openSearchModal = openSearchModal;
  window.closeSearchModal = closeSearchModal;
  window.setSearchTerm = setSearchTerm;
  window.handleSearchQuery = handleSearchQuery;
  window.showToast = showToast;
  window.toggleHeroMute = toggleHeroMute;
  window.resumeMedia = (title, url, time, image, category) => {
    if (typeof window.openShowPlayerPage === 'function') {
      window.openShowPlayerPage(title, 0, time);
    } else {
      playMedia(title, url, time, { image, category });
    }
  };
  window.removeFromContinueWatching = (title) => {
    let list = getContinueWatchingList();
    list = list.filter(m => String(m.title) !== String(title));
    try {
      localStorage.setItem(CW_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {}
    renderContinueWatching();
    showToast(`Removed from Continue Watching`);
  };
}

if (typeof document !== "undefined") {
  document.addEventListener('DOMContentLoaded', () => {
    enforceSecretAdminRule(currentUser);
    renderContinueWatching();
    if (window.lucide) window.lucide.createIcons();
    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openSearchModal();
      }
    });
  });
}

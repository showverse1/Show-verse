// ========================================================
// SHOW VERSE - PLYR & HLS.JS VIDEO PLAYER INTEGRATION
// Optimized HLS.js VOD configuration with precise seeking
// ========================================================

let currentHls = null;
let activePlyr = null;
let isAmbientGlowActive = true;

/**
 * Standard Plyr control list
 */
const defaultPlyrControls = [
  'play-large',
  'restart',
  'rewind',
  'play',
  'fast-forward',
  'progress',
  'current-time',
  'duration',
  'mute',
  'volume',
  'captions',
  'settings',
  'pip',
  'fullscreen'
];

/**
 * Destroys any existing Plyr and HLS.js instances cleanly
 */
export function destroyCurrentPlayer() {
  if (activePlyr) {
    try {
      activePlyr.destroy();
    } catch (e) {
      console.warn("Plyr destroy notice:", e);
    }
    activePlyr = null;
    window.activePlyr = null;
  }

  if (currentHls) {
    try {
      currentHls.destroy();
    } catch (e) {
      console.warn("Hls destroy notice:", e);
    }
    currentHls = null;
    window.currentHls = null;
    window.activeHls = null;
    window.mainHls = null;
    window.hls = null;
  }
}

/**
 * Format seconds to MM:SS string
 */
export function formatDuration(seconds) {
  if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

/**
 * Internal helper to instantiate Plyr on a prepared video element
 */
function setupPlyr(videoElement, plyrOptions, resumeTime = 0, options = {}) {
  // Ensure no stale Plyr instance is left on this element
  if (activePlyr) {
    try {
      activePlyr.destroy();
    } catch (e) {}
    activePlyr = null;
  }

  const plyr = new window.Plyr(videoElement, plyrOptions);
  activePlyr = plyr;
  window.activePlyr = plyr;

  // Seamless resume playback handling (only on initial load, never during active seeking)
  const seekTarget = Number(resumeTime) || 0;
  let seekApplied = false;

  const applyResume = () => {
    if (!seekApplied && seekTarget > 0) {
      seekApplied = true;
      try {
        plyr.currentTime = seekTarget;
        if (window.showToast) {
          window.showToast(`Resumed playback at ${formatDuration(seekTarget)}`);
        }
      } catch (e) {
        console.warn("Notice: Plyr resume seek deferred", e);
      }
    }
  };

  if (videoElement.readyState >= 1) {
    applyResume();
  } else {
    plyr.once('loadedmetadata', applyResume);
  }

  // Hook up Continue Watching and Watch History persistence
  let lastSavedSec = 0;
  plyr.on('timeupdate', () => {
    const cur = plyr.currentTime;
    const dur = plyr.duration;
    if (Math.abs(cur - lastSavedSec) >= 3) {
      lastSavedSec = cur;
      if (typeof window.saveContinueWatchingProgress === 'function') {
        window.saveContinueWatchingProgress(cur, dur);
      }
    }
  });

  plyr.on('pause', () => {
    const cur = plyr.currentTime;
    const dur = plyr.duration;
    if (typeof window.saveContinueWatchingProgress === 'function') {
      window.saveContinueWatchingProgress(cur, dur);
    }
  });

  plyr.on('ended', () => {
    const cur = plyr.currentTime;
    const dur = plyr.duration;
    if (typeof window.saveContinueWatchingProgress === 'function') {
      window.saveContinueWatchingProgress(cur, dur);
    }
    if (typeof options.onEnded === 'function') {
      options.onEnded();
    }
  });

  // Autoplay with graceful user-gesture fallback
  const playPromise = plyr.play();
  if (playPromise !== undefined) {
    playPromise.catch(err => {
      console.log("Autoplay waiting for user interaction:", err);
    });
  }

  return plyr;
}

/**
 * Primary Video Loader: Strictly attaches Hls.js engine for all streaming media,
 * preventing native HTML5 player fallback that corrupts m3u8 seeking.
 * 
 * @param {HTMLVideoElement|string} videoTarget - Video element or element ID
 * @param {string} targetUrl - Stream URL (.m3u8 or .mp4)
 * @param {number} resumeTime - Optional timestamp to resume playback
 * @param {Object} options - Callbacks like onEnded
 */
export function loadVideoWithPlyr(videoTarget, targetUrl, resumeTime = 0, options = {}) {
  // 1. Destroy any existing Plyr or HLS instances to prevent buffer leaks
  destroyCurrentPlayer();

  // 2. Resolve the clean video element
  let videoElement = typeof videoTarget === 'string' ? document.getElementById(videoTarget) : videoTarget;
  if (!videoElement) {
    videoElement = document.getElementById('main-video') || document.querySelector('#ytPlayerStage video') || document.querySelector('video');
  }

  if (!videoElement) {
    console.error("loadVideoWithPlyr: video target not found", videoTarget);
    return null;
  }

  // Reset video element cleanly without corrupting the media engine
  videoElement.pause();
  videoElement.removeAttribute('src');
  while (videoElement.firstChild) {
    if (videoElement.firstChild.nodeName === 'SOURCE') {
      videoElement.removeChild(videoElement.firstChild);
    } else {
      break;
    }
  }
  videoElement.load();

  const streamUrl = typeof targetUrl === 'string' ? targetUrl.trim() : '';
  if (!streamUrl) {
    console.warn("loadVideoWithPlyr: Empty streamUrl provided");
    return null;
  }

  // Detect whether target is a direct progressive file (.mp4/.webm) or adaptive stream (.m3u8/hls)
  const isDirectMp4 = /\.(mp4|webm|ogg)(\?.*)?$/i.test(streamUrl);
  const isHlsSupported = !!(window.Hls && window.Hls.isSupported());

  // 3. Strict HLS.js engine path for adaptive streaming
  if (!isDirectMp4 && isHlsSupported) {
    // Aggressive VOD seeking and buffer retention configuration
    const hls = new window.Hls({
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      startFragPrefetch: true,
      enableWorker: true
    });

    currentHls = hls;
    window.currentHls = hls;
    window.activeHls = hls;
    window.mainHls = hls;
    window.hls = hls;

    hls.loadSource(streamUrl);
    hls.attachMedia(videoElement);

    hls.on(window.Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        switch (data.type) {
          case window.Hls.ErrorTypes.NETWORK_ERROR:
            console.warn("HLS network error, recovering...", data);
            hls.startLoad();
            break;
          case window.Hls.ErrorTypes.MEDIA_ERROR:
            console.warn("HLS media error, recovering...", data);
            hls.recoverMediaError();
            break;
          default:
            console.error("Unrecoverable HLS error:", data);
            destroyCurrentPlayer();
            break;
        }
      }
    });

    let plyrSetupDone = false;
    hls.once(window.Hls.Events.MANIFEST_PARSED, () => {
      if (plyrSetupDone) return;
      plyrSetupDone = true;

      const availableQualities = hls.levels.map(l => l.height).filter(q => q > 0);
      const uniqueQualities = Array.from(new Set(availableQualities)).sort((a, b) => b - a);

      const plyrOptions = {
        controls: defaultPlyrControls,
        seekTime: 10,
        keyboard: { focused: true, global: false },
        tooltips: { controls: true, seek: true },
        captions: { active: true, update: true, language: 'en' },
        invertTime: false,
        toggleInvert: false
      };

      if (uniqueQualities.length > 0) {
        plyrOptions.quality = {
          default: uniqueQualities[0],
          options: uniqueQualities,
          forced: true,
          onChange: (newQuality) => {
            hls.levels.forEach((level, levelIndex) => {
              if (level.height === newQuality) {
                hls.currentLevel = levelIndex;
              }
            });
          }
        };
      }

      // Initialize Plyr on the video element attached to Hls.js
      setupPlyr(videoElement, plyrOptions, resumeTime, options);
    });
  } else if (!isHlsSupported && videoElement.canPlayType('application/vnd.apple.mpegurl')) {
    // Legacy Safari Native HLS Fallback (only if HLS.js is unavailable)
    videoElement.src = streamUrl;
    const plyrOptions = {
      controls: defaultPlyrControls,
      seekTime: 10,
      keyboard: { focused: true, global: false },
      tooltips: { controls: true, seek: true },
      captions: { active: true, update: true, language: 'en' },
      invertTime: false,
      toggleInvert: false
    };
    setupPlyr(videoElement, plyrOptions, resumeTime, options);
  } else {
    // Non-HLS standard progressive video (MP4/WebM)
    videoElement.src = streamUrl;
    const plyrOptions = {
      controls: defaultPlyrControls,
      seekTime: 10,
      keyboard: { focused: true, global: false },
      tooltips: { controls: true, seek: true },
      captions: { active: true, update: true, language: 'en' },
      invertTime: false,
      toggleInvert: false
    };
    setupPlyr(videoElement, plyrOptions, resumeTime, options);
  }

  return null;
}

/**
 * Helper to dynamically get the active video element
 */
export function getActiveVideo() {
  return document.querySelector('#ytPlayerStage video') || 
         document.querySelector('#playerModal video') || 
         document.querySelector('video');
}

/**
 * Universal playback controls delegating directly to Plyr
 */
export function togglePlay() {
  if (activePlyr) {
    activePlyr.togglePlay();
  } else {
    const vid = getActiveVideo();
    if (vid) vid.paused ? vid.play() : vid.pause();
  }
}

export function skipTime(seconds) {
  if (activePlyr) {
    const sec = Number(seconds) || 10;
    if (sec > 0) {
      activePlyr.forward(sec);
    } else {
      activePlyr.rewind(Math.abs(sec));
    }
  }
}

export function seekVideo() {
  // Let the native Plyr control bar handle the seek event naturally
}

export function toggleFullscreen() {
  if (activePlyr && activePlyr.fullscreen) {
    activePlyr.fullscreen.toggle();
  } else {
    const stage = document.getElementById('ytPlayerStage') || document.getElementById('playerStage');
    if (stage) {
      if (!document.fullscreenElement) {
        stage.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
  }
}

export function toggleMute() {
  if (activePlyr) {
    activePlyr.muted = !activePlyr.muted;
  }
}

export function changeVolume(val) {
  if (activePlyr) {
    activePlyr.volume = Number(val);
  }
}

export function toggleAmbientLighting() {
  toggleYtAmbient();
}

export function toggleYtAmbient() {
  isAmbientGlowActive = !isAmbientGlowActive;
  const stages = [document.getElementById('ytPlayerStage'), document.getElementById('playerStage')];
  stages.forEach(stage => {
    if (!stage) return;
    if (isAmbientGlowActive) {
      stage.classList.add('yt-player-glow', 'ambient-glow-box');
    } else {
      stage.classList.remove('yt-player-glow', 'ambient-glow-box');
    }
  });

  const btns = [document.getElementById('ytAmbientBtn'), document.getElementById('ambientToggleBtn')];
  btns.forEach(btn => {
    if (!btn) return;
    btn.classList.toggle('text-brand-cyan', isAmbientGlowActive);
    btn.classList.toggle('text-slate-400', !isAmbientGlowActive);
  });

  if (window.showToast) {
    window.showToast(isAmbientGlowActive ? "Ambient Glow Enabled" : "Ambient Glow Disabled");
  }
}

export function togglePiP() {
  if (activePlyr && activePlyr.pip) {
    activePlyr.pip = !activePlyr.pip;
  }
}

// Stubs for backward compatibility - never manually mutate video.currentTime
export function toggleAudioSubModal() {}
export function toggleQualityModal() {}
export function selectQuality() {}
export function setSubtitle() {}
export function setAudioTrack() {}
export function toggleLockScreen() {}
export function unlockScreen() {}
export function handlePlayerScreenTap() {}
export function handleYtPlayerTap() {}
export function triggerYtSkipAnimation() {}
export function executeSafeSkip(sec) { skipTime(sec); }
export function executeSafeSeek() { /* Native Plyr control bar handles seeking */ }
export function executeSafeTimelineSeek() {}
export function initMainPlayerControlsAutoHide() {}
export function wipeAndAttachMainPlayerSeekSkipListeners() {}
export function rebindMasterPlayerControls() {}
export function setupMainPlayerDelegatedEvents() {}
export function attachPlayerEvents() {}

// Expose globally on window for all other modules and inline HTML events
window.loadVideoWithPlyr = loadVideoWithPlyr;
window.destroyCurrentPlayer = destroyCurrentPlayer;
window.activePlyr = activePlyr;
window.currentHls = currentHls;
window.activeHls = currentHls;
window.togglePlay = togglePlay;
window.skipTime = skipTime;
window.seekVideo = seekVideo;
window.toggleFullscreen = toggleFullscreen;
window.toggleMute = toggleMute;
window.changeVolume = changeVolume;
window.toggleAmbientLighting = toggleAmbientLighting;
window.toggleYtAmbient = toggleYtAmbient;
window.togglePiP = togglePiP;
window.getActiveVideo = getActiveVideo;
window.executeSafeSkip = executeSafeSkip;
window.executeSafeSeek = executeSafeSeek;
window.executeSafeTimelineSeek = executeSafeTimelineSeek;
window.initMainPlayerControlsAutoHide = initMainPlayerControlsAutoHide;
window.wipeAndAttachMainPlayerSeekSkipListeners = wipeAndAttachMainPlayerSeekSkipListeners;
window.rebindMasterPlayerControls = rebindMasterPlayerControls;

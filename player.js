// ========================================================
// SHOW VERSE - MASTER VIDEO PLAYER MODULE (PLYR & HLS.JS)
// Robust Episode Switching, Direct video.src Updating,
// Comprehensive Error Listeners & Autoplay Catch Handling
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
 * Show visible error overlay on the player screen
 */
export function showPlayerError(videoTarget, title = "Error loading video", desc = "The video could not be loaded or network error occurred.") {
  console.error(`[ShowVerse Player] showPlayerError called: "${title}" - "${desc}"`);
  
  const targetEl = typeof videoTarget === 'string' ? document.getElementById(videoTarget) : videoTarget;
  const stage = (targetEl && targetEl.closest) ? 
    (targetEl.closest('#ytPlayerStage') || targetEl.closest('#playerStage') || targetEl.closest('.plyr')) : null;

  const overlays = stage ? 
    stage.querySelectorAll('.player-error-overlay') : 
    document.querySelectorAll('.player-error-overlay');

  overlays.forEach(overlay => {
    overlay.classList.remove('is-hidden');
    overlay.style.display = 'flex';
    const titleEl = overlay.querySelector('h3') || overlay.querySelector('#ytPlayerErrorTitle') || overlay.querySelector('#modalPlayerErrorTitle');
    const descEl = overlay.querySelector('p') || overlay.querySelector('#ytPlayerErrorText') || overlay.querySelector('#modalPlayerErrorText');
    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = desc;
  });

  const ytErr = document.getElementById('ytPlayerErrorOverlay');
  if (ytErr) {
    ytErr.classList.remove('is-hidden');
    ytErr.style.display = 'flex';
    const t = document.getElementById('ytPlayerErrorTitle');
    const d = document.getElementById('ytPlayerErrorText');
    if (t) t.textContent = title;
    if (d) d.textContent = desc;
  }

  if (window.lucide) window.lucide.createIcons();
}

/**
 * Hide visible error overlay on the player screen
 */
export function hidePlayerError(videoTarget) {
  const targetEl = typeof videoTarget === 'string' ? document.getElementById(videoTarget) : videoTarget;
  const stage = (targetEl && targetEl.closest) ? 
    (targetEl.closest('#ytPlayerStage') || targetEl.closest('#playerStage') || targetEl.closest('.plyr')) : null;

  const overlays = stage ? 
    stage.querySelectorAll('.player-error-overlay') : 
    document.querySelectorAll('.player-error-overlay');

  overlays.forEach(overlay => {
    overlay.classList.add('is-hidden');
    overlay.style.display = 'none';
  });

  const ytErr = document.getElementById('ytPlayerErrorOverlay');
  if (ytErr) {
    ytErr.classList.add('is-hidden');
    ytErr.style.display = 'none';
  }
  const modalErr = document.getElementById('modalPlayerErrorOverlay');
  if (modalErr) {
    modalErr.classList.add('is-hidden');
    modalErr.style.display = 'none';
  }
}

/**
 * Show dedicated loading & buffering spinner on the video player stage
 */
export function showVideoSpinner(videoTarget, customText = 'Buffering Stream...') {
  const targetEl = typeof videoTarget === 'string' ? document.getElementById(videoTarget) : videoTarget;
  const stage = (targetEl && targetEl.closest) ? 
    (targetEl.closest('#ytPlayerStage') || targetEl.closest('#playerStage') || targetEl.closest('.plyr')) : null;

  const spinners = stage ? 
    stage.querySelectorAll('.video-spinner-overlay') : 
    document.querySelectorAll('.video-spinner-overlay');

  spinners.forEach(spinner => {
    spinner.style.display = 'flex';
    spinner.classList.remove('is-hidden');
    if (customText) {
      const textEl = spinner.querySelector('#ytLoadingText') || spinner.querySelector('span:last-child');
      if (textEl) textEl.textContent = customText;
    }
  });

  // Safety fallback: auto-hide spinner after 6 seconds so user is never stuck
  if (window._spinnerSafetyTimer) clearTimeout(window._spinnerSafetyTimer);
  window._spinnerSafetyTimer = setTimeout(() => {
    hideVideoSpinner(videoTarget);
  }, 6000);
}

/**
 * Hide loading & buffering spinner on the video player stage
 */
export function hideVideoSpinner(videoTarget) {
  if (window._spinnerSafetyTimer) {
    clearTimeout(window._spinnerSafetyTimer);
    window._spinnerSafetyTimer = null;
  }

  const targetEl = typeof videoTarget === 'string' ? document.getElementById(videoTarget) : videoTarget;
  const stage = (targetEl && targetEl.closest) ? 
    (targetEl.closest('#ytPlayerStage') || targetEl.closest('#playerStage') || targetEl.closest('.plyr')) : null;

  const spinners = stage ? 
    stage.querySelectorAll('.video-spinner-overlay') : 
    document.querySelectorAll('.video-spinner-overlay');

  spinners.forEach(spinner => {
    spinner.classList.add('is-hidden');
    spinner.style.display = 'none';
  });

  const ytSpinner = document.getElementById('ytLoadingSpinner');
  if (ytSpinner) {
    ytSpinner.classList.add('is-hidden');
    ytSpinner.style.display = 'none';
  }
  const modalSpinner = document.getElementById('modalLoadingSpinner');
  if (modalSpinner) {
    modalSpinner.classList.add('is-hidden');
    modalSpinner.style.display = 'none';
  }
}

/**
 * Destroys any existing Plyr and HLS.js instances cleanly (used when closing player)
 */
export function destroyCurrentPlayer() {
  console.log("[ShowVerse Player] destroyCurrentPlayer invoked.");
  if (currentHls) {
    try {
      currentHls.destroy();
    } catch (e) {
      console.warn("HLS destroy notice:", e);
    }
    currentHls = null;
    window.currentHls = null;
    window.activeHls = null;
    window.mainHls = null;
    window.hls = null;
  }

  if (activePlyr) {
    try {
      activePlyr.destroy();
    } catch (e) {
      console.warn("Plyr destroy notice:", e);
    }
    activePlyr = null;
    window.activePlyr = null;
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
 * Helper to dynamically get the active video element
 */
export function getActiveVideo() {
  return document.querySelector('#ytPlayerStage video') || 
         document.querySelector('#playerModal video') || 
         document.querySelector('video');
}

/**
 * Retry current episode playback if an error occurred
 */
export function retryCurrentEpisode() {
  console.log("[ShowVerse Player] User clicked Retry Episode.");
  hidePlayerError();
  if (typeof window.switchYtEpisode === 'function' && typeof window.currentSelectedEpisodeIndex === 'number') {
    window.switchYtEpisode(window.currentSelectedEpisodeIndex);
  } else if (typeof window.loadActiveYtEpisode === 'function') {
    window.loadActiveYtEpisode(0);
  } else {
    const vid = getActiveVideo();
    if (vid) {
      vid.load();
      vid.play().catch(e => console.warn("[ShowVerse Player] Retry play catch:", e));
    }
  }
}

/**
 * Setup and attach Plyr instance to a video element if not already attached
 */
function ensurePlyrAttached(videoElement, resumeTime = 0, options = {}) {
  // If activePlyr is already present and attached to this videoElement, reuse it!
  if (activePlyr && activePlyr.media === videoElement) {
    console.log("[ShowVerse Player] Existing Plyr instance detected and reused.");
    return activePlyr;
  }

  // If a stale Plyr instance exists for another element, destroy it first
  if (activePlyr) {
    try {
      activePlyr.destroy();
    } catch (e) {}
    activePlyr = null;
  }

  console.log("[ShowVerse Player] Initializing fresh Plyr instance on video element.");
  const plyr = new window.Plyr(videoElement, {
    controls: defaultPlyrControls,
    seekTime: 10,
    keyboard: { focused: true, global: false },
    tooltips: { controls: true, seek: true },
    captions: { active: true, update: true, language: 'en' },
    invertTime: false,
    toggleInvert: false
  });

  activePlyr = plyr;
  window.activePlyr = plyr;

  // Continue watching & history tracking
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

  plyr.on('waiting', () => showVideoSpinner(videoElement, 'Buffering Stream...'));
  plyr.on('seeking', () => showVideoSpinner(videoElement, 'Buffering Stream...'));
  plyr.on('playing', () => {
    hideVideoSpinner(videoElement);
    hidePlayerError(videoElement);
  });
  plyr.on('canplay', () => {
    hideVideoSpinner(videoElement);
    hidePlayerError(videoElement);
  });

  return plyr;
}

/**
 * PRIMARY VIDEO LOADER
 * Updates video.src correctly, calls video.load(), executes video.play() with catch(err),
 * binds comprehensive error listeners, and ensures the player never freezes on black screen.
 * 
 * @param {HTMLVideoElement|string} videoTarget - Video element or element ID
 * @param {string} targetUrl - Stream URL (.m3u8 or .mp4 or direct stream)
 * @param {number} resumeTime - Optional timestamp to resume playback
 * @param {Object} options - Additional options
 */
export function loadVideoWithPlyr(videoTarget, targetUrl, resumeTime = 0, options = {}) {
  console.log(`[ShowVerse Player] ========================================`);
  console.log(`[ShowVerse Player] loadVideoWithPlyr called!`);
  console.log(`[ShowVerse Player] Target URL: "${targetUrl}"`);
  console.log(`[ShowVerse Player] Resume Time: ${resumeTime}`);
  console.log(`[ShowVerse Player] Options:`, options);

  // 1. Resolve target video element
  let videoElement = typeof videoTarget === 'string' ? document.getElementById(videoTarget) : videoTarget;
  if (!videoElement) {
    videoElement = document.getElementById('main-video') || document.querySelector('#ytPlayerStage video') || document.querySelector('video');
  }

  if (!videoElement) {
    console.error("[ShowVerse Player] Error: Target video element not found in DOM!", videoTarget);
    return null;
  }

  console.log("[ShowVerse Player] Target video element confirmed:", videoElement);

  // 2. Hide any previous error overlays and show loading spinner immediately
  hidePlayerError(videoElement);
  showVideoSpinner(videoElement, options.loadingText || 'Loading Episode...');

  // 3. Ensure no poster image displays and background is black
  videoElement.removeAttribute('poster');
  videoElement.poster = '';
  videoElement.autoplay = true;

  // 4. Validate URL
  const streamUrl = typeof targetUrl === 'string' ? targetUrl.trim() : '';
  if (!streamUrl) {
    console.error("[ShowVerse Player] Error: Provided stream URL is empty!");
    hideVideoSpinner(videoElement);
    showPlayerError(videoElement, "Error loading video", "No valid stream URL was found for this episode.");
    return null;
  }

  // 5. Clean up any previous Hls.js instance so it doesn't conflict
  if (currentHls) {
    try {
      console.log("[ShowVerse Player] Destroying previous Hls instance...");
      currentHls.destroy();
    } catch (e) {
      console.warn("[ShowVerse Player] Error during Hls destroy:", e);
    }
    currentHls = null;
    window.currentHls = null;
    window.activeHls = null;
    window.mainHls = null;
    window.hls = null;
  }

  // 6. Comprehensive Error Listeners on the video element (`error`, `stalled`, `abort`)
  const handleVideoFailure = (event) => {
    const type = event ? event.type : 'error';
    const err = videoElement.error;
    console.error(`[ShowVerse Player] Video element failure event: "${type}" on URL: "${streamUrl}"`, err);

    // Hide the spinner immediately so it never spins infinitely
    hideVideoSpinner(videoElement);

    let errorHeading = "Error loading video";
    let errorDetail = "The video stream could not be loaded or the format is not supported.";

    if (err) {
      switch (err.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errorDetail = "The video playback was aborted by the user or browser.";
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          errorDetail = "A network error occurred while downloading the video stream.";
          break;
        case MediaError.MEDIA_ERR_DECODE:
          errorDetail = "Playback was aborted due to stream corruption or unsupported codec.";
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorDetail = "The video format or server source is not supported by your browser.";
          break;
        default:
          if (err.message) errorDetail = err.message;
          break;
      }
    }

    // Display visible error message on the player screen so it doesn't stay a blank black box
    showPlayerError(videoElement, errorHeading, errorDetail);
  };

  // Attach error and abort handlers
  videoElement.onerror = handleVideoFailure;
  videoElement.onabort = handleVideoFailure;

  // Stalled handler: logs warning, and if source is unavailable, displays visible error
  videoElement.onstalled = (e) => {
    console.warn(`[ShowVerse Player] Video stream stalled on URL: "${streamUrl}"`, e);
    if (videoElement.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
      handleVideoFailure(e);
    }
  };

  // Remove stale child <source> elements if any were present
  while (videoElement.firstChild) {
    if (videoElement.firstChild.nodeName === 'SOURCE') {
      videoElement.removeChild(videoElement.firstChild);
    } else {
      break;
    }
  }

  // 7. Autoplay Promise Function with robust catch(err) handling
  let isPlayTriggered = false;
  const triggerSafePlay = () => {
    if (isPlayTriggered) return;
    isPlayTriggered = true;

    console.log(`[ShowVerse Player] triggerSafePlay executing for: "${streamUrl}"`);
    hideVideoSpinner(videoElement);
    hidePlayerError(videoElement);

    // Apply resume timestamp if requested
    if (resumeTime > 0) {
      try {
        videoElement.currentTime = Number(resumeTime);
        console.log(`[ShowVerse Player] Resumed at timestamp: ${resumeTime}s`);
      } catch (err) {
        console.warn("[ShowVerse Player] Resume timestamp notice:", err);
      }
    }

    // Call video.play() and handle promise catch
    const playPromise = videoElement.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        console.log("[ShowVerse Player] video.play() started successfully!");
        hideVideoSpinner(videoElement);
        hidePlayerError(videoElement);
      }).catch(err => {
        // Autoplay policy prevented playback without user gesture
        console.log("[ShowVerse Player] video.play() caught autoplay rejection (gesture required):", err);
        // Hide spinner immediately so the big Play overlay or controls are clickable
        hideVideoSpinner(videoElement);
        // Do not show a fatal error here because this is normal browser policy; user just clicks play!
      });
    }
  };

  // Attach standard playback state listeners
  videoElement.oncanplay = () => {
    console.log("[ShowVerse Player] video element 'canplay' event fired.");
    triggerSafePlay();
  };
  videoElement.onplaying = () => {
    hideVideoSpinner(videoElement);
    hidePlayerError(videoElement);
  };
  videoElement.onwaiting = () => showVideoSpinner(videoElement, 'Buffering Stream...');
  videoElement.onseeking = () => showVideoSpinner(videoElement, 'Buffering Stream...');
  videoElement.onseeked = () => hideVideoSpinner(videoElement);

  // 8. Stream Format Check:
  // Is this strictly an HLS adaptive stream (.m3u8)?
  const isHls = /\.m3u8(\?.*)?$/i.test(streamUrl) || 
                streamUrl.includes('.m3u8') || 
                streamUrl.includes('application/x-mpegURL');

  const isHlsSupported = !!(window.Hls && window.Hls.isSupported());

  if (isHls && isHlsSupported) {
    console.log("[ShowVerse Player] Initializing Hls.js engine for adaptive stream:", streamUrl);
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

    hls.once(window.Hls.Events.MANIFEST_PARSED, () => {
      console.log("[ShowVerse Player] HLS Manifest parsed successfully.");
      triggerSafePlay();
    });

    hls.on(window.Hls.Events.ERROR, (event, data) => {
      console.warn("[ShowVerse Player] Hls event error:", data);
      if (data.fatal) {
        switch (data.type) {
          case window.Hls.ErrorTypes.NETWORK_ERROR:
            console.warn("[ShowVerse Player] Fatal HLS network error, attempting startLoad()...");
            hls.startLoad();
            break;
          case window.Hls.ErrorTypes.MEDIA_ERROR:
            console.warn("[ShowVerse Player] Fatal HLS media error, attempting recoverMediaError()...");
            hls.recoverMediaError();
            break;
          default:
            console.error("[ShowVerse Player] Unrecoverable HLS fatal error. Falling back directly to video.src:", data);
            try { hls.destroy(); } catch (_) {}
            currentHls = null;
            // Fallback to standard HTML5 video.src, video.load(), video.play()
            videoElement.src = streamUrl;
            videoElement.load();
            triggerSafePlay();
            break;
        }
      }
    });
  } else {
    // 9. DIRECT VIDEO STREAM (MP4, WebM, OGG, Google Drive, direct CDN link, etc.)
    console.log(`[ShowVerse Player] Step 1: Updating video.src = "${streamUrl}"`);
    videoElement.src = streamUrl;

    console.log("[ShowVerse Player] Step 2: Calling video.load()");
    videoElement.load();

    console.log("[ShowVerse Player] Step 3: Triggering video.play()");
    triggerSafePlay();
  }

  // 10. Ensure Plyr controls overlay is attached without tearing down the DOM
  ensurePlyrAttached(videoElement, resumeTime, options);

  console.log(`[ShowVerse Player] ========================================`);
  return null;
}

/**
 * Universal playback controls delegating directly to Plyr or active video
 */
export function togglePlay() {
  if (activePlyr) {
    activePlyr.togglePlay();
  } else {
    const vid = getActiveVideo();
    if (vid) vid.paused ? vid.play().catch(() => {}) : vid.pause();
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
  } else {
    const vid = getActiveVideo();
    if (vid) vid.currentTime += (Number(seconds) || 10);
  }
}

export function seekVideo() {
  // Native Plyr control bar handles seeking smoothly
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
  } else {
    const vid = getActiveVideo();
    if (vid) vid.muted = !vid.muted;
  }
}

export function changeVolume(val) {
  if (activePlyr) {
    activePlyr.volume = Number(val);
  } else {
    const vid = getActiveVideo();
    if (vid) vid.volume = Number(val);
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

// Stubs for backward compatibility
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
export function executeSafeSeek() {}
export function executeSafeTimelineSeek() {}
export function initMainPlayerControlsAutoHide() {}
export function wipeAndAttachMainPlayerSeekSkipListeners() {}
export function rebindMasterPlayerControls() {}
export function setupMainPlayerDelegatedEvents() {}
export function attachPlayerEvents() {}

// Expose globally on window
window.loadVideoWithPlyr = loadVideoWithPlyr;
window.destroyCurrentPlayer = destroyCurrentPlayer;
window.showVideoSpinner = showVideoSpinner;
window.hideVideoSpinner = hideVideoSpinner;
window.showPlayerError = showPlayerError;
window.hidePlayerError = hidePlayerError;
window.retryCurrentEpisode = retryCurrentEpisode;
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

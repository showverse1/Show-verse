/**
 * SHOW VERSE - Video Player Controller (player.js)
 * Fullscreen / Landscape Controls & Screen Lock Engine
 */

// Player State
export let isLocked = false;
export let isAmbientOn = true;
export let activeHls = null;
let unlockFadeTimer = null;
let controlsFadeTimer = null;
const FALLBACK_STREAM = 'https://vjs.zencdn.net/v/oceans.mp4';

// Cache elements safely
function getElements() {
  return {
    modal: document.getElementById('playerModal'),
    uiWrapper: document.getElementById('player-ui-wrapper'),
    video: document.getElementById('mainVideo'),
    bufferingSpinner: document.getElementById('playerBufferingSpinner'),
    stage: document.getElementById('playerStage'),
    stageContainer: document.getElementById('playerStageContainer'),
    topBar: document.getElementById('playerTopBar'),
    bottomBar: document.getElementById('playerBottomBar'),
    smallUnlockBtn: document.getElementById('smallUnlockBtn'),
    progressBar: document.getElementById('progressBar'),
    bufferedBar: document.getElementById('bufferedBar'),
    timeDisplay: document.getElementById('timeDisplay'),
    scrubContainer: document.getElementById('scrubContainer'),
    playIcon: document.getElementById('playIcon'),
    volumeIcon: document.getElementById('volumeIcon'),
    volumeSlider: document.getElementById('volumeSlider'),
    ambientToggleBtn: document.getElementById('ambientToggleBtn'),
    fullscreenBtn: document.getElementById('fullscreenBtn'),
    qualityModal: document.getElementById('qualityModal'),
    audioSubModal: document.getElementById('audioSubModal')
  };
}

// ========================================================
// 0. BUFFERING INDICATOR & AUTO-HIDE CONTROLS ENGINE
// ========================================================

/**
 * Show the modern centered buffering spinner overlay
 */
export function showBufferingSpinner() {
  const spinner = document.getElementById('playerBufferingSpinner');
  if (spinner) {
    spinner.classList.remove('hidden');
    spinner.style.opacity = '1';
  }
}

/**
 * Hide the modern centered buffering spinner overlay
 */
export function hideBufferingSpinner() {
  const spinner = document.getElementById('playerBufferingSpinner');
  if (spinner) {
    spinner.classList.add('hidden');
    spinner.style.opacity = '0';
  }
}

export function areControlsHidden() {
  const uiWrapper = document.getElementById('player-ui-wrapper');
  const modal = document.getElementById('playerModal');
  if (uiWrapper) {
    return uiWrapper.classList.contains('controls-hidden') || uiWrapper.style.opacity === '0';
  }
  return modal ? modal.classList.contains('controls-hidden') : false;
}

export function showControls() {
  const uiWrapper = document.getElementById('player-ui-wrapper');
  const modal = document.getElementById('playerModal');
  if (uiWrapper) {
    uiWrapper.style.opacity = '1';
    uiWrapper.style.pointerEvents = 'auto';
    uiWrapper.classList.remove('controls-hidden');
  }
  if (modal) {
    modal.classList.remove('controls-hidden');
  }
}

export function hideControls() {
  const { video, qualityModal, audioSubModal } = getElements();
  const uiWrapper = document.getElementById('player-ui-wrapper');
  const modal = document.getElementById('playerModal');
  if (!modal || isLocked) return;

  // Requirement: If video is paused or ended, controls MUST remain permanently visible
  if (!video || video.paused || video.ended) {
    showControls();
    return;
  }

  // Do not hide controls if either configuration modal is currently open
  const isQualityOpen = qualityModal && !qualityModal.classList.contains('hidden');
  const isAudioSubOpen = audioSubModal && !audioSubModal.classList.contains('hidden');
  if (isQualityOpen || isAudioSubOpen) {
    return;
  }

  if (uiWrapper) {
    uiWrapper.style.opacity = '0';
    uiWrapper.style.pointerEvents = 'none';
    uiWrapper.classList.add('controls-hidden');
  }
  if (modal) {
    modal.classList.add('controls-hidden');
  }
}

export function cancelControlsTimer() {
  if (controlsFadeTimer) {
    clearTimeout(controlsFadeTimer);
    controlsFadeTimer = null;
  }
  showControls();
}

export function resetControlsTimer() {
  if (controlsFadeTimer) {
    clearTimeout(controlsFadeTimer);
    controlsFadeTimer = null;
  }

  showControls();

  const { modal, video } = getElements();
  if (!modal || modal.classList.contains('hidden') || isLocked) return;

  // Requirement: If paused or ended, controls remain visible indefinitely
  if (!video || video.paused || video.ended) {
    return;
  }

  // Requirement: Fade out after 3 seconds of inactivity while video is PLAYING
  controlsFadeTimer = setTimeout(() => {
    hideControls();
  }, 3000);
}

/**
 * Attach buffering and playback listeners to video element
 */
export function setupVideoListeners(video) {
  if (!video || video._bufferingListenersAttached) return;
  video._bufferingListenersAttached = true;

  // 1. Buffering indicator events:
  // Show spinner on waiting
  video.addEventListener('waiting', () => {
    showBufferingSpinner();
  });
  // Hide spinner on playing & canplay
  video.addEventListener('playing', () => {
    hideBufferingSpinner();
    showControls();
    resetControlsTimer();
  });
  video.addEventListener('canplay', () => {
    hideBufferingSpinner();
  });

  // 2. Playback state events:
  video.addEventListener('play', () => {
    showControls();
    resetControlsTimer();
  });
  video.addEventListener('pause', () => {
    cancelControlsTimer();
    showControls();
  });
  video.addEventListener('ended', () => {
    cancelControlsTimer();
    showControls();
    hideBufferingSpinner();
  });
}

export function initPlayerControlsAutoHide() {
  const modal = document.getElementById('playerModal');
  const video = document.getElementById('mainVideo');
  if (!modal) return;

  if (modal._autoHideInitialized) return;
  modal._autoHideInitialized = true;

  const onUserActivity = () => {
    showControls();
    resetControlsTimer();
  };

  // Requirement: Mouse movement, touch, clicks immediately reset timer and reveal controls
  modal.addEventListener('mousemove', onUserActivity);
  modal.addEventListener('pointermove', onUserActivity);
  modal.addEventListener('pointerdown', onUserActivity);
  modal.addEventListener('click', onUserActivity);
  modal.addEventListener('touchstart', onUserActivity, { passive: true });
  modal.addEventListener('touchmove', onUserActivity, { passive: true });

  // Requirement: If the mouse leaves the player area (mouseleave), hide controls immediately if video is playing
  modal.addEventListener('mouseleave', () => {
    const v = document.getElementById('mainVideo');
    if (v && !v.paused && !v.ended && !isLocked) {
      if (controlsFadeTimer) {
        clearTimeout(controlsFadeTimer);
        controlsFadeTimer = null;
      }
      hideControls();
    }
  });

  if (video) {
    setupVideoListeners(video);
  }
}

// ========================================================
// 0B. MAIN PUBLIC VIDEO PLAYER AUTO-HIDE ENGINE (3s Inactivity)
// ========================================================
let mainControlsFadeTimer = null;

export function areMainPlayerControlsHidden() {
  const uiWrapper = document.getElementById('main-player-ui-wrapper');
  const stage = document.getElementById('ytPlayerStage');
  if (uiWrapper) {
    return uiWrapper.classList.contains('controls-hidden') || uiWrapper.style.opacity === '0';
  }
  return stage ? stage.classList.contains('controls-hidden') : false;
}

export function showMainPlayerControls() {
  const uiWrapper = document.getElementById('main-player-ui-wrapper');
  const stage = document.getElementById('ytPlayerStage');
  if (uiWrapper) {
    uiWrapper.style.opacity = '1';
    uiWrapper.classList.remove('controls-hidden');
  }
  if (stage) {
    stage.classList.remove('controls-hidden');
  }
}

export function hideMainPlayerControls() {
  const video = document.getElementById('ytVideo');
  const uiWrapper = document.getElementById('main-player-ui-wrapper');
  const stage = document.getElementById('ytPlayerStage');
  if (!stage) return;

  // Requirement: If video is paused or ended, controls MUST remain permanently visible
  if (!video || video.paused || video.ended) {
    showMainPlayerControls();
    return;
  }

  if (uiWrapper) {
    uiWrapper.style.opacity = '0';
    uiWrapper.classList.add('controls-hidden');
  }
  if (stage) {
    stage.classList.add('controls-hidden');
  }
}

export function cancelMainPlayerControlsTimer() {
  if (mainControlsFadeTimer) {
    clearTimeout(mainControlsFadeTimer);
    mainControlsFadeTimer = null;
  }
  showMainPlayerControls();
}

export function resetMainPlayerControlsTimer() {
  if (mainControlsFadeTimer) {
    clearTimeout(mainControlsFadeTimer);
    mainControlsFadeTimer = null;
  }

  showMainPlayerControls();

  const stage = document.getElementById('ytPlayerStage');
  const video = document.getElementById('ytVideo');
  if (!stage) return;

  // If paused or ended, controls remain visible indefinitely
  if (!video || video.paused || video.ended) {
    return;
  }

  // Fade out after 3 seconds of inactivity while video is PLAYING
  mainControlsFadeTimer = setTimeout(() => {
    hideMainPlayerControls();
  }, 3000);
}

export function showYtBufferingSpinner() {
  const spinner = document.getElementById('ytBufferingSpinner');
  if (spinner) {
    spinner.classList.remove('hidden');
    spinner.style.opacity = '1';
  }
}

export function hideYtBufferingSpinner() {
  const spinner = document.getElementById('ytBufferingSpinner');
  if (spinner) {
    spinner.classList.add('hidden');
    spinner.style.opacity = '0';
  }
}

export function setupMainPlayerVideoListeners(video) {
  if (!video || video._mainListenersAttached) return;
  video._mainListenersAttached = true;

  video.addEventListener('waiting', () => {
    showYtBufferingSpinner();
  });
  video.addEventListener('playing', () => {
    hideYtBufferingSpinner();
    showMainPlayerControls();
    resetMainPlayerControlsTimer();
  });
  video.addEventListener('canplay', () => {
    hideYtBufferingSpinner();
  });
  video.addEventListener('play', () => {
    showMainPlayerControls();
    resetMainPlayerControlsTimer();
  });
  video.addEventListener('pause', () => {
    cancelMainPlayerControlsTimer();
    showMainPlayerControls();
  });
  video.addEventListener('ended', () => {
    cancelMainPlayerControlsTimer();
    showMainPlayerControls();
    hideYtBufferingSpinner();
  });
}

export function initMainPlayerControlsAutoHide() {
  const stage = document.getElementById('ytPlayerStage');
  const video = document.getElementById('ytVideo');
  if (!stage) return;

  if (stage._mainAutoHideInitialized) {
    if (video) setupMainPlayerVideoListeners(video);
    return;
  }
  stage._mainAutoHideInitialized = true;

  const onUserActivity = () => {
    showMainPlayerControls();
    resetMainPlayerControlsTimer();
  };

  // Requirement: mousemove, touchstart, and mouseleave events attached to the MAIN player container
  stage.addEventListener('mousemove', onUserActivity);
  stage.addEventListener('pointermove', onUserActivity);
  stage.addEventListener('pointerdown', onUserActivity);
  stage.addEventListener('click', onUserActivity);
  stage.addEventListener('touchstart', onUserActivity, { passive: true });
  stage.addEventListener('touchmove', onUserActivity, { passive: true });

  stage.addEventListener('mouseleave', () => {
    const v = document.getElementById('ytVideo');
    if (v && !v.paused && !v.ended) {
      if (mainControlsFadeTimer) {
        clearTimeout(mainControlsFadeTimer);
        mainControlsFadeTimer = null;
      }
      hideMainPlayerControls();
    }
  });

  if (video) {
    setupMainPlayerVideoListeners(video);
  }
}

// Auto-initialize listeners on DOM load
if (typeof document !== "undefined") {
  const initAllPlayers = () => {
    initPlayerControlsAutoHide();
    initMainPlayerControlsAutoHide();
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllPlayers);
  } else {
    initAllPlayers();
  }
}

// ========================================================
// 1. FULLSCREEN & LANDSCAPE CONTROLS ENGINE
// ========================================================

/**
 * Request or exit fullscreen on the ENTIRE player container (#playerModal)
 * so that all custom controls (top bar, transport, progress bar, audio/cc, quality)
 * remain visible and interactive above the video stream.
 */
export function toggleFullscreen() {
  const { modal } = getElements();
  if (!modal) return;

  const isFullscreen = !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement
  );

  if (!isFullscreen) {
    if (modal.requestFullscreen) {
      modal.requestFullscreen().catch(err => {
        console.warn("Fullscreen request error:", err ? (err.message || String(err)) : "Error");
      });
    } else if (modal.webkitRequestFullscreen) {
      modal.webkitRequestFullscreen();
    } else if (modal.mozRequestFullScreen) {
      modal.mozRequestFullScreen();
    } else if (modal.msRequestFullscreen) {
      modal.msRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(err => {});
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  }
}

/**
 * Handle browser fullscreen changes across vendors
 */
export function handleFullscreenChange() {
  const isFs = !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement
  );
  const { modal, fullscreenBtn } = getElements();
  if (modal) {
    modal.classList.toggle('is-fullscreen', isFs);
  }
  if (fullscreenBtn) {
    fullscreenBtn.innerHTML = isFs
      ? `<i data-lucide="minimize" class="w-4 h-4"></i>`
      : `<i data-lucide="maximize" class="w-4 h-4"></i>`;
    fullscreenBtn.title = isFs ? "Exit Fullscreen" : "Fullscreen";
    if (window.lucide) window.lucide.createIcons();
  }
}

// Attach fullscreen listeners
if (typeof document !== "undefined") {
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.addEventListener('mozfullscreenchange', handleFullscreenChange);
  document.addEventListener('MSFullscreenChange', handleFullscreenChange);
}

// ========================================================
// 2. REDESIGNED LOCK SCREEN BEHAVIOR
// ========================================================

/**
 * Lock Screen:
 * - Hides all main player controls (top bar, bottom bar, modals)
 * - Shows small semi-transparent unlock button on the corner for 3s
 * - No massive center overlay blocking the video
 */
export function toggleLockScreen() {
  isLocked = true;
  cancelControlsTimer();
  const { uiWrapper, topBar, bottomBar, qualityModal, audioSubModal } = getElements();
  if (uiWrapper) {
    uiWrapper.style.opacity = '0';
    uiWrapper.style.pointerEvents = 'none';
    uiWrapper.classList.add('hidden');
  }
  if (topBar) topBar.classList.add('hidden');
  if (bottomBar) bottomBar.classList.add('hidden');
  if (qualityModal) qualityModal.classList.add('hidden');
  if (audioSubModal) audioSubModal.classList.add('hidden');

  showSmallUnlockBriefly();

  if (window.showToast) {
    window.showToast("Screen Controls Locked");
  }
}

/**
 * Unlock Screen:
 * - Restores main player controls
 * - Hides small unlock button
 */
export function unlockScreen(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  isLocked = false;
  if (unlockFadeTimer) {
    clearTimeout(unlockFadeTimer);
    unlockFadeTimer = null;
  }
  const { uiWrapper, topBar, bottomBar, smallUnlockBtn, video } = getElements();
  if (smallUnlockBtn) {
    smallUnlockBtn.classList.remove('opacity-100', 'pointer-events-auto');
    smallUnlockBtn.classList.add('opacity-0', 'pointer-events-none');
  }
  if (uiWrapper) {
    uiWrapper.classList.remove('hidden');
  }
  if (topBar) topBar.classList.remove('hidden');
  if (bottomBar) bottomBar.classList.remove('hidden');

  showControls();
  if (video && !video.paused) {
    resetControlsTimer();
  }

  if (window.showToast) {
    window.showToast("Screen Unlocked");
  }
  if (window.lucide) window.lucide.createIcons();
}

/**
 * Flash the small unlock icon quietly on the corner for 3 seconds
 */
export function showSmallUnlockBriefly() {
  const { smallUnlockBtn } = getElements();
  if (!smallUnlockBtn) return;
  smallUnlockBtn.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
  smallUnlockBtn.classList.add('opacity-100', 'pointer-events-auto');

  if (unlockFadeTimer) clearTimeout(unlockFadeTimer);
  unlockFadeTimer = setTimeout(() => {
    if (isLocked) {
      smallUnlockBtn.classList.remove('opacity-100', 'pointer-events-auto');
      smallUnlockBtn.classList.add('opacity-0', 'pointer-events-none');
    }
  }, 3000);
}

let lastTapTime = 0;
let lastTapX = 0;
let singleTapTimeout = null;
let playerSkipAnimTimeout = null;

export function triggerPlayerSkipAnimation(seconds) {
  const isForward = seconds > 0;
  const leftEl = document.getElementById('playerSkipLeftIndicator');
  const rightEl = document.getElementById('playerSkipRightIndicator');
  const targetEl = isForward ? rightEl : leftEl;
  const otherEl = isForward ? leftEl : rightEl;
  const textEl = document.getElementById(isForward ? 'playerSkipRightText' : 'playerSkipLeftText');

  if (otherEl) {
    otherEl.classList.remove('animate-skip-left', 'animate-skip-right');
  }
  if (targetEl) {
    if (textEl) textEl.innerText = `${isForward ? '+' : ''}${seconds}s`;
    targetEl.classList.remove('animate-skip-left', 'animate-skip-right');
    // Force reflow
    void targetEl.offsetWidth;
    targetEl.classList.add(isForward ? 'animate-skip-right' : 'animate-skip-left');

    if (playerSkipAnimTimeout) clearTimeout(playerSkipAnimTimeout);
    playerSkipAnimTimeout = setTimeout(() => {
      targetEl.classList.remove('animate-skip-left', 'animate-skip-right');
    }, 650);
  }
}

/**
 * Handle taps on the screen / stage:
 * - If locked: only fade in/out the small unlock icon for 3 seconds
 * - If controls are hidden: reveal controls instantly and reset 3s timer
 * - Unlocked: Double-tap on left/right half triggers smooth +/-10s skip animation
 * - Single tap: toggles play/pause
 */
export function handlePlayerScreenTap(e) {
  // Ignore clicks on buttons, inputs, links, or scrub progress bar
  if (e.target.closest('button, input, select, a, #scrubContainer, #smallUnlockBtn, .glass-card, #playerTopBar, #playerBottomBar')) {
    resetControlsTimer();
    return;
  }

  if (isLocked) {
    e.preventDefault();
    e.stopPropagation();
    showSmallUnlockBriefly();
    return;
  }

  // If controls were hidden, tap/click reveals them instantly and resets the 3-second timer
  if (areControlsHidden()) {
    resetControlsTimer();
    return;
  }

  const now = Date.now();
  const tapDelay = now - lastTapTime;
  const rect = (e.currentTarget || document.getElementById('playerStageContainer')).getBoundingClientRect();
  const tapX = e.clientX - rect.left;
  const width = rect.width;

  if (tapDelay < 320 && Math.abs(tapX - lastTapX) < 120) {
    // DOUBLE-TAP DETECTED
    if (singleTapTimeout) {
      clearTimeout(singleTapTimeout);
      singleTapTimeout = null;
    }
    lastTapTime = 0;
    if (tapX < width * 0.42) {
      // Left side double-tap -> Rewind 10s
      skipTime(-10);
    } else if (tapX > width * 0.58) {
      // Right side double-tap -> Forward 10s
      skipTime(10);
    } else {
      // Center double tap toggles play
      togglePlay();
    }
    resetControlsTimer();
  } else {
    // Potential single tap
    lastTapTime = now;
    lastTapX = tapX;
    if (singleTapTimeout) clearTimeout(singleTapTimeout);
    singleTapTimeout = setTimeout(() => {
      togglePlay();
      singleTapTimeout = null;
      resetControlsTimer();
    }, 280);
  }
}

// ========================================================
// 3. PLAYBACK & CONTROLS HELPERS
// ========================================================

export function togglePlay() {
  const { video } = getElements();
  if (!video) return;
  if (video.paused) {
    video.play();
    updatePlayIcon(true);
    resetControlsTimer();
  } else {
    video.pause();
    updatePlayIcon(false);
    cancelControlsTimer();
    showControls();
  }
}

export function updatePlayIcon(isPlaying) {
  const { playIcon } = getElements();
  if (playIcon) {
    playIcon.setAttribute('data-lucide', isPlaying ? 'pause' : 'play');
    if (window.lucide) window.lucide.createIcons();
  }
}

export function skipTime(seconds) {
  const { video } = getElements();
  if (!video) return;
  const duration = video.duration;
  const current = video.currentTime;
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(current)) return;
  const targetTime = Math.max(0, Math.min(duration, current + Number(seconds)));
  video.currentTime = targetTime;
  if (window.saveContinueWatchingProgress) {
    window.saveContinueWatchingProgress(targetTime, duration);
  }
  // Trigger in-player frame skip animation overlay
  triggerPlayerSkipAnimation(seconds);
  resetControlsTimer();
}

export function seekVideo(e) {
  const { video, scrubContainer } = getElements();
  if (!video || !scrubContainer) return;
  const duration = video.duration;
  if (!Number.isFinite(duration) || duration <= 0) return;
  const rect = scrubContainer.getBoundingClientRect();
  if (!rect.width) return;
  const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const targetTime = pos * duration;
  video.currentTime = targetTime;
  if (window.saveContinueWatchingProgress) {
    window.saveContinueWatchingProgress(targetTime, duration);
  }
  resetControlsTimer();
}

export function changeVolume(val) {
  const { video, volumeIcon } = getElements();
  if (!video) return;
  video.volume = Number(val);
  if (volumeIcon) {
    volumeIcon.setAttribute('data-lucide', Number(val) === 0 ? 'volume-x' : 'volume-2');
    if (window.lucide) window.lucide.createIcons();
  }
  resetControlsTimer();
}

export function toggleMute() {
  const { video, volumeSlider } = getElements();
  if (!video) return;
  video.muted = !video.muted;
  changeVolume(video.muted ? 0 : 1);
  if (volumeSlider) volumeSlider.value = video.muted ? 0 : 1;
  resetControlsTimer();
}

export function toggleAmbientLighting() {
  const { stage, ambientToggleBtn } = getElements();
  isAmbientOn = !isAmbientOn;
  if (stage) {
    stage.classList.toggle('ambient-glow-box', isAmbientOn);
  }
  if (ambientToggleBtn) {
    ambientToggleBtn.innerHTML = isAmbientOn
      ? `<i data-lucide="sun" class="w-4 h-4"></i> <span class="hidden sm:inline">Ambient Glow: ON</span>`
      : `<i data-lucide="moon" class="w-4 h-4"></i> <span class="hidden sm:inline">Ambient Glow: OFF</span>`;
    if (window.lucide) window.lucide.createIcons();
  }
  if (window.showToast) {
    window.showToast(`Ambient Lighting: ${isAmbientOn ? 'ENABLED' : 'DISABLED'}`);
  }
  resetControlsTimer();
}

export function togglePiP() {
  const { video } = getElements();
  if (!video) return;
  try {
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture();
    } else if (video.requestPictureInPicture) {
      video.requestPictureInPicture();
    }
  } catch (err) {
    if (window.showToast) window.showToast("PiP not supported on this browser");
  }
  resetControlsTimer();
}

export function toggleQualityModal() {
  const { qualityModal, video } = getElements();
  if (qualityModal) {
    const isHidden = qualityModal.classList.toggle('hidden');
    if (!isHidden) {
      cancelControlsTimer();
      showControls();
    } else {
      if (video && !video.paused) resetControlsTimer();
    }
  }
}

export function selectQuality(q) {
  const badge = document.getElementById('currentQualityBadge');
  if (badge) badge.innerText = q.split(' ')[0];
  const { qualityModal, video } = getElements();
  if (qualityModal) qualityModal.classList.add('hidden');
  if (window.showToast) window.showToast(`Stream quality: ${q}`);
  if (video && !video.paused) resetControlsTimer();
}

export function toggleAudioSubModal() {
  const { audioSubModal, video } = getElements();
  if (audioSubModal) {
    const isHidden = audioSubModal.classList.toggle('hidden');
    if (!isHidden) {
      cancelControlsTimer();
      showControls();
    } else {
      if (video && !video.paused) resetControlsTimer();
    }
  }
}

export function setAudioTrack(track) {
  if (window.showToast) window.showToast(`Audio Track: ${track}`);
  const { audioSubModal, video } = getElements();
  if (audioSubModal) audioSubModal.classList.add('hidden');
  if (video && !video.paused) resetControlsTimer();
}

export function setSubtitle(sub) {
  if (window.showToast) window.showToast(`Subtitles: ${sub}`);
  const { audioSubModal, video } = getElements();
  if (audioSubModal) audioSubModal.classList.add('hidden');
  if (video && !video.paused) resetControlsTimer();
}

// Expose globally on window for inline HTML onclick handlers
if (typeof window !== "undefined") {
  window.showBufferingSpinner = showBufferingSpinner;
  window.hideBufferingSpinner = hideBufferingSpinner;
  window.setupVideoListeners = setupVideoListeners;
  window.areControlsHidden = areControlsHidden;
  window.showControls = showControls;
  window.hideControls = hideControls;
  window.resetControlsTimer = resetControlsTimer;
  window.cancelControlsTimer = cancelControlsTimer;
  window.initPlayerControlsAutoHide = initPlayerControlsAutoHide;
  window.toggleFullscreen = toggleFullscreen;
  window.toggleLockScreen = toggleLockScreen;
  window.unlockScreen = unlockScreen;
  window.handlePlayerScreenTap = handlePlayerScreenTap;
  window.togglePlay = togglePlay;
  window.updatePlayIcon = updatePlayIcon;
  window.skipTime = skipTime;
  window.triggerPlayerSkipAnimation = triggerPlayerSkipAnimation;
  window.seekVideo = seekVideo;
  window.changeVolume = changeVolume;
  window.toggleMute = toggleMute;
  window.toggleAmbientLighting = toggleAmbientLighting;
  window.togglePiP = togglePiP;
  window.toggleQualityModal = toggleQualityModal;
  window.selectQuality = selectQuality;
  window.toggleAudioSubModal = toggleAudioSubModal;
  window.setAudioTrack = setAudioTrack;
  window.setSubtitle = setSubtitle;
  window.areMainPlayerControlsHidden = areMainPlayerControlsHidden;
  window.showMainPlayerControls = showMainPlayerControls;
  window.hideMainPlayerControls = hideMainPlayerControls;
  window.cancelMainPlayerControlsTimer = cancelMainPlayerControlsTimer;
  window.resetMainPlayerControlsTimer = resetMainPlayerControlsTimer;
  window.initMainPlayerControlsAutoHide = initMainPlayerControlsAutoHide;
  window.setupMainPlayerVideoListeners = setupMainPlayerVideoListeners;
  window.showYtBufferingSpinner = showYtBufferingSpinner;
  window.hideYtBufferingSpinner = hideYtBufferingSpinner;
}

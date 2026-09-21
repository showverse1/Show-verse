// auth.js - Firebase Authentication & Strict Admin Security Engine
import { auth } from "./firebase.js";
import { 
  onAuthStateChanged, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  RecaptchaVerifier,
  signInWithPhoneNumber
} from "firebase/auth";

// STRICT ADMIN EMAIL: Only this exact email is granted Creator Studio / Admin permissions
export const SECRET_ADMIN_EMAIL = 'vimleshkumar901559@gmail.com';

// Currently authenticated user (null by default = Guest state)
export let currentUser = null;

// Stored confirmation result & reCAPTCHA verifier for Phone Auth
let confirmationResult = null;
let recaptchaVerifier = null;

export function getCurrentUser() {
  return currentUser;
}

export function setCurrentUser(user) {
  currentUser = user || null;
  return currentUser;
}

/**
 * Checks whether the specified user is the strict authorized admin.
 * Per requirements: If and ONLY IF user.email === 'vimleshkumar901559@gmail.com'
 */
export function isAuthorizedAdmin(user) {
  if (!user || !user.email) return false;
  return user.email.toLowerCase().trim() === SECRET_ADMIN_EMAIL.toLowerCase();
}

/**
 * Updates all profile and auth UI elements according to the authentication state.
 *
 * 1. DEFAULT GUEST UI (LOGGED OUT):
 * - HIDE user profile details (Name/Email/Avatar)
 * - HIDE the "Creator Studio (Admin)" button completely
 * - HIDE the "Sign Out" button
 * - HIDE the "Watch History"
 * - SHOW the Guest Auth panel (Google, Email/Password, Phone OTP)
 *
 * 2. AUTHENTICATED USER UI:
 * - SHOW User Name, Email/Phone, and Avatar
 * - SHOW "Sign Out" button
 * - SHOW "Watch History"
 * - HIDE Guest Auth panel
 * - SECRET ADMIN CHECK: If and ONLY IF user.email === 'vimleshkumar901559@gmail.com',
 *   unhide/display "Creator Studio (Admin Control)" button. For ANY other email or phone login, remains permanently hidden (display: none).
 */
export function updateAuthUI(user) {
  currentUser = user || null;

  // DOM Elements
  const meUserProfileCard = document.getElementById('meUserProfileCard');
  const meGuestCard = document.getElementById('meGuestCard');
  const meDisplayName = document.getElementById('meDisplayName');
  const meEmailDisplay = document.getElementById('meEmailDisplay');
  const meAvatarInitials = document.getElementById('meAvatarInitials');
  const meRoleBadge = document.getElementById('meRoleBadge');
  const meSecretAdminSection = document.getElementById('meSecretAdminSection');
  const meWatchHistorySection = document.getElementById('meWatchHistorySection');
  const meGuestAuthPanel = document.getElementById('meGuestAuthPanel');
  const meUserAuthPanel = document.getElementById('meUserAuthPanel');
  const navAvatar = document.getElementById('navAvatar');
  const navUsername = document.getElementById('navUsername');

  const isAdmin = isAuthorizedAdmin(user);

  if (user) {
    // ---------------- AUTHENTICATED STATE ----------------
    const displayName = user.displayName || (user.email ? user.email.split('@')[0] : (user.phoneNumber || 'User'));
    const displaySub = user.email || user.phoneNumber || '';
    const initial = (user.displayName || user.email || user.phoneNumber || 'U').replace('+', '')[0].toUpperCase();

    // 1. Navbar displays user info
    if (navUsername) {
      navUsername.innerText = displayName;
    }
    if (navAvatar) {
      navAvatar.innerText = initial;
    }

    // 2. Unhide User Profile Details
    if (meUserProfileCard) {
      meUserProfileCard.style.display = 'flex';
      meUserProfileCard.classList.remove('hidden');
    }
    if (meGuestCard) {
      meGuestCard.style.display = 'none';
      meGuestCard.classList.add('hidden');
    }

    if (meDisplayName) {
      meDisplayName.innerText = displayName;
    }
    if (meEmailDisplay) {
      meEmailDisplay.innerText = displaySub;
    }
    if (meAvatarInitials) {
      meAvatarInitials.innerText = initial;
    }

    // Role badge
    if (meRoleBadge) {
      if (isAdmin) {
        meRoleBadge.innerText = 'SECRET ADMIN';
        meRoleBadge.className = 'text-[9px] font-black px-2 py-0.5 rounded-full bg-brand-cyan text-black uppercase tracking-wider shadow-neon-cyan';
      } else {
        meRoleBadge.innerText = 'VERIFIED VIEWER';
        meRoleBadge.className = 'text-[9px] font-black px-2 py-0.5 rounded-full bg-white/20 text-white uppercase tracking-wider';
      }
    }

    // 3. SECRET ADMIN CHECK:
    // If and ONLY IF user.email === 'vimleshkumar901559@gmail.com', then unhide/display Creator Studio.
    // For ANY other email or phone logins, this button MUST remain permanently hidden (display: none).
    if (meSecretAdminSection) {
      if (isAdmin) {
        meSecretAdminSection.style.display = 'block';
        meSecretAdminSection.classList.remove('hidden');
        meSecretAdminSection.innerHTML = `
          <div class="p-4 rounded-2xl bg-gradient-to-r from-brand-cyan/15 via-brand-purple/15 to-transparent border border-brand-cyan/50 space-y-2.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <i data-lucide="sparkle" class="w-4 h-4 text-brand-cyan animate-pulse"></i>
                <h4 class="font-black text-sm text-white">Creator Studio (Admin Control)</h4>
              </div>
              <span class="text-[9px] bg-brand-cyan text-black font-black px-2 py-0.5 rounded-full">VERIFIED ADMIN</span>
            </div>
            <p class="text-xs text-slate-300 leading-relaxed">
              Welcome <span class="text-brand-cyan font-bold">${user.displayName || user.email}</span>. Upload, batch-stage, and manage live published episodes in the <code class="text-brand-cyan font-mono">showverse_episodes</code> collection.
            </p>
            <button id="secret-creator-studio-btn" onclick="openCreatorStudio(); closeMeModal();" class="w-full py-2.5 px-4 rounded-xl bg-brand-cyan hover:bg-cyan-300 text-black font-black text-xs shadow-neon-cyan flex items-center justify-center gap-2 transition hover:scale-[1.01] mt-1 cursor-pointer">
              <i data-lucide="upload-cloud" class="w-4 h-4 fill-black"></i> Open Creator Studio Dashboard
            </button>
          </div>
        `;
      } else {
        meSecretAdminSection.style.display = 'none';
        meSecretAdminSection.classList.add('hidden');
        meSecretAdminSection.innerHTML = '';
      }
    }

    // 4. SHOW Watch History
    if (meWatchHistorySection) {
      meWatchHistorySection.style.display = 'block';
      meWatchHistorySection.classList.remove('hidden');
      if (typeof window.renderWatchHistory === 'function') {
        window.renderWatchHistory();
      }
    }

    // 5. Toggle Auth Action Panels: HIDE Guest panel, SHOW User panel (Sign Out)
    if (meGuestAuthPanel) {
      meGuestAuthPanel.style.display = 'none';
      meGuestAuthPanel.classList.add('hidden');
    }
    if (meUserAuthPanel) {
      meUserAuthPanel.style.display = 'block';
      meUserAuthPanel.classList.remove('hidden');
    }

  } else {
    // ---------------- DEFAULT GUEST STATE (LOGGED OUT) ----------------
    // 1. Navbar defaults to Guest state
    if (navUsername) {
      navUsername.innerText = 'Guest';
    }
    if (navAvatar) {
      navAvatar.innerText = '?';
    }

    // 2. HIDE user profile details (Name/Email/Avatar) & SHOW Guest header
    if (meUserProfileCard) {
      meUserProfileCard.style.display = 'none';
      meUserProfileCard.classList.add('hidden');
    }
    if (meGuestCard) {
      meGuestCard.style.display = 'flex';
      meGuestCard.classList.remove('hidden');
    }

    if (meDisplayName) meDisplayName.innerText = '';
    if (meEmailDisplay) meEmailDisplay.innerText = '';
    if (meAvatarInitials) meAvatarInitials.innerText = '';

    // 3. HIDE "Creator Studio (Admin)" button completely
    if (meSecretAdminSection) {
      meSecretAdminSection.style.display = 'none';
      meSecretAdminSection.classList.add('hidden');
      meSecretAdminSection.innerHTML = '';
    }

    // 4. HIDE "Watch History"
    if (meWatchHistorySection) {
      meWatchHistorySection.style.display = 'none';
      meWatchHistorySection.classList.add('hidden');
    }

    // 5. Toggle Auth Action Panels: SHOW Guest panel, HIDE User panel
    if (meGuestAuthPanel) {
      meGuestAuthPanel.style.display = 'block';
      meGuestAuthPanel.classList.remove('hidden');
    }
    if (meUserAuthPanel) {
      meUserAuthPanel.style.display = 'none';
      meUserAuthPanel.classList.add('hidden');
    }

    // Reset guest inputs & hide OTP container
    const emailInput = document.getElementById('authEmailInput');
    const passwordInput = document.getElementById('authPasswordInput');
    const phoneInput = document.getElementById('authPhoneInput');
    const otpInput = document.getElementById('authOtpInput');
    const otpContainer = document.getElementById('otpInputContainer');
    const sendOtpBtn = document.getElementById('sendOtpBtn');

    if (emailInput) emailInput.value = '';
    if (passwordInput) passwordInput.value = '';
    if (phoneInput) phoneInput.value = '';
    if (otpInput) otpInput.value = '';
    if (otpContainer) {
      otpContainer.style.display = 'none';
      otpContainer.classList.add('hidden');
    }
    if (sendOtpBtn) {
      sendOtpBtn.innerText = 'Send OTP';
    }
  }

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

/**
 * Triggers Google Sign In popup with Firebase Authentication
 */
export async function triggerGoogleSignIn() {
  if (!auth) {
    if (window.showToast) window.showToast("Firebase Authentication is not available.");
    return;
  }
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    currentUser = result.user;
    updateAuthUI(currentUser);
    if (window.showToast) {
      window.showToast(`Signed in as ${currentUser.displayName || currentUser.email}`);
    }
  } catch (error) {
    console.error("Google sign in error:", error);
    if (error && error.code !== 'auth/popup-closed-by-user' && window.showToast) {
      window.showToast(error.message || "Failed to sign in with Google.");
    }
  }
}

/**
 * Handles Email and Password Login
 */
export async function handleEmailLogin() {
  const emailInput = document.getElementById('authEmailInput');
  const passwordInput = document.getElementById('authPasswordInput');
  const email = emailInput ? emailInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value : '';

  if (!email || !password) {
    if (window.showToast) window.showToast("Please enter both email and password.");
    return;
  }
  if (!auth) {
    if (window.showToast) window.showToast("Firebase Authentication is not available.");
    return;
  }

  const loginBtn = document.getElementById('emailLoginBtn');
  const origText = loginBtn ? loginBtn.innerText : '';
  if (loginBtn) {
    loginBtn.innerText = "Logging in...";
    loginBtn.disabled = true;
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    currentUser = userCredential.user;
    updateAuthUI(currentUser);
    if (window.showToast) {
      window.showToast(`Logged in successfully as ${currentUser.email}`);
    }
  } catch (error) {
    console.error("Email login error:", error);
    let msg = error.message || "Failed to log in.";
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      msg = "Invalid email or password.";
    } else if (error.code === 'auth/invalid-email') {
      msg = "Please enter a valid email address.";
    }
    if (window.showToast) window.showToast(msg);
  } finally {
    if (loginBtn) {
      loginBtn.innerText = origText || "Login";
      loginBtn.disabled = false;
    }
  }
}

/**
 * Handles Email and Password Account Creation
 */
export async function handleEmailSignUp() {
  const emailInput = document.getElementById('authEmailInput');
  const passwordInput = document.getElementById('authPasswordInput');
  const email = emailInput ? emailInput.value.trim() : '';
  const password = passwordInput ? passwordInput.value : '';

  if (!email || !password) {
    if (window.showToast) window.showToast("Please enter both email and password.");
    return;
  }
  if (password.length < 6) {
    if (window.showToast) window.showToast("Password must be at least 6 characters.");
    return;
  }
  if (!auth) {
    if (window.showToast) window.showToast("Firebase Authentication is not available.");
    return;
  }

  const signUpBtn = document.getElementById('emailSignUpBtn');
  const origText = signUpBtn ? signUpBtn.innerText : '';
  if (signUpBtn) {
    signUpBtn.innerText = "Creating...";
    signUpBtn.disabled = true;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    currentUser = userCredential.user;
    updateAuthUI(currentUser);
    if (window.showToast) {
      window.showToast(`Account created and signed in as ${currentUser.email}!`);
    }
  } catch (error) {
    console.error("Email signup error:", error);
    let msg = error.message || "Failed to create account.";
    if (error.code === 'auth/email-already-in-use') {
      msg = "An account with this email already exists. Please click Login instead.";
    } else if (error.code === 'auth/weak-password') {
      msg = "Password is too weak. Please use at least 6 characters.";
    } else if (error.code === 'auth/invalid-email') {
      msg = "Please enter a valid email address.";
    }
    if (window.showToast) window.showToast(msg);
  } finally {
    if (signUpBtn) {
      signUpBtn.innerText = origText || "Create Account";
      signUpBtn.disabled = false;
    }
  }
}

/**
 * Helper to initialize or retrieve reCAPTCHA verifier for Phone Auth
 */
function getOrInitRecaptcha() {
  if (!auth) throw new Error("Firebase Authentication is not available.");
  
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA solved
      },
      'expired-callback': () => {
        if (window.showToast) window.showToast("reCAPTCHA verification expired. Please send OTP again.");
      }
    });
  }
  return recaptchaVerifier;
}

/**
 * Sends SMS OTP to the provided phone number
 */
export async function handleSendOtp() {
  const phoneInput = document.getElementById('authPhoneInput');
  let phoneNumber = phoneInput ? phoneInput.value.trim() : '';

  if (!phoneNumber) {
    if (window.showToast) window.showToast("Please enter a phone number with country code (e.g. +91 9876543210).");
    return;
  }

  // Ensure country code prefix '+'
  if (!phoneNumber.startsWith('+')) {
    phoneNumber = '+' + phoneNumber;
    if (phoneInput) phoneInput.value = phoneNumber;
  }

  if (!auth) {
    if (window.showToast) window.showToast("Firebase Authentication is not available.");
    return;
  }

  const sendOtpBtn = document.getElementById('sendOtpBtn');
  const origText = sendOtpBtn ? sendOtpBtn.innerText : '';
  if (sendOtpBtn) {
    sendOtpBtn.innerText = "Sending...";
    sendOtpBtn.disabled = true;
  }

  try {
    const verifier = getOrInitRecaptcha();
    confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, verifier);
    window.confirmationResult = confirmationResult;

    const otpContainer = document.getElementById('otpInputContainer');
    if (otpContainer) {
      otpContainer.style.display = 'block';
      otpContainer.classList.remove('hidden');
    }

    const authOtpInput = document.getElementById('authOtpInput');
    if (authOtpInput) {
      authOtpInput.focus();
    }

    if (sendOtpBtn) {
      sendOtpBtn.innerText = "Resend OTP";
    }

    if (window.showToast) {
      window.showToast(`Verification code sent to ${phoneNumber}!`);
    }
  } catch (error) {
    console.error("Error sending OTP:", error);
    if (recaptchaVerifier) {
      try {
        recaptchaVerifier.clear();
      } catch (_) {}
      recaptchaVerifier = null;
    }
    let msg = error.message || "Failed to send SMS code.";
    if (error.code === 'auth/invalid-phone-number') {
      msg = "Invalid phone number format. Please include country code (e.g. +91 9876543210).";
    } else if (error.code === 'auth/quota-exceeded') {
      msg = "SMS quota exceeded. Please try again later or use Google / Email sign in.";
    } else if (error.code === 'auth/too-many-requests') {
      msg = "Too many requests. Please wait a moment and try again.";
    }
    if (window.showToast) window.showToast(msg);
  } finally {
    if (sendOtpBtn) {
      if (sendOtpBtn.innerText === "Sending...") {
        sendOtpBtn.innerText = origText || "Send OTP";
      }
      sendOtpBtn.disabled = false;
    }
  }
}

/**
 * Verifies SMS OTP code and completes Phone Authentication
 */
export async function handleVerifyOtp() {
  const otpInput = document.getElementById('authOtpInput');
  const code = otpInput ? otpInput.value.trim() : '';

  if (!code) {
    if (window.showToast) window.showToast("Please enter the 6-digit verification code.");
    return;
  }

  const verifier = confirmationResult || window.confirmationResult;
  if (!verifier) {
    if (window.showToast) window.showToast("No pending OTP request. Please request OTP first.");
    return;
  }

  const verifyBtn = document.getElementById('verifyOtpBtn');
  const origText = verifyBtn ? verifyBtn.innerText : '';
  if (verifyBtn) {
    verifyBtn.innerText = "Verifying...";
    verifyBtn.disabled = true;
  }

  try {
    const result = await verifier.confirm(code);
    currentUser = result.user;
    updateAuthUI(currentUser);
    if (window.showToast) {
      window.showToast(`Phone verified successfully! Logged in as ${currentUser.phoneNumber || 'User'}`);
    }
  } catch (error) {
    console.error("Error verifying OTP:", error);
    let msg = error.message || "Invalid OTP code.";
    if (error.code === 'auth/invalid-verification-code') {
      msg = "Incorrect OTP code. Please check and try again.";
    } else if (error.code === 'auth/code-expired') {
      msg = "Verification code has expired. Please request a new OTP.";
    }
    if (window.showToast) window.showToast(msg);
  } finally {
    if (verifyBtn) {
      verifyBtn.innerText = origText || "Verify OTP";
      verifyBtn.disabled = false;
    }
  }
}

/**
 * Properly signs out from Firebase, clearing state and reverting immediately to default Guest UI
 */
export async function handleSignOut() {
  if (auth) {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn("Sign out warning:", e);
    }
  }
  currentUser = null;
  confirmationResult = null;
  window.confirmationResult = null;
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear();
    } catch (_) {}
    recaptchaVerifier = null;
  }
  updateAuthUI(null);

  // If Creator Studio was open, immediately close it
  const creatorStudioModal = document.getElementById('creatorStudioModal');
  if (creatorStudioModal) {
    creatorStudioModal.classList.add('hidden');
  }

  if (window.showToast) {
    window.showToast("Signed out successfully. Guest mode activated.");
  }
}

/**
 * Guarded opener for Creator Studio. Strict admin email check.
 */
export function openCreatorStudio() {
  if (!isAuthorizedAdmin(currentUser)) {
    if (window.showToast) {
      window.showToast("Access Denied: Creator Studio is restricted to authorized admin.");
    }
    return;
  }
  const modal = document.getElementById('creatorStudioModal');
  if (modal) modal.classList.remove('hidden');
  if (typeof window.handleCategoryChange === 'function') window.handleCategoryChange();
  if (typeof window.renderStagedBatchQueue === 'function') window.renderStagedBatchQueue();
  if (typeof window.initPublishedContentManager === 'function') window.initPublishedContentManager();
}

export function closeCreatorStudio() {
  const modal = document.getElementById('creatorStudioModal');
  if (modal) modal.classList.add('hidden');
}

// Attach onAuthStateChanged listener to track real-time Firebase Auth status
if (auth) {
  try {
    onAuthStateChanged(auth, (user) => {
      updateAuthUI(user);
    });
  } catch (e) {
    console.warn("onAuthStateChanged setup warning:", e);
    updateAuthUI(null);
  }
} else {
  // Ensure default guest state if auth is not initialized
  updateAuthUI(null);
}

// Export to window for HTML onclick bindings
if (typeof window !== "undefined") {
  window.triggerGoogleSignIn = triggerGoogleSignIn;
  window.handleEmailLogin = handleEmailLogin;
  window.handleEmailSignUp = handleEmailSignUp;
  window.handleSendOtp = handleSendOtp;
  window.handleVerifyOtp = handleVerifyOtp;
  window.handleSignOut = handleSignOut;
  window.openCreatorStudio = openCreatorStudio;
  window.closeCreatorStudio = closeCreatorStudio;
  window.isAuthorizedAdmin = isAuthorizedAdmin;
  window.updateAuthUI = updateAuthUI;
  window.SECRET_ADMIN_EMAIL = SECRET_ADMIN_EMAIL;
}

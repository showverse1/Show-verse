// auth.js - Firebase Authentication & Strict Admin Security Engine
import { auth } from "./firebase.js";
import { 
  onAuthStateChanged, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "firebase/auth";

// STRICT ADMIN EMAIL: Only this exact email is granted Creator Studio / Admin permissions
export const SECRET_ADMIN_EMAIL = 'vimleshkumar901559@gmail.com';

// Currently authenticated user (null by default = Guest state)
export let currentUser = null;

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
    const displayName = user.displayName || (user.email ? user.email.split('@')[0] : 'User');
    const displaySub = user.email || '';
    const initial = (user.displayName || user.email || 'U')[0].toUpperCase();

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

    // Reset guest inputs
    const emailInput = document.getElementById('authEmailInput');
    const passwordInput = document.getElementById('authPasswordInput');

    if (emailInput) emailInput.value = '';
    if (passwordInput) passwordInput.value = '';
  }

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
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
  if (typeof window.fetchAndDisplayManageContent === 'function') window.fetchAndDisplayManageContent();
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
  window.handleEmailLogin = handleEmailLogin;
  window.handleEmailSignUp = handleEmailSignUp;
  window.handleSignOut = handleSignOut;
  window.openCreatorStudio = openCreatorStudio;
  window.closeCreatorStudio = closeCreatorStudio;
  window.isAuthorizedAdmin = isAuthorizedAdmin;
  window.updateAuthUI = updateAuthUI;
  window.SECRET_ADMIN_EMAIL = SECRET_ADMIN_EMAIL;
}

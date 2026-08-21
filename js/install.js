/**
 * ODDINARY — ADD TO HOMESCREEN / INSTALL PROMPT
 * Shows platform-specific install instructions when user clicks "Install App".
 */

const InstallPrompt = (() => {
  let deferredPrompt = null;

  function isInstalled() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || window.matchMedia('(display-mode: fullscreen)').matches
      || window.matchMedia('(display-mode: minimal-ui)').matches
      || window.matchMedia('(display-mode: window-controls-overlay)').matches
      || navigator.standalone === true
      || (document.referrer && document.referrer.startsWith('android-app://'));

    const isMarkedInstalled = localStorage.getItem('oddinary_app_installed') === 'true';

    return isStandalone || isMarkedInstalled;
  }

  function hideInstallLink() {
    const link = document.getElementById('install-app-link');
    const sep = document.getElementById('install-link-separator');
    if (link) link.style.display = 'none';
    if (sep) sep.style.display = 'none';
  }

  function checkRelatedApps() {
    if ('getInstalledRelatedApps' in navigator) {
      navigator.getInstalledRelatedApps().then(apps => {
        if (apps && apps.length > 0) {
          localStorage.setItem('oddinary_app_installed', 'true');
          hideInstallLink();
        }
      }).catch(() => {});
    }
  }

  // --- Platform Detection ---
  function getPlatform() {
    if (isInstalled()) return 'standalone';

    const ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    if (/Windows/i.test(ua)) return 'windows';
    return 'desktop';
  }

  // --- Instructions per platform ---
  function getInstructions(platform, hasNativePrompt) {
    switch (platform) {
      case 'android':
        return {
          title: 'Install Oddinary',
          subtitle: 'Add to your home screen for the full app experience',
          steps: hasNativePrompt
            ? [
                { text: 'Tap the <strong>Install</strong> button below', icon: '📲' },
                { text: 'Confirm in the browser popup', icon: '✅' },
                { text: 'Launch Oddinary from your home screen!', icon: '🚀' }
              ]
            : [
                { text: 'Tap <strong>⋮</strong> (menu) in your browser', icon: '1' },
                { text: 'Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>', icon: '2' },
                { text: 'Launch Oddinary from your home screen!', icon: '🚀' }
              ],
          canAutoInstall: true
        };

      case 'ios':
        return {
          title: 'Add to Home Screen',
          subtitle: 'Get the full-screen app experience on your iPhone',
          steps: [
            { text: 'Tap the <strong>Share</strong> button <span class="install-inline-icon">⎋</span> in Safari\'s toolbar', icon: '1' },
            { text: 'Scroll down and tap <strong>"Add to Home Screen"</strong>', icon: '2' },
            { text: 'Tap <strong>"Add"</strong> in the top-right corner', icon: '3' }
          ],
          canAutoInstall: false
        };

      case 'windows':
        return {
          title: 'Install Oddinary',
          subtitle: 'Pin Oddinary to your Start Menu or Taskbar',
          steps: hasNativePrompt
            ? [
                { text: 'Click the <strong>Install</strong> button below', icon: '📲' },
                { text: 'Confirm in the browser popup', icon: '✅' },
                { text: 'Launch from your Desktop or Start Menu!', icon: '🚀' }
              ]
            : [
                { text: 'Look for the <strong>Install</strong> icon <span class="install-inline-icon">⊕</span> in the address bar and click it', icon: '1' },
                { text: 'Or click <strong>⋮ Menu → Install Oddinary</strong> in Chrome/Edge', icon: '2' },
                { text: 'Launch from your Desktop or Start Menu!', icon: '🚀' }
              ],
          canAutoInstall: true
        };

      default:
        return {
          title: 'Install Oddinary',
          subtitle: 'Install the app for the best experience',
          steps: hasNativePrompt
            ? [
                { text: 'Click the <strong>Install</strong> button below', icon: '📲' },
                { text: 'Confirm in the browser popup', icon: '✅' },
                { text: 'Open from your Applications!', icon: '🚀' }
              ]
            : [
                { text: 'Click the <strong>Install</strong> icon in your browser\'s address bar', icon: '1' },
                { text: 'Or use <strong>Menu → Install Oddinary</strong>', icon: '2' },
                { text: 'Open from your Applications!', icon: '🚀' }
              ],
          canAutoInstall: true
        };
    }
  }

  // --- Render & open the modal ---
  function renderModal(platform) {
    // Remove any existing one first
    const existing = document.getElementById('modal-install');
    if (existing) existing.remove();

    const hasNativePrompt = deferredPrompt !== null;
    const info = getInstructions(platform, hasNativePrompt);

    const stepsHTML = info.steps.map(s => `
      <div class="install-step">
        <span class="install-step-num">${s.icon}</span>
        <span class="install-step-text">${s.text}</span>
      </div>
    `).join('');

    let actionsHTML;
    if (hasNativePrompt) {
      actionsHTML = `<button class="btn btn-primary install-btn" onclick="InstallPrompt.doInstall()">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;margin-right:6px;"><path d="M12 5v14m0 0l-4-4m4 4l4-4"/><path d="M4 19h16"/></svg>
           Install Now
         </button>
         <button class="btn install-dismiss-btn" onclick="InstallPrompt.close()">Not Now</button>`;
    } else if (info.canAutoInstall) {
      actionsHTML = `<button class="btn btn-primary install-btn" id="install-confirm-btn" onclick="InstallPrompt.doInstall()">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;margin-right:6px;"><path d="M12 5v14m0 0l-4-4m4 4l4-4"/><path d="M4 19h16"/></svg>
           Install Now
         </button>
         <button class="btn install-dismiss-btn" onclick="InstallPrompt.close()">Not Now</button>`;
    } else {
      actionsHTML = `<button class="btn btn-primary install-btn" onclick="InstallPrompt.close()">Got It</button>`;
    }

    const modal = document.createElement('div');
    modal.id = 'modal-install';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content install-modal-content">
        <button class="install-close-btn" onclick="InstallPrompt.close()" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <div class="install-hero">
          <div class="install-icon-wrapper">
            <img src="assets/fav-icon.png" alt="Oddinary" class="install-app-icon">
          </div>
          <h2 class="install-title">${info.title}</h2>
          <p class="install-subtitle">${info.subtitle}</p>
        </div>
        <div class="install-steps">
          ${stepsHTML}
        </div>
        <div class="install-actions">
          ${actionsHTML}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    if (!hasNativePrompt && info.canAutoInstall) {
      const lateListener = (e) => {
        e.preventDefault();
        deferredPrompt = e;
        window.removeEventListener('beforeinstallprompt', lateListener);
      };
      window.addEventListener('beforeinstallprompt', lateListener);
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => modal.classList.add('open'));
    });
  }

  // --- Public API ---
  return {
    init() {
      if (isInstalled()) {
        hideInstallLink();
        return;
      }

      checkRelatedApps();

      // Capture native install prompt
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
      });

      // Listen for app installation completion
      window.addEventListener('appinstalled', () => {
        localStorage.setItem('oddinary_app_installed', 'true');
        hideInstallLink();
        deferredPrompt = null;
      });

      // Listen for standalone display-mode match
      try {
        window.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => {
          if (e.matches) {
            localStorage.setItem('oddinary_app_installed', 'true');
            hideInstallLink();
          }
        });
      } catch (err) {}
    },

    show() {
      if (isInstalled()) {
        hideInstallLink();
        return;
      }
      const platform = getPlatform();
      if (platform === 'standalone') return;
      if (typeof AudioEngine !== 'undefined') AudioEngine.play('click');
      renderModal(platform);
    },

    async doInstall() {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const result = await deferredPrompt.userChoice;
        if (result.outcome === 'accepted') {
          localStorage.setItem('oddinary_app_installed', 'true');
          hideInstallLink();
          const modal = document.getElementById('modal-install');
          if (modal) {
            modal.classList.remove('open');
            setTimeout(() => modal.remove(), 300);
          }
        }
        deferredPrompt = null;
      } else {
        const btn = document.getElementById('install-confirm-btn');
        if (btn) {
          btn.outerHTML = `<p style="font-size: 0.85rem; color: var(--text-sec); text-align: center; padding: 8px 0; margin: 0; line-height: 1.5;">
            Look for the <strong style="color: var(--text-main);">Install</strong> icon <span class="install-inline-icon">⊕</span> in your browser's address bar, or use the browser menu to install.
          </p>`;
        }
      }
    },

    close() {
      const modal = document.getElementById('modal-install');
      if (modal) {
        modal.classList.remove('open');
        setTimeout(() => modal.remove(), 300);
      }
    }
  };
})();

// Auto-run init on document load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => InstallPrompt.init());
} else {
  InstallPrompt.init();
}

// --- Prevent Mobile Horizontal Edge-Swipe Navigation & Top Pull-Down Displacement ---
(() => {
  let touchStartX = 0;
  let touchStartY = 0;

  window.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (!e.touches || e.touches.length !== 1) return;

    const target = e.target;
    // Allow horizontal dragging inside range sliders (e.g. timer duration slider)
    const isRangeSlider = target && (target.tagName === 'INPUT' && target.type === 'range' || (target.closest && target.closest('.slider-input')));

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - touchStartX;
    const deltaY = currentY - touchStartY;

    // 1. Prevent Edge Swipe Navigation (swipe right starting near left screen edge)
    if (!isRangeSlider && touchStartX < 60 && deltaX > 5) {
      if (e.cancelable) e.preventDefault();
      return;
    }

    // 2. Prevent general horizontal swiping if horizontal movement is dominant
    if (!isRangeSlider && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      if (e.cancelable) e.preventDefault();
      return;
    }

    // 3. Prevent top pull-down overscroll displacement
    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    if (scrollTop <= 0 && deltaY > 0) {
      let node = target;
      let isInsideScrolledElement = false;
      while (node && node !== document.body && node !== document.documentElement) {
        if (node.scrollTop > 0) {
          isInsideScrolledElement = true;
          break;
        }
        node = node.parentElement;
      }
      if (!isInsideScrolledElement && e.cancelable) {
        e.preventDefault();
      }
    }
  }, { passive: false });
})();

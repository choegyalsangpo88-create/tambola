import { useState, useEffect } from 'react';
import { X, Share, Plus, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * PWA Install Prompt Component
 * Shows installation instructions for iOS and Android
 */
export default function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    // Check if running as standalone (already installed)
    const standalone = window.matchMedia('(display-mode: standalone)').matches || 
                       window.navigator.standalone === true;
    setIsStandalone(standalone);

    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    // Check if user has dismissed prompt before
    const dismissed = localStorage.getItem('pwa-prompt-dismissed');
    const dismissedTime = dismissed ? parseInt(dismissed) : 0;
    const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);

    // Show prompt if not standalone and not recently dismissed
    if (!standalone && daysSinceDismissed > 7) {
      // Delay showing prompt to not interrupt initial page load
      setTimeout(() => setShowPrompt(true), 3000);
    }

    // Listen for beforeinstallprompt event (Android/Chrome)
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
    setShowPrompt(false);
  };

  // Don't show if already installed or no prompt to show
  if (isStandalone || !showPrompt) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[200] p-4 animate-slide-up">
      <div className="max-w-md mx-auto bg-gradient-to-br from-[#0a3d32] to-[#063325] rounded-2xl shadow-2xl border border-white/10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img 
              src="/icons/icon-48x48.png" 
              alt="67 Tambola" 
              className="w-10 h-10 rounded-xl"
            />
            <div>
              <h3 className="font-bold text-white text-sm">67 Tambola</h3>
              <p className="text-[10px] text-gray-400">Install for better experience</p>
            </div>
          </div>
          <button 
            onClick={handleDismiss}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {isIOS ? (
            // iOS Instructions - Simplified with visual share button
            <div className="space-y-4">
              <p className="text-sm text-white text-center font-medium">
                Install this app on your iPhone
              </p>
              
              {/* Visual Share Button */}
              <div className="flex flex-col items-center gap-2 py-3">
                <p className="text-xs text-gray-400">Tap this button in Safari:</p>
                <div className="bg-white/10 rounded-xl px-6 py-3 flex items-center gap-3">
                  {/* iOS Share Icon - Accurate representation */}
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-blue-400">
                    <path d="M12 2L12 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M8 6L12 2L16 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M4 14V18C4 19.1046 4.89543 20 6 20H18C19.1046 20 20 19.1046 20 18V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <span className="text-white font-medium">Share</span>
                </div>
                <p className="text-[10px] text-gray-500">Found at the bottom of Safari browser</p>
              </div>

              {/* Simple 2-step instruction */}
              <div className="bg-white/5 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">1</div>
                  <p className="text-sm text-white">Tap <span className="text-blue-400 font-bold">Share</span> button below</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 bg-amber-500 rounded-full flex items-center justify-center text-white font-bold text-sm">2</div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-white">Tap</p>
                    <span className="bg-white/20 px-2 py-1 rounded text-xs text-white flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Add to Home Screen
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Android/Chrome - Direct Install
            <div className="space-y-3">
              <p className="text-sm text-gray-300 text-center">
                Install 67 Tambola for quick access and offline play!
              </p>
              <div className="flex flex-col gap-2">
                <ul className="text-xs text-gray-400 space-y-1 mb-2">
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">✓</span> Quick launch from home screen
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">✓</span> Full-screen experience
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">✓</span> Works offline
                  </li>
                </ul>
                {deferredPrompt ? (
                  <Button 
                    onClick={handleInstall}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Install App
                  </Button>
                ) : (
                  <p className="text-xs text-center text-gray-500">
                    Open in Chrome and tap the menu (⋮) → "Add to Home Screen"
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pb-4">
          <button 
            onClick={handleDismiss}
            className="w-full text-xs text-gray-500 hover:text-gray-400 py-2"
          >
            Maybe later
          </button>
        </div>
      </div>

      {/* Animation styles */}
      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

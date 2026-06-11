import React, { useState, useEffect } from 'react';

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Agar app pehle se installed hai toh prompt mat dikhao
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      return;
    }

    const handler = (e) => {
      // Browser ka default prompt roko
      e.preventDefault();
      // Event ko save karo taaki button click par use kar sakein
      setDeferredPrompt(e);
      setShow(true);
      console.log('✅ PWA Install event captured');
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Jab app install ho jaye toh button hata do
    window.addEventListener('appinstalled', () => {
      setShow(false);
      setDeferredPrompt(null);
      console.log('🚀 PWA installed successfully');
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    // Native install dialog dikhao
    deferredPrompt.prompt();
    
    // User ke choice ka wait karo
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install: ${outcome}`);
    
    if (outcome === 'accepted') {
      setShow(false);
    }
    setDeferredPrompt(null);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-slate-800 border border-indigo-500/30 rounded-xl shadow-2xl p-5 z-50">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm">Install App</h3>
            <p className="text-xs text-slate-400">Add to home screen</p>
          </div>
        </div>
        <button onClick={() => setShow(false)} className="text-slate-400 hover:text-white">✕</button>
      </div>
      <button onClick={handleInstall} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
        Install Now
      </button>
    </div>
  );
};

export default InstallPrompt;
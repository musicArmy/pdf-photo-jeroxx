import React, { useState, useEffect } from 'react';
import { Language } from '../types';
import { getUserConsentStatus, setUserConsentStatus, getClientTag } from '../utils/cloudSync';
import { Cloud, ShieldCheck, Check, Sparkles } from 'lucide-react';

interface CloudConsentBannerProps {
  language: Language;
}

export const CloudConsentBanner: React.FC<CloudConsentBannerProps> = ({ language }) => {
  const [consentStatus, setConsentStatus] = useState<boolean | null>(() => getUserConsentStatus());

  useEffect(() => {
    const handleUpdate = () => {
      setConsentStatus(getUserConsentStatus());
    };
    window.addEventListener('cloud-consent-updated', handleUpdate);
    return () => window.removeEventListener('cloud-consent-updated', handleUpdate);
  }, []);

  // If already allowed (consentStatus === true) or explicitly set on this device, don't show modal
  if (consentStatus !== null) {
    return null;
  }

  const handleAccept = () => {
    setUserConsentStatus(true);
    setConsentStatus(true);
  };

  return (
    <div
      id="cloud-consent-modal-overlay"
      className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 animate-fade-in"
    >
      <div
        id="cloud-consent-card"
        className="max-w-lg w-full bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-purple-500/80 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(168,85,247,0.35)] text-center relative overflow-hidden"
      >
        {/* Glow ambient background effect */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-purple-600/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-600/30 rounded-full blur-3xl pointer-events-none" />

        {/* Central App / Cloud Icon */}
        <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-tr from-purple-600 to-indigo-500 p-0.5 mx-auto mb-5 shadow-xl shadow-purple-600/40">
          <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center text-purple-400">
            <Cloud className="w-10 h-10 text-purple-400 animate-pulse" />
          </div>
          <span className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-emerald-500 text-white shadow-md">
            <Sparkles className="w-3.5 h-3.5" />
          </span>
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs font-black tracking-wide mb-3">
          <ShieldCheck className="w-4 h-4 text-purple-400" />
          <span>{language === 'hi' ? 'स्टूडियो क्लाउड सुरक्षा' : 'STUDIO CLOUD SYNC'}</span>
        </div>

        {/* Primary Prompt Heading & Message - Exact user text */}
        <div className="bg-slate-950/80 p-5 rounded-2xl border border-purple-500/30 mb-6 text-center space-y-3 shadow-inner">
          <p className="text-base sm:text-lg font-bold text-white leading-relaxed">
            {language === 'hi'
              ? 'क्या आप इसे इतिहास के लिए सिंक करना चाहते हैं? यदि हाँ, तो “अनुमति दें (Allow)” पर क्लिक करें, ताकि आप इसे इतिहास में कभी भी डाउनलोड कर सकें।'
              : 'Do you want to sync this for history? If yes, click "Allow", so you can download it anytime from history.'}
          </p>
        </div>

        {/* Large Allow Button */}
        <div className="space-y-3">
          <button
            id="btn-allow-consent"
            onClick={handleAccept}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-base sm:text-lg font-black tracking-wide shadow-xl shadow-purple-600/40 hover:shadow-purple-500/60 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2.5 border border-purple-400/40"
          >
            <Check className="w-6 h-6 stroke-[3]" />
            <span>{language === 'hi' ? 'अनुमति दें (Allow)' : 'Allow'}</span>
          </button>
        </div>

        {/* Device note */}
        <div className="mt-5 pt-3 border-t border-slate-800/80 text-[11px] font-semibold text-slate-400 flex items-center justify-center gap-2">
          <span>{language === 'hi' ? '✓ एक बार अनुमति देने के बाद यह दोबारा स्क्रीन पर कभी नहीं आएगा' : '✓ Once allowed, this will never appear on your screen again'}</span>
        </div>
      </div>
    </div>
  );
};

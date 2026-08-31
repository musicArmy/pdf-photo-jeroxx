import React, { useState, useEffect } from 'react';
import { AppTab, Language } from '../types';
import { translations } from '../utils/i18n';
import { FileImage, FileText, UserSquare2, CreditCard, Languages, Sparkles, History, ShieldCheck } from 'lucide-react';
import { getAllHistory } from '../utils/historyStorage';

interface NavbarProps {
  currentTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  language,
  onLanguageChange,
}) => {
  const t = translations[language];
  const [historyCount, setHistoryCount] = useState<number>(0);
  const [logoClicks, setLogoClicks] = useState<number>(0);

  const handleLogoClick = () => {
    const nextClicks = logoClicks + 1;
    setLogoClicks(nextClicks);
    if (nextClicks >= 5) {
      setLogoClicks(0);
      onTabChange('admin');
    } else {
      if (currentTab !== 'id-card-print') {
        onTabChange('id-card-print');
      }
    }
  };

  useEffect(() => {
    const updateCount = async () => {
      try {
        const list = await getAllHistory();
        setHistoryCount(list.length);
      } catch {}
    };

    updateCount();

    const handleUpdate = () => {
      updateCount();
    };

    window.addEventListener('history-updated', handleUpdate);
    return () => {
      window.removeEventListener('history-updated', handleUpdate);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo & Branding */}
          <div
            onClick={handleLogoClick}
            className="flex items-center gap-3 cursor-pointer select-none"
            title={language === 'hi' ? 'PhototoPDF Studio (ओनर सीक्रेट: 5 बार टैप करें)' : 'PhototoPDF Studio (Owner Secret: Tap 5 times)'}
          >
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/20 text-white font-bold text-lg">
              <FileImage className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                  {t.appTitle}
                </span>
                <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  <Sparkles className="w-3 h-3" />
                  300 DPI Studio
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                {t.appSubtitle}
              </p>
            </div>
          </div>

          {/* Navigation Tabs (Desktop) */}
          <nav className="hidden lg:flex items-center gap-1.5 p-1 bg-slate-950/70 border border-slate-800/80 rounded-xl">
            <button
              id="tab-id-card-print"
              onClick={() => onTabChange('id-card-print')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all relative ${
                currentTab === 'id-card-print'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <CreditCard className="w-4 h-4 text-purple-300" />
              <span>{t.tabIdCardPrint}</span>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-purple-400/30 text-purple-200 border border-purple-400/40">
                {t.badgePopular}
              </span>
            </button>

            <button
              id="tab-passport-photo"
              onClick={() => onTabChange('passport-photo')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all relative ${
                currentTab === 'passport-photo'
                  ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md shadow-amber-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <UserSquare2 className="w-4 h-4 text-amber-300" />
              <span>{t.tabPassportPhoto}</span>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-amber-400/30 text-amber-200 border border-amber-400/40">
                Top 6
              </span>
            </button>

            <button
              id="tab-photo-to-pdf"
              onClick={() => onTabChange('photo-to-pdf')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                currentTab === 'photo-to-pdf'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <FileImage className="w-4 h-4 text-cyan-300" />
              <span>{t.tabPhotoToPdf}</span>
            </button>

            <button
              id="tab-pdf-to-photo"
              onClick={() => onTabChange('pdf-to-photo')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                currentTab === 'pdf-to-photo'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <FileText className="w-4 h-4 text-emerald-300" />
              <span>{t.tabPdfToPhoto}</span>
            </button>

            <button
              id="tab-history"
              onClick={() => onTabChange('history')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all relative ${
                currentTab === 'history'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <History className="w-4 h-4 text-emerald-400" />
              <span>{language === 'hi' ? 'इतिहास' : 'History'}</span>
              {historyCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-400/30 text-emerald-200 border border-emerald-400/40">
                  {historyCount}
                </span>
              )}
            </button>

            {/* Owner Tab - Hidden from public visitors for privacy, accessible to owner */}
            {currentTab === 'admin' && (
              <button
                id="tab-admin"
                onClick={() => onTabChange('admin')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all bg-purple-600 text-white shadow-md shadow-purple-600/30"
                title="Owner / Admin Portal"
              >
                <ShieldCheck className="w-4 h-4 text-purple-200" />
                <span>{language === 'hi' ? 'ओनर पोर्टल' : 'Admin'}</span>
              </button>
            )}
          </nav>

          {/* Right actions: History quick button & Language toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onTabChange('history')}
              className={`lg:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                currentTab === 'history'
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-slate-800/90 text-slate-200 border-slate-700/60 hover:bg-slate-700/90'
              }`}
            >
              <History className="w-3.5 h-3.5 text-emerald-400" />
              <span>{language === 'hi' ? 'इतिहास' : 'History'}</span>
              {historyCount > 0 && (
                <span className="text-[10px] bg-emerald-500 text-white px-1.5 rounded-full font-bold">
                  {historyCount}
                </span>
              )}
            </button>

            <button
              id="lang-toggle-btn"
              onClick={() => onLanguageChange(language === 'hi' ? 'en' : 'hi')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700/90 text-xs sm:text-sm font-medium text-slate-200 border border-slate-700/60 transition-colors"
              title="Switch Language / भाषा बदलें"
            >
              <Languages className="w-3.5 h-3.5 text-purple-400" />
              <span className="font-semibold">{language === 'hi' ? 'English' : 'हिंदी'}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs (Mobile bottom row) - 5 clean public user tools */}
        <div className="flex lg:hidden grid grid-cols-5 gap-1 py-2 border-t border-slate-800/60">
          <button
            onClick={() => onTabChange('id-card-print')}
            className={`flex flex-col items-center justify-center gap-1 p-1 rounded-lg text-[9px] font-semibold text-center transition-all ${
              currentTab === 'id-card-print'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white bg-slate-950/40'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span className="truncate">Aadhaar</span>
          </button>

          <button
            onClick={() => onTabChange('passport-photo')}
            className={`flex flex-col items-center justify-center gap-1 p-1 rounded-lg text-[9px] font-semibold text-center transition-all ${
              currentTab === 'passport-photo'
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white bg-slate-950/40'
            }`}
          >
            <UserSquare2 className="w-3.5 h-3.5" />
            <span className="truncate">Passport</span>
          </button>

          <button
            onClick={() => onTabChange('photo-to-pdf')}
            className={`flex flex-col items-center justify-center gap-1 p-1 rounded-lg text-[9px] font-semibold text-center transition-all ${
              currentTab === 'photo-to-pdf'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white bg-slate-950/40'
            }`}
          >
            <FileImage className="w-3.5 h-3.5" />
            <span className="truncate">Img→PDF</span>
          </button>

          <button
            onClick={() => onTabChange('pdf-to-photo')}
            className={`flex flex-col items-center justify-center gap-1 p-1 rounded-lg text-[9px] font-semibold text-center transition-all ${
              currentTab === 'pdf-to-photo'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white bg-slate-950/40'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="truncate">PDF→Img</span>
          </button>

          <button
            onClick={() => onTabChange('history')}
            className={`flex flex-col items-center justify-center gap-1 p-1 rounded-lg text-[9px] font-semibold text-center transition-all relative ${
              currentTab === 'history'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white bg-slate-950/40'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span className="truncate">{language === 'hi' ? 'इतिहास' : 'History'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};


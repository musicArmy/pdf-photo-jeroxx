/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppTab, Language } from './types';
import { translations } from './utils/i18n';
import { Navbar } from './components/Navbar';
import { PhotoToPdfTab } from './components/PhotoToPdfTab';
import { PdfToPhotoTab } from './components/PdfToPhotoTab';
import { PassportPhotoTab } from './components/PassportPhotoTab';
import { IdCardPrintTab } from './components/IdCardPrintTab';
import { HistoryTab } from './components/HistoryTab';
import { AdminPortalTab } from './components/AdminPortalTab';
import {
  CreditCard,
  Printer,
  ShieldCheck,
} from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<AppTab>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tab') === 'admin' || params.has('admin_view')) {
        return 'admin';
      }
    } catch {}
    return 'id-card-print';
  });
  const [language, setLanguage] = useState<Language>('hi');
  const t = translations[language];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-purple-600 selection:text-white">
      {/* Top Navigation Bar with Left-to-Right Feature Tabs */}
      <Navbar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        language={language}
        onLanguageChange={setLanguage}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Active Tab View */}
        <div className="transition-all duration-200">
          {currentTab === 'id-card-print' && <IdCardPrintTab language={language} />}
          {currentTab === 'passport-photo' && <PassportPhotoTab language={language} />}
          {currentTab === 'photo-to-pdf' && <PhotoToPdfTab language={language} />}
          {currentTab === 'pdf-to-photo' && <PdfToPhotoTab language={language} />}
          {currentTab === 'history' && <HistoryTab language={language} onNavigateTab={setCurrentTab} />}
          {currentTab === 'admin' && <AdminPortalTab language={language} />}
        </div>

        {/* Features / FAQ Bar */}
        <section className="mt-12 pt-8 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="flex items-start gap-3 bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">
                {language === 'hi' ? 'आधार व कार्ड ज़ेरॉक्स (A4)' : 'ID Card & Aadhaar Xerox'}
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                {language === 'hi'
                  ? 'A4 शीट पर फ्रंट और बैक फोटो साइबर कैफ़े स्टाइल में 1 या 2 कॉपी आसानी से सेट करें।'
                  : 'Front & Back card xerox layout with 1 or 2 copies on a single A4 page.'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">
                {language === 'hi' ? '300 DPI स्टूडियो प्रिंटिंग' : '300 DPI Studio Quality'}
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                {language === 'hi'
                  ? 'A4 पेपर पर पासपोर्ट और आईडी कार्ड असली साइज में सीधे प्रिंटर से निकालें।'
                  : 'Exact dimension scaling ready for direct printer output on standard A4 paper.'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">
                {language === 'hi' ? '100% सुरक्षित और प्राइवेट' : '100% Client-Side & Private'}
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                {language === 'hi'
                  ? 'सभी डॉक्यूमेंट और फोटो आपके अपने ब्राउज़र में सुरक्षित प्रोसेस होती हैं।'
                  : 'All processing runs client-side inside your browser for complete data privacy.'}
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <p>
          Aadhaar & ID Card Xerox • 6-Passport Photo Studio • PDF & Image Tools • {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}

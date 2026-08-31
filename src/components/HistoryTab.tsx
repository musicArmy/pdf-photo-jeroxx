import React, { useState, useEffect } from 'react';
import { HistoryItem, Language, AppTab } from '../types';
import { getAllHistory, deleteHistoryItem, clearAllHistory } from '../utils/historyStorage';
import {
  History,
  Trash2,
  Download,
  FileDown,
  Printer,
  Search,
  Eye,
  CreditCard,
  UserSquare2,
  FileImage,
  FileText,
  Sparkles,
  X,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface HistoryTabProps {
  language: Language;
  onNavigateTab?: (tab: AppTab) => void;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({ language, onNavigateTab }) => {
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all');
  const [previewItem, setPreviewItem] = useState<HistoryItem | null>(null);
  
  // Custom in-app confirmation dialog state (replaces window.confirm)
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ id: string; title: string } | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const items = await getAllHistory();
      setHistoryList(items);
    } catch (e) {
      console.error('Failed to load history', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();

    const handleUpdate = () => {
      loadHistory();
    };

    window.addEventListener('history-updated', handleUpdate);
    return () => {
      window.removeEventListener('history-updated', handleUpdate);
    };
  }, []);

  const openDeleteConfirm = (item: HistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmTarget({ id: item.id, title: item.title });
  };

  const executeDelete = async () => {
    if (!deleteConfirmTarget) return;
    const targetId = deleteConfirmTarget.id;
    
    // 1. Optimistic UI update (instant disappearance)
    setHistoryList((prev) => prev.filter((item) => item.id !== targetId));
    if (previewItem?.id === targetId) setPreviewItem(null);
    setDeleteConfirmTarget(null);

    // 2. Perform deletion in storage
    try {
      await deleteHistoryItem(targetId);
      showToast(language === 'hi' ? 'सफलतापूर्वक डिलीट किया गया' : 'Item deleted successfully');
    } catch (err) {
      console.error('Failed to delete item', err);
    }
  };

  const executeClearAll = async () => {
    setShowClearAllConfirm(false);
    
    // 1. Optimistic UI clear
    setHistoryList([]);
    setPreviewItem(null);

    // 2. Perform storage wipe
    try {
      await clearAllHistory();
      showToast(language === 'hi' ? 'पूरा इतिहास साफ कर दिया गया' : 'All history cleared');
    } catch (err) {
      console.error('Failed to clear history', err);
    }
  };

  const handleDownloadImage = (item: HistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = item.fullImageDataUrl || item.thumbnailUrl;
    if (!url) return;

    const link = document.createElement('a');
    link.href = url;
    link.download = `${item.title.replace(/\s+/g, '_').toLowerCase()}_4k.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    confetti({ particleCount: 50, spread: 50, origin: { y: 0.6 } });
    showToast(language === 'hi' ? 'HD फोटो डाउनलोड शुरू हो गया' : 'HD photo downloading');
  };

  const handleDownloadPdf = (item: HistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.pdfDataUrl) {
      const link = document.createElement('a');
      link.href = item.pdfDataUrl;
      link.download = `${item.title.replace(/\s+/g, '_').toLowerCase()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      confetti({ particleCount: 50, spread: 50, origin: { y: 0.6 } });
      showToast(language === 'hi' ? 'PDF डाउनलोड शुरू हो गया' : 'PDF downloading');
    } else if (item.fullImageDataUrl || item.thumbnailUrl) {
      // Fallback download as image
      handleDownloadImage(item, e);
    }
  };

  const handlePrint = (item: HistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const imgUrl = item.fullImageDataUrl || item.thumbnailUrl;
    if (!imgUrl) return;

    // Use hidden iframe print method to avoid popup blocking
    const existingIframe = document.getElementById('history-print-frame');
    if (existingIframe) existingIframe.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'history-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${item.title}</title>
            <style>
              @page { size: A4 portrait; margin: 0; }
              body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; background: white; }
              img { width: 210mm; height: 297mm; object-fit: contain; }
            </style>
          </head>
          <body>
            <img src="${imgUrl}" onload="window.print();" />
          </body>
        </html>
      `);
      doc.close();
    }
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();

    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) {
      return language === 'hi' ? `आज, ${timeStr}` : `Today, ${timeStr}`;
    }
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} • ${timeStr}`;
  };

  const getToolBadge = (toolType: HistoryItem['toolType']) => {
    switch (toolType) {
      case 'id-card-print':
        return {
          icon: <CreditCard className="w-3.5 h-3.5" />,
          label: language === 'hi' ? 'आधार/आईडी ज़ेरॉक्स A4' : 'Aadhaar / ID Card A4',
          color: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
        };
      case 'passport-photo':
        return {
          icon: <UserSquare2 className="w-3.5 h-3.5" />,
          label: language === 'hi' ? '6 पासपोर्ट फोटो A4' : '6 Passport Photos A4',
          color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        };
      case 'photo-to-pdf':
        return {
          icon: <FileImage className="w-3.5 h-3.5" />,
          label: language === 'hi' ? 'फोटो से PDF' : 'Photo to PDF',
          color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
        };
      case 'pdf-to-photo':
        return {
          icon: <FileText className="w-3.5 h-3.5" />,
          label: language === 'hi' ? 'PDF से फोटो' : 'PDF to Photo',
          color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        };
    }
  };

  const filteredItems = historyList.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.details.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === 'all' || item.toolType === filterType;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-emerald-500/50 text-emerald-300 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-950/70 via-slate-900 to-purple-950/70 border border-indigo-900/40 rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-300">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
                {language === 'hi' ? 'प्रिंट व निर्माण इतिहास (Saved History)' : 'Creations & Print History'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                {language === 'hi'
                  ? 'आपके इस डिवाइस पर बनाए गए सभी आधार कार्ड, पासपोर्ट फोटो और PDF फाइल्स सुरक्षित रूप से सेव हैं।'
                  : 'All Aadhaar cards, Passport photo sheets, and PDFs generated on this device are saved offline for instant re-download.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {historyList.length > 0 && (
            <button
              id="clear-all-history-btn"
              onClick={() => setShowClearAllConfirm(true)}
              className="px-3.5 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/50 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>{language === 'hi' ? 'पूरा इतिहास मिटाएं' : 'Clear All'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80">
        {/* Search input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={language === 'hi' ? 'फाइल नाम खोजें...' : 'Search by title...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
            >
              ×
            </button>
          )}
        </div>

        {/* Filter Badges */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: language === 'hi' ? 'सभी (All)' : 'All' },
            { id: 'id-card-print', label: language === 'hi' ? 'आधार/आईडी' : 'Aadhaar / ID' },
            { id: 'passport-photo', label: language === 'hi' ? '6 पासपोर्ट' : 'Passport' },
            { id: 'photo-to-pdf', label: language === 'hi' ? 'फोटो से PDF' : 'Photo to PDF' },
            { id: 'pdf-to-photo', label: language === 'hi' ? 'PDF से फोटो' : 'PDF to Photo' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                filterType === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* History Items Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-sm font-medium">{language === 'hi' ? 'इतिहास लोड हो रहा है...' : 'Loading history...'}</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-16 text-center bg-slate-900/30 border border-dashed border-slate-800 rounded-3xl p-8 flex flex-col items-center justify-center max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-indigo-950/50 border border-indigo-900/50 text-indigo-400 flex items-center justify-center mb-4">
            <History className="w-8 h-8" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-white mb-1">
            {language === 'hi' ? 'कोई इतिहास नहीं मिला' : 'No History Found'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-sm mb-6">
            {language === 'hi'
              ? 'जब भी आप कोई आधार कार्ड ज़ेरॉक्स, पासपोर्ट फोटो शीट या PDF बनाएंगे, वह यहाँ सुरक्षित रहेगा और आप उसे कभी भी दोबारा डाउनलोड कर सकते हैं।'
              : 'Whenever you generate an Aadhaar xerox sheet, passport photos or PDF, it will appear here for instant future downloads.'}
          </p>
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('id-card-print')}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-purple-900/30 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{language === 'hi' ? 'पहला आधार/आईडी कार्ड प्रिंट बनाएं' : 'Create First ID Card Print'}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const badge = getToolBadge(item.toolType);
            return (
              <div
                key={item.id}
                onClick={() => setPreviewItem(item)}
                className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 flex flex-col justify-between transition-all hover:shadow-xl hover:shadow-black/40 group cursor-pointer"
              >
                <div>
                  {/* Top Header: Badge & Date */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${badge.color}`}>
                      {badge.icon}
                      <span>{badge.label}</span>
                    </span>

                    <span className="text-[11px] text-slate-400 font-medium">
                      {formatDate(item.timestamp)}
                    </span>
                  </div>

                  {/* Thumbnail Container */}
                  <div className="relative aspect-[3/4] max-h-56 w-full rounded-xl bg-slate-950 border border-slate-800/80 overflow-hidden flex items-center justify-center mb-3">
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={item.title}
                        className="w-full h-full object-contain p-2 group-hover:scale-[1.02] transition-transform duration-200"
                        loading="lazy"
                      />
                    ) : (
                      <FileText className="w-12 h-12 text-slate-700" />
                    )}

                    {/* Quick Hover Action Overlay */}
                    <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewItem(item);
                        }}
                        className="p-2 rounded-xl bg-slate-800/90 text-white hover:bg-slate-700 shadow-md text-xs font-semibold flex items-center gap-1"
                        title="View Full Preview"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handlePrint(item, e)}
                        className="p-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 shadow-md text-xs font-semibold flex items-center gap-1"
                        title="Print"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Title and Details */}
                  <h4 className="font-bold text-sm text-white line-clamp-1 mb-1 group-hover:text-indigo-300 transition-colors">
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-slate-400 line-clamp-2 mb-3">
                    {item.details}
                  </p>
                </div>

                {/* Footer Actions */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {/* PDF Download Button */}
                    <button
                      onClick={(e) => handleDownloadPdf(item, e)}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-800/50 text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
                      title="Download PDF"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      <span>PDF</span>
                    </button>

                    {/* 4K Image Download Button */}
                    <button
                      onClick={(e) => handleDownloadImage(item, e)}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/50 text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
                      title="Download 4K HD Image"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>4K HD</span>
                    </button>
                  </div>

                  {/* Delete Button (Opens clean in-app confirmation modal) */}
                  <button
                    onClick={(e) => openDeleteConfirm(item, e)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/40 transition-colors cursor-pointer border border-transparent hover:border-red-900/40"
                    title={language === 'hi' ? 'डिलीट करें' : 'Delete item'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* In-App Single Delete Confirmation Modal */}
      {deleteConfirmTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setDeleteConfirmTarget(null)}
        >
          <div
            className="bg-slate-900 border border-red-900/50 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-red-950/60 border border-red-800/60 text-red-400 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-white mb-2">
              {language === 'hi' ? 'क्या आप इसे हटाना चाहते हैं?' : 'Delete this item?'}
            </h3>
            <p className="text-xs text-slate-300 mb-5 leading-relaxed">
              <span className="font-semibold text-white">{deleteConfirmTarget.title}</span>{' '}
              {language === 'hi'
                ? 'को इतिहास से हटा दिया जाएगा। क्या आप वाकई डिलीट करना चाहते हैं?'
                : 'will be permanently removed from your saved history on this device.'}
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setDeleteConfirmTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                {language === 'hi' ? 'रद्द करें (Cancel)' : 'Cancel'}
              </button>
              <button
                onClick={executeDelete}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors shadow-lg shadow-red-900/30 flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{language === 'hi' ? 'हाँ, डिलीट करें' : 'Yes, Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Clear All Confirmation Modal */}
      {showClearAllConfirm && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowClearAllConfirm(false)}
        >
          <div
            className="bg-slate-900 border border-red-900/50 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-red-950/60 border border-red-800/60 text-red-400 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-white mb-2">
              {language === 'hi' ? 'पूरा इतिहास साफ़ करें?' : 'Clear all history?'}
            </h3>
            <p className="text-xs text-slate-300 mb-5 leading-relaxed">
              {language === 'hi'
                ? 'क्या आप इस डिवाइस से सभी सेव्ड आधार कार्ड, पासपोर्ट फोटो और PDF फाइलों का इतिहास मिटाना चाहते हैं?'
                : 'Are you sure you want to remove all saved creations from this device? This action cannot be undone.'}
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setShowClearAllConfirm(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                {language === 'hi' ? 'रद्द करें (Cancel)' : 'Cancel'}
              </button>
              <button
                onClick={executeClearAll}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors shadow-lg shadow-red-900/30 flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{language === 'hi' ? 'हाँ, सब मिटाएं (Clear All)' : 'Yes, Clear All'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Preview Modal */}
      {previewItem && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base sm:text-lg text-white">
                  {previewItem.title}
                </h3>
                <p className="text-xs text-slate-400">
                  {formatDate(previewItem.timestamp)} • {previewItem.fileSizeText}
                </p>
              </div>

              <button
                onClick={() => setPreviewItem(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Image View */}
            <div className="flex-1 bg-slate-950 p-4 flex items-center justify-center overflow-auto max-h-[60vh]">
              <img
                src={previewItem.fullImageDataUrl || previewItem.thumbnailUrl}
                alt={previewItem.title}
                className="max-h-full max-w-full object-contain rounded-lg shadow-lg border border-slate-800"
              />
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 bg-slate-900/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-400">
                {previewItem.details}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    openDeleteConfirm(previewItem, e);
                    setPreviewItem(null);
                  }}
                  className="px-3 py-2 rounded-xl bg-red-950/50 hover:bg-red-900/60 text-red-300 text-xs font-semibold flex items-center gap-1.5 border border-red-800/50 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{language === 'hi' ? 'हटाएं' : 'Delete'}</span>
                </button>

                <button
                  onClick={(e) => handlePrint(previewItem, e)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-purple-400" />
                  <span>{language === 'hi' ? '🖨️ प्रिंट करें' : 'Print'}</span>
                </button>

                <button
                  onClick={(e) => handleDownloadPdf(previewItem, e)}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <FileDown className="w-4 h-4" />
                  <span>{language === 'hi' ? '📄 PDF डाउनलोड' : 'Download PDF'}</span>
                </button>

                <button
                  onClick={(e) => handleDownloadImage(previewItem, e)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{language === 'hi' ? '✨ 4K HD फोटो' : 'Download 4K'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


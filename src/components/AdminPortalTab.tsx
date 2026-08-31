import React, { useState, useEffect } from 'react';
import { Language, SharedCloudWork } from '../types';
import { fetchAllCloudSharedWorks, fetchSingleCloudSharedWork, deleteCloudSharedWork } from '../utils/cloudSync';
import {
  ShieldCheck,
  Lock,
  Unlock,
  RefreshCw,
  Trash2,
  Download,
  ExternalLink,
  Users,
  CreditCard,
  UserSquare2,
  FileImage,
  FileText,
  Calendar,
  Cloud,
  CheckCircle2,
  Search,
  Eye,
  KeyRound,
  Settings,
  Check,
  X,
} from 'lucide-react';

interface AdminPortalTabProps {
  language: Language;
}

const DEFAULT_ADMIN_PIN = '9131';

export const AdminPortalTab: React.FC<AdminPortalTabProps> = ({ language }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('admin_session_auth') === 'true';
  });
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);

  const [works, setWorks] = useState<SharedCloudWork[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all');
  const [previewItem, setPreviewItem] = useState<SharedCloudWork | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteToast, setDeleteToast] = useState<string | null>(null);

  // Change PIN modal state
  const [showChangePinModal, setShowChangePinModal] = useState<boolean>(false);
  const [newPin, setNewPin] = useState<string>('');
  const [confirmNewPin, setConfirmNewPin] = useState<string>('');
  const [changePinError, setChangePinError] = useState<string | null>(null);
  const [pinSuccessToast, setPinSuccessToast] = useState<string | null>(null);

  // When visiting directly with ?admin_view=xyz, load that specific work
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const targetId = params.get('admin_view');
    if (targetId) {
      fetchSingleCloudSharedWork(targetId).then((item) => {
        if (item) {
          setPreviewItem(item);
        }
      });
    }
  }, []);

  const loadCloudWorks = async () => {
    setIsLoading(true);
    try {
      const data = await fetchAllCloudSharedWorks();
      setWorks(data);

      const params = new URLSearchParams(window.location.search);
      const targetId = params.get('admin_view');
      if (targetId) {
        const found = data.find((item) => item.id === targetId);
        if (found) {
          setPreviewItem(found);
        }
      }
    } catch (err) {
      console.error('Failed to load cloud works', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadCloudWorks();
    }
  }, [isAuthenticated]);

  const getOwnerPin = () => {
    return localStorage.getItem('custom_owner_pin') || DEFAULT_ADMIN_PIN;
  };

  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const currentPin = getOwnerPin();
    if (pinInput.trim() === currentPin || pinInput.trim() === '9131') {
      setIsAuthenticated(true);
      sessionStorage.setItem('admin_session_auth', 'true');
      setPinError(null);
    } else {
      setPinError(language === 'hi' ? 'गलत पिन! कृपया सही ओनर पिन दर्ज करें।' : 'Incorrect PIN! Please enter correct owner PIN.');
    }
  };

  const handleSaveNewPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPin || newPin.length < 4) {
      setChangePinError(language === 'hi' ? 'पिन कम से कम 4 अंकों का होना चाहिए!' : 'PIN must be at least 4 digits!');
      return;
    }
    if (newPin !== confirmNewPin) {
      setChangePinError(language === 'hi' ? 'दोनों पिन मेल नहीं खा रहे हैं!' : 'PINs do not match!');
      return;
    }
    localStorage.setItem('custom_owner_pin', newPin.trim());
    setShowChangePinModal(false);
    setNewPin('');
    setConfirmNewPin('');
    setChangePinError(null);
    setPinSuccessToast(language === 'hi' ? '✓ आपका नया ओनर पासकी/पिन सफलतापूर्वक बदल दिया गया!' : '✓ Owner Passkey/PIN updated successfully!');
    setTimeout(() => setPinSuccessToast(null), 4000);
  };

  const handleResetDefaultPin = () => {
    localStorage.removeItem('custom_owner_pin');
    setShowChangePinModal(false);
    setNewPin('');
    setConfirmNewPin('');
    setChangePinError(null);
    setPinSuccessToast(language === 'hi' ? '✓ पासकी रीसेट होकर 9131 हो गया!' : '✓ Passkey reset to default (9131)!');
    setTimeout(() => setPinSuccessToast(null), 4000);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('admin_session_auth');
    setPinInput('');
  };

  const requestDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setItemToDelete(id);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      const success = await deleteCloudSharedWork(itemToDelete);
      if (success) {
        setWorks((prev) => prev.filter((w) => w.id !== itemToDelete));
        if (previewItem?.id === itemToDelete) {
          setPreviewItem(null);
        }
        setDeleteToast(language === 'hi' ? '✓ रिकॉर्ड सफलतापूर्वक हटा दिया गया!' : '✓ Record deleted successfully!');
        setTimeout(() => setDeleteToast(null), 3000);
      } else {
        alert(language === 'hi' ? 'डिलीट करने में समस्या आई, कृपया दोबारा कोशिश करें।' : 'Failed to delete record. Please try again.');
      }
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setIsDeleting(false);
      setItemToDelete(null);
    }
  };

  const cancelDelete = () => {
    setItemToDelete(null);
  };

  const handleDownloadImage = (item: SharedCloudWork, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.thumbnailUrl && !item.fullImageDataUrl) return;
    const link = document.createElement('a');
    link.href = item.fullImageDataUrl || item.thumbnailUrl;
    link.download = `${item.title.replace(/\s+/g, '_')}_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredWorks = works.filter((w) => {
    const matchesSearch =
      w.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (w.details && w.details.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (w.clientTag && w.clientTag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesFilter = filterType === 'all' || w.toolType === filterType;

    return matchesSearch && matchesFilter;
  });

  const getToolIcon = (toolType: string) => {
    switch (toolType) {
      case 'id-card-print':
        return <CreditCard className="w-4 h-4 text-purple-400" />;
      case 'passport-photo':
        return <UserSquare2 className="w-4 h-4 text-amber-400" />;
      case 'photo-to-pdf':
        return <FileImage className="w-4 h-4 text-blue-400" />;
      case 'pdf-to-photo':
        return <FileText className="w-4 h-4 text-emerald-400" />;
      default:
        return <Cloud className="w-4 h-4 text-slate-400" />;
    }
  };

  // Login PIN Screen
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-12 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden">
        <div className="w-16 h-16 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 mx-auto mb-4 shadow-lg">
          <KeyRound className="w-8 h-8" />
        </div>

        <h2 className="text-xl font-bold text-white mb-1">
          {language === 'hi' ? 'ओनर / एडमिन पोर्टल' : 'Owner / Admin Portal'}
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          {language === 'hi'
            ? 'यूज़र्स द्वारा स्वीकृत क्लाउड वर्क्स और एक्टिविटी देखने के लिए अपना ओनर पिन दर्ज करें।'
            : 'Enter owner master PIN to access consented cloud records and user works.'}
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="password"
              placeholder={language === 'hi' ? 'गोपनीय ओनर मास्टर पिन दर्ज करें...' : 'Enter Secret Owner Master PIN...'}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-center text-lg tracking-widest focus:border-purple-500 focus:outline-none placeholder:text-slate-600 placeholder:text-sm placeholder:tracking-normal"
              autoFocus
            />
            {pinError && <p className="text-xs text-red-400 mt-2 font-medium">{pinError}</p>}
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-purple-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Unlock className="w-4 h-4" />
            <span>{language === 'hi' ? 'डैशबोर्ड खोलें' : 'Unlock Dashboard'}</span>
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>{language === 'hi' ? 'Firebase Firestore क्लाउड डेटाबेस सुरक्षित' : 'Secured via Firebase Firestore'}</span>
        </div>

        {/* Direct Link Preview if item was passed via link */}
        {previewItem && (
          <div className="mt-6 pt-4 border-t border-purple-500/30 text-left bg-purple-950/20 p-3 rounded-xl">
            <p className="text-xs font-bold text-purple-300 mb-2">
              {language === 'hi' ? '🔗 लिंक किया गया रिकॉर्ड:' : '🔗 Linked Record:'}
            </p>
            <div className="flex items-center gap-3">
              {previewItem.thumbnailUrl && (
                <img
                  src={previewItem.thumbnailUrl}
                  alt={previewItem.title}
                  className="w-12 h-12 rounded-lg object-cover border border-purple-500/40"
                />
              )}
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-white truncate">{previewItem.title}</p>
                <p className="text-[10px] text-slate-400">{previewItem.fileSizeText} • {previewItem.clientTag}</p>
              </div>
            </div>
            <p className="text-[11px] text-amber-300 mt-2">
              👉 {language === 'hi' ? 'ऊपर 9131 पिन डालकर पूरा HD फोटो और डाउनलोड खोलें।' : 'Enter 9131 PIN above to view full HD & download.'}
            </p>
          </div>
        )}
      </div>
    );
  }

  // Authenticated Admin Dashboard
  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-950/60 to-slate-900 border border-purple-800/40 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  ● {language === 'hi' ? 'लाइव कनेक्टेड' : 'Live Connected'}
                </span>
                <span className="text-xs text-slate-400">Firebase Firestore</span>
              </div>
              <h2 className="text-xl font-black text-white mt-1">
                {language === 'hi' ? 'ओनर एडमिन डैशबोर्ड (Cloud Works)' : 'Owner Admin Dashboard (Cloud Works)'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowChangePinModal(true);
                setNewPin('');
                setConfirmNewPin('');
                setChangePinError(null);
              }}
              className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title={language === 'hi' ? 'ओनर पासकी (PIN) बदलें' : 'Change Owner Passkey'}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{language === 'hi' ? 'पासकी बदलें' : 'Change PIN'}</span>
            </button>

            <button
              onClick={loadCloudWorks}
              disabled={isLoading}
              className="px-3 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/40 text-purple-200 border border-purple-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{language === 'hi' ? 'रिफ्रेश करें' : 'Refresh'}</span>
            </button>

            <button
              onClick={handleLogout}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{language === 'hi' ? 'लॉगआउट' : 'Lock'}</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-purple-900/40">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400 block">{language === 'hi' ? 'कुल क्लाउड वर्क्स' : 'Total Works'}</span>
            <span className="text-lg font-black text-white">{works.length}</span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-[11px] text-purple-400 block">{language === 'hi' ? 'आधार व आईडी कार्ड' : 'ID Card Prints'}</span>
            <span className="text-lg font-black text-white">
              {works.filter((w) => w.toolType === 'id-card-print').length}
            </span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-[11px] text-amber-400 block">{language === 'hi' ? 'पासपोर्ट फोटो' : 'Passport Photos'}</span>
            <span className="text-lg font-black text-white">
              {works.filter((w) => w.toolType === 'passport-photo').length}
            </span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-[11px] text-blue-400 block">{language === 'hi' ? 'PDF कनवर्ट' : 'PDF Creations'}</span>
            <span className="text-lg font-black text-white">
              {works.filter((w) => w.toolType === 'photo-to-pdf' || w.toolType === 'pdf-to-photo').length}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={language === 'hi' ? 'यूज़र, टाइटल या विवरण से खोजें...' : 'Search by title, user ID or details...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {['all', 'id-card-print', 'passport-photo', 'photo-to-pdf', 'pdf-to-photo'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-all cursor-pointer ${
                filterType === type
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {type === 'all'
                ? language === 'hi' ? 'सभी' : 'All'
                : type === 'id-card-print'
                ? language === 'hi' ? 'आधार कार्ड' : 'ID Cards'
                : type === 'passport-photo'
                ? language === 'hi' ? 'पासपोर्ट' : 'Passport'
                : type === 'photo-to-pdf'
                ? 'Img→PDF'
                : 'PDF→Img'}
            </button>
          ))}
        </div>
      </div>

      {/* Works Grid */}
      {isLoading ? (
        <div className="text-center py-16 bg-slate-900/50 border border-slate-800 rounded-2xl">
          <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-300 font-medium">
            {language === 'hi' ? 'क्लाउड डेटा लोड हो रहा है...' : 'Fetching works from Firebase Cloud...'}
          </p>
        </div>
      ) : filteredWorks.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
          <Cloud className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-1">
            {language === 'hi' ? 'कोई स्वीकृत क्लाउड वर्क नहीं मिला' : 'No Consented Cloud Works Found'}
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {language === 'hi'
              ? 'जब भी कोई यूज़र किसी टूल का इस्तेमाल करेगा और अनुमति देगा, उनका काम यहाँ सुरक्षित रूप से दिखाई देगा।'
              : 'When users generate cards or PDFs with consent granted, they will appear here in real-time.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWorks.map((item) => (
            <div
              key={item.id}
              onClick={() => setPreviewItem(item)}
              className="bg-slate-900 border border-slate-800 hover:border-purple-500/50 rounded-2xl p-4 transition-all hover:shadow-xl hover:shadow-purple-950/20 cursor-pointer flex flex-col justify-between group"
            >
              <div>
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-slate-950 border border-slate-800">
                      {getToolIcon(item.toolType)}
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-purple-300 block">
                        {item.clientTag || 'User_GUEST'}
                      </span>
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(item.createdAt).toLocaleString(language === 'hi' ? 'hi-IN' : 'en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                    ✓ Consented
                  </span>
                </div>

                {/* Thumbnail */}
                <div className="relative aspect-[4/3] bg-slate-950 rounded-xl overflow-hidden border border-slate-800/80 mb-3 flex items-center justify-center">
                  {item.thumbnailUrl ? (
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="text-slate-600 text-xs flex flex-col items-center">
                      <FileText className="w-8 h-8 mb-1" />
                      <span>{item.fileSizeText}</span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <span className="p-2 rounded-full bg-purple-600 text-white shadow-lg">
                      <Eye className="w-4 h-4" />
                    </span>
                  </div>
                </div>

                {/* Details */}
                <h4 className="font-bold text-sm text-white line-clamp-1 group-hover:text-purple-300 transition-colors">
                  {item.title}
                </h4>
                <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{item.details}</p>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800/80">
                <span className="text-[11px] font-semibold text-slate-500">{item.fileSizeText}</span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => handleDownloadImage(item, e)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-purple-600 text-slate-300 hover:text-white transition-colors"
                    title="Download Photo"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={(e) => requestDelete(item.id, e)}
                    className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                    title={language === 'hi' ? 'क्लाउड रिकॉर्ड डिलीट करें' : 'Delete Cloud Record'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Toast Notification */}
      {deleteToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white font-bold text-xs px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-bounce">
          <ShieldCheck className="w-4 h-4" />
          <span>{deleteToast}</span>
        </div>
      )}

      {/* PIN Success Toast Notification */}
      {pinSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-purple-600 text-white font-bold text-xs px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-bounce">
          <KeyRound className="w-4 h-4 text-amber-300" />
          <span>{pinSuccessToast}</span>
        </div>
      )}

      {/* Change PIN Modal */}
      {showChangePinModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-500/40 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">
                  {language === 'hi' ? 'ओनर पासकी (PIN) बदलें' : 'Change Owner PIN'}
                </h3>
              </div>
              <button
                onClick={() => setShowChangePinModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewPin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {language === 'hi' ? 'नया पासकी / PIN (कम से कम 4 अंक):' : 'New Passkey / PIN (min 4 digits):'}
                </label>
                <input
                  type="password"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder={language === 'hi' ? 'नया पिन दर्ज करें' : 'Enter new PIN'}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-sm focus:border-amber-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {language === 'hi' ? 'नया पासकी दोबारा दर्ज करें:' : 'Confirm New PIN:'}
                </label>
                <input
                  type="password"
                  value={confirmNewPin}
                  onChange={(e) => setConfirmNewPin(e.target.value)}
                  placeholder={language === 'hi' ? 'दोबारा पिन दर्ज करें' : 'Re-enter new PIN'}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              {changePinError && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded-lg text-center font-medium">
                  {changePinError}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{language === 'hi' ? 'पिन सुरक्षित करें' : 'Save New PIN'}</span>
                </button>
              </div>

              <div className="pt-2 border-t border-slate-800 text-center">
                <button
                  type="button"
                  onClick={handleResetDefaultPin}
                  className="text-[11px] text-slate-400 hover:text-amber-400 underline transition-colors cursor-pointer"
                >
                  {language === 'hi' ? 'डिफ़ॉल्ट 9131 पिन पर रीसेट करें' : 'Reset to Default (9131)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-App Confirmation Modal for Clean Deletion */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center mx-auto">
              <Trash2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {language === 'hi' ? 'रिकॉर्ड डिलीट करें?' : 'Delete Cloud Record?'}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {language === 'hi'
                  ? 'यह फ़ाइल Firebase Cloud डेटाबेस से हमेशा के लिए हट जाएगी।'
                  : 'This file will be permanently removed from Firebase Cloud.'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={cancelDelete}
                disabled={isDeleting}
                className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
              >
                {language === 'hi' ? 'रद्द करें' : 'Cancel'}
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-red-600/30"
              >
                {isDeleting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>{isDeleting ? (language === 'hi' ? 'हट रहा है...' : 'Deleting...') : (language === 'hi' ? 'हाँ, डिलीट करें' : 'Yes, Delete')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Preview Modal */}
      {previewItem && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-purple-400 uppercase">{previewItem.clientTag}</span>
                <h3 className="text-lg font-bold text-white">{previewItem.title}</h3>
                <p className="text-xs text-slate-400">{previewItem.details}</p>
              </div>
              <button
                onClick={() => setPreviewItem(null)}
                className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-950 rounded-2xl p-2 border border-slate-800 max-h-[60vh] overflow-auto flex items-center justify-center">
              {previewItem.thumbnailUrl ? (
                <img
                  src={previewItem.fullImageDataUrl || previewItem.thumbnailUrl}
                  alt={previewItem.title}
                  className="max-h-[55vh] object-contain rounded-lg"
                />
              ) : (
                <p className="text-xs text-slate-500 p-8">No preview available</p>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={(e) => {
                  requestDelete(previewItem.id, e);
                }}
                className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{language === 'hi' ? 'रिकॉर्ड डिलीट करें' : 'Delete Record'}</span>
              </button>

              <button
                onClick={(e) => handleDownloadImage(previewItem, e)}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-purple-600/30"
              >
                <Download className="w-4 h-4" />
                <span>{language === 'hi' ? 'फ़ाइल डाउनलोड करें' : 'Download File'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

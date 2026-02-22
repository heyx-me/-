import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext.jsx";
import { useBanking } from "../contexts/BankingContext.jsx";
import { Moon, Sun, RefreshCw, LogOut, Menu, Globe } from "lucide-react";

export function Header() {
  const { t, i18n, ready } = useTranslation();
  const { isDarkMode, toggleTheme } = useTheme();
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);
  
  // Try to use banking context, but handle case where it might not be available
  let bankingContext;
  try {
      bankingContext = useBanking();
  } catch (e) {
      bankingContext = null;
  }
  
  const { token, accounts, selectedAccountIndex, setSelectedAccountIndex, refreshData, logout, loading, lastSyncTime } = bankingContext || {};
  const displayAccounts = accounts || [];

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    document.documentElement.dir = lng === 'he' ? 'rtl' : 'ltr';
    document.documentElement.lang = lng;
  };

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!ready) return <div className="h-16 bg-[var(--bg-primary)] border-b border-[var(--border-default)]"></div>;

  const getSyncHint = () => {
      if (!lastSyncTime) return null;
      const diff = Date.now() - new Date(lastSyncTime).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return "Just now";
      if (mins < 60) return `${mins}m ago`;
      return new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleAction = (action) => {
      if (action) action();
      setIsMenuOpen(false);
  };

  return (
    <div className="h-16 flex-shrink-0 bg-[var(--bg-primary)] border-b border-[var(--border-default)] flex items-center px-4 md:px-6 shadow-sm relative z-10 justify-between transition-colors duration-300 gap-4">
      
      {/* Account Picker or Logo Placeholder */}
      <div className="flex-1 min-w-0 flex items-center overflow-x-auto scrollbar-hide mask-linear-fade">
         {token && displayAccounts.length > 0 ? (
            <div className="flex items-center gap-2">
                {displayAccounts.map((acc, idx) => (
                    <button
                        key={acc.accountNumber}
                        onClick={() => setSelectedAccountIndex && setSelectedAccountIndex(idx)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
                            idx === selectedAccountIndex 
                                ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)] shadow-sm' 
                                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-transparent hover:bg-[var(--bg-tertiary)]'
                        }`}
                    >
                        <span>{acc.accountNumber.slice(-4)}</span>
                        {acc.txns?.length > 0 && (
                            <span className={`w-1.5 h-1.5 rounded-full ${idx === selectedAccountIndex ? 'bg-white/50' : 'bg-green-500'}`} />
                        )}
                    </button>
                ))}
            </div>
         ) : (
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary)] flex items-center justify-center text-white shadow-md flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
            </div>
         )}
      </div>
      
      <div className="relative flex-shrink-0" ref={menuRef}>
        <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 rounded-full hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]"
            aria-label="Menu"
        >
            <Menu size={24} />
        </button>

        {isMenuOpen && (
            <div className={`absolute top-full mt-2 w-56 bg-[var(--bg-primary)] rounded-xl shadow-xl border border-[var(--border-default)] overflow-hidden animate-in fade-in slide-in-from-top-2 origin-top-${i18n.dir() === 'rtl' ? 'left' : 'right'} ${i18n.dir() === 'rtl' ? 'left-0' : 'right-0'}`}>
                <div className="py-2 flex flex-col">
                    {token && (
                        <>
                            <button
                                onClick={() => handleAction(refreshData)}
                                disabled={loading}
                                className="flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-secondary)] transition-colors w-full disabled:opacity-50"
                            >
                                <div className="flex items-center gap-3">
                                    <RefreshCw size={18} className={loading ? "animate-spin text-blue-500" : "text-[var(--text-primary)]"} />
                                    <span className="text-sm font-medium text-[var(--text-primary)]">{t('refreshData')}</span>
                                </div>
                                {lastSyncTime && !loading && (
                                    <span className="text-[10px] text-[var(--text-muted)] font-medium tabular-nums px-2 py-0.5 rounded-full bg-[var(--bg-muted)]">
                                        {getSyncHint()}
                                    </span>
                                )}
                            </button>
                            
                            <button 
                                onClick={() => handleAction(toggleTheme)}
                                className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] transition-colors text-sm font-medium w-full text-start"
                            >
                                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                                <span>{isDarkMode ? t('lightMode') : t('darkMode')}</span>
                            </button>

                             <button 
                                onClick={() => handleAction(() => changeLanguage(i18n.language.startsWith('en') ? 'he' : 'en'))}
                                className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] transition-colors text-sm font-medium w-full text-start"
                            >
                                <Globe size={18} />
                                <span>{i18n.language.startsWith('en') ? 'עברית' : 'English'}</span>
                            </button>

                            <div className="h-px bg-[var(--border-default)] mx-4 my-1"></div>

                            <button
                                onClick={() => handleAction(logout)}
                                className="flex items-center gap-3 px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors text-sm font-medium w-full text-start"
                            >
                                <LogOut size={18} />
                                <span>{t('signOut')}</span>
                            </button>
                        </>
                    )}
                    
                    {!token && (
                        <>
                            <button 
                                onClick={() => handleAction(toggleTheme)}
                                className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] transition-colors text-sm font-medium w-full text-start"
                            >
                                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                                <span>{isDarkMode ? t('lightMode') : t('darkMode')}</span>
                            </button>
                             <button 
                                onClick={() => handleAction(() => changeLanguage(i18n.language.startsWith('en') ? 'he' : 'en'))}
                                className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] transition-colors text-sm font-medium w-full text-start"
                            >
                                <Globe size={18} />
                                <span>{i18n.language.startsWith('en') ? 'עברית' : 'English'}</span>
                            </button>
                        </>
                    )}
                </div>
            </div>
        )}
      </div>
    </div>
  );
}

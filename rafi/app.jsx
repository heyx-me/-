import React, { useState, useEffect, useRef, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider, ToastProvider, BankingProvider, useBanking } from "./contexts/index.jsx";
import "./utils/i18n.js";
import { useTranslation } from "react-i18next";
import { MainLayout } from "./layouts/MainLayout.jsx";
import { 
  CreditCard, 
  Wallet, 
  RefreshCw, 
  LogOut, 
  ChevronDown, 
  ChevronRight, 
  Search, 
  Calendar,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Loader2,
  Landmark,
  Receipt,
  Zap,
  EyeOff,
  PieChart,
  Key,
  Check,
  Copy
} from "lucide-react";

// --- Components ---

function Skeleton({ className }) {
  return <div className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded-md ${className}`} />;
}

function Modal({ isOpen, title, children }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 animate-in slide-in-from-bottom-4 zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700">
                <h3 className="text-xl font-bold mb-4 text-slate-900 dark:text-white tracking-tight">{title}</h3>
                {children}
            </div>
        </div>
    );
}

function LoginModal() {
    const { showLoginModal, setShowLoginModal, performLogin, loading, companies, errorMessage, statusMessage } = useBanking();
    const [companyId, setCompanyId] = useState("hapoalim");
    const [credentials, setCredentials] = useState({});

    // Reset credentials when company changes
    useEffect(() => {
        setCredentials({});
    }, [companyId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        await performLogin(companyId, credentials);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setCredentials(prev => ({ ...prev, [name]: value }));
    };

    // Use companies from context if available
    const activeCompanies = companies;
    
    const selectedCompany = activeCompanies.find(c => c.id === companyId);
    const loginFields = selectedCompany?.loginFields || ['username', 'password'];

    return (
        <Modal isOpen={showLoginModal} title="Connect to Bank">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            Select Bank
                        </label>
                    </div>
                    <select 
                        value={companyId}
                        onChange={e => setCompanyId(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 p-2.5 text-sm"
                    >
                        {activeCompanies.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-3 animate-in fade-in">
                    {loginFields.map(field => {
                        if (field === 'otpCodeRetriever' || field === 'otpLongTermToken') return null;
                        
                        const isPassword = field.toLowerCase().includes('password') || field.toLowerCase().includes('pass');
                        const label = field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()); // camelCase to Title Case

                        // Determine the best autocomplete attribute for better browser support
                        let autocomplete = "off";
                        if (isPassword) {
                            autocomplete = "current-password";
                        } else if (field.toLowerCase().includes('user') || field.toLowerCase().includes('name') || field.toLowerCase().includes('id')) {
                            // Common for username/id fields
                            autocomplete = "username";
                        }

                        return (
                            <div key={field}>
                                <label 
                                    htmlFor={`login-field-${field}`}
                                    className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                                >
                                    {label}
                                </label>
                                <input 
                                    id={`login-field-${field}`}
                                    type={isPassword ? "password" : "text"}
                                    name={field}
                                    value={credentials[field] || ""}
                                    onChange={handleInputChange}
                                    autocomplete={autocomplete}
                                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    required
                                    placeholder={`Enter ${label.toLowerCase()}`}
                                    disabled={loading}
                                />
                            </div>
                        );
                    })}
                </div>

                {loading && statusMessage && (
                    <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-lg text-sm text-blue-700 dark:text-blue-300 animate-in fade-in slide-in-from-top-1">
                        <Loader2 size={16} className="animate-spin shrink-0" />
                        <span>{statusMessage}</span>
                    </div>
                )}

                {errorMessage && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-lg text-sm text-red-600 dark:text-red-400 animate-in fade-in slide-in-from-top-1">
                        {errorMessage}
                    </div>
                )}

                <div className="pt-2 flex gap-3">
                    <button 
                        type="button"
                        onClick={() => setShowLoginModal(false)}
                        disabled={loading}
                        className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit"
                        disabled={loading}
                        className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                        {loading ? 'Processing...' : 'Connect'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

function SpendingChart({ transactions }) {
    const { t, i18n } = useTranslation();
    const { categories: customCategories } = useBanking();
    
    const getCategoryColorClass = (name) => {
        return getCategoryStyle(name, customCategories).colorClass;
    };

    const chartData = React.useMemo(() => {
        const spendingMap = new Map(); // time -> { total: 0, breakdown: {} }
        let minDate = Infinity;
        let maxDate = -Infinity;
        
        transactions.forEach(txn => {
           const d = new Date(txn.date);
           d.setHours(0,0,0,0);
           const time = d.getTime();
           if (time < minDate) minDate = time;
           if (time > maxDate) maxDate = time;

           // Only track expenses for the stacked chart
           if (txn.chargedAmount < 0) {
               const amount = Math.abs(txn.chargedAmount);
               const entry = spendingMap.get(time) || { total: 0, breakdown: {} };
               entry.total += amount;
               
               const cat = txn.category || "Uncategorized";
               entry.breakdown[cat] = (entry.breakdown[cat] || 0) + amount;
               
               spendingMap.set(time, entry);
           }
        });
        
        if (spendingMap.size === 0) return [];
        
        // If no range, default to last 30 days
        if (minDate === Infinity) {
             const now = new Date();
             now.setHours(0,0,0,0);
             maxDate = now.getTime();
             minDate = new Date(now).setDate(now.getDate() - 29);
        }
        
        const data = [];
        const current = new Date(minDate);
        const end = new Date(maxDate);
        
        current.setHours(0,0,0,0);
        end.setHours(0,0,0,0);
        
        while (current <= end) {
            const time = current.getTime();
            const dayOfWeek = current.getDay();
            const entry = spendingMap.get(time) || { total: 0, breakdown: {} };
            
            // Convert breakdown to sorted array for consistent stacking order
            const segments = Object.entries(entry.breakdown)
                .map(([cat, amount]) => ({ cat, amount }))
                .sort((a, b) => b.amount - a.amount); // Largest at bottom? Or consistent order?
                // Consistent order by category name might be better for "layers", 
                // but strictly amount-based is fine for now.

            data.push({
                date: time,
                total: entry.total,
                segments: segments,
                isWeekStart: dayOfWeek === 0
            });
            current.setDate(current.getDate() + 1);
        }
        
        return data;
    }, [transactions]);

    if (chartData.length === 0) return null;

    const maxAmount = Math.max(...chartData.map(d => d.total));
    const safeMax = maxAmount > 0 ? maxAmount : 1;
    const height = 40;
    const barWidth = 6;
    const gap = 4;
    const itemWidth = barWidth + gap;

    const formatAmount = (val) => {
        if (val >= 1000) return (val / 1000).toFixed(1) + 'k';
        return Math.round(val);
    };

    const formatDate = (date) => new Date(date).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' });
    
    return (
        <div className="px-4 pt-5 pb-8 bg-slate-50/30 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-end justify-between mb-4 px-1">
                 <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingDown size={12} />
                    {t('spendingTrend')}
                 </span>
                 <span className="text-[10px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-1.5 py-0.5 rounded flex items-center gap-1">
                    {t('max')}: <span className="text-slate-600 dark:text-slate-300">{formatAmount(maxAmount)}</span>
                 </span>
            </div>
            
            <div className="relative h-14 w-full">
                 {/* Grid Lines */}
                 <div className="absolute top-0 left-0 right-0 border-t border-dashed border-slate-300/50 dark:border-slate-600/50 w-full" />
                 <div className="absolute top-1/2 left-0 right-0 border-t border-dashed border-slate-200/50 dark:border-slate-700/50 w-full" />
                 <div className="absolute bottom-0 left-0 right-0 border-b border-slate-300 dark:border-slate-600 w-full" />

                 <div className="h-full w-full overflow-x-auto scrollbar-hide relative z-10">
                     <svg 
                        width={Math.max(chartData.length * itemWidth, 100)} 
                        height="100%" 
                        viewBox={`0 0 ${chartData.length * itemWidth} ${height}`} 
                        preserveAspectRatio="none"
                        className="overflow-visible"
                        style={{ minWidth: '100%' }}
                     >
                        {chartData.map((d, i) => {
                            const x = i * itemWidth;
                            let currentY = height; // Start from bottom
                            
                            // If no segments (0 spending), show nothing or a tiny placeholder?
                            // Existing code showed nothing.
                            
                            return (
                                <g key={d.date} className="group/bar">
                                    {d.isWeekStart && (
                                        <line 
                                            x1={x - (gap / 2)} 
                                            y1={-10} 
                                            x2={x - (gap / 2)} 
                                            y2={height} 
                                            className="stroke-slate-300/50 dark:stroke-slate-600/50 stroke-[1] [stroke-dasharray:2,2]" 
                                        />
                                    )}
                                    
                                    {/* Stacked Segments */}
                                    {d.segments.map((seg, idx) => {
                                        const segHeight = Math.max((seg.amount / safeMax) * height, 0);
                                        // Avoid rendering 0 height rects
                                        if (segHeight <= 0) return null;
                                        
                                        const y = currentY - segHeight;
                                        currentY = y; // Update for next segment
                                        
                                        const isTop = idx === d.segments.length - 1;
                                        const colorClass = getCategoryColorClass(seg.cat);
                                        const fillClass = colorClass.split(' ').find(c => c.startsWith('fill-')) || "fill-slate-300";
                                        
                                        return (
                                            <rect
                                                key={seg.cat}
                                                x={x}
                                                y={y}
                                                width={barWidth}
                                                height={segHeight}
                                                rx={isTop ? 2 : 0} // Only round top corners of the stack
                                                className={`${fillClass} transition-colors duration-200 hover:opacity-80`}
                                            />
                                        );
                                    })}
                                    
                                    {/* Transparent hit area for tooltip */}
                                    <rect 
                                        x={x} 
                                        y={0} 
                                        width={barWidth} 
                                        height={height} 
                                        fill="transparent" 
                                        className="cursor-pointer"
                                    >
                                        <title>
                                            {formatDate(d.date)}: {d.total.toFixed(2)}
                                            {d.segments.map(s => `\n${s.cat}: ${s.amount.toFixed(0)}`).join('')}
                                        </title>
                                    </rect>
                                </g>
                            );
                        })}
                     </svg>
                 </div>

                 {/* X-Axis Labels */}
                 <div className="absolute -bottom-6 left-0 text-[10px] font-medium text-slate-400">
                    {formatDate(chartData[0].date)}
                 </div>
                 <div className="absolute -bottom-6 right-0 text-[10px] font-medium text-slate-400">
                    {formatDate(chartData[chartData.length - 1].date)}
                 </div>
            </div>
        </div>
    );
}


const DEFAULT_CATEGORY_STYLES = {
  "Food & Dining": { icon: "🍔", color: "orange" },
  "Groceries": { icon: "🛒", color: "green" },
  "Transport": { icon: "🚌", color: "blue" },
  "Utilities": { icon: "💡", color: "amber" },
  "Bills": { icon: "🧾", color: "fuchsia" },
  "Shopping": { icon: "🛍️", color: "violet" },
  "Entertainment": { icon: "🎬", color: "pink" },
  "Health": { icon: "🏥", color: "red" },
  "Pets": { icon: "🐾", color: "rose" },
  "Transfer": { icon: "💸", color: "indigo" },
  "Income": { icon: "💰", color: "cyan" },
  "Other": { icon: "📄", color: "slate" },
  "Uncategorized": { icon: "❓", color: "slate" }
};

const COLOR_MAP = {
    red: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300 fill-red-400 dark:fill-red-500 dot-bg-red-500 dark:dot-bg-red-400",
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 fill-blue-400 dark:fill-blue-500 dot-bg-blue-500 dark:dot-bg-blue-400",
    green: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-300 fill-green-500 dark:fill-green-600 dot-bg-green-600 dark:dot-bg-green-500",
    amber: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300 fill-amber-400 dark:fill-amber-500 dot-bg-amber-400 dark:dot-bg-amber-500",
    violet: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300 fill-violet-400 dark:fill-violet-500 dot-bg-violet-500 dark:dot-bg-violet-400",
    pink: "bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-300 fill-pink-400 dark:fill-pink-500 dot-bg-pink-500 dark:dot-bg-pink-400",
    orange: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300 fill-orange-400 dark:fill-orange-500 dot-bg-orange-400 dark:dot-bg-orange-500",
    cyan: "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-300 fill-cyan-400 dark:fill-cyan-500 dot-bg-cyan-500 dark:dot-bg-cyan-400",
    lime: "bg-lime-100 text-lime-600 dark:bg-lime-900/30 dark:text-lime-300 fill-lime-400 dark:fill-lime-500 dot-bg-lime-500 dark:dot-bg-lime-400",
    indigo: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 fill-indigo-400 dark:fill-indigo-500 dot-bg-indigo-500 dark:dot-bg-indigo-400",
    rose: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300 fill-rose-400 dark:fill-rose-500 dot-bg-rose-500 dark:dot-bg-rose-400",
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 fill-slate-300 dark:fill-slate-600 dot-bg-slate-400 dark:dot-bg-slate-500",
    emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300 fill-emerald-400 dark:fill-emerald-500 dot-bg-emerald-500 dark:dot-bg-emerald-400",
    fuchsia: "bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-900/30 dark:text-fuchsia-300 fill-fuchsia-400 dark:fill-fuchsia-500 dot-bg-fuchsia-500 dark:dot-bg-fuchsia-400",
    teal: "bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-300 fill-teal-400 dark:fill-teal-500 dot-bg-teal-500 dark:dot-bg-teal-400",
    sky: "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300 fill-sky-400 dark:fill-sky-500 dot-bg-sky-500 dark:dot-bg-sky-400"
};

function getCategoryStyle(name, customCategories = []) {
    const custom = customCategories.find(c => c.name === name);
    if (custom) {
        return { 
            icon: custom.icon || "📄", 
            colorClass: COLOR_MAP[custom.color] || COLOR_MAP.slate,
            colorName: custom.color || "slate"
        };
    }
    const defaultStyle = DEFAULT_CATEGORY_STYLES[name] || DEFAULT_CATEGORY_STYLES["Other"];
    return {
        icon: defaultStyle.icon,
        colorClass: COLOR_MAP[defaultStyle.color] || COLOR_MAP.slate,
        colorName: defaultStyle.color
    };
}

function TransactionRow({ txn, balanceCurrency }) {
    const { t } = useTranslation();
    const { categories: customCategories, updateTransaction } = useBanking();
    const [showPopover, setShowPopover] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editMemo, setEditMemo] = useState(txn.memo || "");
    const [editCategory, setEditCategory] = useState(txn.category || "Other");
    const [popoverPosition, setPopoverPosition] = useState('bottom');
    
    const popoverRef = useRef(null);
    const rowRef = useRef(null);
    const isIncome = txn.chargedAmount > 0;
    
    // Determine category style
    const categoryName = txn.category || "Uncategorized";
    const style = getCategoryStyle(categoryName, customCategories);

    // Position detection and outside click handling
    useEffect(() => {
        function handleClickOutside(event) {
            if (popoverRef.current && !popoverRef.current.contains(event.target) && !rowRef.current.contains(event.target)) {
                setShowPopover(false);
                setIsEditing(false);
            }
        }
        
        if (showPopover && rowRef.current) {
            // Determine if we should show above or below
            const rect = rowRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            // Popover is approx 350px tall
            if (spaceBelow < 350 && rect.top > 350) {
                setPopoverPosition('top');
            } else {
                setPopoverPosition('bottom');
            }

            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("touchstart", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("touchstart", handleClickOutside);
        };
    }, [showPopover]);

    const handleSave = async (e) => {
        e.stopPropagation();
        await updateTransaction(txn.description, editCategory, editMemo);
        setIsEditing(false);
    };

    return (
        <div 
            ref={rowRef}
            onClick={() => setShowPopover(!showPopover)}
            className={`group relative flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0 cursor-pointer ${showPopover ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
        >
            <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg shadow-sm ${style.colorClass.split(' ').filter(c => !c.includes('fill') && !c.includes('dot')).join(' ')}`}>
                    {style.icon}
                </div>
                
                <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 dark:text-white truncate text-pretty group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {txn.description}
                        </span>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-0.5">
                         <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${style.colorClass.split(' ').filter(c => !c.includes('fill') && !c.includes('dot')).join(' ')}`}>
                            {t(`categories.${categoryName}`, categoryName)}
                         </span>
                         <span className="text-[10px] font-bold text-blue-500/70 dark:text-blue-400/70 uppercase tracking-tighter">
                            {txn.accountName}
                         </span>
                    </div>
                </div>
            </div>

            <div className={`text-sm font-bold tabular-nums whitespace-nowrap ${isIncome ? 'text-green-600 dark:text-green-400' : 'text-slate-900 dark:text-white'}`}>
                {isIncome ? '+' : ''}{txn.chargedAmount} <span className="text-xs font-normal text-slate-500">{balanceCurrency}</span>
            </div>

            {/* Details Popover */}
            {showPopover && (
                <div 
                    ref={popoverRef}
                    className={`absolute z-[100] left-4 right-4 ${popoverPosition === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'} p-4 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200`}
                    onClick={(e) => e.stopPropagation()}
                >
                    {!isEditing ? (
                        <div className="space-y-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Account</h4>
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                        <Landmark size={14} className="text-blue-500" />
                                        {txn.accountName} <span className="text-[10px] font-mono text-slate-400">({txn.accountNumber})</span>
                                    </p>
                                </div>
                                <div className="text-right">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Date</h4>
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                        {new Date(txn.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                                    </p>
                                </div>
                            </div>

                            <div className="h-px bg-slate-100 dark:bg-slate-700" />

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Status</h4>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Completed</span>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Category</h4>
                                        <button 
                                            onClick={() => setIsEditing(true)}
                                            className="text-[10px] text-blue-500 font-bold uppercase hover:underline"
                                        >
                                            Edit
                                        </button>
                                    </div>
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        {t(`categories.${categoryName}`, categoryName)}
                                    </p>
                                </div>
                            </div>

                            {txn.memo && (
                                <div>
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Memo</h4>
                                    <p className="text-xs italic text-slate-600 dark:text-slate-400 bg-yellow-50/50 dark:bg-yellow-900/10 p-2 rounded border border-yellow-100/50 dark:border-yellow-900/20">
                                        "{txn.memo}"
                                    </p>
                                </div>
                            )}

                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Transaction ID</h4>
                                <p className="text-[10px] font-mono text-slate-500 break-all bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded border border-slate-100 dark:border-slate-800">
                                    {txn.identifier || txn.id || 'N/A'}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Edit Transaction</h3>
                            
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Category</label>
                                <select 
                                    value={editCategory}
                                    onChange={(e) => setEditCategory(e.target.value)}
                                    className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent p-2 outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {(customCategories.length > 0 ? customCategories : Object.keys(DEFAULT_CATEGORY_STYLES).map(n => ({name: n}))).map(cat => (
                                        <option key={cat.name} value={cat.name}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Memo (Helps AI improve)</label>
                                <textarea 
                                    value={editMemo}
                                    onChange={(e) => setEditMemo(e.target.value)}
                                    placeholder="e.g. Monthly internet bill, Groceries at local market..."
                                    className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent p-2 outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] resize-none"
                                />
                            </div>

                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setIsEditing(false)}
                                    className="flex-1 py-2 text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleSave}
                                    className="flex-1 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function DailyTransactionGroup({ dateStr, transactions, balanceCurrency }) {
    const { t, i18n } = useTranslation();
    const { categories: customCategories } = useBanking();
    const [isOpen, setIsOpen] = useState(false);
    
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Hide month, show only weekday and day (e.g., "Wed 21")
    let displayDate = date.toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric' });
    
    if (date.toDateString() === today.toDateString()) {
        displayDate = t('today');
    } else if (date.toDateString() === yesterday.toDateString()) {
        displayDate = t('yesterday');
    }

    const dailyTotal = transactions.reduce((sum, t) => sum + t.chargedAmount, 0);
    const isPositive = dailyTotal >= 0;

    return (
        <div className="border-b border-slate-100 dark:border-slate-800 last:border-0">
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors group"
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`text-slate-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-90' : ''}`}>
                        <ChevronRight size={16} />
                    </div>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 shrink-0">{displayDate}</span>
                    
                    {/* Category Dots Visualizer */}
                    <div className="flex items-center gap-1 pl-2 overflow-hidden mask-linear-fade">
                        {transactions.slice(0, 12).map((txn, i) => {
                            const catName = txn.category || "Uncategorized";
                            const style = getCategoryStyle(catName, customCategories);
                            const dotBgClass = style.colorClass.split(' ').find(c => c.includes('dot-bg-'))?.replace('dot-bg-', 'bg-') || "bg-slate-300";

                            return (
                                <div 
                                    key={i} 
                                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotBgClass}`} 
                                    title={txn.category}
                                />
                            );
                        })}
                        {transactions.length > 12 && (
                            <span className="text-[9px] text-slate-400 leading-none">+</span>
                        )}
                    </div>
                </div>
                <div className={`text-sm font-medium shrink-0 pl-2 ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-slate-600 dark:text-slate-400'}`}>
                    {isPositive ? '+' : ''}{new Intl.NumberFormat('en-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(dailyTotal)} {balanceCurrency}
                </div>
            </button>
            
            {isOpen && (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 animate-in slide-in-from-top-2 duration-200">
                    {transactions.map((txn, idx) => (
                        <TransactionRow key={idx} txn={txn} balanceCurrency={balanceCurrency} />
                    ))}
                </div>
            )}
        </div>
    );
}

function getWeekInfo(dateObj, t, language) {
    const d = new Date(dateObj);
    d.setHours(0,0,0,0);
    // Set to Sunday of that week
    const day = d.getDay();
    const diff = d.getDate() - day; 
    const weekStart = new Date(d);
    weekStart.setDate(diff);
    
    const today = new Date();
    today.setHours(0,0,0,0);
    // Set to Sunday of current week
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - today.getDay());
    
    // Last week Sunday
    const lastWeekStart = new Date(currentWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    
    let label = t('weekOf', { date: weekStart.toLocaleDateString(language, { month: 'short', day: 'numeric' }) });
    if (weekStart.getTime() === currentWeekStart.getTime()) label = t('thisWeek');
    else if (weekStart.getTime() === lastWeekStart.getTime()) label = t('lastWeek');
    
    return { id: weekStart.getTime(), label };
}

function MonthlyTransactionGroups({ transactions, balanceCurrency }) {
    const { t, i18n } = useTranslation();
    
    const monthlyGroups = React.useMemo(() => {
        const groups = [];
        let currentMonth = null;
        let currentWeek = null;
        let currentDay = null;
        
        transactions.forEach(txn => {
            const date = new Date(txn.date);
            const dateStr = date.toDateString();
            
            // Month Grouping (for label only)
            const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
            const monthLabel = date.toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' });
            
            if (!currentMonth || currentMonth.id !== monthKey) {
                currentMonth = {
                    id: monthKey,
                    label: monthLabel,
                    weeks: []
                };
                groups.push(currentMonth);
                currentWeek = null; 
                currentDay = null;
            }

            // Week Grouping
            const { id: weekId, label: weekLabel } = getWeekInfo(date, t, i18n.language);
            const distinctWeekId = `${weekId}-${monthKey}`;
            
            if (!currentWeek || currentWeek.id !== distinctWeekId) {
                currentWeek = {
                    id: distinctWeekId,
                    label: weekLabel,
                    days: [],
                    total: 0
                };
                currentMonth.weeks.push(currentWeek);
                currentDay = null;
            }
            
            currentWeek.total += txn.chargedAmount;
            
            if (!currentDay || currentDay.dateStr !== dateStr) {
                currentDay = {
                    dateStr,
                    transactions: []
                };
                currentWeek.days.push(currentDay);
            }
            currentDay.transactions.push(txn);
        });
        
        return groups;
    }, [transactions, t, i18n.language]);

    return (
        <div className="bg-white dark:bg-slate-800">
            {monthlyGroups.map((month) => (
                <React.Fragment key={month.id}>
                    {month.weeks.map((week) => (
                         <div key={week.id} className="relative">
                            <div className="px-4 py-1.5 bg-slate-50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between sticky top-[48px] z-10 backdrop-blur-sm">
                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ps-2 border-s-2 border-slate-300 dark:border-slate-600">
                                    {week.label}
                                </span>
                                 <span className="text-[10px] font-mono font-medium text-slate-400 dark:text-slate-500">
                                    {week.total > 0 ? '+' : ''}{new Intl.NumberFormat('en-IL', { style: 'decimal', minimumFractionDigits: 2 }).format(week.total)}
                                </span>
                            </div>
                            {week.days.map(day => (
                                <DailyTransactionGroup 
                                    key={day.dateStr} 
                                    dateStr={day.dateStr} 
                                    transactions={day.transactions} 
                                    balanceCurrency={balanceCurrency} 
                                />
                            ))}
                        </div>
                    ))}
                </React.Fragment>
            ))}
        </div>
    );
}

function MonthContent({ transactions, balanceCurrency, displayCount }) {
    const visibleTransactions = transactions.slice(0, displayCount || 20);
    
    return (
        <div className="w-full shrink-0">
            <CategoryPieChart transactions={transactions} balanceCurrency={balanceCurrency} />
            <SpendingChart transactions={transactions} />
            <MonthlyTransactionGroups transactions={visibleTransactions} balanceCurrency={balanceCurrency} />
        </div>
    );
}

function TransactionList({ 
    transactions, 
    onLoadMore, 
    isLoadingMore, 
    onNavigateMonth,
    slideDirection 
}) {
    const { t, i18n } = useTranslation();
    const { refreshData, loading, monthlyData, selectedMonthId, setSelectedMonthId } = useBanking();
    const [displayCount, setDisplayCount] = useState(20);
    const observerTarget = useRef(null);
    const containerRef = useRef(null);
    const touchStartX = useRef(null);
    const [dragOffset, setDragOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [noTransition, setNoTransition] = useState(false);
    const [containerWidth, setContainerWidth] = useState(0);
    const pendingDirection = useRef(null);

    // Reset display count when month changes
    useEffect(() => {
        setDisplayCount(20);
    }, [selectedMonthId]);

    // Handle external month changes (tab clicks)
    useEffect(() => {
        if (slideDirection && !isDragging && !isAnimating) {
            const direction = slideDirection === 'slide-left' ? 'next' : 'prev';
            const targetOffset = direction === 'next' ? -containerWidth : containerWidth;
            
            setIsAnimating(true);
            setDragOffset(targetOffset);
            pendingDirection.current = direction;
        }
    }, [selectedMonthId, slideDirection, containerWidth]);

    useEffect(() => {
        if (!containerRef.current) return;
        const resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                setContainerWidth(entry.contentRect.width);
            }
        });
        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    if (displayCount < transactions.length) {
                         setDisplayCount((prev) => Math.min(prev + 20, transactions.length));
                    }
                }
            },
            { threshold: 0.1, rootMargin: '200px' }
        );

        if (observerTarget.current) observer.observe(observerTarget.current);
        return () => {
            if (observerTarget.current) observer.unobserve(observerTarget.current);
        };
    }, [transactions, displayCount]);

    const handleTouchStart = (e) => {
        if (isAnimating) return;
        touchStartX.current = e.touches[0].clientX;
        setIsDragging(true);
        setNoTransition(false);
    };

    const handleTouchMove = (e) => {
        if (!touchStartX.current || isAnimating) return;
        const currentX = e.touches[0].clientX;
        const diff = currentX - touchStartX.current;
        const isRTL = i18n.dir() === 'rtl';
        
        // Add resistance at the boundaries
        const currentIndex = monthlyData.findIndex(m => m.id === selectedMonthId);
        let shouldResist = false;
        if (isRTL) {
            // In RTL: Swipe Left (<0) reveals Newer (Right Panel). Swipe Right (>0) reveals Older (Left Panel).
            if (currentIndex === 0 && diff < 0) shouldResist = true; // No newer month
            if (currentIndex === monthlyData.length - 1 && diff > 0) shouldResist = true; // No older month
        } else {
            // In LTR: Swipe Left (<0) reveals Older (Right Panel). Swipe Right (>0) reveals Newer (Left Panel).
            if (currentIndex === 0 && diff > 0) shouldResist = true; // No newer month
            if (currentIndex === monthlyData.length - 1 && diff < 0) shouldResist = true; // No older month
        }

        if (shouldResist) {
            setDragOffset(diff * 0.3);
        } else {
            setDragOffset(diff);
        }
    };

    const handleTouchEnd = (e) => {
        if (!touchStartX.current || isAnimating) return;
        const threshold = 60; // px
        const currentIndex = monthlyData.findIndex(m => m.id === selectedMonthId);
        const isRTL = i18n.dir() === 'rtl';

        // Mirror the logic for RTL
        const goNext = dragOffset < -threshold; // Swipe Left
        const goPrev = dragOffset > threshold; // Swipe Right

        if (isRTL) {
            // In RTL: Swipe Left reveals Right Panel (Newer), Swipe Right reveals Left Panel (Older)
            if (goNext && currentIndex > 0) {
                setIsAnimating(true);
                pendingDirection.current = 'prev';
                setDragOffset(-containerWidth);
            } else if (goPrev && currentIndex < monthlyData.length - 1) {
                setIsAnimating(true);
                pendingDirection.current = 'next';
                setDragOffset(containerWidth);
            } else {
                setIsAnimating(true);
                setDragOffset(0);
            }
        } else {
            // In LTR: Swipe Left reveals Right Panel (Older), Swipe Right reveals Left Panel (Newer)
            if (goNext && currentIndex < monthlyData.length - 1) {
                setIsAnimating(true);
                pendingDirection.current = 'next';
                setDragOffset(-containerWidth);
            } else if (goPrev && currentIndex > 0) {
                setIsAnimating(true);
                pendingDirection.current = 'prev';
                setDragOffset(containerWidth);
            } else {
                setIsAnimating(true);
                setDragOffset(0);
            }
        }
        
        setIsDragging(false);
        touchStartX.current = null;
    };

    const handleTransitionEnd = (e) => {
        if (e.target !== e.currentTarget) return;

        if (isAnimating && pendingDirection.current) {
            // 1. Disable transition for the "teleport" back to center
            setNoTransition(true);
            
            // 2. Update the actual data
            onNavigateMonth(pendingDirection.current);
            
            // 3. Reset position instantly
            setDragOffset(0);
            setIsAnimating(false);
            pendingDirection.current = null;
            
            // 4. Re-enable transitions for next interaction after a frame
            setTimeout(() => setNoTransition(false), 50);
        } else if (isAnimating) {
            setIsAnimating(false);
        }
    };

    const currentIndex = monthlyData.findIndex(m => m.id === selectedMonthId);
    const prevMonth = currentIndex > 0 ? monthlyData[currentIndex - 1] : null;
    const nextMonth = currentIndex < monthlyData.length - 1 ? monthlyData[currentIndex + 1] : null;

    const hasMoreLocal = displayCount < transactions.length;

    if (transactions.length === 0 && monthlyData.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-4 text-slate-400">
                    <Search size={24} />
                </div>
                <h3 className="text-slate-900 dark:text-white font-medium mb-1">{t('noTransactions')}</h3>
                <p className="text-slate-500 text-sm max-w-xs text-balance">
                    {t('noTransactionsDesc')}
                </p>
                {refreshData && (
                     <button 
                        onClick={refreshData}
                        disabled={loading}
                        className="mt-4 text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline flex items-center gap-2 mx-auto"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                        {loading ? t('checking') : t('refreshData')}
                    </button>
                )}
            </div>
        );
    }

    // Determine the base offset to keep current month centered
    const isRTL = i18n.dir() === 'rtl';
    const baseOffset = -containerWidth;
    const currentOffset = baseOffset + dragOffset;
    
    // In RTL, translateX(positive) moves right, translateX(negative) moves left.
    // However, the flex layout already flips the order of children.
    // If [Newer, Current, Older] are children, in RTL they are laid out [Older][Current][Newer] from LEFT to RIGHT in the coordinate space.
    // So Panel 1 (Newer) is at x = 2*width. Panel 2 (Current) is at x = width. Panel 3 (Older) is at x = 0.
    // To show Panel 2 at x=0, we need to translate by -width.
    // Wait, this is the SAME as LTR! 
    // BUT! Some Android browsers flip the logic. 
    // Let's ensure we are using a robust way.
    
    // Actually, I'll add a check for RTL and adjust if needed, but the physical translateX should be identical.
    // The real issue might be the 'items-start' and 'flex-row' behavior.

    return (
        <div 
            ref={containerRef}
            className="flex flex-col bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden touch-pan-y relative"
            dir="ltr"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            <div 
                className="flex items-start"
                style={{
                    width: '300%',
                    transform: `translateX(${(-100/3) + (dragOffset / (containerWidth || 1) * (100/3))}%)`,
                    transition: (isDragging || noTransition) ? 'none' : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                onTransitionEnd={handleTransitionEnd}
            >
                {/* Left Panel: Older in RTL, Newer in LTR */}
                <div dir={isRTL ? "rtl" : "ltr"} className="w-1/3 shrink-0 opacity-40 blur-[1px] pointer-events-none">
                    {isRTL ? (
                        nextMonth ? <MonthContent transactions={nextMonth.txns} balanceCurrency={nextMonth.txns[0]?.balanceCurrency || 'ILS'} displayCount={10} /> : <div className="h-64 flex items-center justify-center text-slate-400 text-xs font-medium uppercase tracking-widest">Beginning of Time</div>
                    ) : (
                        prevMonth ? <MonthContent transactions={prevMonth.txns} balanceCurrency={prevMonth.txns[0]?.balanceCurrency || 'ILS'} displayCount={10} /> : <div className="h-64 flex items-center justify-center text-slate-400 text-xs font-medium uppercase tracking-widest">End of History</div>
                    )}
                </div>

                {/* Current Month Panel */}
                <div dir={isRTL ? "rtl" : "ltr"} className="w-1/3 shrink-0">
                    <MonthContent transactions={transactions} balanceCurrency={transactions[0]?.balanceCurrency || 'ILS'} displayCount={displayCount} />
                </div>

                {/* Right Panel: Newer in RTL, Older in LTR */}
                <div dir={isRTL ? "rtl" : "ltr"} className="w-1/3 shrink-0 opacity-40 blur-[1px] pointer-events-none">
                    {isRTL ? (
                        prevMonth ? <MonthContent transactions={prevMonth.txns} balanceCurrency={prevMonth.txns[0]?.balanceCurrency || 'ILS'} displayCount={10} /> : <div className="h-64 flex items-center justify-center text-slate-400 text-xs font-medium uppercase tracking-widest">End of History</div>
                    ) : (
                        nextMonth ? <MonthContent transactions={nextMonth.txns} balanceCurrency={nextMonth.txns[0]?.balanceCurrency || 'ILS'} displayCount={10} /> : <div className="h-64 flex items-center justify-center text-slate-400 text-xs font-medium uppercase tracking-widest">Beginning of Time</div>
                    )}
                </div>
            </div>
            
            <div ref={observerTarget} className="p-4 flex justify-center border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30">
                {hasMoreLocal ? (
                    <div className="flex items-center gap-2 text-slate-400 text-sm animate-pulse">
                        <Loader2 size={16} className="animate-spin" />
                        <span>{t('loadingMore')}</span>
                    </div>
                ) : (
                    <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">{t('endOfList')}</span>
                )}
            </div>
        </div>
    );
}

function CategoryPieChart({ transactions, balanceCurrency }) {
    const { t } = useTranslation();
    const { categories: customCategories } = useBanking();
    
    const data = React.useMemo(() => {
        const map = new Map();
        let total = 0;
        
        transactions.forEach(t => {
            if (t.chargedAmount < 0) {
                const amt = Math.abs(t.chargedAmount);
                const cat = t.category || "Uncategorized";
                map.set(cat, (map.get(cat) || 0) + amt);
                total += amt;
            }
        });
        
        const sortedData = Array.from(map.entries())
            .map(([name, value]) => ({ 
                name, 
                value, 
                percent: total > 0 ? (value/total) * 100 : 0 
            }))
            .sort((a,b) => b.value - a.value);

        return {
            categories: sortedData.slice(0, 5),
            total
        };
    }, [transactions]);

    if (data.categories.length === 0) return null;

    let accumulatedPercent = 0;

    return (
        <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800 overflow-hidden">
             <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <PieChart size={14} className="text-slate-400" />
                    <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-300">
                        {t('spendingByCategory')}
                    </h3>
                </div>
                <span className="text-xs font-mono font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                    {new Intl.NumberFormat('en-IL', { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(data.total)} {balanceCurrency}
                </span>
            </div>
            
            <div className="p-4 flex items-center gap-6">
                {/* Donut Chart */}
                <div className="relative w-24 h-24 shrink-0">
                    <svg viewBox="0 0 42 42" className="w-full h-full rotate-[-90deg]">
                        <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#e2e8f0" strokeWidth="8" className="dark:stroke-slate-700" />
                        {data.categories.map((item, i) => {
                            const offset = 100 - accumulatedPercent;
                            accumulatedPercent += item.percent;
                            
                            const style = getCategoryStyle(item.name, customCategories);
                            
                            const HEX_MAP = {
                                red: "#ef4444",
                                blue: "#3b82f6",
                                green: "#22c55e",
                                amber: "#f59e0b",
                                violet: "#8b5cf6",
                                pink: "#ec4899",
                                orange: "#f97316",
                                cyan: "#06b6d4",
                                lime: "#84cc16",
                                indigo: "#6366f1",
                                rose: "#f43f5e",
                                slate: "#64748b",
                                emerald: "#10b981",
                                fuchsia: "#d946ef",
                                teal: "#14b8a6",
                                sky: "#0ea5e9"
                            };
                            const stroke = HEX_MAP[style.colorName] || HEX_MAP.slate;

                            return (
                                <circle
                                    key={item.name}
                                    cx="21"
                                    cy="21"
                                    r="15.91549430918954"
                                    fill="transparent"
                                    stroke={stroke}
                                    strokeWidth="8"
                                    strokeDasharray={`${item.percent} ${100 - item.percent}`}
                                    strokeDashoffset={offset}
                                    className="transition-all duration-500"
                                />
                            );
                        })}
                    </svg>
                </div>

                {/* Legend - One Column */}
                <div className="flex-1 flex flex-col gap-y-2 w-full min-w-0">
                    {data.categories.map((item, i) => {
                        const style = getCategoryStyle(item.name, customCategories);
                        const bgClass = style.colorClass.split(' ').find(c => c.includes('dot-bg-'))?.replace('dot-bg-', 'bg-') || "bg-slate-500";
                        
                        return (
                            <div key={item.name} className="flex items-center justify-between min-w-0 group">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <div className={`w-2 h-2 rounded-full shrink-0 ${bgClass}`} />
                                    <span className="text-xs text-slate-600 dark:text-slate-300 truncate font-medium" title={t(`categories.${item.name}`, item.name)}>
                                        {t(`categories.${item.name}`, item.name)}
                                    </span>
                                </div>
                                <div className="text-right shrink-0 pl-4 flex items-center gap-3">
                                    <span className="text-[10px] text-slate-400 font-medium tabular-nums group-hover:text-slate-500 transition-colors">
                                        {item.percent.toFixed(0)}%
                                    </span>
                                    <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                                        {new Intl.NumberFormat('en-IL', { notation: "standard", maximumFractionDigits: 0 }).format(item.value)}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export function BankingApp() {
  const { t, ready } = useTranslation();
  const { 
    tokens,
    data, 
    loading, 
    loadingMore, 
    statusMessage,
    login, 
    loadMore
  } = useBanking();

  if (!ready) return <div className="flex items-center justify-center h-screen">Loading language...</div>;

  const hasToken = tokens && tokens.length > 0;
  const hasData = data && data.accounts && data.accounts.length > 0;

  if (!hasToken && !hasData) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[80vh] relative overflow-hidden">
              {/* Decorative Background */}
              <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl opacity-50 dark:opacity-20 animate-pulse" style={{ animationDuration: '4s' }} />
                  <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-purple-500/10 rounded-full blur-3xl opacity-30 dark:opacity-10" />
                  <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-3xl opacity-30 dark:opacity-10" />
              </div>

              <div className="flex flex-col items-center text-center p-8 max-w-2xl mx-auto z-10 animate-in slide-in-from-bottom-8 duration-700 fade-in">
                  <div className="mb-8 p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-blue-900/5 ring-1 ring-slate-200 dark:ring-white/10 rotate-[-6deg] hover:rotate-0 transition-transform duration-500 ease-out cursor-default group">
                       <div className="bg-blue-600 p-3 rounded-xl text-white group-hover:scale-110 transition-transform duration-300">
                          <Landmark size={32} />
                       </div>
                  </div>
                  
                  <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-6 text-balance">
                      {t('heroTitle')} <span className="text-blue-600 dark:text-blue-400 relative whitespace-nowrap">
                          {t('heroHighlight')}
                          <svg className="absolute -bottom-2 left-0 w-full h-2 text-blue-200 dark:text-blue-800 -z-10" viewBox="0 0 100 10" preserveAspectRatio="none">
                              <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="4" fill="none" />
                          </svg>
                      </span>.
                  </h1>
                  
                  <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-lg mx-auto text-pretty mb-10 leading-relaxed">
                      {t('heroSubtitle')}
                  </p>
                  
                  <button
                      onClick={login}
                      className="group relative inline-flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold py-4 px-10 rounded-full transition-all shadow-xl hover:shadow-blue-600/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
                  >
                      <ShieldCheck size={20} className="text-blue-200" />
                      <span>{t('connectBank')}</span>
                      <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </button>

                  {/* Trust Indicators */}
                  <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8 text-sm text-slate-600 dark:text-slate-400 w-full max-w-xl">
                      <div className="flex flex-col items-center gap-3 p-4 rounded-xl hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors">
                          <div className="p-2.5 bg-green-50 dark:bg-green-900/20 rounded-full text-green-600 dark:text-green-400">
                              <ShieldCheck size={20} />
                          </div>
                          <span className="font-medium">{t('security')}</span>
                      </div>
                      <div className="flex flex-col items-center gap-3 p-4 rounded-xl hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors">
                          <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-full text-blue-600 dark:text-blue-400">
                              <Zap size={20} />
                          </div>
                          <span className="font-medium">{t('realTimeSync')}</span>
                      </div>
                      <div className="flex flex-col items-center gap-3 p-4 rounded-xl hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors">
                          <div className="p-2.5 bg-purple-50 dark:bg-purple-900/20 rounded-full text-purple-600 dark:text-purple-400">
                              <EyeOff size={20} />
                          </div>
                          <span className="font-medium">{t('readOnlyAccess')}</span>
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-12">
      {loading && !data && (
          <div className="space-y-6">
              <div className="flex flex-col items-center justify-center py-8 space-y-3">
                  <div className="relative">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <Landmark size={24} className="animate-bounce" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center">
                        <Loader2 size={12} className="animate-spin text-blue-500" />
                    </div>
                  </div>
                  <div className="text-center">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('syncingYourData')}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{statusMessage || t('syncingDesc')}</p>
                  </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden animate-pulse">
                  <div className="p-6 space-y-6">
                      <div className="flex items-center justify-between">
                          <Skeleton className="h-8 w-32" />
                          <Skeleton className="h-8 w-24 rounded-full" />
                      </div>
                      <div className="space-y-4">
                          {[1, 2, 3, 4, 5].map((i) => (
                              <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-700/50 last:border-0">
                                  <div className="flex items-center gap-4">
                                      <Skeleton className="h-12 w-12 rounded-full" />
                                      <div className="space-y-2">
                                          <Skeleton className="h-4 w-40" />
                                          <Skeleton className="h-3 w-20" />
                                      </div>
                                  </div>
                                  <Skeleton className="h-5 w-16" />
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {!loading && !data && (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm animate-in fade-in zoom-in duration-500">
              <div className="w-20 h-20 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mb-6 text-amber-500">
                  <PieChart size={40} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Data Sync Required</h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto mb-8">
                  Your accounts are connected, but we couldn't load your transaction history. This might be due to a storage issue or a required sync.
              </p>
              
              <div className="flex flex-col gap-3 w-full max-w-xs">
                  <button 
                      onClick={() => refreshData()}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                  >
                      <RefreshCw size={18} />
                      Sync Now
                  </button>
                  
                  <button 
                      onClick={() => {
                          if (confirm("This will clear your local transaction cache. Your bank connections will remain. Continue?")) {
                              localStorage.removeItem(`banking_data_${conversationId}`);
                              window.location.reload();
                          }
                      }}
                      className="w-full py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
                  >
                      Reset Local Cache
                  </button>
              </div>
          </div>
      )}

      {data && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <Dashboard loadingMore={loadingMore} onLoadMore={loadMore} />
        </div>
      )}
    </div>
  );
}

function Dashboard({ loadingMore, onLoadMore }) {
    const { t } = useTranslation();
    const { 
        allTransactions, 
        monthlyData, 
        selectedMonthId, 
        setSelectedMonthId 
    } = useBanking();
    const [slideDirection, setSlideDirection] = useState(""); // "left" or "right"
    
    if (!allTransactions || allTransactions.length === 0) return (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900/50 rounded-full flex items-center justify-center mb-6 text-slate-300 dark:text-slate-600">
                <Landmark size={40} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('noTransactionsTitle')}</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto mb-8">
                {t('noTransactionsAccountDesc')}
            </p>
        </div>
    );

    const handleSetMonthId = (id, isManual = true) => {
        if (id === selectedMonthId) return;
        
        const currentIndex = monthlyData.findIndex(m => m.id === selectedMonthId);
        const nextIndex = monthlyData.findIndex(m => m.id === id);
        
        if (isManual) {
            if (nextIndex > currentIndex) setSlideDirection("slide-left");
            else setSlideDirection("slide-right");
            
            // Reset direction after animation duration
            setTimeout(() => setSlideDirection(""), 500);
        } else {
            setSlideDirection("");
        }
        
        setSelectedMonthId(id);
    };

    const navigateMonth = (direction) => {
        const currentIndex = monthlyData.findIndex(m => m.id === selectedMonthId);
        if (currentIndex === -1) return;

        if (direction === 'next' && currentIndex < monthlyData.length - 1) {
            handleSetMonthId(monthlyData[currentIndex + 1].id, false);
        } else if (direction === 'prev' && currentIndex > 0) {
            handleSetMonthId(monthlyData[currentIndex - 1].id, false);
        }
    };

    const currentMonth = monthlyData.find(m => m.id === selectedMonthId) || monthlyData[0];
    const filteredTxns = currentMonth ? currentMonth.txns : [];

    return (
        <div className="space-y-6">
            <div className="space-y-6 animate-in fade-in duration-300">
                <TransactionList 
                    transactions={filteredTxns} 
                    onLoadMore={onLoadMore}
                    isLoadingMore={loadingMore}
                    onNavigateMonth={navigateMonth}
                    slideDirection={slideDirection}
                />
            </div>
        </div>
    );
}

function CategoryManager({ isOpen, onClose }) {
    const { categories: customCategories, editCategories } = useBanking();
    const [categories, setCategories] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    
    useEffect(() => {
        if (isOpen) {
            const colors = Object.keys(COLOR_MAP);
            let initial = customCategories.length > 0 ? [...customCategories] : [];
            
            // If no custom categories, start with defaults
            if (initial.length === 0) {
                initial = Object.entries(DEFAULT_CATEGORY_STYLES)
                    .filter(([name]) => name !== "Uncategorized")
                    .map(([name, style]) => ({ name, icon: style.icon, color: style.color }));
            } else {
                // Merge missing defaults if there's space
                Object.entries(DEFAULT_CATEGORY_STYLES).forEach(([name, style]) => {
                    if (name === "Uncategorized") return;
                    if (!initial.find(c => c.name === name)) {
                        const takenColors = initial.map(c => c.color);
                        const availableColor = colors.find(col => !takenColors.includes(col));
                        if (availableColor) {
                            initial.push({ name, icon: style.icon, color: style.color });
                        }
                    }
                });
            }
            setCategories(initial);
        }
    }, [isOpen, customCategories]);

    const colors = Object.keys(COLOR_MAP);

    const handleCellClick = (color) => {
        const catAtColor = categories.find(c => c.color === color);
        
        if (!selectedId) {
            if (catAtColor) {
                setSelectedId(catAtColor.name);
            }
            return;
        }

        const selectedCat = categories.find(c => c.name === selectedId);
        
        // Deselect if clicking the same category
        if (catAtColor && catAtColor.name === selectedId) {
            setSelectedId(null);
            return;
        }

        // Move or Switch
        const newCategories = categories.map(c => {
            if (c.name === selectedId) return { ...c, color: color };
            if (catAtColor && c.name === catAtColor.name) return { ...c, color: selectedCat.color };
            return c;
        });

        setCategories(newCategories);
        setSelectedId(null);
    };

    const handleSave = async () => {
        await editCategories(categories);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} title="Manage Categories">
            <div className="relative p-2">
                <p className="text-xs text-slate-500 mb-4 px-2">Click an icon to select, then click another cell to move or swap.</p>
                
                <div className="grid grid-cols-4 gap-3">
                    {colors.map(color => {
                        const cat = categories.find(c => c.color === color);
                        const isSelected = selectedId && cat?.name === selectedId;
                        const isTarget = selectedId && !isSelected;
                        const dotBgClass = COLOR_MAP[color].split(' ').find(c => c.includes('dot-bg-'))?.replace('dot-bg-', 'bg-') || "bg-slate-200 dark:bg-slate-700";

                        return (
                            <div 
                                key={color}
                                onClick={() => handleCellClick(color)}
                                className={`relative aspect-square rounded-2xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-1 cursor-pointer select-none
                                    ${isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 ring-4 ring-blue-500/10 z-10 scale-105' : 'border-transparent bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800'}
                                    ${isTarget ? 'hover:border-blue-300 dark:hover:border-blue-700' : ''}
                                `}
                            >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-sm transition-all duration-300 
                                    ${dotBgClass}
                                    ${cat ? 'opacity-100' : 'opacity-40 border-2 border-dashed border-black/10 dark:border-white/10'}
                                    ${isSelected ? 'animate-pulse shadow-blue-500/50' : ''}
                                `}>
                                    {cat?.icon}
                                </div>
                                {cat && (
                                    <span className={`text-[9px] font-bold truncate w-full px-1 text-center transition-colors duration-200 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>
                                        {cat.name}
                                    </span>
                                )}
                                
                                {isSelected && (
                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800">
                                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="flex gap-3 pt-6 mt-4 border-t border-slate-100 dark:border-slate-700">
                <button 
                    onClick={onClose}
                    className="flex-1 py-3 text-sm font-bold text-slate-500 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                    Cancel
                </button>
                <button 
                    onClick={handleSave}
                    className="flex-1 py-3 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"
                >
                    Save Changes
                </button>
            </div>
        </Modal>
    );
}

function GlobalModals() {
  const { t } = useTranslation();
  const { 
    otpNeeded, 
    otpValue, 
    setOtpValue, 
    submitOtp,
    loading,
    statusMessage,
    errorMessage,
    showLoginModal
  } = useBanking();

  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);

  useEffect(() => {
    const handleShow = () => setIsCategoryManagerOpen(true);
    window.addEventListener('SHOW_CATEGORY_MANAGER', handleShow);
    return () => window.removeEventListener('SHOW_CATEGORY_MANAGER', handleShow);
  }, []);

  return (
    <>
      <LoginModal />
      <CategoryManager isOpen={isCategoryManagerOpen} onClose={() => setIsCategoryManagerOpen(false)} />
      <Modal isOpen={otpNeeded && !showLoginModal} title={t('securityVerification')}>
          <form onSubmit={submitOtp} className="space-y-6">
              <div className="text-center space-y-2">
                  <p className="text-slate-600 dark:text-slate-300">
                      {t('verificationSent')}
                  </p>
                  <p className="text-xs text-slate-400">{t('doNotShare')}</p>
              </div>
              
              <div className="flex justify-center">
                  <input
                      type="text"
                      value={otpValue}
                      onChange={(e) => setOtpValue(e.target.value)}
                      placeholder="000000"
                      maxLength={8}
                      className="w-48 text-center text-3xl font-mono tracking-[0.5em] p-3 border-b-2 border-slate-300 dark:border-slate-600 bg-transparent text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none transition-colors"
                      autoFocus
                      disabled={loading}
                  />
              </div>

              {loading && statusMessage && (
                  <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-lg text-sm text-blue-700 dark:text-blue-300 animate-in fade-in slide-in-from-top-1">
                      <Loader2 size={16} className="animate-spin shrink-0" />
                      <span>{statusMessage}</span>
                  </div>
              )}

              {errorMessage && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-lg text-sm text-red-600 dark:text-red-400 animate-in fade-in slide-in-from-top-1">
                      {errorMessage}
                  </div>
              )}
              
              <button
                  type="submit"
                  disabled={loading || !otpValue}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-medium py-2.5 px-4 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                  {loading ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>{t('verifying')}</span>
                      </>
                  ) : (
                      t('verifyIdentity')
                  )}
              </button>
          </form>
      </Modal>
    </>
  );
}

function App() {
  const { i18n } = useTranslation();

  useEffect(() => {
    const updateDir = (lng) => {
      const dir = lng === 'he' ? 'rtl' : 'ltr';
      document.documentElement.dir = dir;
      document.documentElement.lang = lng;
    };

    if (i18n.isInitialized) {
        updateDir(i18n.language);
    }

    i18n.on('languageChanged', updateDir);
    return () => i18n.off('languageChanged', updateDir);
  }, [i18n]);

  return (
    <ThemeProvider>
      <ToastProvider>
        <BankingProvider>
            <GlobalModals />
            <MainLayout>
              <BankingApp />
            </MainLayout>
        </BankingProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, copied: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  copyToClipboard = () => {
    const errorText = `${this.state.error?.toString()}\n\nStack Trace:\n${this.state.error?.stack}`;
    navigator.clipboard.writeText(errorText).then(() => {
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-900">
          <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-red-100 dark:border-red-900/30 p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
               <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <Zap size={24} />
               </div>
               <h2 className="text-xl font-bold">Something went wrong</h2>
            </div>
            
            <p className="text-sm text-slate-600 dark:text-slate-400">
                The application encountered an unexpected error. You can try refreshing the page or copy the error details below to report it.
            </p>

            <div className="relative group">
                <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-auto max-h-[300px] border border-slate-800">
                {this.state.error?.toString()}
                {"\n\n"}
                {this.state.error?.stack}
                </pre>
                
                <button 
                    onClick={this.copyToClipboard}
                    className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg backdrop-blur-md transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider"
                >
                    {this.state.copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                    {this.state.copied ? 'Copied!' : 'Copy Error'}
                </button>
            </div>

            <button 
                onClick={() => window.location.reload()}
                className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:opacity-90 transition-opacity"
            >
                Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

if (typeof document !== 'undefined' && document.getElementById("root")) {
    const root = createRoot(document.getElementById("root"));
    root.render(
      <ErrorBoundary>
        <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading translations...</div>}>
          <App />
        </Suspense>
      </ErrorBoundary>
    );
}

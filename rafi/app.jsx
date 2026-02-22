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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
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
    
    // Define solid colors for the chart
    const getCategoryColor = (name) => {
        const colors = {
            "Food & Dining": "#fb923c", // orange-400
            "Groceries": "#34d399", // emerald-400
            "Transport": "#60a5fa", // blue-400
            "Utilities": "#fbbf24", // amber-400
            "Shopping": "#c084fc", // purple-400
            "Entertainment": "#f472b6", // pink-400
            "Health": "#f87171", // red-400
            "Transfer": "#9ca3af", // gray-400
            "Income": "#10b981", // emerald-500 (usually positive, handled separately?)
            "Other": "#94a3b8", // slate-400
            "Uncategorized": "#cbd5e1" // slate-300
        };
        // Dark mode variants could be handled via CSS variables or checking theme context, 
        // but for SVG fills, we often pick a middle ground or use CSS classes.
        // Let's stick to using Tailwind classes on the rects for better dark mode support.
        
        const colorClasses = {
             "Food & Dining": "fill-orange-400 dark:fill-orange-500",
             "Groceries": "fill-emerald-400 dark:fill-emerald-500",
             "Transport": "fill-blue-400 dark:fill-blue-500",
             "Utilities": "fill-amber-400 dark:fill-amber-500",
             "Shopping": "fill-purple-400 dark:fill-purple-500",
             "Entertainment": "fill-pink-400 dark:fill-pink-500",
             "Health": "fill-red-400 dark:fill-red-500",
             "Transfer": "fill-gray-400 dark:fill-gray-500",
             "Income": "fill-green-500 dark:fill-green-600",
             "Other": "fill-slate-400 dark:fill-slate-500",
             "Uncategorized": "fill-slate-300 dark:fill-slate-600"
        };
        return colorClasses[name] || colorClasses["Other"];
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
                                        
                                        // Rounded corners only for the top segment if it's the first one rendered (visually top)
                                        // SVG stacking: first rendered is bottom? No, Painter's algo.
                                        // We are calculating from bottom up (currentY = height).
                                        // So the first segment in the loop is at the bottom (y = height - h).
                                        // The LAST segment in the loop will be at the TOP.
                                        const isTop = idx === d.segments.length - 1;
                                        
                                        return (
                                            <rect
                                                key={seg.cat}
                                                x={x}
                                                y={y}
                                                width={barWidth}
                                                height={segHeight}
                                                rx={isTop ? 2 : 0} // Only round top corners of the stack
                                                className={`${getCategoryColor(seg.cat)} transition-colors duration-200 hover:opacity-80`}
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


const CATEGORY_STYLES = {
  "Food & Dining": { icon: "🍔", color: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300" },
  "Groceries": { icon: "🛒", color: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-300" },
  "Transport": { icon: "🚌", color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300" },
  "Utilities": { icon: "💡", color: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-300" },
  "Shopping": { icon: "🛍️", color: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300" },
  "Entertainment": { icon: "🎬", color: "bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-300" },
  "Health": { icon: "🏥", color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300" },
  "Transfer": { icon: "💸", color: "bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-300" },
  "Income": { icon: "💰", color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300" },
  "Other": { icon: "📄", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  "Uncategorized": { icon: "❓", color: "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500" }
};

function TransactionRow({ txn, balanceCurrency }) {
    const { t } = useTranslation();
    const isIncome = txn.chargedAmount > 0;
    
    // Determine category style
    const categoryName = txn.category || "Uncategorized";
    const style = CATEGORY_STYLES[categoryName] || CATEGORY_STYLES["Other"];

    return (
        <div className="group flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0">
            <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg shadow-sm ${style.color}`}>
                    {style.icon}
                </div>
                
                <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 dark:text-white truncate text-pretty group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {txn.description}
                        </span>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-0.5">
                         <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            {t(`categories.${categoryName}`, categoryName)}
                         </span>
                         {txn.originalAmount !== txn.chargedAmount && (
                             <span className="text-xs text-slate-500 dark:text-slate-400 opacity-75">
                                ({txn.originalAmount} {txn.originalCurrency})
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className={`text-sm font-bold tabular-nums whitespace-nowrap ${isIncome ? 'text-green-600 dark:text-green-400' : 'text-slate-900 dark:text-white'}`}>
                {isIncome ? '+' : ''}{txn.chargedAmount} <span className="text-xs font-normal text-slate-500">{balanceCurrency}</span>
            </div>
        </div>
    );
}

function DailyTransactionGroup({ dateStr, transactions, balanceCurrency }) {
    const { t, i18n } = useTranslation();
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
                            // Extract just the background color class, assuming the style string format "bg-X text-Y ..."
                            const style = CATEGORY_STYLES[catName] || CATEGORY_STYLES["Other"];
                            // Simple regex or split to get the bg color part. 
                            // Our styles are like: "bg-orange-100 text-orange-600 dark:bg-orange-900/30..."
                            // For the dot we want the "solid" color usually associated with the category.
                            // Since our existing styles use pastel backgrounds for badges, let's map to the solid colors used in the chart
                            // or fallback to the badge background color but make it smaller.
                            
                            // Reusing the chart color mapping logic for consistency would be ideal, 
                            // but for now let's use a simpler class-based approach based on the badge styles 
                            // but stripping the text color.
                            
                            // Actually, using the chart colors (solid) reads better for small dots.
                            // Let's make a quick helper or inline map for "dot" colors to ensure they pop.
                            
                            const getDotColor = (name) => {
                                const colors = {
                                    "Food & Dining": "bg-orange-400 dark:bg-orange-500",
                                    "Groceries": "bg-emerald-500 dark:bg-emerald-400",
                                    "Transport": "bg-blue-500 dark:bg-blue-400",
                                    "Utilities": "bg-amber-400 dark:bg-amber-500",
                                    "Shopping": "bg-purple-500 dark:bg-purple-400",
                                    "Entertainment": "bg-pink-500 dark:bg-pink-400",
                                    "Health": "bg-red-500 dark:bg-red-400",
                                    "Transfer": "bg-gray-400 dark:bg-gray-500",
                                    "Income": "bg-green-600 dark:bg-green-500",
                                    "Other": "bg-slate-400 dark:bg-slate-500",
                                    "Uncategorized": "bg-slate-300 dark:bg-slate-600"
                                };
                                return colors[name] || colors["Other"];
                            };

                            return (
                                <div 
                                    key={i} 
                                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${getDotColor(catName)}`} 
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
                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-2 border-l-2 border-slate-300 dark:border-slate-600">
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
    balanceCurrency, 
    onLoadMore, 
    isLoadingMore, 
    monthlyData = [], 
    selectedMonthId, 
    setSelectedMonthId,
    onNavigateMonth,
    slideDirection 
}) {
    const { t, i18n } = useTranslation();
    const { refreshData, loading } = useBanking();
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
        
        // Add resistance at the boundaries
        const currentIndex = monthlyData.findIndex(m => m.id === selectedMonthId);
        if ((currentIndex === 0 && diff > 0) || (currentIndex === monthlyData.length - 1 && diff < 0)) {
            setDragOffset(diff * 0.3);
        } else {
            setDragOffset(diff);
        }
    };

    const handleTouchEnd = (e) => {
        if (!touchStartX.current || isAnimating) return;
        const threshold = 60; // px
        const currentIndex = monthlyData.findIndex(m => m.id === selectedMonthId);

        if (dragOffset < -threshold && currentIndex < monthlyData.length - 1) {
            // Snap to Next (Older) -> Slide Left
            setIsAnimating(true);
            pendingDirection.current = 'next';
            setDragOffset(-containerWidth);
        } else if (dragOffset > threshold && currentIndex > 0) {
            // Snap to Prev (Newer) -> Slide Right
            setIsAnimating(true);
            pendingDirection.current = 'prev';
            setDragOffset(containerWidth);
        } else {
            // Snap back
            setIsAnimating(true);
            setDragOffset(0);
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
    const baseOffset = -containerWidth;
    const currentOffset = baseOffset + dragOffset;

    return (
        <div 
            ref={containerRef}
            className="flex flex-col bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden touch-pan-y"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
             <div className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 sticky top-0 backdrop-blur-md z-20">
                <div className="flex items-center gap-2 overflow-x-auto p-2 scrollbar-hide">
                    {monthlyData.map(month => (
                        <button
                            key={month.id}
                            onClick={() => setSelectedMonthId(month.id)}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-full whitespace-nowrap transition-all border ${
                                selectedMonthId === month.id 
                                ? 'bg-blue-600 text-white shadow-sm border-blue-500' 
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                            }`}
                        >
                            <span className="text-xs font-bold tracking-tight">{month.label} {month.year !== new Date().getFullYear() ? `'${month.year.toString().slice(-2)}` : ''}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                                selectedMonthId === month.id ? 'bg-blue-500 text-blue-50' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-500'
                            }`}>
                                {month.txns.length}
                            </span>
                        </button>
                    ))}
                    <button
                        onClick={refreshData}
                        disabled={loading}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full whitespace-nowrap text-blue-600 dark:text-blue-400 text-xs font-bold hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50 ml-auto"
                        title={t('refreshData')}
                    >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    </button>
                </div>
            </div>

            <div 
                className="flex w-full items-start"
                style={{
                    width: `${containerWidth * 3}px`,
                    transform: `translateX(${currentOffset}px)`,
                    transition: (isDragging || noTransition) ? 'none' : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                onTransitionEnd={handleTransitionEnd}
            >
                {/* Previous Month Panel (Newer) */}
                <div className="w-full shrink-0 opacity-40 blur-[1px] pointer-events-none" style={{ width: containerWidth }}>
                    {prevMonth ? (
                        <MonthContent transactions={prevMonth.txns} balanceCurrency={balanceCurrency} displayCount={10} />
                    ) : (
                        <div className="h-64 flex items-center justify-center text-slate-400 text-xs font-medium uppercase tracking-widest">End of History</div>
                    )}
                </div>

                {/* Current Month Panel */}
                <div className="w-full shrink-0" style={{ width: containerWidth }}>
                    <MonthContent transactions={transactions} balanceCurrency={balanceCurrency} displayCount={displayCount} />
                </div>

                {/* Next Month Panel (Older) */}
                <div className="w-full shrink-0 opacity-40 blur-[1px] pointer-events-none" style={{ width: containerWidth }}>
                    {nextMonth ? (
                        <MonthContent transactions={nextMonth.txns} balanceCurrency={balanceCurrency} displayCount={10} />
                    ) : (
                        <div className="h-64 flex items-center justify-center text-slate-400 text-xs font-medium uppercase tracking-widest">Beginning of Time</div>
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
                            
                            const colors = [
                                "#3b82f6", // blue-500
                                "#10b981", // emerald-500
                                "#f59e0b", // amber-500
                                "#ef4444", // red-500
                                "#8b5cf6", // violet-500
                                "#64748b"  // slate-500
                            ];
                            
                            return (
                                <circle
                                    key={item.name}
                                    cx="21"
                                    cy="21"
                                    r="15.91549430918954"
                                    fill="transparent"
                                    stroke={colors[i % colors.length]}
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
                         const colors = [
                            "bg-blue-500", 
                            "bg-emerald-500", 
                            "bg-amber-500", 
                            "bg-red-500", 
                            "bg-violet-500", 
                            "bg-slate-500"
                        ];
                        
                        return (
                            <div key={item.name} className="flex items-center justify-between min-w-0 group">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <div className={`w-2 h-2 rounded-full shrink-0 ${colors[i % colors.length]}`} />
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

function BankingApp() {
  const { t, ready } = useTranslation();
  const { 
    token, 
    data, 
    loading, 
    loadingMore, 
    statusMessage,
    login, 
    loadMore, 
    otpNeeded, 
    otpValue, 
    setOtpValue, 
    submitOtp 
  } = useBanking();

  if (!ready) return <div className="flex items-center justify-center h-screen">Loading language...</div>;

  if (!token) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[80vh] relative overflow-hidden">
              <LoginModal />

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
        <Modal isOpen={otpNeeded} title={t('securityVerification')}>
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
                    />
                </div>
                
                <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors shadow-sm"
                >
                    {t('verifyIdentity')}
                </button>
            </form>
        </Modal>


      
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

      {data && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <Dashboard loadingMore={loadingMore} onLoadMore={loadMore} />
        </div>
      )}
    </div>
  );
}

function Dashboard({ loadingMore, onLoadMore }) {
    const { accounts, selectedAccountIndex } = useBanking();
    const { i18n } = useTranslation();
    const [selectedMonthId, setSelectedMonthId] = useState(null);
    const [slideDirection, setSlideDirection] = useState(""); // "left" or "right"
    
    if (!accounts || accounts.length === 0) return (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900/50 rounded-full flex items-center justify-center mb-6 text-slate-300 dark:text-slate-600">
                <Landmark size={40} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No accounts detected</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto mb-8">
                We couldn't find any active accounts for this bank connection. If this is unexpected, try refreshing.
            </p>
        </div>
    );

    const selectedAccount = accounts[selectedAccountIndex] || accounts[0];
    const allTxns = selectedAccount.txns || [];
    const sortedTxns = [...allTxns].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Grouping by month for tabs
    const monthlyData = React.useMemo(() => {
        const months = new Map();
        sortedTxns.forEach(txn => {
            const date = new Date(txn.date);
            const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
            if (!months.has(monthKey)) {
                months.set(monthKey, {
                    id: monthKey,
                    label: date.toLocaleDateString(i18n.language, { month: 'short' }),
                    year: date.getFullYear(),
                    txns: [],
                    fullDate: date
                });
            }
            months.get(monthKey).txns.push(txn);
        });
        return Array.from(months.values()).sort((a, b) => b.fullDate - a.fullDate);
    }, [sortedTxns, i18n.language]);

    useEffect(() => {
        if (monthlyData.length > 0 && !selectedMonthId) {
            setSelectedMonthId(monthlyData[0].id);
        }
    }, [monthlyData, selectedMonthId]);

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
            <div key={selectedAccount.accountNumber} className="space-y-6 animate-in fade-in duration-300">
                <TransactionList 
                    transactions={filteredTxns} 
                    balanceCurrency={selectedAccount.balanceCurrency}
                    onLoadMore={onLoadMore}
                    isLoadingMore={loadingMore}
                    monthlyData={monthlyData}
                    selectedMonthId={selectedMonthId}
                    setSelectedMonthId={handleSetMonthId}
                    onNavigateMonth={navigateMonth}
                    slideDirection={slideDirection}
                />
            </div>
        </div>
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

const root = createRoot(document.getElementById("root"));
root.render(
  <ErrorBoundary>
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading translations...</div>}>
      <App />
    </Suspense>
  </ErrorBoundary>
);

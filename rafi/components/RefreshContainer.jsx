import React, { useState, useEffect, useRef } from "react";
import { useBanking } from "../contexts/BankingContext.jsx";
import { useTranslation } from "react-i18next";
import { RefreshCw, CheckCircle2, ChevronDown } from "lucide-react";

export function RefreshContainer({ children }) {
    const { t } = useTranslation();
    const { loading, refreshData, statusMessage, token, lastSyncTime } = useBanking();
    const [pullDistance, setPullDistance] = useState(0);
    const [isPulling, setIsPulling] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const containerRef = useRef(null);
    const startY = useRef(0);
    const PULL_THRESHOLD = 90;
    const MAX_PULL = 150;

    // We want to track the actual refreshing state to show success after loading ends
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    useEffect(() => {
        if (loading) {
            setIsRefreshing(true);
            setShowSuccess(false);
        } else if (isRefreshing) {
            // Just finished loading
            setShowSuccess(true);
            
            // Haptic feedback for Android
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate([50, 30, 50]); // Short double-tap pulse
            }

            const timer = setTimeout(() => {
                setShowSuccess(false);
                setIsRefreshing(false);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [loading, isRefreshing]);

    const handleTouchStart = (e) => {
        if (containerRef.current.scrollTop <= 0 && !isRefreshing) {
            startY.current = e.touches[0].pageY;
            setIsPulling(true);
        }
    };

    const handleTouchMove = (e) => {
        if (!isPulling) return;
        const currentY = e.touches[0].pageY;
        const distance = currentY - startY.current;
        
        if (distance > 0) {
            // Logarithmic resistance for a more natural feel
            // distance / (1 + distance / MAX_PULL)
            const resistedDistance = Math.min(distance * 0.4, MAX_PULL);
            setPullDistance(resistedDistance);
            
            // Prevent browser pull-to-refresh and scrolling when we are handling it
            if (resistedDistance > 10 && e.cancelable) {
                e.preventDefault();
            }
        } else {
            setPullDistance(0);
            setIsPulling(false);
        }
    };

    const handleTouchEnd = () => {
        if (!isPulling) return;
        
        if (pullDistance >= PULL_THRESHOLD) {
            setIsRefreshing(true); // Eagerly set to show the indicator
            refreshData();
        }
        
        setIsPulling(false);
        setPullDistance(0);
    };

    const active = token && (isRefreshing || pullDistance > 0 || showSuccess);
    const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);

    return (
        <main 
            ref={containerRef}
            className="flex-1 overflow-auto relative touch-pan-y select-none"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Refresh Indicator Background / Slot */}
            <div 
                className="absolute left-0 right-0 overflow-hidden pointer-events-none flex flex-col items-center justify-center z-50"
                style={{ 
                    height: '80px',
                    top: (isRefreshing || showSuccess) ? '0px' : `${pullDistance - 80}px`,
                    opacity: active ? 1 : 0,
                    transition: isPulling ? 'none' : 'top 0.3s cubic-bezier(0.2, 0, 0, 1), opacity 0.3s'
                }}
            >
                <div className={`
                    flex items-center gap-3 px-4 py-2.5 rounded-full shadow-lg border
                    ${showSuccess ? 'bg-green-50 border-green-100 dark:bg-green-900/30 dark:border-green-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}
                    animate-in zoom-in-95 duration-300
                `}>
                    <div className="relative w-6 h-6 flex items-center justify-center">
                        {showSuccess ? (
                            <CheckCircle2 size={20} className="text-green-500 animate-in fade-in zoom-in" />
                        ) : isRefreshing ? (
                            <RefreshCw size={20} className="text-blue-500 animate-spin" />
                        ) : (
                            <div className="relative">
                                <ChevronDown 
                                    size={20} 
                                    className="text-slate-400 transition-transform duration-200"
                                    style={{ 
                                        transform: `rotate(${progress * 180}deg)`,
                                        opacity: 1 - progress
                                    }} 
                                />
                                <RefreshCw 
                                    size={20} 
                                    className="text-blue-500 absolute inset-0 transition-opacity duration-200"
                                    style={{ 
                                        transform: `rotate(${pullDistance * 2}deg) scale(${0.5 + (progress * 0.5)})`,
                                        opacity: progress
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col">
                        <span className={`text-xs font-bold leading-tight ${showSuccess ? 'text-green-700 dark:text-green-400' : 'text-slate-900 dark:text-white'}`}>
                            {showSuccess ? t('updated') : isRefreshing ? (statusMessage || t('syncing')) : (pullDistance > PULL_THRESHOLD ? t('releaseToSync') : t('pullToSync'))}
                        </span>
                        {lastSyncTime && !isRefreshing && !showSuccess && (
                            <span className="text-[10px] text-slate-400 leading-tight">
                                Last synced {new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                        {isRefreshing && statusMessage && (
                             <span className="text-[10px] text-blue-500/80 leading-tight animate-pulse">
                                {statusMessage}
                             </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Wrapper */}
            <div 
                className="max-w-4xl mx-auto p-4 transition-transform"
                style={{ 
                    transform: (isRefreshing || showSuccess) ? 'translateY(80px)' : `translateY(${pullDistance}px)`,
                    transition: isPulling ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0, 0, 1)'
                }}
            >
                {children}
            </div>
        </main>
    );
}

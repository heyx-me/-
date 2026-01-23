import React, { useEffect } from "react";

// Toast notification component - integrated with FAB overlay design
export function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const typeStyles = {
    success: {
      color: 'text-emerald-300',
      bg: 'rgba(16, 185, 129, 0.15)',
      border: 'border-emerald-500/30'
    },
    error: {
      color: 'text-red-300',
      bg: 'rgba(239, 68, 68, 0.15)',
      border: 'border-red-500/30'
    },
    warning: {
      color: 'text-orange-300',
      bg: 'rgba(251, 146, 60, 0.15)',
      border: 'border-orange-500/30'
    },
    info: {
      color: 'text-cyan-300',
      bg: 'rgba(6, 182, 212, 0.15)',
      border: 'border-cyan-500/30'
    }
  };

  const style = typeStyles[type] || typeStyles.info;

  return (
    <div
      className={`${style.color} ${style.border} px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm flex items-start justify-between w-full sm:min-w-[280px] sm:max-w-[450px] shadow-lg border backdrop-blur-sm pointer-events-auto transition-all hover:scale-[1.02] animate-slide-in`}
      style={{ background: style.bg }}
    >
      <span className="flex-1 pr-2 sm:pr-3 break-words leading-relaxed">{message}</span>
      <button
        className="bg-transparent border-none text-current text-lg cursor-pointer p-0 w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center hover:bg-white/10 rounded-full transition-all flex-shrink-0 mt-[-2px]"
        onClick={onClose}
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  );
}

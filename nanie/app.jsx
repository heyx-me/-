import React, { useState, useEffect, useRef, useContext, createContext } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

// --- CONFIGURATION ---
// Config imported from ./config.js

const CACHE_KEY = 'nanie_events_cache';
const REFRESH_KEY = 'nanie_last_refresh_ts';

// --- TOAST CONTEXT ---
const ToastContext = createContext();

function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const addToast = (message, type = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => removeToast(id), 3000);
    };

    const removeToast = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    return (
        <ToastContext.Provider value={addToast}>
            {children}
            <div className="toast-container position-fixed top-0 start-50 translate-middle-x p-3" style={{ zIndex: 1100 }}>
                {toasts.map(t => (
                    <div key={t.id} className={`toast show align-items-center text-white bg-${t.type === 'error' ? 'danger' : 'success'} border-0 mb-2 shadow-sm`} role="alert" aria-live="assertive" aria-atomic="true">
                        <div className="d-flex">
                            <div className="toast-body fw-bold" style={{fontSize: '0.9rem'}}>
                                {t.type === 'success' && <i className="fas fa-check-circle me-2"></i>}
                                {t.type === 'error' && <i className="fas fa-exclamation-circle me-2"></i>}
                                {t.message}
                            </div>
                            <button type="button" className="btn-close btn-close-white me-2 m-auto" onClick={() => removeToast(t.id)}></button>
                        </div>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

function useToast() {
    return useContext(ToastContext);
}

// --- HELPERS ---
const typeMap = {
    'feeding': { label: 'האכלה', icon: 'fa-person-breastfeeding', theme: 'theme-feeding' },
    'sleeping': { label: 'שינה', icon: 'fa-bed', theme: 'theme-sleeping' },
    'waking_up': { label: 'התעוררות', icon: 'fa-sun', theme: 'theme-waking' },
    'diaper': { label: 'חיתול', icon: 'fa-baby', theme: 'theme-diaper' },
    'bath': { label: 'מקלחת', icon: 'fa-bath', theme: 'theme-bath' },
    'other': { label: 'אחר', icon: 'fa-note-sticky', theme: 'theme-other' }
};

function getEventMeta(type) {
    return typeMap[type] || typeMap['other'];
}

function timeAgo(timestamp) {
    const diff = Math.floor((new Date() - new Date(timestamp)) / 1000); // seconds
    if (diff < 0) return "עתידי";
    if (diff < 60) return "ממש עכשיו";
    const min = Math.floor(diff / 60);
    if (min < 60) return `לפני ${min} דק'`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `לפני ${hr} שעות`;
    const days = Math.floor(hr / 24);
    return `לפני ${days} ימים`;
}

function useLongPress(callback, ms = 600) {
    const [startLongPress, setStartLongPress] = useState(false);
    const callbackRef = useRef(callback);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    useEffect(() => {
        let timer;
        if (startLongPress) {
            timer = setTimeout(() => {
                if (callbackRef.current) {
                    callbackRef.current();
                }
                setStartLongPress(false);
            }, ms);
        } else {
            clearTimeout(timer);
        }
        return () => clearTimeout(timer);
    }, [startLongPress, ms]);

    return {
        handlers: {
            onMouseDown: () => setStartLongPress(true),
            onMouseUp: () => setStartLongPress(false),
            onMouseLeave: () => setStartLongPress(false),
            onTouchStart: () => setStartLongPress(true),
            onTouchEnd: () => setStartLongPress(false),
            onContextMenu: (e) => e.preventDefault()
        },
        isPressing: startLongPress
    };
}

function DraggableTimeInput({ value, onChange }) {
    const [isDragging, setIsDragging] = useState(false);
    const [showTip, setShowTip] = useState(false);
    const startRef = useRef({ x:0, y:0, h:0, m:0 });
    
    const handleStart = (x, y) => {
        setIsDragging(true);
        setShowTip(true); // Show tip on drag start too
        const [h, m] = value.split(':').map(Number);
        startRef.current = { x, y, h, m };
    };

    const handleTip = () => {
        setShowTip(true);
        setTimeout(() => setShowTip(false), 2000);
    };

    useEffect(() => {
        if (!isDragging) {
            if (showTip && !isDragging) {
                 const t = setTimeout(() => setShowTip(false), 1000);
                 return () => clearTimeout(t);
            }
            return;
        }

        const handleMove = (e) => {
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            const dx = clientX - startRef.current.x;
            const dy = clientY - startRef.current.y;
            
            if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
            
            e.preventDefault && e.preventDefault(); 
            
            const hDelta = Math.floor(dx / 70); 
            const mDelta = Math.floor(dy / 20) * -1; 

            let newH = (startRef.current.h + hDelta) % 24;
            if (newH < 0) newH += 24;
            
            const startM = Math.round(startRef.current.m / 5) * 5;
            let newM = (startM + mDelta * 5) % 60;
            if (newM < 0) newM += 60;

            onChange(`${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`);
        };

        const handleEnd = () => {
            setIsDragging(false);
        };

        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleEnd);
        document.addEventListener('touchmove', handleMove, { passive: false });
        document.addEventListener('touchend', handleEnd);

        return () => {
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleEnd);
            document.removeEventListener('touchmove', handleMove);
            document.removeEventListener('touchend', handleEnd);
        };
    }, [isDragging, value, onChange]);

    return (
        <div 
            onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
            onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
            style={{ 
                touchAction: 'none', 
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'move',
                position: 'relative',
                padding: '8px 16px', 
                borderRadius: '12px',
                transition: 'all 0.2s ease',
                backgroundColor: isDragging ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                border: isDragging ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid transparent'
            }}
        >
            <input 
                type="time" 
                className="form-control form-control-sm text-center fw-bold border-0 p-0" 
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    fontSize: '1.4rem', 
                    width: '100px',
                    backgroundColor: 'transparent', 
                    color: isDragging ? '#fff' : 'var(--text-main)', 
                    pointerEvents: isDragging ? 'none' : 'auto',
                    transform: isDragging ? 'scale(1.1)' : 'scale(1)',
                    transition: 'transform 0.2s ease'
                }}
            />
            
            <div 
                className="ms-2 d-flex align-items-center justify-content-center"
                style={{
                    color: isDragging ? '#fff' : 'var(--text-muted)',
                    opacity: isDragging ? 1 : 0.5,
                    transition: 'opacity 0.2s'
                }}
                onClick={(e) => { e.stopPropagation(); handleTip(); }}
            >
                <i className="fas fa-up-down-left-right"></i>
            </div>

            {showTip && (
                <div className="position-absolute top-0 start-50 translate-middle-x mt-n4 badge bg-dark text-white shadow-sm" style={{marginTop: '-30px', pointerEvents: 'none', fontSize: '0.75rem', whiteSpace: 'nowrap', zIndex: 10}}>
                    {isDragging ? '↔ שעות ↕ דקות' : 'גרור לשינוי זמן'}
                </div>
            )}
        </div>
    );
}

// --- STAT TILE COMPONENT ---
// Defined outside App to prevent re-mounting and state loss on App render
const StatTileWithRef = ({ statKey, subStats, isLast, onTrigger }) => {
     const stat = subStats[statKey];
     const tileRef = useRef(null);
     const { handlers, isPressing } = useLongPress(() => onTrigger(statKey, tileRef.current), 1000);
     
     return (
         <div className="col-6">
            <div 
                 ref={tileRef}
                 className={`d-flex flex-column align-items-center justify-content-center p-2 rounded-3 border h-100 text-center position-relative overflow-hidden ${isLast ? 'border-2' : 'border-subtle'}`} 
                 {...handlers}
                 style={{
                     backgroundColor: isLast ? 'var(--bg-card)' : 'var(--bs-tertiary-bg)',
                     borderColor: isLast ? 'var(--primary-pink)' : 'var(--border-subtle)',
                     boxShadow: isLast ? '0 4px 12px rgba(255, 154, 158, 0.2)' : 'none',
                     cursor: 'pointer',
                     userSelect: 'none',
                     WebkitUserSelect: 'none',
                     transform: isPressing ? 'scale(0.95)' : 'scale(1)',
                     transition: 'transform 0.2s ease, background-color 0.3s',
                     opacity: isPressing ? 0.8 : 1
                 }}>
                
                {isLast && (
                    <div className="position-absolute top-0 end-0 m-1">
                        <span className="badge rounded-pill" style={{backgroundColor: 'var(--primary-pink)', color: '#631d20', fontSize: '0.6rem', fontWeight: '800'}}>אחרון</span>
                    </div>
                )}

                {/* Clockwise Border Animation for Long Press (Physical positioning) */}
                {isPressing && (
                    <>
                        {/* 1. Bottom Border (Right -> Left) */}
                        <div className="position-absolute" style={{
                            bottom: 0, right: 0,
                            height: '4px', width: '100%', backgroundColor: 'var(--primary-pink)',
                            transformOrigin: 'right', transform: 'scaleX(0)', animation: 'expandWidth 0.25s linear forwards 0s'
                        }}></div>
                        
                        {/* 2. Left Border (Bottom -> Top) */}
                        <div className="position-absolute" style={{
                            bottom: 0, left: 0,
                            width: '4px', height: '100%', backgroundColor: 'var(--primary-pink)',
                            transformOrigin: 'bottom', transform: 'scaleY(0)', animation: 'expandHeight 0.25s linear forwards 0.25s'
                        }}></div>
                        
                        {/* 3. Top Border (Left -> Right) */}
                        <div className="position-absolute" style={{
                            top: 0, left: 0,
                            height: '4px', width: '100%', backgroundColor: 'var(--primary-pink)',
                            transformOrigin: 'left', transform: 'scaleX(0)', animation: 'expandWidth 0.25s linear forwards 0.5s'
                        }}></div>
                        
                        {/* 4. Right Border (Top -> Bottom) */}
                        <div className="position-absolute" style={{
                            top: 0, right: 0,
                            width: '4px', height: '100%', backgroundColor: 'var(--primary-pink)',
                            transformOrigin: 'top', transform: 'scaleY(0)', animation: 'expandHeight 0.25s linear forwards 0.75s'
                        }}></div>
                    </>
                )}
                
                <div className={`rounded-circle d-flex align-items-center justify-content-center mb-2 ${stat.theme}`} 
                     style={{width: '32px', height: '32px', fontSize: '0.9rem'}}>
                    <i className={`fas ${stat.icon}`}></i>
                </div>
                {/* Fixed: Removed text-dark */}
                <span className="fw-bold lh-1 mb-1" style={{fontSize: '1.4rem'}}>{stat.count}</span>
                <span className="text-muted small text-truncate w-100 mb-1" style={{fontSize: '0.75rem', opacity: 0.8}}>{stat.label}</span>
                
                {stat.lastTs > 0 ? (
                    <span className="time-ago-badge" style={{fontSize: '0.65rem', padding: '2px 8px'}}>
                        {timeAgo(stat.lastTs)}
                    </span>
                ) : <span className="text-muted" style={{fontSize: '0.65rem', opacity: 0.5}}>-</span>}
            </div>
        </div>
     );
};

// --- ANIMATED MODAL COMPONENT ---
function GrowModal({ children, originRect, onClose }) {
    const [isClosing, setIsClosing] = useState(false);
    const [backdropOpacity, setBackdropOpacity] = useState(0);
    
    // Initial State
    const [style, setStyle] = useState(() => ({
        position: 'fixed',
        top: originRect ? originRect.top : '50%',
        left: originRect ? originRect.left : '50%',
        width: originRect ? originRect.width : '280px',
        height: originRect ? originRect.height : 'auto',
        transform: originRect ? 'translate(0, 0)' : 'translate(-50%, -50%) scale(0.8)',
        opacity: 0,
        zIndex: 1055,
        transition: 'none',
        borderRadius: '15px',
        overflow: 'hidden',
        pointerEvents: 'none',
        backgroundColor: 'var(--bg-card)'
    }));

    useEffect(() => {
        const timer = requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (!isClosing) {
                    setStyle({
                        position: 'fixed',
                        top: '50%',
                        left: '50%',
                        width: '280px',
                        height: 'auto',
                        transform: 'translate(-50%, -50%) scale(1)',
                        opacity: 1,
                        zIndex: 1055,
                        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                        borderRadius: '15px',
                        pointerEvents: 'auto',
                        backgroundColor: 'var(--bg-card)'
                    });
                    setBackdropOpacity(1);
                }
            });
        });
        return () => cancelAnimationFrame(timer);
    }, [isClosing]);

    const handleClose = () => {
        setIsClosing(true);
        setBackdropOpacity(0);
        
        // Animate back to origin
        setStyle({
            position: 'fixed',
            top: originRect ? originRect.top : '50%',
            left: originRect ? originRect.left : '50%',
            width: originRect ? originRect.width : '280px',
            height: originRect ? originRect.height : 'auto', 
            transform: originRect ? 'translate(0, 0)' : 'translate(-50%, -50%) scale(0.8)',
            opacity: 0,
            zIndex: 1055,
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            borderRadius: '15px',
            overflow: 'hidden',
            pointerEvents: 'none',
            backgroundColor: 'var(--bg-card)'
        });

        // Wait for animation then unmount
        setTimeout(() => {
            onClose();
        }, 300);
    };

    return (
        <div className="modal d-block" tabIndex="-1" style={{zIndex: 1055, pointerEvents: 'none'}}>
            <div 
                className="modal-backdrop fade show" 
                onClick={handleClose} 
                style={{
                    backgroundColor: 'rgba(0,0,0,0.5)', 
                    opacity: backdropOpacity, 
                    transition: 'opacity 0.3s ease',
                    pointerEvents: 'auto'
                }}
            ></div>
            <div 
                className="modal-content shadow-lg border-0" 
                style={style}
            >
                {typeof children === 'function' ? children(handleClose) : children}
            </div>
        </div>
    );
}

function NanieSkeleton() {
    return (
        <div className="container pt-3 pb-3">
            {/* Header Skeleton */}
            <div className="d-flex justify-content-between align-items-end mb-3 border-bottom pb-2">
                <div className="skeleton skeleton-title" style={{width: '150px'}}></div>
                <div className="skeleton" style={{width: '100px', height: '1rem'}}></div>
            </div>

            {/* Stats Grid Skeleton */}
            <div className="row g-3 mb-3">
                <div className="col-12">
                    <div className="card h-100">
                        <div className="card-header border-0 pb-0 pt-2 bg-transparent">
                            <div className="skeleton" style={{width: '80px', height: '0.75rem'}}></div>
                        </div>
                        <div className="card-body pt-2 pb-2">
                            <div className="row g-2">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="col-3">
                                        <div className="card h-100 p-2 align-items-center bg-transparent border-0">
                                            <div className="skeleton skeleton-circle mb-2" style={{width: '32px', height: '32px'}}></div>
                                            <div className="skeleton mb-1" style={{width: '20px', height: '1.4rem'}}></div>
                                            <div className="skeleton mb-1" style={{width: '40px', height: '0.75rem'}}></div>
                                            <div className="skeleton" style={{width: '30px', height: '0.65rem'}}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* List Skeleton */}
            <div className="row g-3">
                <div className="col-12">
                    <div className="card">
                        <div className="card-header py-2">
                            <div className="skeleton" style={{width: '100px', height: '1rem'}}></div>
                        </div>
                        <div className="list-group list-group-flush">
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="list-group-item px-2 py-3 border-bottom">
                                    <div className="d-flex align-items-center">
                                        <div className="skeleton skeleton-circle me-2" style={{width: '20px', height: '20px'}}></div>
                                        <div className="flex-grow-1">
                                            <div className="skeleton mb-1" style={{width: '40%', height: '0.8rem'}}></div>
                                            <div className="skeleton" style={{width: '60%', height: '0.7rem'}}></div>
                                        </div>
                                        <div className="skeleton" style={{width: '40px', height: '0.7rem'}}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- ANIMATED TEXT COMPONENT ---
function WavyText({ text }) {
    const [display, setDisplay] = useState(text);
    const [mode, setMode] = useState('enter'); // 'enter' | 'exit' | 'idle'

    useEffect(() => {
        if (text !== display) {
            setMode('exit');
            const exitDuration = (display.length * 50) + 600;
            const t = setTimeout(() => {
                setDisplay(text);
                setMode('enter');
            }, exitDuration); 
            return () => clearTimeout(t);
        }
    }, [text, display]);

    return (
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', direction: 'rtl' }}>
            {display.split('').map((char, i) => (
                <span key={`${display}-${i}`} style={{
                    display: 'inline-block',
                    whiteSpace: 'pre',
                    animation: `${mode === 'enter' ? 'waveEnter' : (mode === 'exit' ? 'waveExit' : 'none')} 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) ${i * 0.05}s forwards`,
                    opacity: mode === 'enter' ? 0 : 1 // Start hidden for enter
                }}>
                    {char}
                </span>
            ))}
        </div>
    );
}

// --- GROUP SELECTION COMPONENT ---
function GroupSelectionList({ groups, onSelect, onRefresh, loading }) {
    return (
        <div className="container pt-4 pb-4">
             <div className="text-center mb-4">
                 <div className="bg-primary-subtle rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{width: '60px', height: '60px'}}>
                     <i className="fas fa-users fa-lg text-primary"></i>
                 </div>
                 <h4 className="fw-bold mb-2">חיבור לקבוצת וואטסאפ</h4>
                 <p className="text-muted small px-4">
                     כדי להתחיל, אנא בחרי את הקבוצה בוואטסאפ שבה הבוט נמצא.
                 </p>
             </div>

             <div className="list-group shadow-sm rounded-3 overflow-hidden border-0">
                 {loading ? (
                     <div className="text-center py-4">
                         <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                         <div className="small text-muted mt-2">טוען קבוצות...</div>
                     </div>
                 ) : groups.length === 0 ? (
                     <div className="text-center py-4 bg-body-tertiary">
                         <div className="text-muted small mb-3">לא נמצאו קבוצות</div>
                         <button className="btn btn-sm btn-outline-primary rounded-pill px-3" onClick={onRefresh}>
                             <i className="fas fa-sync-alt me-1"></i> רענן רשימה
                         </button>
                     </div>
                 ) : (
                     groups.map(g => (
                         <button 
                             key={g.id} 
                             className="list-group-item list-group-item-action d-flex align-items-center p-3 border-0 border-bottom"
                             onClick={() => onSelect(g.id)}
                         >
                             <div className="rounded-circle bg-secondary-subtle d-flex align-items-center justify-content-center me-3" style={{width: '40px', height: '40px'}}>
                                 <i className="fas fa-user-group text-secondary"></i>
                             </div>
                             <div className="flex-grow-1 text-start">
                                 <div className="fw-bold">{g.name || 'קבוצה ללא שם'}</div>
                                 <div className="text-muted small" style={{fontSize: '0.75rem'}}>
                                     {g.lastActivity > 0 ? `פעילות אחרונה: ${new Date(g.lastActivity * 1000).toLocaleString('he-IL')}` : 'אין פעילות אחרונה'}
                                 </div>
                             </div>
                             <i className="fas fa-chevron-left text-muted opacity-50"></i>
                         </button>
                     ))
                 )}
             </div>
             
             {!loading && groups.length > 0 && (
                 <div className="text-center mt-3">
                     <button className="btn btn-link text-muted small text-decoration-none" onClick={onRefresh}>
                         <i className="fas fa-sync-alt me-1"></i> רענן רשימה
                     </button>
                 </div>
             )}
        </div>
    );
}

// --- APP COMPONENT ---
function AppContent() {
    // --- STATE & HOOKS ---
    const addToast = useToast();
    const [viewMode, setViewMode] = useState('chat'); // 'chat' | 'groups'
    
    const [availableGroups, setAvailableGroups] = useState([]);
    const [groupsLoading, setGroupsLoading] = useState(false);
    
    const [events, setEvents] = useState([]);
    const [title, setTitle] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('title') || null;
    });
    
    const [loading, setLoading] = useState(true);
    const [supabase, setSupabase] = useState(null);
    const [conversationId] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        const urlCid = params.get('cid');
        if (urlCid) return urlCid;

        let id = localStorage.getItem('nanie_conversation_id');
        if (!id) {
            id = uuidv4();
            localStorage.setItem('nanie_conversation_id', id);
        }
        return id;
    });
    const [userId] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        const urlUid = params.get('uid');
        if (urlUid) return urlUid;

        let id = localStorage.getItem('nanie_user_id');
        if (!id) {
            id = uuidv4();
            localStorage.setItem('nanie_user_id', id);
        }
        return id;
    });

    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState('add_event'); // 'add_event' | 'rename' | 'retry'
    const [retryEventId, setRetryEventId] = useState(null);
    const [addType, setAddType] = useState('feeding');
    const [addDetails, setAddDetails] = useState('');
    const [addTime, setAddTime] = useState('');
    const [newTitle, setNewTitle] = useState('');
    const [isAutomated, setIsAutomated] = useState(false);
    const [sending, setSending] = useState(false);
    const [modalOrigin, setModalOrigin] = useState(null);

    // --- HELPERS ---
    const sendNanieCommand = async (payload) => {
        if (!supabase) return;
        const debug = localStorage.getItem('debug_mode') === 'true';
        return await supabase.from('messages').insert({
            room_id: 'nanie',
            conversation_id: conversationId,
            content: JSON.stringify({ ...payload, ephemeral: true, debug }),
            sender_id: conversationId,
            is_bot: false
        });
    };

    // --- LOADING TICKER STATE ---
    const [waitIndex, setWaitIndex] = useState(-1);
    const [showRetry, setShowRetry] = useState(false);
    const waitMessages = [
        "מתחברים לשרת...",
        "מחפשים את המוצץ של השרת...",
        "הנתונים בהחתלה...",
        "רגע, מכינים בקבוק לנתונים...",
        "אולי השרת בהפסקת שינה...",
        "הסוכנת נני עובדת על זה..."
    ];

    useEffect(() => {
        let timeout;
        let retryTimeout;
        let interval;

        if (loading && events.length === 0 && viewMode === 'chat') {
            timeout = setTimeout(() => {
                setWaitIndex(0);
                interval = setInterval(() => {
                    setWaitIndex(prev => (prev + 1) % waitMessages.length);
                }, 8000);
            }, 3000);

            retryTimeout = setTimeout(() => {
                setShowRetry(true);
            }, 15000); // Show retry after 15s
        } else {
            setWaitIndex(-1);
            setShowRetry(false);
        }

        return () => {
            clearTimeout(timeout);
            clearTimeout(retryTimeout);
            clearInterval(interval);
        };
    }, [loading, events.length, viewMode]);

    // --- EFFECTS ---
    useEffect(() => {
        const client = createClient(SUPABASE_URL, SUPABASE_KEY);
        setSupabase(client);
        
        // Only fetch title if not already provided via URL
        if (!title) {
            client.from('conversations').select('title').eq('id', conversationId).single()
                .then(({ data }) => {
                    if (data && data.title) {
                        setTitle(data.title);
                    } else {
                        setTitle('Nanie');
                    }
                });
        }
    }, []);

    const fetchGroups = async () => {
        if (!supabase) return;
        setGroupsLoading(true);
        try {
            await sendNanieCommand({ action: 'LIST_GROUPS' });
        } catch (e) {
            console.error('Failed to list groups:', e);
            setGroupsLoading(false);
        }
    };

    const handleResync = async () => {
        if (!supabase) return;
        setLoading(true);
        setShowRetry(false); // Reset retry button
        try {
            await sendNanieCommand({ action: 'RESYNC_HISTORY' });
            addToast('מתחיל סנכרון היסטוריה...', 'info');
            
            // Fallback: Also send GET_STATUS in case RESYNC doesn't return data immediately
            setTimeout(async () => {
                 await sendNanieCommand({ action: 'GET_STATUS' });
            }, 1000);
            
        } catch (e) {
            console.error('Resync failed:', e);
            setLoading(false);
        }
    };
    
    // Handler for selecting a group
    const handleSelectGroup = async (groupId) => {
        // Find group name
        const group = availableGroups.find(g => g.id === groupId);
        const groupName = group ? group.name : 'Unknown Group';
        
        console.log('Selected group:', groupId, groupName);
        
        // Optimistic UI Update
        setLoading(true); // Show loading spinner
        setViewMode('chat'); // Switch back to chat view
        setEvents([]); // Clear stale events
        localStorage.removeItem(`nanie_events_${conversationId}`); // Clear cache
        
        try {
            // Unconditionally update conversation title to match selected WhatsApp group
            await supabase.from('conversations').update({ title: groupName }).eq('id', conversationId);
            setTitle(groupName);

            // Send SELECT_GROUP action
            await sendNanieCommand({ 
                action: 'SELECT_GROUP', 
                groupId, 
                groupName 
            });
            
        } catch (e) {
            console.error('Failed to select group:', e);
            addToast('שגיאה בחיבור לקבוצה', 'error');
            setViewMode('groups'); // Revert
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!supabase) return;

        // 1. Load Local Cache for this Conversation
        const specificCacheKey = `nanie_events_${conversationId}`;
        const cachedRaw = localStorage.getItem(specificCacheKey);
        let initialEvents = [];
        if (cachedRaw) {
            try {
                const { data } = JSON.parse(cachedRaw);
                initialEvents = data || [];
            } catch (e) {}
        }
        setEvents(initialEvents);
        setLoading(initialEvents.length === 0);

        const fetchStatus = async () => {
            const channel = supabase.channel(`room:nanie:${conversationId}`)
                .on('postgres_changes', { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'messages',
                    filter: `room_id=eq.nanie` 
                }, async (payload) => {
                    if (payload.new.conversation_id === conversationId || payload.new.conversation_id === null) {
                        try {
                            const content = JSON.parse(payload.new.content);
                            
                            // Check for Group Selection Requirement
                            if (content.type === 'SYSTEM' && content.code === 'GROUP_SELECTION_REQUIRED') {
                                setViewMode('groups');
                                setLoading(false);
                                fetchGroups();
                                if (localStorage.getItem('debug_mode') !== 'true') {
                                    supabase.from('messages').delete().eq('id', payload.new.id);
                                }
                                return;
                            }
                            
                            // Handle STATUS messages (Toast & Delete)
                            if (content.type === 'STATUS') {
                                if (content.text) {
                                     // Translate status codes to user-friendly messages if needed
                                     let msg = content.text;
                                     if (msg === 'LINKED') msg = 'החיבור לוואטסאפ בוצע בהצלחה';
                                     if (msg === 'HISTORY_RESYNCED') msg = 'היסטוריית ההודעות סונכרנה';
                                     addToast(msg, 'success');
                                }
                                if (localStorage.getItem('debug_mode') !== 'true') {
                                    supabase.from('messages').delete().eq('id', payload.new.id);
                                }
                                return;
                            }

                            // Handle DATA messages (Groups, Events, Sync)
                            if (content.type === 'DATA' && content.data) {
                                // 1. Sync group name if provided
                                if (content.data.groupName) {
                                     const newGroupName = content.data.groupName;
                                     setTitle(newGroupName);
                                     
                                     // Only sync back to DB if current title is generic
                                     const { data: currentConv } = await supabase.from('conversations').select('title').eq('id', conversationId).single();
                                     const genericTitles = ['Nanie', 'New Chat', 'Nanie Chat', 'היומן של אלה'];
                                     if (currentConv && genericTitles.includes(currentConv.title)) {
                                         await supabase.from('conversations').update({ title: newGroupName }).eq('id', conversationId);
                                     }
                                }

                                // 2. Handle Group List
                                if (content.data.groups) {
                                    setAvailableGroups(content.data.groups);
                                    setGroupsLoading(false);
                                    if (localStorage.getItem('debug_mode') !== 'true') {
                                        supabase.from('messages').delete().eq('id', payload.new.id).then(({ error }) => {
                                            if (error) console.error("Failed to delete sensitive message:", error);
                                        });
                                    }
                                    return;
                                }

                                // 3. Handle Events
                                if (content.data.events) {
                                    setEvents(prevEvents => {
                                        const newEvents = content.data.events;
                                        const combined = [...prevEvents, ...newEvents];
                                        
                                        const uniqueMap = new Map();
                                        combined.forEach(event => {
                                            // Key includes details to prevent dropping same-time-different-event entries
                                            const key = `${event.timestamp}-${event.type}-${event.details || ''}`;
                                            uniqueMap.set(key, event);
                                        });
                                        
                                        const mergedEvents = Array.from(uniqueMap.values()).sort((a, b) => b.timestamp - a.timestamp);
                                        
                                        localStorage.setItem(specificCacheKey, JSON.stringify({
                                            timestamp: Date.now(),
                                            data: mergedEvents
                                        }));
                                        
                                        return mergedEvents;
                                    });
                                    setLoading(false);
                                    
                                    if (localStorage.getItem('debug_mode') !== 'true') {
                                        supabase.from('messages').delete().eq('id', payload.new.id).then(({ error }) => {
                                            if (error) console.error("Failed to delete sensitive message:", error);
                                        });
                                    }
                                }
                                return;
                            }

                            if (content.type === 'ERROR') {
                                addToast(content.error || 'שגיאה לא ידועה', 'error');
                                if (localStorage.getItem('debug_mode') !== 'true') {
                                    supabase.from('messages').delete().eq('id', payload.new.id);
                                }
                                return;
                            }
                        } catch (e) {
                            console.error('Parse error:', e);
                        }
                    }
                })
                .subscribe();

            await supabase.from('conversations').insert({ 
                id: conversationId, 
                title: 'Nanie',
                owner_id: userId,
                updated_at: new Date().toISOString()
            }, { ignoreDuplicates: true });

            // Startup Sweep: Clean up any old stuck messages BEFORE sending new request
            try {
                const { data: leftovers } = await supabase
                    .from('messages')
                    .select('*')
                    .eq('room_id', 'nanie')
                    .eq('conversation_id', conversationId)
                    .order('created_at', { ascending: true });

                if (leftovers) {
                    for (const msg of leftovers) {
                        try {
                            const content = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
                            
                            // Define deletion criteria based on protocol
                            const isEphemeral = content.ephemeral === true;
                            const isStatus = content.type === 'STATUS';
                            const isSystem = content.type === 'SYSTEM';
                            const isError = content.type === 'ERROR';
                            const isData = content.type === 'DATA'; 

                            const shouldDelete = isEphemeral || isStatus || isSystem || isError || isData;

                            if (shouldDelete) {
                                console.log("[Nanie] Cleaning up stuck message:", msg.id, content.type || 'ephemeral');
                                if (localStorage.getItem('debug_mode') !== 'true') {
                                    await supabase.from('messages').delete().eq('id', msg.id);
                                }
                            }
                        } catch (e) {
                             console.error("Cleanup parse error", e);
                        }
                    }
                }
            } catch (e) { console.error("[Nanie] Sweep failed:", e); }

            // Send initial status request AFTER cleanup
            await sendNanieCommand({ action: 'GET_STATUS' });

            return () => {
                supabase.removeChannel(channel);
            };
        };

        fetchStatus();
    }, [supabase, conversationId]);

    // --- HANDLERS ---
    const handleAddEvent = async (onDone) => {
        if (!addDetails.trim()) {
            addToast('אנא הזיני פרטים', 'error');
            return;
        }
        if (!supabase) {
            addToast('שגיאת חיבור לשרת', 'error');
            return;
        }
        setSending(true);

        let prefix = addTime ? `בשעה ${addTime} ` : '';
        let text = `${prefix}${typeMap[addType].label} ${addDetails}`;
        if (addType === 'feeding' && !text.includes('האכלה')) text = `${prefix}האכלה ${addDetails}`;
        
        // Construct structured event data for immediate processing
        let timestamp = Date.now();
        if (addTime) {
            const [hours, minutes] = addTime.split(':').map(Number);
            const date = new Date();
            date.setHours(hours, minutes, 0, 0);
            timestamp = date.getTime();
        }

        const eventData = {
            type: addType,
            details: addDetails,
            timestamp: timestamp
        };

        try {
             await supabase.from('conversations').insert({ 
                id: conversationId, 
                title: 'Nanie',
                owner_id: userId,
                updated_at: new Date().toISOString()
            }, { ignoreDuplicates: true });

            const { error } = await sendNanieCommand({ action: 'ADD_EVENT', text, eventData });
            
            if (error) throw error;
            
            addToast('האירוע נשלח בהצלחה!', 'success');
            if (onDone) {
                onDone();
            } else {
                setShowModal(false);
            }
            setAddDetails('');
            setAddTime('');
            setIsAutomated(false);
            setModalOrigin(null);
        } catch (e) {
            console.error('Send error:', e);
            addToast('שגיאה בשליחה', 'error');
        } finally {
            setSending(false);
        }
    };

    const triggerQuickAdd = (key, eventOrRect) => {
        const stat = subStats[key];
        setModalType('add_event');
        setAddType(stat.event_type);
        setAddDetails(stat.event_details);
        setAddTime(new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false }));
        setIsAutomated(true);
        
        if (eventOrRect && eventOrRect.getBoundingClientRect) {
             setModalOrigin(eventOrRect.getBoundingClientRect());
        } else if (eventOrRect && eventOrRect.top) {
             setModalOrigin(eventOrRect);
        } else {
             setModalOrigin(null);
        }
        
        setShowModal(true);
    };

    const triggerManualAdd = (e) => {
        setModalType('add_event');
        setAddType('feeding');
        setAddDetails('');
        setAddTime(new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false }));
        setIsAutomated(false);
        setModalOrigin(null);
        setShowModal(true);
    };

    const triggerRetry = (event, e) => {
        setModalType('retry');
        setRetryEventId(event.id);
        setAddType(event.type);
        setAddDetails(event.details || '');
        setAddTime(new Date(event.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false }));
        setIsAutomated(false);
        
        if (e && e.currentTarget) {
             setModalOrigin(e.currentTarget.getBoundingClientRect());
        } else {
             setModalOrigin(null);
        }
        setShowModal(true);
    };

    const handleRetrySync = async (onDone) => {
        if (!retryEventId) return;
        setSending(true);
        try {
            await sendNanieCommand({ action: 'RETRY_SYNC', eventId: retryEventId });
            addToast('בקשת סנכרון נשלחה', 'info');
            if (onDone) onDone();
            else setShowModal(false);
        } catch (e) {
            console.error('Retry Sync error:', e);
            addToast('שגיאה בשליחת בקשת סנכרון', 'error');
        } finally {
            setSending(false);
        }
    };

    const triggerRename = (e) => {
        setModalType('rename');
        setNewTitle(title || 'Nanie');
        if (e && e.currentTarget) {
            setModalOrigin(e.currentTarget.getBoundingClientRect());
        } else {
            setModalOrigin(null);
        }
        setShowModal(true);
    };

    const handleRename = async (onDone) => {
        if (!newTitle.trim()) {
            addToast('אנא הזיני שם', 'error');
            return;
        }
        setSending(true);
        try {
            const { error } = await supabase.from('conversations').update({ 
                title: newTitle,
                updated_at: new Date().toISOString()
            }).eq('id', conversationId);
            
            if (error) throw error;
            
            setTitle(newTitle);
            addToast('השם עודכן בהצלחה!', 'success');
            
            // Update URL title param silently
            const url = new URL(window.location.href);
            url.searchParams.set('title', newTitle);
            window.history.replaceState({}, '', url.toString());

            // Notify parent to refresh conversation title locally
            if (window.parent !== window) {
                window.parent.postMessage({ type: 'REFRESH_CONVERSATIONS', id: conversationId, title: newTitle }, '*');
            }

            if (onDone) onDone();
            else setShowModal(false);
        } catch (e) {
            console.error('Rename error:', e);
            addToast('שגיאה בעדכון השם', 'error');
        } finally {
            setSending(false);
        }
    };

    if (viewMode === 'groups') {
        return (
            <div className="vh-100 bg-body d-flex flex-column">
                <GroupSelectionList 
                    groups={availableGroups} 
                    loading={groupsLoading} 
                    onSelect={handleSelectGroup}
                    onRefresh={fetchGroups} 
                />
            </div>
        );
    }

    if (loading && events.length === 0) {
        return (
            <div className="position-relative">
                <NanieSkeleton />
                
                <div className="position-absolute top-50 start-50 translate-middle w-100 text-center px-3" 
                     style={{
                         zIndex: 10,
                         marginTop: '2rem'
                     }}>
                    <div className="bg-body-tertiary d-inline-block px-4 py-3 rounded-pill shadow-sm border">
                        {waitIndex >= 0 ? (
                            <WavyText text={waitMessages[waitIndex]} />
                        ) : (
                            <div className="spinner-border spinner-border-sm text-pink me-2" role="status"></div>
                        )}
                    </div>
                    
                    {showRetry && (
                        <div className="mt-4 fade-in">
                            <button className="btn btn-outline-primary rounded-pill px-4 btn-sm" onClick={handleResync}>
                                <i className="fas fa-sync-alt me-2"></i> נסי להתחבר שוב
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }
    
    const sortedEvents = [...events].sort((a, b) => b.timestamp - a.timestamp);
    const lastEvent = sortedEvents[0];
    const lastFeeding = sortedEvents.find(e => e.type === 'feeding');
    const lastDiaper = sortedEvents.find(e => e.type === 'diaper');
    const lastSleepEvent = sortedEvents.find(e => e.type === 'sleeping' || e.type === 'waking_up');
    const now = Date.now();
    const last24h = now - 24 * 60 * 60 * 1000;
    
    const subStats = {
        'right_boob': { label: 'צד ימין', icon: 'fa-chevron-right', count: 0, lastTs: 0, theme: 'theme-feeding', event_type: 'feeding', event_details: 'צד ימין' },
        'left_boob': { label: 'צד שמאל', icon: 'fa-chevron-left', count: 0, lastTs: 0, theme: 'theme-feeding', event_type: 'feeding', event_details: 'צד שמאל' },
        'bottle': { label: 'בקבוק', icon: 'fa-wine-bottle', count: 0, lastTs: 0, theme: 'theme-feeding', event_type: 'feeding', event_details: 'בקבוק' },
        'poop': { label: 'קקי', icon: 'fa-poop', count: 0, lastTs: 0, theme: 'theme-diaper', event_type: 'diaper', event_details: 'קקי' },
        'pee': { label: 'פיפי', icon: 'fa-droplet', count: 0, lastTs: 0, theme: 'theme-diaper', event_type: 'diaper', event_details: 'פיפי' },
        'sleeping': { label: 'שינה', icon: 'fa-bed', count: 0, lastTs: 0, theme: 'theme-sleeping', event_type: 'sleeping', event_details: 'שינה' },
        'waking_up': { label: 'התעוררות', icon: 'fa-sun', count: 0, lastTs: 0, theme: 'theme-waking', event_type: 'waking_up', event_details: 'התעוררות' },
        'pumping': { label: 'שאיבה', icon: 'fa-pump-medical', count: 0, lastTs: 0, theme: 'theme-other', event_type: 'other', event_details: 'שאיבה' },
        'bath': { label: 'מקלחת', icon: 'fa-bath', count: 0, lastTs: 0, theme: 'theme-bath', event_type: 'bath', event_details: 'מקלחת' }
    };

    sortedEvents.forEach(e => {
        const details = (e.details || e.label || '').toLowerCase();
        const type = e.type || '';
        const ts = Number(e.timestamp);
        const is24h = ts >= last24h;
        
        const updateStat = (key) => {
            if (subStats[key].lastTs === 0) subStats[key].lastTs = ts;
            if (is24h) subStats[key].count++;
        };

        if (details.includes('ימין')) updateStat('right_boob');
        if (details.includes('שמאל')) updateStat('left_boob');
        if (details.includes('בקבוק')) updateStat('bottle');
        if (details.includes('צואה') || details.includes('קקי')) updateStat('poop');
        if (details.includes('שתן') || details.includes('פיפי')) updateStat('pee');
        if (type === 'sleeping') updateStat('sleeping');
        if (type === 'waking_up') updateStat('waking_up');
        if (details.includes('שאיבה')) updateStat('pumping');
        if (type === 'bath' || details.includes('מקלחת')) updateStat('bath');
    });

    const displayKeys = ['right_boob', 'left_boob', 'poop', 'pee', 'sleeping', 'waking_up'];
    const eventsByDay = {};
    sortedEvents.slice(0, 200).forEach(event => {
        const fullDate = new Date(event.timestamp);
        const midnight = new Date(fullDate.getFullYear(), fullDate.getMonth(), fullDate.getDate());
        const dayKey = midnight.toISOString().split('T')[0]; 
        
        if (!eventsByDay[dayKey]) {
            eventsByDay[dayKey] = { date: midnight, events: [] };
        }
        eventsByDay[dayKey].events.push(event);
    });
    
    // Sort keys descending (newest day first)
    const sortedDays = Object.keys(eventsByDay).sort((a, b) => b.localeCompare(a));
    
    // Ensure events within each day are sorted newest first
    sortedDays.forEach(day => {
        eventsByDay[day].events.sort((a, b) => b.timestamp - a.timestamp);
    });

    return (
        <div className="container pt-3 pb-3" style={{paddingBottom: '80px'}}>
            {/* Header */}
            <div className="d-flex justify-content-between align-items-end mb-3 border-bottom pb-2">
                {/* Fixed: Removed text-dark */}
                <div onClick={triggerRename} style={{cursor: 'pointer'}}>
                    <h2 className="mb-0 fw-800">
                        {title ? (
                            <span className="fade-in">{title}</span>
                        ) : (
                            <span className="skeleton rounded" style={{width: '180px', height: '0.8em', display: 'inline-block', verticalAlign: 'middle'}}></span>
                        )}
                    </h2>
                </div>
                <div className="d-flex align-items-center gap-2">
                    <button className="btn btn-sm btn-link text-muted p-0 opacity-50" onClick={handleResync} title="סנכרון מחדש">
                        <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
                    </button>
                    <div className="text-muted small opacity-75 pb-1">
                        <i className="far fa-clock me-1"></i>
                        {lastEvent ? `אירוע אחרון: ${new Date(lastEvent.timestamp).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})}` : 'אין אירועים'}
                    </div>
                </div>
            </div>

            {/* Sub-type Breakdown */}
            <div className="row g-3 mb-3">
                <div className="col-12">
                    <div className="card h-100">
                        <div className="card-header border-0 pb-0 pt-2 bg-transparent">
                            <h6 className="text-muted text-uppercase fw-bold mb-0" style={{fontSize: '0.75rem', letterSpacing: '0.5px'}}>סיכום 24 שעות</h6>
                        </div>
                        <div className="card-body pt-2 pb-2">
                            <div className="row g-2">
                                {displayKeys.map(key => {
                                    let isLast = false;
                                    
                                    if (key === 'right_boob' || key === 'left_boob') {
                                        const lastRight = subStats['right_boob'].lastTs;
                                        const lastLeft = subStats['left_boob'].lastTs;
                                        const lastBoobTs = Math.max(lastRight, lastLeft);
                                        isLast = (subStats[key].lastTs === lastBoobTs) && (lastBoobTs > 0);
                                    } else if (key === 'sleeping' || key === 'waking_up') {
                                        isLast = (lastSleepEvent && subStats[key].lastTs === lastSleepEvent.timestamp);
                                    } else {
                                        isLast = (lastDiaper && subStats[key].lastTs === lastDiaper.timestamp);
                                    }

                                    return (
                                        <StatTileWithRef
                                            key={key} 
                                            statKey={key} 
                                            subStats={subStats} 
                                            isLast={isLast} 
                                            onTrigger={triggerQuickAdd} 
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Events List */}
            <div className="row g-3">
                <div className="col-12">
                    <div className="card">
                        <div className="card-header py-2">
                            {/* Fixed: Removed text-dark */}
                            <h5 className="mb-0 fw-bold" style={{fontSize: '1rem'}}><i className="fas fa-list-ul me-2 text-pink"></i>יומן אירועים</h5>
                        </div>
                        <div className="list-group list-group-flush">
                            {sortedEvents.length > 0 ? (
                                sortedDays.map(dayKey => {
                                    const dayGroup = eventsByDay[dayKey];
                                    const isToday = new Date().toDateString() === dayGroup.date.toDateString();
                                    const isYesterday = new Date(Date.now() - 86400000).toDateString() === dayGroup.date.toDateString();
                                    
                                    return (
                                        <React.Fragment key={dayKey}>
                                            <div className="day-header">
                                                {isToday ? 'היום' : isYesterday ? 'אתמול' : dayGroup.date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                <span className="badge bg-secondary-subtle text-secondary rounded-pill me-2" style={{fontSize: '0.7rem'}}>
                                                    {dayGroup.events.length} אירועים
                                                </span>
                                            </div>
                                            {dayGroup.events.map((event, idx) => {
                                                const meta = getEventMeta(event.type);
                                                const isPending = event.synced === false;
                                                return (
                                                    <div key={idx} className={`list-group-item event-item type-${event.type} px-2 py-1`}>
                                                        <div className="d-flex w-100 justify-content-between align-items-center">
                                                            <div className="d-flex align-items-center flex-grow-1">
                                                                <div className={`rounded-circle d-flex align-items-center justify-content-center me-2 ${meta.theme}`} style={{width: '20px', height: '20px', fontSize: '0.6rem'}}>
                                                                    <i className={`fas ${meta.icon}`}></i>
                                                                </div>
                                                                {/* Fixed: Removed text-dark */}
                                                                <span className="fw-bold" style={{fontSize: '0.8rem'}}>
                                                                    {meta.label}
                                                                </span>
                                                                {event.details && (
                                                                    <span className="text-muted ms-2" style={{fontSize: '0.7rem'}}>
                                                                        - {event.details}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="d-flex align-items-center">
                                                                {isPending && (
                                                                    <i 
                                                                        className="fas fa-exclamation-triangle text-warning me-2" 
                                                                        style={{fontSize: '0.7rem', cursor: 'pointer'}}
                                                                        onClick={(e) => triggerRetry(event, e)}
                                                                        title="ממתין לסנכרון - לחצי לפרטים"
                                                                    ></i>
                                                                )}
                                                                <div className="fw-bold text-muted" style={{fontSize: '0.75rem'}}>
                                                                    {new Date(event.timestamp).toLocaleString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </React.Fragment>
                                    );
                                })
                            ) : (
                                <div className="text-center py-4 text-muted">
                                    <div className="bg-body-tertiary rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{width: '60px', height: '60px'}}>
                                        <i className="fas fa-clipboard-list fa-lg text-secondary opacity-50"></i>
                                    </div>
                                    <h6 className="fw-bold" style={{fontSize: '0.9rem'}}>אין אירועים להצגה</h6>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal Overlay */}
            {showModal && (
                <GrowModal originRect={modalOrigin} onClose={() => setShowModal(false)}>
                    {(handleCloseAnimation) => (
                    <>
                        <div className="modal-header border-bottom-0 py-2 px-3" style={{backgroundColor: 'var(--primary-pink)', borderTopLeftRadius: '15px', borderTopRightRadius: '15px'}}>
                            <h6 className="modal-title fw-bold mb-0" style={{color: '#631d20'}}>
                                {modalType === 'rename' ? 'שינוי שם' : (modalType === 'retry' ? 'שגיאת סנכרון' : (isAutomated ? typeMap[addType].label : 'אירוע חדש'))}
                            </h6>
                            <button type="button" className="btn-close" style={{fontSize: '0.7rem', opacity: 1, filter: 'none'}} onClick={handleCloseAnimation}></button>
                        </div>
                        <div className="modal-body p-3">
                            {modalType === 'rename' ? (
                                <div className="mb-0">
                                    <input 
                                        type="text"
                                        className="form-control form-control-sm" 
                                        placeholder="שם התינוק/ת..."
                                        value={newTitle}
                                        onChange={(e) => setNewTitle(e.target.value)}
                                        autoFocus
                                        style={{fontSize: '0.9rem'}}
                                    />
                                </div>
                            ) : (
                                <>
                                    {modalType === 'retry' && (
                                        <div className="alert alert-warning py-2 px-3 mb-3 small d-flex align-items-center">
                                            <i className="fas fa-info-circle me-2"></i>
                                            <div>
                                                האירוע נשמר ביומן אך לא נשלח לוואטסאפ עקב בעיית חיבור.
                                            </div>
                                        </div>
                                    )}

                                    {modalType !== 'retry' && !isAutomated && (
                                        <div className="mb-2">
                                            <div className="d-grid gap-2" style={{gridTemplateColumns: '1fr 1fr'}}>
                                                {Object.entries(typeMap).map(([key, meta]) => (
                                                    <button 
                                                        key={key}
                                                        className={`btn btn-outline-secondary d-flex align-items-center justify-content-start p-1 border ${addType === key ? 'border-primary bg-primary-subtle' : ''}`}
                                                        onClick={() => setAddType(key)}
                                                        style={{fontSize: '0.8rem'}}
                                                    >
                                                        <div className={`rounded-circle d-flex align-items-center justify-content-center me-2 ${meta.theme}`} style={{width: '20px', height: '20px', fontSize: '0.6rem'}}>
                                                            <i className={`fas ${meta.icon}`}></i>
                                                        </div>
                                                        <span className="fw-bold">{meta.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="mb-2 text-center" style={{pointerEvents: modalType === 'retry' ? 'none' : 'auto', opacity: modalType === 'retry' ? 0.7 : 1}}>
                                        <DraggableTimeInput 
                                            value={addTime} 
                                            onChange={setAddTime} 
                                        />
                                    </div>

                                    <div className="mb-0">
                                        <textarea 
                                            className="form-control form-control-sm" 
                                            rows="1" 
                                            placeholder="פרטים נוספים..."
                                            value={addDetails}
                                            onChange={(e) => setAddDetails(e.target.value)}
                                            autoFocus={!isAutomated && modalType !== 'retry'}
                                            disabled={modalType === 'retry'}
                                            style={{fontSize: '0.9rem'}}
                                        ></textarea>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="modal-footer border-top-0 pt-0 p-2">
                            <button type="button" className="btn btn-sm btn-link text-muted text-decoration-none" onClick={handleCloseAnimation}>ביטול</button>
                            <button 
                                type="button" 
                                className="btn btn-sm btn-primary px-3 rounded-pill fw-bold" 
                                style={{backgroundColor: 'var(--primary-pink)', border: 'none', color: '#631d20'}}
                                onClick={() => {
                                    if (modalType === 'rename') handleRename(handleCloseAnimation);
                                    else if (modalType === 'retry') handleRetrySync(handleCloseAnimation);
                                    else handleAddEvent(handleCloseAnimation);
                                }}
                                disabled={sending}
                            >
                                {sending ? <span className="spinner-border spinner-border-sm me-1"></span> : (modalType === 'retry' ? <i className="fas fa-sync-alt me-1"></i> : <i className="fas fa-check me-1"></i>)}
                                {modalType === 'rename' ? 'עדכן' : (modalType === 'retry' ? 'נסה שוב' : 'שמור')}
                            </button>
                        </div>
                    </>
                    )}
                </GrowModal>
            )}
        </div>
    );
}

function App() {
    return (
        <ToastProvider>
            <AppContent />
        </ToastProvider>
    );
}

export { App };

const rootElement = document.getElementById('root');
if (rootElement) {
    const root = createRoot(rootElement);
    root.render(<App />);
}
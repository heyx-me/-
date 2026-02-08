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
        <>
            <div 
                className="modal-backdrop fade show" 
                style={{
                    backgroundColor: 'rgba(0,0,0,0.5)', 
                    zIndex: 1040, 
                    opacity: backdropOpacity,
                    transition: 'opacity 0.3s ease'
                }}
                onClick={handleClose}
            ></div>
            <div className="modal d-block" tabIndex="-1" style={{zIndex: 1055, pointerEvents: 'none'}}> 
                <div style={style} className="modal-content border-0 shadow-lg">
                    {typeof children === 'function' ? children(handleClose) : children}
                </div>
            </div>
        </>
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

// --- APP COMPONENT ---
function AppContent() {
    // --- STATE & HOOKS ---
    const addToast = useToast();
    const [events, setEvents] = useState(() => {
        const now = Date.now();
        const lastRefresh = localStorage.getItem(REFRESH_KEY);
        localStorage.setItem(REFRESH_KEY, now.toString());
        
        if (lastRefresh && (now - Number(lastRefresh) < 500)) {
            localStorage.removeItem(CACHE_KEY);
            return [];
        }

        const cachedRaw = localStorage.getItem(CACHE_KEY);
        if (cachedRaw) {
            try {
                const { timestamp, data } = JSON.parse(cachedRaw);
                if (now - timestamp < 5 * 60 * 1000) {
                    return data;
                } else {
                    localStorage.removeItem(CACHE_KEY);
                }
            } catch (e) {
                localStorage.removeItem(CACHE_KEY);
            }
        }
        return [];
    });
    
    const [loading, setLoading] = useState(events.length === 0);
    const [supabase, setSupabase] = useState(null);
    const [conversationId] = useState(() => {
        let id = localStorage.getItem('nanie_conversation_id');
        if (!id) {
            id = uuidv4();
            localStorage.setItem('nanie_conversation_id', id);
        }
        return id;
    });
    const [userId] = useState(() => {
        let id = localStorage.getItem('nanie_user_id');
        if (!id) {
            id = uuidv4();
            localStorage.setItem('nanie_user_id', id);
        }
        return id;
    });

    const [showModal, setShowModal] = useState(false);
    const [addType, setAddType] = useState('feeding');
    const [addDetails, setAddDetails] = useState('');
    const [addTime, setAddTime] = useState('');
    const [isAutomated, setIsAutomated] = useState(false);
    const [sending, setSending] = useState(false);
    const [modalOrigin, setModalOrigin] = useState(null);

    // --- LOADING TICKER STATE ---
    const [waitIndex, setWaitIndex] = useState(-1);
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
        let interval;

        if (loading && events.length === 0) {
            timeout = setTimeout(() => {
                setWaitIndex(0);
                interval = setInterval(() => {
                    setWaitIndex(prev => (prev + 1) % waitMessages.length);
                }, 8000);
            }, 3000);
        } else {
            setWaitIndex(-1);
        }

        return () => {
            clearTimeout(timeout);
            clearInterval(interval);
        };
    }, [loading, events.length]);

    // --- EFFECTS ---
    useEffect(() => {
        const client = createClient(SUPABASE_URL, SUPABASE_KEY);
        setSupabase(client);
    }, []);

    useEffect(() => {
        if (!supabase) return;

        const fetchStatus = async () => {
            if (events.length === 0) setLoading(true);
            
            const channel = supabase.channel(`room:nanie:${conversationId}`)
                .on('postgres_changes', { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'messages',
                    filter: `room_id=eq.nanie` 
                }, (payload) => {
                    if (payload.new.conversation_id === conversationId || payload.new.conversation_id === null) {
                        try {
                            const content = JSON.parse(payload.new.content);
                            if (content.type === 'DATA' && content.data && content.data.events) {
                                setEvents(prevEvents => {
                                    const newEvents = content.data.events;
                                    const combined = [...prevEvents, ...newEvents];
                                    
                                    const uniqueMap = new Map();
                                    combined.forEach(event => {
                                        const key = `${event.timestamp}-${event.type}`;
                                        uniqueMap.set(key, event);
                                    });
                                    
                                    const mergedEvents = Array.from(uniqueMap.values()).sort((a, b) => b.timestamp - a.timestamp);
                                    
                                    localStorage.setItem(CACHE_KEY, JSON.stringify({
                                        timestamp: Date.now(),
                                        data: mergedEvents
                                    }));
                                    
                                    return mergedEvents;
                                });
                                setLoading(false);
                            }
                        } catch (e) {
                            console.error('Parse error:', e);
                        }
                    }
                })
                .subscribe();

            await supabase.from('conversations').upsert({ 
                id: conversationId, 
                title: 'Nanie Chat',
                owner_id: userId,
                updated_at: new Date().toISOString()
            }, { onConflict: 'id', ignoreDuplicates: true });

            await supabase.from('messages').insert({
                room_id: 'nanie',
                conversation_id: conversationId,
                content: JSON.stringify({ action: 'GET_STATUS' }),
                sender_id: conversationId,
                is_bot: false
            });

            return () => {
                supabase.removeChannel(channel);
            };
        };

        fetchStatus();
    }, [supabase, conversationId]);

    // --- HANDLERS ---
    const handleAddEvent = async () => {
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
        
        try {
             await supabase.from('conversations').upsert({ 
                id: conversationId, 
                title: 'Nanie Chat',
                owner_id: userId,
                updated_at: new Date().toISOString()
            }, { onConflict: 'id', ignoreDuplicates: true });

            const { error } = await supabase.from('messages').insert({
                room_id: 'nanie',
                conversation_id: conversationId,
                content: JSON.stringify({ action: 'ADD_EVENT', text }),
                sender_id: conversationId,
                is_bot: false
            });
            
            if (error) throw error;
            
            addToast('האירוע נשלח בהצלחה!', 'success');
            setShowModal(false);
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
        setAddType('feeding');
        setAddDetails('');
        setAddTime(new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false }));
        setIsAutomated(false);
        setModalOrigin(null);
        setShowModal(true);
    };

    if (loading && events.length === 0) {
        return (
            <div className="d-flex flex-column justify-content-center align-items-center vh-100">
                <div className="spinner-border text-pink mb-3" role="status" style={{color: 'var(--primary-pink)', width: '3rem', height: '3rem'}}>
                    <span className="visually-hidden">Loading...</span>
                </div>
                <div className="text-muted small text-center px-3" 
                     style={{
                         minHeight: '1.5em',
                         marginTop: '1rem'
                     }}>
                    {waitIndex >= 0 && <WavyText text={waitMessages[waitIndex]} />}
                </div>
            </div>
        );
    }
    
    const sortedEvents = [...events].sort((a, b) => b.timestamp - a.timestamp);
    const lastEvent = sortedEvents[0];
    const lastFeeding = sortedEvents.find(e => e.type === 'feeding');
    const lastDiaper = sortedEvents.find(e => e.type === 'diaper');
    const now = Date.now();
    const last24h = now - 24 * 60 * 60 * 1000;
    
    const subStats = {
        'right_boob': { label: 'צד ימין', icon: 'fa-chevron-right', count: 0, lastTs: 0, theme: 'theme-feeding', event_type: 'feeding', event_details: 'צד ימין' },
        'left_boob': { label: 'צד שמאל', icon: 'fa-chevron-left', count: 0, lastTs: 0, theme: 'theme-feeding', event_type: 'feeding', event_details: 'צד שמאל' },
        'bottle': { label: 'בקבוק', icon: 'fa-wine-bottle', count: 0, lastTs: 0, theme: 'theme-feeding', event_type: 'feeding', event_details: 'בקבוק' },
        'poop': { label: 'קקי', icon: 'fa-poop', count: 0, lastTs: 0, theme: 'theme-diaper', event_type: 'diaper', event_details: 'קקי' },
        'pee': { label: 'פיפי', icon: 'fa-droplet', count: 0, lastTs: 0, theme: 'theme-diaper', event_type: 'diaper', event_details: 'פיפי' },
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
        if (details.includes('שאיבה')) updateStat('pumping');
        if (type === 'bath' || details.includes('מקלחת')) updateStat('bath');
    });

    const displayKeys = ['right_boob', 'left_boob', 'poop', 'pee'];
    const eventsByDay = {};
    sortedEvents.slice(0, 200).forEach(event => {
        const date = new Date(event.timestamp);
        const dayKey = date.toLocaleDateString('he-IL', { year: 'numeric', month: '2-digit', day: '2-digit' });
        if (!eventsByDay[dayKey]) {
            eventsByDay[dayKey] = { date, events: [] };
        }
        eventsByDay[dayKey].events.push(event);
    });
    const sortedDays = Object.keys(eventsByDay).sort((a, b) => new Date(eventsByDay[b].date) - new Date(eventsByDay[a].date));

    return (
        <div className="container pt-3 pb-3" style={{paddingBottom: '80px'}}>
            {/* Header */}
            <div className="d-flex justify-content-between align-items-end mb-3 border-bottom pb-2">
                {/* Fixed: Removed text-dark */}
                <div onClick={triggerManualAdd} style={{cursor: 'pointer'}}><h2 className="mb-0 fw-800">היומן של אלה</h2></div>
                <div className="text-muted small opacity-75 pb-1">
                    <i className="far fa-clock me-1"></i>
                    {lastEvent ? `אירוע אחרון: ${new Date(lastEvent.timestamp).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})}` : 'אין אירועים'}
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
                                                            <div className="fw-bold text-muted" style={{fontSize: '0.75rem'}}>
                                                                {new Date(event.timestamp).toLocaleString('he-IL', { hour: '2-digit', minute: '2-digit' })}
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
                                {isAutomated ? typeMap[addType].label : 'אירוע חדש'}
                            </h6>
                            <button type="button" className="btn-close" style={{fontSize: '0.7rem', opacity: 1, filter: 'none'}} onClick={handleCloseAnimation}></button>
                        </div>
                        <div className="modal-body p-3">
                            {!isAutomated && (
                                <div className="mb-2">
                                    <div className="d-grid gap-2" style={{gridTemplateColumns: '1fr 1fr'}}>
                                        {Object.entries(typeMap).map(([key, meta]) => (
                                            <button 
                                                key={key}
                                                // Fixed: Removed text-dark and changed to btn-outline-secondary
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
                            
                            <div className="mb-2 text-center">
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
                                    autoFocus={!isAutomated}
                                    style={{fontSize: '0.9rem'}}
                                ></textarea>
                            </div>
                        </div>
                        <div className="modal-footer border-top-0 pt-0 p-2">
                            <button type="button" className="btn btn-sm btn-link text-muted text-decoration-none" onClick={handleCloseAnimation}>ביטול</button>
                            <button 
                                type="button" 
                                className="btn btn-sm btn-primary px-3 rounded-pill fw-bold" 
                                style={{backgroundColor: 'var(--primary-pink)', border: 'none', color: '#631d20'}}
                                onClick={handleAddEvent}
                                disabled={sending}
                            >
                                {sending ? <span className="spinner-border spinner-border-sm me-1"></span> : <i className="fas fa-paper-plane me-1"></i>}
                                שמור
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
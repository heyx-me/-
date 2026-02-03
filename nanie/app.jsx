import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

// --- CONFIGURATION ---
// Config imported from ./config.js

const CACHE_KEY = 'nanie_events_cache';
const REFRESH_KEY = 'nanie_last_refresh_ts';

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

function TimeInput({ value, onChange }) {
    const inputRef = useRef(null);
    const draggingRef = useRef(false);
    const startPosRef = useRef({ x: 0, y: 0 });
    const startValueRef = useRef({ h: 0, m: 0 });

    const handleStart = (clientX, clientY) => {
        draggingRef.current = true;
        startPosRef.current = { x: clientX, y: clientY };
        const [h, m] = value.split(':').map(Number);
        startValueRef.current = { h, m };
        document.body.style.cursor = 'move';
    };

    const handleMove = (clientX, clientY) => {
        if (!draggingRef.current) return;
        
        const dx = clientX - startPosRef.current.x;
        const dy = clientY - startPosRef.current.y;
        
        // Sensitivity
        const hourDelta = Math.floor(dx / 30); // 30px per hour
        const minDelta = Math.floor(dy / 15) * -1; // 15px per minute (drag up to increase) - Inverted Y
        
        let newH = (startValueRef.current.h + hourDelta) % 24;
        if (newH < 0) newH += 24;
        
        let newM = (startValueRef.current.m + minDelta) % 60;
        if (newM < 0) newM += 60;
        
        const timeStr = `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
        onChange(timeStr);
    };

    const handleEnd = () => {
        draggingRef.current = false;
        document.body.style.cursor = '';
    };

    useEffect(() => {
        const onMouseMove = (e) => handleMove(e.clientX, e.clientY);
        const onMouseUp = handleEnd;
        const onTouchMove = (e) => handleMove(e.touches[0].clientX, e.touches[0].clientY);
        const onTouchEnd = handleEnd;

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchEnd);

        return () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onTouchEnd);
        };
    }, [value]); // Depend on value so closure has access if needed, though refs handle state

    return (
        <div 
            ref={inputRef}
            onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
            onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
            style={{ touchAction: 'none', userSelect: 'none', cursor: 'move', display: 'inline-block' }}
            className="position-relative"
        >
            <input 
                type="time" 
                className="form-control form-control-sm text-center fw-bold border-0" 
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    fontSize: '1.2rem', 
                    backgroundColor: 'transparent', 
                    color: 'var(--text-main)', 
                    pointerEvents: 'none' // Let the div handle interactions usually, or allow click? 
                                          // Better: "pointerEvents: none" disables click to edit on desktop
                                          // but we might want click to edit. 
                                          // Actually, drag logic on container + click on input is tricky.
                                          // Let's keep it simple: Drag anywhere on div updates value.
                                          // Click behavior for 'time' input is browser native picker.
                                          // If we want both, we need to distinguish click vs drag.
                                          // For now, let's allow browser picker via click, but block it during drag?
                                          // With pointerEvents: none on input, we can't click it.
                                          // Let's remove pointerEvents:none and see.
                }}
            />
             {/* Overlay to catch events but allow click-through if no drag? 
                 Actually, just putting handlers on the div wrapper works. 
                 The native input will capture clicks. 
                 But native input consumes touch events?
                 Let's keep pointerEvents: none to FORCE drag behavior as primary for this 'cool' feature request.
                 User asked to "modify by dragging".
                 If they want to type, they can't with pointer-events:none.
                 Let's enable pointer events but capture drag.
             */}
        </div>
    );
}

// Redefining TimeInput to be simpler and robust
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
                 // Auto hide tip if not dragging after a while?
                 // Handled by setTimeout in handleTip or let it stay while dragging?
                 // Let's hide tip on drag end
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
                        <span className="badge rounded-pill" style={{backgroundColor: 'var(--primary-pink)', fontSize: '0.6rem'}}>אחרון</span>
                    </div>
                )}
                
                <div className={`rounded-circle d-flex align-items-center justify-content-center mb-2 ${stat.theme}`} 
                     style={{width: '32px', height: '32px', fontSize: '0.9rem'}}>
                    <i className={`fas ${stat.icon}`}></i>
                </div>
                <span className="fw-bold text-dark lh-1 mb-1" style={{fontSize: '1.4rem'}}>{stat.count}</span>
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
            height: originRect ? originRect.height : 'auto', // This might snap if we don't fix height, but scale helps
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

// --- APP COMPONENT ---
function App() {
    // --- STATE & HOOKS ---
    const [events, setEvents] = useState(() => {
        const now = Date.now();
        const lastRefresh = localStorage.getItem(REFRESH_KEY);
        localStorage.setItem(REFRESH_KEY, now.toString());
        
        // 1. Rapid Refresh Eviction
        if (lastRefresh && (now - Number(lastRefresh) < 500)) {
            console.log('Rapid refresh detected. Clearing cache.');
            localStorage.removeItem(CACHE_KEY);
            return [];
        }

        // 2. Cache Expiry
        const cachedRaw = localStorage.getItem(CACHE_KEY);
        if (cachedRaw) {
            try {
                const { timestamp, data } = JSON.parse(cachedRaw);
                if (now - timestamp < 5 * 60 * 1000) {
                    return data;
                } else {
                    console.log('Cache expired.');
                    localStorage.removeItem(CACHE_KEY);
                }
            } catch (e) {
                console.error('Cache parse error', e);
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

    // Add Event Modal State (Moved up to fix Rules of Hooks)
    const [showModal, setShowModal] = useState(false);
    const [addType, setAddType] = useState('feeding');
    const [addDetails, setAddDetails] = useState('');
    const [addTime, setAddTime] = useState('');
    const [isAutomated, setIsAutomated] = useState(false);
    const [sending, setSending] = useState(false);
    
    // Animation State
    const [modalOrigin, setModalOrigin] = useState(null);

    // --- EFFECTS ---
    // 1. Initialize Supabase
    useEffect(() => {
        const client = createClient(SUPABASE_URL, SUPABASE_KEY);
        setSupabase(client);
    }, []);

    // 2. Fetch Data (Send Command)
    useEffect(() => {
        if (!supabase) return;

        const fetchStatus = async () => {
            if (events.length === 0) setLoading(true);
            
            // Subscribe to responses
            const channel = supabase.channel(`room:nanie:${conversationId}`)
                .on('postgres_changes', { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'messages',
                    filter: `room_id=eq.nanie` 
                }, (payload) => {
                    // Filter for our conversation or global broadcasts?
                    // The agent replies to specific conversationId.
                    if (payload.new.conversation_id === conversationId || payload.new.conversation_id === null) {
                        try {
                            const content = JSON.parse(payload.new.content);
                            if (content.type === 'DATA' && content.data && content.data.events) {
                                setEvents(prevEvents => {
                                    const newEvents = content.data.events;
                                    const combined = [...prevEvents, ...newEvents];
                                    
                                    // Deduplicate based on composite key: timestamp + type
                                    const uniqueMap = new Map();
                                    combined.forEach(event => {
                                        const key = `${event.timestamp}-${event.type}`;
                                        uniqueMap.set(key, event);
                                    });
                                    
                                    const mergedEvents = Array.from(uniqueMap.values()).sort((a, b) => b.timestamp - a.timestamp);
                                    
                                    // Update Cache
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

            // Send GET_STATUS command
            
            await supabase.from('messages').insert({
                room_id: 'nanie',
                conversation_id: conversationId,
                content: JSON.stringify({ action: 'GET_STATUS' }),
                sender_id: conversationId, // distinct from agent
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
        if (!addDetails.trim() || !supabase) return;
        setSending(true);

        // Construct natural language text for the backend/Gemini to parse
        let prefix = addTime ? `בשעה ${addTime} ` : '';
        let text = `${prefix}${typeMap[addType].label} ${addDetails}`;
        // Add specific keywords if needed to ensure correct classification
        if (addType === 'feeding' && !text.includes('האכלה')) text = `${prefix}האכלה ${addDetails}`;
        
        try {
            await supabase.from('messages').insert({
                room_id: 'nanie',
                conversation_id: conversationId,
                content: JSON.stringify({ action: 'ADD_EVENT', text }),
                sender_id: conversationId,
                is_bot: false
            });
            
            setShowModal(false);
            setAddDetails('');
            setAddTime('');
            setIsAutomated(false);
            setModalOrigin(null);
        } catch (e) {
            console.error('Send error:', e);
            alert('שגיאה בשליחה');
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
        
        // Handle Origin
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
        setModalOrigin(null); // No origin for manual add
        setShowModal(true);
    };

    // --- RENDER ---
    // ... (Loading state unchanged) ...
    if (loading && events.length === 0) {
        return (
            <div className="d-flex justify-content-center align-items-center vh-100">
                <div className="spinner-border text-pink" role="status" style={{color: 'var(--primary-pink)'}}>
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }
    
    // ... (Data processing unchanged) ...
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
    
    // Updated StatTile to pass element
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
                            <span className="badge rounded-pill" style={{backgroundColor: 'var(--primary-pink)', fontSize: '0.6rem'}}>אחרון</span>
                        </div>
                    )}
                    
                    <div className={`rounded-circle d-flex align-items-center justify-content-center mb-2 ${stat.theme}`} 
                         style={{width: '32px', height: '32px', fontSize: '0.9rem'}}>
                        <i className={`fas ${stat.icon}`}></i>
                    </div>
                    <span className="fw-bold text-dark lh-1 mb-1" style={{fontSize: '1.4rem'}}>{stat.count}</span>
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

    return (
        <div className="container pt-3 pb-3" style={{paddingBottom: '80px'}}>
            {/* Header */}
            <div className="d-flex justify-content-between align-items-end mb-3 border-bottom pb-2">
                <div onClick={triggerManualAdd} style={{cursor: 'pointer'}}><h2 className="mb-0 fw-800 text-dark">היומן של אלה</h2></div>
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
                                    const isLast = (lastFeeding && subStats[key].lastTs === lastFeeding.timestamp) || 
                                                   (lastDiaper && subStats[key].lastTs === lastDiaper.timestamp);

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
                            <h5 className="mb-0 fw-bold text-dark" style={{fontSize: '1rem'}}><i className="fas fa-list-ul me-2 text-pink"></i>יומן אירועים</h5>
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
                                                                <span className="fw-bold text-dark" style={{fontSize: '0.8rem'}}>
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
                            <h6 className="modal-title fw-bold text-white mb-0">
                                {isAutomated ? typeMap[addType].label : 'אירוע חדש'}
                            </h6>
                            <button type="button" className="btn-close btn-close-white" style={{fontSize: '0.7rem'}} onClick={handleCloseAnimation}></button>
                        </div>
                        <div className="modal-body p-3">
                            {!isAutomated && (
                                <div className="mb-2">
                                    <div className="d-grid gap-2" style={{gridTemplateColumns: '1fr 1fr'}}>
                                        {Object.entries(typeMap).map(([key, meta]) => (
                                            <button 
                                                key={key}
                                                className={`btn btn-outline-light text-dark d-flex align-items-center justify-content-start p-1 border ${addType === key ? 'border-primary bg-primary-subtle' : ''}`}
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
                                className="btn btn-sm btn-primary px-3 rounded-pill" 
                                style={{backgroundColor: 'var(--primary-pink)', border: 'none'}}
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

const root = createRoot(document.getElementById('root'));
root.render(<App />);
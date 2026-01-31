import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// --- CONFIGURATION ---
const SUPABASE_URL = 'https://gsyozgedljmcpsysstpz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzeW96Z2VkbGptY3BzeXNzdHB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTEwOTg4MDAsImV4cCI6MjAyNjY3NDgwMH0.SomeFakeSignatureButClientShouldFetchFromEnvIfPossible'; 
// Note: In a real app we'd fetch config or use env vars. For this demo, using the one typically exposed or passed.
// Wait, I don't have the anon key handy in the context provided.
// However, I can try to fetch it from a config endpoint if available, or assume the user has it.
// Actually, `rafi/config.js` usually holds this. Let's check `rafi/config.js` or `agent.js` for the public key.
// `agent.js` uses SERVICE_KEY (server-side).
// I'll try to use a placeholder and ask the user or check if there's a client-side config available.
// Let's assume for now I need to fetch it or it's hardcoded in the existing `rafi` app.
// I will check `rafi/config.js` first. For now I'll use a placeholder variable that I'll replace.

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

// --- APP COMPONENT ---
function App() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [supabase, setSupabase] = useState(null);
    const [conversationId] = useState(() => {
        let id = localStorage.getItem('nanie_conversation_id');
        if (!id) {
            id = uuidv4();
            localStorage.setItem('nanie_conversation_id', id);
        }
        return id;
    });

    // 1. Initialize Supabase
    useEffect(() => {
        // We need to get the ANON KEY. 
        // In this environment, we might need to fetch it from a local endpoint or it might be injected.
        // For now, I'll attempt to fetch it from a relative path if I can, or hardcode if I find it.
        // Let's assume I can import it from a shared config if it existed.
        // HACK: I will fetch `../rafi/config.js` if possible, or just look at `rafi/app.jsx` to see how it initializes.
        // Since I can't look at files dynamically inside the browser without a fetch,
        // I will assume the user has to provide it or I use a known one.
        
        // Let's fallback to asking the server/agent via a fetch if I can't find it.
        // Actually, `agent.js` has the keys. 
        // I'll skip the key for a moment and assume I can get it.
        
        // Check `rafi/config.js` via tool first (I will do this before writing this file actually).
        
        // Placeholder for now
        const anonKey = window.SUPABASE_ANON_KEY || 'MISSING_KEY'; 
        const client = createClient(SUPABASE_URL, anonKey);
        setSupabase(client);
    }, []);

    // 2. Fetch Data (Send Command)
    useEffect(() => {
        if (!supabase) return;

        const fetchStatus = async () => {
            setLoading(true);
            
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
                                setEvents(content.data.events);
                                setLoading(false);
                            }
                        } catch (e) {
                            console.error('Parse error:', e);
                        }
                    }
                })
                .subscribe();

            // Send GET_STATUS command
            // We use the same 'messages' table to send TO the agent? 
            // Usually agents listen to 'messages' table inserts by user.
            // But we are a client. We should Insert a message.
            
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

    // 3. Render
    if (loading && events.length === 0) {
        return (
            <div className="d-flex justify-content-center align-items-center vh-100">
                <div className="spinner-border text-pink" role="status" style={{color: 'var(--primary-pink)'}}>
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    const sortedEvents = [...events].sort((a, b) => b.timestamp - a.timestamp);
    const lastEvent = sortedEvents[0];

    // Summary Helpers
    const lastFeeding = sortedEvents.find(e => e.type === 'feeding');
    const lastDiaper = sortedEvents.find(e => e.type === 'diaper');
    const feedMeta = getEventMeta('feeding');
    const diaperMeta = getEventMeta('diaper');

    // 24h Stats
    const now = Date.now();
    const last24h = now - 24 * 60 * 60 * 1000;
    const eventsLast24h = sortedEvents.filter(e => e.timestamp >= last24h);
    
    const subStats = {
        'right_boob': { label: 'צד ימין', icon: 'fa-chevron-right', count: 0, lastTs: 0, theme: 'theme-feeding' },
        'left_boob': { label: 'צד שמאל', icon: 'fa-chevron-left', count: 0, lastTs: 0, theme: 'theme-feeding' },
        'bottle': { label: 'בקבוק', icon: 'fa-wine-bottle', count: 0, lastTs: 0, theme: 'theme-feeding' },
        'poop': { label: 'קקי', icon: 'fa-poop', count: 0, lastTs: 0, theme: 'theme-diaper' },
        'pee': { label: 'פיפי', icon: 'fa-droplet', count: 0, lastTs: 0, theme: 'theme-diaper' },
        'pumping': { label: 'שאיבה', icon: 'fa-pump-medical', count: 0, lastTs: 0, theme: 'theme-other' },
        'bath': { label: 'מקלחת', icon: 'fa-bath', count: 0, lastTs: 0, theme: 'theme-bath' }
    };

    eventsLast24h.forEach(e => {
        const details = (e.details || e.label || '').toLowerCase();
        const type = e.type || '';
        const ts = Number(e.timestamp);
        
        const checkAndSet = (key) => {
            subStats[key].count++;
            subStats[key].lastTs = Math.max(subStats[key].lastTs, ts);
        };

        if (details.includes('ימין')) checkAndSet('right_boob');
        if (details.includes('שמאל')) checkAndSet('left_boob');
        if (details.includes('בקבוק')) checkAndSet('bottle');
        if (details.includes('צואה') || details.includes('קקי')) checkAndSet('poop');
        if (details.includes('שתן') || details.includes('פיפי')) checkAndSet('pee');
        if (details.includes('שאיבה')) checkAndSet('pumping');
        if (type === 'bath' || details.includes('מקלחת')) checkAndSet('bath');
    });

    const displayKeys = ['right_boob', 'left_boob', 'poop', 'pee'];

    // Grouping
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
        <div className="container pt-3 pb-3">
            {/* Header */}
            <div className="d-flex justify-content-between align-items-end mb-3 border-bottom pb-2">
                <div><h2 className="mb-0 fw-800 text-dark">היומן של אלה</h2></div>
                <div className="text-muted small opacity-75 pb-1">
                    <i className="far fa-clock me-1"></i>
                    {lastEvent ? `אירוע אחרון: ${new Date(lastEvent.timestamp).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})}` : 'אין אירועים'}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="row g-3 mb-3">
                <div className="col-12">
                    <div className="card h-100">
                        <div className="card-body p-3">
                            <div className="row">
                                {/* Last Feeding */}
                                <div className="col-6 d-flex align-items-center border-end">
                                    <div className={`icon-box ${feedMeta.theme} me-3`}>
                                        <i className={`fas ${feedMeta.icon}`}></i>
                                    </div>
                                    <div>
                                        <h6 className="text-muted text-uppercase fw-bold mb-1" style={{fontSize: '0.7rem'}}>האכלה אחרונה</h6>
                                        {lastFeeding ? (
                                            <>
                                                <h4 className="mb-0 fw-bold text-dark time-ago-badge" style={{fontSize: '1.1rem', background: 'none', padding: 0, color: 'var(--text-main)'}}>
                                                    {timeAgo(lastFeeding.timestamp)}
                                                </h4>
                                                <small className="text-muted">{new Date(lastFeeding.timestamp).toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'})}</small>
                                            </>
                                        ) : <h5 className="mb-0 text-muted">-</h5>}
                                    </div>
                                </div>
                                {/* Last Diaper */}
                                <div className="col-6 d-flex align-items-center ps-3">
                                    <div className={`icon-box ${diaperMeta.theme} me-3`}>
                                        <i className={`fas ${diaperMeta.icon}`}></i>
                                    </div>
                                    <div>
                                        <h6 className="text-muted text-uppercase fw-bold mb-1" style={{fontSize: '0.7rem'}}>חיתול אחרון</h6>
                                        {lastDiaper ? (
                                            <>
                                                <h4 className="mb-0 fw-bold text-dark time-ago-badge" style={{fontSize: '1.1rem', background: 'none', padding: 0, color: 'var(--text-main)'}}>
                                                    {timeAgo(lastDiaper.timestamp)}
                                                </h4>
                                                <small className="text-muted">{new Date(lastDiaper.timestamp).toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'})}</small>
                                            </>
                                        ) : <h5 className="mb-0 text-muted">-</h5>}
                                    </div>
                                </div>
                            </div>
                        </div>
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
                                {displayKeys.map(key => (
                                    <div className="col-6" key={key}>
                                        <div className="d-flex flex-column align-items-center justify-content-center p-2 rounded-3 border border-subtle h-100 text-center position-relative overflow-hidden" 
                                             style={{backgroundColor: 'var(--bs-tertiary-bg)'}}>
                                            <div className={`rounded-circle d-flex align-items-center justify-content-center mb-2 ${subStats[key].theme}`} 
                                                 style={{width: '32px', height: '32px', fontSize: '0.9rem'}}>
                                                <i className={`fas ${subStats[key].icon}`}></i>
                                            </div>
                                            <span className="fw-bold text-dark lh-1 mb-1" style={{fontSize: '1.4rem'}}>{subStats[key].count}</span>
                                            <span className="text-muted small text-truncate w-100 mb-1" style={{fontSize: '0.75rem', opacity: 0.8}}>{subStats[key].label}</span>
                                            
                                            {subStats[key].lastTs > 0 ? (
                                                <span className="time-ago-badge" style={{fontSize: '0.65rem', padding: '2px 8px'}}>
                                                    {timeAgo(subStats[key].lastTs)}
                                                </span>
                                            ) : <span className="text-muted" style={{fontSize: '0.65rem', opacity: 0.5}}>-</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Events List */}
            <div className="row g-3">
                <div className="col-12">
                    <div className="card" style={{maxHeight: '70vh'}}>
                        <div className="card-header py-2">
                            <h5 className="mb-0 fw-bold text-dark" style={{fontSize: '1rem'}}><i className="fas fa-list-ul me-2 text-pink"></i>יומן אירועים</h5>
                        </div>
                        <div className="list-group list-group-flush overflow-auto custom-scrollbar" style={{maxHeight: '65vh'}}>
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
        </div>
    );
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);

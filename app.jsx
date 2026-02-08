import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion, AnimatePresence } from "framer-motion";
import { saveFileOverride } from "./preview-storage.js";
import { ConversationProvider, useConversation } from "./contexts/ConversationContext.jsx";
import { 
    Terminal, 
    MessageSquare, 
    Layout, 
    ExternalLink, 
    FolderOpen,
    Play,
    Send,
    RefreshCw,
    Bot,
    User,
    Menu,
    X,
    Eye,
    GitBranch,
    Plus,
    Check,
    Loader2,
    Home,
    Search,
    ChevronDown,
    Info,
    Trash2,
    Copy,
    PanelLeftClose,
    PanelLeftOpen,
    Share2,
    Users,
    ArrowLeft,
    MoreVertical,
    Settings
} from "lucide-react";

// --- Configuration ---
const SUPABASE_URL = 'https://gsyozgedljmcpsysstpz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_FJI1hrANejiwsKll-G4zMQ_wRR-Surp'; 

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        persistSession: false
    }
});

// --- Hooks ---

function useRouter() {
    const [route, setRoute] = useState({ view: 'list', params: {} });

    useEffect(() => {
        const handlePopState = () => {
            const params = new URLSearchParams(window.location.search);
            const v = params.get('v') || 'list';
            const id = params.get('id');
            setRoute({ view: v, params: { id } });
        };
        window.addEventListener('popstate', handlePopState);
        handlePopState(); // Initial load
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const navigate = (view, params = {}) => {
        const url = new URL(window.location);
        url.searchParams.set('v', view);
        if (params.id) url.searchParams.set('id', params.id);
        else url.searchParams.delete('id');
        window.history.pushState({}, '', url);
        setRoute({ view, params });
    };

    return { route, navigate };
}

function useLocales() {
    const [lang, setLang] = useState('en');
    useEffect(() => {
        const updateLang = () => {
            const docLang = document.documentElement.lang;
            const navLang = navigator.language || navigator.userLanguage;
            setLang((docLang === 'he' || (navLang && navLang.startsWith('he'))) ? 'he' : 'en');
        };
        updateLang();
        const observer = new MutationObserver(updateLang);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
        return () => observer.disconnect();
    }, []);
    const t = (key) => ({ en: { thinking: "Thinking..." }, he: { thinking: "חושב..." } })[lang]?.[key] || key;
    return { t, lang };
}

// --- Utils ---

function formatRelativeTime(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
        return "Yesterday";
    } else if (diffDays < 7) {
        return date.toLocaleDateString([], { weekday: 'short' });
    } else {
        return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
    }
}

function detectDirection(text) {
    if (!text) return 'ltr';
    const cleanText = text.trim().replace(/^([#\s\-\*\d\.\>]+)/, '');
    const firstChar = cleanText.charAt(0);
    const rtlRegex = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;
    return rtlRegex.test(firstChar) ? 'rtl' : 'ltr';
}

// --- Components: Core UI ---

function UpdateCard({ path, content, timestamp, onApplyUpdate }) {
    const [status, setStatus] = useState('pending'); 
    useEffect(() => {
        let mounted = true;
        const applyUpdate = async () => {
            try {
                const ts = timestamp ? new Date(timestamp).getTime() : Date.now();
                const applied = await saveFileOverride(path, content, ts);
                if (mounted) setStatus(applied ? 'applied' : 'skipped');
            } catch (e) {
                console.error("Auto-apply failed:", e);
                if (mounted) setStatus('error');
            }
        };
        applyUpdate();
        return () => { mounted = false; };
    }, [path, content, timestamp]);

    return (
        <div className="mt-2 mb-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 overflow-hidden text-left">
            <div className="flex items-center justify-between px-3 py-2 border-b border-yellow-500/10 bg-yellow-500/10">
                <div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${status === 'applied' ? 'bg-green-500 animate-pulse' : 'bg-zinc-500'}`}></div><span className="text-xs font-medium text-yellow-200 font-mono">{path}</span></div>
                <div className="flex items-center gap-2">
                    {status === 'applied' && <span className="text-[10px] text-green-400 font-medium flex items-center gap-1"><Check size={12} /> Live Preview</span>}
                    {status === 'skipped' && <span className="text-[10px] text-zinc-500 font-medium">History</span>}
                    {status === 'pending' && <span className="text-[10px] text-yellow-500 font-medium">Syncing...</span>}
                </div>
            </div>
            <div className="p-2 relative group"><pre className="text-[10px] font-mono text-zinc-400 overflow-x-auto p-2 max-h-32 custom-scrollbar">{content}</pre></div>
        </div>
    );
}

function ToolCallCard({ name, status, args }) {
    const [isOpen, setIsOpen] = useState(false);
    let parsedArgs = args;
    if (typeof args === 'string') { try { parsedArgs = JSON.parse(args); } catch (e) {} }
    const iconColor = status === 'success' ? 'text-green-400' : (status === 'running' ? 'text-blue-400' : 'text-red-400');
    return (
        <div className={`my-2 rounded-lg border border-white/5 bg-black/20 overflow-hidden font-mono text-xs text-left`}>
            <button onClick={() => setIsOpen(!isOpen)} className={`w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors`}>
                <div className="flex items-center gap-2"><Terminal size={14} className={iconColor} /><span className="font-semibold text-zinc-300">{name}</span></div>
                <div className="flex items-center gap-2"><span className={`text-[10px] uppercase tracking-wider ${iconColor}`}>{status}</span><ChevronDown size={14} className={`text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} /></div>
            </button>
            {isOpen && <div className="border-t border-white/5 bg-black/20 p-3 overflow-x-auto"><pre className="text-zinc-400 whitespace-pre-wrap">{JSON.stringify(parsedArgs, null, 2)}</pre></div>}
        </div>
    );
}

function MarkdownContent({ content }) {
    const dir = detectDirection(content);
    return (
        <div dir={dir} className={`prose prose-invert prose-sm max-w-none break-words ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                a: ({node, ...props}) => <a {...props} className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer" />,
                code: ({node, inline, className, children, ...props}) => inline ? <code className="bg-white/10 rounded px-1 py-0.5 text-xs font-mono text-zinc-300" {...props}>{children}</code> : <code className="block bg-black/30 rounded-lg p-3 text-xs font-mono text-zinc-300 overflow-x-auto my-2 whitespace-pre" {...props}>{children}</code>,
                p: ({node, children, ...props}) => <p className="mb-2 last:mb-0 leading-relaxed" {...props}>{children}</p>,
                ul: ({node, children, ...props}) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props}>{children}</ul>,
                ol: ({node, children, ...props}) => <ol className="list-decimal pl-4 mb-2 space-y-1" {...props}>{children}</ol>,
                h1: ({node, children, ...props}) => <h1 className="text-lg font-bold mt-4 mb-2 text-zinc-100" {...props}>{children}</h1>,
                h2: ({node, children, ...props}) => <h2 className="text-base font-bold mt-3 mb-2 text-zinc-100" {...props}>{children}</h2>,
                h3: ({node, children, ...props}) => <h3 className="text-sm font-bold mt-2 mb-1 text-zinc-100" {...props}>{children}</h3>,
                blockquote: ({node, children, ...props}) => <blockquote className="border-l-2 border-zinc-500 pl-3 italic text-zinc-400 my-2" {...props}>{children}</blockquote>,
                table: ({node, children, ...props}) => <div className="overflow-x-auto my-2"><table className="min-w-full divide-y divide-zinc-700 border border-zinc-700 rounded-lg" {...props}>{children}</table></div>,
                thead: ({node, children, ...props}) => <thead className="bg-zinc-800" {...props}>{children}</thead>,
                tbody: ({node, children, ...props}) => <tbody className="divide-y divide-zinc-700" {...props}>{children}</tbody>,
                tr: ({node, children, ...props}) => <tr className="hover:bg-zinc-800/50" {...props}>{children}</tr>,
                th: ({node, children, ...props}) => <th className="px-3 py-2 text-left text-xs font-medium text-zinc-300 uppercase tracking-wider" {...props}>{children}</th>,
                td: ({node, children, ...props}) => <td className="px-3 py-2 text-sm text-zinc-300 whitespace-nowrap" {...props}>{children}</td>,
            }}>{content}</ReactMarkdown>
        </div>
    );
}

function TextWithUpdates({ content, timestamp, onApplyUpdate }) {
    const regex = /<file_update path="(.*?)">([\s\S]*?)<\/file_update>/g;
    const parts = []; let lastIndex = 0; let match;
    while ((match = regex.exec(content)) !== null) {
        if (match.index > lastIndex) parts.push({ type: 'text', content: content.substring(lastIndex, match.index) });
        parts.push({ type: 'update', path: match[1], content: match[2] });
        lastIndex = regex.lastIndex;
    }
    if (lastIndex < content.length) parts.push({ type: 'text', content: content.substring(lastIndex) });
    if (parts.length === 0) return <MarkdownContent content={content} />;
    return (
        <div className="w-full">{parts.map((part, idx) => part.type === 'text' ? <MarkdownContent key={idx} content={part.content} /> : <UpdateCard key={idx} path={part.path} content={part.content} timestamp={timestamp} onApply={onApplyUpdate} />)}</div>
    );
}

function ThinkingBubble() {
    const { t, lang } = useLocales();
    return (
        <div className="flex items-center gap-2 py-1 px-2 animate-pulse" dir={lang === 'he' ? 'rtl' : 'ltr'}><Loader2 size={14} className="animate-spin text-purple-400" /><span className="text-xs text-zinc-500 italic">{t('thinking')}</span></div>
    );
}

function StatsMetadata({ stats }) {
    const total = stats?.total_tokens || stats?.tokens?.total || 0;
    if (!total) return null;
    return <div className="mt-1 flex justify-end text-[10px] text-zinc-600"><span>{total} tokens</span></div>;
}

function ProtocolMessage({ json }) {
    const [isOpen, setIsOpen] = useState(false);
    let details = "";
    if (json.type === 'DATA' || json.type === 'LOGIN_SUCCESS') details = `• ${json.data?.accounts?.length || 0} Accounts`;
    else if (json.text) details = `• "${json.text.substring(0, 20)}..."`;
    return (
        <div className="my-2 rounded-lg border border-purple-500/20 bg-purple-500/5 overflow-hidden font-mono text-xs text-left">
             <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-purple-500"></div><span className="font-semibold text-zinc-300">App Message</span></div>
                <div className="flex items-center gap-2"><span className="text-[10px] text-zinc-400">{json.type} <span className="text-zinc-600">{details}</span></span><ChevronDown size={14} className={`text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} /></div>
            </button>
            {isOpen && <div className="border-t border-white/5 bg-black/20 p-3 overflow-x-auto"><pre className="text-zinc-400 whitespace-pre-wrap">{JSON.stringify(json, null, 2)}</pre></div>}
        </div>
    );
}

function MessageContent({ content, timestamp, onApplyUpdate }) {
    if (!content) return null;
    if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
        try {
            const json = JSON.parse(content);
            if (json.type === 'thinking') return <ThinkingBubble />;
            if (json.type === 'text') return <div className="flex flex-col"><MessageContent content={json.content || ""} timestamp={timestamp} onApplyUpdate={onApplyUpdate} /><StatsMetadata stats={json.stats} /></div>;
            if (json.type) return <ProtocolMessage json={json} />;
        } catch (e) {}
    }
    const toolRegex = /<tool_call name="(.*?)" status="(.*?)">([\s\S]*?)<\/tool_call>/g;
    const parts = []; let lastIndex = 0; let match;
    while ((match = toolRegex.exec(content)) !== null) {
        if (match.index > lastIndex) parts.push({ type: 'text', content: content.substring(lastIndex, match.index) });
        parts.push({ type: 'tool', name: match[1], status: match[2], args: match[3] });
        lastIndex = toolRegex.lastIndex;
    }
    if (lastIndex < content.length) parts.push({ type: 'text', content: content.substring(lastIndex) });
    if (parts.length === 0) return <TextWithUpdates content={content} timestamp={timestamp} onApplyUpdate={onApplyUpdate} />;
    return (
        <div className="space-y-1">{parts.map((part, idx) => part.type === 'tool' ? <ToolCallCard key={idx} name={part.name} status={part.status} args={part.args} /> : <TextWithUpdates key={idx} content={part.content} timestamp={timestamp} onApplyUpdate={onApplyUpdate} />)}</div>
    );
}

function MessageBubble({ msg, botName, onRefresh }) {
    const isBot = msg.is_bot || msg.sender_id === 'alex-bot';
    return (
        <div className={`flex gap-3 w-full mb-4 ${isBot ? 'justify-start' : 'justify-end'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-white/5 bg-zinc-800 ${isBot ? 'order-1' : 'order-2 hidden md:flex'}`}>
                {isBot ? <Bot size={14} className="text-blue-400" /> : <User size={14} className="text-zinc-400" />}
            </div>
            <div className={`max-w-[85%] md:max-w-[75%] space-y-1 ${isBot ? 'order-2 items-start' : 'order-1 items-end'} flex flex-col`}>
                <div className="flex items-baseline gap-2 px-1">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{isBot ? botName : 'You'}</span>
                    <span className="text-[9px] text-zinc-600">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className={`text-sm text-zinc-200 leading-relaxed p-3 rounded-2xl ${isBot ? 'bg-zinc-800 rounded-tl-sm' : 'bg-blue-600 rounded-tr-sm shadow-lg shadow-blue-900/20'}`}>
                    <MessageContent content={msg.content} timestamp={msg.created_at} onApplyUpdate={onRefresh} />
                </div>
            </div>
        </div>
    );
}

function shouldHideMessage(msg) {
    if (!msg || !msg.content) return false;
    const content = msg.content.trim();
    if (!content.startsWith('{') || !content.endsWith('}')) return false;
    try {
        const json = JSON.parse(content);
        if (!msg.is_bot && json.action) return true;
        if (msg.is_bot && json.type && !['text', 'thinking', 'error'].includes(json.type)) return true;
    } catch (e) {}
    return false;
}

// --- Components: Chat Layout ---

function ChatInput({ onSend, botName, loading }) {
    const [input, setInput] = useState("");
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;
        onSend(input); setInput("");
    };
    return (
        <div className="p-4 border-t border-white/5 shrink-0 bg-surface relative z-40">
            <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto">
                <input 
                    type="text" value={input} onChange={(e) => setInput(e.target.value)} 
                    placeholder={`Message ${botName}...`} 
                    className="w-full bg-black/20 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all text-zinc-200" 
                />
                <button type="submit" disabled={loading || !input.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-blue-400 disabled:opacity-50">
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
            </form>
        </div>
    );
}

function ChatToasts({ messages, botName, onRefresh, scrollRef }) {
    return (
        <div ref={scrollRef} className="absolute left-0 right-0 bottom-4 z-30 max-h-[60%] flex flex-col overflow-y-auto pointer-events-none px-4 pb-4 gap-3 scroll-smooth no-scrollbar" style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 20%, black 100%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 20%, black 100%)' }}>
             <div className="mt-auto flex flex-col gap-3 justify-end pointer-events-none">
                <AnimatePresence>
                    {messages.map((msg) => (
                        <motion.div key={msg.id} layout initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: -100, transition: { duration: 0.2 } }} className="bg-black/60 backdrop-blur-md rounded-xl border border-white/10 p-3 shadow-xl origin-bottom relative shrink-0 pointer-events-auto max-w-[90%]">
                             <MessageBubble msg={msg} botName={botName} onRefresh={onRefresh} />
                        </motion.div>
                    ))}
                </AnimatePresence>
             </div>
        </div>
    );
}

function PreviewPane({ activeApp, previewKey }) {
    if (!activeApp) return <div className="flex-1 flex flex-col items-center justify-center bg-[#0c0c0e] text-zinc-600 gap-4 p-4 text-center"><div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center"><Layout size={32} /></div><p className="text-sm">Select an app to preview</p></div>;
    return <iframe key={previewKey} src={activeApp.path} className="flex-1 w-full h-full border-0 bg-white" title="Preview" />;
}

function ChatInterface({ activeApp, userId, conversationId, setThread, onCreated, viewMode }) {
    const [messages, setMessages] = useState([]);
    const [toastMessages, setToastMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [previewKey, setPreviewKey] = useState(0);
    const scrollRef = useRef(null);
    const toastScrollRef = useRef(null);
    const roomId = activeApp ? activeApp.id : 'home';
    const botName = activeApp ? activeApp.name : 'Alex';
    const handleRefresh = () => setPreviewKey(k => k + 1);

    useEffect(() => {
        setMessages([]); setToastMessages([]);
        if (!conversationId) return;
        const fetchRecent = async () => {
            const { data } = await supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(20);
            if (data) { const visible = data.filter(m => !shouldHideMessage(m)); setMessages(visible.reverse()); }
        };
        fetchRecent();
        const channel = supabase.channel(`public:messages:${conversationId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
            const newMsg = payload.new; if (shouldHideMessage(newMsg)) return;
            setMessages(prev => [...prev, newMsg]);
            if (viewMode === 'app' && newMsg.sender_id !== userId) {
                setToastMessages(prev => [...prev, newMsg]);
                setTimeout(() => { setToastMessages(current => current.filter(m => m.id !== newMsg.id)); }, 8000);
            }
        }).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
            const updatedMsg = payload.new; if (shouldHideMessage(updatedMsg)) { setMessages(prev => prev.filter(msg => msg.id !== updatedMsg.id)); setToastMessages(prev => prev.filter(msg => msg.id !== updatedMsg.id)); }
            else { setMessages(prev => prev.map(msg => msg.id === updatedMsg.id ? updatedMsg : msg)); setToastMessages(prev => prev.map(msg => msg.id === updatedMsg.id ? updatedMsg : msg)); }
        }).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [conversationId, viewMode]);

    useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);
    useEffect(() => { if (toastScrollRef.current) toastScrollRef.current.scrollTop = toastScrollRef.current.scrollHeight; }, [toastMessages]);

    const handleSend = async (content) => {
        setLoading(true); let targetId = conversationId;
        if (!targetId) {
            const { data: newConv } = await supabase.from('conversations').insert({ title: botName, owner_id: userId, app_id: roomId !== 'home' ? roomId : null }).select().single();
            if (newConv) { targetId = newConv.id; await supabase.from('conversation_members').insert({ conversation_id: targetId, user_id: userId }); setThread(targetId); if (onCreated) onCreated(); }
        }
        await supabase.from('messages').insert({ room_id: roomId, conversation_id: targetId, content: content, sender_id: userId, is_bot: false });
        setLoading(false);
    };

    return (
        <div className="flex flex-col h-full min-h-0 relative">
            <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
                {viewMode === 'chat' ? (
                    <div className="flex-1 p-4 overflow-y-auto space-y-4 min-h-0 custom-scrollbar overscroll-contain" ref={scrollRef}>
                        {messages.length > 0 ? (
                            messages.map((msg, idx) => <MessageBubble key={msg.id || idx} msg={msg} botName={botName} onRefresh={handleRefresh} />)
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-4 opacity-40 select-none">
                                <MessageSquare size={64} />
                                <p className="text-sm font-medium">No messages yet. Start the conversation!</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="absolute inset-0 flex flex-col bg-white">
                        <PreviewPane activeApp={activeApp} previewKey={previewKey} />
                        <ChatToasts messages={toastMessages} botName={botName} onRefresh={handleRefresh} scrollRef={toastScrollRef} />
                    </div>
                )}
            </div>
            <ChatInput onSend={handleSend} botName={botName} loading={loading} />
        </div>
    );
}

function extractMessagePreview(content) {
    if (!content) return "";
    if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
        try {
            const json = JSON.parse(content);
            if (json.type === 'text') return json.content || json.text || "Message";
            if (json.type === 'thinking') return "Thinking...";
            if (json.type === 'DATA' || json.type === 'LOGIN_SUCCESS') return "Sent data";
            return json.type || "Message";
        } catch (e) {
            return content;
        }
    }
    return content;
}

function AppList({ apps, conversations, currentId, onSelectThread, onSelectApp }) {
    const containerRef = useRef(null);

    // 1. Prepare Data
    const appMap = apps.reduce((acc, app) => ({ ...acc, [app.id]: app }), {});
    
    // Threads: All existing conversations sorted by update time
    const threads = conversations.map(c => ({
        type: 'thread',
        id: c.id,
        data: c,
        app: appMap[c.app_id] || { name: 'Unknown', id: 'unknown' }
    })).sort((a, b) => new Date(b.data.updated_at) - new Date(a.data.updated_at));

    // Placeholders: Apps that have NO conversations yet
    const usedAppIds = new Set(conversations.map(c => c.app_id));
    const placeholders = apps.filter(a => !usedAppIds.has(a.id)).map(a => ({
        type: 'app',
        id: a.id,
        data: a,
        app: a
    }));

    const displayList = [...threads, ...placeholders];

    return (
        <div ref={containerRef} className="flex-1 flex flex-col min-h-0 bg-surface overflow-y-auto custom-scrollbar">
            <div className="p-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-zinc-100">Chats</h2>
                <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">{threads.length} Active</div>
            </div>
            <div className="flex-1 px-2 space-y-1 pb-4">
                {displayList.map(item => {
                    const isThread = item.type === 'thread';
                    const isActive = currentId === item.id; // Only threads have IDs that match currentId usually, but we handle logic below
                    const app = item.app;
                    
                    let title = app.name;
                    let subtitle = "";
                    let time = "";
                    let prefix = "";

                    if (isThread) {
                        const conv = item.data;
                        title = conv.title || app.name; // Use conversation title if available
                        time = formatRelativeTime(conv.updated_at);
                        if (conv.last_message) {
                            prefix = !conv.last_message.is_bot ? 'You: ' : '';
                            subtitle = extractMessagePreview(conv.last_message.content);
                        } else {
                            subtitle = "No messages";
                        }
                    } else {
                        // Placeholder
                        subtitle = "Start a new conversation";
                        prefix = "";
                    }

                    return (
                        <div 
                            key={`${item.type}-${item.id}`} 
                            onClick={() => isThread ? onSelectThread(item.data) : onSelectApp(item.data)} 
                            className={`group flex items-center gap-3 px-3 py-3 rounded-2xl cursor-pointer transition-all ${isActive ? 'bg-blue-600/10' : 'hover:bg-white/5'}`}
                        >
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isActive ? 'bg-blue-600 text-white' : (isThread ? 'bg-zinc-800 text-zinc-500' : 'bg-zinc-800/50 text-zinc-600 border border-dashed border-zinc-700')}`}>
                                {isThread ? <Bot size={24} /> : <Plus size={20} />}
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                                <div className="flex items-center justify-between mb-0.5">
                                    <span className={`text-sm font-bold truncate ${isActive ? 'text-white' : (isThread ? 'text-zinc-200' : 'text-zinc-400')}`}>
                                        {title}
                                    </span>
                                    {time && <span className="text-[10px] text-zinc-500">{time}</span>}
                                </div>
                                <p className={`text-xs truncate ${isThread ? 'text-zinc-500' : 'text-blue-400/80'}`}>
                                    {prefix + subtitle}
                                </p>
                            </div>
                        </div>
                    );
                })}

                {displayList.length === 0 && (
                    <div className="p-4 text-center text-zinc-500 text-sm">
                        No apps available.
                    </div>
                )}
            </div>
        </div>
    );
}

function ChatHeader({ title, onBack, isMobile, onNewThread, viewMode, onToggleMode }) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    
    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="h-14 border-b border-white/5 bg-surface flex items-center justify-between px-4 shrink-0 sticky top-0 z-20">
            <div className="flex items-center gap-3 min-w-0">
                {isMobile && <button onClick={onBack} className="p-2 -ml-2 hover:bg-white/5 rounded-full text-zinc-400 hover:text-white transition-colors"><ArrowLeft size={20} /></button>}
                <div className="flex items-center gap-3 min-w-0">
                     <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-white/5 shrink-0"><Bot size={16} className="text-blue-400" /></div>
                     <h2 className="text-sm font-semibold text-zinc-100 truncate">{title || "Chat"}</h2>
                </div>
            </div>
            <div className="flex items-center gap-1 relative">
                 <button onClick={handleShare} className={`p-2 rounded-lg transition-colors ${copied ? 'text-green-400' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`} title="Copy Link">{copied ? <Check size={18} /> : <Share2 size={18} />}</button>
                 <button onClick={onToggleMode} className={`p-2 rounded-lg transition-all ${viewMode === 'app' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`} title={viewMode === 'app' ? "View Chat" : "View App"}>{viewMode === 'app' ? <MessageSquare size={18} /> : <Eye size={18} />}</button>
                 <button onClick={() => setIsMenuOpen(!isMenuOpen)} className={`p-2 rounded-lg transition-colors ${isMenuOpen ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}><MoreVertical size={18} /></button>
                 <AnimatePresence>{isMenuOpen && (<><div className="fixed inset-0 z-30" onClick={() => setIsMenuOpen(false)}></div><motion.div initial={{ opacity: 0, scale: 0.95, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -10 }} className="absolute right-0 top-full mt-2 w-48 bg-surface border border-white/10 rounded-xl shadow-2xl z-40 overflow-hidden"><button onClick={() => { onNewThread(); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors"><Plus size={16} /><span>New Thread</span></button></motion.div></>)}</AnimatePresence>
            </div>
        </div>
    );
}

function PlaceholderState() {
    return <div className="flex-1 flex flex-col items-center justify-center bg-background text-zinc-600 gap-4 p-8 text-center select-none"><div className="w-32 h-32 rounded-3xl bg-surface border border-white/5 flex items-center justify-center shadow-2xl shadow-black/50 rotate-3"><MessageSquare size={48} className="text-zinc-500" /></div><div className="max-w-md space-y-2"><h2 className="text-xl font-semibold text-zinc-200">Welcome to Heyx</h2><p className="text-sm">Select an app to start a conversation.</p></div></div>;
}

function JoinOverlay() {
    const { currentConversationId, joinConversation, supabase } = useConversation();
    const [title, setTitle] = useState("Loading...");
    const [joining, setJoining] = useState(false);
    useEffect(() => {
        const fetchTitle = async () => { const { data } = await supabase.from('conversations').select('title').eq('id', currentConversationId).single(); if (data) setTitle(data.title); };
        fetchTitle();
    }, [currentConversationId]);
    const handleJoin = async () => { setJoining(true); await joinConversation(currentConversationId); setJoining(false); };
    return (
        <div className="absolute inset-0 z-40 bg-[#0c0c0e]/80 backdrop-blur-md flex items-center justify-center p-6 text-center">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-sm w-full bg-[#18181b] border border-white/10 rounded-2xl p-8 shadow-2xl" ><div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6"><Users size={32} className="text-blue-400" /></div><h2 className="text-xl font-bold text-zinc-100 mb-2">Join Conversation?</h2><p className="text-sm text-zinc-400 mb-8 font-medium italic">"{title}"</p><button onClick={handleJoin} disabled={joining} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 disabled:opacity-50" >{joining ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}Join Chat</button></motion.div>
        </div>
    );
}

function App() {
    const { userId, currentConversationId, setThread, needsJoin, loading: contextLoading, refreshConversations, conversations } = useConversation();
    const { route, navigate } = useRouter();
    const [isMobile, setIsMobile] = useState(false);
    const [apps, setApps] = useState([]);
    const [viewMode, setViewMode] = useState('chat');
    const [activeApp, setActiveApp] = useState(null);

    useEffect(() => { if (route.params.id && route.params.id !== currentConversationId) setThread(route.params.id); }, [route.params.id]);
    useEffect(() => { if (currentConversationId && conversations.length > 0 && apps.length > 0) { const current = conversations.find(c => c.id === currentConversationId); if (current && current.app_id) { const app = apps.find(a => a.id === current.app_id); if (app) setActiveApp(app); } } }, [currentConversationId, conversations, apps]);
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile(); window.addEventListener('resize', checkMobile);
        fetch('./apps.json?t=' + Date.now()).then(r => r.json()).then(setApps).catch(console.error);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const handleSelectThread = (thread) => {
        setThread(thread.id);
        navigate('chat', { id: thread.id });
    };

    const handleNewThread = async (app) => {
        if (!app) return;
        const { data: newConv, error } = await supabase.from('conversations').insert({ title: app.name, owner_id: userId, app_id: app.id }).select().single();
        if (error) {
             console.error("Failed to create thread:", error);
             return;
        }
        if (newConv) { 
            const { error: memberError } = await supabase.from('conversation_members').insert({ conversation_id: newConv.id, user_id: userId });
            if (memberError) {
                console.error("Failed to add member to new thread:", memberError);
                return;
            }
            await refreshConversations(); 
            setThread(newConv.id); 
            navigate('chat', { id: newConv.id }); 
        }
    };

    if (contextLoading) return <div className="h-screen w-screen flex items-center justify-center bg-[#0c0c0e] fixed inset-0 z-[100]"><div className="relative"><div className="absolute inset-0 bg-purple-500/20 blur-3xl rounded-full"></div><Loader2 size={32} className="animate-spin text-purple-500 relative" /></div></div>;

    const showList = !isMobile || route.view === 'list';
    const showChat = !isMobile || route.view === 'chat';

    return (
        <div className="fixed inset-0 h-[100dvh] w-screen overflow-hidden bg-background font-inter flex">
            <AnimatePresence mode="wait">
                {showList && (
                    <motion.div key="sidebar" initial={isMobile ? { x: -300, opacity: 0 } : false} animate={{ x: 0, opacity: 1 }} exit={isMobile ? { x: -300, opacity: 0 } : false} transition={{ type: "spring", stiffness: 300, damping: 30 }} className={`flex flex-col border-r border-white/5 bg-surface h-full z-10 shrink-0 ${isMobile ? 'w-full absolute inset-0' : 'w-[320px] relative'}`}>
                        <AppList apps={apps} conversations={conversations} currentId={currentConversationId} onSelectThread={handleSelectThread} onSelectApp={handleNewThread} />
                    </motion.div>
                )}
            </AnimatePresence>
            <AnimatePresence mode="wait">
                {showChat && (
                    <motion.div key="chat" initial={isMobile ? { x: 300, opacity: 0 } : false} animate={{ x: 0, opacity: 1 }} exit={isMobile ? { x: 300, opacity: 0 } : false} transition={{ type: "spring", stiffness: 300, damping: 30 }} className={`flex flex-col flex-1 bg-background h-full relative overflow-hidden ${isMobile ? 'w-full absolute inset-0 z-20' : 'flex'}`}>
                        {needsJoin && <JoinOverlay />}
                        {currentConversationId ? (
                             <><ChatHeader title={activeApp?.name} onBack={() => navigate('list')} isMobile={isMobile} onNewThread={() => handleNewThread(activeApp)} viewMode={viewMode} onToggleMode={() => setViewMode(v => v === 'chat' ? 'app' : 'chat')} />
                                <ChatInterface activeApp={activeApp} userId={userId} conversationId={currentConversationId} setThread={setThread} onCreated={refreshConversations} viewMode={viewMode} />
                             </>
                        ) : <PlaceholderState />}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

const root = createRoot(document.getElementById("root"));
root.render(<ConversationProvider><App /></ConversationProvider>);

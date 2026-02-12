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
    Settings,
    EyeOff
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
    else if (json.action) details = `• ${json.action}`;

    const label = json.type || json.action || "System Message";
    
    return (
        <div className="my-2 rounded-lg border border-purple-500 bg-black/40 overflow-hidden font-mono text-xs text-left shadow-sm">
             <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div><span className="font-bold text-purple-300">{label}</span></div>
                <div className="flex items-center gap-2"><span className="text-[10px] text-zinc-400 truncate max-w-[150px]">{details}</span><ChevronDown size={14} className={`text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} /></div>
            </button>
            {isOpen && <div className="border-t border-purple-500/20 bg-black/60 p-3 overflow-x-auto"><pre className="text-purple-200 whitespace-pre-wrap">{JSON.stringify(json, null, 2)}</pre></div>}
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
            if (json.type || json.action) return <ProtocolMessage json={json} />;
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
    if (typeof localStorage !== 'undefined' && localStorage.getItem('debug_mode') === 'true') return false;
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

function BottomControls({ viewMode, onSend, botName, loading, headerProps, showSystemMessages, onToggleSystemMessages }) {
    const [input, setInput] = useState("");
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    
    const { onBack, isMobile, onNewThread, onToggleMode } = headerProps;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;
        onSend(input); setInput("");
    };

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        setIsMenuOpen(false);
    };

    return (
        <div className="p-3 border-t border-white/5 shrink-0 bg-surface relative z-40 flex items-center gap-2">
             {isMobile && (
                <button onClick={onBack} className="p-2 -ml-1 hover:bg-white/5 rounded-full text-zinc-400 hover:text-white transition-colors">
                    <ArrowLeft size={20} />
                </button>
             )}
             
             <form onSubmit={handleSubmit} className="flex-1 relative flex items-center gap-2 min-w-0">
                <input 
                    type="text" value={input} onChange={(e) => setInput(e.target.value)} 
                    placeholder={`Message ${botName}...`} 
                    className="flex-1 bg-black/20 border border-white/10 rounded-xl pl-3 pr-10 py-2.5 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all text-zinc-200 min-w-0" 
                />
                <button type="submit" disabled={loading || !input.trim()} className="absolute right-1 p-1.5 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-blue-400 disabled:opacity-50">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
            </form>

            <div className="flex items-center gap-1 shrink-0 relative">
                <button onClick={onToggleMode} className={`p-2 rounded-lg transition-colors ${viewMode === 'app' ? 'bg-blue-600/20 text-blue-400' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`} title={viewMode === 'app' ? "Back to Chat" : "Preview App"}>
                    {viewMode === 'app' ? <MessageSquare size={20} /> : <Eye size={20} />} 
                </button>
                
                <button onClick={() => setIsMenuOpen(!isMenuOpen)} className={`p-2 rounded-lg transition-colors ${isMenuOpen ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>
                    <MoreVertical size={20} />
                </button>

                <AnimatePresence>
                    {isMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-30" onClick={() => setIsMenuOpen(false)}></div>
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95, y: 10 }} 
                                animate={{ opacity: 1, scale: 1, y: 0 }} 
                                exit={{ opacity: 0, scale: 0.95, y: 10 }} 
                                className="absolute right-0 bottom-full mb-2 w-48 bg-surface border border-white/10 rounded-xl shadow-2xl z-40 overflow-hidden py-1"
                            >
                                <button onClick={() => { onNewThread(); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors">
                                    <Plus size={16} /><span>New Thread</span>
                                </button>
                                <button onClick={handleShare} className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors">
                                    {copied ? <Check size={16} className="text-green-400"/> : <Share2 size={16} />}
                                    <span>{copied ? "Copied!" : "Share Link"}</span>
                                </button>
                                <div className="h-px bg-white/10 my-1"></div>
                                <button onClick={() => { onToggleSystemMessages(); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors">
                                    {showSystemMessages ? <EyeOff size={16} /> : <Eye size={16} />}
                                    <span>{showSystemMessages ? "Hide System Msgs" : "Show System Msgs"}</span>
                                </button>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </div>
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

// --- Components: Skeletons ---

function SkeletonMessage({ align }) {
    const isRight = align === 'right';
    return (
        <div className={`flex gap-3 w-full mb-6 ${isRight ? 'justify-end' : 'justify-start'}`}>
            <div className={`w-8 h-8 rounded-full shrink-0 bg-zinc-800/50 ${isRight ? 'order-2 hidden md:flex' : 'order-1'} animate-pulse`} />
            <div className={`max-w-[85%] md:max-w-[75%] space-y-2 ${isRight ? 'order-1 items-end' : 'order-2 items-start'} flex flex-col`}>
                <div className={`h-3 w-20 bg-zinc-800/50 rounded-md animate-pulse ${isRight ? 'mr-1' : 'ml-1'}`} />
                <div className={`p-4 rounded-2xl ${isRight ? 'bg-blue-900/10 rounded-tr-sm' : 'bg-zinc-800/30 rounded-tl-sm'} w-[280px] sm:w-[350px] space-y-3`}>
                    <div className="h-3 w-[90%] bg-white/5 rounded-md animate-pulse" />
                    <div className="h-3 w-[70%] bg-white/5 rounded-md animate-pulse" />
                    <div className="h-3 w-[40%] bg-white/5 rounded-md animate-pulse" />
                </div>
            </div>
        </div>
    );
}

function ChatSkeleton() {
    return (
        <div className="flex-1 p-4 overflow-hidden space-y-6">
            <SkeletonMessage align="left" />
            <SkeletonMessage align="right" />
            <SkeletonMessage align="left" />
            <SkeletonMessage align="right" />
            <SkeletonMessage align="left" />
        </div>
    );
}

function PreviewPane({ activeApp, previewKey, conversationId, userId, activeConversation }) {
    if (!activeApp) return <div className="flex-1 flex flex-col items-center justify-center bg-[#0c0c0e] text-zinc-600 gap-4 p-4 text-center"><div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center"><Layout size={32} /></div><p className="text-sm">Select an app to preview</p></div>;
    try {
        const url = new URL(activeApp.path, window.location.href);
        if (conversationId) url.searchParams.set('cid', conversationId);
        if (userId) url.searchParams.set('uid', userId);
        if (activeConversation && activeConversation.title) url.searchParams.set('title', activeConversation.title);
        return <iframe key={previewKey} src={url.toString()} className="flex-1 w-full h-full border-0 bg-white" title="Preview" />;
    } catch (e) {
        console.error("Preview URL Error:", e);
        return <div className="flex-1 flex items-center justify-center text-red-500">Error loading app preview</div>;
    }
}

function ChatInterface({ activeApp, userId, conversationId, setThread, onCreated, viewMode, headerProps, activeConversation }) {
    const [messages, setMessages] = useState([]);
    const [toastMessages, setToastMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [previewKey, setPreviewKey] = useState(0);
    const [showSystemMessages, setShowSystemMessages] = useState(false);
    const scrollRef = useRef(null);
    const toastScrollRef = useRef(null);
    const messageCache = useRef({}); // Cache: { conversationId: [messages] (Newest First) }
    const viewModeRef = useRef(viewMode);
    
    const roomId = activeApp ? activeApp.id : 'home';
    const botName = activeApp ? activeApp.name : 'Alex';
    const handleRefresh = () => setPreviewKey(k => k + 1);

    useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);
    useEffect(() => { if (viewMode === 'chat') setToastMessages([]); }, [viewMode]);

    useEffect(() => {
        if (!conversationId) {
            setMessages([]);
            setFetching(false);
            return;
        }

        // 1. Optimistic Load from Cache
        const cached = messageCache.current[conversationId];
        if (cached) {
            setMessages(cached);
            setFetching(true); 
        } else {
            setMessages([]);
            setFetching(true); 
        }

        // 2. Fetch & Subscribe
        let mounted = true;
        const fetchRecent = async () => {
            const { data } = await supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(50);
            if (mounted && data) { 
                setMessages(data);
                messageCache.current[conversationId] = data; 
            }
            if (mounted) setFetching(false);
        };
        fetchRecent();

        const channel = supabase.channel(`public:messages:${conversationId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
            const newMsg = payload.new;
            setMessages(prev => {
                const next = [newMsg, ...prev]; // Prepend newest
                messageCache.current[conversationId] = next; 
                return next;
            });
            if (viewModeRef.current !== 'chat' && newMsg.sender_id !== userId) {
                if (!shouldHideMessage(newMsg)) {
                    setToastMessages(prev => [...prev, newMsg]);
                    setTimeout(() => { setToastMessages(current => current.filter(m => m.id !== newMsg.id)); }, 8000);
                }
            }
        }).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
            const updatedMsg = payload.new; 
            setMessages(prev => {
                const next = prev.map(msg => msg.id === updatedMsg.id ? updatedMsg : msg);
                messageCache.current[conversationId] = next;
                return next;
            });
             setToastMessages(prev => prev.map(msg => msg.id === updatedMsg.id ? updatedMsg : msg)); 
        }).on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
            const deletedId = payload.old.id;
            setMessages(prev => {
                const next = prev.filter(msg => msg.id !== deletedId);
                messageCache.current[conversationId] = next;
                return next;
            });
            setToastMessages(prev => prev.filter(msg => msg.id !== deletedId));
        }).subscribe();

        return () => { 
            mounted = false;
            supabase.removeChannel(channel); 
        };
    }, [conversationId]);

    useLayoutEffect(() => { if (toastScrollRef.current) toastScrollRef.current.scrollTop = toastScrollRef.current.scrollHeight; }, [toastMessages]);

    const handleSend = async (content) => {
        setLoading(true); let targetId = conversationId;
        if (!targetId) {
            const { data: newConv } = await supabase.from('conversations').insert({ title: botName, owner_id: userId, app_id: roomId !== 'home' ? roomId : null }).select().single();
            if (newConv) { targetId = newConv.id; await supabase.from('conversation_members').insert({ conversation_id: targetId, user_id: userId }); setThread(targetId); if (onCreated) onCreated(); }
        }
        await supabase.from('messages').insert({ room_id: roomId, conversation_id: targetId, content: content, sender_id: userId, is_bot: false });
        setLoading(false);
    };

    const displayMessages = showSystemMessages ? messages : messages.filter(m => !shouldHideMessage(m));

    return (
        <div className="flex flex-col h-full min-h-0 relative">
            <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
                <div className={`absolute inset-0 flex flex-col bg-background transition-opacity duration-200 ${viewMode === 'chat' ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'}`}>
                     <div className="flex-1 overflow-hidden flex flex-col relative">
                        {fetching && messages.length > 0 && (
                            <div className="absolute top-0 left-0 right-0 z-20 flex justify-center py-2 pointer-events-none">
                                <div className="bg-zinc-800/80 backdrop-blur text-xs text-zinc-400 px-3 py-1 rounded-full shadow-lg flex items-center gap-2 border border-white/5">
                                    <Loader2 size={10} className="animate-spin" />
                                    <span>Syncing...</span>
                                </div>
                            </div>
                        )}
                        <div className="flex-1 p-4 overflow-y-auto min-h-0 custom-scrollbar overscroll-contain flex flex-col gap-4" ref={scrollRef} style={{ transform: 'scaleY(-1)' }}>
                            {displayMessages.length > 0 ? (
                                displayMessages.map((msg, idx) => (
                                    <div key={msg.id || idx} style={{ transform: 'scaleY(-1)' }}>
                                        <MessageBubble msg={msg} botName={botName} onRefresh={handleRefresh} />
                                    </div>
                                ))
                            ) : fetching ? (
                                <div style={{ transform: 'scaleY(-1)' }}><ChatSkeleton /></div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-4 opacity-40 select-none" style={{ transform: 'scaleY(-1)' }}>
                                    <MessageSquare size={64} />
                                    <p className="text-sm font-medium">No messages yet. Start the conversation!</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className={`absolute inset-0 flex flex-col bg-white transition-opacity duration-200 ${viewMode === 'app' ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'}`}>
                    <PreviewPane activeApp={activeApp} previewKey={previewKey} conversationId={conversationId} userId={userId} activeConversation={activeConversation} />
                    <ChatToasts messages={toastMessages} botName={botName} onRefresh={handleRefresh} scrollRef={toastScrollRef} />
                </div>
            </div>
            <BottomControls viewMode={viewMode} onSend={handleSend} botName={botName} loading={loading} headerProps={headerProps} showSystemMessages={showSystemMessages} onToggleSystemMessages={() => setShowSystemMessages(!showSystemMessages)} />
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

function ContextMenu({ x, y, onDelete, onClose }) {
    useEffect(() => {
        const handleClick = () => onClose();
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, [onClose]);

    return (
        <div 
            className="fixed z-50 bg-[#18181b] border border-white/10 rounded-xl shadow-2xl py-1 w-48 overflow-hidden"
            style={{ top: y, left: x }}
            onClick={(e) => e.stopPropagation()} 
        >
            <button 
                onClick={() => { onDelete(); onClose(); }} 
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-red-400 hover:bg-white/5 transition-colors"
            >
                <Trash2 size={16} />
                <span>Delete Conversation</span>
            </button>
        </div>
    );
}

function AppList({ apps, conversations, currentId, onSelectThread, onSelectApp, onDeleteThread }) {
    const containerRef = useRef(null);
    const [contextMenu, setContextMenu] = useState(null);

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

    const handleContextMenu = (e, thread) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, threadId: thread.id });
    };

    return (
        <div ref={containerRef} className="flex-1 flex flex-col min-h-0 bg-surface overflow-y-auto custom-scrollbar">
            {contextMenu && (
                <ContextMenu 
                    x={contextMenu.x} 
                    y={contextMenu.y} 
                    onDelete={() => onDeleteThread(contextMenu.threadId)} 
                    onClose={() => setContextMenu(null)} 
                />
            )}
            <div className="p-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-zinc-100">Chats</h2>
                <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">{threads.length} Active</div>
            </div>
            <div className="flex-1 px-2 space-y-1 pb-4">
                {displayList.map(item => {
                    const isThread = item.type === 'thread';
                    const isActive = currentId === item.id; 
                    const app = item.app;
                    
                    let title = app.name;
                    let subtitle = "";
                    let time = "";
                    let prefix = "";

                    if (isThread) {
                        const conv = item.data;
                        title = conv.title || app.name; 
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
                            onContextMenu={(e) => isThread ? handleContextMenu(e, item.data) : null}
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
    const { userId, currentConversationId, setThread, needsJoin, loading: contextLoading, refreshConversations, conversations, deleteConversation } = useConversation();
    const { route, navigate } = useRouter();
    const [isMobile, setIsMobile] = useState(false);
    const [apps, setApps] = useState([]);
    const [viewMode, setViewMode] = useState('app');

    // Derived state for active app to ensure immediate sync (no flickering)
    const activeConversation = conversations.find(c => c.id === currentConversationId);
    const activeApp = activeConversation && activeConversation.app_id 
        ? apps.find(a => a.id === activeConversation.app_id) 
        : null;

    useEffect(() => { if (route.params.id && route.params.id !== currentConversationId) setThread(route.params.id); }, [route.params.id]);
    
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
                        <AppList apps={apps} conversations={conversations} currentId={currentConversationId} onSelectThread={handleSelectThread} onSelectApp={handleNewThread} onDeleteThread={deleteConversation} />
                    </motion.div>
                )}
            </AnimatePresence>
            <AnimatePresence mode="wait">
                {showChat && (
                    <motion.div key="chat" initial={isMobile ? { x: 300, opacity: 0 } : false} animate={{ x: 0, opacity: 1 }} exit={isMobile ? { x: 300, opacity: 0 } : false} transition={{ type: "spring", stiffness: 300, damping: 30 }} className={`flex flex-col flex-1 bg-background h-full relative overflow-hidden ${isMobile ? 'w-full absolute inset-0 z-20' : 'flex'}`}>
                        {needsJoin && <JoinOverlay />}
                        {currentConversationId ? (
                             <ChatInterface 
                                activeApp={activeApp} 
                                userId={userId} 
                                conversationId={currentConversationId} 
                                setThread={setThread} 
                                onCreated={refreshConversations} 
                                viewMode={viewMode}
                                activeConversation={activeConversation}
                                headerProps={{
                                    title: activeApp?.name,
                                    onBack: () => navigate('list'),
                                    isMobile: isMobile,
                                    onNewThread: () => handleNewThread(activeApp),
                                    onToggleMode: () => setViewMode(v => v === 'chat' ? 'app' : 'chat')
                                }}
                             />
                        ) : <PlaceholderState />}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

const root = createRoot(document.getElementById("root"));
root.render(<ConversationProvider><App /></ConversationProvider>);

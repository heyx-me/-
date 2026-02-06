import React, { useState, useEffect, useRef } from "react";
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
    Users
} from "lucide-react";

// --- Configuration ---
const SUPABASE_URL = 'https://gsyozgedljmcpsysstpz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_FJI1hrANejiwsKll-G4zMQ_wRR-Surp'; 

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        persistSession: false
    }
});

function GitManager({ isOpen, onClose }) {
    const [status, setStatus] = useState(null);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(false);
    const [commitMessage, setCommitMessage] = useState("");
    const [newBranch, setNewBranch] = useState("");
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [mode, setMode] = useState('commit'); // 'commit' | 'branch'

    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen]);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [statusRes, branchesRes] = await Promise.all([
                fetch('/api/git/status').then(r => r.json()),
                fetch('/api/git/branches').then(r => r.json())
            ]);
            setStatus(statusRes);
            setBranches(branchesRes.branches || []);
        } catch (e) {
            setError("Failed to load git data");
        } finally {
            setLoading(false);
        }
    };

    const handleCommit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/git/commit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: commitMessage })
            });
            const data = await res.json();
            if (data.success) {
                setSuccess("Committed successfully!");
                setCommitMessage("");
                fetchData();
                setTimeout(() => setSuccess(null), 3000);
            } else {
                setError(data.error || "Commit failed");
            }
        } catch (e) {
            setError("Commit failed");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateBranch = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/git/branch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ branch: newBranch })
            });
            const data = await res.json();
            if (data.success) {
                setSuccess(`Created branch ${newBranch}`);
                setNewBranch("");
                fetchData();
                setTimeout(() => setSuccess(null), 3000);
            } else {
                setError(data.error || "Branch creation failed");
            }
        } catch (e) {
            setError("Branch creation failed");
        } finally {
            setLoading(false);
        }
    };

    const handleCheckout = async (branchName) => {
        setLoading(true);
        try {
            const res = await fetch('/api/git/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ branch: branchName })
            });
            const data = await res.json();
            if (data.success) {
                fetchData();
            } else {
                setError(data.error || "Checkout failed");
            }
        } catch (e) {
            setError("Checkout failed");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-[#18181b] w-full max-w-md rounded-xl border border-white/10 shadow-2xl flex flex-col max-h-[80vh]">
                <div className="flex items-center justify-between p-4 border-b border-white/5">
                    <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                        <GitBranch size={16} className="text-purple-400" />
                        Git Manager
                    </h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
                        <X size={16} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-400 text-xs rounded-lg">
                            {success}
                        </div>
                    )}

                    <div className="flex gap-2 p-1 bg-black/20 rounded-lg">
                        <button 
                            onClick={() => setMode('commit')}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${mode === 'commit' ? 'bg-purple-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            Commit
                        </button>
                        <button 
                            onClick={() => setMode('branch')}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${mode === 'branch' ? 'bg-purple-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            Branches
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 size={24} className="animate-spin text-purple-500" />
                        </div>
                    ) : mode === 'commit' ? (
                        <div className="space-y-4">
                            <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                                <h3 className="text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">Changes</h3>
                                <pre className="text-xs font-mono text-zinc-300 whitespace-pre-wrap max-h-32 overflow-y-auto">
                                    {status?.output || "No changes detected"}
                                </pre>
                            </div>
                            
                            <form onSubmit={handleCommit} className="space-y-3">
                                <textarea
                                    value={commitMessage}
                                    onChange={(e) => setCommitMessage(e.target.value)}
                                    placeholder="Commit message..."
                                    className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-sm focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 text-zinc-200 h-24 resize-none"
                                />
                                <button 
                                    type="submit"
                                    disabled={loading || !commitMessage.trim()}
                                    className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    <Check size={16} />
                                    Commit Changes
                                </button>
                            </form>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <form onSubmit={handleCreateBranch} className="flex gap-2">
                                <input
                                    type="text"
                                    value={newBranch}
                                    onChange={(e) => setNewBranch(e.target.value)}
                                    placeholder="New branch name..."
                                    className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500/50 text-zinc-200"
                                />
                                <button 
                                    type="submit"
                                    disabled={loading || !newBranch.trim()}
                                    className="bg-white/10 hover:bg-white/20 p-2 rounded-lg text-zinc-200"
                                >
                                    <Plus size={18} />
                                </button>
                            </form>

                            <div className="space-y-1">
                                {branches.map((b) => (
                                    <div 
                                        key={b.name} 
                                        className={`flex items-center justify-between p-2.5 rounded-lg border ${b.current ? 'bg-purple-500/10 border-purple-500/20' : 'bg-black/20 border-transparent hover:bg-white/5'}`}
                                    >
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <GitBranch size={14} className={b.current ? "text-purple-400" : "text-zinc-500"} />
                                            <span className={`text-sm truncate ${b.current ? "text-purple-200 font-medium" : "text-zinc-400"}`}>
                                                {b.name}
                                            </span>
                                        </div>
                                        {!b.current && (
                                            <button 
                                                onClick={() => handleCheckout(b.name)}
                                                className="text-xs bg-white/5 hover:bg-white/10 px-2 py-1 rounded text-zinc-400 hover:text-zinc-200 transition-colors"
                                            >
                                                Checkout
                                            </button>
                                        )}
                                        {b.current && <span className="text-[10px] text-purple-400 px-2">Current</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// --- Components for Code Updates ---

function UpdateCard({ path, content, timestamp, onApply }) {
    const [status, setStatus] = useState('pending'); // pending, applied, skipped, error

    useEffect(() => {
        let mounted = true;
        const applyUpdate = async () => {
            try {
                // Convert ISO string to epoch if needed
                const ts = timestamp ? new Date(timestamp).getTime() : Date.now();
                const applied = await saveFileOverride(path, content, ts);
                
                if (mounted) {
                    if (applied) {
                        setStatus('applied');
                        if (onApply) onApply();
                    } else {
                        setStatus('skipped'); // Older than current version
                    }
                }
            } catch (e) {
                console.error("Auto-apply failed:", e);
                if (mounted) setStatus('error');
            }
        };
        applyUpdate();
        return () => { mounted = false; };
    }, [path, content, timestamp]);

    return (
        <div className="mt-2 mb-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-yellow-500/10 bg-yellow-500/10">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${status === 'applied' ? 'bg-green-500 animate-pulse' : 'bg-zinc-500'}`}></div>
                    <span className="text-xs font-medium text-yellow-200 font-mono">{path}</span>
                </div>
                <div className="flex items-center gap-2">
                    {status === 'applied' && (
                        <span className="text-[10px] text-green-400 font-medium flex items-center gap-1">
                            <Check size={12} /> Live Preview
                        </span>
                    )}
                    {status === 'skipped' && (
                        <span className="text-[10px] text-zinc-500 font-medium">
                            History
                        </span>
                    )}
                    {status === 'pending' && (
                        <span className="text-[10px] text-yellow-500 font-medium">
                            Syncing...
                        </span>
                    )}
                </div>
            </div>
            <div className="p-2 relative group">
                <pre className="text-[10px] font-mono text-zinc-400 overflow-x-auto p-2 max-h-32 custom-scrollbar">
                    {content}
                </pre>
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/10 pointer-events-none"></div>
            </div>
        </div>
    );
}

function ToolCallCard({ name, status, args }) {
    const [isOpen, setIsOpen] = useState(false);
    
    // Parse args if string
    let parsedArgs = args;
    if (typeof args === 'string') {
        try { parsedArgs = JSON.parse(args); } catch (e) {}
    }

    const iconColor = status === 'success' ? 'text-green-400' : (status === 'running' ? 'text-blue-400' : 'text-red-400');
    const borderColor = status === 'success' ? 'border-green-500/20' : (status === 'running' ? 'border-blue-500/20' : 'border-red-500/20');
    const bgColor = status === 'success' ? 'bg-green-500/5' : (status === 'running' ? 'bg-blue-500/5' : 'bg-red-500/5');

    return (
        <div className={`my-2 rounded-lg border ${borderColor} ${bgColor} overflow-hidden font-mono text-xs`}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between px-3 py-2 ${status === 'running' ? 'animate-pulse' : ''} hover:bg-white/5 transition-colors`}
            >
                <div className="flex items-center gap-2">
                    <Terminal size={14} className={iconColor} />
                    <span className="font-semibold text-zinc-300">{name}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] uppercase tracking-wider ${iconColor}`}>{status}</span>
                    <ChevronDown size={14} className={`text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </button>
            
            {isOpen && (
                <div className="border-t border-white/5 bg-black/20 p-3 overflow-x-auto">
                    <pre className="text-zinc-400 whitespace-pre-wrap">
                        {JSON.stringify(parsedArgs, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}

function detectDirection(text) {
    if (!text) return 'ltr';
    // Clean start of text from common markdown/whitespace to find first meaningful character
    const cleanText = text.trim().replace(/^([#\s\-\*\d\.\>]+)/, '');
    const firstChar = cleanText.charAt(0);
    const rtlRegex = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;
    return rtlRegex.test(firstChar) ? 'rtl' : 'ltr';
}

function MarkdownContent({ content }) {
    const dir = detectDirection(content);
    return (
        <div dir={dir} className={`prose prose-invert prose-sm max-w-none break-words ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
            <ReactMarkdown 
                remarkPlugins={[remarkGfm]} 
                components={{
                    a: ({node, ...props}) => <a {...props} className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer" />,
                    code: ({node, inline, className, children, ...props}) => {
                        return inline ? 
                            <code className="bg-white/10 rounded px-1 py-0.5 text-xs font-mono text-zinc-300" {...props}>{children}</code> :
                            <code className="block bg-black/30 rounded-lg p-3 text-xs font-mono text-zinc-300 overflow-x-auto my-2 whitespace-pre" {...props}>{children}</code>
                    },
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
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}

function TextWithUpdates({ content, timestamp, onApplyUpdate }) {
    // Regex to match <file_update path="...">content</file_update>
    const regex = /<file_update path="(.*?)">([\s\S]*?)<\/file_update>/g;
    
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
        if (match.index > lastIndex) {
            parts.push({ type: 'text', content: content.substring(lastIndex, match.index) });
        }
        parts.push({ type: 'update', path: match[1], content: match[2] });
        lastIndex = regex.lastIndex;
    }

    if (lastIndex < content.length) {
        parts.push({ type: 'text', content: content.substring(lastIndex) });
    }

    if (parts.length === 0) {
        return <MarkdownContent content={content} />;
    }

    return (
        <div className="w-full">
            {parts.map((part, idx) => {
                if (part.type === 'text') {
                    return <MarkdownContent key={idx} content={part.content} />;
                } else {
                    return (
                        <UpdateCard 
                            key={idx} 
                            path={part.path} 
                            content={part.content} 
                            timestamp={timestamp}
                            onApply={onApplyUpdate}
                        />
                    );
                }
            })}
        </div>
    );
}

// --- Localization Helper ---
function useLocales() {
    const [lang, setLang] = useState('en');
    
    useEffect(() => {
        const updateLang = () => {
            const docLang = document.documentElement.lang;
            const navLang = navigator.language || navigator.userLanguage;
            
            if (docLang === 'he' || (navLang && navLang.startsWith('he'))) {
                setLang('he');
            } else {
                setLang('en');
            }
        };

        updateLang();

        const observer = new MutationObserver(updateLang);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

        return () => observer.disconnect();
    }, []);

    const t = (key) => {
        const dict = {
            en: { thinking: "Thinking..." },
            he: { thinking: "חושב..." }
        };
        return dict[lang]?.[key] || dict['en'][key];
    };

    return { t, lang };
}

function ThinkingBubble() {
    const { t, lang } = useLocales();
    return (
        <div className="flex items-center gap-2 py-1 px-2 animate-pulse" dir={lang === 'he' ? 'rtl' : 'ltr'}>
            <Loader2 size={14} className="animate-spin text-purple-400" />
            <span className="text-xs text-zinc-500 italic">{t('thinking')}</span>
        </div>
    );
}

function StatsMetadata({ stats }) {
    if (!stats) return null;
    const total = stats.total_tokens || stats.tokens?.total || 0;
    if (!total) return null;

    return (
        <div className="mt-1 flex justify-end">
            <div className="group relative">
                <div className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400 cursor-pointer transition-colors">
                    <Info size={10} />
                    <span>{total} tokens</span>
                </div>
            </div>
        </div>
    );
}

function ProtocolMessage({ json }) {
    const [isOpen, setIsOpen] = useState(false);
    
    // Determine summary text based on message type
    let summary = json.type;
    let details = "";
    
    if (json.type === 'DATA' || json.type === 'LOGIN_SUCCESS') {
        const itemCount = json.data?.accounts?.length || 0;
        details = `• ${itemCount} Accounts`;
    } else if (json.text) {
        details = `• "${json.text.substring(0, 20)}${json.text.length > 20 ? '...' : ''}"`;
    }

    return (
        <div className="my-2 rounded-lg border border-purple-500/20 bg-purple-500/5 overflow-hidden font-mono text-xs">
             <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                    <span className="font-semibold text-zinc-300">App Message</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-400">{summary} <span className="text-zinc-600">{details}</span></span>
                    <ChevronDown size={14} className={`text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </button>
            {isOpen && (
                 <div className="border-t border-white/5 bg-black/20 p-3 overflow-x-auto">
                    <pre className="text-zinc-400 whitespace-pre-wrap">
                        {JSON.stringify(json, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}

function MessageContent({ content, timestamp, onApplyUpdate }) {
    // 0. Handle Empty Content
    if (!content) return null;

    // 1. Try to parse as App Protocol JSON
    if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
        try {
            const json = JSON.parse(content);
            
            if (json.type === 'thinking') {
                return <ThinkingBubble />;
            }
            
            if (json.type === 'text') {
                if (!json.content) {
                    return <ThinkingBubble />;
                }
                return (
                    <div className="flex flex-col">
                        <MessageContent 
                            content={json.content || ""} 
                            timestamp={timestamp} 
                            onApplyUpdate={onApplyUpdate} 
                        />
                        <StatsMetadata stats={json.stats} />
                    </div>
                );
            }

            if (json.type) {
                return <ProtocolMessage json={json} />;
            }
        } catch (e) {}
    }

    // 2. Standard Text / Tool Processing
    const toolRegex = /<tool_call name="(.*?)" status="(.*?)">([\s\S]*?)<\/tool_call>/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = toolRegex.exec(content)) !== null) {
        if (match.index > lastIndex) {
            parts.push({ type: 'text', content: content.substring(lastIndex, match.index) });
        }
        parts.push({ type: 'tool', name: match[1], status: match[2], args: match[3] });
        lastIndex = toolRegex.lastIndex;
    }
    
    if (lastIndex < content.length) {
        parts.push({ type: 'text', content: content.substring(lastIndex) });
    }

    if (parts.length === 0 && content) {
        parts.push({ type: 'text', content: content });
    }

    return (
        <div className="space-y-1">
            {parts.map((part, idx) => {
                if (part.type === 'tool') {
                    return (
                        <ToolCallCard 
                            key={idx}
                            name={part.name}
                            status={part.status}
                            args={part.args}
                        />
                    );
                } else {
                    return <TextWithUpdates key={idx} content={part.content} timestamp={timestamp} onApplyUpdate={onApplyUpdate} />;
                }
            })}
        </div>
    );
}
function MessageBubble({ msg, botName, onRefresh }) {
    const isBot = msg.is_bot || msg.sender_id === 'alex-bot';
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <div className={`flex gap-3 ${isBot ? '' : 'flex-row-reverse'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border 
                ${isBot ? 'bg-blue-500/20 border-blue-500/30' : 'bg-purple-500/20 border-purple-500/30'}`}>
                {isBot ? <Bot size={14} className="text-blue-400" /> : <User size={14} className="text-purple-400" />}
            </div>
            <div className={`max-w-[85%] space-y-1 ${isBot ? '' : 'items-end flex flex-col'}`}>
                <div className="flex items-baseline gap-2 justify-between">
                    <span className="text-xs font-bold text-zinc-300">{isBot ? botName : 'You'}</span>
                    {isBot && (
                        <button 
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            className="text-zinc-600 hover:text-zinc-400"
                        >
                            <ChevronDown size={12} className={`transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                        </button>
                    )}
                </div>
                {!isCollapsed && (
                    <div className={`text-sm text-zinc-200 leading-relaxed p-3 rounded-lg border 
                        ${isBot 
                            ? 'bg-white/5 rounded-tl-none border-white/5' 
                            : 'bg-purple-600/20 rounded-tr-none border-purple-500/20'}`}>
                        <MessageContent content={msg.content} timestamp={msg.created_at} onApplyUpdate={onRefresh} />
                    </div>
                )}
                {isCollapsed && (
                    <div className="text-xs text-zinc-600 italic">
                        Message collapsed
                    </div>
                )}
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
        
        // Hide User Actions
        if (!msg.is_bot && json.action) return true;

        // Hide Bot Protocol Messages (keep text, thinking, error)
        if (msg.is_bot && json.type && !['text', 'thinking', 'error'].includes(json.type)) {
            return true;
        }
    } catch (e) {
        // Not JSON, keep it
    }
    
    return false;
}

function ChatInterface({ inputOnly = false, activeApp, onRefresh, userId, conversationId, setThread, onCreated }) {
    const [messages, setMessages] = useState([]);
    const [overlayMessages, setOverlayMessages] = useState([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef(null);
    const overlayScrollRef = useRef(null);

    const roomId = activeApp ? activeApp.id : 'home';
    const botName = activeApp ? activeApp.name : 'Alex';

    // Helper to remove overlay message
    const removeOverlayMessage = (id) => {
        setOverlayMessages(prev => prev.filter(m => m.id !== id));
    };

    // Initial load and Subscription
    useEffect(() => {
        setMessages([]); // Clear previous messages when switching rooms
        setOverlayMessages([]); // Clear overlay
        
        if (!conversationId) return;

        const fetchRecent = async () => {
            const { data } = await supabase
                .from('messages')
                .select('*')
                .eq('conversation_id', conversationId) 
                .order('created_at', { ascending: false })
                .limit(20);
            
            if (data) {
                const visible = data.filter(m => !shouldHideMessage(m));
                setMessages(visible.reverse());
            }
        };

        fetchRecent();

        const channel = supabase
            .channel(`public:messages:${conversationId}`)
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'messages', 
                filter: `conversation_id=eq.${conversationId}` 
            }, (payload) => {
                const newMsg = payload.new;
                
                if (!shouldHideMessage(newMsg)) {
                    setMessages(prev => [...prev, newMsg]);
                }
                
                if (inputOnly) {
                    if (!shouldHideMessage(newMsg)) {
                        setOverlayMessages(prev => [...prev, newMsg]);
                    }
                }
            })
            .on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'messages', 
                filter: `conversation_id=eq.${conversationId}` 
            }, (payload) => {
                const updatedMsg = payload.new;
                
                if (shouldHideMessage(updatedMsg)) {
                     setMessages(prev => prev.filter(msg => msg.id !== updatedMsg.id));
                     setOverlayMessages(prev => prev.filter(msg => msg.id !== updatedMsg.id));
                } else {
                    setMessages(prev => prev.map(msg => 
                        msg.id === updatedMsg.id ? updatedMsg : msg
                    ));
                    
                    if (inputOnly) {
                        setOverlayMessages(prev => {
                            const exists = prev.find(m => m.id === updatedMsg.id);
                            if (!exists) return prev; 
                            return prev.map(m => m.id === updatedMsg.id ? updatedMsg : m);
                        });
                    }
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [roomId, inputOnly, conversationId]);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages]);

    useEffect(() => {
        if (overlayScrollRef.current) overlayScrollRef.current.scrollTop = overlayScrollRef.current.scrollHeight;
    }, [overlayMessages]);

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const content = input;
        setInput("");
        setLoading(true);

        let targetConversationId = conversationId;

        // Lazy Creation Logic
        if (!targetConversationId) {
            try {
                const { data: newConv, error: convError } = await supabase
                    .from('conversations')
                    .insert({ title: 'New Chat', owner_id: userId })
                    .select().single();

                if (convError || !newConv) {
                    console.error("Failed to create conversation:", convError);
                    setLoading(false);
                    return;
                }

                targetConversationId = newConv.id;
                await supabase.from('conversation_members').insert({ conversation_id: targetConversationId, user_id: userId });
                setThread(targetConversationId);
                if (onCreated) onCreated();
            } catch (err) {
                console.error("Exception creating conversation:", err);
                setLoading(false);
                return;
            }
        }

        await supabase.from('messages').insert({
            room_id: roomId,
            conversation_id: targetConversationId,
            content: content,
            sender_id: userId,
            is_bot: false
        });

        setLoading(false);
    };

    return (
        <div className={`flex flex-col h-full ${inputOnly ? 'justify-end relative' : ''}`}>
            <div className={`flex-1 p-4 overflow-y-auto space-y-4 min-h-0 ${inputOnly ? 'hidden' : ''}`} ref={scrollRef}>
                {messages.map((msg, idx) => (
                    <MessageBubble key={msg.id || idx} msg={msg} botName={botName} onRefresh={onRefresh} />
                ))}
            </div>

            {inputOnly && (
                <div 
                    ref={overlayScrollRef}
                    className="absolute left-0 right-0 bottom-[70px] z-30 max-h-[60%] flex flex-col overflow-y-auto pointer-events-auto px-4 pb-4 gap-3 scroll-smooth no-scrollbar"
                    style={{
                        maskImage: 'linear-gradient(to bottom, transparent 0%, black 20%, black 100%)',
                        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 20%, black 100%)'
                    }}
                >
                     <div className="mt-auto flex flex-col gap-3 justify-end">
                        <AnimatePresence>
                            {overlayMessages.map((msg) => (
                                <motion.div 
                                    key={msg.id} layout
                                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, x: -100, transition: { duration: 0.2 } }}
                                    drag="x" dragConstraints={{ left: 0, right: 0 }}
                                    onDragEnd={(e, { offset }) => { if (offset.x < -100 || offset.x > 100) removeOverlayMessage(msg.id); }}
                                    className="bg-black/60 backdrop-blur-md rounded-xl border border-white/10 p-3 shadow-xl origin-bottom relative shrink-0"
                                >
                                     <MessageBubble msg={msg} botName={botName} onRefresh={onRefresh} />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                     </div>
                </div>
            )}

            <div className={`p-4 border-t border-white/5 shrink-0 bg-surface ${inputOnly ? 'pointer-events-auto border-t-0 bg-black/60 backdrop-blur-md z-40' : ''}`}>
                <form onSubmit={sendMessage} className="relative">
                    <input 
                        type="text" value={input} onChange={(e) => setInput(e.target.value)}
                        placeholder={`Message ${botName}...`} 
                        className="w-full bg-black/20 border border-white/10 rounded-lg pl-4 pr-10 py-3 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all text-zinc-200 placeholder:text-zinc-600"
                    />
                    <button 
                        type="submit" disabled={loading || !input.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-white/10 rounded-md transition-colors text-zinc-500 hover:text-blue-400 disabled:opacity-50"
                    >
                        <Send size={16} />
                    </button>
                </form>
            </div>
        </div>
    );
}

function AddressBar({ activeApp, onNavigate, onRefresh, onOpenGit }) {
    const [suggestions, setSuggestions] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [apps, setApps] = useState([]);
    const wrapperRef = useRef(null);

    useEffect(() => {
        fetch('./apps.json?t=' + Date.now()).then(r => r.json()).then(data => { setApps(data); setSuggestions(data); }).catch(err => console.error(err));
    }, []);

    useEffect(() => {
        function handleClickOutside(event) { if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setIsOpen(false); }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (app) => { onNavigate(app); setIsOpen(false); };
    const displayText = activeApp ? activeApp.path.replace(/\/index\.html$/, '') : "Select an app...";

    return (
        <div className="relative flex-1 max-w-xl mx-auto md:mx-0" ref={wrapperRef}>
            <div className="flex items-center gap-2 bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 transition-all">
                <button onClick={() => setIsOpen(!isOpen)} className="flex-1 flex items-center gap-2 text-left focus:outline-none">
                    <span className={`flex-1 text-xs font-mono truncate ${activeApp ? 'text-zinc-200' : 'text-zinc-500'}`}>{displayText}</span>
                    <ChevronDown size={14} className={`text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {activeApp && (
                    <div className="flex items-center gap-1 border-l border-white/10 pl-2">
                        <button type="button" onClick={onRefresh} className="p-1 hover:bg-white/10 rounded text-zinc-500 hover:text-blue-400 transition-colors"><RefreshCw size={14} /></button>
                        <a href={activeApp.path} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-white/10 rounded text-zinc-500 hover:text-zinc-300 transition-colors"><ExternalLink size={14} /></a>
                    </div>
                )}
                <button type="button" onClick={onOpenGit} className="p-1 hover:bg-white/10 rounded text-zinc-500 hover:text-purple-400 transition-colors border-l border-white/10 pl-2"><GitBranch size={14} /></button>
            </div>
            {isOpen && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#18181b] border border-white/10 rounded-lg shadow-xl overflow-hidden z-50 max-h-80 overflow-y-auto">
                    <button onClick={() => handleSelect(null)} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/5 text-sm text-zinc-300 transition-colors border-b border-white/5"><Home size={16} className="text-zinc-500" /><span className="font-medium">Home</span></button>
                    {suggestions.map(app => (
                        <button key={app.id} onClick={() => handleSelect(app)} className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/5 text-sm transition-colors ${activeApp?.id === app.id ? 'bg-white/5 text-white' : 'text-zinc-300'}`}>
                            <FolderOpen size={16} className={activeApp?.id === app.id ? "text-blue-400" : "text-blue-500"} />
                            <div className="flex flex-col overflow-hidden"><span className="font-medium truncate">{app.name}</span><span className="text-[10px] text-zinc-500 font-mono truncate">{app.path.replace(/\/index\.html$/, '')}</span></div>
                            {activeApp?.id === app.id && <Check size={14} className="ml-auto text-blue-400" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function PreviewPane({ activeApp, previewKey }) {
    if (!activeApp) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-[#0c0c0e] text-zinc-600 gap-4 p-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center"><Layout size={32} /></div>
                <p className="text-sm">Select an app to preview</p>
            </div>
        );
    }
    return (
        <div className="flex-1 flex flex-col bg-[#0c0c0e] relative overflow-hidden h-full">
            <iframe key={previewKey} src={activeApp.path} className="flex-1 w-full h-full border-0 bg-white" title="Preview" />
        </div>
    );
}

// --- Date Helper ---
function groupConversations(convs) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today); lastWeek.setDate(lastWeek.getDate() - 7);
    const groups = { 'Today': [], 'Yesterday': [], 'Last 7 Days': [], 'Older': [] };
    convs.forEach(c => {
        const date = new Date(c.updated_at);
        if (date >= today) groups['Today'].push(c);
        else if (date >= yesterday) groups['Yesterday'].push(c);
        else if (date >= lastWeek) groups['Last 7 Days'].push(c);
        else groups['Older'].push(c);
    });
    return Object.entries(groups).filter(([_, items]) => items.length > 0);
}

function Sidebar({ isOpen, onClose }) {
    const { conversations, currentConversationId, setThread, deleteConversation, userId } = useConversation();
    const [copying, setCopying] = useState(false);
    const handleCopyId = () => { navigator.clipboard.writeText(userId); setCopying(true); setTimeout(() => setCopying(false), 2000); };
    const grouped = groupConversations(conversations);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[60]" />
                    <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed top-0 left-0 bottom-0 w-[280px] bg-[#0c0c0e] border-r border-white/5 z-[70] flex flex-col shadow-2xl" >
                        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-surface/50">
                            <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2"><MessageSquare size={16} className="text-blue-400" />Chats</h2>
                            <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded-md text-zinc-500 transition-colors"><PanelLeftClose size={18} /></button>
                        </div>
                        <div className="p-3">
                            <button onClick={() => { setThread(null); onClose(); }} className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium text-zinc-200 transition-all group" >
                                <Plus size={16} className="text-zinc-400 group-hover:text-blue-400" />New Chat
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-4">
                            {grouped.map(([title, items]) => (
                                <div key={title} className="space-y-1">
                                    <h3 className="px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{title}</h3>
                                    {items.map(c => (
                                        <div key={c.id} className={`group relative flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${currentConversationId === c.id ? 'bg-blue-600/10 text-blue-100' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`} onClick={() => { setThread(c.id); onClose(); }} >
                                            <MessageSquare size={14} className={currentConversationId === c.id ? "text-blue-400" : "text-zinc-600"} />
                                            <span className="flex-1 text-sm truncate">{c.title}</span>
                                            <button onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded text-zinc-500 hover:text-red-400 transition-all" ><Trash2 size={12} /></button>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                        <div className="p-4 border-t border-white/5 bg-surface/30">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Your ID</span>
                                <button onClick={handleCopyId} className="p-1 hover:bg-white/5 rounded text-zinc-500 hover:text-zinc-200 transition-colors" >{copying ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}</button>
                            </div>
                            <div className="bg-black/40 border border-white/5 rounded p-2 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]"></div>
                                <span className="text-[10px] font-mono text-zinc-500 truncate">{userId}</span>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

function ParticipantAvatars({ conversationId }) {
    const [members, setMembers] = useState([]);
    const { supabase } = useConversation();
    useEffect(() => {
        if (!conversationId) return;
        const fetchMembers = async () => {
            const { data } = await supabase.from('conversation_members').select('user_id').eq('conversation_id', conversationId);
            if (data) setMembers(data);
        };
        fetchMembers();
        const channel = supabase.channel(`members:${conversationId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members', filter: `conversation_id=eq.${conversationId}`}, fetchMembers).subscribe();
        return () => supabase.removeChannel(channel);
    }, [conversationId]);
    return (
        <div className="flex -space-x-2 overflow-hidden px-2">
            {members.slice(0, 3).map((m, i) => (
                <div key={m.user_id} className="inline-block h-6 w-6 rounded-full ring-2 ring-[#18181b] bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-300 select-none" title={m.user_id} style={{ backgroundColor: `hsl(${(parseInt(m.user_id.substring(0,2), 16) % 360)}, 60%, 45%)` }} >
                    {m.user_id.substring(0, 1).toUpperCase()}
                </div>
            ))}
            {members.length > 3 && <div className="inline-block h-6 w-6 rounded-full ring-2 ring-[#18181b] bg-zinc-800 flex items-center justify-center text-[8px] font-bold text-zinc-500">+{members.length - 3}</div>}
        </div>
    );
}

function JoinOverlay() {
    const { currentConversationId, joinConversation, supabase } = useConversation();
    const [title, setTitle] = useState("Loading...");
    const [joining, setJoining] = useState(false);
    useEffect(() => {
        const fetchTitle = async () => {
            const { data } = await supabase.from('conversations').select('title').eq('id', currentConversationId).single();
            if (data) setTitle(data.title);
        };
        fetchTitle();
    }, [currentConversationId]);
    const handleJoin = async () => { setJoining(true); await joinConversation(currentConversationId); setJoining(false); };
    return (
        <div className="absolute inset-0 z-40 bg-[#0c0c0e]/80 backdrop-blur-md flex items-center justify-center p-6 text-center">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-sm w-full bg-[#18181b] border border-white/10 rounded-2xl p-8 shadow-2xl" >
                <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6"><Users size={32} className="text-blue-400" /></div>
                <h2 className="text-xl font-bold text-zinc-100 mb-2">Join Conversation?</h2>
                <p className="text-sm text-zinc-400 mb-8 font-medium italic">"{title}"</p>
                <button onClick={handleJoin} disabled={joining} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 disabled:opacity-50" >
                    {joining ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}Join Chat
                </button>
            </motion.div>
        </div>
    );
}

function App() {
    const { userId, currentConversationId, setThread, needsJoin, loading: contextLoading, refreshConversations, conversations } = useConversation();
    const [activeApp, setActiveApp] = useState(null);
    const [mobileView, setMobileView] = useState('chat');
    const [isGitOpen, setGitOpen] = useState(false);
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [previewKey, setPreviewKey] = useState(0);
    const [apps, setApps] = useState([]);
    const [sharing, setSharing] = useState(false);

    const handleShare = () => {
        const url = new URL(window.location.origin);
        url.searchParams.set('thread', currentConversationId);
        navigator.clipboard.writeText(url.toString());
        setSharing(true);
        setTimeout(() => setSharing(false), 2000);
    };

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        fetch('./apps.json?t=' + Date.now()).then(r => r.json()).then(data => {
            setApps(data);
            const params = new URLSearchParams(window.location.search);
            let foundApp = null;
            let isChat = false;
            for (const key of params.keys()) { if (key === 'chat') isChat = true; else if (key !== 'thread') { const app = data.find(a => a.id === key); if (app) foundApp = app; } }
            if (foundApp) { setActiveApp(foundApp); if (isChat) setMobileView('chat'); else if (window.innerWidth < 768) setMobileView('preview'); }
        }).catch(err => console.error(err));
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        const handlePopState = () => {
            const params = new URLSearchParams(window.location.search);
            let foundApp = null;
            let isChat = false;
            for (const key of params.keys()) { if (key === 'chat') isChat = true; else if (key !== 'thread') { const app = apps.find(a => a.id === key); if (app) foundApp = app; } }
            if (foundApp) { setActiveApp(foundApp); setMobileView(isChat ? 'chat' : 'preview'); } else setActiveApp(null);
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [apps]);

    const handleNavigate = (destination) => {
        let app = typeof destination === 'string' ? { id: 'custom', name: 'Custom', path: destination } : destination;
        setActiveApp(app);
        const url = new URL(window.location);
        const thread = url.searchParams.get('thread');
        const newParams = new URLSearchParams();
        if (thread) newParams.set('thread', thread);
        if (app && app.id && app.id !== 'custom') newParams.set(app.id, '');
        const search = newParams.toString().replace(/=&/g, '&').replace(/=$/, '');
        url.search = search ? '?' + search : '';
        window.history.pushState({}, '', url);
        if (isMobile) setMobileView('preview');
    };

    const handleViewChange = (mode) => {
        setMobileView(mode);
        const url = new URL(window.location);
        const params = new URLSearchParams(url.search);
        if (mode === 'chat') params.set('chat', ''); else params.delete('chat');
        const search = params.toString().replace(/=&/g, '&').replace(/=$/, '');
        url.search = search ? '?' + search : '';
        window.history.replaceState({}, '', url);
    };

    const handleRefresh = () => setPreviewKey(k => k + 1);

    if (contextLoading) {
        return <div className="h-screen w-screen flex items-center justify-center bg-[#0c0c0e]"><div className="relative"><div className="absolute inset-0 bg-purple-500/20 blur-3xl rounded-full"></div><Loader2 size={32} className="animate-spin text-purple-500 relative" /></div></div>;
    }

    return (
        <div className="flex flex-col h-full relative overflow-hidden bg-background">
            <GitManager isOpen={isGitOpen} onClose={() => setGitOpen(false)} />
            <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="h-14 border-b border-white/5 bg-surface flex items-center px-4 gap-2 shrink-0 z-30 shadow-sm">
                 <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-all"><PanelLeftOpen size={20} /></button>
                 <AddressBar activeApp={activeApp} onNavigate={handleNavigate} onRefresh={handleRefresh} onOpenGit={() => setGitOpen(true)} />
                 {currentConversationId && !needsJoin && (
                     <div className="hidden md:flex items-center gap-2 pr-2 border-r border-white/5">
                         <ParticipantAvatars conversationId={currentConversationId} />
                         <button onClick={handleShare} className={`p-2 rounded-lg transition-all flex items-center gap-2 text-xs font-medium ${sharing ? 'text-green-400 bg-green-400/10' : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/5'}`} >{sharing ? <Check size={14} /> : <Share2 size={14} />}<span>Share</span></button>
                     </div>
                 )}
                 <div className="md:hidden flex gap-1 bg-white/5 p-1 rounded-lg shrink-0 border border-white/5">
                    <button onClick={() => handleViewChange('chat')} className={`p-1.5 rounded-md transition-colors ${mobileView === 'chat' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-zinc-400 hover:text-zinc-200'}`}><MessageSquare size={16} /></button>
                    <button onClick={() => handleViewChange('preview')} className={`p-1.5 rounded-md transition-colors ${mobileView === 'preview' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-zinc-400 hover:text-zinc-200'}`}><Eye size={16} /></button>
                 </div>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
                <div className={`flex-col h-full border-r border-white/5 md:w-[400px] md:flex md:bg-surface relative ${mobileView === 'chat' ? 'flex w-full absolute inset-0 z-10 bg-surface' : ''} ${mobileView === 'preview' ? 'flex w-full absolute inset-0 z-20 pointer-events-none bg-transparent' : ''} ${mobileView !== 'chat' && mobileView !== 'preview' ? 'hidden' : ''} md:static md:z-0`}>
                    {needsJoin && <JoinOverlay />}
                    <ChatInterface inputOnly={isMobile && mobileView === 'preview'} activeApp={activeApp} onRefresh={handleRefresh} userId={userId} conversationId={currentConversationId} setThread={setThread} onCreated={refreshConversations} />
                </div>
                <div className={`flex-col h-full bg-[#0c0c0e] flex-1 md:flex ${mobileView === 'preview' ? 'flex w-full absolute inset-0 z-10' : 'hidden'} ${isMobile && mobileView === 'preview' ? 'pb-[78px]' : ''} md:static md:z-0 md:pb-0`}>
                    <PreviewPane activeApp={activeApp} previewKey={previewKey} />
                </div>
            </div>
        </div>
    );
}

const root = createRoot(document.getElementById("root"));
root.render(<ConversationProvider><App /></ConversationProvider>);

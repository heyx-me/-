import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import { saveFileOverride } from "./preview-storage.js";
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
    ChevronDown
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
        return <div className="whitespace-pre-wrap">{content}</div>;
    }

    return (
        <div className="whitespace-pre-wrap">
            {parts.map((part, idx) => {
                if (part.type === 'text') {
                    return <span key={idx}>{part.content}</span>;
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

function MessageContent({ content, timestamp, onApplyUpdate }) {
    // 1. Split by <tool_call>
    const toolRegex = /<tool_call name="(.*?)" status="(.*?)">([\s\S]*?)<\/tool_call>/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = toolRegex.exec(content)) !== null) {
        // Text before tool
        if (match.index > lastIndex) {
            parts.push({ type: 'text', content: content.substring(lastIndex, match.index) });
        }
        
        // Tool
        parts.push({ 
            type: 'tool', 
            name: match[1], 
            status: match[2], 
            args: match[3] 
        });
        
        lastIndex = toolRegex.lastIndex;
    }
    
    // Remaining text
    if (lastIndex < content.length) {
        parts.push({ type: 'text', content: content.substring(lastIndex) });
    }

    if (parts.length === 0) {
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

function ChatInterface({ inputOnly = false, activeApp, onRefresh }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef(null);

    const roomId = activeApp ? activeApp.id : 'home';
    const botName = activeApp ? activeApp.name : 'Alex';

    // Initial load and Subscription
    useEffect(() => {
        setMessages([]); // Clear previous messages when switching rooms
        const fetchRecent = async () => {
            const { data } = await supabase
                .from('messages')
                .select('*')
                .eq('room_id', roomId) 
                .order('created_at', { ascending: false })
                .limit(20);
            
            if (data) setMessages(data.reverse());
        };

        fetchRecent();

        const channel = supabase
            .channel(`public:messages:${roomId}`)
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'messages', 
                filter: `room_id=eq.${roomId}` 
            }, (payload) => {
                setMessages(prev => [...prev, payload.new]);
            })
            .on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'messages', 
                filter: `room_id=eq.${roomId}` 
            }, (payload) => {
                setMessages(prev => prev.map(msg => 
                    msg.id === payload.new.id ? payload.new : msg
                ));
            })
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [roomId]);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const content = input;
        setInput("");
        setLoading(true);

        // We only insert user messages. The agent listens and replies.
        await supabase.from('messages').insert({
            room_id: roomId,
            content: content,
            sender_id: 'user', // Hardcoded user for now
            is_bot: false
        });

        setLoading(false);
    };

    return (
        <div className={`flex flex-col h-full ${inputOnly ? 'justify-end' : ''}`}>
            <div className={`flex-1 p-4 overflow-y-auto space-y-4 min-h-0 ${inputOnly ? 'hidden' : ''}`} ref={scrollRef}>
                {messages.map((msg, idx) => (
                    <MessageBubble 
                        key={msg.id || idx} 
                        msg={msg} 
                        botName={botName} 
                        onRefresh={onRefresh} 
                    />
                ))}
            </div>

            <div className={`p-4 border-t border-white/5 shrink-0 bg-surface ${inputOnly ? 'pointer-events-auto border-t-0 bg-black/60 backdrop-blur-md' : ''}`}>
                <form onSubmit={sendMessage} className="relative">
                    <input 
                        type="text" 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={`Message ${botName}...`} 
                        className="w-full bg-black/20 border border-white/10 rounded-lg pl-4 pr-10 py-3 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all text-zinc-200 placeholder:text-zinc-600"
                    />
                    <button 
                        type="submit"
                        disabled={loading || !input.trim()}
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
        fetch('./apps.json?t=' + Date.now())
            .then(r => r.json())
            .then(data => {
                setApps(data);
                setSuggestions(data);
            })
            .catch(err => console.error(err));
    }, []);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (app) => {
        onNavigate(app);
        setIsOpen(false);
    };

    const displayText = activeApp ? activeApp.path.replace(/\/index\.html$/, '') : "Select an app...";

    return (
        <div className="relative flex-1 max-w-xl mx-auto md:mx-0" ref={wrapperRef}>
            <div className="flex items-center gap-2 bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 transition-all">
                <button 
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex-1 flex items-center gap-2 text-left focus:outline-none"
                >
                    <span className={`flex-1 text-xs font-mono truncate ${activeApp ? 'text-zinc-200' : 'text-zinc-500'}`}>
                        {displayText}
                    </span>
                    <ChevronDown size={14} className={`text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {activeApp && (
                    <div className="flex items-center gap-1 border-l border-white/10 pl-2">
                        <button 
                            type="button"
                            onClick={onRefresh}
                            className="p-1 hover:bg-white/10 rounded text-zinc-500 hover:text-blue-400 transition-colors"
                        >
                            <RefreshCw size={14} />
                        </button>
                        <a 
                            href={activeApp.path}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-1 hover:bg-white/10 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                            <ExternalLink size={14} />
                        </a>
                    </div>
                )}
                <button 
                    type="button"
                    onClick={onOpenGit}
                    className="p-1 hover:bg-white/10 rounded text-zinc-500 hover:text-purple-400 transition-colors border-l border-white/10 pl-2"
                >
                    <GitBranch size={14} />
                </button>
            </div>

            {isOpen && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#18181b] border border-white/10 rounded-lg shadow-xl overflow-hidden z-50 max-h-80 overflow-y-auto">
                    <button
                        onClick={() => handleSelect(null)}
                        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/5 text-sm text-zinc-300 transition-colors border-b border-white/5"
                    >
                        <Home size={16} className="text-zinc-500" />
                        <span className="font-medium">Home</span>
                    </button>
                    {suggestions.map(app => (
                        <button
                            key={app.id}
                            onClick={() => handleSelect(app)}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/5 text-sm transition-colors
                                ${activeApp?.id === app.id ? 'bg-white/5 text-white' : 'text-zinc-300'}
                            `}
                        >
                            <FolderOpen size={16} className={activeApp?.id === app.id ? "text-blue-400" : "text-blue-500"} />
                            <div className="flex flex-col overflow-hidden">
                                <span className="font-medium truncate">{app.name}</span>
                                <span className="text-[10px] text-zinc-500 font-mono truncate">
                                    {app.path.replace(/\/index\.html$/, '')}
                                </span>
                            </div>
                            {activeApp?.id === app.id && (
                                <Check size={14} className="ml-auto text-blue-400" />
                            )}
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
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center">
                    <Layout size={32} />
                </div>
                <p className="text-sm">Select an app to preview</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-[#0c0c0e] relative overflow-hidden h-full">
            <iframe 
                key={previewKey}
                src={activeApp.path} 
                className="flex-1 w-full h-full border-0 bg-white"
                title="Preview"
            />
        </div>
    );
}

function App() {
    const [activeApp, setActiveApp] = useState(null);
    const [mobileView, setMobileView] = useState('chat'); // 'chat' | 'preview'
    const [isGitOpen, setGitOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [previewKey, setPreviewKey] = useState(0);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const handleNavigate = (destination) => {
        if (typeof destination === 'string') {
            // It's a path
            setActiveApp({ id: 'custom', name: 'Custom', path: destination });
        } else {
            // It's an app object
            setActiveApp(destination);
        }
        
        // On mobile, switch to preview
        if (isMobile) setMobileView('preview');
    };

    const handleRefresh = () => setPreviewKey(k => k + 1);

    return (
        <div className="flex flex-col h-full relative overflow-hidden bg-background">
            <GitManager isOpen={isGitOpen} onClose={() => setGitOpen(false)} />

            {/* Global Header */}
            <div className="h-14 border-b border-white/5 bg-surface flex items-center px-4 gap-4 shrink-0 z-30">
                 {/* Address Bar */}
                 <AddressBar 
                     activeApp={activeApp} 
                     onNavigate={handleNavigate}
                     onRefresh={handleRefresh}
                     onOpenGit={() => setGitOpen(true)}
                 />

                 {/* Mobile View Toggles */}
                 <div className="md:hidden flex gap-1 bg-white/5 p-1 rounded-lg shrink-0">
                    <button 
                        onClick={() => setMobileView('chat')}
                        className={`p-1.5 rounded-md transition-colors ${mobileView === 'chat' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                    >
                        <MessageSquare size={16} />
                    </button>
                    <button 
                        onClick={() => setMobileView('preview')}
                        className={`p-1.5 rounded-md transition-colors ${mobileView === 'preview' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                    >
                        <Eye size={16} />
                    </button>
                 </div>
            </div>

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
                {/* Chat Interface */}
                <div className={`
                    flex-col h-full border-r border-white/5
                    md:w-[400px] md:flex md:bg-surface
                    ${mobileView === 'chat' ? 'flex w-full absolute inset-0 z-10 bg-surface' : ''}
                    ${mobileView === 'preview' ? 'flex w-full absolute inset-0 z-20 pointer-events-none bg-transparent' : ''}
                    ${mobileView !== 'chat' && mobileView !== 'preview' ? 'hidden' : ''}
                    md:static md:z-0
                `}>
                    <ChatInterface 
                        inputOnly={isMobile && mobileView === 'preview'} 
                        activeApp={activeApp} 
                        onRefresh={handleRefresh}
                    />
                </div>
                
                {/* Preview Pane */}
                <div className={`
                    flex-col h-full bg-[#0c0c0e]
                    flex-1 md:flex
                    ${mobileView === 'preview' ? 'flex w-full absolute inset-0 z-10' : 'hidden'}
                    ${isMobile && mobileView === 'preview' ? 'pb-[78px]' : ''}
                    md:static md:z-0 md:pb-0
                `}>
                    <PreviewPane 
                        activeApp={activeApp} 
                        previewKey={previewKey}
                    />
                </div>
            </div>
        </div>
    );
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);
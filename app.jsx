import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
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
    Eye
} from "lucide-react";

// --- Configuration ---
const SUPABASE_URL = 'https://gsyozgedljmcpsysstpz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_FJI1hrANejiwsKll-G4zMQ_wRR-Surp'; 

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function ChatInterface() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef(null);

    // Initial load and Subscription
    useEffect(() => {
        const fetchRecent = async () => {
            const { data } = await supabase
                .from('messages')
                .select('*')
                .eq('room_id', 'alex') // Using 'alex' as the main room
                .order('created_at', { ascending: false })
                .limit(20);
            
            if (data) setMessages(data.reverse());
        };

        fetchRecent();

        const channel = supabase
            .channel('public:messages')
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'messages', 
                filter: `room_id=eq.alex` 
            }, (payload) => {
                setMessages(prev => [...prev, payload.new]);
            })
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, []);

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
            room_id: 'alex',
            content: content,
            sender_id: 'user', // Hardcoded user for now
            is_bot: false
        });

        setLoading(false);
    };

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <Bot size={18} className="text-blue-500" />
                    <span className="font-semibold text-sm">Alex</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    Online
                </div>
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto space-y-4 min-h-0" ref={scrollRef}>
                {messages.map((msg, idx) => {
                    const isBot = msg.is_bot || msg.sender_id === 'alex-bot';
                    return (
                        <div key={msg.id || idx} className={`flex gap-3 ${isBot ? '' : 'flex-row-reverse'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border 
                                ${isBot ? 'bg-blue-500/20 border-blue-500/30' : 'bg-purple-500/20 border-purple-500/30'}`}>
                                {isBot ? <Bot size={14} className="text-blue-400" /> : <User size={14} className="text-purple-400" />}
                            </div>
                            <div className={`max-w-[85%] space-y-1 ${isBot ? '' : 'items-end flex flex-col'}`}>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-xs font-bold text-zinc-300">{isBot ? 'Alex' : 'You'}</span>
                                </div>
                                <div className={`text-sm text-zinc-200 leading-relaxed p-3 rounded-lg border 
                                    ${isBot 
                                        ? 'bg-white/5 rounded-tl-none border-white/5' 
                                        : 'bg-purple-600/20 rounded-tr-none border-purple-500/20'}`}>
                                    {msg.content}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="p-4 border-t border-white/5 shrink-0 bg-surface">
                <form onSubmit={sendMessage} className="relative">
                    <input 
                        type="text" 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Build me a calculator..." 
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

function PreviewPane({ activeApp }) {
    const [key, setKey] = useState(0); // To force iframe reload
    
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
            <div className="h-12 border-b border-white/5 flex items-center px-4 justify-between bg-surface/50 backdrop-blur-sm shrink-0">
                <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-md border border-white/5 text-xs text-zinc-500 font-mono flex-1 mr-4 overflow-hidden">
                    <span className="text-zinc-600 shrink-0">heyx.me</span>
                    <span className="text-zinc-300 truncate">{activeApp.path}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <button 
                        onClick={() => setKey(k => k + 1)}
                        className="text-zinc-500 hover:text-blue-400 transition-colors" 
                        title="Reload Frame"
                    >
                        <RefreshCw size={16} />
                    </button>
                    <a 
                        href={activeApp.path} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-zinc-500 hover:text-zinc-300 transition-colors"
                        title="Open in New Tab"
                    >
                        <ExternalLink size={16} />
                    </a>
                </div>
            </div>
            
            <iframe 
                key={key}
                src={activeApp.path} 
                className="flex-1 w-full h-full border-0 bg-white"
                title="Preview"
            />
        </div>
    );
}

function Sidebar({ onSelectApp, activeAppId, className = "" }) {
    const [apps, setApps] = useState([]);

    const fetchApps = async () => {
        try {
            const res = await fetch('./apps.json?t=' + Date.now());
            if (res.ok) {
                const data = await res.json();
                setApps(data);
            }
        } catch (e) {
            console.error("Failed to load apps.json", e);
        }
    };

    useEffect(() => {
        fetchApps();
        // Poll for new apps every 5 seconds
        const interval = setInterval(fetchApps, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className={`flex flex-col h-full bg-surface/95 backdrop-blur-sm ${className}`}>
            <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 font-bold text-zinc-100 tracking-tight">
                    <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-xs">H</div>
                    heyx.me
                </div>
            </div>
            
            <div className="flex-1 p-2 space-y-0.5 overflow-y-auto">
                <div className="px-2 py-1.5 text-[10px] font-bold text-zinc-600 uppercase tracking-wider">
                    Apps
                </div>
                {apps.map(app => (
                    <button 
                        key={app.id} 
                        onClick={() => onSelectApp(app)}
                        className={`w-full flex items-center gap-2.5 px-2 py-2 text-sm rounded-md transition-all group
                            ${activeAppId === app.id ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'}
                        `}
                    >
                        <FolderOpen size={16} className={`${activeAppId === app.id ? 'text-blue-400' : 'text-zinc-600 group-hover:text-blue-500'} transition-colors`} />
                        <span className="truncate">{app.name}</span>
                        {activeAppId === app.id && (
                            <span className="ml-auto text-blue-400 shrink-0">
                                <Play size={12} fill="currentColor" />
                            </span>
                        )}
                    </button>
                ))}
            </div>

            <div className="p-4 border-t border-white/5 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600"></div>
                    <div className="flex flex-col">
                        <span className="text-xs font-medium text-zinc-200">User</span>
                        <span className="text-[10px] text-zinc-500">Connected</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function App() {
    const [activeApp, setActiveApp] = useState(null);
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [mobileView, setMobileView] = useState('chat'); // 'chat' | 'preview'

    // When an app is selected, switch to preview on mobile
    const handleSelectApp = (app) => {
        setActiveApp(app);
        setMobileView('preview');
        setSidebarOpen(false);
    };

    return (
        <div className="flex flex-col md:flex-row h-full relative overflow-hidden bg-background">
            {/* Mobile Header */}
            <div className="md:hidden h-14 border-b border-white/5 bg-surface flex items-center justify-between px-4 shrink-0 z-30 relative">
               <button 
                   onClick={() => setSidebarOpen(true)} 
                   className="text-zinc-400 hover:text-zinc-200 p-1"
               >
                  <Menu size={20} />
               </button>
               <span className="font-semibold text-sm">Heyx Hub</span>
               <div className="flex gap-1 bg-white/5 p-1 rounded-lg">
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

            {/* Sidebar - Desktop: static, Mobile: fixed drawer */}
            <div className={`
                fixed inset-y-0 left-0 z-50 w-64 border-r border-white/5 transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:block
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <Sidebar 
                    onSelectApp={handleSelectApp} 
                    activeAppId={activeApp?.id} 
                    className="h-full bg-surface"
                />
                
                {/* Mobile Close Button */}
                <button 
                    onClick={() => setSidebarOpen(false)}
                    className="md:hidden absolute top-4 right-4 text-zinc-500 p-2 hover:text-zinc-300 bg-black/20 rounded-full"
                >
                    <X size={16} />
                </button>
            </div>
            
            {/* Overlay for mobile sidebar */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
                {/* Chat Interface */}
                <div className={`
                    flex-col h-full bg-surface border-r border-white/5
                    md:w-[400px] md:flex
                    ${mobileView === 'chat' ? 'flex w-full absolute inset-0 z-10' : 'hidden'}
                    md:static md:z-0
                `}>
                    <ChatInterface />
                </div>
                
                {/* Preview Pane */}
                <div className={`
                    flex-col h-full bg-[#0c0c0e]
                    flex-1 md:flex
                    ${mobileView === 'preview' ? 'flex w-full absolute inset-0 z-10' : 'hidden'}
                    md:static md:z-0
                `}>
                    <PreviewPane activeApp={activeApp} />
                </div>
            </div>
        </div>
    );
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);
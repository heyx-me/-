import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { createClient } from "@supabase/supabase-js";

// Using the same config as app.jsx - ideally this should be a shared config file
const SUPABASE_URL = 'https://gsyozgedljmcpsysstpz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_FJI1hrANejiwsKll-G4zMQ_wRR-Surp'; 

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
});

const ConversationContext = createContext();

export function useConversation() {
    return useContext(ConversationContext);
}

export function ConversationProvider({ children }) {
    const [userId, setUserId] = useState(null);
    const userIdRef = useRef(null);
    const [currentConversationId, setCurrentConversationId] = useState(null);
    const [conversations, setConversations] = useState([]);
    const [needsJoin, setNeedsJoin] = useState(false);
    const [loading, setLoading] = useState(true);

    const fetchConversations = async (uid) => {
        const targetId = uid || userIdRef.current;
        if (!targetId) return;

        const { data, error } = await supabase
            .from('conversations')
            .select(`
                *,
                members:conversation_members!inner(user_id),
                messages:messages(content, created_at, is_bot)
            `)
            .eq('members.user_id', targetId)
            .order('updated_at', { ascending: false })
            .limit(1, { foreignTable: 'messages' })
            .order('created_at', { ascending: false, foreignTable: 'messages' });

        if (data) {
            // Flatten the message array to a single object
            const enriched = data.map(c => ({
                ...c,
                last_message: c.messages && c.messages.length > 0 ? c.messages[0] : null
            }));
            setConversations(enriched);
        }
    };

    // Initialize Identity & Routing
    useEffect(() => {
        let convChannel = null;
        let isMounted = true;

        const init = async () => {
            // 1. Identity
            let storedUserId = localStorage.getItem('heyx_user_id');
            if (!storedUserId) {
                storedUserId = crypto.randomUUID();
                localStorage.setItem('heyx_user_id', storedUserId);
            }
            if (!isMounted) return;
            setUserId(storedUserId);
            userIdRef.current = storedUserId;

            // 2. Fetch Conversations
            const { data: userConvs } = await supabase
                .from('conversations')
                .select('id, conversation_members!inner(user_id)')
                .eq('conversation_members.user_id', storedUserId);
            
            if (!isMounted) return;
            setConversations(userConvs || []); // Basic list for start

            // 3. Routing
            const params = new URLSearchParams(window.location.search);
            const threadParam = params.get('id');
            const lastThread = localStorage.getItem('heyx_last_active_thread');

            if (threadParam) {
                if (threadParam === 'new') {
                    setCurrentConversationId(null);
                } else {
                    // Check membership
                    const { data: memberRecord } = await supabase
                        .from('conversation_members')
                        .select('conversation_id')
                        .eq('conversation_id', threadParam)
                        .eq('user_id', storedUserId)
                        .single();

                    if (!isMounted) return;
                    if (memberRecord) {
                        setCurrentConversationId(threadParam);
                        localStorage.setItem('heyx_last_active_thread', threadParam);
                    } else {
                        // Not a member!
                        setCurrentConversationId(threadParam);
                        setNeedsJoin(true);
                    }
                }
            } else if (lastThread) {
                updateUrl(lastThread);
                setCurrentConversationId(lastThread);
            } else {
                setCurrentConversationId(null);
            }
            
            // Full fetch
            await fetchConversations(storedUserId);
            if (!isMounted) return;
            setLoading(false);

            // 4. Subscribe to Conversations (for title updates, etc.)
            convChannel = supabase.channel('public:conversations')
                .on('postgres_changes', { 
                    event: 'UPDATE', 
                    schema: 'public', 
                    table: 'conversations' 
                }, (payload) => {
                    if (!isMounted) return;
                    const updated = payload.new;
                    setConversations(prev => prev.map(c => 
                        c.id === updated.id ? { ...c, title: updated.title, updated_at: updated.updated_at } : c
                    ));
                })
                .subscribe();
        };

        const handleMessage = (e) => {
            if (e.data && e.data.type === 'REFRESH_CONVERSATIONS') {
                if (e.data.title && e.data.id) {
                    setConversations(prev => prev.map(c => 
                        c.id === e.data.id ? { ...c, title: e.data.title, updated_at: new Date().toISOString() } : c
                    ));
                } else {
                    fetchConversations();
                }
            }
        };
        window.addEventListener('message', handleMessage);

        init();

        return () => {
            isMounted = false;
            window.removeEventListener('message', handleMessage);
            if (convChannel) supabase.removeChannel(convChannel);
        };
    }, []);

    const joinConversation = async (id) => {
        const { error } = await supabase
            .from('conversation_members')
            .insert({ conversation_id: id, user_id: userId });
        
        if (!error) {
            setNeedsJoin(false);
            localStorage.setItem('heyx_last_active_thread', id);
            await fetchConversations();
        }
        return !error;
    };

    const updateUrl = (threadId) => {
        const url = new URL(window.location);
        if (threadId) {
            url.searchParams.set('id', threadId);
        } else {
            url.searchParams.delete('id');
        }
        window.history.replaceState({}, '', url);
    };

    const setThread = (threadId) => {
        setNeedsJoin(false);
        setCurrentConversationId(threadId);
        if (threadId) {
            localStorage.setItem('heyx_last_active_thread', threadId);
        } else {
            localStorage.removeItem('heyx_last_active_thread');
            updateUrl(null);
            return;
        }
        updateUrl(threadId);
    };

    const deleteConversation = async (id) => {
        // Notify Agent to cleanup (unmap groups, clear keys, etc.)
        const conv = conversations.find(c => c.id === id);
        if (conv) {
             const roomId = conv.app_id || 'home';
             await supabase.from('messages').insert({
                 room_id: roomId,
                 conversation_id: id,
                 content: JSON.stringify({ action: 'DELETE_CONVERSATION', conversation_id: id }),
                 sender_id: userId,
                 is_bot: false
             });
             // Give the agent a moment to process the event
             await new Promise(r => setTimeout(r, 500));
        }

        const { error } = await supabase.from('conversations').delete().eq('id', id);
        if (!error) {
            setConversations(prev => prev.filter(c => c.id !== id));
            if (currentConversationId === id) {
                setThread(null);
            }
        }
    };

    const clearMessages = async (id) => {
        await supabase.from('messages').delete().eq('conversation_id', id);
    };

    const refreshConversations = () => fetchConversations();

    const value = {
        userId,
        currentConversationId,
        conversations,
        needsJoin,
        setThread,
        joinConversation,
        deleteConversation,
        clearMessages,
        refreshConversations,
        loading,
        supabase
    };

    return (
        <ConversationContext.Provider value={value}>
            {children}
        </ConversationContext.Provider>
    );
}
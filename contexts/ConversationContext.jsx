import React, { createContext, useContext, useState, useEffect } from 'react';
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
    const [currentConversationId, setCurrentConversationId] = useState(null);
    const [conversations, setConversations] = useState([]);
    const [needsJoin, setNeedsJoin] = useState(false);
    const [loading, setLoading] = useState(true);

    const fetchConversations = async (uid) => {
        const targetId = uid || userId;
        if (!targetId) return;

        const { data, error } = await supabase
            .from('conversations')
            .select(`
                *,
                members:conversation_members!inner(user_id),
                messages:messages(content, created_at, is_bot)
            `)
            .eq('conversation_members.user_id', targetId)
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
        const init = async () => {
            // 1. Identity
            let storedUserId = localStorage.getItem('heyx_user_id');
            if (!storedUserId) {
                storedUserId = crypto.randomUUID();
                localStorage.setItem('heyx_user_id', storedUserId);
            }
            setUserId(storedUserId);

            // 2. Fetch Conversations
            const { data: userConvs } = await supabase
                .from('conversations')
                .select('id')
                .eq('conversation_members.user_id', storedUserId);
            
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
            setLoading(false);
        };

        init();
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

    const refreshConversations = () => fetchConversations();

    const value = {
        userId,
        currentConversationId,
        conversations,
        needsJoin,
        setThread,
        joinConversation,
        deleteConversation,
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
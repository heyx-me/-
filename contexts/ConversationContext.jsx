import React, { useEffect } from 'react';
import { createClient } from "@supabase/supabase-js";
import { create } from 'zustand';
import { get, set } from 'idb-keyval';

// Same config as app.jsx
const SUPABASE_URL = 'https://gsyozgedljmcpsysstpz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_FJI1hrANejiwsKll-G4zMQ_wRR-Surp'; 

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
});

const CACHE_KEY = 'heyx_conversations_cache';

export const useConversationStore = create((setStore, getStore) => ({
    userId: null,
    currentConversationId: null,
    conversations: [],
    needsJoin: false,
    loading: true,

    initIdentity: async () => {
        let storedUserId = localStorage.getItem('heyx_user_id');
        if (!storedUserId) {
            storedUserId = crypto.randomUUID();
            localStorage.setItem('heyx_user_id', storedUserId);
        }
        setStore({ userId: storedUserId });
        
        try {
            await supabase.from('conversations').upsert({
                id: storedUserId,
                app_id: 'system',
                title: 'Global Config',
                owner_id: storedUserId
            }, { onConflict: 'id' });

            await supabase.from('conversation_members').upsert({
                conversation_id: storedUserId,
                user_id: storedUserId
            }, { onConflict: 'conversation_id,user_id' });
        } catch (e) {
            console.error("[ConversationStore] Global Config init error:", e);
        }
        
        return storedUserId;
    },

    fetchConversations: async (uid) => {
        const { userId, conversations: currentConvs } = getStore();
        const targetId = uid || userId;
        if (!targetId) return;

        // Try to load from idb first for zero-latency
        if (currentConvs.length === 0) {
            try {
                const cached = await get(CACHE_KEY + '_' + targetId);
                if (cached && cached.length > 0) {
                    setStore({ conversations: cached, loading: false });
                }
            } catch (err) {
                console.error("IDB load error", err);
            }
        }

        const { data, error } = await supabase
            .from('conversations')
            .select('*, members:conversation_members!inner(user_id), messages:messages(content, created_at, is_bot)')
            .eq('members.user_id', targetId)
            .not('messages.content', 'ilike', '%"ephemeral":true%')
            .order('updated_at', { ascending: false })
            .limit(1, { foreignTable: 'messages' })
            .order('created_at', { ascending: false, foreignTable: 'messages' });

        if (data) {
            const enriched = data.map(c => ({
                ...c,
                last_message: c.messages && c.messages.length > 0 ? c.messages[0] : null
            }));
            setStore({ conversations: enriched, loading: false });
            try {
                await set(CACHE_KEY + '_' + targetId, enriched);
            } catch (err) {
                console.error("IDB save error", err);
            }
        } else {
            setStore({ loading: false });
        }
    },

    setThread: (threadId) => {
        setStore({ needsJoin: false, currentConversationId: threadId });
        const url = new URL(window.location);
        if (threadId) {
            localStorage.setItem('heyx_last_active_thread', threadId);
            url.searchParams.set('id', threadId);
        } else {
            localStorage.removeItem('heyx_last_active_thread');
            url.searchParams.delete('id');
        }
        window.history.replaceState({}, '', url);
    },

    joinConversation: async (id) => {
        const { userId, fetchConversations } = getStore();
        if (!userId) return false;
        
        const { error } = await supabase
            .from('conversation_members')
            .upsert({ conversation_id: id, user_id: userId }, { onConflict: 'conversation_id,user_id' })
            .select();
        
        if (error && error.code !== '23505') {
            console.error("[ConversationStore] Join error:", error);
            return false;
        }
        
        setStore({ needsJoin: false });
        localStorage.setItem('heyx_last_active_thread', id);
        await fetchConversations();
        return true;
    },

    deleteConversation: async (id) => {
        const { userId, conversations, setThread } = getStore();
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
             await new Promise(r => setTimeout(r, 500));
        }

        const { error } = await supabase.from('conversations').delete().eq('id', id);
        if (!error) {
            const newConvs = conversations.filter(c => c.id !== id);
            setStore({ conversations: newConvs });
            set(CACHE_KEY + '_' + userId, newConvs);
            if (getStore().currentConversationId === id) {
                setThread(null);
            }
        }
    },

    clearMessages: async (id) => {
        const { userId, conversations } = getStore();
        const { error } = await supabase.from('messages').delete().eq('conversation_id', id);
        if (!error) {
            const newConvs = conversations.map(c => 
                c.id === id ? { ...c, last_message: null, messages: [] } : c
            );
            setStore({ conversations: newConvs });
            set(CACHE_KEY + '_' + userId, newConvs);
        }
        return !error;
    },
    
    setNeedsJoin: (val) => setStore({ needsJoin: val }),
    setCurrentConversationId: (val) => setStore({ currentConversationId: val }),
    setConversations: (fn) => setStore((state) => {
        const newConvs = typeof fn === 'function' ? fn(state.conversations) : fn;
        set(CACHE_KEY + '_' + state.userId, newConvs);
        return { conversations: newConvs };
    })
}));

export function useConversation() {
    const store = useConversationStore();
    return {
        ...store,
        refreshConversations: store.fetchConversations,
        supabase
    };
}

export function ConversationProvider({ children }) {
    const store = useConversationStore();
    
    useEffect(() => {
        let convChannel = null;
        let isMounted = true;

        const init = async () => {
            const uid = await store.initIdentity();
            if (!isMounted) return;

            const params = new URLSearchParams(window.location.search);
            const threadParam = params.get('id');
            const lastThread = localStorage.getItem('heyx_last_active_thread');

            if (threadParam) {
                if (threadParam === 'new') {
                    store.setCurrentConversationId(null);
                } else {
                    const { data: members, error: memberError } = await supabase
                        .from('conversation_members')
                        .select('conversation_id')
                        .eq('conversation_id', threadParam)
                        .eq('user_id', uid);

                    const isMember = members && members.length > 0;
                    if (!isMounted) return;
                    if (isMember) {
                        store.setCurrentConversationId(threadParam);
                        localStorage.setItem('heyx_last_active_thread', threadParam);
                        store.setNeedsJoin(false);
                    } else {
                        store.setCurrentConversationId(threadParam);
                        store.setNeedsJoin(true);
                    }
                }
            } else if (lastThread) {
                const url = new URL(window.location);
                url.searchParams.set('id', lastThread);
                window.history.replaceState({}, '', url);
                store.setCurrentConversationId(lastThread);
            } else {
                store.setCurrentConversationId(null);
            }
            
            await store.fetchConversations(uid);
            
            convChannel = supabase.channel('public:conversations')
                .on('postgres_changes', { 
                    event: 'UPDATE', 
                    schema: 'public', 
                    table: 'conversations' 
                }, (payload) => {
                    if (!isMounted) return;
                    const updated = payload.new;
                    store.setConversations(prev => prev.map(c => 
                        c.id === updated.id ? { ...c, title: updated.title, updated_at: updated.updated_at } : c
                    ));
                })
                .subscribe();
        };

        const handleMessage = (e) => {
            if (e.data && e.data.type === 'REFRESH_CONVERSATIONS') {
                if (e.data.title && e.data.id) {
                    store.setConversations(prev => prev.map(c => 
                        c.id === e.data.id ? { ...c, title: e.data.title, updated_at: new Date().toISOString() } : c
                    ));
                } else {
                    store.fetchConversations();
                }
            }
        };
        
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                store.fetchConversations();
            }
        };

        window.addEventListener('message', handleMessage);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleVisibilityChange);

        init();

        return () => {
            isMounted = false;
            window.removeEventListener('message', handleMessage);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleVisibilityChange);
            if (convChannel) supabase.removeChannel(convChannel);
        };
    }, []);

    return <>{children}</>;
}
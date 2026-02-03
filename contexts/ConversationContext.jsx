import React, { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gsyozgedljmcpsysstpz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_FJI1hrANejiwsKll-G4zMQ_wRR-Surp'; 

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ConversationContext = createContext();

export const useConversation = () => useContext(ConversationContext);

export const ConversationProvider = ({ children }) => {
    const [userId, setUserId] = useState(null);
    const [currentConversationId, setCurrentConversationId] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initIdentity = async () => {
            // 1. Get or Create User ID
            let storedUserId = localStorage.getItem('heyx_user_id');
            if (!storedUserId) {
                storedUserId = crypto.randomUUID();
                localStorage.setItem('heyx_user_id', storedUserId);
            }
            setUserId(storedUserId);

            // 2. Handle URL Routing (?thread=)
            const params = new URLSearchParams(window.location.search);
            const threadId = params.get('thread');

            if (threadId) {
                // Verify membership/existence
                const { data: membership } = await supabase
                    .from('conversation_members')
                    .select('conversation_id')
                    .eq('conversation_id', threadId)
                    .eq('user_id', storedUserId)
                    .single();

                if (membership) {
                    setCurrentConversationId(threadId);
                } else {
                    console.warn("User is not a member of thread:", threadId);
                    await setupDefaultConversation(storedUserId);
                }
            } else {
                await setupDefaultConversation(storedUserId);
            }
            setLoading(false);
        };

        const setupDefaultConversation = async (uid) => {
            const { data: convs } = await supabase
                .from('conversations')
                .select('id')
                .eq('owner_id', uid)
                .order('created_at', { ascending: true })
                .limit(1);

            if (convs && convs.length > 0) {
                setCurrentConversationId(convs[0].id);
            } else {
                // Create new default
                const { data: newConv } = await supabase
                    .from('conversations')
                    .insert({
                        title: 'Default Chat',
                        owner_id: uid
                    })
                    .select()
                    .single();
                
                if (newConv) {
                    setCurrentConversationId(newConv.id);
                    await supabase.from('conversation_members').insert({
                        conversation_id: newConv.id,
                        user_id: uid
                    });
                }
            }
        };

        initIdentity();

        // Listen for popstate to handle back/forward for ?thread=
        const handlePopState = () => {
            const params = new URLSearchParams(window.location.search);
            const threadId = params.get('thread');
            if (threadId) setCurrentConversationId(threadId);
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const setThread = (threadId) => {
        setCurrentConversationId(threadId);
        const url = new URL(window.location);
        url.searchParams.set('thread', threadId);
        window.history.pushState({}, '', url);
    };

    return (
        <ConversationContext.Provider value={{ 
            userId, 
            currentConversationId, 
            setThread,
            loading 
        }}>
            {children}
        </ConversationContext.Provider>
    );
};

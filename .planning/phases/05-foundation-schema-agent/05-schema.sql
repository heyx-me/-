-- 1. Clean Slate (WARNING: Deletes all messages)
TRUNCATE TABLE messages CASCADE;

-- 2. Drop ALL Policies on Messages to clear dependencies
DROP POLICY IF EXISTS "Users can insert own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can read own messages" ON public.messages;
DROP POLICY IF EXISTS "Public can view messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
-- Fallback: If there are any others, we might need to look them up, 
-- but these are the standard generated ones.

-- 3. Create Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL DEFAULT 'New Chat',
    owner_id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Create Conversation Members Table
CREATE TABLE IF NOT EXISTS public.conversation_members (
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    PRIMARY KEY (conversation_id, user_id)
);

-- 5. Update Messages Table Constraints
-- Ensure the column exists and cast type
ALTER TABLE public.messages 
    ALTER COLUMN conversation_id TYPE UUID USING conversation_id::UUID;

-- Add Foreign Key
ALTER TABLE public.messages 
    ADD CONSTRAINT fk_messages_conversation 
    FOREIGN KEY (conversation_id) 
    REFERENCES public.conversations(id) 
    ON DELETE CASCADE;

-- Make conversation_id Mandatory
ALTER TABLE public.messages 
    ALTER COLUMN conversation_id SET NOT NULL;

-- 6. Enable RLS & Recreate Policies
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Allow everything for now (Public Access) until we have proper Auth
CREATE POLICY "Public access to conversations" ON public.conversations
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public access to members" ON public.conversation_members
    FOR ALL USING (true) WITH CHECK (true);

-- Recreate basic message policy
CREATE POLICY "Public access to messages" ON public.messages
    FOR ALL USING (true) WITH CHECK (true);

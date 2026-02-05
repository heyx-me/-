-- 1. Function to update updated_at on the same table
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 2. Trigger for Conversations table
DROP TRIGGER IF EXISTS set_updated_at ON public.conversations;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.conversations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 3. Function to update parent conversation's updated_at when a message is added
CREATE OR REPLACE FUNCTION public.update_parent_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.conversations
    SET updated_at = now()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 4. Trigger for Messages table
DROP TRIGGER IF EXISTS update_conversation_timestamp_on_message ON public.messages;
CREATE TRIGGER update_conversation_timestamp_on_message
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_parent_conversation_timestamp();

# Requirements: Milestone v0.6 Multi-Conversation Support

## Overview
Enable users to manage, persist, and share distinct conversation threads within the Heyx-Me UI, and introduce a permission-based sharing model allowing multi-user collaboration.

## v0.6 Requirements

### Conversation Management (MGMT)
- [ ] **MGMT-01**: User can view a sidebar listing past conversations for the active app.
- [ ] **MGMT-02**: User can start a "New Chat" which clears the UI and generates a new unique thread ID.
- [ ] **MGMT-03**: System automatically titles a conversation based on the first message sent.
- [ ] **MGMT-04**: User can manually rename (Edit Title) a conversation.
- [ ] **MGMT-05**: User can delete a conversation thread (Owner only).
- [ ] **MGMT-06**: Conversation list is sorted by the most recent activity (`last_message_at`).

### Sharing & Collaboration (SHR)
- [ ] **SHR-01**: The application URL reflects the current thread ID (e.g., `?app=rafi&thread=UUID`).
- [ ] **SHR-02**: Opening a link with a `thread` ID loads the conversation history (if permitted).
- [ ] **SHR-03**: Agent Context Isolation: The backend agent (`agent.js`) must only fetch messages from the specific `conversation_id`.
- [ ] **SHR-05**: **User Identity**: App generates/stores a persistent unique User ID for the client. UI provides a way to "Copy My ID".
- [ ] **SHR-06**: **Permission Management**: Thread Owner can add other User IDs to a conversation's allowed list (Granting Write access).
- [ ] **SHR-07**: **Shared Access**: Users can see conversations they have been added to in their sidebar list.

### Technical Infrastructure (TECH)
- [ ] **TECH-01**: Create `conversations` table (id, room_id, title, created_at, updated_at, owner_id).
- [ ] **TECH-02**: Implement `ConversationContext` in React to manage global thread state and User ID.
- [ ] **TECH-03**: Implement "Lazy Persistence": `conversations` entry is only created in DB when the first message is sent.
- [ ] **TECH-04**: Legacy message migration: Handle `null` `conversation_id`.
- [ ] **TECH-05**: Create `conversation_members` table (conversation_id, user_id, role) to support the sharing model.

## Future Requirements (Out of Scope)
- Export/Import of threads.
- Public "Open to World" links (this milestone focuses on specific user sharing).
- Real-time typing indicators.

## Traceability
*(To be filled by Roadmap)*

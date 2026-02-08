# Requirements: Milestone v0.8 Nanie Multi-tenancy

## Overview
Enable Nanie to support multiple conversations simultaneously by linking each Heyx-me conversation to a specific WhatsApp group and isolating their memories.

## v0.8 Requirements

### Group Discovery & Selection (GRP)
- [ ] **GRP-01**: **List Groups**: Agent exposes an API to fetch the list of participating WhatsApp groups (ID, Subject, Participants).
- [ ] **GRP-02**: **Selection UI**: The Nanie App Interface (Preview Pane) displays a "Select Group" list when no group is linked to the current conversation.
- [ ] **GRP-03**: **Link Action**: User can select a group to link it to the current `conversation_id`.
- [ ] **GRP-04**: **Auto-Rename**: Upon linking, the Heyx-me conversation title is updated to match the WhatsApp Group subject.

### Backend Multi-tenancy (MULTI)
- [ ] **MULTI-01**: **Conversation Mapping**: Agent maintains a persistent JSON map of `conversation_id` -> `whatsapp_group_id`.
- [ ] **MULTI-02**: **Request Routing**: Incoming user messages are routed to the timeline/context of the mapped WhatsApp group.
- [ ] **MULTI-03**: **Unmapped Handling**: Agent returns a specific status/error if a message is sent to an unmapped conversation, prompting the user to select a group.

### Memory Isolation (MEM)
- [ ] **MEM-01**: **Directory Structure**: Migrate from singleton `ella_cache.json` to `nanie/memory/${groupId}/timeline.json`.
- [ ] **MEM-02**: **Context Scoping**: `updateTimeline` and context retrieval logic only load data from the mapped group's storage.
- [ ] **MEM-03**: **Broadcast Scoping**: Background updates from WhatsApp only trigger notifications to the specific `conversation_ids` linked to that group.

## Future / Out of Scope
- [ ] Creating new WhatsApp groups from Heyx-me.
- [ ] Managing group participants.
- [ ] Media handling (images/videos) remains as-is (url-based).

## Traceability
*(To be filled by Roadmap)*

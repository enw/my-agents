# UX Improvements Roadmap

**Created:** 2025-01-XX  
**Goal:** Make the application obvious for "normal" people while keeping pro features accessible for expert users

## Philosophy

- **Progressive Disclosure:** Show simple options first, advanced features on demand
- **Discoverability:** Make power features findable without cluttering the UI
- **Command-First for Experts:** Use `/` commands for advanced workflows
- **Visual Clarity:** Clear hierarchy, consistent patterns, helpful tooltips

---

## Phase 1: Critical Clarity & Simplification (HIGH PRIORITY) ✅ COMPLETE

### 1. Onboarding Flow & Clear First Action
**Status:** ✅ Completed  
**Impact:** ⭐⭐⭐⭐⭐  
**Effort:** Medium

**Problems:**
- New users don't know where to start
- Dashboard shows cards but no guidance
- No clear value proposition on first visit

**Solutions:**
- [ ] Add first-run onboarding modal/tour
  - Step 1: "Create your first agent" → opens new agent form
  - Step 2: "Chat with your agent" → opens chat
  - Step 3: "Try a command: type `/help` in chat"
- [ ] Add prominent "Quick Start" button on empty dashboard
  - Creates starter agent ("General Assistant") with sensible defaults
- [ ] Replace empty state with guided flow instead of just a button
- [ ] Add "Getting Started" section in dashboard sidebar

**Files to Modify:**
- `app/dashboard/page.tsx` - Add onboarding state and modal
- `app/page.tsx` - Add onboarding trigger
- `app/components/OnboardingModal.tsx` - New component

---

### 2. Simplify Agent Creation with Progressive Disclosure
**Status:** ✅ Completed  
**Impact:** ⭐⭐⭐⭐⭐  
**Effort:** Medium

**Problems:**
- Form is overwhelming with many fields at once
- Technical terms without explanation
- No templates or examples

**Solutions:**
- [ ] Two-step creation process:
  - **Step 1 (Quick Start):** Name, Description, System Prompt
  - **Step 2 (Advanced):** Model, Tools, Settings, Memory (collapsible)
- [ ] Add "Use Template" dropdown with pre-configured agents:
  - "Code Assistant" - Python/TypeScript focused
  - "Research Agent" - Web search + Wikipedia
  - "General Helper" - Basic tools, friendly tone
- [ ] Move "Initial Memory" and "Model Settings" to collapsible "Advanced Options"
- [ ] Show tool descriptions inline with simple explanations
- [ ] Add system prompt templates/examples

**Files to Modify:**
- `app/dashboard/new/page.tsx` - Refactor to two-step form
- `app/components/AgentTemplates.tsx` - New component
- `app/components/ProgressiveForm.tsx` - New component

---

### 3. Better Chat Interface Visual Hierarchy
**Status:** ✅ Completed  
**Impact:** ⭐⭐⭐⭐⭐  
**Effort:** High

**Problems:**
- Three sidebars create confusion
- Navigation controls scattered
- Hidden features (commands, trace viewer)
- Unclear what's clickable vs informational

**Solutions:**
- [ ] Consolidate navigation into single left sidebar with tabs:
  - "Chats" tab (conversations list)
  - "Agent Info" tab (settings, memory, version history)
  - "Tools" tab (trace viewer, execution logs)
- [ ] Add floating action button (FAB) for "New Chat" in bottom-right
- [ ] Add command palette (Cmd+K / Ctrl+K):
  - Available commands with descriptions
  - Recent conversations
  - Agent actions (export, schedule, etc.)
- [ ] Add status bar at top showing:
  - Current agent name (clickable to edit)
  - Active model with cost indicator
  - Connection status
- [ ] Make trace viewer toggleable overlay instead of fixed sidebar
- [ ] Improve command autocomplete visibility

**Files to Modify:**
- `app/dashboard/chat/[id]/page.tsx` - Major refactor
- `app/components/CommandPalette.tsx` - New component
- `app/components/ChatSidebar.tsx` - New component
- `app/components/TraceViewer.tsx` - Convert to overlay

---

## Phase 2: Power User Features (MEDIUM PRIORITY)

### 4. Improve Agent Card Design on Dashboard
**Status:** 🔴 Not Started  
**Impact:** ⭐⭐⭐⭐  
**Effort:** Low

**Problems:**
- Emoji buttons are unclear
- Too much technical info
- No clear hierarchy

**Solutions:**
- [ ] Replace emoji buttons with icon buttons + tooltips
- [ ] Show preview of last message or conversation summary
- [ ] Add "Last active: 2 hours ago" timestamp
- [ ] Card hover state shows quick actions
- [ ] Group cards by tags or add search/filter bar
- [ ] Add "Recently used" section at top

**Files to Modify:**
- `app/dashboard/page.tsx` - Improve card design
- `app/components/AgentCard.tsx` - New component

---

### 5. Export/Import UI with Drag-and-Drop
**Status:** 🔴 Not Started  
**Impact:** ⭐⭐⭐⭐  
**Effort:** Medium

**Problems:**
- Feature coming but not visible in UI
- No way to share agents
- No backup/restore workflow

**Solutions:**
- [ ] Add "Export Agent" button in edit page and dashboard card menu
- [ ] Add "Import Agent" button on dashboard (or drag-and-drop zone)
- [ ] Show preview of what will be imported
- [ ] Add "Share Agent" option (generates shareable link/JSON)
- [ ] Add export format options (JSON, YAML)

**Files to Modify:**
- `app/dashboard/page.tsx` - Add import UI
- `app/dashboard/edit/[id]/page.tsx` - Add export button
- `app/api/agents/[id]/export/route.ts` - New API endpoint
- `app/api/agents/import/route.ts` - New API endpoint

---

### 6. Make Scheduling Visible and Accessible
**Status:** 🔴 Not Started  
**Impact:** ⭐⭐⭐  
**Effort:** High

**Problems:**
- Feature coming but not discoverable
- No UI for managing scheduled tasks
- No way to see what's scheduled

**Solutions:**
- [ ] Add "Schedule" tab in agent edit page
- [ ] Add "Scheduled Tasks" section in dashboard
- [ ] Add `/schedule` command in chat with autocomplete
- [ ] Show calendar view of scheduled tasks
- [ ] Add notifications/badges for scheduled task status

**Files to Modify:**
- `app/dashboard/edit/[id]/page.tsx` - Add schedule tab
- `app/dashboard/page.tsx` - Add scheduled tasks section
- `app/dashboard/chat/[id]/commands.ts` - Add schedule command
- `app/components/ScheduleManager.tsx` - New component

---

### 7. Improve Command Discoverability and Help
**Status:** 🔴 Not Started  
**Impact:** ⭐⭐⭐⭐  
**Effort:** Low

**Problems:**
- Commands exist but aren't discoverable
- Only way to find them is `/help`
- No visual indication commands exist

**Solutions:**
- [ ] Show command hint in input placeholder
- [ ] Add "?" button next to input that opens command reference panel
- [ ] Show command suggestions as you type `/` with categories
- [ ] Add tooltips explaining what each command does
- [ ] Add "Command History" showing recently used commands

**Files to Modify:**
- `app/dashboard/chat/[id]/page.tsx` - Improve command UI
- `app/dashboard/chat/[id]/CommandAutocomplete.tsx` - Enhance
- `app/components/CommandHelp.tsx` - New component

---

## Phase 3: Advanced Features (LOWER PRIORITY)

### 8. Add MCP Server Management UI
**Status:** 🔴 Not Started  
**Impact:** ⭐⭐⭐  
**Effort:** Medium

**Problems:**
- MCP servers as tools coming but not visible
- No way to manage connections
- No status indicators

**Solutions:**
- [ ] Add "MCP Servers" section in agent edit page (under Tools)
- [ ] Add "Manage MCP Servers" page in dashboard sidebar
- [ ] Show available MCP tools with descriptions and status
- [ ] Add connection test button for each server
- [ ] Show MCP tools in tool selection with badge

**Files to Modify:**
- `app/dashboard/edit/[id]/page.tsx` - Add MCP section
- `app/dashboard/mcp/page.tsx` - New page
- `app/api/mcp/route.ts` - New API endpoint

---

### 9. Add Agent State Inspection UI
**Status:** 🔴 Not Started  
**Impact:** ⭐⭐⭐  
**Effort:** Medium

**Problems:**
- Inspecting/exporting agent state coming but not visible
- No way to see what agent has learned
- No visualization of knowledge

**Solutions:**
- [ ] Add "Agent State" tab in chat sidebar:
  - Current memory content
  - Learning insights (what agent has learned)
  - Knowledge base entries
  - Export state button
- [ ] Add "State Inspector" in agent edit page
- [ ] Add visualizations (knowledge graph, memory timeline)
- [ ] Add "What has this agent learned?" section

**Files to Modify:**
- `app/dashboard/chat/[id]/page.tsx` - Add state tab
- `app/components/AgentStateInspector.tsx` - New component
- `app/api/agents/[id]/state/route.ts` - New API endpoint

---

### 10. Add Contextual Help and Tooltips Throughout
**Status:** 🔴 Not Started  
**Impact:** ⭐⭐⭐  
**Effort:** Low

**Problems:**
- Technical terms without explanation
- Features not self-explanatory
- No help system

**Solutions:**
- [ ] Add tooltips for:
  - Model selection (what each model is good for)
  - Tools (what each tool does, security implications)
  - Settings (temperature, max tokens, top P)
  - Memory (how it works, when it updates)
- [ ] Add "Learn More" links next to complex features
- [ ] Add inline help text in forms
- [ ] Add "Tips" section in dashboard
- [ ] Add keyboard shortcut hints (show on Cmd+K)

**Files to Modify:**
- `app/components/Tooltip.tsx` - New component
- `app/dashboard/new/page.tsx` - Add tooltips
- `app/dashboard/edit/[id]/page.tsx` - Add tooltips
- `app/dashboard/chat/[id]/page.tsx` - Add tooltips

---

## Implementation Notes

### Design Principles
1. **Mobile-First:** Ensure all improvements work on mobile
2. **Accessibility:** Keyboard navigation, screen reader support
3. **Performance:** Lazy load heavy components
4. **Consistency:** Use existing design system components

### Testing Strategy
- Test with new users (usability testing)
- Test with power users (feature discovery)
- A/B test onboarding flow
- Monitor analytics for feature usage

### Success Metrics
- Time to first agent creation (target: < 2 minutes)
- Command usage rate (target: 30% of users)
- Feature discovery rate (target: 50% find advanced features)
- User satisfaction score (target: 4.5/5)

---

## Next Steps

1. ✅ Create roadmap document
2. 🔄 Start Phase 1 implementation
3. ⏳ Review and iterate based on feedback
4. ⏳ Move to Phase 2 after Phase 1 complete


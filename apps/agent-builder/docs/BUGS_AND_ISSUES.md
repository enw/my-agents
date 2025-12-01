# Bugs and Issues List

**Created:** 2025-01-XX  
**Purpose:** Track bugs, issues, and clarifications that need to be addressed

---

## Fixed Issues ✅

### `/help` Command Not Working
**Status:** ✅ Fixed  
**Issue:** The `/help` command existed but didn't show anything - it just cleared the input.  
**Solution:** Created `CommandHelpModal` component that displays all available commands organized by category (Navigation, Configuration, Semantic). The help modal now shows command descriptions, usage, examples, and aliases.

---

## Clarifications Needed 📝

### "Tabbed Sidebar" Concept
**Status:** ✅ Clarified  
**Question:** What is the "tabbed sidebar"?  
**Answer:** The tabbed sidebar is a single left sidebar in the chat interface that consolidates multiple sidebars into one with three tabs:
- **Chats Tab:** Shows previous conversations (replaces the old "Continue Run" sidebar)
- **Agent Tab:** Shows agent information, settings, and quick actions (replaces scattered agent info)
- **Tools Tab:** Shows execution trace viewer and tool-related controls (replaces the right-side trace viewer)

This reduces visual clutter and makes navigation more intuitive. The trace viewer is now toggleable within the Tools tab instead of being a fixed right sidebar.

**Implementation:** Created `ChatSidebar` component with tabbed interface.

---

## Known Bugs 🐛

### None Currently

---

## Future Improvements 💡

### Command Palette Enhancements
- Add keyboard shortcuts display in help modal
- Add command history
- Add fuzzy search for commands

### Trace Viewer
- Consider making trace viewer a floating overlay instead of sidebar
- Add ability to export trace data
- Add filtering/search within trace

### Performance
- Optimize rendering of large conversation lists
- Add virtualization for long conversation histories
- Cache command help modal content

---

## Notes

- All critical Phase 1 UX improvements have been implemented
- Command system is now fully functional with help modal
- Chat interface has been consolidated into a cleaner tabbed sidebar
- Trace viewer is now toggleable and integrated into sidebar


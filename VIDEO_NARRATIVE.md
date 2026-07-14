# Arno Command Centre — Video Demo Narrative

## Target: 2 minutes, screen recording with voiceover

### Key Narrative: "Arno (Claude) pretty much did everything"

---

## Scene 1: The Hook (0:00 - 0:15)

**Show:** Claude Web conversation, empty state

**Say:** "What if your AI assistant didn't just tell you about your tasks — it showed you? Meet Arno Command Centre: a Skybridge MCP App that turns Claude into a full productivity dashboard."

---

## Scene 2: Task Dashboard Widget (0:15 - 0:45)

**Type in Claude:** "Show my tasks"

**Show:** Task dashboard widget rendering inline with real Trello data (62+ tasks, overdue indicators, labels)

**Say:** "One message and you get a live task dashboard — pulling real data from Trello. Not a screenshot, not a code block. An actual interactive widget inside the conversation."

**Demo actions:**
1. Scroll through the compact task list
2. Click the check button on a task → watch it disappear (completed via Trello API)
3. Click "+ Add" → type a new task → submit → see it appear

**Say:** "Mark tasks done, add new ones — all synced to Trello in real-time, without leaving the chat."

---

## Scene 3: Calendar & Quick Stats (0:45 - 1:10)

**Type:** "Show my calendar" → Calendar panel renders with today's events

**Type:** "Quick stats" → Stats bar shows task count, overdue, meetings, free time

**Say:** "Calendar events from Google Calendar. Quick stats that calculate your free time. Six tools working together as one command centre."

---

## Scene 4: Speak Summary — The Show-Stealer (1:10 - 1:30)

**Click:** The "Summary" button on the task dashboard widget

**Show:** Claude receiving the follow-up message, calling speak-summary tool, getting the summary text, then speaking it aloud

**Say:** "Here's the magic — click Summary and watch what happens. The widget sends a message to Claude. Claude calls our speak-summary MCP tool. The tool fetches live task data, generates a spoken summary, and Claude speaks it aloud. Widget to LLM to tool to speech — all through the MCP protocol."

---

## Scene 5: How It Was Built (1:30 - 1:50)

**Show:** Quick cuts of:
- Claude Code terminal running the SDLC workflow
- Test output (91 tests passing)
- The deploy script running
- Git log showing commits

**Say:** "Built in under 24 hours using Claude Code — my AI assistant Arno. Full SDLC workflow: product tickets, TDD with tests first, code review, deployment. 91 tests, 6 tools, 5 widgets. Claude didn't just help — Claude built it."

---

## Scene 6: Architecture & Close (1:50 - 2:00)

**Show:** Architecture diagram (from README) or quick code scroll

**Say:** "Skybridge, Alpic, MCP protocol, real infrastructure. Arno Command Centre — your AI-powered productivity hub, right in the conversation. Thanks for watching."

---

## Recording Checklist

- [ ] Clean Claude Web session (clear old messages)
- [ ] Have 5+ real tasks visible in Trello (ideally some overdue for visual impact)
- [ ] Ensure at least 2 calendar events for today
- [ ] Test speak-summary button works end-to-end before recording
- [ ] Screen resolution: 1920x1080 or higher
- [ ] Voiceover: Record separately or live — keep it natural, enthusiastic
- [ ] Show the MCP connector URL briefly: `https://arno-command-centre-fb74490b.alpic.live/mcp`

## Submission Notes

- **Tally form:** Include GitHub repo link, deployed URL, and video link
- **GitHub:** `https://github.com/ugoano/arno-command-centre`
- **Live:** `https://arno-command-centre-fb74490b.alpic.live`
- **Deadline:** Sunday 22 February 2026, 23:59

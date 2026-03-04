# Center Planning Skill

**Description:** Document and manage centers following the Center Planning Protocol

**Triggers:**
- User mentions "center", "CENTER.md", "plan center", "document center"
- User asks to create/update/document a center
- User asks about center relationships or strength
- User asks about timelines, interventions, or center status

**Commands:**
- `center status` - Show all centers and their statuses
- `center timelines` - List all planned interventions with timeline status
- `center check` - Check for expired timelines that need evaluation

---

## Skill Instructions

This skill helps you work with centers according to the [Center Planning Protocol](../../../CENTER_PLANNING.md).

### Core Principles

1. **Centers unfold through iteration** - not designed upfront
2. **Document before intervening** - capture current state
3. **Use contact tests** - make claims falsifiable
4. **Track evolution** - maintain audit trail

### Quick Reference

**Center Document Location:**
- Workspace centers: `centers/{name}/CENTER.md`
- Module centers: Colocated with code (e.g., `centers/cli/src/file-sync/CENTER.md`)

**Every center document MUST have:**
- Status (Proposed | Emerging | Established | Weakening | Dissolved)
- Current Description with operational definition
- Contact test for "is this a center?"
- Current strength with evidence
- History of interventions
- Planned interventions (if any)

---

## Timeline Parsing

When parsing timelines from CENTER.md files, calculate status:

**Time-based timelines:**
- Extract: "1 week", "2 days", "1 month"
- Calculate: planned_date + duration
- Compare to today's date
- Status: expired if past, active if future

**Event-based timelines:**
- Extract: "next user session", "after restart"
- Mark as "needs manual check" (can't auto-determine)

**Count-based timelines:**
- Extract: "after 100 syncs", "after 50 uses"
- Mark as "needs manual check" (requires usage data)

**Immediate timelines:**
- Extract: "immediate", "right after implementation"
- If status is "Completed": mark as done
- If status is "In Progress": mark as "ready for evaluation"

**When timeline format is ambiguous:**
- Show warning: "Timeline format unclear, please check manually"
- Include in output with "unknown" status

---

## When User Mentions Centers

### 1. Creating a New Center Document

**Steps:**
1. Verify it's actually a center (what organizes around this?)
2. Determine document location based on type
3. Use template from CENTER_PLANNING.md
4. Fill in Current Description with operational definition
5. Add contact test for "is this a center?"
6. Set status (usually "Proposed" or "Emerging")

**Template sections:**
```markdown
# <Center Name>

**Status:** [Proposed | Emerging | Established | Weakening | Dissolved]
**Created:** [Date]
**Last Updated:** [Date]

---

## Current Description

[Operational definition - what this center does RIGHT NOW]

### Operational Definition

**This center:**
- [Observable behavior 1]
- [Observable behavior 2]

**Contact test for "is this a center?"**
- Success-if: [Observable evidence of organizing power]
- Failure-if: [Observable evidence it's not functioning as center]

### Current Strength

[Weak | Moderate | Strong]

**Evidence:**
- [Usage patterns, metrics, observations]

---

## History

[Track interventions and outcomes]

---

## Planned Interventions

[Document planned changes with contact tests]

---

## Relationships to Other Centers

**Strengthens:** [list]
**Strengthened by:** [list]
**Weakens:** [list]
**Competes with:** [list]

---

## Open Questions

- [Questions to resolve with evidence]
```

### 2. Planning an Intervention

**Before changing code that affects a center:**

1. Check if CENTER.md exists, create if needed
2. Add to "Planned Interventions" section:
   - **Aim:** What problem are we solving?
   - **Claim:** What will this enable?
   - **Assumptions:** Load-bearing beliefs
   - **Contact Test:** Success-if/Failure-if/Measurement/Timeline
   - **Status:** Planned

3. Reference in commit message:
   ```
   strengthen(center-name): [change]

   Center-Impact: Strengthened file-sync-loop
   Contact: [from planned intervention]

   Refs: centers/cli/src/file-sync/CENTER.md
   ```

### 3. Evaluating an Intervention

**After timeline expires:**

1. Update History section with actual results
2. Document what was learned
3. Mark contact test as SUCCESS or FAILED
4. Update Current Description if changed
5. Update Current Strength based on evidence

**If failed:**
- Be honest about what didn't work
- Document why assumptions were wrong
- Consider reversion
- Plan next steps

### 4. Checking Center Relationships

**When asked about center relationships:**

1. Read relevant CENTER.md files
2. Look at "Relationships to Other Centers" section
3. Consider:
   - Does this intervention strengthen/weaken other centers?
   - Are there competing centers?
   - What centers depend on this one?

4. Update relationship sections if changed

---

## Common Tasks

### Task: "Document the file-sync center"

1. Check if `centers/cli/src/file-sync/CENTER.md` exists
2. If not, create it using template
3. Fill in operational definition based on code
4. Add contact test (e.g., "Success-if: Files sync bidirectionally")
5. Document current strength with evidence
6. List relationships to other centers

### Task: "Plan to optimize Loop A"

1. Open `centers/cli/src/file-sync/CENTER.md`
2. Add to "Planned Interventions":
   ```markdown
   ### 2026-03-03 - Optimize Loop A Performance

   **Aim:** Prevent freezing with 500+ files

   **Claim:** Concurrency limiting will allow bulk imports without freeze

   **Assumptions:**
   - Unlimited concurrency causes freeze
   - 10 concurrent operations is safe

   **Contact Test:**
   - Success-if: 500 files sync without freeze, <60s total
   - Failure-if: Still freezes or takes >2min
   - Measurement: Manual test with 500 files
   - Timeline: 1 day

   **Status:** Planned
   ```

### Task: "Update center after fixing freeze bug"

1. Move intervention from "Planned" to "History"
2. Document actual results:
   ```markdown
   ### 2026-03-03 - Optimize Loop A Performance

   **What changed:** Added concurrency limiting (max 10), debouncing

   **Why:** Prevent freeze with 500+ files

   **Expected:** No freeze, <60s sync

   **Actual:**
   - No freeze ✓
   - Sync completed in ~45s ✓
   - System remained responsive ✓

   **Learned:** Concurrency limiting was key, debouncing helped reduce overhead

   **Contact test result:** SUCCESS
   ```
3. Update Current Strength if changed

---

## Meta-Checks

**Before creating center document, verify:**
- Is this actually a center? (What would removing it break?)
- Can you specify observable behaviors?
- Do you have evidence of current strength?
- Is contact test falsifiable?

**If documentation feels like bureaucracy, you're doing it wrong.**

---

## Integration with Commits

**Every non-trivial commit should reference centers:**

```
strengthen(file-sync): add concurrency limiting

Prevent freeze during bulk operations by limiting concurrent
file operations to 10.

Center-Impact:
  Strengthened: file-sync-loop - handles 500+ files smoothly

Contact:
  Success-if: 500 files sync <60s without freeze
  Failure-if: Still freezes or significantly slower
  Timeline: Immediate manual test

Refs: centers/cli/src/file-sync/CENTER.md
```

---

## Commands

### `center status`

Shows overview of all centers in the project.

**Steps:**
1. Find all CENTER.md files: `centers/**/CENTER.md`
2. Read each file and extract:
   - Center name
   - Status (Proposed | Emerging | Established | Weakening | Dissolved)
   - Current strength
   - Number of planned interventions
3. Present summary table

**Output format:**
```
Centers in txtatelier:

Center               Status        Strength    Planned Interventions
------------------------------------------------------------------
file-sync           Established   Strong      2
conflict-handling   Emerging      Moderate    1
```

### `center timelines`

Lists all planned interventions across all centers with their timeline status.

**Steps:**
1. Find all CENTER.md files
2. Parse "Planned Interventions" sections
3. Extract for each intervention:
   - Center name
   - Intervention name
   - Date planned
   - Timeline specification
   - Status (Planned | In Progress | Completed | Abandoned)
4. Calculate if timeline is:
   - **Expired:** Timeline date has passed, needs evaluation
   - **Active:** Timeline is in the future
   - **Immediate:** Timeline was "immediate" or "right after implementation"
5. Sort by timeline urgency (expired first)

**Output format:**
```
Planned Interventions:

⚠️  EXPIRED - Needs Evaluation:
  [file-sync] Optimize Loop A Performance
    Planned: 2026-03-01
    Timeline: 1 day (expired 2 days ago)
    Status: In Progress

✓ ACTIVE:
  [conflict-handling] Add user-friendly conflict UI
    Planned: 2026-03-02
    Timeline: 1 week (3 days remaining)
    Status: Planned

✓ COMPLETED:
  [file-sync] Add concurrency limiting
    Planned: 2026-03-03
    Timeline: Immediate
    Status: Completed
```

### `center check`

Quick check for interventions that need evaluation (expired timelines).

**Steps:**
1. Run timeline parsing (same as `center timelines`)
2. Filter only expired timelines with status "In Progress" or "Planned"
3. If none: confirm all timelines are current
4. If some: list them with reminder to update History

**Output format:**
```
Timeline Check:

⚠️  2 interventions need evaluation:

1. [file-sync] Optimize Loop A Performance
   - Planned: 2026-03-01
   - Timeline: 1 day (expired 2 days ago)
   - Action: Test contact test conditions and update History section

2. [pwa] Enable offline editing
   - Planned: 2026-02-28
   - Timeline: 1 week (expired 4 days ago)
   - Action: Evaluate if users can edit offline, update History

Run 'center timelines' for full list.
```

---

## Common Patterns

### Pattern: Center Not Yet Documented

If code clearly has a center but no CENTER.md:

1. Create document with status "Emerging" or "Established"
2. Document current state based on code analysis
3. Add contact test
4. Fill History section if git history is available

### Pattern: Uncertain if Something is a Center

Ask these questions:
- What repeated interactions happen here?
- What organizes around this?
- What would break if removed?

If answers are unclear, it might not be a center (utility/helper).

### Pattern: Center is Weakening

1. Update status to "Weakening"
2. Document evidence in Current Strength
3. Add to History why it's weakening
4. Consider: Should it be dissolved? Strengthened? Replaced?

---

## Reference Files

- **Protocol:** [CENTER_PLANNING.md](../../../CENTER_PLANNING.md)
- **Commit Convention:** [COMMIT_CONVENTION.md](../../../COMMIT_CONVENTION.md)
- **Attractor Protocol:** [ATTRACTOR_PROTOCOL.md](../../../ATTRACTOR_PROTOCOL.md)

---

## Implementation Notes

**When user types `center timelines` or similar:**

1. Use Glob to find all CENTER.md files: `centers/**/CENTER.md`
2. Use Read to load each file
3. Parse "Planned Interventions" sections (look for `### [Date] - [Name]` pattern)
4. Extract metadata:
   - Use regex or line parsing to find Timeline, Status, Date
   - Calculate timeline status based on dates
5. Format output as shown in Commands section
6. Be honest about limitations (event-based timelines can't be auto-checked)

**Parsing strategy:**

```
Look for sections starting with:
  "## Planned Interventions"

Then find subsections:
  "### 2026-03-01 - Intervention Name"

Extract fields:
  - Timeline: line starting with "- Timeline:"
  - Status: line starting with "**Status:**"

Calculate:
  - Parse timeline string for time expressions
  - Add to planned date
  - Compare to today
```

**Error handling:**

- If CENTER.md is malformed, skip and note in output
- If timeline can't be parsed, mark as "needs manual review"
- If planned date is missing, assume today

---

**Skill Version:** 1.1
**Created:** 2026-03-03
**Last Updated:** 2026-03-03

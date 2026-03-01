# Center Planning Protocol

**Part of [Attractor Protocol](./ATTRACTOR_PROTOCOL.md)** — Planning and documenting centers as they unfold.

---

## Core Principle

Centers are not designed upfront - they **unfold** through iteration and contact with reality.

Before intervening in a center, **document its current state** and **plan the intervention** using contact tests.

This creates an audit trail showing:
- What the center was
- Why we changed it
- What we expected
- What actually happened
- What we learned

---

## Center Document Structure

Each significant center gets a document: `centers/<center-name>.md`

### Document Format

```markdown
# <Center Name>

**Status:** [Proposed | Emerging | Established | Weakening | Dissolved]
**Created:** [Date]
**Last Updated:** [Date]

---

## Current Description

[What this center is right now - operational definition]

### Operational Definition

**This center:**
- [Observable behavior 1]
- [Observable behavior 2]
- [Observable behavior 3]

**Contact test for "is this a center?"**
- Success-if: [What would show it organizes surrounding elements]
- Failure-if: [What would show it's not actually functioning as center]

### Current Strength

[Weak | Moderate | Strong]

**Evidence:**
- [Usage patterns, interaction data, or observations]

---

## History

### [Date] - [Event/Change]

**What changed:** [Description]

**Why:** [Aim and claim from commit]

**Expected:** [Contact test from planning]

**Actual:** [What actually happened]

**Learned:** [Updated understanding]

---

## Planned Interventions

### [Date] - [Proposed Change]

**Aim:** [What problem are we solving?]

**Claim:** [What will this intervention enable?]

**Assumptions:**
- [Load-bearing belief 1]
- [Load-bearing belief 2]

**Contact Test:**
- Success-if: [Observable outcome]
- Failure-if: [Observable outcome]
- Measurement: [How we'll check]
- Timeline: [When we'll evaluate]

**Status:** [Planned | In Progress | Completed | Abandoned]

---

## Relationships to Other Centers

**Strengthens:**
- [center-name] - [how/why]

**Strengthened by:**
- [center-name] - [how/why]

**Weakens:**
- [center-name] - [how/why]

**Competes with:**
- [center-name] - [how/why]

---

## Open Questions

- [Question 1]
- [Question 2]
```

---

## Workflow: Planning Center Interventions

### 1. Identify the Center

Before planning changes, verify you're working with an actual center:

**Ask:**
- What repeated interactions happen here?
- What organizes around this?
- What would break if this were removed?

**Document** in `centers/<center-name>.md` if not already documented.

### 2. Document Current State

Update the **Current Description** section:

```markdown
## Current Description

The example-center currently handles X with Y approach.

### Operational Definition

**This center:**
- Does observable thing A
- Organizes elements B and C
- Provides feedback via mechanism D

**Contact test for "is this a center?"**
- Success-if: Removing it breaks functionality, users notice
- Failure-if: Removing it has no impact on workflow

### Current Strength

Moderate - functions reliably but has known limitations

**Evidence:**
- Usage logs: 80% of sessions interact with this
- User feedback: 2 complaints about slowness
- Performance: acceptable but not optimal
```

### 3. Plan the Intervention

Add to **Planned Interventions** section:

```markdown
## Planned Interventions

### 2026-03-01 - Improve Performance

**Aim:** Reduce user-perceived latency

**Claim:** Optimization X will improve response time from 200ms to <50ms
without increasing complexity

**Assumptions:**
- Users notice delays >100ms
- Current approach has optimization headroom
- Optimization doesn't introduce instability

**Evidence:**
- User feedback: "feels slow" (2 reports)
- Profiling: 80% time spent in function Y
- Benchmark: similar systems achieve <50ms

**Contact Test:**
- Success-if: Response time <50ms, no instability
- Failure-if: Time unchanged or new bugs appear
- Measurement: Performance profiling, user feedback
- Timeline: 1 week

**Status:** Planned
```

### 4. Implement and Commit

Create implementation commits following [COMMIT_CONVENTION.md](./COMMIT_CONVENTION.md).

Reference the center document in commit:

```
strengthen(example-center): optimize for faster response

[... full commit message ...]

Refs: centers/example-center.md
```

### 5. Evaluate and Update

After timeline expires, update **History** section:

**If successful:**

```markdown
## History

### 2026-03-08 - Performance Optimization

**What changed:** Optimized function Y

**Why:** Reduce user-perceived latency

**Expected:**
- Response time <50ms
- No instability

**Actual:**
- Response time 35ms ✓
- No issues after 1 week ✓

**Learned:**
- Optimization was simpler than expected
- Users immediately noticed improvement
- This strengthened the center significantly

**Contact test result:** SUCCESS
```

**If failed:**

```markdown
### 2026-03-08 - Performance Optimization (FAILED)

**What changed:** Optimized function Y

**Why:** Reduce user-perceived latency

**Expected:**
- Response time <50ms
- No instability

**Actual:**
- Response time 40ms (marginal improvement) ✗
- Introduced edge case bug ✗
- Added complexity without clear benefit ✗

**Learned:**
- Bottleneck was elsewhere (not function Y)
- Need better profiling before optimization
- Premature optimization added complexity

**Contact test result:** FAILED

**Reverted:** 2026-03-08 - Restored original implementation
**Next:** Profile more thoroughly to find actual bottleneck
```

### 6. Update Current State

After successful intervention, update **Current Description**:

```markdown
## Current Description

The example-center handles X with optimized Y approach.
Provides fast response without complexity overhead.

### Current Strength

Strong - reliable and responsive

**Evidence:**
- User feedback: "feels instant" (3 reports)
- Performance: 35ms average response
- Stability: no issues after 2 weeks
```

---

## Center Lifecycle States

### Proposed

Center doesn't exist yet. Planning document describes hypothesis.

**Required sections:**
- Operational definition (hypothesized)
- Planned Interventions (initial creation)
- Contact test for "does this become a center?"

**Example:**
```markdown
**Status:** Proposed

## Current Description

This center does not exist yet.

### Hypothesis

A new-center would enable users to accomplish X without Y friction.

**Contact test for "will this become a center?"**
- Success-if: Users interact with it repeatedly, it organizes related actions
- Failure-if: Users ignore it or find it confusing
```

### Emerging

Center exists but still forming. Not yet stable.

**Required:**
- Current Description (what exists now)
- History (how it's evolving)
- Planned Interventions (ongoing strengthening)

**Evidence needed:**
- Some repeated interaction
- Unclear organizing power
- Uncertain strength

### Established

Center is stable and functioning as organizing force.

**Required:**
- Current Description with evidence of strength
- History showing evolution
- Relationships to other centers

**Evidence needed:**
- Consistent repeated interaction
- Clear organizing power
- Observable weakening if removed

### Weakening

Center losing strength or becoming inert.

**Required:**
- Current Description noting weakness
- History showing decline
- Analysis of why weakening

**Evidence:**
- Decreased interaction frequency
- Lost organizing power
- Could be removed without impact

### Dissolved

Center no longer exists. Document preserved for history.

**Required:**
- Final state before dissolution
- History showing full lifecycle
- Reason for dissolution
- What replaced it (if anything)

**Preserved as archive in:** `centers/archive/<center-name>.md`

---

## Directory Structure

```
centers/
  center-a.md
  center-b.md
  center-c.md
  archive/
    old-center.md (dissolved)
```

---

## Centers and Workspaces (This Project)

**For the workspace-center rule, see AGENTS.md § Workspace Structure**

### When Centers Become Workspaces

When a center needs to be a Bun workspace:

**Directory structure:**
```
centers/<center-name>/
  package.json          # Workspace package
  README.md            # Package docs + center planning metadata
  src/                  # Implementation
  test/                # Tests
```

**README.md template:**
Combines standard package documentation with center planning metadata (Status, Contact Test, History). See "Center Document Structure" section above for template.

### Archive

Dissolved centers in `centers/archive/<name>/` are NOT workspaces.

### Open Questions (To Be Resolved With Evidence)

**Utilities:** Where do non-center utilities live?
- Option A: Inside centers that use them (no shared utilities)
- Option B: `lib/` or `shared/` directory (separate from centers)
- Option C: Make utilities a weak center (justify with organizing power)
- **Decision:** Wait for evidence - don't create utilities preemptively

**Granularity:** How fine-grained should centers be?
- Let evidence guide - start coarse, split if natural boundaries emerge

---

## When to Create Center Documents

**Create document when:**
- Planning to strengthen existing center
- Proposing new center
- Center shows signs of weakening
- Multiple interventions planned for same area

**Don't create document for:**
- Trivial implementation details
- One-off changes
- Features that aren't centers (utilities, helpers)
- Purely mechanical structures

**Contact test:** If you can't identify what the center organizes, it's probably not a center.

---

## Integration with Commit Workflow

### Before Committing

1. Check if center document exists: `centers/<center-name>.md`
2. If not, create it (if this is a real center)
3. Document planned intervention
4. Write commit referencing center document

### After Committing

1. Update intervention status to "In Progress"
2. Link commit hash to intervention

### After Evaluation

1. Update History section with results
2. Update Current Description if changed
3. Update Current Strength based on evidence
4. Create revision commit if needed

---

## Benefits of This Protocol

**Prevents:**
- Interventions based on mythology about centers
- Forgetting why changes were made
- Repeating failed approaches
- Losing learning from experiments

**Enables:**
- Evidence-based strengthening of centers
- Clear audit trail of system evolution
- Honest evaluation of what worked/failed
- Accumulated knowledge about system structure

**Creates:**
- Living documentation that evolves with system
- Explicit reasoning about center relationships
- Contact test history showing what evidence taught us
- Foundation for onboarding (read center docs to understand system)

---

## Meta-Check

Before creating/updating center document, ask:

- Is this actually a center? (What would removing it break?)
- Can I specify observable behaviors that define it?
- Do I have evidence of its current strength?
- Am I being honest about unknowns?
- Is the contact test falsifiable?

**If documentation feels like bureaucracy rather than thinking aid, protocol has failed.**

---

**Protocol status:** ACTIVE
**Part of:** Attractor Protocol
**Version:** 1.0
**Last updated:** 2026-03-01

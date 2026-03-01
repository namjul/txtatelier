# Living Systems Commit Convention

**Part of [Attractor Protocol](./ATTRACTOR_PROTOCOL.md)** — Applying living systems thinking to commit messages.

This project uses **Living Systems Commits** - a protocol that treats software as living structure, not mechanical assembly.

**Core principle:** Every non-trivial commit includes a **contact test** - specifying what would make the claim wrong.

**Key differences from Conventional Commits:**
- Types: `strengthen`, `create`, `dissolve` vs. `feat`, `fix`
- Philosophy: Interventions in living systems vs. mechanical changes
- Requirements: `Center-Impact`, `Contact` sections required for non-trivial changes
- **Contact tests prevent mythology** - commits must be falsifiable

**Technical compatibility:** Preserves base format for tooling, maintains footer conventions (`BREAKING CHANGE:`, `Closes:`, `Refs:`).

See [ATTRACTOR_PROTOCOL.md](./ATTRACTOR_PROTOCOL.md) for foundational philosophy and [Contact Testing](#the-contact-test-core-innovation) section for details.

---

## Format

```
<type>(<scope>): <subject>

<body>

<center-impact>

<contact>

<footer>
```

---

## Components

### 1. Type (Required)

Standard conventional commit types, plus living systems additions:

**Standard types:**
- `strengthen`: Enhances an existing center
- `create`: Introduces a new center
- `dissolve`: Removes a center (intentionally)
- `repair`: Fixes broken feedback loops or dead structure
- `refactor`: Restructures without changing observable behavior
- `test`: Adds or modifies contact tests
- `docs`: Documentation changes
- `chore`: Maintenance work

**Living systems types:**
- `unfolding`: Incremental evolution of structure
- `revision`: Updates based on new evidence/contact
- `simplify`: Reduces complexity (collapse-aware)
- `field`: Modifies relational context
- `feedback`: Improves or adds feedback mechanisms

**Breaking changes:** Add `!` after type/scope: `strengthen(canvas)!:`

### 2. Scope (Optional)

The center or field being affected.

**Examples:**
- `(file-sync)`
- `(conflict-handler)`
- `(evolu-schema)`
- `(filesystem-watcher)`
- `(persistence)`

### 3. Subject (Required)

Short imperative summary (≤50 chars).

**Good:**
- `strengthen: reduce filesystem watch debounce to 50ms`
- `create: add gestural conflict resolution UI`
- `dissolve: remove unused grid overlay`

**Avoid mythology:**
- ❌ `strengthen: make sync feel more alive`
- ❌ `create: add holistic file experience`
- ✅ `strengthen: reduce sync latency to <16ms`

### 4. Body (Optional but Recommended)

**Structure using EAI elements:**

```
Aim: [What problem is this solving?]

Claim: [What does this change enable?]

Assumptions: [What beliefs are load-bearing?]

Evidence: [What observation/data motivated this?]
```

**Example:**
```
Aim: Reduce perceived sync delay when user saves file

Claim: Reducing debounce from 200ms to 50ms will decrease
perceived lag without impacting CPU usage or creating update floods

Assumptions:
- Users notice delays >100ms
- Modern editors batch writes, so 50ms won't cause thrashing
- File system events remain stable at 50ms intervals

Evidence:
- User feedback: "sync feels slow"
- Timing analysis: 200ms debounce + network = ~400ms total
- Editor profiling: VSCode batches writes within 30ms window
```

### 5. Center Impact (Required for non-trivial changes)

Specify which centers are strengthened, weakened, or created.

**Format:**
```
Center-Impact:
  Strengthened: [center-name] - [how/why]
  Weakened: [center-name] - [how/why]
  Created: [center-name] - [what it organizes]
  Dissolved: [center-name] - [why removal increases coherence]
```

**Example:**
```
Center-Impact:
  Strengthened: file-sync-loop - faster feedback
  Created: debounce-config - extracted for tuning
```

**For trivial changes:** `Center-Impact: None (mechanical change)`

### 6. Contact (Required for substantial changes)

**Contact tests are reality-contact mechanisms that prevent mythology.**

**The core question:** "What would make this claim wrong?"

If you cannot specify what would falsify your claim, you're about to ship mythology.

**Format:**
```
Contact:
  Success-if: [observable outcome that would confirm claim]
  Failure-if: [observable outcome that would contradict claim]
  Measurement: [how you'll check - doesn't need to be sophisticated]
  Timeline: [when you'll evaluate]
```

**The Falsifiability Principle:**

The test doesn't need to be sophisticated - it needs to be **falsifiable**.

- ✅ Simple but falsifiable = valid contact test
- ❌ Sophisticated but unfalsifiable = mythology

**Valid contact tests can be:**
- Qualitative ("teammate understands without explanation")
- Quantitative ("response time <100ms")
- Subjective ("feels faster than before")
- Simple observations ("no questions in team chat")
- Self-experience ("I use it in actual work")

**What matters:** You must specify what would show you're wrong.

**Example (quantitative):**
```
Contact:
  Success-if: Sync latency <100ms, CPU usage <5% increase
  Failure-if: Latency >200ms or CPU usage >10% increase
  Measurement: CPU profiling, timing logs
  Timeline: Evaluate after 1 week of usage
```

**Example (qualitative):**
```
Contact:
  Success-if: Teammate uses it unprompted in actual work
  Failure-if: Teammate asks "how does this work?" or avoids using it
  Measurement: Direct observation over 1 week
  Timeline: 1 week
```

**Example (self-experience):**
```
Contact:
  Success-if: I can modify code 1 week later without re-reading implementation
  Failure-if: Need to trace through logic to remember what it does
  Measurement: Wait 1 week, attempt modification, honest assessment
  Timeline: 1 week
```

**For refactors/chores:**
```
Contact:
  Success-if: All tests pass, no behavior change observed
  Failure-if: Test failures or user reports of broken functionality
  Measurement: Test suite, user feedback
  Timeline: Immediate
```

**Match test to available evidence:**
- Solo dev with no analytics? Use self-experience and direct observation
- Small team? Use teammate feedback and simple counting
- Have analytics? Use quantitative thresholds
- Internal tool? Use adoption and usage patterns

**The key:** Pick the simplest pattern that can falsify your claim.

### 7. Footer (Standard Conventional Commits)

```
Co-Variance: [list affected modules/centers]
BREAKING CHANGE: [description]
Closes: #123
Refs: #456
```

**Co-Variance is GSNV-specific:**
Lists modules/centers that changed as a result of this commit, tracking propagation effects.

```
Co-Variance:
  - filesystem-watcher (new debounce timing)
  - config-schema (added DEBOUNCE_MS constant)
```

---

## Complete Examples

### Example 1: Feature Addition (Strengthening)

```
strengthen(file-sync): reduce filesystem watch debounce to 50ms

Aim: Minimize perceived sync delay when user saves file

Claim: Reducing debounce from 200ms to 50ms will decrease
perceived lag without impacting CPU usage or creating update floods

Assumptions:
- Users notice delays >100ms
- Modern editors batch writes, so 50ms won't cause thrashing
- File system events remain stable at 50ms intervals

Evidence:
- User feedback: "sync feels slow"
- Timing analysis: 200ms debounce + network = ~400ms total
- Editor profiling: VSCode batches writes within 30ms window

Center-Impact:
  Strengthened: file-sync-loop - faster feedback
  Created: debounce-config - extracted for tuning

Contact:
  Success-if: Users report "instant" sync, CPU usage <5% increase
  Failure-if: High CPU usage, update floods, unstable sync
  Measurement: CPU profiling, event count logs, user feedback
  Timeline: Evaluate after 1 week of usage

Co-Variance:
  - filesystem-watcher (new debounce timing)
  - config-schema (added DEBOUNCE_MS constant)

Refs: #123
```

### Example 2: Simplification (Collapse-Aware)

```
simplify(conflict-handler): remove conflict auto-merge attempt

Aim: Reduce complexity by eliminating failed auto-merge logic

Claim: Auto-merge adds 240 LOC of complexity but succeeds
in <2% of conflicts; explicit conflict files are clearer

Assumptions (original):
- Auto-merge could handle simple cases ❌ FALSIFIED
- Users would prefer automatic resolution ❌ FALSIFIED

Evidence:
- Analytics: Auto-merge success rate 1.8% over 3 months
- Code complexity: 240 LOC for <2% success rate
- User feedback: 4/5 users confused by auto-merge behavior

Center-Impact:
  Dissolved: auto-merge-logic - never functioned as center
  Strengthened: conflict-detection - clearer, simpler code

Contact:
  Success-if: No user complaints, simpler codebase
  Failure-if: Users request auto-merge return
  Measurement: User feedback, code complexity metrics
  Timeline: Monitor for 1 month post-removal

Co-Variance:
  - conflict-handler (removed auto-merge code)
  - tests (removed auto-merge tests)

BREAKING CHANGE: Automatic conflict merging removed. All
conflicts now generate explicit .conflict files.

Refs: #89 (original auto-merge feature)
Closes: #234 (simplify conflict handling)
```

### Example 3: Revision Based on Evidence

```
revision(evolu-sync): revert velocity-based change detection

Aim: Restore sync reliability after failed experiment

Claim: Velocity-based change detection causes race conditions
despite solving redundant sync problem

Assumptions (original):
- Velocity could reliably distinguish user vs. sync changes ❌
- Timestamp comparison alone was insufficient ❌

Evidence (revision):
- Race condition reports: 15% of multi-device users affected
- Logs show sync failures during rapid editing
- Conflict file generation increased 340%

Previous Claim No Longer Holds:
The hypothesis that velocity-based detection could reliably
distinguish change sources was falsified. Network latency
makes velocity measurements unreliable.

Updated Understanding:
Change detection and conflict resolution are separate concerns.
Velocity heuristics conflate them. Need explicit owner tracking
instead of velocity inference.

Center-Impact:
  Dissolved: velocity-detection (failed as center)
  Strengthened: conflict-detection (restored reliability)
  Weakened: sync-efficiency (back to conservative approach)

Contact:
  Success-if: Conflict rate drops to <2%, sync reliability restored
  Failure-if: Users still report lost edits or sync failures
  Measurement: Error logs, conflict file count, user reports
  Timeline: Immediate (already validated by failure data)

Next Step:
Implement explicit owner tracking via ownerId field in Evolu
schema, eliminating need for velocity inference.

Co-Variance:
  - evolu-schema (removed velocity fields)
  - sync-loops (reverted to timestamp-based detection)
  - conflict-handler (simplified logic)

BREAKING CHANGE: Velocity-based sync removed. All devices
must update to avoid sync conflicts.

Closes: #234 (original feature)
Refs: #678 (user feedback issue)
```

### Example 4: Small Mechanical Change

```
chore(deps): update evolu to 6.0.1

Center-Impact: None (dependency update)

Contact:
  Success-if: Build passes, tests pass, no runtime errors
  Failure-if: Type errors, test failures, user-reported bugs
```

### Example 5: Test Addition

```
test(conflict-handler): add contact test for multi-device conflicts

Aim: Verify conflict detection works across devices

Contact test verifies:
- Conflicts generate .conflict files on both devices
- Original file remains untouched
- Conflict files sync like regular files

Center-Impact:
  Strengthened: conflict-handler (validation of core assumption)

Refs: #234
```

---

## Guidelines

### When to Use Each Type

**strengthen:**
- Enhancing existing, validated centers
- Improving feedback loops
- Reducing friction in established patterns

**create:**
- New centers with hypothesized organizing power
- Always requires strong contact test
- Should reference evidence or user need

**dissolve:**
- Removing failed hypotheses
- Eliminating inert structure
- Collapse-aware simplification

**revision:**
- Changes based on new evidence
- Falsification of previous assumptions
- Updates to system understanding

**unfolding:**
- Incremental evolution without breaking changes
- Gradual emergence of form
- Small steps that enable next steps

**simplify:**
- Reducing complexity
- Removing unused abstractions
- Back-loop moves toward coherence

### Anti-Patterns in Commit Messages

#### Anti-Pattern 1: Mythology Without Operational Definitions

❌ **Unfalsifiable mythology:**
```
strengthen(sync): enhance the holistic sync experience
through more fluid data dynamics
```

**Problem:** "Holistic" and "fluid" have no operational meaning. No way to verify or falsify.

✅ **Operational and falsifiable:**
```
strengthen(sync): reduce sync latency from 400ms to 150ms

Contact:
  Success-if: 95th percentile sync time <200ms
  Failure-if: Latency remains >300ms
  Measurement: Latency tracking logs
  Timeline: 1 week
```

**Why this works:** Specifies exactly what would prove it wrong (latency >300ms).

---

#### Anti-Pattern 2: No Failure Condition

❌ **Missing failure condition:**
```
create(cache): add caching layer

Contact:
  Success-if: Performance improves
  Failure-if: [not specified]
```

**Problem:** If you can't specify what would make you wrong, claim is unfalsifiable.

✅ **With failure condition:**
```
create(cache): add LRU cache for content hashes

Contact:
  Success-if: Hash computation time reduced >50%
  Failure-if: Memory usage >100MB or stale cache hits occur
  Measurement: Performance profiling, memory monitoring
  Timeline: Evaluate after 100 file operations
```

**Why this works:** Clear conditions for both success and failure.

---

#### Anti-Pattern 3: Vague Center Claims

❌ **Vague and unmeasurable:**
```
create(workflow): add new sync workflow

Center-Impact:
  Created: workflow - improves user experience
```

**Problem:** "Improves user experience" is not observable or measurable.

✅ **Specific center definition:**
```
create(offline-queue): persist pending syncs across restarts

Center-Impact:
  Created: offline-queue - allows continuation after disconnect
  Strengthened: sync-reliability - reduces data loss risk

Contact:
  Success-if: >90% of offline edits sync successfully on reconnect
  Failure-if: Offline edits lost or sync fails >20% of time
  Measurement: Offline edit tracking, sync success rate
  Timeline: 2 weeks
```

**Why this works:** Specifies observable behavior and measurable outcomes.

---

#### Anti-Pattern 4: Sophisticated but Unfalsifiable

❌ **Looks rigorous but isn't falsifiable:**
```
strengthen(ui): improve overall system quality

Contact:
  Success-if: Engagement metrics trend positively
  Failure-if: [not specified]
  Measurement: Analytics dashboard
```

**Problem:** "Trend positively" is vague (how much? over what time?). No failure condition. Sophisticated tooling doesn't fix unfalsifiable claim.

✅ **Simple but falsifiable:**
```
strengthen(ui): reduce workflow steps from 5 to 3

Contact:
  Success-if: Task completes in 3 steps (counted)
  Failure-if: Still requires 4+ steps
  Measurement: Count user actions for same task
  Timeline: Immediate
```

**Why this works:** Simple metric, clear threshold, actually could fail.

---

#### Anti-Pattern 5: Post-Hoc Justification

❌ **Writing contact test after implementation:**
```
# (After building feature and seeing it works)

Contact:
  Success-if: Feature works
  Failure-if: Feature broken
```

**Problem:** Contact test written to confirm success, not to test hypothesis.

✅ **Contact test before implementation:**
```
# (Before writing code)

Claim: Gesture-based color selection will increase color usage

Contact:
  Success-if: Color usage increases >30% within 2 weeks
  Failure-if: Color usage unchanged or users report accidental triggers
  Measurement: Stroke color analytics, user feedback
  Timeline: 2 weeks

# (After implementation and 2-week evaluation)

revision(color-picker): revert gesture-based selection

Evidence: Color usage increased only 8%, accidental triggers
23% of strokes (target was <5%). Contact test failed.

Learned: Velocity-based selection interferes with drawing
precision. Color selection and drawing are competing centers.
```

**Why this works:** Contact test established first, then evaluated honestly, then revised based on evidence.

---

#### Anti-Pattern 6: Impossible Evidence

❌ **Test requires unavailable infrastructure:**
```
# Solo dev, no users, no analytics

Contact:
  Success-if: User engagement increases >40%
  Measurement: Analytics dashboard
```

**Problem:** No analytics infrastructure exists.

✅ **Match test to available evidence:**
```
# Solo dev, no users, no analytics

Contact:
  Success-if: I use it in my actual work (not just demos)
  Failure-if: I avoid using it or it feels slower
  Measurement: Honest self-observation over 1 week
  Timeline: 1 week
```

**Why this works:** Test matches available evidence (self-experience).

---

## Contact Test Patterns for This Project

**Match contact test to available evidence.** For txtatelier, most commits will use these patterns:

### Pattern A: Self-Experience (Solo Development)

**When:** Early development, solo dev, prototyping

**Examples:**

```
Contact:
  Success-if: I can modify sync logic 1 week later without re-reading
  Failure-if: Need to trace through code to remember how it works
  Measurement: Wait 1 week, attempt modification
  Timeline: 1 week
```

```
Contact:
  Success-if: Sync feels instant when I save files
  Failure-if: Noticeable delay or lag
  Measurement: Honest subjective assessment during daily use
  Timeline: 3 days
```

### Pattern B: Direct Observation (Small Team)

**When:** Have teammate(s) available, can observe usage

**Examples:**

```
Contact:
  Success-if: Teammate uses CLI without asking questions
  Failure-if: Teammate asks "how does this work?"
  Measurement: Watch first usage session
  Timeline: First use
```

```
Contact:
  Success-if: No "sync failed" messages in team chat (first week)
  Failure-if: Sync error reports appear
  Measurement: Monitor chat/support channels
  Timeline: 1 week
```

### Pattern C: Binary Outcomes (Always Available)

**When:** Clear pass/fail, works/doesn't work

**Examples:**

```
Contact:
  Success-if: All tests pass, no behavior changes
  Failure-if: Any test failures or user reports
  Measurement: Test suite, runtime behavior
  Timeline: Immediate
```

```
Contact:
  Success-if: Conflict files generated correctly on both devices
  Failure-if: Files overwritten or sync fails
  Measurement: Multi-device test scenario
  Timeline: Immediate
```

### Pattern D: Comparative (Before/After)

**When:** Improving existing functionality

**Examples:**

```
Contact:
  Success-if: Code reduced from 340 to <200 lines
  Failure-if: Same or more lines, same complexity
  Measurement: wc -l, cyclomatic complexity
  Timeline: Immediate
```

```
Contact:
  Success-if: Debounce reduces from 200ms to 50ms
  Failure-if: Still >100ms or CPU usage increases
  Measurement: Timing logs, CPU profiling
  Timeline: 1 week usage
```

### Pattern E: Counting & Thresholds

**When:** Can count events, have meaningful threshold

**Examples:**

```
Contact:
  Success-if: Zero crashes in 1 week of actual use
  Failure-if: Any crashes or data corruption
  Measurement: Error logs, crash reports
  Timeline: 1 week
```

```
Contact:
  Success-if: Sync latency <100ms (measured)
  Failure-if: Latency >500ms
  Measurement: Instrument timing, measure
  Timeline: After 100 file saves
```

### Pattern F: Time-Based Validation

**When:** Effects aren't immediate, sustainability matters

**Examples:**

```
Contact:
  Success-if: Can add new file type support in <1 day (tried after 2 weeks)
  Failure-if: Takes >3 days or requires refactor
  Measurement: Attempt extension, time it
  Timeline: 2 weeks, then extend
```

```
Contact:
  Success-if: Still using feature 1 month later
  Failure-if: Reverted to old approach or feature disabled
  Measurement: Check usage after 1 month
  Timeline: 1 month
```

### Choosing Your Pattern

**Decision tree for this project:**

**Solo development phase (now)?**
→ Pattern A (Self-Experience)
→ Pattern C (Binary Outcomes)
→ Pattern D (Comparative)

**Have basic tests/logs?**
→ Pattern C (Binary)
→ Pattern E (Counting & Thresholds)

**Refactoring existing code?**
→ Pattern C (tests pass)
→ Pattern D (compare complexity)

**Adding new feature?**
→ Pattern A (self-use)
→ Pattern F (time-based)

**Multi-device sync testing?**
→ Pattern C (binary: works or fails)
→ Pattern E (count conflicts, errors)

**The principle:** Use simplest pattern that can falsify your claim. Don't require analytics you don't have. Honest observation beats sophisticated metrics.

---

## Integration with Git Workflow

### Git Configuration

Configure commit template:
```bash
git config commit.template .gitmessage
```

### Pre-commit Hook Template

Create `.git/hooks/commit-msg`:

```bash
#!/bin/bash
# Validate commit message structure

MSG_FILE=$1
MSG=$(cat "$MSG_FILE")

# Check for required sections in non-trivial commits
if echo "$MSG" | grep -qE "^(strengthen|create|dissolve|revision|unfolding)"; then
    if ! echo "$MSG" | grep -q "Center-Impact:"; then
        echo "Error: Non-trivial commits require Center-Impact section"
        exit 1
    fi
    if ! echo "$MSG" | grep -q "Contact:"; then
        echo "Error: Non-trivial commits require Contact section"
        exit 1
    fi
fi

# Check for mythology keywords without operational definitions
if echo "$MSG" | grep -qiE "(holistic|flow|energy|synergy|wholeness)" && \
   ! echo "$MSG" | grep -q "Contact:"; then
    echo "Warning: Message contains potential mythology without contact test"
    echo "Consider adding operational definitions or measurable outcomes"
fi
```

Make it executable:
```bash
chmod +x .git/hooks/commit-msg
```

---

## Rationale

This format applies [Attractor Protocol](./ATTRACTOR_PROTOCOL.md) principles to commit messages.

### Contact Tests Prevent Mythology

Every non-trivial commit requires a contact test - a falsifiable claim about what would show you're wrong.

**Without contact tests:** "This improves user experience" (unmeasurable), "Better architecture" (unfalsifiable)

**With contact tests:** "Reduces sync latency from 400ms to <150ms" (falsifiable), "I can modify it 1 week later without re-reading" (observable)

**The discipline:** If you can't specify what would make your claim wrong, you're about to commit mythology.

### Living Systems vs. Mechanical View

**Conventional Commits** (mechanical):
- Features **added** (parts to machine)
- Bugs **fixed** (repair components)
- Code **refactored** (rearrange parts)

**Living Systems Commits** (organismic):
- Centers **strengthened** (like tissue)
- Structure **unfolds** (like growth)
- Hypotheses **revised** (like adaptation)

The worldviews are incommensurable. Using `feat:` alongside `strengthen:` would mix metaphors.

### Audit Trail for Learning

Every commit documents:
- What we believed (claim, assumptions)
- Why we believed it (evidence)
- How we'll know if we're right (contact test)
- What actually happened (revision commits)

This creates an audit trail of learning, not just a changelog.

See [ATTRACTOR_PROTOCOL.md](./ATTRACTOR_PROTOCOL.md) for full philosophical foundation.

---

## When Contact Tests Aren't Needed

**Skip contact tests for:**

### 1. Trivial Mechanical Changes
- Typo fixes
- Formatting/linting
- Renaming with clear scope
- Dependency version bumps (if tests pass)

**Example:**
```
chore(deps): update evolu to 6.0.1

Center-Impact: None (dependency update)

Contact:
  Success-if: Tests pass, no runtime errors
  Failure-if: Type errors, test failures
```

### 2. Pure Deletions
- Removing unused code
- Deleting commented-out code
- Removing deprecated features

**Contact test:** "Does anything break?" (binary)

**Example:**
```
dissolve(grid-overlay): remove unused grid feature

Center-Impact:
  Dissolved: grid-overlay (unused, <1% adoption)

Contact:
  Success-if: All tests pass, no user complaints
  Failure-if: Build breaks or users request feature return
  Timeline: 1 week
```

### 3. Obvious Failures
- Compilation errors (can't compile = failed)
- Test failures (tests fail = failed)
- Runtime crashes (crashes = failed)

**Built-in feedback makes contact test redundant.**

### 4. Exploratory Work
- "I don't know what will happen, investigating"
- Spike/prototype commits
- Research commits

**Mark as exploration, write contact test after you learn something.**

**Example:**
```
unfolding(sync): explore alternative debounce strategies

Aim: Investigate if adaptive debouncing improves sync

Status: Exploratory - no contact test yet

Next: If promising, will add contact test and proper implementation
```

### 5. Documentation-Only Changes
- README updates
- Comment additions
- Documentation fixes

**Unless claiming improvement:**
- ❌ "Better docs" needs contact test (what makes it better?)
- ✅ "Fix typo in README" doesn't need contact test

---

## Evaluation Ritual

**After committing with contact test:**

1. **Wait for timeline** (1 week, 1 month, etc.)
2. **Gather specified evidence** (exactly what you said you'd measure)
3. **Compare to success/failure conditions** (honestly)
4. **Document outcome** (revision commit if needed)

### If Contact Test Passed

```
# No commit needed unless there's learning to document

# Optional: Add note to project log
"Contact test for [commit hash] passed: [brief outcome]"
```

### If Contact Test Failed

**Write revision commit documenting what you learned:**

```
revision(file-sync): revert debounce reduction to 100ms

Aim: Restore stability after failed debounce experiment

Original Claim: 50ms debounce would reduce lag without CPU impact

Evidence (revision):
- CPU usage increased 45% (target was <5%)
- File system event floods under rapid editing
- Sync failures increased from 0.1% to 8%

Contact Test Result: FAILED
- CPU usage: 45% increase (failure threshold was >10%)
- Sync stability: degraded significantly

Learned:
- 50ms too aggressive for debouncing on Linux filesystems
- Editor write patterns vary more than expected
- Need adaptive debouncing based on event frequency

Updated Understanding:
Fixed debounce timing can't handle variance in editor behavior.
Need to measure event rate and adjust debounce dynamically.

Center-Impact:
  Dissolved: fixed-50ms-debounce (failed as center)
  Strengthened: sync-stability (restored reliability)
  Weakened: sync-latency (back to 100ms)

Contact:
  Success-if: CPU usage <5%, sync failures <1%
  Failure-if: Stability issues continue
  Measurement: CPU profiling, error logs
  Timeline: 1 week

Next: Investigate adaptive debouncing strategy

BREAKING CHANGE: Debounce timing reverted to 100ms

Refs: [original commit hash]
```

**This is not failure - this is learning.**

The protocol succeeded: contact test caught the problem before it became entrenched.

---

## Quick Reference

### Commit Types
- `strengthen` - Enhance existing center
- `create` - Introduce new center
- `dissolve` - Remove center
- `repair` - Fix broken feedback
- `refactor` - Restructure
- `test` - Add/modify tests
- `docs` - Documentation
- `chore` - Maintenance
- `unfolding` - Incremental evolution
- `revision` - Update based on evidence
- `simplify` - Reduce complexity
- `field` - Modify relational context
- `feedback` - Improve feedback mechanisms

### Required Sections
- **Type + Subject:** Always required
- **Center-Impact:** Required for non-trivial changes
- **Contact Test:** Required for substantial changes (must include failure condition)
- **Body (EAI):** Recommended for features and revisions
- **Footer:** Optional (Co-Variance, BREAKING CHANGE, refs)

### Contact Test Checklist
Before committing, ask:
- [ ] Can I specify what would make this claim wrong?
- [ ] Have I stated both success AND failure conditions?
- [ ] Is the measurement matched to available evidence?
- [ ] Will I actually evaluate this, or just write and forget?
- [ ] If I can't specify failure condition, is this mythology?

### Contact Test Patterns for This Project
- **Self-Experience:** "I can modify it 1 week later without re-reading"
- **Binary:** "Tests pass, no behavior changes"
- **Comparative:** "Code reduces from 340 to <200 lines"
- **Counting:** "Zero crashes in 1 week of use"
- **Time-Based:** "Still using feature 1 month later"
- **Direct Observation:** "Teammate uses without asking questions"

### Common Scopes for This Project
- `file-sync` - Filesystem sync loop
- `evolu-sync` - Evolu sync loop
- `conflict-handler` - Conflict detection/resolution
- `schema` - Evolu schema
- `cli` - CLI commands
- `pwa` - PWA interface
- `core` - Core domain logic

---

**Protocol status:** ACTIVE
**Format version:** 1.0
**Relationship to Conventional Commits:** Conceptual replacement, technical extension
**Last updated:** 2026-03-01

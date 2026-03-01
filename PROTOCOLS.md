# Protocols Overview

This project uses the **Attractor Protocol** - a framework for building living systems through disciplined epistemic practice.

---

## Core Documents

### [ATTRACTOR_PROTOCOL.md](./ATTRACTOR_PROTOCOL.md)
**The philosophical foundation.**

- Core principle: Prevent mythology through reality contact
- Combines Christopher Alexander (living structure) + GSNV (epistemic discipline)
- Contact tests as central innovation
- Agent as navigator, not authority
- Evidence over authority in all decisions

**Read this first** to understand the "why" behind all other protocols.

### [CENTER_PLANNING.md](./CENTER_PLANNING.md)
**Planning and documenting centers as they unfold.**

- Document each significant center in `centers/<name>.md`
- Track center lifecycle: Proposed → Emerging → Established → Weakening → Dissolved
- Plan interventions with contact tests before implementing
- Record history of what worked and what failed
- Maintain audit trail of center evolution

**Use this** when planning changes to centers.

### [COMMIT_CONVENTION.md](./COMMIT_CONVENTION.md)
**Living Systems Commits - applying Attractor Protocol to git.**

- Format: `<type>(<scope>): <subject>` with `Center-Impact` and `Contact` sections
- Types: `strengthen`, `create`, `dissolve`, `revision`, `simplify`, etc.
- Every non-trivial commit requires contact test
- Revision commits document learning from failed hypotheses

**Use this** when writing commit messages.

### [AGENTS.md](./AGENTS.md)
**Guidelines for AI agents working on this codebase.**

- Code style (TypeScript, immutability, arrow functions, top-down organization)
- Architecture principles (filesystem canonical, two sync loops, conflict handling)
- Testing guidelines
- Git workflow (references Living Systems Commits)
- Implementation phases

**Read this** before making code changes.

---

## Quick Start

**For developers:**
1. Read [ATTRACTOR_PROTOCOL.md](./ATTRACTOR_PROTOCOL.md) to understand the philosophy
2. Review [AGENTS.md](./AGENTS.md) for code style and architecture
3. **Understand:** Bun workspaces MUST be valid centers (see AGENTS.md § Workspace Structure)
4. Before changing a center, check/create center docs per [CENTER_PLANNING.md](./CENTER_PLANNING.md)
5. Use [COMMIT_CONVENTION.md](./COMMIT_CONVENTION.md) for commit messages
6. Configure git template: `git config commit.template .gitmessage`

**For AI agents:**
1. Treat [ATTRACTOR_PROTOCOL.md](./ATTRACTOR_PROTOCOL.md) as source of orientation
2. **Rule:** Bun workspaces MUST be valid centers (see AGENTS.md § Workspace Structure)
3. Before proposing center changes, consult center docs in `centers/`
4. Plan interventions with contact tests per [CENTER_PLANNING.md](./CENTER_PLANNING.md)
5. Follow [AGENTS.md](./AGENTS.md) for code changes
6. Structure commits per [COMMIT_CONVENTION.md](./COMMIT_CONVENTION.md)
7. Always ask: "What would make this wrong?"

---

## Key Principles Across All Protocols

### 1. Contact Tests (Falsifiability)
Every claim requires specification of what would make it wrong.

### 2. Evidence Over Authority
Disagreements resolved through contact tests, not power dynamics.

### 3. Living Structure
Optimize for coherence and adaptability, not completeness or scale.

### 4. Revision Ritual
Update beliefs when evidence contradicts them. No ego-preserving narratives.

### 5. Operational Definitions
Terms like "center," "living," "coherent" require operational meaning.

### 6. Anti-Mythology
Flag vague claims about "aliveness," "wholeness," or "flow" without observable differences.

---

## Protocol Status

**Status:** ACTIVE  
**Version:** 1.0  
**Last Updated:** 2026-03-01  
**Evolution:** This protocol evolves based on evidence from all team levels

**To propose changes:**
1. Document what pattern doesn't fit and provide evidence
2. Specify contact test that would validate the change
3. Discuss and evaluate evidence
4. Experiment in limited scope
5. Update if evidence supports

See [ATTRACTOR_PROTOCOL.md § Protocol Evolution](./ATTRACTOR_PROTOCOL.md#protocol-evolution) for details.

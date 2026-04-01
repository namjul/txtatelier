# Exploration: Shared Code Between CLI and PWA

**Explored:** 2026-03-31  
**Status:** Documented, no action taken  
**Rationale:** Premature abstraction costs more than controlled duplication

---

## What We Found

### Contract-Level Alignments (Must Stay in Sync)

| Element | CLI Location | PWA Location | Risk if Diverged |
|---------|-------------|--------------|------------------|
| `file` table schema | `file-sync/evolu-schema.ts:22-38` | `evolu/schema.ts:12-18` | Sync breaks |
| Content hashing | `@txtatelier/sync-invariants` (CLI: `file-sync/hash.ts` adds `computeFileHash`) | `@txtatelier/sync-invariants` (PWA may re-export via `evolu/contentHash.ts`) | Infinite sync loops |
| Files shard owner | `@txtatelier/sync-invariants` `FILES_SHARD` (CLI: `evolu.ts`, `index.ts`) | same + `evolu/client.ts` | Rows invisible to other side |
| Default relay URL | AGENTS.md | `evolu/client.ts:26` | Connection failures |

All use **SHA-256 hex** (64 chars) over UTF-8 content. This is the primary cross-surface invariant.

### Pattern Similarities (Coincidental, Not Contract)

| Pattern | Notes |
|---------|-------|
| Env parsing | Both use `@evolu/common` schemas, but different variable sets |
| Query builders | Similar narrowing patterns, but different needs |
| `@evolu/common` imports | Shared dependency, not shared code |

These look similar today but may diverge legitimately:
- PWA might add query caching
- CLI might need env file support

---

## Decision: Keep Duplicated

**We are NOT extracting a shared package at this time.**

### Why Duplication Wins Now

1. **Cheap documentation** — The duplication makes the contract boundary visible
2. **Conscious coupling** — Changing one forces question: "Does other need this too?"
3. **No consumer pressure** — Only two centers, both in same repo
4. **Abstraction risk** — False coupling hurts more than duplication

### When Extraction Becomes Worth It

```
Trigger signals:
├── Third consumer appears (mobile app?)
│   └── Shared contract becomes load-bearing
├── First "drift bug" occurs
│   └── Pain of duplication > pain of abstraction
├── Schema needs versioning
│   └── @txtatelier/common-evolu@1.0.0 vs @2.0.0
└── Testing becomes painful
    └── "Did we break PWA or CLI or both?"
```

### If We Extract Later

Obvious candidates (in priority order):

1. **Schema contract** — `FileId`, file table shape as minimal module
2. **Shard constant** — implemented as `FILES_SHARD` in `@txtatelier/sync-invariants`
3. **Hash contract** — Test vectors or algorithm spec (not implementation)
4. **Query helpers** — Only if patterns truly stabilize

Extraction would live at `centers/common-evolu/` with its own `CENTER.md` justifying the workspace.

---

## References

- `centers/cli/CENTER.md` — CLI center definition
- `centers/pwa/CENTER.md` — PWA center definition
- `centers/cli/src/file-sync/evolu-schema.ts` — CLI schema (lines 22-38)
- `centers/pwa/src/evolu/schema.ts` — PWA schema (lines 12-18)
- `centers/sync-invariants/src/contentHash.ts` — canonical SHA-256 (Web Crypto)
- `centers/sync-invariants/src/filesShard.ts` — `FILES_SHARD` for `deriveShardOwner`
- `centers/cli/src/file-sync/hash.ts` — re-exports + `computeFileHash`
- `centers/pwa/src/evolu/contentHash.ts` — optional re-export barrel
- `centers/cli/src/file-sync/evolu-queries.ts` — CLI query patterns
- `centers/pwa/src/evolu/files.ts` — PWA query patterns

---

## Open Questions

- Will a third consumer (mobile, desktop app) emerge?
- How many times will we manually sync schema changes before extraction pays off?
- Should we add a comment in both schema files pointing to each other?

---

*Exploration complete. No artifacts created. Revisit when first drift bug occurs or third consumer appears.*

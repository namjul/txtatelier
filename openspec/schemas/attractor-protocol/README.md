# Attractor Protocol — OpenSpec Custom Schema

A living systems intervention workflow for OpenSpec.
Built on Christopher Alexander's center theory and GSNV epistemic discipline.

## Core idea

Changes are gestures. Implementation is testing. Learning is the goal, not shipping.

## Artifact sequence
```
explore.md        (optional — pre-claim investigation)
  ↓
gesture.md        (the gesture we are making and why we believe it will work)
  ↓
contact-test.md   (how we'll know if the claim is true or false)
  ↓
specs/            (delta specs — what behavior changes)
  ↓
design.md         (technical direction as assumptions)
  ↓
tasks.md          (implementation steps with co-variance notes)
  ↓
[apply]
  ↓
evidence.md       (what actually happened — filled in on contact test timeline)
  ↓
[learn / archive]
```

## Gesture types

- **strengthen** — enhance an existing part of the system
- **create** — introduce something new
- **dissolve** — intentionally remove something
- **repair** — fix broken behavior or feedback
- **revision** — respond to a falsified hypothesis
- **simplify** — reduce complexity
- **feedback** — improve system responsiveness

## Key concepts

- **Gesture** — a deliberate act within a living system, relational and field-aware
- **Claim** — a falsifiable statement about what the gesture will produce
- **Load-bearing assumptions** — beliefs that must be true for the claim to hold
- **Contact test** — how you'll know if the claim is true or false
- **Evidence tier** — proximal (witnessed directly) / medial (reported) / distal (measured)
- **Co-variance** — what else in the system might shift as a result
- **Learning** — a change is learned when evidence.md is filled in, not when code ships

## Installation
```bash
# Copy this schema to your project
cp -r openspec/schemas/attractor-protocol /your-project/openspec/schemas/

# Set as default in your project config
# openspec/config.yaml
schema: attractor-protocol
```

## Notes

- `explore.md` is optional — skip it if you already have a claim
- `evidence.md` has its own timeline defined in `contact-test.md`
- A change should not be archived until `evidence.md` is filled in
- A revision is a new gesture that references the previous evidence
- The `changes/archive/` folder is what we call "learned" — OpenSpec's folder name cannot be customized

## Status

Work in progress. Based on conversations developing AP as an OpenSpec custom schema.

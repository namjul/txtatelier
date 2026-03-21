# Design: {{change-name}}

## Approach
<!--
Describe the technical direction in plain terms.
Not a full spec — just enough to understand the shape of the solution.
-->

## Why this approach?
<!--
What makes this the right direction over alternatives?
If you considered other approaches and rejected them, say why.
Not looking for certainty here — just your current best thinking.
-->

## What are our load-bearing assumptions about the approach?
<!--
State the technical bets you are making.
These are the things that could turn out to be wrong.
If any of these prove false during implementation, update this document.
-->

## Risks and trade-offs
<!--
What could go wrong even if our assumptions hold?
What are we trading off to go in this direction?
A risk is not the same as an assumption — it's what could hurt us
even when we're right about the approach.
-->

## What we are not doing
<!--
Explicitly name approaches or scope you are leaving out.
This prevents scope creep and helps future readers understand the boundaries.
-->

## Known unknowns
<!--
What technical questions are still open?
What might you need to figure out during implementation?
No need to resolve these now — just name them so they don't get forgotten.
-->

## Co-variance: what else might this touch?
<!--
Which parts of the codebase will this touch beyond the obvious?
Think about: what might break, what needs updating, what will behave differently.
Don't overthink — just name what comes to mind.
-->

## ⚠ Design warnings

### Responsiveness
<!--
After this change, can users still tell what their actions did?
Is the system still talking back clearly?
If this intervention introduces delay, ambiguity, or silence
between action and visible response — name it here.
-->

### Continuity after correction
<!--
If a user makes a mistake and corrects it, do they land
somewhere they can continue from — or just somewhere technically restored?
Does the approach preserve enough context that users don't lose their thread?
-->

### Exploratory capacity
<!--
Does this approach narrow what users can discover or do by accident?
Interventions that increase precision often reduce exploration.
If this one does, name that cost explicitly.
-->

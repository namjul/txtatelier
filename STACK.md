# Stack Overview

Framework: SolidJS
Database: Evolu
UI State: ZagJS
Styling: Tailwind CSS + daisyUI
Runtime: Bun

Layering:
- Data → Evolu
- Behavior → ZagJS
- View → SolidJS
- Styling → Tailwind utilities + daisyUI components
- Runtime → Bun

Rules:
- Use signals (SolidJS)
- UI behavior comes from state machines (ZagJS)
- Bun tooling only

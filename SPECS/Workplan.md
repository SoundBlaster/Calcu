# Calcu Workplan

## 1. Overview

This workplan converts the calculator PRD into an implementation-ready task graph for a responsive web application that reproduces the portrait and landscape calculator layouts shown in the root screenshots.

The plan assumes:
- the app is built with `TypeScript 5.9`, `React 19`, `Vite`, `Vitest`, `Biome`, and `CSS Modules`
- calculator behavior follows the immediate-execution model defined in `SPECS/PRD.md`
- portrait and landscape are separate adaptive layouts, not one uniformly scaled layout
- the decimal key is rendered as `,` while the engine stores decimals as `.`
- parentheses support is required for v1

Constraints inherited from the PRD:
- no CSS-in-JS
- no Tailwind
- calculator logic must be isolated from React rendering
- responsive behavior must preserve calculator state across viewport changes
- button styling must remain stable across supported viewport sizes

Non-goals:
- calculation history
- persistent storage
- user accounts or sync
- graphing or equation solving
- arbitrary visible expression editing beyond the calculator interaction model
- localization beyond the labels defined in the PRD

## 2. Phases

### Phase 1 — Foundation and Tooling

Establish the project scaffold, code quality tooling, and styling foundations required by the PRD. This phase removes ambiguity around the stack, scripts, and layout token system before calculator logic begins.

### Phase 2 — Calculator Engine

Implement the typed calculation engine that owns state transitions, standard arithmetic, scientific operations, memory behavior, parentheses handling, and display formatting rules. This phase provides the deterministic core that the UI can consume.

### Phase 3 — Adaptive UI

Build the React components, portrait and landscape key layouts, stable button system, and viewport-mode switching behavior. This phase translates the engine and visual rules into an intentional, screenshot-aligned interface.

### Phase 4 — Verification and Polish

Add keyboard support, test coverage, visual QA, and final readiness checks. This phase ensures the build is dependable, visually stable, and ready for continued task-driven implementation.

## 3. Tasks

## Phase 1 — Foundation and Tooling

#### ✅ P1-T1: Scaffold the Vite React application
- **Description:** Initialize the app shell using Vite with React and TypeScript, create the `src/` structure required by the PRD, and ensure the repo contains a runnable browser app.
- **Priority:** P0
- **Dependencies:** none
- **Parallelizable:** no
- **Outputs/Artifacts:**
  - `package.json`
  - `vite.config.ts`
  - `tsconfig.json`
  - `index.html`
  - `src/`
- **Acceptance Criteria:**
  - [ ] Dependency manifest includes React, React DOM, Vite, and TypeScript
  - [ ] The app starts locally with a documented dev script
  - [ ] The source tree supports the PRD module layout

#### ✅ P1-T2: Configure Biome and project scripts
- **Description:** Add Biome configuration and package scripts for formatting, linting, and repository-level checks consistent with the PRD constraints.
- **Priority:** P0
- **Dependencies:** P1-T1
- **Parallelizable:** yes
- **Outputs/Artifacts:**
  - `biome.json` or equivalent Biome config
  - `package.json` scripts for linting and formatting
- **Acceptance Criteria:**
  - [ ] Biome configuration exists and is valid
  - [ ] Scripts for linting and formatting are available in `package.json`
  - [ ] Running the lint/check script succeeds on the scaffold

#### ✅ P1-T3: Configure Vitest and test entrypoints
- **Description:** Set up Vitest for engine-focused unit testing and establish the initial test directory structure.
- **Priority:** P0
- **Dependencies:** P1-T1
- **Parallelizable:** yes
- **Outputs/Artifacts:**
  - `vitest.config.ts` or Vite-integrated Vitest config
  - test setup file if needed
  - initial test directory structure under `src/` or `tests/`
- **Acceptance Criteria:**
  - [ ] A `test` script exists and runs Vitest
  - [ ] At least one initial test file is discoverable by Vitest
  - [ ] Test execution succeeds on the scaffold

#### ✅ P1-T4: Create calculator feature module boundaries
- **Description:** Create the top-level feature folders and placeholder modules required by the PRD so engine, config, components, and styles evolve independently.
- **Priority:** P0
- **Dependencies:** P1-T1
- **Parallelizable:** yes
- **Outputs/Artifacts:**
  - `src/app/`
  - `src/features/calculator/components/`
  - `src/features/calculator/config/`
  - `src/features/calculator/lib/`
  - `src/features/calculator/model/`
  - `src/features/calculator/styles/`
- **Acceptance Criteria:**
  - [ ] The directory structure matches the PRD architecture section
  - [ ] Placeholder modules exist for engine, types, key definitions, and layout tokens
  - [ ] No calculator logic is embedded in the app shell by default

#### ✅ P1-T5: Define layout tokens and base styling contracts
- **Description:** Establish shared CSS and TypeScript layout tokens for spacing, button sizing, radii, viewport breakpoints, and color roles so the visual system is stable before component styling begins.
- **Priority:** P0
- **Dependencies:** P1-T4
- **Parallelizable:** no
- **Outputs/Artifacts:**
  - `src/features/calculator/config/layoutTokens.ts`
  - base CSS Modules or shared variables file
- **Acceptance Criteria:**
  - [ ] Tokens cover button dimensions, gap scale, radii, colors, and portrait/landscape breakpoints
  - [ ] The token system supports circular buttons and the `0` pill button
  - [ ] Visual constants are centralized rather than scattered through components

## Phase 2 — Calculator Engine

#### ✅ P2-T1: Define typed calculator state and action contracts
- **Description:** Implement the shared types for calculator state, supported actions, operator identifiers, angle mode, `2nd` mode, and error state based on PRD section 6.
- **Priority:** P0
- **Dependencies:** P1-T4
- **Parallelizable:** no
- **Outputs/Artifacts:**
  - `src/features/calculator/model/calculatorTypes.ts`
- **Acceptance Criteria:**
  - [ ] State includes `displayValue`, `storedValue`, pending operator fields, memory value, angle mode, `secondMode`, and error metadata
  - [ ] Types distinguish unary operations, binary operations, memory actions, and layout-driven actions
  - [ ] Type definitions compile without `any`

#### ✅ P2-T2: Implement standard arithmetic state transitions
- **Description:** Implement the core engine for digits, decimal entry, clear, sign toggle, binary operators, equals, and repeated equals using the immediate-execution model.
- **Priority:** P0
- **Dependencies:** P2-T1
- **Parallelizable:** no
- **Outputs/Artifacts:**
  - `src/features/calculator/model/calculatorEngine.ts`
- **Acceptance Criteria:**
  - [ ] Standard input rules from PRD section 6.4 are implemented
  - [ ] Repeated equals uses the last resolved binary operand consistently
  - [ ] Standard operations do not depend on React state APIs

#### ✅ P2-T3: Implement percent, memory, and error rules
- **Description:** Extend the engine with the fixed percent semantics, memory operations, domain error handling, and error-state reset behavior defined in the PRD.
- **Priority:** P0
- **Dependencies:** P2-T2
- **Parallelizable:** yes
- **Outputs/Artifacts:**
  - updates to `calculatorEngine.ts`
  - helper modules for domain checks if needed
- **Acceptance Criteria:**
  - [ ] Percent behavior matches the PRD examples exactly
  - [ ] `mc`, `m+`, `m-`, and `mr` behave according to PRD section 6.10
  - [ ] Invalid operations enter a stable `Error` state

#### ⬜️ P2-T4: Implement scientific unary and binary operations **INPROGRESS**
- **Description:** Add scientific operations for powers, roots, logarithms, factorial, constants, random, trigonometric functions, hyperbolic functions, and inverse variants used by `2nd` mode.
- **Priority:** P0
- **Dependencies:** P2-T1
- **Parallelizable:** yes
- **Outputs/Artifacts:**
  - updates to `calculatorEngine.ts`
  - helper math modules under `src/features/calculator/lib/`
- **Acceptance Criteria:**
  - [ ] Unary and binary scientific operations from PRD sections 6.7, 6.8, and 6.12 are implemented
  - [ ] `Rad` and `Deg` are respected for trig and inverse trig behavior
  - [ ] `EE` and constants integrate with active display entry rules

#### ⬜️ P2-T5: Implement parentheses handling and display formatting
- **Description:** Add the scientific expression stack needed for parentheses support and implement display formatting that preserves readability without layout breakage.
- **Priority:** P0
- **Dependencies:** P2-T2, P2-T4
- **Parallelizable:** no
- **Outputs/Artifacts:**
  - updates to `calculatorEngine.ts`
  - `src/features/calculator/lib/formatDisplay.ts`
- **Acceptance Criteria:**
  - [ ] Parentheses are supported and not treated as disabled placeholders
  - [ ] Display formatting handles long values, decimals, and error tokens safely
  - [ ] Formatting logic is isolated from React rendering logic

## Phase 3 — Adaptive UI

#### ✅ P3-T1: Define portrait, scientific, and `2nd` key metadata
- **Description:** Create data-driven key definitions for portrait mode, scientific mode, and `2nd` mode so the rendered layouts match the PRD row-by-row.
- **Priority:** P0
- **Dependencies:** P1-T4, P2-T1
- **Parallelizable:** yes
- **Outputs/Artifacts:**
  - `src/features/calculator/config/keyDefinitions.ts`
- **Acceptance Criteria:**
  - [ ] Portrait keys include the standard keypad only
  - [ ] Landscape keys match the non-`2nd` and `2nd` row layouts defined in PRD section 6.8
  - [ ] Key metadata captures label, semantic action, style variant, and layout span

#### ✅ P3-T2: Build the display and button primitives
- **Description:** Implement the `Display` and `CalcButton` components using CSS Modules and tokenized styling so the app has stable visual primitives before full keypad composition.
- **Priority:** P0
- **Dependencies:** P1-T5
- **Parallelizable:** yes
- **Outputs/Artifacts:**
  - `src/features/calculator/components/Display.tsx`
  - `src/features/calculator/components/CalcButton.tsx`
  - related `.module.css` files
- **Acceptance Criteria:**
  - [ ] Display is right-aligned and scales text down safely
  - [ ] Button variants cover system, input/scientific, and operator styles
  - [ ] Buttons preserve stable geometry and label centering across interaction states

#### ✅ P3-T3: Build the portrait keypad layout
- **Description:** Implement the portrait keypad grid, including the bottom-weighted standard layout and double-width `0` button, using CSS Modules and key metadata.
- **Priority:** P0
- **Dependencies:** P3-T1, P3-T2, P2-T2
- **Parallelizable:** yes
- **Outputs/Artifacts:**
  - `src/features/calculator/components/Keypad.tsx`
  - portrait layout CSS Module updates
- **Acceptance Criteria:**
  - [ ] Portrait layout matches the screenshot structure
  - [ ] The operator column remains visually dominant
  - [ ] The `0` key renders as a pill without breaking grid rhythm

#### ✅ P3-T4: Build the landscape scientific layout and `2nd` rendering
- **Description:** Implement the landscape keypad grid with scientific rows, `2nd` mode label swaps, and visual density rules from the PRD.
- **Priority:** P0
- **Dependencies:** P3-T1, P3-T2, P2-T4, P2-T5
- **Parallelizable:** yes
- **Outputs/Artifacts:**
  - updates to `Keypad.tsx`
  - landscape layout CSS Module updates
- **Acceptance Criteria:**
  - [ ] Landscape rows match the PRD in normal and `2nd` modes
  - [ ] Scientific keys keep stable sizing and spacing across wide viewports
  - [ ] `2nd` mode has a clear active-state treatment

#### ✅ P3-T5: Compose the calculator feature and viewport switching
- **Description:** Wire the engine, key metadata, display, keypad, and viewport-mode detection into the `Calculator` feature so portrait and landscape layouts preserve a single state model.
- **Priority:** P0
- **Dependencies:** P2-T3, P2-T5, P3-T3, P3-T4
- **Parallelizable:** no
- **Outputs/Artifacts:**
  - `src/features/calculator/components/Calculator.tsx`
  - `src/app/` integration files
- **Acceptance Criteria:**
  - [ ] Viewport mode changes do not reset calculator state
  - [ ] Button presses dispatch into the engine rather than embedding math logic in components
  - [ ] The app renders a complete usable calculator in both portrait and landscape modes

## Phase 4 — Verification and Polish

#### ✅ P4-T1: Add keyboard input handling
- **Description:** Implement desktop keyboard support for digits, decimal, operators, equals, clear, and backspace using the PRD input mapping.
- **Priority:** P1
- **Dependencies:** P3-T5
- **Parallelizable:** yes
- **Outputs/Artifacts:**
  - keyboard input handler module or hook
  - updates to `Calculator.tsx`
- **Acceptance Criteria:**
  - [ ] Supported keys map to the expected calculator actions
  - [ ] Backspace behavior matches the PRD
  - [ ] Keyboard input uses the same engine pathways as button input

#### ⬜️ P4-T2: Write engine tests for standard and scientific behavior
- **Description:** Add Vitest coverage for standard arithmetic, percent semantics, scientific functions, memory behavior, `Rad`/`Deg`, `2nd` mode operation mapping, parentheses, and error handling.
- **Priority:** P0
- **Dependencies:** P2-T3, P2-T4, P2-T5, P1-T3
- **Parallelizable:** yes
- **Outputs/Artifacts:**
  - engine test files under `src/` or `tests/`
- **Acceptance Criteria:**
  - [ ] All critical engine rules from PRD section 6 have automated tests
  - [ ] Percent examples from the PRD are encoded as fixtures
  - [ ] Parentheses and error-state transitions are covered

#### ⬜️ P4-T3: Verify visual stability across supported viewport sizes
- **Description:** Perform structured visual QA on narrow portrait, mobile landscape, tablet-sized, and desktop-sized windows to confirm stable button proportions, spacing, and layout hierarchy.
- **Priority:** P0
- **Dependencies:** P3-T5
- **Parallelizable:** yes
- **Outputs/Artifacts:**
  - visual QA checklist or notes in `SPECS/INPROGRESS/` when executed
  - CSS tuning updates if needed
- **Acceptance Criteria:**
  - [ ] Buttons keep consistent proportions and alignment across the target viewport classes
  - [ ] Portrait and landscape each feel intentionally designed rather than auto-scaled
  - [ ] Extra screen width does not produce a weak, undersized calculator region

#### ⬜️ P4-T4: Add accessibility and interaction-state checks
- **Description:** Verify accessible button semantics, visible focus states, and stable press/hover/focus styling for all button families.
- **Priority:** P1
- **Dependencies:** P3-T2, P3-T5
- **Parallelizable:** yes
- **Outputs/Artifacts:**
  - accessibility-related component updates
  - optional tests if introduced
- **Acceptance Criteria:**
  - [ ] Interactive controls use accessible button semantics
  - [ ] Focus visibility is preserved for keyboard navigation
  - [ ] Interaction states do not shift button size or layout

#### ⬜️ P4-T5: Finalize readiness scripts and developer guidance
- **Description:** Ensure the repository exposes the scripts and minimal documentation needed to run, lint, and test the calculator app consistently.
- **Priority:** P1
- **Dependencies:** P1-T2, P1-T3, P4-T2
- **Parallelizable:** yes
- **Outputs/Artifacts:**
  - `package.json` script finalization
  - `README.md` or equivalent local usage notes if created
- **Acceptance Criteria:**
  - [ ] Developers can identify how to run, lint, and test the app without guesswork
  - [ ] Script names are consistent with the tooling configured in Phase 1
  - [ ] The documented workflow reflects the implemented stack accurately

#### ✅ P4-T6: Refine wide `0` key label alignment
- **Description:** Fix the optical alignment of the wide `0` key so the `0` glyph sits directly under the `1` column instead of drifting because the pill button is wider than the standard digit buttons.
- **Priority:** P1
- **Dependencies:** P3-T5
- **Parallelizable:** yes
- **Outputs/Artifacts:**
  - button alignment CSS updates
  - keypad layout tuning if needed
- **Acceptance Criteria:**
  - [ ] The `0` label aligns optically with the left digit column, especially relative to the `1` key above it
  - [ ] Standard and wide buttons use a shared padding or content-alignment strategy instead of a one-off `0` offset
  - [ ] The alignment fix preserves centered labels on single-width buttons and keeps the `0` pill visually balanced

#### ⬜️ P4-T7: Prevent Enter from double-dispatching focused calculator buttons
- **Description:** Ensure the global keyboard handler does not duplicate native button activation when `Enter` is pressed on a focused calculator button.
- **Priority:** P1
- **Dependencies:** P4-T1
- **Parallelizable:** yes
- **Outputs/Artifacts:**
  - keyboard listener guard updates
  - regression test coverage for focused button Enter handling
- **Acceptance Criteria:**
  - [ ] Pressing `Enter` on a focused calculator button triggers a single calculator action
  - [ ] Global keyboard support remains available for calculator shortcuts when no interactive control should handle the key
  - [ ] Regression coverage proves the focused-button path does not double-dispatch

## 4. Traceability

| PRD Area | Covered By |
|---|---|
| Stack and tool constraints | P1-T1, P1-T2, P1-T3 |
| Module boundaries and maintainability | P1-T4, P1-T5, P2-T1, P3-T5 |
| Standard arithmetic behavior | P2-T2, P4-T2 |
| Percent and memory semantics | P2-T3, P4-T2 |
| Scientific functions and `2nd` mode | P2-T4, P3-T1, P3-T4, P4-T2 |
| Parentheses support | P2-T5, P4-T2 |
| Responsive adaptive layout | P1-T5, P3-T3, P3-T4, P3-T5, P4-T3 |
| Stable button styling | P1-T5, P3-T2, P3-T3, P3-T4, P4-T3, P4-T4 |
| Keyboard support | P4-T1 |
| Accessibility and focus states | P3-T2, P4-T4 |

## 5. Dependency Notes

- Phase 1 tasks establish the scaffold, tools, and visual token system required by later work.
- The engine tasks form a directed acyclic graph: standard behavior first, then percent/memory, then scientific behavior, then parentheses and formatting.
- UI tasks split cleanly between key metadata, visual primitives, portrait layout, and landscape layout before final composition.
- Verification tasks run in parallel where possible after the composed calculator exists.

## 6. Follow-up Tasks

#### ⬜️ FU-T1: Normalize calculator task IDs against existing archive history
- **Description:** Introduce a stable calculator-specific task ID naming approach or archive migration so newly archived calculator tasks cannot collide with legacy Flow task IDs already present in `SPECS/ARCHIVE/INDEX.md`.
- **Priority:** P1
- **Dependencies:** none
- **Parallelizable:** yes
- **Outputs/Artifacts:**
  - updated `SPECS/Workplan.md` task IDs or documented namespace policy
  - updated `SPECS/ARCHIVE/INDEX.md` references if migration is performed
- **Acceptance Criteria:**
  - [ ] Archived calculator tasks are uniquely identifiable without ambiguous duplicate task IDs
  - [ ] `next.md`, archive entries, and future PRDs can reference calculator tasks unambiguously
  - [ ] The chosen naming policy is documented in repository workflow artifacts

#### ⬜️ FU-T2: Re-scope remaining Phase 1 setup tasks after scaffold delivery
- **Description:** Reconcile `P1-T2`, `P1-T3`, and `P1-T4` with the work already delivered in `P1-T1` so future FLOW runs do not duplicate completed setup work.
- **Priority:** P1
- **Dependencies:** none
- **Parallelizable:** yes
- **Outputs/Artifacts:**
  - updated `SPECS/Workplan.md`
  - updated task descriptions, statuses, or replacements for remaining Phase 1 tasks
- **Acceptance Criteria:**
  - [ ] Remaining Phase 1 tasks no longer duplicate delivered scaffold work
  - [ ] Each open setup task has a distinct deliverable boundary
  - [ ] The next selectable task is clear and execution-ready

# PRD: Calcu

## 1. Objective

Build a browser-based calculator application that reproduces the interaction model and visual hierarchy shown in the root screenshots:
- portrait standard calculator
- landscape scientific calculator
- landscape scientific calculator with `2nd` mode enabled

The application must be implementation-ready for a single-page frontend built with:
- `TypeScript 5.9`
- `React 19`
- `Vite`
- `Vitest`
- `Biome`
- `CSS Modules`

The application must not use:
- CSS-in-JS
- Tailwind

## 2. Scope

### 2.1 In Scope

- Standard arithmetic calculator in portrait layout
- Scientific calculator in landscape layout
- `2nd` function toggle in landscape layout
- `Rad` and `Deg` angle modes
- Memory functions: `mc`, `m+`, `m-`, `mr`
- Keyboard input for core calculator actions
- Unit-tested calculator engine separated from UI
- Responsive layout that preserves calculator state across viewport changes

### 2.2 Out of Scope

- Calculation history
- Persistent storage
- User accounts or sync
- Graphing or equation solving
- Arbitrary expression editing with a visible formula editor
- Localization beyond the exact labels specified in this document

## 3. Deliverables

| Deliverable | Description | Done When |
|---|---|---|
| App scaffold | Vite + React 19 + TypeScript 5.9 project with Biome and Vitest configured | `npm run dev`, `npm run test`, `npm run check` or equivalent all work |
| Calculator engine | Pure calculation/state transition layer for standard and scientific operations | Engine is covered by unit tests |
| UI implementation | Portrait and landscape calculator layouts matching screenshots | Layouts render correctly and preserve state |
| Styling system | CSS Modules-based styling with reusable design tokens | No inline style system or utility CSS framework is required for core styling |
| Test suite | Vitest coverage for calculation rules and major UI state transitions | All required test cases pass |

## 4. Success Criteria

- Portrait mode visually maps to the mobile screenshot.
- Landscape mode visually maps to the scientific screenshots.
- `2nd` mode swaps the affected scientific keys and execution mapping.
- Calculator results are deterministic for all supported operations.
- Rotation or viewport aspect change does not reset the current value.
- The implementation remains maintainable because calculator logic is isolated from React rendering.
- The visual system remains stable across viewport changes: buttons keep consistent proportions, spacing, and hierarchy.
- The layout feels intentional and dense rather than like a generic responsive web form.

## 5. Constraints, Assumptions, Dependencies

### 5.1 Constraints

- Use `React 19` function components only.
- Use `TypeScript` with strict typing enabled.
- Use `CSS Modules` for component and feature styling.
- Use `Vitest` for automated tests.
- Use `Biome` for formatting and linting.

### 5.2 Assumptions

- Responsive layout is controlled by viewport aspect ratio, not device-orientation APIs.
- The decimal key and display use `,` to match the screenshots, while the engine stores decimal values using `.` internally.
- The first release targets modern evergreen browsers.
- Calculation behavior follows an immediate-execution calculator model, not a full algebraic parser.

### 5.3 External Dependencies

- Node.js runtime suitable for the chosen Vite/React toolchain
- Browser support for modern CSS layout primitives and ES modules

## 6. Product Behavior

### 6.1 Layout Modes

| Mode | Trigger | Visible Keys |
|---|---|---|
| Portrait standard | `viewport width < viewport height` | Standard keypad only |
| Landscape scientific | `viewport width >= viewport height` | Standard keypad + scientific keypad |

Viewport changes must preserve:
- current display value
- pending operator
- memory value
- angle mode
- `2nd` mode

### 6.2 Display Behavior

- Display is right-aligned.
- Default display value is `0`.
- Display shows the current input or the latest resolved result.
- Display text must scale down to avoid overflow.
- Display must not clip significant digits silently.
- Error states must show a stable error token such as `Error`.
- `AC` clears error state and returns the display to `0`.
- The display block must remain visually anchored to the keypad, with no large accidental gaps introduced by viewport resizing.

### 6.2.1 Visual Layout Rules

- The app occupies the full viewport with a black background and no card container.
- The calculator layout must be edge-aware and use deliberate inner padding rather than centered floating panels.
- Portrait layout prioritizes large thumb-friendly controls and a bottom-weighted keypad.
- Landscape layout prioritizes dense horizontal efficiency without shrinking controls to visually weak sizes.
- The transition between portrait and landscape must be adaptive, not just scaled; grid definitions, spacing, and button sizing may change by mode.
- Key rows must stay visually aligned across the full width of the calculator region.
- Spacing must be consistent within a mode and intentionally tuned between modes.
- The operator column must remain visually dominant in both portrait and landscape.
- The display, keypad, and operator column must read as one system rather than separate blocks.
- Long results must reduce font size before they break button alignment or container rhythm.

### 6.2.2 Button Design Rules

- All calculator buttons must have a stable shape language:
  - circular buttons for standard single-cell controls
  - pill button for `0`
- Button dimensions must be driven by layout tokens, not ad hoc per-button values.
- Buttons must preserve consistent height, width, radius, and label centering within the same variant.
- Color roles are fixed:
  - system buttons: light gray background, dark text
  - input/scientific buttons: dark gray background, light text
  - operator buttons: orange background, white text
- Button labels must remain optically centered, including symbols such as `÷`, `×`, `+/-`, and superscript-style labels.
- Pressed, hover, and focus states must be subtle and consistent across all button families.
- Buttons must not wobble, resize, or shift neighboring buttons on interaction.
- Buttons must keep crisp edges and spacing across common device pixel ratios.

### 6.3 Interaction Model

The calculator uses an immediate-execution model with these state concepts:
- `displayValue`
- `storedValue`
- `pendingBinaryOperator`
- `lastBinaryOperator`
- `lastBinaryOperand`
- `memoryValue`
- `angleMode`
- `secondMode`
- `replaceDisplayOnNextDigit`
- `errorState`

### 6.4 Standard Input Rules

- Digits append to the active operand unless `replaceDisplayOnNextDigit` is `true`.
- Entering a digit while display is `0` replaces `0`, except when entering another `0` with no decimal point.
- Decimal input inserts `.` internally and must not create duplicate decimals.
- Pressing `+/-` negates the active display value.
- Pressing `AC` resets the entire calculator state.
- Pressing a binary operator stores the current display value, resolves any pending binary operator first, and arms the next operand entry.
- Pressing `=` resolves the current pending binary operator.
- Repeated `=` repeats the last binary operation using the last resolved right operand.

### 6.5 Percent Semantics

Percent behavior is fixed as follows:
- If there is no pending binary operator, `%` converts the current display value to `displayValue / 100`.
- If there is a pending binary operator with `storedValue`, `%` converts the current display value to `storedValue * displayValue / 100`.
- `%` is unary and applies to the active display value before final binary evaluation.

Examples:
- `50 %` => `0.5`
- `200 + 10 %` => active right operand becomes `20`, then `=` yields `220`
- `200 × 10 %` => active right operand becomes `20`, then `=` yields `4000`

### 6.6 Standard Function Set

Portrait and landscape must include:
- `AC`
- `+/-`
- `%`
- `÷`
- digits `0-9`
- decimal key labeled `,`
- `×`
- `-`
- `+`
- `=`

UI rule:
- `0` is rendered as a double-width pill key

### 6.7 Scientific Function Set

Landscape must additionally include:
- `(`
- `)`
- `mc`
- `m+`
- `m-`
- `mr`
- `2nd`
- `x!`
- `x²`
- `x³`
- `xʸ`
- `yˣ`
- `2ˣ`
- `10ˣ`
- `eˣ`
- `¹/x`
- `²√x`
- `³√x`
- `ʸ√x`
- `ln`
- `log₁₀`
- `logᵧ`
- `log₂`
- `sin`
- `cos`
- `tan`
- `sinh`
- `cosh`
- `tanh`
- `e`
- `EE`
- `π`
- `Rand`
- `Rad` or `Deg`

### 6.8 `2nd` Mode Mapping

When `2nd` mode is off:
- The scientific rows must render exactly as:

| Row | Keys |
|---|---|
| 1 | `(`, `)`, `mc`, `m+`, `m-`, `mr`, `AC`, `+/-`, `%`, `÷` |
| 2 | `2nd`, `x²`, `x³`, `xʸ`, `eˣ`, `10ˣ`, `7`, `8`, `9`, `×` |
| 3 | `¹/x`, `²√x`, `³√x`, `ʸ√x`, `ln`, `log₁₀`, `4`, `5`, `6`, `-` |
| 4 | `x!`, `sin`, `cos`, `tan`, `e`, `EE`, `1`, `2`, `3`, `+` |
| 5 | `Rad`, `sinh`, `cosh`, `tanh`, `π`, `Rand`, `0`, `,`, `=` |

When `2nd` mode is on:
- The scientific rows must render exactly as:

| Row | Keys |
|---|---|
| 1 | `(`, `)`, `mc`, `m+`, `m-`, `mr`, `AC`, `+/-`, `%`, `÷` |
| 2 | `2nd`, `x²`, `x³`, `xʸ`, `yˣ`, `2ˣ`, `7`, `8`, `9`, `×` |
| 3 | `¹/x`, `²√x`, `³√x`, `ʸ√x`, `logᵧ`, `log₂`, `4`, `5`, `6`, `-` |
| 4 | `x!`, `sin⁻¹`, `cos⁻¹`, `tan⁻¹`, `e`, `EE`, `1`, `2`, `3`, `+` |
| 5 | `Deg`, `sinh⁻¹`, `cosh⁻¹`, `tanh⁻¹`, `π`, `Rand`, `0`, `,`, `=` |

Operation mapping must follow the rendered labels exactly.

Implementation rule:
- The rendered layout must follow the screenshots exactly, even if the internal mapping is defined by a configuration object.

### 6.9 Angle Mode

- `Rad` means trigonometric inputs are interpreted as radians.
- `Deg` means trigonometric inputs are interpreted as degrees.
- Inverse trigonometric outputs must be emitted in the currently selected angle mode.

### 6.10 Memory Behavior

- `mc` sets memory to `0`.
- `m+` adds current display value to memory.
- `m-` subtracts current display value from memory.
- `mr` recalls memory into the display and sets `replaceDisplayOnNextDigit` to `true`.

### 6.11 Parentheses and Expression Scope

- Parentheses are included in scope and must be supported by the calculation engine using a dedicated expression stack for landscape scientific mode.
- Parentheses are not optional for v1.
- Parentheses support must be covered by automated tests.

### 6.12 Scientific Operation Rules

Unary functions operate on the active display value immediately:
- square
- cube
- reciprocal
- roots
- natural log
- base-10 log
- base-2 log
- trigonometric functions
- hyperbolic functions
- constants insertion where applicable

Binary scientific functions create a pending operator or stack action:
- `xʸ`
- `yˣ`
- `logᵧ`
- `ʸ√x`

Constants:
- `π` inserts the mathematical constant pi into the active display
- `e` inserts Euler's number into the active display
- `Rand` inserts a random value `r` where `0 <= r < 1`
- `EE` inserts exponent-entry mode equivalent to scientific notation input

### 6.13 Keyboard Support

Desktop keyboard support must include:

| Input | Action |
|---|---|
| `0-9` | digit input |
| `.` | decimal input mapped to the `,` UI separator |
| `+` | addition |
| `-` | subtraction |
| `*` | multiplication |
| `/` | division |
| `Enter` | equals |
| `=` | equals |
| `Escape` | all clear |
| `Backspace` | delete last digit from active display |

Backspace behavior:
- If the active display has one digit left, it becomes `0`.
- If the active display is showing a resolved result and no new entry has started, backspace is ignored.

## 7. User Flows

### 7.1 Standard Arithmetic Flow

1. User opens the app in portrait mode.
2. Display shows `0`.
3. User enters first operand.
4. User selects binary operator.
5. User enters second operand.
6. User presses `=`.
7. Display shows resolved result.

### 7.2 Scientific Function Flow

1. User opens or resizes to landscape mode.
2. Current calculator state remains visible.
3. User enters a value.
4. User presses a unary scientific function such as `sin`.
5. Display updates immediately with the computed result.

### 7.3 `2nd` Mode Flow

1. User enters landscape mode.
2. User presses `2nd`.
3. Affected keys update labels and operation bindings.
4. User presses an inverse or alternate function.
5. Calculation executes using the `2nd` mapping.

### 7.4 Memory Recall Flow

1. User computes or enters a value.
2. User presses `m+` or `m-`.
3. User presses `mr`.
4. Display updates with memory value.

## 8. Edge Cases and Failure Scenarios

The implementation must explicitly handle:
- division by zero
- reciprocal of zero
- invalid log domain values
- invalid square root domain values for real-number mode
- tangent singularities or floating-point overflow
- repeated `=` after unary operations
- orientation change during partial expression entry
- memory recall while a binary operator is pending
- multiple decimal presses
- entering scientific notation with `EE`
- exceeding safe display length

Failure handling rules:
- Invalid operations result in `Error`.
- `Error` blocks further math operations until cleared or replaced by a fresh digit entry if that behavior is intentionally implemented and tested.
- Floating-point precision artifacts may be rounded for display, but internal tests must define expected precision rules.

## 9. Non-Functional Requirements

### 9.1 Performance

- First interactive render on a local development machine should feel immediate.
- Button press to visual response should occur within one frame under normal conditions.
- Calculator engine operations must be synchronous and complete in under `16ms` for supported operations.

### 9.2 Maintainability

- UI components must not embed arithmetic logic directly.
- Calculator engine must be testable without rendering React.
- Scientific key definitions should be data-driven where practical.
- Layout tokens for spacing, sizing, and radii must be centralized so visual changes do not require scattered edits.

### 9.3 Accessibility

- All interactive controls must be actual `button` elements unless a justified exception is documented.
- Buttons must have accessible names matching their visible labels or semantic actions.
- Focus state must remain visible on keyboard navigation.
- Color contrast must remain sufficient against the black background.

### 9.4 Reliability

- State transitions must be deterministic.
- Orientation change must not lose active state.
- Unsupported operations must fail into a defined error state, never silently corrupt state.

### 9.5 Responsive Visual Stability

- Portrait and landscape must each have dedicated layout rules rather than relying on uniform scaling.
- Button size changes between breakpoints must be tokenized and predictable.
- The layout must remain visually balanced across:
  - narrow mobile portrait
  - mobile landscape
  - tablet-sized browser windows
  - desktop browser windows
- Extra horizontal space on large screens must not create a weak, undersized calculator; the calculator region may cap at a designed maximum width while preserving the screenshot-inspired composition.
- Controls must remain easy to tap on touch devices and easy to target with a pointer on desktop.
- The button grid must not collapse into uneven columns or inconsistent row heights.

## 10. Technical Architecture

### 10.1 Recommended Directory Structure

- `src/app/`
- `src/app/providers/`
- `src/features/calculator/components/`
- `src/features/calculator/config/`
- `src/features/calculator/lib/`
- `src/features/calculator/model/`
- `src/features/calculator/styles/`

### 10.2 Required Modules

| Module | Responsibility |
|---|---|
| `calculatorEngine.ts` | Pure state transitions and operation execution |
| `calculatorTypes.ts` | Shared types and state contracts |
| `keyDefinitions.ts` | Portrait/scientific/second-mode key metadata |
| `formatDisplay.ts` | Display formatting and overflow control |
| `layoutTokens.ts` | Shared sizing, spacing, radius, and breakpoint constants |
| `Calculator.tsx` | Feature composition |
| `Display.tsx` | Display rendering only |
| `Keypad.tsx` | Key grid rendering and layout mode selection |
| `CalcButton.tsx` | Reusable button primitive |

### 10.3 State Ownership

- React owns UI state wiring and event dispatch.
- The engine owns math state transitions.
- CSS Modules own visual layout and variant styling.

## 11. Structured Execution Plan

### Phase 1: Project Scaffold

| Task ID | Task | Priority | Effort | Dependencies | Parallel | Inputs | Output | Verification |
|---|---|---|---|---|---|---|---|---|
| P1 | Scaffold Vite React app with TypeScript 5.9 | High | 1 | none | no | toolchain requirements | working app shell | app starts locally |
| P2 | Configure Biome and Vitest | High | 1 | P1 | yes | scaffolded repo | lint/test scripts | lint and test commands run |
| P3 | Add CSS Modules setup and base tokens | High | 1 | P1 | yes | visual requirements | global and modular styling foundation | styles import correctly |

### Phase 2: Calculator Engine

| Task ID | Task | Priority | Effort | Dependencies | Parallel | Inputs | Output | Verification |
|---|---|---|---|---|---|---|---|---|
| E1 | Define typed calculator state and actions | High | 1 | P1 | no | sections 6 and 10 | state contracts | types compile |
| E2 | Implement standard arithmetic transitions | High | 2 | E1 | no | standard input rules | standard engine behavior | unit tests pass |
| E3 | Implement percent, repeated equals, sign toggle, clear rules | High | 2 | E2 | yes | sections 6.4 and 6.5 | deterministic standard behavior | unit tests pass |
| E4 | Implement scientific unary and binary operations | High | 3 | E1 | no | sections 6.7 to 6.12 | scientific engine behavior | unit tests pass |
| E5 | Implement parentheses and scientific stack handling | Medium | 3 | E4 | no | section 6.11 | grouped scientific evaluation | unit tests pass |
| E6 | Implement display formatting and error handling | High | 1 | E2 | yes | display rules | stable visible output | snapshot or unit tests pass |

### Phase 3: UI Composition

| Task ID | Task | Priority | Effort | Dependencies | Parallel | Inputs | Output | Verification |
|---|---|---|---|---|---|---|---|---|
| U1 | Build display component | High | 1 | P3, E6 | yes | display rules | display UI | manual render check |
| U2 | Build reusable button component | High | 1 | P3 | yes | visual direction | button primitive | manual render check |
| U3 | Build portrait keypad layout | High | 2 | U2, E2 | yes | portrait screenshot | portrait UI | visual comparison |
| U4 | Build landscape scientific keypad layout | High | 2 | U2, E4 | yes | landscape screenshots | scientific UI | visual comparison |
| U5 | Wire engine to UI and orientation switching | High | 2 | U1, U3, U4, E6 | no | layout rules | interactive calculator app | manual interaction check |
| U6 | Implement tokenized responsive layout rules and stable button states | High | 2 | U2, U3, U4 | no | sections 6.2.1 and 6.2.2 | adaptive visual system | breakpoint review and interaction check |

### Phase 4: Input, QA, Polish

| Task ID | Task | Priority | Effort | Dependencies | Parallel | Inputs | Output | Verification |
|---|---|---|---|---|---|---|---|---|
| Q1 | Add keyboard input handling | Medium | 1 | U5 | yes | keyboard table | desktop keyboard support | manual and unit tests |
| Q2 | Write engine test suite | High | 2 | E2, E3, E4, E5, E6 | yes | behavior rules | Vitest coverage | tests pass |
| Q3 | Add accessibility assertions for critical controls | Medium | 1 | U5 | yes | accessibility requirements | accessible buttons and focus flow | test/manual check |
| Q4 | Tune layout fidelity against screenshots | High | 2 | U5 | no | screenshots | final visual polish | side-by-side manual check |

## 12. Verification Matrix

| Requirement | Verification Method |
|---|---|
| Standard arithmetic works | engine unit tests |
| Percent semantics are correct | engine unit tests with explicit fixtures |
| `2nd` mode swaps labels and behavior | UI render tests or config tests + engine tests |
| `Rad` / `Deg` affects trig results | engine unit tests |
| Landscape preserves state | component test or manual QA checklist |
| Button styling remains stable across breakpoints | manual visual QA checklist |
| Portrait and landscape each feel intentional rather than auto-scaled | side-by-side screenshot comparison |
| CSS Modules only | code review and repo structure inspection |
| No Tailwind or CSS-in-JS | dependency and source inspection |

## 13. Acceptance Criteria

- A developer can clone the repo, install dependencies, and start the app without undocumented steps.
- Portrait layout contains the standard calculator keypad and display.
- Landscape layout contains the scientific keypad shown in the screenshots.
- `2nd` mode changes the expected labels and executes alternate scientific functions.
- Standard arithmetic, memory, and scientific operations behave according to sections 6.4 through 6.12.
- `Rad` and `Deg` modes affect trig and inverse trig calculations correctly.
- Display formatting prevents layout breakage for long values.
- Buttons preserve consistent shape, spacing, hierarchy, and interaction states across supported viewport sizes.
- Portrait and landscape layouts each look designed for their mode rather than mechanically stretched.
- The calculator engine is covered by automated tests for all critical operations.
- All styling is implemented with CSS Modules.
- No CSS-in-JS or Tailwind dependency is required by the implementation.

## 14. Implementation Decisions Locked for Build

- The UI must render the decimal separator as `,`.
- The engine must normalize decimal input to `.` internally.
- Parentheses support is mandatory for v1.
- Engine tests are mandatory; component tests are recommended but not required unless they validate viewport-mode persistence or `2nd`-mode rendering behavior.

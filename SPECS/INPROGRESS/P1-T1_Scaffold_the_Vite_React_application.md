# Task PRD — P1-T1 Scaffold the Vite React application

## Scope

Create the initial frontend application scaffold for Calcu using the stack defined in `SPECS/PRD.md`:
- `TypeScript 5.9`
- `React 19`
- `Vite`
- `Vitest`
- `Biome`
- `CSS Modules`

This task exists to unlock visual-first implementation work. It must provide a runnable app shell and source structure for later layout, button, and responsive styling tasks, but it must not implement calculator logic.

## Deliverables

- `package.json` with the required frontend dependencies and scripts
- Vite configuration for a React + TypeScript application
- TypeScript configuration files
- HTML entrypoint and React bootstrap files
- Base source tree matching the calculator feature boundaries in `SPECS/PRD.md`
- Minimal app shell rendering successfully in the browser

## Dependencies

- none

## Constraints

- No CSS-in-JS
- No Tailwind
- Do not implement calculator arithmetic in this task
- Keep styling minimal and structural only; detailed visual system work belongs to later tasks

## Execution Plan

1. Create the frontend package manifest and dependency set.
2. Add Vite and TypeScript configuration files.
3. Add React entrypoint files and application shell.
4. Create the initial source folders for `app`, `components`, `config`, `lib`, `model`, and `styles`.
5. Add a minimal CSS-based app frame that confirms the scaffold renders.

## Acceptance Criteria

- `npm install` succeeds
- `npm run dev` starts the application successfully
- `npm run test` executes without configuration failures
- `npm run lint` or equivalent repository check runs successfully
- The browser renders a minimal application shell from the new React entrypoint
- The source tree supports later calculator visual tasks without restructuring

## Out of Scope

- Calculator engine implementation
- Scientific operations
- Responsive keypad design
- Final button styling
- Visual fidelity to screenshots beyond a minimal shell

# SPECS — Flow Distribution Specs

This folder contains the versioned specification bundle that `install.sh` copies into target repositories.

## Folder Structure

```
SPECS/
├── README.md                # This file
├── VERSION                  # Current Flow version
├── COMMANDS/                # Workflow command specs
│   ├── README.md
│   ├── FLOW.md
│   ├── SETUP.md
│   ├── SELECT.md
│   ├── PLAN.md
│   ├── EXECUTE.md
│   ├── ARCHIVE.md
│   ├── REVIEW.md
│   ├── PROGRESS.md
│   └── PRIMITIVES/
│       ├── COMMIT.md
│       ├── ARCHIVE_TASK.md
│       ├── FOLLOW_UP.md
│       ├── DOCS.md
│       └── REFACTORING.md
└── ROLES/                   # Reusable role prompts shipped with Flow
```

## Installed Files in a Target Repo

When you run `install.sh`, Flow copies the `SPECS/COMMANDS/` and `SPECS/ROLES/` folders managed by Flow, then creates user-owned workflow files from `templates/` when missing:

- `SPECS/Workplan.md`
- `SPECS/ARCHIVE/INDEX.md`
- `SPECS/INPROGRESS/next.md`
- `.flow/` (for `.flow/params.yaml`, created by SETUP)

## Configuration Model

Project configuration lives in `.flow/params.yaml` (outside `SPECS/`). This is the single configuration file consumed by commands such as SETUP, EXECUTE, and REVIEW.

Commands reference it as `[Params](.flow/params.yaml)`.

## Maintainer Notes

- Keep `SPECS/VERSION` aligned with `**Version:**` headers in command docs.
- Run `make test` before submitting changes.
- Keep command docs and install behavior aligned with `README.md` and `AGENTS.md`.

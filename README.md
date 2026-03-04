# openspec — AI Development Template

A reusable base template for AI-assisted development with Claude Code. Includes specs, agents, and commands for serverless TypeScript backends and Next.js frontends.

## Stack

| Layer | Technology |
|---|---|
| Backend | Serverless Framework v3 · TypeScript · AWS Lambda · API Gateway · DynamoDB |
| Frontend | Next.js (App Router) · TypeScript · Tailwind CSS |
| Testing | Jest · React Testing Library · Playwright |

## What's included

```
openspec/
├── config.yaml                   # AI context: stack, conventions, rules
├── specs/
│   ├── base-standards.mdc        # Core principles for all agents
│   ├── backend-standards.mdc     # DDD architecture, Lambda, DynamoDB, testing
│   ├── frontend-standards.mdc    # Next.js App Router, Tailwind, components
│   ├── documentation-standards.mdc
│   ├── api-spec.yml              # OpenAPI 3.0 template
│   ├── data-model.md             # DynamoDB single-table design template
│   └── development_guide.md      # Setup and deploy guide
├── .agents/
│   ├── backend-developer.md      # Plans backend features (DDD + Lambda)
│   ├── frontend-developer.md     # Plans frontend features (Next.js + Tailwind)
│   └── product-strategy-analyst.md
└── .commands/
    ├── plan-backend-ticket.md
    ├── plan-frontend-ticket.md
    ├── develop-backend.md
    ├── develop-frontend.md
    ├── commit.md
    ├── enrich-us.md
    ├── explain.md
    ├── meta-prompt.md
    └── update-docs.md
```

## Usage

### 1. Copy into your project

```bash
cp -r openspec/ your-project/
cp CLAUDE.md your-project/
```

### 2. Update project-specific files

| File | What to update |
|---|---|
| `CLAUDE.md` | Section 3 — project name and description |
| `openspec/config.yaml` | Project context if needed |
| `openspec/specs/api-spec.yml` | Your API endpoints |
| `openspec/specs/data-model.md` | Your DynamoDB schema |
| `openspec/specs/development_guide.md` | Your setup steps |

### 3. Use the commands

```bash
# Enrich a ticket before planning
/enrich-us TICKET-123

# Generate an implementation plan
/plan-backend-ticket TICKET-123
/plan-frontend-ticket TICKET-123

# Implement following the plan
/develop-backend TICKET-123
/develop-frontend TICKET-123

# Commit and open PR
/commit TICKET-123

# Update documentation after changes
/update-docs

# Explain a concept
/explain "What is single-table design?"

# Improve a prompt
/meta-prompt "your rough prompt here"
```

### Typical workflow

```
/enrich-us TICKET-123            → refine the story
/plan-backend-ticket TICKET-123  → generate step-by-step plan
/develop-backend TICKET-123      → implement (reads the plan, follows TDD)
/commit TICKET-123               → conventional commit + PR
```

Plans are saved to `openspec/changes/`.

## Architecture

### Backend (DDD layers)

```
src/
├── presentation/handlers/    # Lambda handlers — no business logic
├── application/services/     # Orchestration — no AWS SDK imports
├── application/validators/   # unknown → typed object | ValidationError
├── domain/models/            # Entities — zero external dependencies
├── domain/repositories/      # Interfaces only
├── infrastructure/dynamodb/  # AWS SDK v3, DynamoDBDocumentClient
└── infrastructure/errors/    # AppError, ValidationError
```

### Frontend (Next.js App Router)

```
app/[route]/page.tsx      # Server Component — async, fetches data directly
components/ui/            # Primitive presentational components
components/[feature]/     # Feature-specific components
lib/api/                  # API service modules — all fetch calls go here
hooks/                    # Client-side custom hooks
types/                    # Shared TypeScript interfaces
```

## Standards

- **TDD** — failing test first, always
- **Coverage** — 90% minimum (branches, functions, lines, statements)
- **TypeScript** — strict mode, no `any`
- **Commits** — Conventional Commits (`feat(scope): description`)
- **Branches** — `feature/[ticket-id]-backend` / `feature/[ticket-id]-frontend`
- **Language** — English only (code, docs, commits, tests)

## Requirements

- [Claude Code](https://claude.ai/code)
- Node.js v20+
- AWS CLI configured
- Serverless Framework v3 (`npm install -g serverless`)
- GitHub CLI (`gh`)

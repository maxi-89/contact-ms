---
description: Development rules and guidelines for this project. Applicable to all AI agents.
alwaysApply: true
---

## 1. Core Principles

- **Small tasks, one at a time**: Always work in baby steps, one at a time. Never go forward more than one step.
- **Test-Driven Development**: Start with failing tests for any new functionality (TDD), according to the task details.
- **Type Safety**: All code must be fully typed. Use strict TypeScript.
- **Clear Naming**: Use clear, descriptive names for all variables and functions.
- **Incremental Changes**: Prefer incremental, focused changes over large, complex modifications.
- **Question Assumptions**: Always question assumptions and inferences.
- **Pattern Detection**: Detect and highlight repeated code patterns.

## 2. Language Standards

- **English Only**: All technical artifacts must always use English, including:
  - Code (variables, functions, classes, comments, error messages, log messages)
  - Documentation (README, guides, API docs)
  - Data schemas and DynamoDB attribute names
  - Configuration files and scripts
  - Git commit messages
  - Test names and descriptions

## 3. Project Context

<!-- Update this section for each project -->

**Backend Stack**: Serverless Framework v3 · TypeScript (strict) · AWS Lambda · API Gateway · DynamoDB · Jest

**Frontend Stack**: Next.js (App Router) · TypeScript (strict) · Tailwind CSS · Jest + React Testing Library · Playwright

## 4. Specific Standards

For detailed standards refer to:

- [Backend Standards](./openspec/specs/backend-standards.mdc) — Serverless Framework, Lambda, DynamoDB, DDD architecture, testing, error handling
- [Frontend Standards](./openspec/specs/frontend-standards.mdc) — Next.js App Router, Tailwind CSS, Server/Client Components, data fetching
- [Documentation Standards](./openspec/specs/documentation-standards.mdc) — docs structure and maintenance
- [API Spec](./openspec/specs/api-spec.yml) — OpenAPI 3.0 spec (source of truth for endpoints)
- [Data Model](./openspec/specs/data-model.md) — DynamoDB single-table design
- [Development Guide](./openspec/specs/development_guide.md) — setup and deployment instructions

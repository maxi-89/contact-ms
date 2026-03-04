# Development Guide

Step-by-step instructions to set up and run the project locally and deploy to AWS.

<!-- Update the project name and any project-specific details when using this template -->

## Tech Stack

### Backend
- **Runtime**: Node.js 22.x
- **Language**: TypeScript (strict mode)
- **Framework**: Serverless Framework v3
- **Database**: AWS DynamoDB (local via `serverless-dynamodb-local` for dev)
- **Message Queue**: AWS SQS (ElasticMQ locally via `serverless-offline`)
- **Email**: AWS SES
- **Testing**: Jest + ts-jest
- **Linting**: ESLint + Prettier

### Frontend
- **Framework**: Next.js (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **Testing**: Jest + React Testing Library / Playwright

---

## Prerequisites

- Node.js v22 or higher
- npm v10 or higher
- AWS CLI configured (`aws configure`)
- Serverless Framework CLI: `npm install -g serverless`
- Java 8+ (required for DynamoDB Local)

---

## Backend

### 1. Install

```bash
git clone <repo-url>
cd <project-name>/backend   # or root if backend is at root
npm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env` and fill in the values (never commit `.env`):

```bash
cp .env.example .env
```

```env
REGION=us-east-1
PENDING_MESSAGES_QUEUE=https://sqs.us-east-1.amazonaws.com/123456789/my-queue
EMAIL_SOURCE=no-reply@example.com
DESTINATION_EMAIL=contact@example.com
CLOUDFRONT_DOMAIN=d1234abcd.cloudfront.net
RATE_LIMIT_TABLE=contact-ms-dev-rate-limit
DYNAMODB_ENDPOINT=http://localhost:8000
IS_OFFLINE=true
```

### 3. Local Development

```bash
# Install DynamoDB Local (first time only)
npx serverless dynamodb install

# Start API Gateway emulator + DynamoDB Local
npx serverless offline start
```

- API available at: `http://localhost:3000`
- DynamoDB Local at: `http://localhost:8000`

### 4. Running Tests

```bash
npm test                  # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage report
```

Coverage threshold: **90%** for branches, functions, lines, and statements.

### 5. Deploy to AWS

```bash
# Deploy to dev
npx serverless deploy --stage dev

# Deploy to production
npx serverless deploy --stage prod
```

After deploying, the CLI outputs the API Gateway endpoint URLs.

### 6. Backend Project Structure

```
backend/                         # or project root if no monorepo
├── src/
│   ├── domain/
│   │   ├── models/              # Domain entities and value objects
│   │   └── repositories/        # Repository interfaces (IFooRepository.ts)
│   ├── application/
│   │   ├── services/            # Application services (fooService.ts)
│   │   └── validators/          # Input validators (fooValidator.ts)
│   ├── infrastructure/
│   │   ├── dynamodb/            # DynamoDB client + repository implementations
│   │   └── errors/              # AppError.ts, ValidationError.ts
│   └── presentation/
│       └── handlers/            # Lambda handlers (createFoo.ts)
├── __tests__/                   # Unit tests (mirrors src/)
├── serverless.yml
├── tsconfig.json
├── jest.config.ts
├── .env                         ← not committed
├── .env.example
├── .gitignore
└── package.json
```

### 7. NPM Scripts Reference

```bash
npm run offline        # Start serverless offline (API + DynamoDB Local)
npm run build          # Compile TypeScript
npm run type-check     # Type-check without emitting files
npm test               # Run all unit tests
npm run test:coverage  # Tests + coverage report (≥ 90% required)
npm run lint           # Run ESLint on src/
```

### 8. Useful Serverless Commands

```bash
# View deployed function logs
npx serverless logs -f <functionName> --stage dev --tail

# Invoke a function directly (bypassing HTTP)
npx serverless invoke -f <functionName> --stage dev --data '{"body":"{}"}'

# Remove a deployment
npx serverless remove --stage dev
```

---

## Frontend

### 1. Install

```bash
cd <project-name>/frontend   # or the frontend directory
npm install
```

### 2. Environment Configuration

Create a `.env.local` file at the frontend root (never commit this file):

```env
# Backend API URL (from API Gateway after deploying, or localhost for local dev)
NEXT_PUBLIC_API_URL=http://localhost:3000

# Server-side only API URL (optional, if different from public)
API_BASE_URL=http://localhost:3000
```

### 3. Local Development

```bash
npm run dev
```

- App available at: `http://localhost:3001` (or Next.js default `3000` if backend is not running)

### 4. Running Tests

```bash
npm test                  # Run unit tests
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage report
npx playwright test       # Run E2E tests
```

### 5. Build and Deploy

```bash
npm run build             # Build for production
npm start                 # Start production server (if self-hosting)
```

For deployment to Vercel, AWS Amplify, or similar — follow the platform's specific instructions.

### 6. Frontend Project Structure

```
frontend/                        # or project root if no monorepo
├── app/
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Home page
│   ├── globals.css              # Global styles + Tailwind directives
│   └── [feature]/
│       ├── page.tsx             # Feature page (Server Component)
│       ├── layout.tsx           # Optional feature layout
│       └── loading.tsx          # Loading UI
├── components/
│   ├── ui/                      # Primitive components (Button, Input, Card...)
│   ├── shared/                  # Composite reusable components
│   └── [feature]/               # Feature-specific components
├── hooks/                       # Custom React hooks (client-side)
├── lib/
│   ├── api/                     # API service modules (fooApi.ts)
│   └── utils/                   # Utility functions (cn.ts, formatDate.ts...)
├── types/                       # Shared TypeScript interfaces
├── e2e/                         # Playwright E2E tests
├── __tests__/                   # Unit and component tests
├── tailwind.config.ts
├── next.config.ts
├── tsconfig.json
├── .env.local                   ← not committed
├── .env.example
└── package.json
```

### 7. NPM Scripts Reference

```bash
npm run dev            # Start Next.js dev server
npm run build          # Build for production
npm start              # Start production server
npm test               # Run unit tests
npm run test:watch     # Tests in watch mode
npm run test:coverage  # Tests + coverage report
npm run lint           # Run ESLint
npx playwright test    # Run E2E tests
```

---

## OpenSpec Files

```
openspec/
├── specs/
│   ├── base-standards.mdc          # Core principles (all agents)
│   ├── backend-standards.mdc       # Backend architecture and conventions
│   ├── frontend-standards.mdc      # Frontend architecture and conventions
│   ├── documentation-standards.mdc # Docs and AI spec maintenance rules
│   ├── api-spec.yml                # OpenAPI 3.0 spec (source of truth)
│   ├── data-model.md               # DynamoDB single-table design
│   └── development_guide.md        # This file
├── .agents/
│   ├── backend-developer.md        # Backend planning agent
│   ├── frontend-developer.md       # Frontend planning agent
│   └── product-strategy-analyst.md # Product strategy agent
└── .commands/
    ├── plan-backend-ticket.md      # Plan a backend ticket
    ├── plan-frontend-ticket.md     # Plan a frontend ticket
    ├── develop-backend.md          # Implement a backend ticket
    ├── develop-frontend.md         # Implement a frontend ticket
    ├── commit.md                   # Commit and open PR
    ├── update-docs.md              # Update documentation
    ├── enrich-us.md                # Enrich a Jira user story
    ├── explain.md                  # Explain a concept
    └── meta-prompt.md              # Improve a prompt
```

# Role

You are an expert software architect with deep experience in serverless TypeScript applications on AWS, applying Domain-Driven Design (DDD) with layered architecture (Domain, Application, Infrastructure, Presentation).

# Arguments

`$ARGUMENTS` — ticket identifier, ticket ID, or keywords. If it refers to a local file, read it directly without using MCP.

# Goal

Produce a step-by-step backend implementation plan for a ticket that is detailed enough for a developer to work end-to-end autonomously.

# Process and rules

1. Adopt the role defined in `openspec/.agents/backend-developer.md`
2. Fetch the ticket using the project management MCP. If `$ARGUMENTS` refers to a local file, read it directly
3. Propose a step-by-step plan for the backend, applying the standards in `openspec/specs`
4. Ensure the plan is complete enough that the developer needs no further clarification
5. Do not write implementation code — provide the plan only
6. If asked to start implementing, first move to the feature branch (Step 0) and follow `/develop-backend.md`

# Output format

Save the plan as a markdown document at `openspec/changes/[ticket-id]_backend.md`.

Use the following template:

---

## Template

### 1. Header
- Title: `# Backend Implementation Plan: [TICKET-ID] — [Feature Name]`

### 2. Overview
- Brief description of the feature
- Layers involved (Domain / Application / Infrastructure / Presentation)
- DDD and clean architecture principles applied

### 3. Architecture Context
- Files to create and files to modify
- Repository interfaces needed
- Dependencies between components

### 4. Implementation Steps

#### Step 0: Create Feature Branch
- **Action**: Create and switch to the feature branch
- **Branch name**: `feature/[ticket-id]-backend`
- **Steps**:
  1. Ensure you are on the latest `main` or `develop`
  2. `git pull origin [base-branch]`
  3. `git checkout -b feature/[ticket-id]-backend`
- **Note**: This must be the FIRST step before any code changes

#### Step 1: Domain Layer
- **File**: `src/domain/models/[Entity].ts`
- **Action**: Define the entity class or interface
- **Notes**: Zero dependencies on AWS or DynamoDB

#### Step 2: Repository Interface
- **File**: `src/domain/repositories/I[Entity]Repository.ts`
- **Action**: Define the repository contract methods needed by the service

#### Step 3: Input Validator
- **File**: `src/application/validators/[entity]Validator.ts`
- **Action**: Validate `unknown` input, return typed object or throw `ValidationError`

#### Step 4: Application Service
- **File**: `src/application/services/[entity]Service.ts`
- **Action**: Orchestrate domain logic — validate input, build entity, call repository
- **Notes**: Must not import AWS SDK or DynamoDB directly

#### Step 5: DynamoDB Repository
- **File**: `src/infrastructure/dynamodb/[Entity]Repository.ts`
- **Action**: Implement the repository interface using AWS SDK v3 + DynamoDBDocumentClient
- **Key design**: Specify PK/SK pattern (e.g. `ENTITY#<id>`)

#### Step 6: Lambda Handler
- **File**: `src/presentation/handlers/[action][Entity].ts`
- **Action**: Parse `event.body`, call the service, return `APIGatewayProxyResult`
- **Notes**: No business logic — only HTTP parsing and error-to-status-code mapping

#### Step 7: Register in serverless.yml
- **Action**: Add the function definition with its HTTP event, path, method, and CORS

#### Step 8: Unit Tests
- **Files**: `__tests__/unit/[layer]/[file].test.ts`
- **Coverage required**: 90% branches, functions, lines, statements
- **Cases to cover**:
  - Successful path
  - Validation errors (missing/invalid fields)
  - Not found (if applicable)
  - DynamoDB/infrastructure errors
  - Edge cases specific to the business rule

#### Step N: Update Documentation
- **Action**: Review all changes and update affected docs
  - API changes → `openspec/specs/api-spec.yml`
  - Data model changes → `openspec/specs/data-model.md`
  - Standards/config changes → relevant `*-standards.mdc`
- Follow `openspec/specs/documentation-standards.mdc`
- **This step is MANDATORY** — do not skip it

---

### 5. Implementation Order
Numbered list from Step 0 (branch) to documentation update (always last)

### 6. Error Response Format
- JSON shape: `{ "error": "message" }`
- HTTP status code mapping for this feature

### 7. Testing Checklist
- [ ] All happy-path cases covered
- [ ] All validation error cases covered
- [ ] Infrastructure errors handled
- [ ] Coverage threshold met (90%)
- [ ] Tests follow AAA pattern

### 8. Dependencies
- New npm packages required (if any) with justification

### 9. Notes
- Business rules and constraints
- Assumptions made
- Anything the developer must know before starting

### 10. Implementation Verification
- [ ] Code follows DDD layered architecture
- [ ] No business logic in Lambda handlers
- [ ] No AWS SDK imports in application or domain layers
- [ ] TypeScript strict — no `any`
- [ ] All tests pass
- [ ] Documentation updated

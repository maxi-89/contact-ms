# Backend Implementation Plan: SCRUM-3 — POST /project-request

## 1. Overview

Implement `POST /project-request` — the endpoint that receives project start requests from potential clients, validates input, applies rate limiting, enqueues to SQS, and triggers email delivery via SES using a dedicated HTML template.

**SCRUM-2 is a hard prerequisite.** All infrastructure is already in place:
`AppError`, `ValidationError`, `sqsClient`, `sesClient`, `checkRateLimit`, `response.ts` helpers, `authorizer`, `serverless.yml`.

**Source of truth for fields**: `openspec/specs/api-spec.yml` — `ProjectRequestBody` schema. Use these fields (they differ from the enriched ticket):

| Field | Required | Constraint |
|---|---|---|
| `name` | yes | string, 2–100 chars |
| `email` | yes | string, valid email |
| `projectType` | yes | string, 2–100 chars |
| `description` | yes | string, 10–2000 chars |
| `budget` | no | string, max 100 chars if provided |

**Layers touched:**
- Domain — `ProjectRequest` entity
- Application — `projectRequestValidator`, `projectRequestService`
- Presentation — `receiveProjectRequest` handler (HTTP), extended `sendEmail` handler, `projectRequestTemplate.html`
- Infrastructure — new shared `renderTemplate` helper

**DDD principles applied:**
- Domain entity is pure TypeScript — zero AWS dependencies
- Handler delegates to the service; contains only HTTP plumbing
- `renderTemplate` helper extracted to infrastructure layer to avoid duplication

---

## 2. Architecture Context

### Files to create

```
src/
├── domain/
│   └── models/
│       └── ProjectRequest.ts                    ← new domain entity
├── application/
│   ├── validators/
│   │   └── projectRequestValidator.ts           ← new validator
│   └── services/
│       └── projectRequestService.ts             ← new service
├── infrastructure/
│   └── email/
│       └── renderTemplate.ts                    ← new shared helper (extract from sendEmail.ts)
└── presentation/
    ├── handlers/
    │   └── receiveProjectRequest.ts             ← new HTTP handler
    └── templates/
        └── projectRequestTemplate.html          ← new email template

__tests__/unit/
├── domain/models/
│   └── ProjectRequest.test.ts
├── application/
│   ├── validators/
│   │   └── projectRequestValidator.test.ts
│   └── services/
│       └── projectRequestService.test.ts
├── infrastructure/email/
│   └── renderTemplate.test.ts
└── presentation/handlers/
    └── receiveProjectRequest.test.ts
```

### Files to modify

```
src/presentation/handlers/sendEmail.ts           ← add type dispatch + use renderTemplate helper
__tests__/unit/presentation/handlers/sendEmail.test.ts  ← add project_request type tests
```

### Key architectural decisions

1. **Reuse `PendingMessagesQueue`** — no second queue. The existing queue already has a DLQ,
   visibility timeout, and redrive policy. The `type` field in the payload is used to dispatch.
2. **Extend `sendEmail.ts`** with type-based routing (`contact_message` | `project_request`)
   instead of creating a new Lambda. Simpler; avoids duplicate SQS trigger infrastructure.
3. **Extract `renderTemplate` helper** to `src/infrastructure/email/renderTemplate.ts` so both
   handler branches share the same `fs.readFileSync` + placeholder replacement logic.
4. **`receiveProjectRequest` function is ALREADY in `serverless.yml`** — only the handler file
   is missing. No `serverless.yml` changes are required.
5. **Queue payload shape** follows the existing `ContactMessage` convention:
   ```json
   { "type": "project_request", "data": { ...fields } }
   ```

### No repository interface needed

There is no DynamoDB persistence for project requests — they are enqueued transient payloads.
The existing `checkRateLimit` (infrastructure/middleware) and `sqsClient` are reused as-is.

---

## 3. Implementation Steps

### Step 0: Create Feature Branch

- **Action**: Create and switch to the feature branch
- **Branch name**: `feature/SCRUM-3-backend`
- **Steps**:
  1. `git checkout main && git pull origin main`
  2. `git checkout -b feature/SCRUM-3-backend`
  3. Verify: `git branch`
- **Note**: This must be the first step before any code changes.

---

### Step 1: Domain Entity — ProjectRequest

- **File**: `src/domain/models/ProjectRequest.ts`
- **Action**: Define the entity class
- **Notes**:
  - Zero AWS/framework dependencies
  - `budget` is `string | undefined` — free text, not an enum
  - `toQueuePayload()` wraps data in `{ type: 'project_request', data: {...} }` to match the
    existing `sendEmail` dispatch convention
- **Shape**:

```typescript
export interface ProjectRequestData {
  name: string;
  email: string;
  projectType: string;
  description: string;
  budget?: string;
}

export class ProjectRequest {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly projectType: string;
  readonly description: string;
  readonly budget: string | undefined;
  readonly timestamp: number;

  constructor(id: string, data: ProjectRequestData) {
    this.id = id;
    this.name = data.name;
    this.email = data.email;
    this.projectType = data.projectType;
    this.description = data.description;
    this.budget = data.budget;
    this.timestamp = Date.now();
  }

  toQueuePayload(): Record<string, unknown> {
    return {
      type: 'project_request',
      data: {
        id: this.id,
        name: this.name,
        email: this.email,
        projectType: this.projectType,
        description: this.description,
        budget: this.budget,
        timestamp: this.timestamp,
      },
    };
  }
}
```

---

### Step 2: Validator — projectRequestValidator

- **File**: `src/application/validators/projectRequestValidator.ts`
- **Action**: Validate `unknown` input, return `ProjectRequestData` or throw `ValidationError`
- **Notes**:
  - Follow the exact same pattern as `contactMessageValidator.ts`
  - `budget` is optional — only validate length if the value is present (non-empty string after trim)
  - Throw `ValidationError` with the prefix `'Validation failed: '` on every error

- **Validation rules**:

| Field | Rule |
|---|---|
| `name` | required, string, 2–100 chars after trim |
| `email` | required, string, matches `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` |
| `projectType` | required, string, 2–100 chars after trim |
| `description` | required, string, 10–2000 chars after trim |
| `budget` | optional — if present (non-empty after trim), max 100 chars |

- **Function signature**:

```typescript
export function validateProjectRequest(body: unknown): ProjectRequestData
```

---

### Step 3: Application Service — projectRequestService

- **File**: `src/application/services/projectRequestService.ts`
- **Action**: Orchestrate validate → rate limit → enqueue
- **Notes**:
  - Follow the exact same pattern as `contactMessageService.ts`
  - The service imports `sqsClient` and `SendMessageCommand` directly (consistent with the
    existing codebase — this is a known pattern deviation from strict DDD; do not refactor)
  - Use `PENDING_MESSAGES_QUEUE` env var (same queue as contact messages)
  - Use `uuidv1()` for id generation (consistent with SCRUM-2)
  - Return `{ id: string; messageId: string }`

- **Function signature**:

```typescript
export async function processProjectRequest(
  rawBody: unknown,
  clientIp: string,
): Promise<{ id: string; messageId: string }>
```

- **Implementation flow**:
  1. `validateProjectRequest(rawBody)` — throws `ValidationError` if invalid
  2. `checkRateLimit(clientIp, validatedData.email)` — throws `AppError(429)` if exceeded
  3. `id = uuidv1()`
  4. `new ProjectRequest(id, validatedData)`
  5. `sqsClient.send(new SendMessageCommand({ QueueUrl: process.env['PENDING_MESSAGES_QUEUE'], MessageBody: JSON.stringify(request.toQueuePayload()) }))`
  6. Return `{ id, messageId: response.MessageId ?? '' }`

---

### Step 4: Email Template — projectRequestTemplate.html

- **File**: `src/presentation/templates/projectRequestTemplate.html`
- **Action**: Create HTML email template for project request notifications
- **Notes**:
  - Match the visual style of `emailTemplate.html` (same inline CSS, same table layout)
  - All placeholders use `{{field}}` syntax, replaced by `renderTemplate` helper
  - `budget` is optional — use `{{budget}}` placeholder and pass `'No especificado'` when undefined

- **Placeholders**:

| Placeholder | Source field |
|---|---|
| `{{name}}` | `data.name` |
| `{{email}}` | `data.email` |
| `{{projectType}}` | `data.projectType` |
| `{{description}}` | `data.description` |
| `{{budget}}` | `data.budget ?? 'No especificado'` |

- **Email subject**: `Nuevo pedido de proyecto - {{name}}` (substitute before sending)

---

### Step 5: Shared Helper — renderTemplate

- **File**: `src/infrastructure/email/renderTemplate.ts`
- **Action**: Extract template loading and placeholder replacement into a reusable helper
- **Notes**:
  - This eliminates the duplication that will exist once `sendEmail.ts` handles two types
  - Throws `Error` if the template file cannot be read (let it propagate — causes SQS retry)

- **Function signature**:

```typescript
export function renderTemplate(
  templatePath: string,
  variables: Record<string, string>,
): string
```

- **Implementation**:
  1. `fs.readFileSync(templatePath, 'utf-8')` — read the template
  2. Replace every `{{key}}` with `variables[key]` for each entry in `variables`
  3. Return the rendered HTML string

---

### Step 6: Extend sendEmail Handler

- **File**: `src/presentation/handlers/sendEmail.ts`
- **Action**: Add type-based dispatch and use the shared `renderTemplate` helper
- **Notes**:
  - Replace the inline `fs.readFileSync` + `.replace()` chain with a call to `renderTemplate`
  - Keep the existing `contact_message` path working exactly as before (no behaviour change)
  - Add a `project_request` branch that loads `projectRequestTemplate.html` and builds the email
  - For unrecognised types: log a warning and return (do not throw — avoids poison-pill messages)

- **Updated dispatch logic**:

```typescript
// existing SqsMessageBody interface stays but gets a union type for data
type SqsMessageBody =
  | { type: 'contact_message'; data: ContactMessageData }
  | { type: 'project_request'; data: ProjectRequestData }
  | { type: string; data: Record<string, unknown> };

export const handler: SQSHandler = async (event): Promise<void> => {
  const record = event.Records[0];
  const payload = JSON.parse(record.body) as SqsMessageBody;

  if (payload.type === 'contact_message') {
    // existing logic — refactored to use renderTemplate
  } else if (payload.type === 'project_request') {
    // new branch
  } else {
    console.warn(`[sendEmail] Unknown message type: ${payload.type} — skipping`);
    return;
  }
};
```

- **project_request branch details**:
  1. Cast `payload.data` to `ProjectRequestData`
  2. Load `projectRequestTemplate.html` via `renderTemplate`
  3. Pass `{ name, email, projectType, description, budget: data.budget ?? 'No especificado' }`
  4. Subject: `` `Nuevo pedido de proyecto - ${data.name}` ``
  5. Send via `sesClient.send(new SendEmailCommand({ ... }))` — same pattern as contact_message
  6. `console.log` success with `data.id`; `throw error` on SES failure (SQS retry)

---

### Step 7: Verify serverless.yml

- **File**: `serverless.yml`
- **Action**: Verify only — no changes required
- **Checklist**:
  - [ ] `receiveProjectRequest` function is present (it is — added in a prior session)
  - [ ] Handler path points to `src/presentation/handlers/receiveProjectRequest.handler`
  - [ ] Authorizer is wired (`authorizer`, type `REQUEST`, `identitySource: method.request.header.origin`)
  - [ ] CORS is enabled
  - [ ] No new queue or IAM statement is needed (reusing existing `PendingMessagesQueue` and SQS permissions)

---

### Step 8: Unit Tests

Follow the **AAA (Arrange, Act, Assert)** pattern. Mock all infrastructure dependencies.

#### 8a. Domain — `__tests__/unit/domain/models/ProjectRequest.test.ts`

```
describe('ProjectRequest')
  ✓ should store all required fields from constructor
  ✓ should store undefined budget when not provided
  ✓ should set timestamp to a number on construction
  ✓ toQueuePayload: should return type "project_request"
  ✓ toQueuePayload: should include all fields in data
  ✓ toQueuePayload: should include undefined budget in data
```

#### 8b. Validator — `__tests__/unit/application/validators/projectRequestValidator.test.ts`

```
describe('validateProjectRequest')
  happy path:
    ✓ should return validated data when all required fields are valid
    ✓ should return data with undefined budget when not provided
    ✓ should trim whitespace from all string fields
    ✓ should accept budget when present and within 100 chars
  validation errors:
    ✓ should throw ValidationError when body is not an object
    ✓ should throw ValidationError when name is missing
    ✓ should throw ValidationError when name is shorter than 2 chars
    ✓ should throw ValidationError when name is longer than 100 chars
    ✓ should throw ValidationError when email is missing
    ✓ should throw ValidationError when email format is invalid
    ✓ should throw ValidationError when projectType is missing
    ✓ should throw ValidationError when projectType is shorter than 2 chars
    ✓ should throw ValidationError when projectType is longer than 100 chars
    ✓ should throw ValidationError when description is missing
    ✓ should throw ValidationError when description is shorter than 10 chars
    ✓ should throw ValidationError when description is longer than 2000 chars
    ✓ should throw ValidationError when budget is present but longer than 100 chars
  edge cases:
    ✓ should treat empty string budget as missing (undefined)
```

#### 8c. Service — `__tests__/unit/application/services/projectRequestService.test.ts`

```
describe('processProjectRequest')
  happy path:
    ✓ should return id and messageId when data is valid
    ✓ should call SQS with PENDING_MESSAGES_QUEUE url
    ✓ should set type "project_request" in SQS payload
  validation:
    ✓ should throw ValidationError when body is invalid
  rate limit:
    ✓ should throw AppError(429) when checkRateLimit throws
  SQS error:
    ✓ should propagate error when SQS send fails
```

Mock strategy (same as `contactMessageService.test.ts`):
```typescript
jest.mock('../../../../src/infrastructure/aws/sqsClient', () => ({
  sqsClient: { send: jest.fn() },
}));
jest.mock('../../../../src/infrastructure/middleware/rateLimit', () => ({
  checkRateLimit: jest.fn(),
}));
jest.mock('uuid', () => ({ v1: () => 'mock-uuid-1234' }));
```

#### 8d. Infrastructure — `__tests__/unit/infrastructure/email/renderTemplate.test.ts`

```
describe('renderTemplate')
  ✓ should replace a single {{variable}} in the template
  ✓ should replace multiple {{variables}} in one pass
  ✓ should replace the same variable appearing multiple times
  ✓ should leave unreferenced {{variables}} untouched
  ✓ should return the template unchanged when variables map is empty
  ✓ should throw when the template file does not exist
```

Mock strategy:
```typescript
jest.mock('fs');
import fs from 'fs';
(fs.readFileSync as jest.Mock).mockReturnValue('<p>{{name}}</p>');
```

#### 8e. Handler — `__tests__/unit/presentation/handlers/receiveProjectRequest.test.ts`

```
describe('receiveProjectRequest handler')
  ✓ should return 200 with { message: "Message received" } on valid request
  ✓ should return 400 when body is invalid JSON
  ✓ should return 400 when validation fails (ValidationError)
  ✓ should return 429 when rate limit exceeded (AppError 429)
  ✓ should return 500 on unexpected error
```

Mock strategy (same as `receiveMessage.test.ts`):
```typescript
jest.mock('../../../../src/application/services/projectRequestService', () => ({
  processProjectRequest: jest.fn(),
}));
```

#### 8f. Extended sendEmail — `__tests__/unit/presentation/handlers/sendEmail.test.ts`

Add tests to the **existing** test file (do not replace it):
```
  // new cases to add:
  describe('project_request type')
    ✓ should call SES with correct Source and Destination for project_request
    ✓ should replace all project_request placeholders in the template
    ✓ should use budget fallback "No especificado" when budget is undefined
    ✓ should re-throw on SES error for project_request type
  describe('unknown type')
    ✓ should log a warning and return without calling SES
```

---

### Step 9: Update Documentation

- **`openspec/specs/api-spec.yml`**: The `POST /project-request` path and `ProjectRequestBody` schema are already defined. Verify the response shape matches the implementation. The `MessageResponse` schema (`{ message: string }`) matches what `receiveProjectRequest` will return.
- **`openspec/specs/data-model.md`**: No new DynamoDB entities. No changes needed.
- Follow `openspec/specs/documentation-standards.mdc` to check if any other docs need updating.

---

## 4. Implementation Order

0. Create feature branch: `feature/SCRUM-3-backend`
1. Domain entity: `ProjectRequest.ts`
2. Validator: `projectRequestValidator.ts`
3. Service: `projectRequestService.ts`
4. Email template: `projectRequestTemplate.html`
5. Shared helper: `renderTemplate.ts`
6. Extend `sendEmail.ts` (add dispatch, use helper, refactor contact_message branch)
7. HTTP handler: `receiveProjectRequest.ts`
8. Tests: domain → validator → service → renderTemplate → receiveProjectRequest handler → sendEmail extensions (TDD — write failing tests first, then implement)
9. Verify `serverless.yml` (no changes expected)
10. Update documentation (`api-spec.yml` verification)

---

## 5. Error Response Format

All error responses use `{ "error": "message" }` shape, consistent with existing handlers.

| Scenario | Status | Body |
|---|---|---|
| Valid request | 200 | `{ "message": "Message received" }` |
| Invalid JSON | 400 | `{ "error": "Invalid JSON body" }` |
| Validation failure | 400 | `{ "error": "Validation failed: <field> <reason>" }` |
| Origin not allowed | 403 | Returned by authorizer Lambda (no handler change) |
| Rate limit exceeded | 429 | `{ "error": "Rate limit exceeded. Retry in <n> seconds." }` |
| Internal error | 500 | `{ "error": "Internal server error" }` |

---

## 6. Testing Checklist

- [ ] All happy-path cases covered
- [ ] All validation error cases covered (one test per rule)
- [ ] Rate limit error propagation tested
- [ ] SQS error propagation tested
- [ ] SES error propagation tested (re-throw for SQS retry)
- [ ] Unknown message type in `sendEmail` tested
- [ ] `renderTemplate` error path tested (file not found)
- [ ] Coverage threshold met: 90% branches, functions, lines, statements
- [ ] Tests follow AAA pattern
- [ ] `npm test` passes with zero failures
- [ ] `npx tsc --noEmit` passes with zero errors

---

## 7. Dependencies

No new npm packages required. All dependencies already installed:
- `uuid` — `uuidv1()` for id generation
- `@aws-sdk/client-sqs` — SQS `SendMessageCommand`
- `@aws-sdk/client-ses` — SES `SendEmailCommand`
- `aws-lambda` — `APIGatewayProxyHandler`, `SQSHandler` types

---

## 8. Notes

### Source of truth discrepancy

The enriched ticket (SCRUM-3 Jira description) specifies fields `contactName`, `projectName`, `phone`, and `timeline` (enum). **Do not use those fields.** The `openspec/specs/api-spec.yml` is the source of truth and defines: `name`, `email`, `projectType`, `description`, `budget` (free text, optional). Follow the api-spec.

### Known architecture deviation

`contactMessageService.ts` imports `@aws-sdk/client-sqs` and `sqsClient` directly in the application layer, which technically violates the DDD rule "services must not import AWS SDK". For consistency, `projectRequestService.ts` follows the same established pattern. Refactoring both services to use an SQS abstraction is out of scope for this ticket.

### Rate limiting shares the same DynamoDB table

`checkRateLimit` applies per-IP and per-email limits. Project requests count toward the same limits as contact messages for the same email. No changes to `rateLimit.ts` are required.

### No serverless.yml changes

The `receiveProjectRequest` function was already added to `serverless.yml` before this ticket. The SQS permissions for `PendingMessagesQueue` already cover `sqs:SendMessage`. Only the handler file is missing.

### sendEmail refactoring is additive

When extending `sendEmail.ts`, the existing `contact_message` branch must not change behaviour. The refactoring to use `renderTemplate` must produce identical HTML output for contact messages. Verify this with the existing `sendEmail` tests passing unchanged.

---

## 9. Implementation Verification

- [ ] Code follows DDD layered architecture
- [ ] No business logic in `receiveProjectRequest` handler
- [ ] `projectRequestService.ts` imports only from domain and infrastructure layers
- [ ] `ProjectRequest` entity has zero external dependencies
- [ ] TypeScript strict — no `any`
- [ ] All tests pass (`npm test`)
- [ ] `npx tsc --noEmit` zero errors
- [ ] `openspec/specs/api-spec.yml` verified (no field drift)
- [ ] Existing `sendEmail` tests still pass after refactoring

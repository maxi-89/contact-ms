# Backend Implementation Plan: SCRUM-2 — Receive Contact Message Endpoint

## 1. Overview

Implement `POST /message` — the endpoint that receives contact messages from the website landing page, validates input, applies rate limiting (already implemented in SCRUM-1), enqueues to SQS, and triggers `sendEmail` via SQS to deliver via SES.

**SCRUM-1 is a hard prerequisite.** All infrastructure primitives are already in place:
`AppError`, `ValidationError`, `sqsClient`, `sesClient`, `checkRateLimit`, `response.ts` helpers, `authorizer`, `serverless.yml`.

**Layers touched:**
- Domain — `ContactMessage` entity
- Application — `contactMessageValidator`, `contactMessageService`
- Presentation — `receiveMessage` handler (HTTP), `sendEmail` handler (SQS), `emailTemplate.html`

**DDD principles applied:**
- Domain entity is pure TypeScript — zero AWS dependencies
- Service orchestrates but never imports AWS SDK directly
- Handler delegates to the service; contains only HTTP plumbing

---

## 2. Architecture Context

### Files to create

```
src/
├── domain/
│   └── models/
│       └── ContactMessage.ts
├── application/
│   ├── validators/
│   │   └── contactMessageValidator.ts
│   └── services/
│       └── contactMessageService.ts
└── presentation/
    ├── handlers/
    │   ├── receiveMessage.ts
    │   └── sendEmail.ts
    └── templates/
        └── emailTemplate.html

__tests__/unit/
├── domain/
│   └── models/
│       └── ContactMessage.test.ts
├── application/
│   ├── validators/
│   │   └── contactMessageValidator.test.ts
│   └── services/
│       └── contactMessageService.test.ts
└── presentation/
    └── handlers/
        ├── receiveMessage.test.ts
        └── sendEmail.test.ts
```

### Files to modify

```
serverless.yml           # receiveMessage and sendEmail handlers already registered — NO changes needed
openspec/specs/api-spec.yml    # Expand POST /message with full schema (already stubbed)
openspec/specs/data-model.md   # No changes — messages are not persisted
```

### Dependencies between components

```
receiveMessage.ts  → contactMessageService.ts → contactMessageValidator.ts
                                              → ContactMessage.ts
                                              → checkRateLimit (infrastructure/middleware)
                                              → sqsClient (infrastructure/aws)
sendEmail.ts       → sesClient (infrastructure/aws)
                   → emailTemplate.html
```

> No repository interface is needed: messages are not stored in DynamoDB — they flow directly to SQS.

---

## 3. Implementation Steps

### Step 0: Create Feature Branch

- **Action**: Create and switch to the feature branch
- **Branch**: `feature/SCRUM-2-backend`
- **Steps**:
  1. `git checkout main && git pull origin main`
  2. `git checkout -b feature/SCRUM-2-backend`
  3. Verify: `git branch`

---

### Step 1: Domain Entity — ContactMessage

- **File**: `src/domain/models/ContactMessage.ts`
- **Action**: Define the `ContactMessageData` interface and `ContactMessage` class
- **Fields**:

  | Field | Type | Source |
  |---|---|---|
  | `id` | `string` | passed in constructor |
  | `name` | `string` | from request body |
  | `lastname` | `string` | from request body |
  | `email` | `string` | from request body |
  | `phone` | `string` | from request body |
  | `message` | `string` | from request body |
  | `timestamp` | `number` | `Date.now()` at construction time |

- **Interface to export**:
  ```typescript
  export interface ContactMessageData {
    name: string;
    lastname: string;
    email: string;
    phone: string;
    message: string;
  }
  ```
- **Class to export**:
  ```typescript
  export class ContactMessage {
    readonly id: string;
    readonly name: string;
    readonly lastname: string;
    readonly email: string;
    readonly phone: string;
    readonly message: string;
    readonly timestamp: number;
    constructor(id: string, data: ContactMessageData) { ... }
    toQueuePayload(): Record<string, unknown> { ... }
  }
  ```
- **`toQueuePayload()`** must return:
  ```json
  {
    "type": "contact_message",
    "data": { "id": "...", "name": "...", "lastname": "...", "email": "...", "phone": "...", "message": "...", "timestamp": 1700000000000 }
  }
  ```
- **Rules**: Zero external dependencies — no AWS SDK, no uuid, no DynamoDB.

---

### Step 2: Input Validator — contactMessageValidator

- **File**: `src/application/validators/contactMessageValidator.ts`
- **Action**: Validate `unknown` input and return a typed `ContactMessageData` object, or throw `ValidationError`
- **Function signature**:
  ```typescript
  export function validateContactMessage(body: unknown): ContactMessageData
  ```
- **Validation rules** (apply after trimming all string fields):

  | Field | Required | Rules |
  |---|---|---|
  | `name` | yes | string, 2–100 chars after trim |
  | `lastname` | yes | string, 2–100 chars after trim |
  | `email` | yes | string, valid email format: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` |
  | `phone` | yes | string, 6–20 chars after trim |
  | `message` | yes | string, 10–1000 chars after trim |

- **Validation order**: validate fields in the order listed above; throw on the first failing field.
- **Throws**: `new ValidationError('Validation failed: <field> <reason>')` — message must be descriptive enough for the API consumer to fix the issue.
- **Returns**: object with all fields trimmed.
- **Body must be a non-null object**: if `typeof body !== 'object' || body === null`, throw `ValidationError('Request body must be a JSON object')`.

---

### Step 3: Application Service — contactMessageService

- **File**: `src/application/services/contactMessageService.ts`
- **Action**: Orchestrate validation → rate-limit check → entity creation → SQS dispatch
- **Function signature**:
  ```typescript
  export async function processContactMessage(
    rawBody: unknown,
    clientIp: string,
  ): Promise<{ id: string; messageId: string }>
  ```
- **Orchestration steps** (in order):
  1. Call `validateContactMessage(rawBody)` — throws `ValidationError` if invalid
  2. Call `checkRateLimit(clientIp, validatedData.email)` — throws `AppError(429)` if exceeded
  3. Generate `id` with `uuidv1()` from the `uuid` package
  4. Instantiate `new ContactMessage(id, validatedData)`
  5. Build SQS payload via `message.toQueuePayload()`
  6. Call `sqsClient.send(new SendMessageCommand({ QueueUrl, MessageBody }))` where `QueueUrl = process.env['PENDING_MESSAGES_QUEUE']` and `MessageBody = JSON.stringify(payload)`
  7. Return `{ id, messageId: sqsResponse.MessageId ?? '' }`
- **Imports allowed**: `validateContactMessage`, `checkRateLimit`, `ContactMessage`, `sqsClient`, `uuid`, `AppError`
- **Must NOT import**: `@aws-sdk/client-dynamodb`, `aws-lambda`, `DynamoDBDocumentClient`

---

### Step 4: Lambda Handler — receiveMessage

- **File**: `src/presentation/handlers/receiveMessage.ts`
- **Action**: Thin HTTP handler — parse event, call service, return HTTP response
- **Function signature**:
  ```typescript
  export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult>
  ```
- **Implementation logic**:
  1. Extract `clientIp` from `event.requestContext.identity.sourceIp ?? 'unknown'`
  2. Parse `event.body` with `JSON.parse` inside a try/catch; return `badRequest('Invalid JSON body')` if malformed
  3. Call `processContactMessage(parsedBody, clientIp)`
  4. On success: return `ok({ message: 'Message received' })`
  5. On `ValidationError`: return `badRequest(error.message)`
  6. On `AppError` with `statusCode === 429`: extract `retryAfter` from message (or parse it), return `tooManyRequests(error.message)`
  7. On any other error: `console.error` + return `internalServerError()`
- **Use helpers from** `infrastructure/http/response.ts` — do not construct raw response objects
- **No business logic** — only event parsing and error-to-status-code mapping

> **Note on retryAfter**: The `AppError` message from `checkRateLimit` includes the seconds as text (e.g. `"Rate limit exceeded. Retry in 120 seconds."`). The handler can pass `error.message` directly to `tooManyRequests(message)` without parsing the integer — the message is already user-readable.

---

### Step 5: Email HTML Template

- **File**: `src/presentation/templates/emailTemplate.html`
- **Action**: Create an HTML email template with named placeholders
- **Placeholders** (must match exactly):
  ```
  {{name}}
  {{lastname}}
  {{email}}
  {{phone}}
  {{message}}
  ```
- **Content**: Spanish-language email body (user-facing content — exception to the English-only rule for code)
- **Example structure**:
  ```html
  <!DOCTYPE html>
  <html>
    <body>
      <h2>Nuevo mensaje de contacto</h2>
      <p><strong>Nombre:</strong> {{name}} {{lastname}}</p>
      <p><strong>Email:</strong> {{email}}</p>
      <p><strong>Teléfono:</strong> {{phone}}</p>
      <p><strong>Mensaje:</strong></p>
      <p>{{message}}</p>
    </body>
  </html>
  ```
- **No dynamic JS or external CSS** — static HTML only, SES renders it server-side

---

### Step 6: Lambda Handler — sendEmail

- **File**: `src/presentation/handlers/sendEmail.ts`
- **Action**: SQS-triggered handler — read message from queue, render HTML template, send via SES
- **Function signature**:
  ```typescript
  export const handler: SQSHandler = async (event): Promise<void>
  ```
- **Implementation logic**:
  1. Extract `record = event.Records[0]` — `batchSize: 1` guarantees exactly one record
  2. Parse `record.body` as the SQS payload: `{ type: string; data: ContactMessageData & { id: string; timestamp: number } }`
  3. Load the template: `fs.readFileSync(path.join(__dirname, '../templates/emailTemplate.html'), 'utf-8')`
  4. Replace all placeholders using string `.replace()` — replace `{{name}}`, `{{lastname}}`, `{{email}}`, `{{phone}}`, `{{message}}`
  5. Send via `sesClient.send(new SendEmailCommand({ ... }))`:
     - `Source`: `process.env['EMAIL_SOURCE']`
     - `Destination.ToAddresses`: `[process.env['DESTINATION_EMAIL'] ?? '']`
     - `Message.Subject.Data`: e.g. `Nuevo mensaje de contacto - {{name}} {{lastname}}`
     - `Message.Body.Html.Data`: the rendered HTML
  6. `console.log` success with the `id` from the payload
  7. On error: `console.error` and re-throw (SQS will retry; after 3 attempts it goes to DLQ)
- **Template path note**: In Lambda, `__dirname` points to the directory of the compiled JS file. Since `serverless.yml` deploys `src/` as-is (no bundler), `__dirname` is `src/presentation/handlers` and the template is at `../templates/emailTemplate.html`.

---

### Step 7: serverless.yml — No changes required

The `receiveMessage` and `sendEmail` functions are already registered in `serverless.yml` from SCRUM-1. **No edits needed.**

---

### Step 8: Unit Tests

#### 8a. ContactMessage entity — `__tests__/unit/domain/models/ContactMessage.test.ts`

```
describe('ContactMessage')
  constructor:
    ✓ should set all fields from ContactMessageData
    ✓ should set id from the first argument
    ✓ should set timestamp to Date.now() at construction time
  toQueuePayload():
    ✓ should return an object with type "contact_message"
    ✓ should include all entity fields nested under "data"
    ✓ should include id and timestamp in data
```

#### 8b. Validator — `__tests__/unit/application/validators/contactMessageValidator.test.ts`

```
describe('validateContactMessage')
  Happy path:
    ✓ should return validated data when all fields are valid
    ✓ should trim whitespace from all string fields
  Body shape:
    ✓ should throw ValidationError when body is null
    ✓ should throw ValidationError when body is not an object (string, number, array)
  name:
    ✓ should throw ValidationError when name is missing
    ✓ should throw ValidationError when name is too short (1 char)
    ✓ should throw ValidationError when name is too long (101 chars)
    ✓ should throw ValidationError when name is empty string
  lastname:
    ✓ should throw ValidationError when lastname is missing
    ✓ should throw ValidationError when lastname is too short
    ✓ should throw ValidationError when lastname is too long
  email:
    ✓ should throw ValidationError when email is missing
    ✓ should throw ValidationError when email has no @ symbol
    ✓ should throw ValidationError when email has no domain part
  phone:
    ✓ should throw ValidationError when phone is missing
    ✓ should throw ValidationError when phone is too short (5 chars)
    ✓ should throw ValidationError when phone is too long (21 chars)
  message:
    ✓ should throw ValidationError when message is missing
    ✓ should throw ValidationError when message is too short (9 chars)
    ✓ should throw ValidationError when message is too long (1001 chars)
```

**Mocking**: none required — pure function.

#### 8c. Service — `__tests__/unit/application/services/contactMessageService.test.ts`

```
describe('processContactMessage')
  Happy path:
    ✓ should return id and messageId when data is valid
    ✓ should call SQS SendMessageCommand with the correct QueueUrl
    ✓ should call SQS with a payload where type is "contact_message"
  Validation:
    ✓ should throw ValidationError when body is invalid (propagated from validator)
  Rate limit:
    ✓ should throw AppError(429) when checkRateLimit throws
  SQS error:
    ✓ should propagate error when SQS send fails
```

**Mocking**:
- `jest.mock('../../../src/infrastructure/aws/sqsClient')` — mock `sqsClient.send` to resolve with `{ MessageId: 'mock-id' }`
- `jest.mock('../../../src/infrastructure/middleware/rateLimit')` — mock `checkRateLimit` to resolve by default; reject with `AppError(429)` in the rate-limit test case
- `jest.mock('uuid', () => ({ v1: () => 'mock-uuid-1234' }))` — deterministic IDs

#### 8d. receiveMessage handler — `__tests__/unit/presentation/handlers/receiveMessage.test.ts`

```
describe('receiveMessage handler')
  ✓ should return 200 with { message: "Message received" } on valid request
  ✓ should return 400 when body is invalid JSON
  ✓ should return 400 when validation fails (ValidationError)
  ✓ should return 429 when rate limit is exceeded (AppError 429)
  ✓ should return 500 on unexpected error (non-AppError)
```

**Mocking**:
- `jest.mock('../../../src/application/services/contactMessageService')` — mock `processContactMessage`
- Construct a minimal `APIGatewayProxyEvent` with `body` and `requestContext.identity.sourceIp`

#### 8e. sendEmail handler — `__tests__/unit/presentation/handlers/sendEmail.test.ts`

```
describe('sendEmail handler')
  ✓ should call SES SendEmailCommand with correct Source and Destination
  ✓ should replace all placeholders in the HTML template
  ✓ should use EMAIL_SOURCE and DESTINATION_EMAIL env vars
  ✓ should re-throw on SES error (so SQS can retry)
  ✓ should log the message id on success
```

**Mocking**:
- `jest.mock('../../../src/infrastructure/aws/sesClient')` — mock `sesClient.send`
- `jest.mock('fs')` — mock `fs.readFileSync` to return a controlled template string with all 5 placeholders
- Set `process.env['EMAIL_SOURCE']` and `process.env['DESTINATION_EMAIL']` in `beforeEach`

---

## 4. Implementation Order

0. Create feature branch `feature/SCRUM-2-backend`
1. **Test** `ContactMessage.test.ts` (failing) → **implement** `ContactMessage.ts`
2. **Test** `contactMessageValidator.test.ts` (failing) → **implement** `contactMessageValidator.ts`
3. **Test** `contactMessageService.test.ts` (failing) → **implement** `contactMessageService.ts`
4. **Test** `receiveMessage.test.ts` (failing) → **implement** `receiveMessage.ts`
5. Create `emailTemplate.html`
6. **Test** `sendEmail.test.ts` (failing) → **implement** `sendEmail.ts`
7. `serverless.yml` — verify handler paths match (no edits expected)
8. Update `openspec/specs/api-spec.yml` — expand `POST /message` with complete schema

---

## 5. Error Response Format

All errors follow the existing shape established in SCRUM-1:

```json
// 400 Bad Request
{ "error": "Validation failed: message must be at least 10 characters" }

// 429 Too Many Requests
{ "error": "Rate limit exceeded. Retry in 120 seconds." }

// 500 Internal Server Error
{ "error": "Internal server error" }
```

HTTP status code mapping:

| Condition | Status | Handler logic |
|---|---|---|
| `ValidationError` | 400 | `badRequest(error.message)` |
| `AppError` with `statusCode === 429` | 429 | `tooManyRequests(error.message)` |
| Malformed JSON body | 400 | `badRequest('Invalid JSON body')` |
| Unhandled error | 500 | `internalServerError()` |

---

## 6. Testing Checklist

- [ ] `ContactMessage` entity: all fields set, `toQueuePayload` shape verified
- [ ] Validator: every field's happy path and every failure mode covered
- [ ] Service: happy path, validation passthrough, rate-limit passthrough, SQS error
- [ ] `receiveMessage` handler: 200, 400 (bad JSON), 400 (validation), 429, 500
- [ ] `sendEmail` handler: SES called, template rendered, error re-thrown
- [ ] `npm run test:coverage` ≥ 90% branches, functions, lines, statements (global)
- [ ] All tests follow AAA pattern
- [ ] No `any` in test mock types (use `jest.MockedFunction` with explicit cast where needed)

---

## 7. Dependencies

No new npm packages are required beyond what SCRUM-1 already installed:

| Package | Already in `package.json` | Used by |
|---|---|---|
| `uuid` | yes (`^9.0.0`) | `contactMessageService` — `uuidv1()` |
| `@aws-sdk/client-sqs` | yes | `contactMessageService` — `SendMessageCommand` |
| `@aws-sdk/client-ses` | yes | `sendEmail` — `SendEmailCommand` |
| `fs` (Node built-in) | yes (Node 22) | `sendEmail` — `readFileSync` |
| `path` (Node built-in) | yes (Node 22) | `sendEmail` — `join(__dirname, ...)` |

---

## 8. Notes

### Business rules
- All five fields (`name`, `lastname`, `email`, `phone`, `message`) are **required** — no optional fields in the contact form
- Trimmed values are used for both validation length checks and the final `ContactMessage` entity
- UUID v1 is used (not v4) — preserves chronological ordering in SQS
- Rate limiting is applied **after** validation — an invalid body should fail fast before touching DynamoDB

### Template loading in Lambda
- `serverless.yml` uses no bundler — the framework zips the whole project. `__dirname` in the deployed `sendEmail.js` will be `/var/task/src/presentation/handlers`
- The template path `path.join(__dirname, '../templates/emailTemplate.html')` resolves to `/var/task/src/presentation/templates/emailTemplate.html` — correct for the deployed zip
- For local testing with `serverless offline`, the same relative path holds from the `src/presentation/handlers/` directory

### Authorizer — already in place
- `receiveMessage` is already configured in `serverless.yml` with the REQUEST authorizer. The handler does NOT need to re-validate the origin.

### SQS payload shape
- The `sendEmail` handler must parse `record.body` and expect the shape that `ContactMessage.toQueuePayload()` produces:
  ```typescript
  interface SqsMessageBody {
    type: 'contact_message';
    data: {
      id: string;
      name: string;
      lastname: string;
      email: string;
      phone: string;
      message: string;
      timestamp: number;
    };
  }
  ```

### What the next ticket (project-request) will add
- `src/domain/models/ProjectRequest.ts`
- `src/application/validators/projectRequestValidator.ts`
- `src/application/services/projectRequestService.ts`
- `src/presentation/handlers/receiveProjectRequest.ts`
- `sendEmail` handler will need to handle `type === 'project_request'` with a different template

---

## 9. Implementation Verification

- [ ] Code follows DDD layered architecture — no cross-layer imports
- [ ] `ContactMessage` has zero external dependencies
- [ ] `contactMessageService` does not import `@aws-sdk/*` directly (uses `sqsClient` from infrastructure)
- [ ] `receiveMessage` handler contains no business logic
- [ ] `sendEmail` handler reads template from filesystem — no hardcoded HTML strings
- [ ] TypeScript strict — no `any`
- [ ] `npm run type-check` exits with 0 errors
- [ ] `npm run test:coverage` passes all thresholds
- [ ] `openspec/specs/api-spec.yml` updated with the full `POST /message` schema

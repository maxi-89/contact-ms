# Backend Implementation Plan: SCRUM-1 — Bootstrap contact-ms

## 1. Overview

Bootstrap the `contact-ms` serverless microservice from scratch. This ticket establishes the full project skeleton — package configuration, TypeScript setup, infrastructure primitives (error classes, AWS SDK clients, rate limiter, HTTP helper), the Lambda authorizer, the `serverless.yml` skeleton, and all project configuration files.

**No feature endpoints are implemented here.** Those live in SCRUM-2 (`POST /message`) and a future ticket (`POST /project-request`).

**Layers touched:**
- Infrastructure — error classes, AWS SDK clients, rate-limit middleware, HTTP response helper
- Presentation — Lambda authorizer handler
- Configuration — `package.json`, `tsconfig.json`, `jest.config.ts`, `serverless.yml`, `.env.example`

**DDD principle applied:** Establish clean layer boundaries so all future tickets can drop code into the right place without touching bootstrap files.

---

## 2. Architecture Context

### Files to create

```
contact-ms/
├── package.json
├── tsconfig.json
├── jest.config.ts
├── .env.example
├── .gitignore
├── serverless.yml
└── src/
    └── infrastructure/
        ├── errors/
        │   ├── AppError.ts
        │   └── ValidationError.ts
        ├── aws/
        │   ├── dynamodbClient.ts
        │   ├── sqsClient.ts
        │   └── sesClient.ts
        ├── middleware/
        │   └── rateLimit.ts
        └── http/
            └── response.ts
    └── presentation/
        └── handlers/
            └── authorizer.ts
```

### Files to update (docs)

```
openspec/specs/api-spec.yml          # Add POST /message + POST /project-request stubs
openspec/specs/data-model.md         # Add RateLimit entity schema
openspec/specs/development_guide.md  # Add setup, npm scripts, local dev instructions
```

### Dependencies between components

```
authorizer.ts     → (no src deps — pure AWS Lambda event handling)
rateLimit.ts      → dynamodbClient.ts, AppError.ts
sqsClient.ts      → (standalone)
sesClient.ts      → (standalone)
dynamodbClient.ts → (standalone)
response.ts       → (standalone)
```

---

## 3. Implementation Steps

### Step 0: Create Feature Branch

- **Action**: Create and switch to the feature branch
- **Branch**: `feature/SCRUM-1-bootstrap`
- **Steps**:
  1. `git checkout main && git pull origin main`
  2. `git checkout -b feature/SCRUM-1-bootstrap`
  3. Verify: `git branch`

---

### Step 1: Initialize package.json

- **File**: `package.json`
- **Action**: Create the Node.js project manifest with all required dependencies and npm scripts
- **Required `dependencies`**:
  - `uuid` — UUID v1 generation for message IDs
  - `@aws-sdk/client-dynamodb` — DynamoDB SDK v3
  - `@aws-sdk/lib-dynamodb` — DynamoDB Document Client (v3)
  - `@aws-sdk/client-sqs` — SQS SDK v3
  - `@aws-sdk/client-ses` — SES SDK v3
- **Required `devDependencies`**:
  - `typescript`
  - `ts-jest`
  - `jest`
  - `@types/jest`
  - `@types/node`
  - `@types/aws-lambda`
  - `@types/uuid`
  - `serverless`
  - `serverless-offline`
  - `serverless-dynamodb-local`
  - `@typescript-eslint/eslint-plugin`
  - `@typescript-eslint/parser`
  - `eslint`
  - `prettier`
- **Required scripts**:
  ```json
  {
    "build": "tsc",
    "test": "jest",
    "test:coverage": "jest --coverage",
    "lint": "eslint src --ext .ts",
    "type-check": "tsc --noEmit",
    "offline": "serverless offline start"
  }
  ```
- **Note**: Set `"engines": { "node": ">=22.0.0" }`

---

### Step 2: Configure TypeScript

- **File**: `tsconfig.json`
- **Action**: Create TypeScript config with strict mode enabled
- **Required settings**:
  ```json
  {
    "compilerOptions": {
      "target": "ES2023",
      "module": "commonjs",
      "lib": ["ES2023"],
      "outDir": "./dist",
      "rootDir": "./src",
      "strict": true,
      "esModuleInterop": true,
      "skipLibCheck": true,
      "forceConsistentCasingInFileNames": true,
      "resolveJsonModule": true,
      "declaration": true,
      "declarationMap": true,
      "sourceMap": true
    },
    "include": ["src/**/*"],
    "exclude": ["node_modules", "dist", "__tests__"]
  }
  ```

---

### Step 3: Configure Jest

- **File**: `jest.config.ts`
- **Action**: Configure Jest with ts-jest and 90% coverage thresholds
- **Key settings**:
  - `preset: 'ts-jest'`
  - `testEnvironment: 'node'`
  - `roots: ['<rootDir>/__tests__']`
  - `collectCoverageFrom: ['src/**/*.ts']`
  - Coverage thresholds: `{ branches: 90, functions: 90, lines: 90, statements: 90 }`
  - `moduleNameMapper` to support path aliases if needed

---

### Step 4: Create `.gitignore` and `.env.example`

- **File**: `.gitignore`
- **Action**: Standard Node.js gitignore — `node_modules/`, `dist/`, `.env`, `.serverless/`, coverage reports
- **File**: `.env.example`
- **Action**: Document all required environment variables with placeholder values
  ```
  REGION=us-east-1
  PENDING_MESSAGES_QUEUE=https://sqs.us-east-1.amazonaws.com/123456789/my-queue
  EMAIL_SOURCE=no-reply@example.com
  DESTINATION_EMAIL=contact@example.com
  CLOUDFRONT_DOMAIN=d1234abcd.cloudfront.net
  RATE_LIMIT_TABLE=contact-ms-dev-rate-limit
  DYNAMODB_ENDPOINT=http://localhost:8000
  IS_OFFLINE=true
  ```

---

### Step 5: Create Error Classes

#### Step 5a: AppError

- **File**: `src/infrastructure/errors/AppError.ts`
- **Action**: Define a base application error with an HTTP status code
- **Interface**:
  ```typescript
  export class AppError extends Error {
    constructor(message: string, public readonly statusCode: number = 500) {
      super(message);
      this.name = 'AppError';
    }
  }
  ```

#### Step 5b: ValidationError

- **File**: `src/infrastructure/errors/ValidationError.ts`
- **Action**: Define a validation-specific error (always maps to HTTP 400)
- **Interface**:
  ```typescript
  export class ValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ValidationError';
    }
  }
  ```

---

### Step 6: Create AWS SDK Clients

All clients must support local development via `IS_OFFLINE=true`.

#### Step 6a: DynamoDB Client

- **File**: `src/infrastructure/aws/dynamodbClient.ts`
- **Action**: Create and export a `DynamoDBDocumentClient` singleton
- **Key logic**:
  - When `IS_OFFLINE === 'true'`: use `endpoint: process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000'` with fake credentials
  - Otherwise: use default AWS SDK credential chain
  - Export as `dynamodb` (named export)

#### Step 6b: SQS Client

- **File**: `src/infrastructure/aws/sqsClient.ts`
- **Action**: Create and export an `SQSClient` singleton
- **Key logic**:
  - `region`: `process.env.REGION ?? 'us-east-1'`
  - When `IS_OFFLINE === 'true'`: use `endpoint: 'http://localhost:9324'` (ElasticMQ default)
  - Export as `sqsClient` (named export)

#### Step 6c: SES Client

- **File**: `src/infrastructure/aws/sesClient.ts`
- **Action**: Create and export an `SESClient` singleton
- **Key logic**:
  - `region`: `process.env.REGION ?? 'us-east-1'`
  - Export as `sesClient` (named export)
  - Note: SES has no local emulator; unit tests mock it

---

### Step 7: Create Rate Limit Middleware

- **File**: `src/infrastructure/middleware/rateLimit.ts`
- **Action**: Implement IP- and email-based rate limiting using DynamoDB
- **Function signature**:
  ```typescript
  export async function checkRateLimit(clientIp: string, email: string): Promise<void>
  ```
- **Rules** (from ticket):
  | Rule | Value |
  |---|---|
  | Max requests per IP per hour | 5 |
  | Max requests per email per hour | 2 |
  | Min seconds between requests from same IP | 300 |
  | On DynamoDB error | fail open — log error, do NOT throw |
- **DynamoDB key design**:
  - IP window record: `PK = IP#<ip>`, `SK = WINDOW#<hourTimestamp>` — stores a count and TTL
  - Email window record: `PK = EMAIL#<email>`, `SK = WINDOW#<hourTimestamp>` — stores a count and TTL
  - `<hourTimestamp>` = Unix timestamp rounded to the current hour (e.g., `Math.floor(Date.now() / 3600000) * 3600`)
- **Implementation logic**:
  1. Compute `hourTimestamp` for the current window
  2. Fetch the IP window record from DynamoDB (`GetCommand`)
  3. Fetch the email window record from DynamoDB (`GetCommand`)
  4. If IP count ≥ 5: throw `new AppError('Rate limit exceeded', 429)` with `retryAfter` seconds until next hour
  5. If email count ≥ 2: throw `new AppError('Rate limit exceeded', 429)` with `retryAfter` seconds
  6. Check `lastRequestAt` on IP record: if `(now - lastRequestAt) < 300_000` ms: throw `new AppError('Rate limit exceeded', 429)`
  7. Increment both counters atomically using `UpdateCommand` with `ADD` expression
  8. Set TTL on both records to `hourTimestamp + 7200` (2 hours past the window)
  9. On any DynamoDB error: `console.error(error)` and return (fail open)
- **Table**: read from `process.env.RATE_LIMIT_TABLE`
- **Note**: `AppError` thrown here should carry `{ retryAfter: secondsUntilReset }` — consider adding an optional `meta` field to `AppError`, or just encode `retryAfter` in the message

---

### Step 8: Create HTTP Response Helper

- **File**: `src/infrastructure/http/response.ts`
- **Action**: Create a typed helper that produces `APIGatewayProxyResult` objects
- **Function signatures**:
  ```typescript
  export function ok(body: unknown): APIGatewayProxyResult
  export function badRequest(message: string): APIGatewayProxyResult
  export function tooManyRequests(message: string, retryAfter?: number): APIGatewayProxyResult
  export function internalServerError(): APIGatewayProxyResult
  ```
- **All responses**:
  - Include `headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }`
  - Serialize body as `JSON.stringify(...)`
  - Error shape: `{ error: string }` — success shape: whatever `body` is

---

### Step 9: Create Lambda Authorizer

- **File**: `src/presentation/handlers/authorizer.ts`
- **Action**: Implement a token-based Lambda Authorizer that validates the request origin against the CloudFront domain allowlist
- **Handler signature**:
  ```typescript
  export const handler: APIGatewayAuthorizerHandler = async (event): Promise<APIGatewayAuthorizerResult>
  ```
- **Logic**:
  1. Extract `origin` from `event.authorizationToken` (API Gateway passes the `Authorization` header here; alternatively configure as `REQUEST` type authorizer to read from headers — see Note)
  2. Build the allowlist: `[https://${CLOUDFRONT_DOMAIN}, http://localhost:3000, http://localhost:5173]`
  3. If `origin` is in the allowlist: return an `Allow` policy document for `event.methodArn`
  4. Otherwise: return a `Deny` policy document
- **Policy document shape**:
  ```typescript
  {
    principalId: 'contact-ms-client',
    policyDocument: {
      Version: '2012-10-17',
      Statement: [{ Action: 'execute-api:Invoke', Effect: 'Allow' | 'Deny', Resource: event.methodArn }]
    }
  }
  ```
- **Note**: The existing JS reference uses a `REQUEST` type authorizer reading the `origin` header directly. Configure `serverless.yml` accordingly (`type: REQUEST`, read `event.headers.origin`).
- **Environment variable**: `CLOUDFRONT_DOMAIN` — from `process.env.CLOUDFRONT_DOMAIN`

---

### Step 10: Create serverless.yml Skeleton

- **File**: `serverless.yml`
- **Action**: Define the service with all shared configuration, the authorizer function, the SQS-triggered `sendEmail` stub, and the DynamoDB resources
- **Key sections**:

  **provider**:
  ```yaml
  name: aws
  runtime: nodejs22.x
  stage: ${opt:stage, 'dev'}
  region: ${opt:region, 'us-east-1'}
  environment:
    REGION: ${self:provider.region}
    PENDING_MESSAGES_QUEUE: !Ref PendingMessagesQueue
    EMAIL_SOURCE: ${env:EMAIL_SOURCE}
    DESTINATION_EMAIL: ${env:DESTINATION_EMAIL}
    CLOUDFRONT_DOMAIN: ${env:CLOUDFRONT_DOMAIN}
    RATE_LIMIT_TABLE: !Ref RateLimitTable
  ```

  **IAM permissions** (least privilege):
  - `dynamodb:GetItem`, `dynamodb:UpdateItem`, `dynamodb:PutItem` on `RateLimitTable`
  - `sqs:SendMessage` on `PendingMessagesQueue`
  - `sqs:ReceiveMessage`, `sqs:DeleteMessage`, `sqs:GetQueueAttributes` on `PendingMessagesQueue`
  - `ses:SendEmail` on `*`

  **functions** (stubs — handlers not yet implemented):
  ```yaml
  authorizer:
    handler: src/presentation/handlers/authorizer.handler

  receiveMessage:
    handler: src/presentation/handlers/receiveMessage.handler
    events:
      - http:
          path: /message
          method: post
          cors: true
          authorizer:
            name: authorizer
            type: REQUEST
            identitySource: method.request.header.origin

  receiveProjectRequest:
    handler: src/presentation/handlers/receiveProjectRequest.handler
    events:
      - http:
          path: /project-request
          method: post
          cors: true
          authorizer:
            name: authorizer
            type: REQUEST
            identitySource: method.request.header.origin

  sendEmail:
    handler: src/presentation/handlers/sendEmail.handler
    events:
      - sqs:
          arn: !GetAtt PendingMessagesQueue.Arn
          batchSize: 1
  ```

  **resources**:
  - `PendingMessagesQueue`: `AWS::SQS::Queue` with a DLQ and `VisibilityTimeout: 60`
  - `PendingMessagesDLQ`: `AWS::SQS::Queue`
  - `RateLimitTable`: `AWS::DynamoDB::Table` with `PK` (HASH) + `SK` (RANGE), TTL attribute `ttl`, `PAY_PER_REQUEST`

  **plugins**:
  ```yaml
  plugins:
    - serverless-offline
    - serverless-dynamodb-local
  ```

  **custom** (for serverless-dynamodb-local):
  ```yaml
  custom:
    dynamodb:
      stages: [dev]
      start:
        port: 8000
        inMemory: true
        migrate: true
  ```

---

### Step 11: Write Unit Tests

- **Directory**: `__tests__/unit/`

#### 11a. AppError — `__tests__/unit/infrastructure/errors/AppError.test.ts`
```
describe('AppError')
  ✓ should set name to "AppError"
  ✓ should set default statusCode to 500
  ✓ should accept a custom statusCode
  ✓ should set message correctly
```

#### 11b. ValidationError — `__tests__/unit/infrastructure/errors/ValidationError.test.ts`
```
describe('ValidationError')
  ✓ should set name to "ValidationError"
  ✓ should set message correctly
  ✓ should be instanceof Error
```

#### 11c. Rate Limit — `__tests__/unit/infrastructure/middleware/rateLimit.test.ts`
```
describe('checkRateLimit')
  Happy path:
    ✓ should return void when both IP and email counts are below limits
  IP rate limit:
    ✓ should throw AppError(429) when IP count reaches 5
  Email rate limit:
    ✓ should throw AppError(429) when email count reaches 2
  Cooldown:
    ✓ should throw AppError(429) when last request from IP was < 300s ago
  Fail open:
    ✓ should not throw when DynamoDB GetCommand throws — logs error instead
    ✓ should not throw when DynamoDB UpdateCommand throws — logs error instead
```

**Mocking**: `jest.mock('../../../src/infrastructure/aws/dynamodbClient')` — mock `dynamodb.send` to control `GetCommand` responses.

#### 11d. HTTP Response Helper — `__tests__/unit/infrastructure/http/response.test.ts`
```
describe('response helpers')
  ok():
    ✓ should return statusCode 200 with JSON-serialized body
    ✓ should include Content-Type and CORS headers
  badRequest():
    ✓ should return statusCode 400 with { error: message }
  tooManyRequests():
    ✓ should return statusCode 429 with { error: message }
    ✓ should include retryAfter in body when provided
  internalServerError():
    ✓ should return statusCode 500 with { error: 'Internal server error' }
```

#### 11e. Authorizer — `__tests__/unit/presentation/handlers/authorizer.test.ts`
```
describe('authorizer handler')
  ✓ should return Allow policy when origin matches CloudFront domain
  ✓ should return Allow policy when origin is http://localhost:3000
  ✓ should return Allow policy when origin is http://localhost:5173
  ✓ should return Deny policy when origin is not in allowlist
  ✓ should return Deny policy when origin header is missing
```

**Mocking**: Set `process.env.CLOUDFRONT_DOMAIN = 'test.cloudfront.net'` in `beforeEach`.

---

### Step 12: Update Documentation

#### 12a. `openspec/specs/api-spec.yml`

- **Action**: Add the two endpoint stubs and the authorizer description
- **Add** `info.title: "contact-ms API"`, `info.description`, and `servers` pointing to the API Gateway URL
- **Add** paths:
  - `POST /message` — request body, all response codes (200, 400, 403, 429, 500)
  - `POST /project-request` — request body, all response codes
- **Add** `securitySchemes.OriginAuthorizer` documenting the CloudFront origin check

#### 12b. `openspec/specs/data-model.md`

- **Action**: Replace template placeholders with actual content
- **Table name**: `contact-ms-{stage}` (RateLimitTable; there is no general-purpose main table — rate limiting is the only DynamoDB use in this service)
- **Add RateLimit entity**:
  - IP window: `PK = IP#<ip>`, `SK = WINDOW#<hourTimestamp>`
  - Email window: `PK = EMAIL#<email>`, `SK = WINDOW#<hourTimestamp>`
  - Attributes: `PK`, `SK`, `entityType`, `count` (Number), `lastRequestAt` (Number — Unix ms), `ttl` (Number — Unix seconds)
- **Add access patterns**:
  - Get IP window by IP + hour → primary key lookup
  - Get email window by email + hour → primary key lookup

#### 12c. `openspec/specs/development_guide.md`

- **Action**: Document the full local setup and npm scripts
- **Add sections**:
  - Prerequisites (Node 22, AWS CLI, Serverless Framework)
  - Installation: `npm install`
  - Local development: `npm run offline` (starts serverless-offline + DynamoDB Local)
  - Running tests: `npm test` / `npm run test:coverage`
  - Type checking: `npm run type-check`
  - Environment setup: copy `.env.example` to `.env` and fill values

---

## 4. Implementation Order

0. Create feature branch `feature/SCRUM-1-bootstrap`
1. `package.json` — define all deps and scripts
2. `tsconfig.json` — TypeScript strict config
3. `jest.config.ts` — Jest + ts-jest + coverage thresholds
4. `.gitignore` + `.env.example` — project hygiene
5. `src/infrastructure/errors/AppError.ts`
6. `src/infrastructure/errors/ValidationError.ts`
7. `src/infrastructure/aws/dynamodbClient.ts`
8. `src/infrastructure/aws/sqsClient.ts`
9. `src/infrastructure/aws/sesClient.ts`
10. `src/infrastructure/middleware/rateLimit.ts`
11. `src/infrastructure/http/response.ts`
12. `src/presentation/handlers/authorizer.ts`
13. `serverless.yml`
14. Unit tests (Steps 11a–11e) — TDD: write tests first, then implementation
15. Update `openspec/specs/api-spec.yml`, `data-model.md`, `development_guide.md`

---

## 5. Error Response Format

```json
// 400 Bad Request
{ "error": "name is required and must be a non-empty string" }

// 403 Forbidden (from API Gateway after Deny policy)
{ "message": "Forbidden" }

// 429 Too Many Requests
{ "error": "Rate limit exceeded", "retryAfter": 1843 }

// 500 Internal Server Error
{ "error": "Internal server error" }
```

HTTP status code mapping:

| Condition | Status |
|---|---|
| `ValidationError` | 400 |
| Origin not in allowlist | 403 (via Lambda Authorizer Deny) |
| `AppError` with statusCode 429 | 429 |
| Unhandled error | 500 |

---

## 6. Testing Checklist

- [ ] `AppError` and `ValidationError` are fully tested (name, message, statusCode)
- [ ] `checkRateLimit` happy path and all three limit conditions covered
- [ ] `checkRateLimit` fail-open behavior covered (DynamoDB errors do not throw)
- [ ] `response.ts` helpers: all status codes and header presence verified
- [ ] Authorizer: Allow and Deny for each valid/invalid origin scenario
- [ ] `npm run test:coverage` passes ≥ 90% on branches, functions, lines, statements
- [ ] All tests follow AAA pattern
- [ ] No tests use `any` in mock types

---

## 7. Dependencies

| Package | Type | Justification |
|---|---|---|
| `@aws-sdk/client-dynamodb` | prod | Rate-limit table access |
| `@aws-sdk/lib-dynamodb` | prod | Document client — plain JS objects instead of AttributeValue |
| `@aws-sdk/client-sqs` | prod | Enqueue messages for async email processing |
| `@aws-sdk/client-ses` | prod | Send emails (used by sendEmail handler in SCRUM-2) |
| `uuid` | prod | UUID v1 for deterministic chronological IDs (matches legacy JS behavior) |
| `serverless-offline` | dev | Local Lambda + API Gateway emulation |
| `serverless-dynamodb-local` | dev | Local DynamoDB for integration tests |
| `ts-jest` | dev | TypeScript-native Jest transform |
| `@types/aws-lambda` | dev | Types for `APIGatewayProxyEvent`, `SQSEvent`, etc. |

---

## 8. Notes

### Assumptions

- **Rate-limit table is separate** from any future main application table. The ticket's `RATE_LIMIT_TABLE` env var points to a dedicated table, not the general-purpose single-table.
- **SES is not mocked locally** — `sesClient.ts` is created here but only used in `sendEmail` handler (SCRUM-2). Local test of email sending uses Jest mocks.
- **Authorizer uses REQUEST type**, reading `event.headers.origin` directly — not the `Authorization` header. This aligns with the legacy JS reference and avoids putting the origin in a bearer token.
- **UUID v1** is used for message IDs to maintain chronological ordering of SQS messages, matching the existing JS reference code.

### Known constraints

- `process.env.CLOUDFRONT_DOMAIN` must not include protocol prefix — the authorizer prepends `https://`.
- The rate-limit DynamoDB table must have TTL enabled on the `ttl` attribute for automatic cleanup of expired windows.
- `serverless-dynamodb-local` requires Java installed locally. Document this in `development_guide.md`.

### What SCRUM-2 adds on top of this

- `src/domain/models/ContactMessage.ts`
- `src/application/validators/contactMessageValidator.ts`
- `src/application/services/contactMessageService.ts`
- `src/presentation/handlers/receiveMessage.ts`
- `src/presentation/handlers/sendEmail.ts`
- `src/presentation/templates/emailTemplate.html`

---

## 9. Implementation Verification

- [ ] Code follows DDD layered architecture — no cross-layer imports
- [ ] No business logic in Lambda handlers (authorizer only does policy generation)
- [ ] No AWS SDK imports in application or domain layers
- [ ] TypeScript strict — no `any`
- [ ] All tests pass with ≥ 90% coverage
- [ ] `npx tsc --noEmit` exits with 0 errors
- [ ] `serverless offline start` launches without errors
- [ ] Documentation updated (`api-spec.yml`, `data-model.md`, `development_guide.md`)

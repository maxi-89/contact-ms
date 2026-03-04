# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] — 2026-03-04

### Added

- `ContactMessage` domain entity with `toQueuePayload()` method (`src/domain/models/ContactMessage.ts`)
- `validateContactMessage` input validator with field-level rules (`src/application/validators/contactMessageValidator.ts`)
- `processContactMessage` application service orchestrating validation, rate limiting, entity creation, and SQS enqueue (`src/application/services/contactMessageService.ts`)
- `receiveMessage` Lambda handler for `POST /message` with error-to-status mapping (`src/presentation/handlers/receiveMessage.ts`)
- `sendEmail` Lambda handler triggered by SQS, renders HTML template and sends via SES (`src/presentation/handlers/sendEmail.ts`)
- HTML email template with placeholders for name, lastname, email, phone, and message (`src/presentation/templates/emailTemplate.html`)
- Full unit test suite for all new components (44 tests)
- API spec updated in `openspec/specs/api-spec.yml` with `POST /message` schemas
- Data model documented in `openspec/specs/data-model.md`

### Changed

- `serverless.yml`: registered `receiveMessage` and `sendEmail` functions with IAM and SQS event bindings

## [0.1.0] — 2026-03-04

### Added

- Project bootstrap: `package.json`, `tsconfig.json`, `jest.config.ts`, `.eslintrc.json`, `.gitignore`, `.env.example`
- `AppError` and `ValidationError` custom error classes (`src/infrastructure/errors/`)
- AWS SDK v3 singleton clients: `dynamodbClient`, `sqsClient`, `sesClient` (`src/infrastructure/aws/`)
- `checkRateLimit` middleware using DynamoDB: 5 req/IP/hour, 2 req/email/hour, 300 s cooldown, fail-open (`src/infrastructure/middleware/rateLimit.ts`)
- HTTP response helpers with CORS headers: `ok`, `badRequest`, `tooManyRequests`, `internalServerError` (`src/infrastructure/http/response.ts`)
- REQUEST-type Lambda Authorizer validating `origin` header against CloudFront domain allowlist (`src/presentation/handlers/authorizer.ts`)
- Placeholder `receiveProjectRequest` handler stub (`src/presentation/handlers/receiveProjectRequest.ts`)
- `serverless.yml`: full service definition with SQS queue, DLQ, DynamoDB RateLimitTable (TTL enabled), and IAM least-privilege roles
- Full unit test suite for all bootstrap components (30 tests, 100% coverage)
- OpenAPI 3.0 spec skeleton (`openspec/specs/api-spec.yml`)
- Backend standards and documentation standards (`openspec/specs/`)

[Unreleased]: https://github.com/maxi-89/contact-ms/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/maxi-89/contact-ms/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/maxi-89/contact-ms/releases/tag/v0.1.0

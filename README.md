# contact-ms

Serverless microservice that handles contact form submissions from the Celia website. It validates requests, applies rate limiting, and delivers them asynchronously via SES email.

## How it works

```
Client → API Gateway → Lambda Authorizer (origin check)
                              ↓
                     receiveMessage handler
                              ↓
                    Validate input fields
                              ↓
                   Check rate limit (DynamoDB)
                              ↓
                      Enqueue to SQS
                              ↓
                   sendEmail handler (SQS trigger)
                              ↓
                       Send email via SES
```

## API

### `POST /message`

Receives a contact message from the website form.

**Request**
```json
{
  "name": "John",
  "lastname": "Doe",
  "email": "john@example.com",
  "phone": "+1-555-0100",
  "message": "Hello, I would like to get in touch."
}
```

| Field | Required | Rules |
|---|---|---|
| `name` | yes | 2–100 characters |
| `lastname` | yes | 2–100 characters |
| `email` | yes | valid email format |
| `phone` | yes | 6–20 characters |
| `message` | yes | 10–1000 characters |

**Responses**

| Status | Condition |
|---|---|
| `200 OK` | Message received and enqueued |
| `400 Bad Request` | Validation error |
| `403 Forbidden` | Origin not in allowlist |
| `429 Too Many Requests` | Rate limit exceeded |
| `500 Internal Server Error` | Unexpected error |

### `POST /project-request`

_(Coming in next release)_ Receives a project inquiry.

## Rate Limiting

Enforced via DynamoDB before each enqueue:

| Rule | Value |
|---|---|
| Max requests per IP per hour | 5 |
| Max requests per email per hour | 2 |
| Min seconds between requests from same IP | 300 |
| On DynamoDB error | Fail open (log and allow) |

## Tech Stack

| Concern | Technology |
|---|---|
| Runtime | Node.js 22.x |
| Language | TypeScript (strict) |
| Framework | Serverless Framework v3 |
| Compute | AWS Lambda |
| API | AWS API Gateway (REST) |
| Queue | AWS SQS |
| Email | AWS SES |
| Rate limiting | AWS DynamoDB |
| Testing | Jest + ts-jest |

## Project Structure

```
src/
├── domain/
│   └── models/
│       └── ContactMessage.ts         # Domain entity — zero external deps
├── application/
│   ├── validators/
│   │   └── contactMessageValidator.ts
│   └── services/
│       └── contactMessageService.ts  # Orchestration — no AWS SDK imports
├── infrastructure/
│   ├── aws/
│   │   ├── dynamodbClient.ts
│   │   ├── sqsClient.ts
│   │   └── sesClient.ts
│   ├── middleware/
│   │   └── rateLimit.ts
│   ├── http/
│   │   └── response.ts
│   └── errors/
│       ├── AppError.ts
│       └── ValidationError.ts
└── presentation/
    ├── handlers/
    │   ├── authorizer.ts             # REQUEST-type Lambda Authorizer
    │   ├── receiveMessage.ts         # POST /message
    │   ├── sendEmail.ts              # SQS trigger → SES
    │   └── receiveProjectRequest.ts  # (coming soon)
    └── templates/
        └── emailTemplate.html
```

## Local Setup

### Prerequisites

- Node.js v22+
- Java 8+ (required for DynamoDB Local)
- AWS CLI configured (`aws configure`)
- Serverless Framework: `npm install -g serverless`

### Install

```bash
git clone git@github.com:maxi-89/contact-ms.git
cd contact-ms
npm install
```

### Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

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

### Run locally

```bash
# Install DynamoDB Local (first time only)
npx serverless dynamodb install

# Start API Gateway + DynamoDB Local
npm run offline
```

API available at `http://localhost:3000`.

## Testing

```bash
npm test                  # Run all unit tests
npm run test:coverage     # With coverage report (≥ 90% required)
npm run type-check        # TypeScript strict check
npm run lint              # ESLint
```

Current coverage: **100% statements · 100% functions · 100% lines · 94.2% branches**

## Deploy

```bash
# Deploy to dev
npx serverless deploy --stage dev

# Deploy to production
npx serverless deploy --stage prod
```

After deploying, the CLI outputs the API Gateway endpoint URL.

## Allowed Origins

The Lambda Authorizer validates the `origin` header on every request. Allowed origins:

- `https://${CLOUDFRONT_DOMAIN}` (configured via env var)
- `http://localhost:3000`
- `http://localhost:5173`

All other origins receive `403 Forbidden`.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `REGION` | yes | AWS region (e.g. `us-east-1`) |
| `PENDING_MESSAGES_QUEUE` | yes | SQS queue URL |
| `EMAIL_SOURCE` | yes | SES verified sender address |
| `DESTINATION_EMAIL` | yes | Recipient for all contact emails |
| `CLOUDFRONT_DOMAIN` | yes | Allowed origin for the authorizer (without protocol) |
| `RATE_LIMIT_TABLE` | yes | DynamoDB table name for rate limiting |
| `DYNAMODB_ENDPOINT` | local only | DynamoDB Local endpoint (default: `http://localhost:8000`) |
| `IS_OFFLINE` | local only | Set to `true` to use local AWS SDK endpoints |

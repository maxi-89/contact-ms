# Data Model

## Table Overview

| Property | Value |
|---|---|
| Table name | `contact-ms-{stage}-rate-limit` |
| Partition key | `PK` (String) |
| Sort key | `SK` (String) |
| Billing mode | PAY_PER_REQUEST |
| TTL attribute | `ttl` |

> **Note**: This service uses a single DynamoDB table exclusively for rate limiting.
> There is no general-purpose data table — messages are not persisted; they are enqueued in SQS and processed transiently.

## Access Patterns

| Access Pattern | Index | PK | SK |
|---|---|---|---|
| Get IP rate-limit window | Primary | `IP#<ip>` | `WINDOW#<hourTimestamp>` |
| Get email rate-limit window | Primary | `EMAIL#<email>` | `WINDOW#<hourTimestamp>` |

`<hourTimestamp>` = `Math.floor(Date.now() / 3600000) * 3600` (Unix seconds, rounded to the current hour).

## Entity Definitions

---

### RateLimitWindow (IP)

Tracks how many requests were made from a given IP address within the current hourly window.

**Key pattern**

| Key | Value |
|---|---|
| PK | `IP#<clientIp>` |
| SK | `WINDOW#<hourTimestamp>` |

**Attributes**

| Attribute | Type | Description |
|---|---|---|
| `PK` | String | Partition key — e.g. `IP#1.2.3.4` |
| `SK` | String | Sort key — e.g. `WINDOW#1700000000` |
| `entityType` | String | Always `"RATE_LIMIT_IP"` |
| `count` | Number | Number of requests in this window |
| `lastRequestAt` | Number | Unix timestamp (ms) of the most recent request |
| `ttl` | Number | Unix timestamp (seconds) for DynamoDB TTL — set to `hourTimestamp + 7200` |

**Example item**

```json
{
  "PK": "IP#1.2.3.4",
  "SK": "WINDOW#1700000000",
  "entityType": "RATE_LIMIT_IP",
  "count": 3,
  "lastRequestAt": 1700001234567,
  "ttl": 1700007200
}
```

---

### RateLimitWindow (Email)

Tracks how many requests were made from a given email address within the current hourly window.

**Key pattern**

| Key | Value |
|---|---|
| PK | `EMAIL#<email>` |
| SK | `WINDOW#<hourTimestamp>` |

**Attributes**

| Attribute | Type | Description |
|---|---|---|
| `PK` | String | Partition key — e.g. `EMAIL#user@example.com` |
| `SK` | String | Sort key — e.g. `WINDOW#1700000000` |
| `entityType` | String | Always `"RATE_LIMIT_EMAIL"` |
| `count` | Number | Number of requests in this window |
| `ttl` | Number | Unix timestamp (seconds) for DynamoDB TTL — set to `hourTimestamp + 7200` |

**Example item**

```json
{
  "PK": "EMAIL#user@example.com",
  "SK": "WINDOW#1700000000",
  "entityType": "RATE_LIMIT_EMAIL",
  "count": 1,
  "ttl": 1700007200
}
```

---

## Rate Limiting Rules

| Rule | Value |
|---|---|
| Max requests per IP per hour | 5 |
| Max requests per email per hour | 2 |
| Minimum seconds between requests from same IP | 300 |
| On DynamoDB error | Fail open — log and allow the request |

## Global Secondary Indexes (GSIs)

None — all access patterns are served by the primary key.

## Key Design Conventions

- Key prefixes use uppercase entity type followed by `#` — e.g. `IP#`, `EMAIL#`
- All entities include an `entityType` attribute for filtering/debugging
- Timestamps use Unix milliseconds for `lastRequestAt` and Unix seconds for `ttl`
- Table name is always read from `process.env.RATE_LIMIT_TABLE`

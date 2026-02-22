# Security

## What it is

Authentication, authorization, encryption, and protection of sensitive data in distributed systems.

## When to use

- User-facing systems
- PII, financial data
- Compliance (GDPR, HIPAA)

## Tradeoffs

- Security vs UX (MFA, session length)
- Encryption vs performance (TLS overhead)
- Centralized auth vs per-service

## Failure modes

- Credential leak
- Injection (SQL, NoSQL)
- Man-in-the-middle (no TLS)
- Excessive permissions

## Numbers to mention

- Session TTL
- Token expiry (JWT)
- Rate limits (auth attempts)
- Key rotation period

## Interview prompts

- "How do you handle authentication?"
- "How is PII protected?"
- "Encryption at rest and in transit?"

## Strong answer outline

1. Auth: OAuth2, JWT, session management
2. Authorization: RBAC, least privilege
3. Encryption: TLS in transit, AES at rest
4. PII: masking, retention, deletion
5. Audit logging

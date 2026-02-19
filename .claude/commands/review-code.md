# Code Review

Spawn the reviewer agent to audit the specified component against the PRD specification.

The reviewer will check:
1. Architecture compliance (JS+JSDoc on server, TS on client, ESM only)
2. Security (auth, RLS, input validation, prompt injection prevention)
3. Performance (no N+1, indexes, async heavy work)
4. Convention adherence (kebab-case, pino logging, AppError hierarchy)
5. PRD specification match (does the code do what the spec says?)

Usage: /review-code <component-path>
Example: /review-code server/src/middleware/

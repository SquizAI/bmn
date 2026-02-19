# Brand Me Now v2 -- Agent Teams Workflow Guide

This document explains how to use Claude Code Agent Teams to build Brand Me Now v2 with parallel development streams.

---

## Prerequisites

1. Agent teams are enabled via `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` (already in project settings)
2. All 13 project agents are defined in `.claude/agents/`
3. The master task list is in `.claude/TASK-LIST.md`
4. All PRD docs are in `docs/prd/`

---

## How to Start a Build Phase

### Option 1: Use the /spawn-team Command

```
/spawn-team 1
```

This spawns a team for Phase 1 with the appropriate agents.

### Option 2: Manual Team Creation

Tell Claude Code in natural language:

```
Create an agent team for Phase 1 Foundation. Spawn these teammates:
- server-architect: Build the Express.js 5 server core (Step 1.1 + 1.2)
- database-engineer: Create all Supabase migrations (Step 1.3)
- observability-engineer: Wire up Sentry, PostHog, pino (Step 1.4)

Have them work in parallel on Week 1 tasks. Each should read their
assigned PRD doc first. Require plan approval before implementation.
```

---

## Phase-by-Phase Team Composition

### Phase 1, Week 1 (3 teammates, parallel)

```
Create a team "bmn-phase1-week1" with 3 teammates:
1. server-architect: Read docs/prd/03-SERVER-CORE.md and build Steps 1.1 + 1.2
2. database-engineer: Read docs/prd/07-DATABASE.md and build Step 1.3
3. observability-engineer: Read docs/prd/12-OBSERVABILITY.md and build Step 1.4
All work in parallel. Use plan approval mode.
```

### Phase 1, Week 2 (2 teammates, parallel)

```
Create a team "bmn-phase1-week2" with 2 teammates:
1. auth-security: Read docs/prd/08-AUTH-SECURITY.md and build Step 2.1
2. realtime-engineer: Read docs/prd/06-REAL-TIME-JOBS.md and build Step 2.2
Both depend on server core from Week 1.
```

### Phase 1, Week 3 (1 teammate)

```
Create a team "bmn-phase1-week3" with 1 teammate:
1. ai-agent-engineer: Read docs/prd/04-AGENT-SYSTEM.md and build Step 3.1
Depends on server core + BullMQ/Socket.io from Weeks 1-2.
```

### Phase 2 (1-2 teammates)

```
Create a team "bmn-phase2-skills" with 2 teammates:
1. skill-builder (skills 1-4): Build social-analyzer, brand-generator, name-generator, logo-creator
2. skill-builder (skills 5-7): Build mockup-renderer, profit-calculator, video-creator
```

### Phase 3 (2 teammates)

```
Create a team "bmn-phase3-frontend" with 2 teammates:
1. frontend-engineer: Build app shell + wizard steps (Steps 5.1, 5.2)
2. frontend-engineer: Build dashboard + admin panel (Steps 5.3, 5.4)
Both share the design system.
```

### Phase 4 (2 teammates, parallel)

```
Create a team "bmn-phase4-business" with 2 teammates:
1. payments-engineer: Build Stripe integration (Step 6.1)
2. integrations-engineer: Build GHL + Resend + Apify (Step 6.2)
Fully independent, work in parallel.
```

### Phase 5 (3 teammates, parallel)

```
Create a team "bmn-phase5-launch" with 3 teammates:
1. devops-engineer: Build Docker + K8s + CI/CD (Step 7.1)
2. test-engineer: Build test suite (Step 7.2)
3. marketing-site-engineer: Build Next.js marketing site (Step 7.3)
```

---

## Streaming / Session Management

### Starting a New Stream

Each build phase should be a new Claude Code session (or agent team session). This keeps context focused and prevents token overflow.

### Resuming Work

If a session needs to be continued:
1. Start a new session in the project directory
2. Run `/status` to check current build progress
3. Read the relevant PRD doc for the next task
4. Continue building from where the last session left off

### Parallel Streams

You can run multiple Claude Code sessions simultaneously:
- **Terminal 1**: Phase 1 agent team (server + DB + observability)
- **Terminal 2**: Marketing site (independent, no dependencies)

### Session Handoff

When a phase completes:
1. Run `/verify-step` for each completed step
2. Commit the work (`git add . && git commit`)
3. Start the next phase's agent team

---

## Custom Commands Quick Reference

| Command | Purpose |
|---------|---------|
| `/build-phase <step>` | Execute a specific build step from BUILD-GUIDE |
| `/verify-step <step>` | Run verification for a completed step |
| `/read-prd <number>` | Summarize a PRD document |
| `/spawn-team <phase>` | Create agent team for a build phase |
| `/review-code <path>` | Code review against PRD spec |
| `/status` | Check overall project build status |

---

## Tips

1. **Always read the PRD doc first** -- tell teammates to read before building.
2. **Use plan approval** for complex tasks -- review before implementation.
3. **One phase at a time** -- complete and verify before moving on.
4. **Commit after each step** -- make progress durable.
5. **Use the reviewer agent** after each phase to catch issues early.
6. **Check agent idle state** -- idle means waiting, not done. Send them more work.

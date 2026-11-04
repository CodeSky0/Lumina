# Lumina Campus IM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven development where possible; implement tasks in order, run each task's checks, and review integration boundaries before the final commit. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Deliver a runnable campus IM with three role-based web clients, a Go REST/WebSocket API, PostgreSQL persistence, Redis broadcasting, files, tests, seed data, and Docker deployment.

**Architecture:** `apps/web` and `apps/api` communicate only through versioned REST and authenticated WebSocket endpoints. HTTP writes commit to PostgreSQL before Redis publishes events; reconnect synchronization reads PostgreSQL. Nginx exposes one browser origin in the Compose deployment.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui patterns, TanStack Query, Zustand, Go 1.23, Gin, GORM, gorilla/websocket, PostgreSQL 16, Redis 7, Vitest, Playwright.

## Global Constraints

- All UI copy is Simplified Chinese; no emojis or generic placeholder content.
- No fake API, static business messages, polling replacement for WebSocket, or localStorage business persistence.
- Every endpoint enforces authentication, role, and channel membership where applicable.
- Text is limited to 2000 characters, images to 5 MiB, files to 20 MiB.
- Classroom body text is at least 18px and primary touch targets at least 48px.
- No empty handlers, pseudocode, or deferred implementation markers in production code.
- Run `gofmt`, Go tests, web typecheck/build, and relevant integration tests before delivery.

## Shared API Contract

All successful list/detail responses use `{ "data": ... }`; errors use `{ "error": { "code": "STRING", "message": "中文信息", "request_id": "..." } }`. `User` is `{id, username, display_name, role, class_id?}`. Login returns `{data:{access_token,user,expires_at}}` and sets an HttpOnly `lumina_refresh` cookie. Refresh accepts that cookie and rotates it. Access tokens are Bearer tokens.

Core endpoints:

- `POST /api/v1/auth/login`, `POST /api/v1/auth/device`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`, `POST /api/v1/auth/ws-ticket`.
- Admin CRUD: `/api/v1/admin/classes`, `/teachers`, `/subjects`, `/channels`, `/assignments`; dashboard `/dashboard`; logs `/audit-logs`; settings `/settings`.
- `GET /api/v1/channels`, `GET /api/v1/channels/:id/messages?before_id=&limit=&q=`, `POST /api/v1/channels/:id/messages`, `PATCH /api/v1/messages/:id`, `DELETE /api/v1/messages/:id`, `POST /api/v1/messages/:id/read`, `POST /api/v1/messages/:id/confirm`.
- `POST /api/v1/teacher/batch-notices` with `{channel_ids:string[],content:string,type:"notice"|"urgent"}`.
- `GET/POST /api/v1/announcements`, `POST /api/v1/announcements/:id/confirm`, `GET /api/v1/classroom/urgent-pending`.
- `POST /api/v1/uploads` multipart field `file`; `GET /api/v1/files/:id` downloads after membership authorization.
- `GET /ws?ticket=<one-time-ticket>` upgrades to WebSocket. Events use `{event_id,type,channel_id?,occurred_at,data}`.

`Channel` is `{id,name,type,class_id?,subject_id?,teacher_id?,class_name?,grade?,subject_name?,subject_icon?,subject_color?,teacher_name?,last_message?,unread_count,online}`. `Message` is `{id,channel_id,sender_id,sender_name,type,content,metadata,reply_to_id?,is_pinned,created_at,deleted_at?,read_count,confirmed_at?}`. IDs that exceed JavaScript's safe integer are serialized as strings.

## File Map

- Backend entry/config: `apps/api/cmd/api/main.go`, `internal/config/config.go`, `internal/database/database.go`.
- Backend domain: `internal/models/models.go`, `internal/auth/*`, `internal/middleware/*`, `internal/services/*`, `internal/httpapi/*`, `internal/realtime/*`.
- Persistence: `apps/api/migrations/000001_initial.up.sql`, `000001_initial.down.sql`, `apps/api/cmd/seed/main.go`.
- Frontend foundation: `apps/web/app/*`, `components/ui/*`, `lib/api.ts`, `lib/auth.tsx`, `lib/websocket.ts`, `lib/types.ts`, `stores/*`.
- Role clients: `components/admin/*`, `components/teacher/*`, `components/classroom/*` with thin route files under `app/admin`, `app/teacher`, `app/classroom`.
- Verification/deployment: `apps/api/**/*_test.go`, `apps/web/**/*.test.ts*`, `tests/e2e/*`, `compose.yaml`, `deploy/*`, `Dockerfile` files, `.env.example`, `README.md`.

### Task 1: Database, Configuration, and Seed

**Files:** migration pair, models, config, database connector, seed command, backend tests.

**Interfaces:** `config.Load() (Config,error)`, `database.Open(Config) (*gorm.DB,error)`, GORM models shared by all services.

- [x] Write schema tests that verify unique teaching assignments/channels and receipts, then define the initial SQL migration with all required tables, checks, foreign keys, and indexes.
- [x] Implement environment parsing with explicit required secrets, development-safe examples, connection pools, and ping checks.
- [x] Implement an idempotent seed transaction producing 1 admin, 20 classes/classroom users, 50 teachers, 10 subjects, 300 assignments and 300 subject channels, plus a broadcast channel and sample announcements without hardcoded chat history.
- [x] Run `/workspace/.tools/go/bin/go test ./...` from `apps/api`; inspect seed counts in integration when PostgreSQL is available.

### Task 2: Authentication and Authorization

**Files:** password/token services, auth handlers, middleware, Redis limiter, auth tests.

**Interfaces:** `AuthService.Login`, `DeviceLogin`, `Refresh`, `Logout`, `Me`, `WSTicket`; middleware `RequireAuth` and `RequireRole`.

- [x] Test correct/incorrect passwords, five-failure lockout, role claims, refresh rotation, refresh reuse revocation, inactive users, device-code exchange, and one-time WS tickets.
- [x] Implement bcrypt, 24-hour JWTs, hashed seven-day refresh tokens, token-family rotation, secure HttpOnly cookies, Redis login throttling, and generic login failures.
- [x] Implement request IDs, security headers, CORS allowlist, role middleware, user-active checks, and centralized errors.
- [x] Run focused auth tests and the full Go suite.

### Task 3: Administration and Channel Membership

**Files:** admin handlers/services, membership service, admin tests.

**Interfaces:** CRUD services and `Membership.CanAccess(ctx,userID,channelID) (bool,error)` used by messages, files, and WS.

- [x] Test validation, duplicate resources, inactive resources, cross-role 403 responses, and transactional assignment-to-channel creation.
- [x] Implement admin CRUD, assignment creation/deletion rules, manual broadcast channels, dashboard aggregates, system settings, and append-only audit logs.
- [x] Implement membership for teachers, classroom users, and administrators; never infer authorization from client-provided role alone.
- [x] Run admin and membership tests.

### Task 4: Messages, Receipts, Search, Batch, and Files

**Files:** message/upload services and handlers, tests.

**Interfaces:** message DTOs above; publisher interface `Publish(ctx,event) error` consumed after commit.

- [x] Test cursor order, 2000-character boundaries, sender-only two-minute recall, reply channel consistency, read idempotency, urgent confirmation, search scope, batch partial errors, and upload limits.
- [x] Implement transactional writes, cursor history/search, batch notices, read counts/unread aggregation, edit/delete events, pending urgent retrieval, and message confirmations.
- [x] Implement random stored filenames, MIME/extension checks, image/file size limits, authorized downloads, `X-Content-Type-Options: nosniff`, and safe content disposition.
- [x] Run message and file tests.

### Task 5: WebSocket Hub and Redis Events

**Files:** Hub, client, Redis publisher/subscriber, WS handler, realtime tests.

**Interfaces:** event envelope above; Hub register/unregister/broadcast and channel presence.

- [x] Test event fan-out, per-client serialized writes, slow-client eviction, channel isolation, duplicate subscription handling, and heartbeat deadlines.
- [x] Implement one-time-ticket upgrade, permitted-channel registration, 30-second ping/pong, bounded outbound queues, Redis Pub/Sub, presence, typing, read acknowledgement, announcements, and all message events.
- [x] Ensure database history is the reconnect recovery source; Pub/Sub is never treated as durable storage.
- [x] Run realtime unit/race tests with `go test -race ./internal/realtime/...`.

### Task 6: Web Foundation and Login

**Files:** package/config, UI primitives, API client, auth provider, Zustand session, login route, frontend tests.

**Interfaces:** typed contract above; `apiFetch`, `useAuth`, `connectRealtime`; Query/Zustand providers.

- [x] Add failing tests for API errors, role destinations, refresh single-flight, and token clearing, then implement them.
- [x] Build accessible custom shadcn-style controls, responsive base layouts, loading/empty/error states, and the Indigo visual system.
- [x] Keep access tokens in memory, restore via refresh cookie, set refresh/logout credentials correctly, and route admin/teacher/classroom users to their own home.
- [x] Run Vitest, TypeScript checking, and Next production build.

### Task 7: Teacher and Classroom Realtime Clients

**Files:** channel lists, chat window/composer/message items, batch dialog, classroom grid and urgent dialog, realtime hook, tests.

- [x] Test WebSocket event deduplication, message ordering, exponential backoff, unread updates, reply/recall UI states, and mandatory urgent acknowledgement.
- [x] Implement teacher split view, cursor history, scoped search, six message types, reply, recall, receipts, and multi-class notices.
- [x] Implement classroom touch grid, large chat controls, announcement display, blocking urgent dialog, Web Audio alert, and server-confirmed dismissal.
- [x] Reconnect with jitter and resynchronize queries; do not add message polling.
- [x] Run frontend tests and production build.

### Task 8: Admin Client

**Files:** admin shell, dashboard, resource tables/forms, assignment/announcement/settings/log views.

- [x] Test CRUD validation and role guard behavior.
- [x] Implement dashboard aggregates and complete CRUD/assignment/announcement/settings/audit interactions using TanStack Query mutations against real endpoints.
- [x] Provide confirmation for destructive actions, inline server errors, skeletons, empty states, and responsive table fallbacks.
- [x] Run frontend tests and production build.

### Task 9: End-to-End Verification and Deployment

**Files:** Compose, Dockerfiles, Nginx config, environment example, Playwright tests, README and API/deployment docs.

- [x] Add healthchecks, persistent volumes, non-secret example environment values, migration/seed startup commands, Nginx `/api` and `/ws` proxying, and one-command startup.
- [x] Write Playwright scenarios for three-role login, forbidden routes/API, automatic channels, two-context sub-second messaging, persistence after reload, urgent acknowledgement, batch delivery, unread/read state, file round-trip, and reconnect.
- [x] Add concurrent sender integration verification and check per-channel monotonic IDs, exact counts, and no duplicates.
- [x] Document architecture, credentials for local seed users, secure production changes, backup/restore, upload limits, operations, and all test commands.
- [x] Execute all locally available checks. Clearly report any Docker-only check that cannot run rather than claiming success.

### Task 10: Final Review and Delivery

- [x] Scan for forbidden placeholders, hardcoded business data, missing authorization, leaked secrets, and unhandled promises.
- [x] Review API/type consistency and run the complete backend/frontend checks again.
- [x] Mark final source, migration, tests, and deployment documentation as deliverables; commit only source-controlled files and push `main` to the private repository.

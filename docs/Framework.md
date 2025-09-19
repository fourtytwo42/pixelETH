## Project Blueprint: Next.js + SQLite + JWT (No Cookies) Starter with Tailwind v3

### Purpose
This document defines an implementation-ready blueprint for a reusable web application foundation. It specifies architecture, data model, authentication, authorization, UI/UX, admin capabilities, presence detection, security controls, and operational practices. It is intentionally verbose and highly detailed to serve as a single source of truth for the project.

### High-Level Objectives
- Use SQLite for persistence, with a clear schema and seed data.
- Implement JSON Web Token authentication with no cookies.
- Store refresh tokens in local storage; keep access tokens in memory.
- Provide a global header present on all pages: site name (left) linking to root, avatar or initial (right) with a dropdown for user actions.
- Support registration with `username`, `password`, and an optional avatar image.
- Include three demo users: `admin` (admin role), `power` (power role), and `user` (user role), while keeping registration available for adding more users.
- Provide an admin-only page that is visible and accessible only to admins.
- Admin page capabilities: list users, change roles, ban/suspend users, and enable/disable registration.
- Distinguish ban vs. suspension: banned users cannot log in; suspended users can log in but cannot perform restricted actions.
- Provide light/dark theme, user-selectable via Settings and persistent across sessions.
- Show online presence on the admin page via a simple, robust mechanism.
- Use Tailwind CSS v3 (not v4).


## Architecture Overview

### Stack
- App Platform: Next.js (App Router) serves the UI and implements the REST API via Route Handlers under `/api`. Uses the Node.js runtime (not Edge) to support SQLite and file I/O.
- UI: Next.js pages and components with client-side routing and Tailwind v3 for styling. Manages session state, avatar menu, admin UI, and theme. Uses local storage for refresh tokens and theme; no cookies.
- Database: SQLite (single file). Includes migrations and seed routines. Optimized for durability and simplicity.
- Static files: Avatars stored on disk in a public uploads directory; the database stores their public paths.

### Next.js Implementation Notes
- App Router: Use `app/` directory with file-based routing for pages (`/`, `/login`, `/register`, `/profile`, `/settings`, `/admin`).
- API Routes: Implement all endpoints as Route Handlers under `app/api/**` with the Node.js runtime enabled to allow SQLite access and file uploads.
- Global Layout: Place the global header in `app/(site)/layout` (or `app/layout`) to ensure it renders on all pages.
- Auth and SSR: Access tokens are held in memory and refresh tokens in local storage, which are not available during server rendering. Protected data is fetched client-side; server-side API endpoints enforce authorization. Pages may perform client-side redirects based on auth state.
- Middleware: Next.js Middleware cannot access Node APIs or local storage; use it sparingly (e.g., basic redirects). Rely on API route authorization for enforcement.
- Static Assets: Store avatars under `public/uploads/avatars/`; references in the database point to these public paths.
- Runtime/Hosting: Choose a hosting environment with persistent disk access for SQLite and uploads (e.g., traditional Node hosting). Purely serverless/edge deployments with ephemeral filesystems are not compatible with local SQLite writes.

### Next.js Alignment and Best Practices
- Routing Model: Use the App Router with segment-level layouts. Keep the header in a shared layout so it renders everywhere.
- Client vs Server Components: Authentication state and any logic that uses local storage must live in Client Components. Server Components should avoid relying on auth state from local storage and must not attempt to access tokens.
- API Route Dynamics: Treat all `/api/**` Route Handlers as dynamic and send `Cache-Control: no-store` for authenticated responses to avoid caching.
- Middleware Use: Do not attempt token checks in Middleware since tokens are in memory/local storage. Authorization is enforced in Route Handlers.
- Environment Variables: Secrets remain server-only. Client-visible configuration must be prefixed appropriately for exposure on the client. Never expose JWT secrets to the client.
- File Uploads: Handle avatar uploads via multipart/form-data in Route Handlers. Ensure request size limits and validation are appropriate for avatars.
- Image Handling: Serve avatar images directly from `public/uploads/avatars/`. Optimize image sizes at upload time. If using Next.js Image component, ensure the source path is allowed by configuration.
- Caching and Revalidation: Authenticated pages fetch data client-side, avoiding server caches. For API endpoints, send headers to prevent intermediate caching of sensitive responses.
- Navigation: Perform login/logout redirects client-side after API responses. Do not depend on SSR for auth redirects given token storage constraints.
- Edge vs Node Runtime: Always use the Node.js runtime for Route Handlers that interact with SQLite or the filesystem. Avoid Edge runtime for these routes.
- Server Actions: Avoid Server Actions for operations that require local storage tokens; prefer explicit client → API calls with Authorization headers.
- Local Development: Ensure the development server runs with a writable filesystem for the SQLite database and the uploads directory.

### Key Decisions
- No cookies for auth: All authenticated requests use the Authorization header with a Bearer access token.
- Short-lived access tokens are held only in memory; long-lived refresh tokens are stored in local storage and rotated on refresh.
- Client sends a periodic heartbeat while authenticated to update presence.
- Dark mode uses the class strategy, toggling a `dark` class on the root element.

### Developer Experience and Quickstart
- Installation and run should be one-command simple. The project exposes standard npm scripts and automatically initializes the database if missing.
- First run behavior: If the SQLite database file does not exist (or was deleted), the app creates the required directories, initializes the database schema, and seeds demo data on startup.
- Idempotent seeding: Seed logic safely upserts the three demo users and the `site_settings` row without creating duplicates.

### Separation of Concerns
- Route Handlers (API): Input validation, auth checks, and response shaping for `/api/**` endpoints.
- Services: Business logic for users, sessions, avatars, roles, presence, and site settings.
- Data access: Thin layer for SQLite queries, migrations, and schema versioning.
- UI Components: Header, Avatar, Dropdown, Forms, Admin User Table, Settings, Profile, Landing. Organized under Next.js components and route segments.


## Roles, Statuses, and Access Model

### Roles
- `admin`: Full administrative privileges, including user management and site settings.
- `power`: Elevated privileges compared to `user` (extensible for future features).
- `user`: Standard authenticated user without administrative permissions.

### Account Status
- `active`: Default state; full access within role limits.
- `suspended`: User can authenticate and browse, but cannot perform restricted or write actions.
- `banned`: User cannot log in; login returns an explicit banned message and optional reason.

### Visibility and Navigation
- Public pages: root landing page, login, and register (subject to registration toggle).
- Authenticated pages: profile and settings.
- Admin-only page: visible only when the authenticated user’s role is `admin`. The header shows an `Admin` link conditionally.


## User Experience and Pages

### Global Header (all pages)
- Left: site name (placeholder) linking to `/`.
- Right: user avatar. If no avatar image, show a circular badge with the user’s uppercase first initial. The badge uses a deterministic background color derived from the username and ensures accessible contrast.
- Avatar dropdown items: `Profile`, `Settings`, `Logout`. If role is `admin`, also show `Admin`.
- When unauthenticated: show `Sign In` and `Register` buttons instead of the avatar. The `Register` button respects the registration-enabled setting and is hidden/disabled when registration is off.

### Landing Page (`/`)
- A visually appealing hero section with brief copy describing capabilities.
- Clear calls to action for `Sign In` and `Register` (if enabled).
- Responsive layout using Tailwind v3 primitives.

### Register (`/register`)
- Fields: `username` (required), `password` (required), `avatar` (optional upload).
- Validates server-side and client-side; registration is blocked when disabled at the site settings level with a clear message.
- On success, either automatically signs in or redirects to login, based on configuration.

### Login (`/login`)
- Fields: `username`, `password` with friendly validation and error messages.
- Banned users receive a clear, specific message including a reason if provided.
- Suspended users are allowed to log in but are informed of limited access upon arrival.

### Profile (`/profile`)
- Displays user info: username, avatar, role, and status.
- Allows username change (may be restricted based on policy), avatar upload/update, and password change (requires current password).

### Settings (`/settings`)
- Theme preference: `light`, `dark`, or `system`. Applies immediately and persists across sessions. Preference is stored locally and in the user profile.
- Optional session management: list of active sessions/devices and ability to revoke.
- Shows role, status, and non-sensitive session details.

### Admin (`/admin`)
- Visible and accessible only for `admin` role.
- User List Table: columns for username, role, status, created date, last login, last seen, and avatar preview. Supports search, filters (role/status), sort, and pagination.
- Presence indicator: green if the user was last seen within a recent threshold; red otherwise. Tooltip includes relative time.
- Actions per user: change role (`user`, `power`, `admin`) with confirmation, ban/unban (with reason), suspend/unsuspend. Prevents demoting or banning the last remaining admin.
- Site Controls: toggle `registration_enabled` (on/off). Optionally revoke all sessions for a user.
- Auditing: all admin actions logged with actor, target, action, metadata, timestamp, and context.


## Authentication and Session Model

### Token Strategy
- Access Token: short-lived; issued at login and refresh; stored in memory only. Included in requests via the Authorization header.
- Refresh Token: long-lived; stored in local storage only; rotated on each refresh request; server stores only a secure hash and metadata.

### Token Claims (access token)
- Subject: user identifier.
- Username: for convenience and UI bootstrapping.
- Role and Status: expedite authorization checks client-side; final checks are server-side.
- Token Version: a user-level integer used to invalidate all existing tokens when roles/status change.
- Issued At and Expiry: with short lifetimes for access tokens, and reasonable duration for refresh tokens.
- Unique Token ID: a unique identifier per token for observability and abuse detection.

### Refresh Flow
- On app load, if a refresh token exists in local storage, the client requests a fresh access token and replaces the stored refresh token with the newly issued one.
- On receiving a 401 for an expired access token, the client attempts a single transparent refresh.
- On refresh failures (invalid/revoked/expired), the client logs out and clears local storage.

### Local Storage Keys (proposed)
- `auth.refreshToken`: the current refresh token; access token is never stored here.
- `auth.user`: cached user profile (id, username, role, status, avatar path, theme preference), strictly non-sensitive.
- `ui.theme`: the current theme preference for pre-auth rendering.

### Login, Suspension, and Ban Behavior
- Banned users: login rejected with a message and optional reason.
- Suspended users: login allowed; the UI shows a prominent banner and disables restricted actions; server rejects restricted actions with appropriate errors.


## Presence and Heartbeat

### Mechanism
- While authenticated and the tab is active, the client sends a heartbeat at a regular interval to the backend.
- The server updates `last_seen_at` for the user. Any API call can also update this timestamp to reduce extra traffic.

### Admin UI
- Considers a user online if `last_seen_at` is within a configurable threshold relative to the current time.
- Displays a green dot for online and red for offline, with a tooltip indicating the time since last seen.

### Performance Considerations
- Pause heartbeats when the tab is not visible.
- Apply backoff on network errors to avoid server overload.


## Registration Toggle and User Controls

### Registration Enabled/Disabled
- A global site setting controls whether open registration is allowed.
- When disabled, the register page displays a clear message and prevents submission server-side.
- Admin UI allows toggling this setting and records the action in audit logs.

### Role Changes and Safeguards
- Admins can promote/demote users among `user`, `power`, and `admin` roles.
- The system prevents demoting or banning the last remaining admin.
- Changes to role or status bump the user’s token version and revoke active sessions.

### Ban and Suspension Semantics
- Ban: blocks login entirely. The login response includes a clear message and optional reason for the ban.
- Suspend: allows login but blocks restricted actions. UI elements that perform restricted actions are disabled or guarded with clear messaging.


## Data Model (SQLite)

### Users
- Identifiers and timestamps: numeric primary key, created and updated timestamps.
- Identity: username (canonical lowercase), uniqueness enforced; store both raw input and a normalized field if needed for case-insensitivity.
- Credentials: password hash using a secure algorithm; plaintext passwords are never stored.
- Role and status: enum-like values with constraints.
- Avatar: stored path for the avatar image (nullable); optional thumbnailing.
- Preferences: theme preference (`light`, `dark`, `system`).
- Session invalidation: token version integer, incremented to invalidate tokens.
- Activity: last login timestamp; last seen timestamp for presence.

### Site Settings
- Single-row table with a primary key.
- Boolean flag that controls whether registration is enabled.

### Refresh Tokens
- One row per active refresh token instance, hashed for at-rest safety.
- Includes user reference, created/last-used/expiry timestamps, optional user agent and IP address.
- Revocation fields and parent-child reference for rotation and token-family tracking.

### Audit Logs
- Tracks administrative actions across the system.
- Records actor and target identifiers, action type, metadata (before/after), timestamps, and context (IP/user agent).

### Indexing and Integrity
- Unique index on normalized username.
- Indexes on last seen timestamps for presence queries and on refresh token hashes for lookups.
- Constraints to restrict roles and statuses to known values and maintain consistency.


## File Uploads and Avatars

### Constraints
- Allowed types: PNG, JPEG, WebP.
- Size limit: reasonable upper bound appropriate for avatars.
- Dimensions: cap maximum width/height; optionally downscale and crop to a square thumbnail.
- Filenames: sanitized, unique, and content-addressable naming preferred to avoid collisions.

### Storage and Serving
- Uploaded files are stored under a dedicated public directory for avatars.
- The database stores the relative or absolute public path to the avatar image.
- EXIF metadata is stripped to protect privacy.


## API Surface (Contract Overview)

### Auth (Next.js API under `/api`)
- `POST /api/auth/register`: creates a user if registration is enabled; accepts username, password, and optional avatar; validates inputs; returns a success result or a detailed error.
- `POST /api/auth/login`: verifies credentials; returns an access token, a refresh token, and a user profile snapshot; banned users receive an explicit error and cannot log in.
- `POST /api/auth/refresh`: rotates the refresh token and returns a new access token and refresh token; rejects unknown/revoked/expired tokens.
- `POST /api/auth/logout`: revokes the current refresh token (session) and returns success.
- `GET /api/auth/me`: returns the current user profile, including role, status, avatar path, and preferences.
- `POST /api/auth/heartbeat`: updates presence by recording the time of last activity.

### Profile
- `GET /api/profile`: returns the user’s profile.
- `PUT /api/profile`: updates profile fields such as username, avatar, and theme preference; validates all inputs.
- `PUT /api/profile/password`: updates the password; requires the current password and enforces password policy.

### Admin
- `GET /api/admin/users`: returns a paginated, filterable, and sortable list of users; supports queries by role, status, and username search.
- `PUT /api/admin/users/:id/role`: updates a user’s role; requires admin privileges and confirmation safeguards.
- `PUT /api/admin/users/:id/status`: updates a user’s status (active/suspended/banned) with optional reason; invalidates tokens when needed.
- `GET /api/admin/settings`: returns current site settings such as the registration toggle.
- `PUT /api/admin/settings/registration`: enables or disables registration with appropriate auditing.
- Optional: `POST /api/admin/users/:id/sessions/revoke-all`: revokes all active refresh tokens for the user.

### Request Auth
- Protected API routes require an Authorization header with a Bearer access token.
- Admin API routes additionally verify `admin` role and non-suspended status.
- UI routes are publicly accessible but fetch protected data client-side; API route enforcement is the source of truth.


## Validation and Error Handling

### Username Rules
- Length: minimum and maximum boundaries to balance usability and safety.
- Character set: lowercase letters, digits, and underscore; no leading/trailing underscores; reserved names disallowed except for seeded users.
- Normalization: store a canonical lowercase version to prevent duplicates by case.

### Password Policy
- Minimum length with a recommendation for passphrase-style passwords.
- Server-side hashing using a modern, well-tuned algorithm.

### Avatar Upload Validation
- Validate content type and sniff magic bytes server-side.
- Enforce size and dimension limits; reject oversized images with clear messages.

### Error Messages and Structure
- Use consistent, human-readable errors with stable error codes for programmatic handling.
- Avoid leaking sensitive details; never include secrets in error messages.

### Rate Limiting
- Apply per-IP and per-username rate limits on login endpoints, with progressive backoff.
- Bound refresh token usage by rate limits to detect abuse.
- Reasonable limits on admin operations to prevent accidental or malicious overuse.


## Security Controls

### Token Safety
- Access tokens are short-lived and only kept in memory.
- Refresh tokens are long-lived, stored in local storage, and hashed server-side with robust parameters.
- Token rotation is enforced; old tokens are revoked and tracked to detect reuse.
- Token versioning enables immediate invalidation on role or status changes.

### Headers and Policies
- Strict Content Security Policy; avoid inline scripts and styles where possible.
- Security headers including Referrer Policy, Permissions Policy, and protections against MIME sniffing.
- CORS limited to known origins when frontend and backend are on different hosts.

### Input and Output Safety
- Centralize input validation to prevent injection and type confusion.
- Sanitize any user-facing output and filenames to avoid XSS and path traversal.

### Authorization Checks
- Server-side guards for protected and admin routes, independent of client UI checks.
- Suspended users are restricted from write/admin actions even if UI attempts them.


## Theming and Accessibility

### Theme Handling
- Theme is controlled via a class on the root element, supporting light and dark modes.
- Preference options include light, dark, and system. The chosen value is persisted locally and in the user profile.

### Accessibility
- All interactive components are keyboard-accessible and screen-reader friendly.
- Color choices meet contrast guidelines, including for the avatar initial badge.
- Live announcements are used where appropriate (for banners and status changes).


## Demo Data and Seeding

### Demo Users
- `admin`: role `admin`, status `active`.
- `power`: role `power`, status `active`.
- `user`: role `user`, status `active`.

### Seeding Behavior
- Seeds are idempotent; repeated runs do not duplicate users.
- Development-only default passwords; production requires secure values.
- Site settings are seeded with registration enabled by default.


## Observability and Operations

### Logging and Metrics
- Structured logs for authentication, admin changes, and errors; avoid sensitive data.
- Metrics for request latency, error rates, refresh success/fail, and rate-limit events.

### Backups and Recovery
- Regular SQLite file backups with verified restore processes.
- Clear retention policy and storage location for backups.

### Configuration Management
- Environment variables control secrets, token lifetimes, upload directories, and rate limits.
- Safe defaults for development; explicit configuration for production.

### Deployment
- CI/CD validates linting, tests, migrations, and assets.
- Database migrations run safely before app rollout.
- Host Next.js in a Node environment with persistent storage for SQLite and file uploads. Avoid purely serverless/edge platforms with ephemeral file systems unless an external persistent database is introduced.

### Scripts and Local Running
- `npm install`: Installs all dependencies.
- `npm run dev`: Starts the Next.js development server. On first run, checks for the SQLite database file; if missing, creates it, runs migrations, and seeds demo data.
- `npm start`: Starts the production server (after `npm run build`). On boot, performs the same database existence check and runs any pending migrations. Seeding runs only when the database is first created, or when explicitly requested via an environment flag.
- `npm run build`: Builds the Next.js application for production.
- `npm run db:migrate`: Runs migrations explicitly (no-op if up to date).
- `npm run db:seed`: Forces seeding for development scenarios (idempotent).
- `npm run db:reset`: Deletes the SQLite database file and re-initializes it (dangerous; development only).

### First-Run and Missing-DB Behavior
- On boot, the application detects whether the SQLite file exists. If not present, it creates the file, applies the schema, and seeds initial data (admin/power/user demo accounts and default site settings).
- The check is performed on both `dev` and `start` scripts, ensuring a clean developer experience even if the database is removed between runs.
- Database initialization is safe to run multiple times; migrations handle versioning and seeds are idempotent.


## Testing Plan

### Functional Tests
- Registration on/off behavior and validation paths.
- Username uniqueness and normalization.
- Login with valid and invalid credentials.
- Banned user denial with reason display.
- Suspended user behavior: login allowed, actions blocked.
- Header visibility: admin link appears for admins only.
- Admin actions: role changes, ban/suspend toggling, revocation, and auditing.
- Presence: online/offline indicators update with activity and time passage.
- Theme: switching and persistence across reloads and sign-ins.
- Token lifecycle: refresh rotation, invalid token handling, and token-version invalidation.
 - First-run experience: missing database is auto-created, migrations applied, seeds inserted; subsequent runs do not duplicate data.
 - Script ergonomics: `npm install`, `npm run dev`, `npm start` work without extra steps; `db:reset` reliably re-initializes in development.

### Security Tests
- XSS probes via avatar filenames and any user-provided strings.
- File type spoofing attempts for uploads.
- Brute-force login rate-limit checks.

### Performance and Reliability
- Pagination and search responsiveness for the admin user list.
- Heartbeat behavior under network flaps and tab visibility changes.


## Extensibility Considerations

### Future Features
- Email support (optional, non-blocking for auth) for password resets or notifications.
- Two-factor authentication options without changing the base login shape.
- RBAC or ABAC permissions for granular access control beyond roles.
- Invitation systems to allow controlled access when registration is off.

### Data Portability
- Abstracted data access layer to ease future migration from SQLite to another database if needed.

### Bootstrapping and Environment
- Provide a `.env.example` documenting required variables (e.g., JWT secret, database path, upload directory, max avatar size, rate limits). A simple `cp .env.example .env` should be sufficient to start locally.
- On first boot, if required directories (e.g., uploads, database directory) are missing, the app creates them automatically with safe permissions.


## Non-Functional Requirements

### Reliability and Durability
- SQLite configured with appropriate pragmas for durability while balancing performance.
- WAL mode recommended for concurrent reads while writes occur.

### Privacy
- Minimal data collection: no emails required, no tracking beyond essential session metadata.
- EXIF removal from avatars to prevent leakage of location or device details.

### Usability
- Clear, human-readable messages across all flows.
- Consistent UI patterns and responsive layouts.


## Decision Log (Key Choices)
- Next.js (App Router) is the unified framework for UI and API routes, using the Node runtime.
- Authentication uses JWT with no cookies; refresh token in local storage, access token in memory.
- Tailwind v3 selected for stability and tooling ecosystem alignment.
- Presence implemented via periodic heartbeat; threshold-based online indicator.
- Admin page includes role/status management, presence, and registration toggle.
- Seeded demo users exist for development and testing while leaving registration open.


## Glossary
- Access Token: Short-lived bearer token included in the Authorization header for API calls.
- Refresh Token: Long-lived credential used to obtain new access tokens; stored in local storage and rotated.
- Token Version: User-specific integer bump used to invalidate all active tokens after sensitive changes.
- Presence: Representation of a user’s recent activity, based on last-seen timestamps.
- Ban vs. Suspension: Ban blocks login; suspension allows login but restricts actions.


## Summary
This blueprint defines a robust, modern, cookie-free authentication system backed by SQLite, with a clean Tailwind v3 front-end and a thoughtful admin experience. It balances security, usability, and maintainability, offering a strong foundation for building future features while remaining lightweight and easy to operate. By following these specifications, the project remains consistent, testable, and extensible.



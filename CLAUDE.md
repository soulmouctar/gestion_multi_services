# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SaaS multi-tenant management platform supporting multiple business modules (commercial, finance, rental, taxi, etc.) per organization. Built with **Laravel 8 backend** (`back_multi/`) and **Angular 21 frontend** (`front_multi/`). The `backend_multi/` directory is a legacy/inactive backend — ignore it.

## Backend Commands (back_multi/)

```bash
# Install dependencies
composer install

# Serve API (runs on port 8000)
php artisan serve

# Run migrations
php artisan migrate

# Seed modules
php artisan db:seed --class=ModuleSeeder

# Clear caches
php artisan config:clear && php artisan cache:clear && php artisan route:clear

# Run tests
php artisan test
# Run a single test
php artisan test --filter=TestClassName

# Generate a new controller
php artisan make:controller Api/MyController --api
```

## Frontend Commands (front_multi/)

```bash
# Install dependencies
npm install

# Serve dev server (opens on port 4200)
npm start

# Build for production
npm run build

# Run tests
npm test

# Watch build
npm run watch
```

## Architecture

### Multi-Tenancy Model

- Every business entity (`products`, `clients`, `containers`, etc.) has a `tenant_id` foreign key scoping data to its organization.
- **Modules** (8 total: `COMMERCIAL`, `FINANCE`, `CLIENTS_SUPPLIERS`, `PRODUCTS_STOCK`, `CONTAINERS`, `RENTAL`, `TAXI`, `STATISTICS`) are independently activatable per tenant via the `tenant_modules` pivot table.
- **User-level access** is controlled by `user_module_permissions` (per user, per module code).

### Authentication & Authorization Flow

1. `POST /api/login` returns `{ user, token, tenant_active_modules[], user_module_permissions[] }`.
2. Frontend stores token + module list in localStorage/session.
3. All authenticated API routes use `auth:sanctum` middleware.
4. The `CheckTenantModule` middleware (applied per-route group) checks: tenant subscribed to module **and** user has permission. `SUPER_ADMIN` bypasses all checks.
5. Role hierarchy: `SUPER_ADMIN` (system-wide) → `ADMIN` (tenant-wide) → `USER` (module-limited).

### Backend Route Structure (`back_multi/routes/api.php`)

All routes are wrapped in `HandleCorsMiddleware`. Structure:
- Public: `/register`, `/login`, `/forgot-password`, `/reset-password`, `/tenants` (CRUD)
- Authenticated (`auth:sanctum`): all business routes
- Per-module route groups apply `CheckTenantModule` middleware with the module code (e.g., `check.tenant.module:CONTAINERS`)

### Frontend Architecture (`front_multi/src/app/`)

- **Standalone components** throughout (Angular 21 style, no NgModules).
- Lazy-loaded routes per feature: `views/commercial/routes.ts`, `views/finance/routes.ts`, etc.
- Guards: `AuthGuard` (requires login), `SuperAdminGuard` (requires `SUPER_ADMIN` role), `SubscriptionGuard`, `NoAuthGuard`.
- `NavigationService` dynamically builds the sidebar menu at login based on role + active modules — never hardcode menu items.
- HTTP interceptor in `core/interceptors/` attaches Bearer token and handles 401 redirects.
- UI framework: **CoreUI 5 + Bootstrap 5**. Use CoreUI components (`c-card`, `c-table`, etc.) for consistency.
- Notifications: use `AlertService` (wraps SweetAlert2), not raw `alert()`.

### Key Services

| Service | Purpose |
|---------|---------|
| `AuthService` | Login, logout, token/user storage |
| `ApiService` | Centralized HTTP calls with base URL |
| `NavigationService` | Builds dynamic sidebar from modules/role |
| `ModuleService` | Checks if a module is active for current user |
| `OrganisationSettingService` | Tenant settings (logo, currencies, etc.) |
| `TenantService` | Tenant CRUD (super admin) |
| `PDFService` | Client-side PDF generation |
| `CacheService` | Client-side caching layer |

### Environment

- Backend API: `http://127.0.0.1:8000/api`
- Frontend dev: `http://localhost:4200`
- Database: MySQL, database name `saas_management`, local root with no password
- App language: French (`fr`)
- Default/supported currencies: `USD`, `GNF`

### Adding a New Module

1. **Backend**: Add module code to `ModuleSeeder`, create controller(s) with `CheckTenantModule` middleware applied, add routes to `api.php` under the module's auth group.
2. **Frontend**: Add module constant to `environment.ts`, create feature directory under `views/`, add lazy routes file, register route in `app.routes.ts`, add menu entry logic in `NavigationService`.

### Database Conventions

- All tables use `tenant_id` for scoping — always filter by `auth()->user()->tenant_id` in controllers.
- Migrations are in `back_multi/database/migrations/`. Use descriptive names with timestamps.
- Spatie Permission tables handle roles/permissions alongside the custom `user_module_permissions` table.

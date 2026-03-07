# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Multi-tenant SaaS management platform for managing multiple business modules (commerce, finance, real estate, taxi, containers). The project is in French — UI labels, comments, and some API messages are in French.

There are **three main directories** at the root:

- **`back_multi/`** — The **active** Laravel 8 backend (PHP). This is the current working backend with the latest features (OrganisationSettings, test/debug endpoints, etc.).
- **`backend_multi/`** — An **older version** of the Laravel backend. It lacks newer features present in `back_multi/`. Do not develop in this directory unless explicitly asked.
- **`front_multi/`** — Angular 21 frontend using CoreUI Free Admin Template.

The root also contains `saas_management_schema.sql` (MySQL reference schema) and a CoreUI template zip archive.

## Build and Run Commands

### Backend (`back_multi/`)

```bash
# Install dependencies
composer install --working-dir=back_multi

# Run migrations
php artisan migrate --path=back_multi

# Seed database (roles, permissions, modules, super admin)
php artisan db:seed --path=back_multi

# Start dev server on port 8000
cd back_multi && php artisan serve --host=127.0.0.1 --port=8000
# Or use the helper script:
cd back_multi && bash start-server.sh

# Run tests
cd back_multi && ./vendor/bin/phpunit
# Run a single test file:
cd back_multi && ./vendor/bin/phpunit tests/Feature/SomeTest.php
```

### Frontend (`front_multi/`)

```bash
# Install dependencies
cd front_multi && npm install

# Dev server with hot reload (opens http://localhost:4200)
cd front_multi && npm start

# Production build
cd front_multi && npm run build

# Unit tests (Karma + Jasmine)
cd front_multi && npm test
# Or: cd front_multi && ng test
```

### Database

- MySQL/MariaDB, database name: `saas_management`
- Configure in `back_multi/.env` (`DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`)
- Reference schema: `saas_management_schema.sql` at root

## Architecture

### Multi-Tenancy Model

Tenant isolation is row-based: most domain tables have a `tenant_id` foreign key pointing to the `tenants` table. The `TenantMiddleware` (`back_multi/app/Http/Middleware/TenantMiddleware.php`) injects `current_tenant_id` into the request from the authenticated user's `tenant_id`.

SUPER_ADMIN users have `tenant_id = NULL` and can access all tenant data. ADMIN and USER are scoped to their tenant.

### Roles and Permissions

- Uses **Spatie Laravel Permission** (`spatie/laravel-permission`).
- Three roles: `SUPER_ADMIN`, `ADMIN`, `USER`.
- Middleware aliases registered in `Kernel.php`: `role`, `permission`, `role_or_permission`.
- Route-level authorization uses `middleware('role:SUPER_ADMIN')` or `middleware('role:SUPER_ADMIN|ADMIN')`.

### Authentication

- **Backend**: Laravel Sanctum (token-based). Login returns a Bearer token, user data with tenant/modules/roles loaded.
- **Frontend**: Token stored in `localStorage` (`auth_token`, `current_user`). `AuthInterceptor` attaches `Authorization: Bearer {token}` to all requests. Guards (`AuthGuard`, `SuperAdminGuard`, `TenantAdminGuard`, `SubscriptionGuard`) protect routes.

### Backend API Pattern

All API controllers in `back_multi/app/Http/Controllers/Api/` extend `BaseController`, which provides:
- `sendResponse($data, $message, $code)` — standardized success response `{ success: true, data, message }`
- `sendError($error, $errorMessages, $code)` — standardized error response `{ success: false, message, errors }`

Routes are defined in `back_multi/routes/api.php`. All routes are wrapped in the CORS middleware group. Protected routes use `auth:sanctum` middleware. There are temporary public `-public` endpoints (for dev/testing) that bypass auth.

### Frontend Architecture

- **Standalone components** with lazy loading (no NgModules for views). Routes in `front_multi/src/app/app.routes.ts` use `loadComponent()` / `loadChildren()`.
- **CoreUI** for UI components (`@coreui/angular`), icons (`@coreui/icons-angular`), and charts (`@coreui/angular-chartjs` + Chart.js).
- **Core layer** (`front_multi/src/app/core/`):
  - `services/` — `ApiService` (generic HTTP wrapper), `AuthService` (auth state via BehaviorSubject), and per-module services (e.g., `tenant.service.ts`, `container.service.ts`).
  - `models/` — TypeScript interfaces per domain, exported from `index.ts`. Shared types: `ApiResponse<T>`, `PaginatedResponse<T>`, `FilterOptions`.
  - `guards/` — Route guards (`AuthGuard`, `SuperAdminGuard`, `TenantAdminGuard`, `SubscriptionGuard`).
  - `interceptors/` — `AuthInterceptor` adds Bearer token to requests.
- **Views** (`front_multi/src/app/views/`) — Feature modules: `admin/`, `auth/`, `commercial/`, `finance/`, `clients/`, `products/`, `containers/`, `rental/`, `taxi/`, `statistics/`, `organisation/`, `dashboard/`, `profile/`, `settings/`.
- **Layout** (`front_multi/src/app/layout/default-layout/`) — Sidebar nav config in `_nav.ts`, uses `NavigationService` for dynamic navigation based on user role/modules.
- **Styles**: SCSS (`front_multi/src/scss/styles.scss`). Components use inline SCSS.
- **Environment config**: `front_multi/src/environments/environment.ts` — API URL (`http://127.0.0.1:8000/api`), module codes, currency config (USD/GNF), upload limits, UI settings (French locale, `dd/MM/yyyy` date format).

### Business Modules

Each module maps to both backend resources (controllers + models + migrations) and frontend views:

- **COMMERCE** — Products, categories, units, clients, suppliers, invoices
- **CONTAINERS** — Container tracking with photos, capacity, interest rates
- **IMMOBILIER/RENTAL** — Locations → Buildings → Floors → Housing Units (with unit configurations)
- **TAXI** — Taxis, drivers, taxi-driver assignments
- **FINANCE** — Payments (ORANGE_MONEY, VIREMENT, CHEQUE, ESPECES), currencies, exchange rates

Tenants subscribe to modules via `tenant_modules`. The frontend checks module access through `AuthService.hasModuleAccess(moduleCode)`.

### CORS Configuration

Backend CORS is configured in `back_multi/config/cors.php` and via `HandleCorsMiddleware`. Allowed origins: `localhost:4200`, `localhost:3000`, and their `127.0.0.1` equivalents. Sanctum stateful domains are set in `.env` (`SANCTUM_STATEFUL_DOMAINS`).

## Key Conventions

- API responses always follow `{ success: boolean, data?, message?, errors? }` format.
- Payment methods: `ORANGE_MONEY`, `VIREMENT`, `CHEQUE`, `ESPECES`.
- Subscription statuses: `ACTIVE`, `EXPIRED`, `ILLIMITY`.
- Tenant subscription statuses: `ACTIVE`, `SUSPENDED`.
- User roles are uppercase: `SUPER_ADMIN`, `ADMIN`, `USER`.
- Module codes are uppercase: `COMMERCIAL`, `FINANCE`, `CLIENTS_SUPPLIERS`, `PRODUCTS_STOCK`, `CONTAINERS`, `RENTAL`, `TAXI`, `STATISTICS`.
- The frontend uses SweetAlert2 (`sweetalert2`) for alerts/confirmations.
- Database seeding order matters: `RolePermissionSeeder` → `ModuleSeeder` → `SuperAdminSeeder`.

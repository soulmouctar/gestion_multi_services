<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\TenantController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\ModuleController;
use App\Http\Controllers\Api\SubscriptionPlanController;
use App\Http\Controllers\Api\SubscriptionController;
use App\Http\Controllers\Api\SubscriptionPaymentController;
use App\Http\Controllers\Api\ProductCategoryController;
use App\Http\Controllers\Api\UnitController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ContainerController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\CurrencyController;
use App\Http\Controllers\Api\ExchangeRateController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\LocationController;
use App\Http\Controllers\Api\BuildingController;
use App\Http\Controllers\Api\FloorController;
use App\Http\Controllers\Api\UnitConfigurationController;
use App\Http\Controllers\Api\HousingUnitController;
use App\Http\Controllers\Api\DriverController;
use App\Http\Controllers\Api\TaxiController;
use App\Http\Controllers\Api\TaxiAssignmentController;
use App\Http\Controllers\Api\RolePermissionController;
use App\Http\Controllers\Api\DashboardController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Appliquer le middleware CORS à toutes les routes API
Route::middleware(['App\Http\Middleware\HandleCorsMiddleware'])->group(function () {

    // Public routes
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);

// CRUD Backend pour les tenants - Utilisation du TenantController professionnel
Route::apiResource('tenants', \App\Http\Controllers\TenantController::class);

// Endpoints publics temporaires pour tester
Route::get('/modules-public', [ModuleController::class, 'index']);
Route::get('/subscriptions-public', [\App\Http\Controllers\Api\SubscriptionController::class, 'index']);
Route::get('/subscription-plans-public', [\App\Http\Controllers\Api\SubscriptionPlanController::class, 'index']);
Route::get('/users-public', [\App\Http\Controllers\Api\UserController::class, 'index']);
Route::get('/roles-public', [\App\Http\Controllers\Api\RolePermissionController::class, 'indexRoles']);
Route::get('/permissions-public', [\App\Http\Controllers\Api\RolePermissionController::class, 'indexPermissions']);

// Dashboard endpoints publics temporaires
Route::get('/dashboard/stats', [DashboardController::class, 'getStats']);
Route::get('/dashboard/activities', [DashboardController::class, 'getRecentActivities']);
Route::get('/dashboard/subscription-trends', [DashboardController::class, 'getSubscriptionTrends']);
Route::get('/dashboard/revenue-chart', [DashboardController::class, 'getRevenueChart']);
Route::get('/dashboard/module-usage', [DashboardController::class, 'getModuleUsage']);

// User module permissions endpoints publics temporaires
Route::get('/users/{id}/module-permissions-public', [UserController::class, 'getModulePermissions']);
Route::post('/users/{id}/module-permissions-public', [UserController::class, 'updateModulePermissions']);

// Subscription plans endpoints publics temporaires
Route::get('/subscription-plans-public', [SubscriptionPlanController::class, 'index']);
Route::post('/subscription-plans-public', [SubscriptionPlanController::class, 'store']);
Route::get('/subscription-plans-public/{id}', [SubscriptionPlanController::class, 'show']);
Route::put('/subscription-plans-public/{id}', [SubscriptionPlanController::class, 'update']);
Route::delete('/subscription-plans-public/{id}', [SubscriptionPlanController::class, 'destroy']);

// Roles and permissions endpoints publics temporaires
Route::get('/roles-public', [RolePermissionController::class, 'getRoles']);
Route::post('/roles-public', [RolePermissionController::class, 'createRole']);
Route::put('/roles-public/{id}', [RolePermissionController::class, 'updateRole']);
Route::delete('/roles-public/{id}', [RolePermissionController::class, 'deleteRole']);
Route::get('/permissions-public', [RolePermissionController::class, 'getPermissions']);
Route::post('/permissions-public', [RolePermissionController::class, 'createPermission']);
Route::delete('/permissions-public/{id}', [RolePermissionController::class, 'deletePermission']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    
    // Auth
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/refresh', [AuthController::class, 'refresh']);

    // Tenants (Super Admin only)
    Route::middleware('role:SUPER_ADMIN')->group(function () {
        Route::apiResource('tenants', TenantController::class);
        Route::post('tenants/{id}/assign-module', [TenantController::class, 'assignModule']);
        Route::post('tenants/{id}/remove-module', [TenantController::class, 'removeModule']);
    });

    // Users management (Admin & Super Admin)
    Route::middleware('role:SUPER_ADMIN|ADMIN')->group(function () {
        Route::apiResource('users', UserController::class);
        Route::post('users/{id}/assign-role', [UserController::class, 'assignRole']);
        Route::post('users/{id}/remove-role', [UserController::class, 'removeRole']);
        Route::get('users/{id}/module-permissions', [UserController::class, 'getModulePermissions']);
        Route::post('users/{id}/module-permissions', [UserController::class, 'updateModulePermissions']);
    });

    // Modules (Super Admin only)
    Route::middleware('role:SUPER_ADMIN')->group(function () {
        Route::apiResource('modules', ModuleController::class);
    });

    // Subscription Plans (Super Admin only)
    Route::middleware('role:SUPER_ADMIN')->group(function () {
        Route::apiResource('subscription-plans', SubscriptionPlanController::class);
    });

    // Subscriptions (Super Admin only)
    Route::middleware('role:SUPER_ADMIN')->group(function () {
        Route::apiResource('subscriptions', SubscriptionController::class);
        Route::apiResource('subscription-payments', SubscriptionPaymentController::class);
    });

    // Roles & Permissions (Super Admin only)
    Route::middleware('role:SUPER_ADMIN')->group(function () {
        Route::get('roles', [RolePermissionController::class, 'indexRoles']);
        Route::post('roles', [RolePermissionController::class, 'storeRole']);
        Route::get('roles/{id}', [RolePermissionController::class, 'showRole']);
        Route::put('roles/{id}', [RolePermissionController::class, 'updateRole']);
        Route::delete('roles/{id}', [RolePermissionController::class, 'destroyRole']);
        Route::get('permissions', [RolePermissionController::class, 'indexPermissions']);
        Route::post('permissions', [RolePermissionController::class, 'storePermission']);
        Route::delete('permissions/{id}', [RolePermissionController::class, 'destroyPermission']);
    });

    // Product Categories & Units (Admin & User)
    Route::apiResource('product-categories', ProductCategoryController::class);
    Route::apiResource('units', UnitController::class);

    // Products (Admin & User)
    Route::apiResource('products', ProductController::class);

    // Containers
    Route::apiResource('containers', ContainerController::class);

    // Clients
    Route::apiResource('clients', ClientController::class);

    // Suppliers
    Route::apiResource('suppliers', SupplierController::class);

    // Currencies & Exchange Rates
    Route::apiResource('currencies', CurrencyController::class);
    Route::apiResource('exchange-rates', ExchangeRateController::class);

    // Payments
    Route::apiResource('payments', PaymentController::class);

    // Invoices
    Route::apiResource('invoices', InvoiceController::class);

    // Real Estate Module
    Route::apiResource('locations', LocationController::class);
    Route::apiResource('buildings', BuildingController::class);
    Route::apiResource('floors', FloorController::class);
    Route::apiResource('unit-configurations', UnitConfigurationController::class);
    Route::apiResource('housing-units', HousingUnitController::class);

    // Taxi Module
    Route::apiResource('drivers', DriverController::class);
    Route::apiResource('taxis', TaxiController::class);
    Route::apiResource('taxi-assignments', TaxiAssignmentController::class);
}); // Fin du groupe auth:sanctum
}); // Fin du groupe CORS

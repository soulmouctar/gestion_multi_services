<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\TenantController;
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

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Public routes
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

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
});

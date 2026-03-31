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
use App\Http\Controllers\Api\ContainerPhotoController;
use App\Http\Controllers\Api\ContainerPaymentController;
use App\Http\Controllers\Api\ContainerSalesController;
use App\Http\Controllers\Api\LocationController;
use App\Http\Controllers\Api\BuildingController;
use App\Http\Controllers\Api\FloorController;
use App\Http\Controllers\Api\UnitConfigurationController;
use App\Http\Controllers\Api\HousingUnitController;
use App\Http\Controllers\Api\DriverController;
use App\Http\Controllers\Api\TaxiController;
use App\Http\Controllers\Api\TaxiAssignmentController;
use App\Http\Controllers\Api\RolePermissionController;
use App\Http\Controllers\Api\OrganisationSettingController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ContactController;
use App\Http\Controllers\Api\InvoiceHeaderController;
use App\Http\Controllers\Api\DailyPaymentController;
use App\Http\Controllers\Api\VehicleExpenseController;

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

    // Endpoints de test et debugging pour Angular
    Route::get('/test-cors', function () {
        return response()->json([
            'success' => true,
            'message' => 'CORS test successful',
            'timestamp' => now(),
            'server' => 'Laravel Backend'
        ]);
    });

    Route::get('/test-auth', function () {
        return response()->json([
            'success' => true,
            'message' => 'Authentication endpoint accessible',
            'login_url' => url('/api/login'),
            'credentials' => [
                'email' => 'soulmouctar96@gmail.com',
                'password' => 'password123'
            ]
        ]);
    });

    // Endpoints publics temporaires pour tester
    Route::get('/modules-public', [ModuleController::class, 'index']);
    Route::get('/subscriptions-public', [\App\Http\Controllers\Api\SubscriptionController::class, 'index']);
    Route::get('/subscription-plans-public', [\App\Http\Controllers\Api\SubscriptionPlanController::class, 'index']);
    Route::get('/users-public', [\App\Http\Controllers\Api\UserController::class, 'publicIndex']);
    Route::get('/roles-public', [\App\Http\Controllers\Api\RolePermissionController::class, 'indexRoles']);
    Route::get('/permissions-public', [\App\Http\Controllers\Api\RolePermissionController::class, 'indexPermissions']);

    // Organisation settings endpoint public temporaire
    Route::get('/organisation-settings-public', [OrganisationSettingController::class, 'show']);
    Route::put('/organisation-settings-public', [OrganisationSettingController::class, 'update']);
    Route::post('/organisation-settings-public/reset', [OrganisationSettingController::class, 'reset']);

    // Dashboard endpoints publics temporaires
    Route::get('/dashboard/stats', [DashboardController::class, 'getStats']);
    Route::get('/dashboard/activities', [DashboardController::class, 'getRecentActivities']);
    Route::get('/dashboard/subscription-trends', [DashboardController::class, 'getSubscriptionTrends']);
    Route::get('/dashboard/revenue-chart', [DashboardController::class, 'getRevenueChart']);
    Route::get('/dashboard/module-usage', [DashboardController::class, 'getModuleUsage']);

    // User module permissions endpoints publics temporaires
    Route::get('/users/{id}/module-permissions-public', [UserController::class, 'getModulePermissions']);
    Route::post('/users/{id}/module-permissions-public', [UserController::class, 'updateModulePermissions']);

    // Public routes (for testing/development)
    Route::get('tenants-public', [TenantController::class, 'index']);
    Route::get('users-public', [UserController::class, 'publicIndex']);
    Route::get('users/{id}/module-permissions-public', [UserController::class, 'getUserModulePermissions']);
    Route::get('modules-public', [ModuleController::class, 'index']);
    Route::get('subscription-plans-public', [SubscriptionPlanController::class, 'index']);
    Route::get('products-public', [ProductController::class, 'publicIndex']);
    Route::post('products-public', [ProductController::class, 'publicStore']);
    Route::put('products-public/{id}', [ProductController::class, 'publicUpdate']);
    Route::delete('products-public/{id}', [ProductController::class, 'publicDestroy']);
    Route::post('products-public/{id}/stock', [ProductController::class, 'publicUpdateStock']);
    Route::post('products-public/bulk-update-status', [ProductController::class, 'publicBulkUpdateStatus']);
    Route::get('products-public/low-stock', [ProductController::class, 'getLowStockProducts']);
    Route::get('products-public/statistics', [ProductController::class, 'getStatistics']);
    Route::get('products-public/{id}/sales-history', [ProductController::class, 'publicSalesHistory']);
    
    // Container Payments
    Route::get('container-payments-public', [ContainerPaymentController::class, 'index']);
    Route::post('container-payments-public', [ContainerPaymentController::class, 'store']);
    Route::get('container-payments-public/statistics', [ContainerPaymentController::class, 'statistics']);
    Route::get('container-payments-public/{id}', [ContainerPaymentController::class, 'show']);
    Route::put('container-payments-public/{id}', [ContainerPaymentController::class, 'update']);
    Route::delete('container-payments-public/{id}', [ContainerPaymentController::class, 'destroy']);
    
    // Container Sales System
    Route::get('container-arrivals-public', [ContainerSalesController::class, 'getArrivals']);
    Route::post('container-arrivals-public', [ContainerSalesController::class, 'storeArrival']);
    Route::put('container-arrivals-public/{id}', [ContainerSalesController::class, 'updateArrival']);
    Route::delete('container-arrivals-public/{id}', [ContainerSalesController::class, 'deleteArrival']);
    
    Route::get('container-sales-public', [ContainerSalesController::class, 'getSales']);
    Route::post('container-sales-public', [ContainerSalesController::class, 'storeSale']);
    Route::put('container-sales-public/{id}', [ContainerSalesController::class, 'updateSale']);
    
    Route::get('container-sale-payments-public', [ContainerSalesController::class, 'getPayments']);
    Route::post('container-sale-payments-public', [ContainerSalesController::class, 'storePayment']);
    Route::delete('container-sale-payments-public/{id}', [ContainerSalesController::class, 'deletePayment']);
    
    Route::get('client-advances-public', [ContainerSalesController::class, 'getAdvances']);
    Route::post('client-advances-public', [ContainerSalesController::class, 'storeAdvance']);
    
    Route::get('container-sales-public/client-stats/{clientId}', [ContainerSalesController::class, 'getClientStats']);
    Route::get('container-sales-public/global-stats', [ContainerSalesController::class, 'getGlobalStats']);
    Route::get('containers-public', [ContainerController::class, 'index']);
    Route::get('containers-public/{id}', [ContainerController::class, 'show']);
    Route::post('containers-public', [ContainerController::class, 'store']);
    Route::get('containers/statistics/monthly', [ContainerController::class, 'statisticsMonthly']);
    Route::get('containers/statistics/top-performers', [ContainerController::class, 'statisticsTopPerformers']);
    Route::get('taxis-public', [TaxiController::class, 'index']);
    Route::post('taxis-public', [TaxiController::class, 'store']);
    Route::get('clients-public', [ClientController::class, 'index']);
    Route::post('clients-public', [ClientController::class, 'store']);
    Route::get('suppliers-public', [SupplierController::class, 'publicIndex']);
    Route::post('suppliers-public', [SupplierController::class, 'publicStore']);
    Route::get('locations-public', [LocationController::class, 'publicIndex']);
    Route::post('locations-public', [LocationController::class, 'publicStore']);
    Route::get('locations-public/statistics', [LocationController::class, 'publicStatistics']);
    Route::get('units-public', [UnitController::class, 'publicIndex']);
Route::post('units-public', [UnitController::class, 'publicStore']);
    Route::post('currencies-public/{id}/toggle-status', [CurrencyController::class, 'publicToggleStatus']);
    Route::post('currencies-public/{id}/set-default', [CurrencyController::class, 'publicSetAsDefault']);
    Route::get('exchange-rates-public', [ExchangeRateController::class, 'publicIndex']);
    Route::post('exchange-rates-public', [ExchangeRateController::class, 'publicStore']);
    Route::get('currencies-public', [CurrencyController::class, 'publicIndex']);
    Route::post('currencies-public', [CurrencyController::class, 'publicStore']);
    Route::put('currencies-public/{id}', [CurrencyController::class, 'publicUpdate']);
    Route::delete('currencies-public/{id}', [CurrencyController::class, 'publicDestroy']);
    
    // Payments public routes
    Route::get('payments-public', [PaymentController::class, 'publicIndex']);
    Route::post('payments-public', [PaymentController::class, 'publicStore']);
    Route::get('payments-public/statistics', [PaymentController::class, 'publicStatistics']);
    Route::put('payments-public/{id}', [PaymentController::class, 'publicUpdate']);
    Route::delete('payments-public/{id}', [PaymentController::class, 'publicDestroy']);
    Route::get('invoices-public', [InvoiceController::class, 'publicIndex']);
    Route::post('invoices-public', [InvoiceController::class, 'publicStore']);
    Route::get('container-photos-public', [ContainerPhotoController::class, 'publicIndex']);
    Route::post('container-photos-public', [ContainerPhotoController::class, 'publicStore']);

    // Rental Module - Public routes
    Route::get('buildings-public', [BuildingController::class, 'publicIndex']);
    Route::get('floors-public', [FloorController::class, 'publicIndex']);
    Route::get('unit-configurations-public', [UnitConfigurationController::class, 'publicIndex']);
    Route::post('unit-configurations-public', [UnitConfigurationController::class, 'publicStore']);
    Route::get('housing-units-public', [HousingUnitController::class, 'publicIndex']);
    Route::post('housing-units-public', [HousingUnitController::class, 'publicStore']);
    Route::put('housing-units-public/{id}', [HousingUnitController::class, 'publicUpdate']);
    Route::delete('housing-units-public/{id}', [HousingUnitController::class, 'publicDestroy']);

    // Daily Payments (Versements journaliers)
    Route::get('daily-payments', [DailyPaymentController::class, 'index']);
    Route::post('daily-payments', [DailyPaymentController::class, 'store']);
    Route::get('daily-payments/statistics', [DailyPaymentController::class, 'statistics']);
    Route::post('daily-payments/bulk', [DailyPaymentController::class, 'bulkCreate']);
    Route::get('daily-payments/{id}', [DailyPaymentController::class, 'show']);
    Route::put('daily-payments/{id}', [DailyPaymentController::class, 'update']);
    Route::delete('daily-payments/{id}', [DailyPaymentController::class, 'destroy']);
    Route::get('drivers/{id}/payment-history', [DailyPaymentController::class, 'driverHistory']);

    // Vehicle Expenses (Dépenses véhicules)
    Route::get('vehicle-expenses', [VehicleExpenseController::class, 'index']);
    Route::post('vehicle-expenses', [VehicleExpenseController::class, 'store']);
    Route::get('vehicle-expenses/statistics', [VehicleExpenseController::class, 'statistics']);
    Route::get('vehicle-expenses/types', [VehicleExpenseController::class, 'expenseTypes']);
    Route::get('vehicle-expenses/{id}', [VehicleExpenseController::class, 'show']);
    Route::put('vehicle-expenses/{id}', [VehicleExpenseController::class, 'update']);
    Route::delete('vehicle-expenses/{id}', [VehicleExpenseController::class, 'destroy']);

    // Driver status management
    Route::post('drivers/{id}/toggle-status', [DriverController::class, 'toggleStatus']);
    Route::post('drivers/{id}/activate', [DriverController::class, 'activate']);
    Route::post('drivers/{id}/suspend', [DriverController::class, 'suspend']);
    Route::get('drivers/statistics', [DriverController::class, 'statistics']);

    // Contacts & Adresses endpoints publics temporaires
    Route::get('/contacts-public', [ContactController::class, 'index']);
    Route::get('/contacts', [ContactController::class, 'index']);
    Route::post('/contacts-public', [ContactController::class, 'store']);
    Route::get('/contacts-public/{id}', [ContactController::class, 'show']);
    Route::put('/contacts-public/{id}', [ContactController::class, 'update']);
    Route::delete('/contacts-public/{id}', [ContactController::class, 'destroy']);
    Route::post('/contacts-public/{id}/set-default', [ContactController::class, 'setAsDefault']);
    Route::get('/contact-types-public', [ContactController::class, 'getContactTypes']);

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
            Route::apiResource('tenants', \App\Http\Controllers\Api\TenantController::class);
            Route::post('tenants/{id}/assign-module', [\App\Http\Controllers\Api\TenantController::class, 'assignModule']);
            Route::post('tenants/{id}/remove-module', [\App\Http\Controllers\Api\TenantController::class, 'removeModule']);
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

        // Organisation Settings (Admin & Super Admin)
        Route::middleware('role:SUPER_ADMIN|ADMIN')->group(function () {
            Route::get('organisation-settings', [OrganisationSettingController::class, 'show']);
            Route::put('organisation-settings', [OrganisationSettingController::class, 'update']);
            Route::post('organisation-settings/reset', [OrganisationSettingController::class, 'reset']);
            Route::get('organisation-settings/{tenantId}', [OrganisationSettingController::class, 'show']);
            Route::put('organisation-settings/{tenantId}', [OrganisationSettingController::class, 'update']);
            Route::post('organisation-settings/{tenantId}/reset', [OrganisationSettingController::class, 'reset']);
        });

        // Contacts (Admin & Super Admin)
        Route::middleware('role:SUPER_ADMIN|ADMIN')->group(function () {
            Route::apiResource('contacts', ContactController::class);
            Route::post('contacts/{id}/set-default', [ContactController::class, 'setAsDefault']);
        });

        // Invoice Headers (Admin & Super Admin)
        Route::middleware('role:SUPER_ADMIN|ADMIN')->group(function () {
            Route::apiResource('invoice-headers', InvoiceHeaderController::class);
            Route::post('invoice-headers/{id}/set-default', [InvoiceHeaderController::class, 'setAsDefault']);
            Route::post('invoice-headers/{id}/duplicate', [InvoiceHeaderController::class, 'duplicate']);
        });

        // Currencies (Admin & Super Admin)
        Route::middleware('role:SUPER_ADMIN|ADMIN')->group(function () {
            Route::apiResource('currencies', CurrencyController::class);
            Route::post('currencies/{id}/set-default', [CurrencyController::class, 'setAsDefault']);
            Route::post('currencies/{id}/toggle-status', [CurrencyController::class, 'toggleStatus']);
        });

        // Contacts (Admin & Super Admin)
        Route::middleware('role:SUPER_ADMIN|ADMIN')->group(function () {
            Route::apiResource('contacts', ContactController::class);
            Route::post('contacts/{id}/set-default', [ContactController::class, 'setAsDefault']);
            Route::get('contact-types', [ContactController::class, 'getContactTypes']);
        });

        // Organisation Settings (Admin & Super Admin)
        Route::middleware('role:SUPER_ADMIN|ADMIN')->group(function () {
            Route::get('organisation-settings', [OrganisationSettingController::class, 'show']);
            Route::put('organisation-settings', [OrganisationSettingController::class, 'update']);
            Route::post('organisation-settings/reset', [OrganisationSettingController::class, 'reset']);
            Route::get('organisation-settings/options', [OrganisationSettingController::class, 'getOptions']);
            Route::get('organisation-settings/next-invoice-number', [OrganisationSettingController::class, 'getNextInvoiceNumber']);
            Route::get('organisation-settings/next-quote-number', [OrganisationSettingController::class, 'getNextQuoteNumber']);
            Route::post('organisation-settings/test-notifications', [OrganisationSettingController::class, 'testNotifications']);
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
        Route::post('products/{id}/update-stock', [ProductController::class, 'updateStock']);
        Route::post('products/bulk-update-status', [ProductController::class, 'bulkUpdateStatus']);
        Route::get('products/low-stock', [ProductController::class, 'getLowStockProducts']);
        Route::get('products/search/barcode', [ProductController::class, 'searchByBarcode']);
        Route::get('products/statistics', [ProductController::class, 'getStatistics']);

        // Containers
        Route::apiResource('containers', ContainerController::class);

        // Clients
        Route::apiResource('clients', ClientController::class);

        // Suppliers
        Route::apiResource('suppliers', SupplierController::class);

        // Currencies & Exchange Rates
        Route::apiResource('currencies', CurrencyController::class);
        Route::apiResource('exchange-rates', ExchangeRateController::class);

        // Payments - specific routes MUST come before apiResource
        Route::get('payments/statistics', [PaymentController::class, 'getStatistics']);
        Route::get('payments/date-range', [PaymentController::class, 'getByDateRange']);
        Route::post('payments/bulk-delete', [PaymentController::class, 'bulkDelete']);
        Route::get('payments/export', [PaymentController::class, 'export']);
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

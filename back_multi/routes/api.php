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
use App\Http\Controllers\Api\LeaseController;
use App\Http\Controllers\Api\PersonalExpenseController;
use App\Http\Controllers\Api\BankingController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

Route::middleware(['App\Http\Middleware\HandleCorsMiddleware'])->group(function () {

    // Routes publiques - authentification
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);

    // Routes protégées
    Route::middleware('auth:sanctum')->group(function () {

        // Auth
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/refresh', [AuthController::class, 'refresh']);

        // Tenants (Super Admin uniquement)
        Route::middleware('role:SUPER_ADMIN')->group(function () {
            Route::apiResource('tenants', TenantController::class);
            Route::post('tenants/{id}/assign-module', [TenantController::class, 'assignModule']);
            Route::post('tenants/{id}/remove-module', [TenantController::class, 'removeModule']);
            Route::get('tenants/{tenantId}/modules', [TenantController::class, 'getTenantModules']);
        });

        // Gestion des utilisateurs (Admin & Super Admin)
        Route::middleware('role:SUPER_ADMIN|ADMIN')->group(function () {
            Route::apiResource('users', UserController::class);
            Route::post('users/{id}/assign-role', [UserController::class, 'assignRole']);
            Route::post('users/{id}/remove-role', [UserController::class, 'removeRole']);
            Route::get('users/{id}/module-permissions', [UserController::class, 'getModulePermissions']);
            Route::post('users/{id}/module-permissions', [UserController::class, 'updateModulePermissions']);
        });

        // Modules (Super Admin uniquement)
        Route::middleware('role:SUPER_ADMIN')->group(function () {
            Route::apiResource('modules', ModuleController::class);
        });

        // Plans d'abonnement (Super Admin uniquement)
        Route::middleware('role:SUPER_ADMIN')->group(function () {
            Route::apiResource('subscription-plans', SubscriptionPlanController::class);
            Route::apiResource('subscriptions', SubscriptionController::class);
            Route::apiResource('subscription-payments', SubscriptionPaymentController::class);
        });

        // Paramètres de l'organisation (Admin & Super Admin)
        Route::middleware('role:SUPER_ADMIN|ADMIN')->group(function () {
            Route::get('organisation-settings', [OrganisationSettingController::class, 'show']);
            Route::put('organisation-settings', [OrganisationSettingController::class, 'update']);
            Route::post('organisation-settings/reset', [OrganisationSettingController::class, 'reset']);
            Route::get('organisation-settings/options', [OrganisationSettingController::class, 'getOptions']);
            Route::get('organisation-settings/next-invoice-number', [OrganisationSettingController::class, 'getNextInvoiceNumber']);
            Route::get('organisation-settings/next-quote-number', [OrganisationSettingController::class, 'getNextQuoteNumber']);
            Route::post('organisation-settings/test-notifications', [OrganisationSettingController::class, 'testNotifications']);
            Route::get('organisation-settings/{tenantId}', [OrganisationSettingController::class, 'show']);
            Route::put('organisation-settings/{tenantId}', [OrganisationSettingController::class, 'update']);
            Route::post('organisation-settings/{tenantId}/reset', [OrganisationSettingController::class, 'reset']);
        });

        // Contacts (Admin & Super Admin)
        Route::middleware('role:SUPER_ADMIN|ADMIN')->group(function () {
            Route::apiResource('contacts', ContactController::class);
            Route::post('contacts/{id}/set-default', [ContactController::class, 'setAsDefault']);
            Route::get('contact-types', [ContactController::class, 'getContactTypes']);
        });

        // En-têtes de factures (Admin & Super Admin)
        Route::middleware('role:SUPER_ADMIN|ADMIN')->group(function () {
            Route::apiResource('invoice-headers', InvoiceHeaderController::class);
            Route::post('invoice-headers/{id}/set-default', [InvoiceHeaderController::class, 'setAsDefault']);
            Route::post('invoice-headers/{id}/duplicate', [InvoiceHeaderController::class, 'duplicate']);
        });

        // Devises (Admin & Super Admin)
        Route::middleware('role:SUPER_ADMIN|ADMIN')->group(function () {
            Route::apiResource('currencies', CurrencyController::class);
            Route::post('currencies/{id}/set-default', [CurrencyController::class, 'setAsDefault']);
            Route::post('currencies/{id}/toggle-status', [CurrencyController::class, 'toggleStatus']);
        });

        // Rôles & Permissions (Super Admin uniquement)
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

        // Dashboard
        Route::get('/dashboard/stats', [DashboardController::class, 'getStats']);
        Route::get('/dashboard/activities', [DashboardController::class, 'getRecentActivities']);
        Route::get('/dashboard/subscription-trends', [DashboardController::class, 'getSubscriptionTrends']);
        Route::get('/dashboard/revenue-chart', [DashboardController::class, 'getRevenueChart']);
        Route::get('/dashboard/module-usage', [DashboardController::class, 'getModuleUsage']);

        // Catégories de produits & Unités
        Route::apiResource('product-categories', ProductCategoryController::class);
        Route::apiResource('units', UnitController::class);

        // Produits
        Route::get('products/low-stock', [ProductController::class, 'getLowStockProducts']);
        Route::get('products/statistics', [ProductController::class, 'getStatistics']);
        Route::apiResource('products', ProductController::class);
        Route::post('products/{id}/update-stock', [ProductController::class, 'updateStock']);
        Route::post('products/bulk-update-status', [ProductController::class, 'bulkUpdateStatus']);

        // Conteneurs
        Route::get('containers/statistics/general', [ContainerController::class, 'statisticsGeneral']);
        Route::get('containers/statistics/capacity', [ContainerController::class, 'statisticsCapacity']);
        Route::get('containers/statistics/status', [ContainerController::class, 'statisticsStatus']);
        Route::get('containers/statistics/monthly', [ContainerController::class, 'statisticsMonthly']);
        Route::get('containers/statistics/top-performers', [ContainerController::class, 'statisticsTopPerformers']);
        Route::apiResource('containers', ContainerController::class);

        // Paiements conteneurs
        Route::get('container-payments/statistics', [ContainerPaymentController::class, 'statistics']);
        Route::apiResource('container-payments', ContainerPaymentController::class);

        // Ventes conteneurs
        Route::get('container-arrivals', [ContainerSalesController::class, 'getArrivals']);
        Route::post('container-arrivals', [ContainerSalesController::class, 'storeArrival']);
        Route::put('container-arrivals/{id}', [ContainerSalesController::class, 'updateArrival']);
        Route::delete('container-arrivals/{id}', [ContainerSalesController::class, 'deleteArrival']);

        Route::get('container-sales/global-stats', [ContainerSalesController::class, 'getGlobalStats']);
        Route::get('container-sales/client-stats/{clientId}', [ContainerSalesController::class, 'getClientStats']);
        Route::get('container-sales', [ContainerSalesController::class, 'getSales']);
        Route::post('container-sales', [ContainerSalesController::class, 'storeSale']);
        Route::put('container-sales/{id}', [ContainerSalesController::class, 'updateSale']);

        Route::get('container-sale-payments', [ContainerSalesController::class, 'getPayments']);
        Route::post('container-sale-payments', [ContainerSalesController::class, 'storePayment']);
        Route::delete('container-sale-payments/{id}', [ContainerSalesController::class, 'deletePayment']);

        Route::get('client-advances', [ContainerSalesController::class, 'getAdvances']);
        Route::post('client-advances', [ContainerSalesController::class, 'storeAdvance']);

        // Photos conteneurs
        Route::get('container-photos', [ContainerPhotoController::class, 'publicIndex']);
        Route::post('container-photos', [ContainerPhotoController::class, 'publicStore']);

        // Clients & Fournisseurs
        Route::apiResource('clients', ClientController::class);
        Route::apiResource('suppliers', SupplierController::class);
        Route::get('clients/statistics', [ClientController::class, 'getStatistics']);

        // Taux de change
        Route::apiResource('exchange-rates', ExchangeRateController::class);

        // Paiements
        Route::get('payments/statistics', [PaymentController::class, 'getStatistics']);
        Route::get('payments/date-range', [PaymentController::class, 'getByDateRange']);
        Route::post('payments/bulk-delete', [PaymentController::class, 'bulkDelete']);
        Route::get('payments/export', [PaymentController::class, 'export']);
        Route::apiResource('payments', PaymentController::class);

        // Versements journaliers
        Route::get('daily-payments/statistics', [DailyPaymentController::class, 'statistics']);
        Route::post('daily-payments/bulk', [DailyPaymentController::class, 'bulkCreate']);
        Route::get('drivers/{id}/payment-history', [DailyPaymentController::class, 'driverHistory']);
        Route::apiResource('daily-payments', DailyPaymentController::class);

        // Dépenses véhicules
        Route::get('vehicle-expenses/statistics', [VehicleExpenseController::class, 'statistics']);
        Route::get('vehicle-expenses/types', [VehicleExpenseController::class, 'expenseTypes']);
        Route::apiResource('vehicle-expenses', VehicleExpenseController::class);

        // Factures
        Route::apiResource('invoices', InvoiceController::class);

        // Module Immobilier
        Route::get('locations/statistics', [LocationController::class, 'publicStatistics']); // avant apiResource !
        Route::apiResource('locations', LocationController::class);
        Route::apiResource('buildings', BuildingController::class);
        Route::apiResource('floors', FloorController::class);
        Route::apiResource('unit-configurations', UnitConfigurationController::class);
        Route::apiResource('housing-units', HousingUnitController::class);

        // Contrats de location (leases)
        Route::get('leases/statistics', [LeaseController::class, 'statistics']);
        Route::get('leases/payments', [LeaseController::class, 'allPayments']);
        Route::apiResource('leases', LeaseController::class);
        Route::get('leases/{lease}/payments',    [LeaseController::class, 'getPayments']);
        Route::post('leases/{lease}/payments',   [LeaseController::class, 'addPayment']);
        Route::delete('lease-payments/{id}',     [LeaseController::class, 'deletePayment']);

        // Module Taxi
        Route::get('drivers/statistics', [DriverController::class, 'statistics']);
        Route::post('drivers/{id}/toggle-status', [DriverController::class, 'toggleStatus']);
        Route::post('drivers/{id}/activate', [DriverController::class, 'activate']);
        Route::post('drivers/{id}/suspend', [DriverController::class, 'suspend']);
        Route::apiResource('drivers', DriverController::class);
        Route::apiResource('taxis', TaxiController::class);
        Route::apiResource('taxi-assignments', TaxiAssignmentController::class);

        // Module Dépenses Personnelles
        Route::get('personal-expenses/statistics',      [PersonalExpenseController::class, 'statistics']);
        Route::get('personal-expense-categories',       [PersonalExpenseController::class, 'indexCategories']);
        Route::post('personal-expense-categories',      [PersonalExpenseController::class, 'storeCategory']);
        Route::put('personal-expense-categories/{id}',  [PersonalExpenseController::class, 'updateCategory']);
        Route::delete('personal-expense-categories/{id}', [PersonalExpenseController::class, 'destroyCategory']);
        Route::apiResource('personal-expenses', PersonalExpenseController::class)->except(['create', 'edit']);

        // Module Bancaire
        Route::get('banking/statistics',                    [BankingController::class, 'statistics']);
        Route::get('banking/accounts',                      [BankingController::class, 'indexAccounts']);
        Route::post('banking/accounts',                     [BankingController::class, 'storeAccount']);
        Route::get('banking/accounts/{id}',                 [BankingController::class, 'showAccount']);
        Route::put('banking/accounts/{id}',                 [BankingController::class, 'updateAccount']);
        Route::delete('banking/accounts/{id}',              [BankingController::class, 'destroyAccount']);
        Route::get('banking/transactions',                  [BankingController::class, 'indexTransactions']);
        Route::post('banking/transactions',                 [BankingController::class, 'storeTransaction']);
        Route::get('banking/transactions/{id}',             [BankingController::class, 'showTransaction']);
        Route::put('banking/transactions/{id}',             [BankingController::class, 'updateTransaction']);
        Route::delete('banking/transactions/{id}',          [BankingController::class, 'destroyTransaction']);
        Route::post('banking/transactions/{id}/upload-proof', [BankingController::class, 'uploadProof']);

    }); // Fin du groupe auth:sanctum

}); // Fin du groupe CORS
<?php

use App\Http\Controllers\Api\FloorController;
use App\Http\Controllers\Api\HousingUnitController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\LeaseController;
use App\Models\Building;
use App\Models\Client;
use App\Models\Floor;
use App\Models\HousingUnit;
use App\Models\Invoice;
use App\Models\Lease;
use App\Models\LeasePayment;
use App\Models\Location;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\Supplier;
use App\Models\Tenant;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

require __DIR__ . '/../vendor/autoload.php';

$app = require __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$commit = in_array('--commit', $argv, true);
$failures = [];

function callApiController(string $method, string $uri, array $payload, object $controller, string $action, array $routeParams = [])
{
    $request = Request::create($uri, $method, $payload);
    app()->instance('request', $request);

    return $controller->{$action}($request, ...$routeParams);
}

function body($response): array
{
    return json_decode($response->getContent(), true) ?: [];
}

function checkOk(bool $condition, string $message, array &$failures): void
{
    if (!$condition) {
        $failures[] = $message;
        echo "[ECHEC] {$message}\n";
        return;
    }

    echo "[OK] {$message}\n";
}

DB::beginTransaction();

try {
    $tenant = Tenant::create([
        'name' => 'Simulation Immo Commercial',
        'email' => 'sim-immo-' . uniqid() . '@example.test',
        'phone' => '+224610000001',
        'subscription_status' => 'ACTIVE',
    ]);

    $otherTenant = Tenant::create([
        'name' => 'Simulation Tenant Etranger',
        'email' => 'sim-other-' . uniqid() . '@example.test',
        'phone' => '+224610000002',
        'subscription_status' => 'ACTIVE',
    ]);

    $user = User::create([
        'tenant_id' => $tenant->id,
        'name' => 'Admin Simulation',
        'email' => 'admin-immo-' . uniqid() . '@example.test',
        'password' => Hash::make('password'),
        'is_active' => true,
    ]);

    Auth::setUser($user);

    $floorController = app(FloorController::class);
    $unitController = app(HousingUnitController::class);
    $leaseController = app(LeaseController::class);
    $invoiceController = app(InvoiceController::class);

    $location = Location::create([
        'tenant_id' => $tenant->id,
        'name' => 'Residence Simulation',
    ]);

    $building = Building::create([
        'location_id' => $location->id,
        'name' => 'Immeuble A',
        'type' => 'APPARTEMENT',
        'total_floors' => 3,
    ]);

    $otherLocation = Location::create([
        'tenant_id' => $otherTenant->id,
        'name' => 'Residence Etrangere',
    ]);

    $otherBuilding = Building::create([
        'location_id' => $otherLocation->id,
        'name' => 'Immeuble Etranger',
        'type' => 'APPARTEMENT',
        'total_floors' => 1,
    ]);

    $badFloorResponse = callApiController('POST', '/api/floors', [
        'building_id' => $otherBuilding->id,
        'floor_number' => 1,
    ], $floorController, 'store');
    checkOk($badFloorResponse->getStatusCode() === 403, 'Creation etage refusee sur immeuble hors tenant', $failures);

    $floorResponse = callApiController('POST', '/api/floors', [
        'building_id' => $building->id,
        'floor_number' => 1,
    ], $floorController, 'store');
    $floor = Floor::find(body($floorResponse)['data']['id'] ?? null);
    checkOk($floorResponse->getStatusCode() === 201 && $floor, 'Creation etage valide', $failures);

    $unitResponse = callApiController('POST', '/api/housing-units', [
        'floor_id' => $floor->id,
        'rent_amount' => 1200000,
        'status' => 'LIBRE',
    ], $unitController, 'store');
    $unit = HousingUnit::find(body($unitResponse)['data']['id'] ?? null);
    checkOk($unitResponse->getStatusCode() === 201 && $unit, 'Creation logement valide', $failures);

    $otherFloor = Floor::create([
        'building_id' => $otherBuilding->id,
        'floor_number' => 2,
    ]);
    $otherUnit = HousingUnit::create([
        'floor_id' => $otherFloor->id,
        'rent_amount' => 900000,
        'status' => 'LIBRE',
    ]);

    $badLeaseResponse = callApiController('POST', '/api/leases', [
        'housing_unit_id' => $otherUnit->id,
        'renter_name' => 'Locataire Etranger',
        'start_date' => now()->startOfMonth()->format('Y-m-d'),
        'monthly_rent' => 900000,
        'deposit_amount' => 900000,
        'currency' => 'GNF',
        'payment_day' => 5,
    ], $leaseController, 'store');
    checkOk($badLeaseResponse->getStatusCode() === 422, 'Bail refuse sur logement hors tenant', $failures);

    $leaseResponse = callApiController('POST', '/api/leases', [
        'housing_unit_id' => $unit->id,
        'renter_name' => 'Aissatou Diallo',
        'renter_phone' => '+224620111222',
        'start_date' => now()->startOfMonth()->format('Y-m-d'),
        'end_date' => now()->addMonths(5)->endOfMonth()->format('Y-m-d'),
        'monthly_rent' => 1200000,
        'deposit_amount' => 1200000,
        'currency' => 'GNF',
        'payment_day' => 5,
        'status' => 'ACTIVE',
    ], $leaseController, 'store');
    $lease = Lease::find(body($leaseResponse)['data']['id'] ?? null);
    checkOk($leaseResponse->getStatusCode() === 201 && $lease, 'Bail valide cree', $failures);
    checkOk(HousingUnit::find($unit->id)?->status === 'OCCUPE', 'Logement marque occupe apres bail actif', $failures);

    $overlapLeaseResponse = callApiController('POST', '/api/leases', [
        'housing_unit_id' => $unit->id,
        'renter_name' => 'Second Locataire',
        'start_date' => now()->addMonth()->startOfMonth()->format('Y-m-d'),
        'monthly_rent' => 1200000,
        'currency' => 'GNF',
    ], $leaseController, 'store');
    checkOk($overlapLeaseResponse->getStatusCode() === 422, 'Bail chevauchant refuse sur logement occupe', $failures);

    $paymentResponse = callApiController('POST', "/api/leases/{$lease->id}/payments", [
        'period_month' => now()->format('Y-m'),
        'amount' => 1200000,
        'currency' => 'GNF',
        'payment_date' => now()->format('Y-m-d'),
        'payment_method' => 'ESPECES',
        'reference' => 'SIM-LOYER',
        'status' => 'PAID',
    ], $leaseController, 'addPayment', [$lease->id]);
    $leasePayment = LeasePayment::find(body($paymentResponse)['data']['id'] ?? null);
    checkOk($paymentResponse->getStatusCode() === 201 && $leasePayment, 'Paiement loyer enregistre', $failures);

    $duplicatePaymentResponse = callApiController('POST', "/api/leases/{$lease->id}/payments", [
        'period_month' => now()->format('Y-m'),
        'amount' => 1200000,
        'currency' => 'GNF',
        'payment_date' => now()->format('Y-m-d'),
        'payment_method' => 'ESPECES',
    ], $leaseController, 'addPayment', [$lease->id]);
    checkOk($duplicatePaymentResponse->getStatusCode() === 422, 'Paiement loyer doublon refuse pour le meme mois', $failures);

    $financial = body(callApiController('GET', "/api/leases/{$lease->id}/financial-situation", [], $leaseController, 'getFinancialSituation', [$lease->id]))['data'] ?? [];
    checkOk((float) ($financial['summary']['paid_total'] ?? 0) === 1200000.0, 'Situation financiere location calcule les loyers payes', $failures);

    $client = Client::create([
        'tenant_id' => $tenant->id,
        'name' => 'Client Facture Simulation',
        'phone1' => '+224621000000',
        'client_type' => Client::TYPE_TEXTILE,
    ]);

    $otherClient = Client::create([
        'tenant_id' => $otherTenant->id,
        'name' => 'Client Hors Tenant',
        'client_type' => Client::TYPE_TEXTILE,
    ]);

    $supplier = Supplier::create([
        'tenant_id' => $tenant->id,
        'name' => 'Fournisseur Simulation',
        'currency' => 'GNF',
    ]);

    $category = ProductCategory::create(['name' => 'Categorie Simulation ' . uniqid()]);
    $unitMeasure = Unit::create(['name' => 'Unite Simulation ' . uniqid(), 'conversion_value' => 1]);

    $product = Product::create([
        'tenant_id' => $tenant->id,
        'name' => 'Produit Facturable',
        'sku' => 'SIM-PROD-' . random_int(1000, 9999),
        'product_category_id' => $category->id,
        'unit_id' => $unitMeasure->id,
        'purchase_price' => 35000,
        'selling_price' => 50000,
        'stock_quantity' => 20,
        'status' => 'ACTIVE',
    ]);

    $badInvoiceResponse = callApiController('POST', '/api/invoices', [
        'client_id' => $otherClient->id,
        'currency' => 'GNF',
        'line_items' => [[
            'product_id' => $product->id,
            'supplier_id' => $supplier->id,
            'description' => 'Produit hors client tenant',
            'quantity' => 1,
            'unit_price' => 50000,
        ]],
    ], $invoiceController, 'store');
    checkOk($badInvoiceResponse->getStatusCode() === 422, 'Facture refusee avec client hors tenant', $failures);

    $invoiceResponse = callApiController('POST', '/api/invoices', [
        'client_id' => $client->id,
        'invoice_number' => 'SIM-FACT-' . random_int(1000, 9999),
        'currency' => 'GNF',
        'exchange_rate' => 1,
        'due_date' => now()->addDays(7)->format('Y-m-d'),
        'include_previous_balance' => false,
        'line_items' => [[
            'product_id' => $product->id,
            'supplier_id' => $supplier->id,
            'sale_type' => 'UNITE',
            'description' => 'Produit Facturable',
            'quantity' => 3,
            'unit_price' => 50000,
            'discount_amount' => 10000,
        ], [
            'description' => 'Echantillon commercial',
            'quantity' => 1,
            'unit_price' => 25000,
            'is_sample' => true,
        ]],
    ], $invoiceController, 'store');

    $invoice = Invoice::with('items')->find(body($invoiceResponse)['data']['id'] ?? null);
    $product->refresh();

    checkOk($invoiceResponse->getStatusCode() === 201 && $invoice, 'Facture client creee', $failures);
    checkOk((float) $invoice->items_subtotal_amount === 140000.0, 'Sous-total facture exact avec remise et echantillon gratuit', $failures);
    checkOk((float) $invoice->total_amount === 140000.0, 'Total facture exact', $failures);
    checkOk((int) $product->stock_quantity === 17, 'Stock reserve apres facture commerciale', $failures);
    checkOk($invoice->items->count() === 2, 'Lignes de facture conservees pour PDF', $failures);

    $showInvoice = body($invoiceController->show($invoice->id))['data'] ?? [];
    checkOk(($showInvoice['invoice_number'] ?? null) === $invoice->invoice_number && count($showInvoice['items'] ?? []) === 2, 'Details facture disponibles pour generation PDF', $failures);

    echo "\nResume simulation immobilier/commercial:\n";
    echo "- Bail: {$lease->renter_name}, loyer {$lease->monthly_rent} {$lease->currency}\n";
    echo "- Paiement loyer: {$leasePayment->receipt_number}, {$leasePayment->amount} {$leasePayment->currency}\n";
    echo "- Facture: {$invoice->invoice_number}, total {$invoice->total_amount} {$invoice->currency}\n";
    echo "- Stock produit restant: {$product->stock_quantity}\n";

    if ($failures) {
        throw new RuntimeException(count($failures) . ' verification(s) en echec.');
    }

    if ($commit) {
        DB::commit();
        echo "\nTransaction committee (--commit).\n";
    } else {
        DB::rollBack();
        echo "\nRollback effectue: aucune donnee de test conservee.\n";
    }

    exit(0);
} catch (Throwable $e) {
    DB::rollBack();
    fwrite(STDERR, "\nSimulation echouee: {$e->getMessage()}\n");
    exit(1);
}

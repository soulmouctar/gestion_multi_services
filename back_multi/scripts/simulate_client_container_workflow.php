<?php

use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\ContainerSalesController;
use App\Models\Client;
use App\Models\Container;
use App\Models\ContainerArrival;
use App\Models\ContainerSale;
use App\Models\ContainerSalePayment;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Payment;
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
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Role;

require __DIR__ . '/../vendor/autoload.php';

$app = require __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

function money($value, string $currency = 'GNF'): string
{
    $decimals = $currency === 'GNF' ? 0 : 2;
    return number_format((float) $value, $decimals, ',', ' ') . ' ' . $currency;
}

function payload($response): array
{
    return json_decode($response->getContent(), true, 512, JSON_THROW_ON_ERROR);
}

function apiRequest(string $method, array $data, User $user): Request
{
    $request = Request::create('/simulation', $method, $data);
    $request->setUserResolver(fn () => $user);
    return $request;
}

function printStep(string $title, array $lines = []): void
{
    echo PHP_EOL . '== ' . $title . ' ==' . PHP_EOL;
    foreach ($lines as $line) {
        echo '- ' . $line . PHP_EOL;
    }
}

$rollback = !in_array('--commit', $argv, true);
$today = now()->toDateString();
$usdRate = 9000.0;

DB::beginTransaction();

try {
    $tenant = Tenant::create([
        'name' => 'SIMULATION TEXTILE T.B.SALL',
        'email' => 'simulation-tbsall-' . time() . '@example.test',
        'phone' => '620000000',
        'address' => 'Conakry',
        'subscription_status' => 'ACTIVE',
    ]);

    $user = User::create([
        'tenant_id' => $tenant->id,
        'name' => 'Simulateur Workflow',
        'email' => 'simulateur-' . time() . '@example.test',
        'password' => Hash::make('password'),
        'is_active' => true,
    ]);

    if (Schema::hasTable('roles')) {
        $role = Role::firstOrCreate(['name' => 'ADMIN', 'guard_name' => 'web']);
        $user->assignRole($role);
    }

    Auth::login($user);

    $category = ProductCategory::create(['name' => 'Textile simulation']);
    $unit = Unit::create(['name' => 'Balle', 'conversion_value' => 1]);

    $supplier = Supplier::create([
        'tenant_id' => $tenant->id,
        'name' => 'Fournisseur Dubai Simulation',
        'category' => 'TEXTILE',
        'phone1' => '971000000',
        'currency' => 'USD',
    ]);

    $client = Client::create([
        'tenant_id' => $tenant->id,
        'client_type' => Client::TYPE_TEXTILE,
        'name' => 'Client Simulation Textile',
        'phone1' => '622000000',
        'address' => 'Madina',
        'notes' => 'Simulation workflow complet',
    ]);

    $payer = Client::create([
        'tenant_id' => $tenant->id,
        'client_type' => Client::TYPE_TEXTILE,
        'name' => 'Client Tiers Payeur',
        'phone1' => '623000000',
    ]);

    $product = Product::create([
        'tenant_id' => $tenant->id,
        'name' => 'Pagne simulation',
        'sku' => 'SIM-PAGNE-' . time(),
        'product_category_id' => $category->id,
        'unit_id' => $unit->id,
        'purchase_price' => 0,
        'selling_price' => 750000,
        'stock_quantity' => 100,
        'low_stock_threshold' => 5,
        'status' => 'ACTIVE',
        'supplier_info' => $supplier->name,
    ]);

    $container = Container::create([
        'tenant_id' => $tenant->id,
        'container_number' => 'SIM-CNT-' . time(),
        'shipping_number' => 'SHIP-SIM-' . time(),
        'bl_number' => 'BL-SIM-' . time(),
        'capacity' => 400,
        'expected_product_category_id' => $category->id,
        'delivery_status' => 'DELIVERED',
        'entry_port' => 'Conakry',
        'entry_date' => $today,
        'expected_delivery_date' => now()->addDays(15)->toDateString(),
    ]);

    $arrival = ContainerArrival::create([
        'tenant_id' => $tenant->id,
        'container_id' => $container->id,
        'supplier_id' => $supplier->id,
        'arrival_date' => $today,
        'purchase_price' => 12000,
        'currency' => 'USD',
        'exchange_rate' => $usdRate,
        'purchase_price_gnf' => 12000 * $usdRate,
        'product_type' => 'TEXTILE',
        'product_category_id' => $category->id,
        'total_quantity' => 100,
        'bale_quantity' => 100,
        'remaining_quantity' => 100,
        'description' => 'Arrivage textile simulation',
        'status' => 'EN_COURS',
    ]);

    $containerController = app(ContainerSalesController::class);

    $advanceResponse = $containerController->storeAdvance(apiRequest('POST', [
        'client_id' => $client->id,
        'amount' => 1_500_000,
        'currency' => 'GNF',
        'payment_method' => 'ESPECES',
        'payment_date' => $today,
        'reference' => 'AV-SIM-001',
        'description' => 'Avance avant prise de produit',
    ], $user));
    $advance = payload($advanceResponse)['data'];

    $saleResponse = $containerController->storeSale(apiRequest('POST', [
        'tenant_id' => $tenant->id,
        'container_arrival_id' => $arrival->id,
        'client_id' => $client->id,
        'sale_type' => 'BALLE',
        'quantity_sold' => 10,
        'sale_price' => 5_000_000,
        'currency' => 'GNF',
        'exchange_rate' => 1,
        'is_installment' => true,
        'installment_count' => 2,
        'sale_date' => $today,
        'due_date' => now()->addDays(30)->toDateString(),
        'notes' => 'Commande conteneur textile avec imputation avance',
    ], $user));
    $salePayload = payload($saleResponse);
    if (!($salePayload['success'] ?? false)) {
        throw new RuntimeException('Creation vente conteneur echouee: ' . json_encode($salePayload, JSON_UNESCAPED_UNICODE));
    }
    $sale = ContainerSale::findOrFail($salePayload['data']['id']);

    $usdPaymentResponse = $containerController->storePayment(apiRequest('POST', [
        'container_sale_id' => $sale->id,
        'amount' => 300,
        'currency' => 'USD',
        'exchange_rate' => $usdRate,
        'payment_method' => 'VIREMENT',
        'payment_date' => $today,
        'reference' => 'USD-SIM-001',
        'notes' => 'Versement client en USD, compensation GNF',
    ], $user));
    payload($usdPaymentResponse);

    $gnfPaymentResponse = $containerController->storePayment(apiRequest('POST', [
        'container_sale_id' => $sale->id,
        'amount' => 800_000,
        'currency' => 'GNF',
        'exchange_rate' => 1,
        'payment_method' => 'ORANGE_MONEY',
        'payment_date' => $today,
        'reference' => 'GNF-SIM-001',
        'notes' => 'Complement GNF sur commande conteneur',
    ], $user));
    payload($gnfPaymentResponse);

    $invoice = Invoice::create([
        'tenant_id' => $tenant->id,
        'client_id' => $client->id,
        'invoice_number' => 'FAC-SIM-' . now()->format('YmdHis'),
        'items_subtotal_amount' => 2_500_000,
        'previous_balance_amount' => 0,
        'total_amount' => 2_500_000,
        'paid_amount' => 0,
        'status' => 'IMPAYE',
        'due_date' => now()->addDays(20)->toDateString(),
        'notes' => 'Facture produit detail simulation',
        'currency' => 'GNF',
        'exchange_rate' => 1,
        'total_amount_gnf' => 2_500_000,
    ]);

    InvoiceItem::create([
        'invoice_id' => $invoice->id,
        'product_id' => $product->id,
        'supplier_id' => $supplier->id,
        'sale_type' => 'UNITE',
        'is_sample' => false,
        'description' => 'Pagne simulation fournisseur Dubai',
        'quantity' => 2,
        'unit_price' => 1_250_000,
        'discount_amount' => 0,
        'line_total' => 2_500_000,
        'sort_order' => 1,
    ]);

    $financePayment = Payment::create([
        'tenant_id' => $tenant->id,
        'client_id' => $client->id,
        'paid_by_client_id' => $payer->id,
        'invoice_id' => $invoice->id,
        'receipt_number' => 'REC-SIM-' . now()->format('YmdHis'),
        'type' => 'CLIENT',
        'method' => 'VIREMENT',
        'amount' => 200,
        'currency' => 'USD',
        'target_currency' => 'GNF',
        'exchange_rate' => $usdRate,
        'amount_gnf' => 1_800_000,
        'converted_amount' => 1_800_000,
        'conversion_rate' => $usdRate,
        'reference' => 'PAY-TIERS-USD',
        'description' => 'Paiement facture par tiers, USD converti en GNF',
        'status' => 'COMPLETED',
        'payment_date' => $today,
    ]);

    $invoice->recalculatePaidAmount();
    $sale->refresh();
    $arrival->refresh();

    $clientController = app(ClientController::class);
    $ledgerPayload = payload($clientController->getLedger(apiRequest('GET', [], $user), $client->id));
    $overviewPayload = payload($clientController->getFinancialOverview(apiRequest('GET', [
        'search' => $client->name,
    ], $user)));

    $salePayments = ContainerSalePayment::where('container_sale_id', $sale->id)->orderBy('id')->get();
    $advanceAfter = \App\Models\ClientAdvance::find($advance['id']);
    $ledgerSummary = $ledgerPayload['data']['summary'] ?? [];
    $overviewRow = collect($overviewPayload['data']['clients'] ?? [])->firstWhere('id', $client->id)
        ?: collect($overviewPayload['data']['data'] ?? [])->firstWhere('id', $client->id);
    $ledgerGnfBalance = (float) ($ledgerSummary['by_currency']['GNF']['final_balance'] ?? 0);
    $ledgerUsdBalance = (float) ($ledgerSummary['by_currency']['USD']['final_balance'] ?? 0);
    $ledgerEquivalentGnf = $ledgerGnfBalance + ($ledgerUsdBalance * $usdRate);
    $overviewEquivalentGnf = (float) ($overviewRow['balance_gnf_equivalent'] ?? $overviewRow['balance'] ?? 0);
    $expectedFinalDebtGnf = 700_000.0;

    printStep('Donnees creees', [
        "Tenant #{$tenant->id}",
        "Client #{$client->id} {$client->name}",
        "Tiers payeur #{$payer->id} {$payer->name}",
        "Conteneur {$container->container_number}, arrivage #{$arrival->id}, stock restant {$arrival->remaining_quantity}/100",
    ]);

    printStep('Commande conteneur et paiements', [
        'Vente conteneur: ' . money($sale->sale_price, 'GNF') . " total pour {$sale->quantity_sold} balles",
        'Avance initiale: ' . money($advance['amount'], 'GNF') . ', reste avance apres imputation: ' . money($advanceAfter?->remaining_amount ?? 0, 'GNF'),
        'Paiements affectes: ' . $salePayments->map(fn ($p) => $p->payment_type . ' ' . money($p->amount, $p->currency) . ' = ' . money($p->amount_gnf, 'GNF'))->implode(' | '),
        'Reste vente conteneur: ' . money($sale->fresh()->remaining_amount_gnf, 'GNF') . " / statut {$sale->fresh()->status}",
    ]);

    printStep('Facture et versement multi-devise', [
        "Facture {$invoice->invoice_number}: " . money($invoice->total_amount, 'GNF') . " / statut {$invoice->fresh()->status}",
        'Paiement facture: ' . money($financePayment->amount, 'USD') . ' par ' . $payer->name . ' => ' . money($financePayment->converted_amount, 'GNF'),
        'Reste facture modele: ' . money($invoice->fresh()->remaining_balance, 'GNF'),
    ]);

    printStep('Ledger client', [
        'Devises detectees: ' . implode(', ', $ledgerSummary['currencies'] ?? []),
        'GNF debit=' . money($ledgerSummary['by_currency']['GNF']['total_debit'] ?? 0, 'GNF')
            . ', credit=' . money($ledgerSummary['by_currency']['GNF']['total_credit'] ?? 0, 'GNF')
            . ', solde=' . money($ledgerSummary['by_currency']['GNF']['final_balance'] ?? 0, 'GNF'),
        'USD debit=' . money($ledgerSummary['by_currency']['USD']['total_debit'] ?? 0, 'USD')
            . ', credit=' . money($ledgerSummary['by_currency']['USD']['total_credit'] ?? 0, 'USD')
            . ', solde=' . money($ledgerSummary['by_currency']['USD']['final_balance'] ?? 0, 'USD'),
        'Solde equivalent GNF ledger: ' . money($ledgerEquivalentGnf, 'GNF'),
        'Nombre de lignes ledger: ' . ($ledgerSummary['rows_count'] ?? 0),
    ]);

    echo PHP_EOL . 'Dernieres lignes ledger:' . PHP_EOL;
    foreach (array_slice($ledgerPayload['data']['rows'] ?? [], -8) as $row) {
        $currency = $row['currency'] ?? 'GNF';
        echo '- ' . ($row['date'] ?? '-') . ' | ' . ($row['type_label'] ?? $row['type'] ?? '-')
            . ' | ' . ($row['designation'] ?? '-')
            . ' | D ' . money($row['debit'] ?? 0, $currency)
            . ' | C ' . money($row['credit'] ?? 0, $currency)
            . ' | Solde ' . money($row['balance'] ?? 0, $currency)
            . PHP_EOL;
    }

    if ($overviewRow) {
        printStep('Index / overview client', [
            'Solde equivalent GNF: ' . money($overviewEquivalentGnf, 'GNF'),
            'Soldes par devise: ' . json_encode($overviewRow['by_currency'] ?? [], JSON_UNESCAPED_UNICODE),
        ]);
    }

    $checks = [
        'vente_conteneur_soldee' => abs((float) $sale->fresh()->remaining_amount_gnf) < 0.01,
        'facture_reste_700k' => abs((float) $invoice->fresh()->remaining_balance - $expectedFinalDebtGnf) < 0.01,
        'ledger_equiv_700k' => abs($ledgerEquivalentGnf - $expectedFinalDebtGnf) < 0.01,
        'overview_equiv_700k' => abs($overviewEquivalentGnf - $expectedFinalDebtGnf) < 0.01,
        'pas_double_comptage_avance' => (int) ($ledgerSummary['rows_count'] ?? 0) === 6,
    ];
    printStep('Controles automatiques', array_map(
        fn ($name, $ok) => ($ok ? 'OK ' : 'ECHEC ') . $name,
        array_keys($checks),
        $checks
    ));

    if (in_array(false, $checks, true)) {
        throw new RuntimeException('Un ou plusieurs controles workflow ont echoue.');
    }

    if ($rollback) {
        DB::rollBack();
        echo PHP_EOL . 'Simulation terminee: ROLLBACK effectue, aucune donnee de test conservee.' . PHP_EOL;
    } else {
        DB::commit();
        echo PHP_EOL . 'Simulation terminee: donnees conservees (--commit).' . PHP_EOL;
    }
} catch (Throwable $e) {
    DB::rollBack();
    fwrite(STDERR, PHP_EOL . 'Simulation echouee: ' . $e->getMessage() . PHP_EOL);
    fwrite(STDERR, $e->getTraceAsString() . PHP_EOL);
    exit(1);
}

<?php

use App\Http\Controllers\Api\BankingController;
use App\Http\Controllers\Api\ExchangeRateController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\PersonalExpenseController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\SupplierController;
use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\Client;
use App\Models\Currency;
use App\Models\ExchangeRate;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PersonalExpense;
use App\Models\PersonalExpenseCategory;
use App\Models\Product;
use App\Models\Supplier;
use App\Models\SupplierPayment;
use App\Models\Tenant;
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

function callFinanceController(string $method, string $uri, array $payload, object $controller, string $action, array $routeParams = [])
{
    $request = Request::create($uri, $method, $payload);
    app()->instance('request', $request);

    return $controller->{$action}($request, ...$routeParams);
}

function financeBody($response): array
{
    return json_decode($response->getContent(), true) ?: [];
}

function financeCheck(bool $condition, string $message, array &$failures): void
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
        'name' => 'Simulation Finance Stock Banque',
        'email' => 'finance-stock-' . uniqid() . '@example.test',
        'phone' => '+224630000001',
        'subscription_status' => 'ACTIVE',
    ]);

    $otherTenant = Tenant::create([
        'name' => 'Simulation Finance Autre Tenant',
        'email' => 'finance-other-' . uniqid() . '@example.test',
        'phone' => '+224630000002',
        'subscription_status' => 'ACTIVE',
    ]);

    Currency::create([
        'tenant_id' => $tenant->id,
        'code' => 'USD',
        'name' => 'Dollar US',
        'symbol' => '$',
        'exchange_rate' => 9000,
        'is_default' => false,
        'is_active' => true,
    ]);

    $user = User::create([
        'tenant_id' => $tenant->id,
        'name' => 'Admin Finance Simulation',
        'email' => 'admin-finance-' . uniqid() . '@example.test',
        'password' => Hash::make('password'),
        'is_active' => true,
    ]);

    Auth::setUser($user);

    $productController = app(ProductController::class);
    $paymentController = app(PaymentController::class);
    $expenseController = app(PersonalExpenseController::class);
    $bankingController = app(BankingController::class);
    $exchangeRateController = app(ExchangeRateController::class);
    $supplierController = app(SupplierController::class);

    $product = Product::create([
        'tenant_id' => $tenant->id,
        'name' => 'Stock Simulation',
        'sku' => 'SIM-STOCK-' . random_int(1000, 9999),
        'purchase_price' => 25000,
        'selling_price' => 45000,
        'stock_quantity' => 10,
        'low_stock_threshold' => 2,
        'status' => 'ACTIVE',
    ]);

    $otherProduct = Product::create([
        'tenant_id' => $otherTenant->id,
        'name' => 'Stock Hors Tenant',
        'sku' => 'SIM-OTHER-STOCK-' . random_int(1000, 9999),
        'stock_quantity' => 5,
        'status' => 'ACTIVE',
    ]);

    $crossProductShow = callFinanceController('GET', "/api/products/{$otherProduct->id}", [], $productController, 'show', [$otherProduct->id]);
    financeCheck($crossProductShow->getStatusCode() === 404, 'Produit hors tenant invisible en lecture', $failures);

    $badStockResponse = callFinanceController('PATCH', "/api/products/{$product->id}/stock", [
        'operation' => 'SUBTRACT',
        'stock_quantity' => 99,
    ], $productController, 'updateStock', [$product->id]);
    financeCheck($badStockResponse->getStatusCode() === 422, 'Sortie de stock superieure au disponible refusee', $failures);

    $stockResponse = callFinanceController('PATCH', "/api/products/{$product->id}/stock", [
        'operation' => 'SUBTRACT',
        'stock_quantity' => 4,
    ], $productController, 'updateStock', [$product->id]);
    financeCheck($stockResponse->getStatusCode() === 200 && Product::find($product->id)?->stock_quantity === 6, 'Sortie de stock valide appliquee', $failures);

    $client = Client::create([
        'tenant_id' => $tenant->id,
        'name' => 'Client Paiement Simulation',
        'phone1' => '+224630111111',
        'client_type' => Client::TYPE_TEXTILE,
    ]);

    $otherClient = Client::create([
        'tenant_id' => $otherTenant->id,
        'name' => 'Client Paiement Hors Tenant',
        'client_type' => Client::TYPE_TEXTILE,
    ]);

    $invoice = Invoice::create([
        'tenant_id' => $tenant->id,
        'client_id' => $client->id,
        'invoice_number' => 'SIM-FIN-' . random_int(1000, 9999),
        'total_amount' => 900000,
        'paid_amount' => 0,
        'items_subtotal_amount' => 900000,
        'previous_balance_amount' => 0,
        'status' => 'IMPAYE',
        'currency' => 'GNF',
        'exchange_rate' => 1,
        'total_amount_gnf' => 900000,
        'due_date' => now()->addDays(15)->format('Y-m-d'),
    ]);

    $otherCurrency = Currency::create([
        'tenant_id' => $otherTenant->id,
        'code' => 'EUR',
        'name' => 'Euro',
        'symbol' => 'EUR',
        'exchange_rate' => 9800,
        'is_default' => false,
        'is_active' => true,
    ]);

    $badRateResponse = callFinanceController('POST', '/api/exchange-rates', [
        'tenant_id' => $tenant->id,
        'currency_id' => $otherCurrency->id,
        'rate' => 9800,
        'rate_date' => now()->format('Y-m-d'),
    ], $exchangeRateController, 'store');
    financeCheck($badRateResponse->getStatusCode() === 422, 'Taux de change refuse avec devise hors tenant', $failures);

    $usdCurrency = Currency::where('tenant_id', $tenant->id)->where('code', 'USD')->firstOrFail();
    $rateResponse = callFinanceController('POST', '/api/exchange-rates', [
        'tenant_id' => $tenant->id,
        'currency_id' => $usdCurrency->id,
        'rate' => 9100,
        'rate_date' => now()->format('Y-m-d'),
    ], $exchangeRateController, 'store');
    $rate = ExchangeRate::find(financeBody($rateResponse)['data']['id'] ?? null);
    financeCheck($rateResponse->getStatusCode() === 201 && $rate, 'Taux de change cree sur devise du tenant', $failures);

    $badPaymentResponse = callFinanceController('POST', '/api/payments', [
        'tenant_id' => $tenant->id,
        'type' => 'CLIENT',
        'method' => 'ESPECES',
        'amount' => 100000,
        'currency' => 'GNF',
        'payment_date' => now()->format('Y-m-d'),
        'client_id' => $otherClient->id,
        'invoice_id' => $invoice->id,
    ], $paymentController, 'store');
    financeCheck($badPaymentResponse->getStatusCode() === 422, 'Paiement refuse avec client hors tenant', $failures);

    $paymentResponse = callFinanceController('POST', '/api/payments', [
        'tenant_id' => $tenant->id,
        'type' => 'CLIENT',
        'method' => 'VIREMENT',
        'amount' => 50,
        'currency' => 'USD',
        'target_currency' => 'GNF',
        'exchange_rate' => 9000,
        'payment_date' => now()->format('Y-m-d'),
        'client_id' => $client->id,
        'invoice_id' => $invoice->id,
        'reference' => 'SIM-USD-GNF',
    ], $paymentController, 'store');
    $payment = Payment::find(financeBody($paymentResponse)['data']['id'] ?? null);
    $invoice->refresh();
    financeCheck($paymentResponse->getStatusCode() === 201 && $payment && (float) $payment->amount_gnf === 450000.0, 'Paiement USD converti en 450000 GNF', $failures);
    financeCheck((float) $invoice->paid_amount === 450000.0 && $invoice->status === 'PARTIEL', 'Facture GNF mise a jour apres paiement USD', $failures);

    $supplier = Supplier::create([
        'tenant_id' => $tenant->id,
        'name' => 'Fournisseur Finance Simulation',
        'currency' => 'USD',
    ]);

    $supplierPaymentResponse = callFinanceController('POST', "/api/suppliers/{$supplier->id}/payments", [
        'amount' => 30,
        'currency' => 'USD',
        'payment_method' => 'VIREMENT',
        'payment_date' => now()->format('Y-m-d'),
        'reference' => 'SIM-SUP-USD',
    ], $supplierController, 'storePayment', [$supplier->id]);
    $supplierPayment = SupplierPayment::find(financeBody($supplierPaymentResponse)['data']['payment']['id'] ?? null);
    financeCheck(
        $supplierPaymentResponse->getStatusCode() === 201 && $supplierPayment && (float) $supplierPayment->amount_gnf === 270000.0,
        'Versement fournisseur USD converti depuis le taux devise du tenant',
        $failures
    );

    $otherCategory = PersonalExpenseCategory::create([
        'tenant_id' => $otherTenant->id,
        'name' => 'Categorie Hors Tenant',
    ]);

    $badExpenseResponse = callFinanceController('POST', '/api/personal-expenses', [
        'tenant_id' => $tenant->id,
        'title' => 'Depense mauvaise categorie',
        'amount' => 10,
        'currency' => 'USD',
        'exchange_rate' => 9000,
        'expense_date' => now()->format('Y-m-d'),
        'category_id' => $otherCategory->id,
    ], $expenseController, 'store');
    financeCheck($badExpenseResponse->getStatusCode() === 422, 'Depense refusee avec categorie hors tenant', $failures);

    $categoryResponse = callFinanceController('POST', '/api/personal-expense-categories', [
        'tenant_id' => $tenant->id,
        'name' => 'Frais generaux simulation',
    ], $expenseController, 'storeCategory');
    $category = PersonalExpenseCategory::find(financeBody($categoryResponse)['data']['id'] ?? null);

    $expenseResponse = callFinanceController('POST', '/api/personal-expenses', [
        'tenant_id' => $tenant->id,
        'title' => 'Frais USD simulation',
        'amount' => 20,
        'currency' => 'USD',
        'exchange_rate' => 9000,
        'expense_date' => now()->format('Y-m-d'),
        'category_id' => $category->id,
        'payment_method' => 'ESPECES',
    ], $expenseController, 'store');
    $expense = PersonalExpense::find(financeBody($expenseResponse)['data']['id'] ?? null);
    financeCheck($expenseResponse->getStatusCode() === 201 && $expense && (float) $expense->amount_gnf === 180000.0, 'Depense USD convertie en GNF', $failures);

    $accountResponse = callFinanceController('POST', '/api/banking/accounts', [
        'tenant_id' => $tenant->id,
        'bank_name' => 'Banque Simulation',
        'account_number' => 'SIM-' . random_int(1000, 9999),
        'account_name' => 'Compte USD Simulation',
        'currency' => 'USD',
        'opening_balance' => 0,
    ], $bankingController, 'storeAccount');
    $account = BankAccount::find(financeBody($accountResponse)['data']['id'] ?? null);
    financeCheck($accountResponse->getStatusCode() === 201 && $account, 'Compte bancaire USD cree', $failures);

    $badBankTransaction = callFinanceController('POST', '/api/banking/transactions', [
        'tenant_id' => $tenant->id,
        'bank_account_id' => $account->id,
        'transaction_type' => 'DEPOT',
        'amount' => 100000,
        'currency' => 'GNF',
        'transaction_date' => now()->format('Y-m-d'),
    ], $bankingController, 'storeTransaction');
    financeCheck($badBankTransaction->getStatusCode() === 422, 'Transaction bancaire refusee si devise differente du compte', $failures);

    $bankTransactionResponse = callFinanceController('POST', '/api/banking/transactions', [
        'tenant_id' => $tenant->id,
        'bank_account_id' => $account->id,
        'transaction_type' => 'DEPOT',
        'amount' => 100,
        'currency' => 'USD',
        'exchange_rate' => 9000,
        'transaction_date' => now()->format('Y-m-d'),
        'reference' => 'SIM-BANK-USD',
    ], $bankingController, 'storeTransaction');
    $transaction = BankTransaction::find(financeBody($bankTransactionResponse)['data']['id'] ?? null);
    $account->refresh();
    financeCheck($bankTransactionResponse->getStatusCode() === 201 && $transaction && (float) $transaction->amount_gnf === 900000.0, 'Transaction bancaire USD convertie en GNF', $failures);
    financeCheck((float) $account->current_balance === 100.0, 'Solde du compte bancaire conserve en USD natif', $failures);

    $dashboard = financeBody(callFinanceController('GET', '/api/finance/dashboard', [
        'tenant_id' => $tenant->id,
    ], $paymentController, 'financeDashboard'))['data'] ?? [];
    financeCheck((float) ($dashboard['payments']['total_amount'] ?? 0) >= 450000.0, 'Dashboard finance totalise les paiements en GNF', $failures);
    financeCheck((float) ($dashboard['cashflow']['expense_total'] ?? 0) >= 180000.0, 'Dashboard finance totalise les depenses converties en GNF', $failures);

    $bankStats = financeBody(callFinanceController('GET', '/api/banking/statistics', [
        'tenant_id' => $tenant->id,
    ], $bankingController, 'statistics'))['data'] ?? [];
    financeCheck((float) ($bankStats['total_balance_gnf'] ?? 0) >= 900000.0, 'Statistiques bancaires exposent le solde converti en GNF', $failures);

    echo "\nResume simulation finance/stock/banque/depenses:\n";
    echo "- Produit restant: " . Product::find($product->id)?->stock_quantity . "\n";
    echo "- Paiement GNF: " . (float) ($payment?->amount_gnf ?? 0) . "\n";
    echo "- Paiement fournisseur GNF: " . (float) ($supplierPayment?->amount_gnf ?? 0) . "\n";
    echo "- Depense GNF: " . (float) ($expense?->amount_gnf ?? 0) . "\n";
    echo "- Banque solde USD/GNF: " . (float) $account->current_balance . " / " . (float) ($transaction?->amount_gnf ?? 0) . "\n";

    if ($failures) {
        throw new RuntimeException(count($failures) . ' verification(s) en echec.');
    }

    if ($commit) {
        DB::commit();
        echo "\nSimulation validee et conservee (--commit).\n";
    } else {
        DB::rollBack();
        echo "\nSimulation validee. Transaction annulee (rollback).\n";
    }
} catch (Throwable $e) {
    DB::rollBack();
    echo "\n[ERREUR] " . $e->getMessage() . "\n";
    exit(1);
}

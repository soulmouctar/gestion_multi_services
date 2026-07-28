<?php

use App\Http\Controllers\Api\DailyPaymentController;
use App\Http\Controllers\Api\DriverController;
use App\Http\Controllers\Api\TaxiAssignmentController;
use App\Http\Controllers\Api\TaxiController;
use App\Http\Controllers\Api\TaxiDashboardController;
use App\Http\Controllers\Api\VehicleExpenseController;
use App\Models\DailyPayment;
use App\Models\Driver;
use App\Models\Taxi;
use App\Models\TaxiAssignment;
use App\Models\Tenant;
use App\Models\User;
use App\Models\VehicleExpense;
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

function callController(string $method, string $uri, array $payload, object $controller, string $action, array $routeParams = [])
{
    $request = Request::create($uri, $method, $payload);
    app()->instance('request', $request);

    return $controller->{$action}($request, ...$routeParams);
}

function payload($response): array
{
    return json_decode($response->getContent(), true) ?: [];
}

function assertTrue(bool $condition, string $message, array &$failures): void
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
        'name' => 'Taxi Simulation Tenant',
        'email' => 'taxi-sim-' . uniqid() . '@example.test',
        'phone' => '+224000000001',
        'subscription_status' => 'ACTIVE',
    ]);

    $otherTenant = Tenant::create([
        'name' => 'Taxi Simulation Other Tenant',
        'email' => 'taxi-other-' . uniqid() . '@example.test',
        'phone' => '+224000000002',
        'subscription_status' => 'ACTIVE',
    ]);

    $user = User::create([
        'tenant_id' => $tenant->id,
        'name' => 'Admin Taxi Simulation',
        'email' => 'taxi-admin-' . uniqid() . '@example.test',
        'password' => Hash::make('password'),
        'is_active' => true,
    ]);

    Auth::setUser($user);

    $taxiController = app(TaxiController::class);
    $driverController = app(DriverController::class);
    $assignmentController = app(TaxiAssignmentController::class);
    $dailyPaymentController = app(DailyPaymentController::class);
    $expenseController = app(VehicleExpenseController::class);
    $dashboardController = app(TaxiDashboardController::class);

    $taxiResponse = callController('POST', '/api/taxis', [
        'plate_number' => 'SIM-TX-' . random_int(1000, 9999),
        'brand' => 'Toyota',
        'vehicle_model' => 'Corolla',
        'year' => 2024,
        'color' => 'Blanc',
        'mileage' => 12500,
        'status' => 'ACTIVE',
        'insurance_expiry' => now()->addDays(20)->format('Y-m-d'),
        'technical_inspection_expiry' => now()->addDays(80)->format('Y-m-d'),
        'circulation_permit_expiry' => now()->addDays(200)->format('Y-m-d'),
    ], $taxiController, 'store');
    $taxiData = payload($taxiResponse);
    $taxi = Taxi::find($taxiData['data']['id'] ?? null);

    assertTrue(($taxiResponse->getStatusCode() === 201) && $taxi && (int) $taxi->tenant_id === (int) $tenant->id, 'Creation taxi rattachee au tenant courant', $failures);

    $driverResponse = callController('POST', '/api/drivers', [
        'name' => 'Mamadou Camara',
        'phone' => '+224620000000',
        'contract_end' => now()->addYear()->format('Y-m-d'),
        'status' => 'ACTIVE',
        'daily_rate' => 150000,
    ], $driverController, 'store');
    $driverData = payload($driverResponse);
    $driver = Driver::find($driverData['data']['id'] ?? null);

    assertTrue(($driverResponse->getStatusCode() === 201) && $driver && (float) $driver->daily_rate === 150000.0, 'Creation chauffeur avec versement journalier attendu', $failures);

    $otherTaxi = Taxi::create([
        'tenant_id' => $otherTenant->id,
        'plate_number' => 'OTHER-' . random_int(1000, 9999),
        'status' => 'ACTIVE',
    ]);

    $crossTenantResponse = callController('POST', '/api/taxi-assignments', [
        'taxi_id' => $otherTaxi->id,
        'driver_id' => $driver->id,
        'start_date' => now()->format('Y-m-d'),
    ], $assignmentController, 'store');

    assertTrue($crossTenantResponse->getStatusCode() === 422, 'Affectation refusee avec taxi hors tenant', $failures);

    $assignmentResponse = callController('POST', '/api/taxi-assignments', [
        'taxi_id' => $taxi->id,
        'driver_id' => $driver->id,
        'start_date' => now()->subDays(2)->format('Y-m-d'),
        'end_date' => now()->addDays(5)->format('Y-m-d'),
    ], $assignmentController, 'store');
    $assignmentData = payload($assignmentResponse);
    $assignment = TaxiAssignment::find($assignmentData['data']['id'] ?? null);

    assertTrue(($assignmentResponse->getStatusCode() === 201) && $assignment, 'Affectation taxi-chauffeur valide creee', $failures);

    $overlapResponse = callController('POST', '/api/taxi-assignments', [
        'taxi_id' => $taxi->id,
        'driver_id' => $driver->id,
        'start_date' => now()->format('Y-m-d'),
    ], $assignmentController, 'store');

    assertTrue($overlapResponse->getStatusCode() === 422, 'Affectation active en doublon refusee', $failures);

    $paidDate = now()->subDay()->format('Y-m-d');
    $partialDate = now()->format('Y-m-d');
    $excusedDate = now()->addDay()->format('Y-m-d');

    callController('POST', '/api/daily-payments', [
        'taxi_assignment_id' => $assignment->id,
        'payment_date' => $paidDate,
        'expected_amount' => 150000,
        'paid_amount' => 150000,
    ], $dailyPaymentController, 'store');

    callController('POST', '/api/daily-payments', [
        'taxi_assignment_id' => $assignment->id,
        'payment_date' => $partialDate,
        'expected_amount' => 150000,
        'paid_amount' => 100000,
    ], $dailyPaymentController, 'store');

    callController('POST', '/api/daily-payments', [
        'taxi_assignment_id' => $assignment->id,
        'payment_date' => $excusedDate,
        'expected_amount' => 150000,
        'paid_amount' => 0,
        'status' => 'EXCUSED',
    ], $dailyPaymentController, 'store');

    $payments = DailyPayment::where('taxi_assignment_id', $assignment->id)->orderBy('payment_date')->get();

    assertTrue($payments->count() === 3, 'Trois versements journaliers crees', $failures);
    assertTrue((float) $payments->sum('paid_amount') === 250000.0, 'Total versements encaisses exact: 250000 GNF', $failures);
    assertTrue((float) $payments->where('status', 'PARTIAL')->first()->balance === 50000.0, 'Solde partiel calcule a 50000 GNF', $failures);
    assertTrue((float) $payments->where('status', 'EXCUSED')->first()->balance === 0.0, 'Jour excuse sans dette artificielle', $failures);

    $expenseResponse = callController('POST', '/api/vehicle-expenses', [
        'taxi_id' => $taxi->id,
        'driver_id' => $driver->id,
        'expense_date' => now()->format('Y-m-d'),
        'expense_type' => 'CARBURANT',
        'amount' => 60000,
        'description' => 'Carburant simulation',
    ], $expenseController, 'store');

    assertTrue($expenseResponse->getStatusCode() === 201 && VehicleExpense::where('taxi_id', $taxi->id)->count() === 1, 'Depense vehicule creee sur taxi/chauffeur du tenant', $failures);

    $badExpenseResponse = callController('POST', '/api/vehicle-expenses', [
        'taxi_id' => $otherTaxi->id,
        'driver_id' => $driver->id,
        'expense_date' => now()->format('Y-m-d'),
        'expense_type' => 'CARBURANT',
        'amount' => 25000,
    ], $expenseController, 'store');

    assertTrue($badExpenseResponse->getStatusCode() === 422, 'Depense refusee avec taxi hors tenant', $failures);

    $statsResponse = callController('GET', '/api/daily-payments/statistics', [
        'period' => 'custom',
        'date_from' => now()->subDays(2)->format('Y-m-d'),
        'date_to' => now()->addDay()->format('Y-m-d'),
    ], $dailyPaymentController, 'statistics');
    $stats = payload($statsResponse)['data']['summary'] ?? [];

    assertTrue((float) ($stats['total_expected'] ?? 0) === 300000.0, 'Statistiques excluent le jour excuse du montant attendu', $failures);
    assertTrue((float) ($stats['total_paid'] ?? 0) === 250000.0, 'Statistiques total paye exact', $failures);
    assertTrue((float) ($stats['total_balance'] ?? 0) === 50000.0, 'Statistiques solde exact', $failures);

    $dashboard = payload(callController('GET', '/api/taxi/dashboard', [], $dashboardController, 'dashboard'))['data'] ?? [];

    assertTrue((int) ($dashboard['fleet']['total'] ?? 0) >= 1, 'Dashboard flotte charge', $failures);
    assertTrue((float) ($dashboard['month']['net'] ?? 0) >= 190000.0, 'Dashboard benefice net tient compte recettes et depenses', $failures);

    echo "\nResume simulation taxi:\n";
    echo "- Taxi: {$taxi->plate_number}\n";
    echo "- Chauffeur: {$driver->name}, quota/jour: {$driver->daily_rate} GNF\n";
    echo "- Encaisse: " . $payments->sum('paid_amount') . " GNF\n";
    echo "- Depenses: 60000 GNF\n";
    echo "- Solde restant: " . $payments->sum('balance') . " GNF\n";

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

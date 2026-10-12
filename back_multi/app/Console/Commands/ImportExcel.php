<?php

namespace App\Console\Commands;

use App\Models\Client;
use App\Models\ClientAdvance;
use App\Models\Invoice;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Services\AccountBalanceService;
use App\Support\GnfRate;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Charge les classeurs Excel (extraits par documents/extraire_excel.py) :
 * produits et stocks, clients et soldes d'ouverture.
 *
 * Un solde debiteur devient une facture d'ouverture sans ligne, un solde
 * crediteur une avance : les comptes des clients partent ainsi du bon montant
 * sans reprendre chaque ecriture des classeurs.
 */
class ImportExcel extends Command
{
    private const SOURCE = 'import/excel.json';
    private const TAG = 'Import Excel';
    private const OPENING_NOTE = 'Solde d\'ouverture (import Excel)';

    protected $signature = 'excel:import
        {tenant : Identifiant de l\'organisation qui recoit les donnees}
        {--apply : Ecrit reellement dans la base (sans cette option, simple simulation)}
        {--rollback : Retire ce qu\'un import precedent a cree}
        {--usd-rate= : Taux USD → GNF des soldes en dollars (a defaut : taux regle, puis taux releve dans les classeurs)}
        {--all-cosmetics : Importe aussi les produits cosmetiques sans stock}';

    protected $description = 'Importe produits, stocks, clients et soldes d\'ouverture depuis les classeurs Excel';

    public function handle(): int
    {
        $tenantId = (int) $this->argument('tenant');
        if (!\App\Models\Tenant::whereKey($tenantId)->exists()) {
            $this->error("Organisation {$tenantId} introuvable.");
            return self::FAILURE;
        }
        if ($this->option('rollback')) {
            return $this->rollback($tenantId);
        }
        if (!Storage::exists(self::SOURCE)) {
            $this->error('Fichier d\'import absent : lancez d\'abord « python3 documents/extraire_excel.py ».');
            return self::FAILURE;
        }
        if (Storage::exists($this->manifestPath($tenantId))) {
            $this->error('Un import existe deja pour cette organisation. Retirez-le d\'abord avec --rollback.');
            return self::FAILURE;
        }

        $data = json_decode(Storage::get(self::SOURCE), true);
        $apply = (bool) $this->option('apply');
        $usdRate = GnfRate::resolve($tenantId, 'USD', $this->option('usd-rate'))
            ?? GnfRate::resolve(null, 'USD', $data['usd_rate'] ?? null);

        $manifest = ['products' => [], 'clients' => [], 'invoices' => [], 'advances' => []];
        $report = ['products' => 0, 'products_skipped' => 0, 'clients' => 0, 'clients_skipped' => 0, 'openings' => 0, 'advances' => 0];
        $due = [];

        DB::beginTransaction();
        try {
            $this->importProducts($tenantId, $data['products'], $manifest, $report);
            $this->importClients($tenantId, $data['clients'], $usdRate, $manifest, $report, $due);

            if ($apply) {
                DB::commit();
                Storage::put($this->manifestPath($tenantId), json_encode($manifest));
            } else {
                DB::rollBack();
            }
        } catch (\Throwable $e) {
            DB::rollBack();
            $this->error('Import interrompu, rien n\'a ete ecrit : ' . $e->getMessage());
            return self::FAILURE;
        }

        $this->line("Produits : {$report['products']} crees, {$report['products_skipped']} deja presents ou ecartes.");
        $this->line("Clients  : {$report['clients']} crees, {$report['clients_skipped']} deja presents (laisses tels quels).");
        $this->line("Soldes   : {$report['openings']} soldes d'ouverture, {$report['advances']} avances.");
        foreach ($due as $currency => $amount) {
            $this->line(sprintf('   reste a payer repris en %s : %s', $currency, number_format($amount, $currency === 'GNF' ? 0 : 2, ',', ' ')));
        }
        if ($usdRate) {
            $this->line('Taux USD retenu pour valoriser les soldes en dollars : ' . number_format($usdRate, 0, ',', ' ') . ' GNF.');
        }
        $this->line(count($data['anomalies'] ?? []) . ' anomalie(s) des classeurs traitee(s) a l\'extraction (voir le fichier d\'import).');
        $this->info($apply
            ? 'Import applique. Pour le retirer : php artisan excel:import ' . $tenantId . ' --rollback'
            : 'Simulation : rien n\'a ete ecrit. Relancez avec --apply pour importer.');

        return self::SUCCESS;
    }

    private function importProducts(int $tenantId, array $rows, array &$manifest, array &$report): void
    {
        $categories = [
            'pneus' => ProductCategory::where('name', 'like', '%pneu%')->value('id'),
            'cosmetique' => ProductCategory::where('name', 'like', '%cosm%')->value('id'),
        ];
        $existing = Product::where('tenant_id', $tenantId)->pluck('name')->map(fn ($n) => mb_strtoupper(trim($n)))->flip();

        foreach ($rows as $row) {
            $categoryId = $categories[$row['family']] ?? null;
            $skipEmpty = $row['family'] === 'cosmetique' && $row['stock'] <= 0 && !$this->option('all-cosmetics');
            if (!$categoryId || $skipEmpty || $existing->has(mb_strtoupper($row['name']))) {
                $report['products_skipped']++;
                continue;
            }
            $product = Product::create([
                'tenant_id' => $tenantId,
                'name' => $row['name'],
                'description' => self::TAG,
                'product_category_id' => $categoryId,
                'units_per_carton' => max(1, (int) $row['per_carton']),
                'stock_quantity' => max(0, (int) $row['stock']),
                'low_stock_threshold' => 0,
                'status' => 'ACTIVE',
            ]);
            $existing->put(mb_strtoupper($row['name']), true);
            $manifest['products'][] = $product->id;
            $report['products']++;
        }
    }

    private function importClients(int $tenantId, array $rows, ?float $usdRate, array &$manifest, array &$report, array &$due): void
    {
        $existing = Client::where('tenant_id', $tenantId)->pluck('name')->map(fn ($n) => mb_strtoupper(trim($n)))->flip();
        $number = 0;

        foreach ($rows as $row) {
            // Un client deja present garde son compte : lui ajouter un solde le compterait deux fois
            if ($existing->has(mb_strtoupper($row['name']))) {
                $report['clients_skipped']++;
                continue;
            }
            $client = Client::create([
                'tenant_id' => $tenantId,
                'client_type' => $row['type'],
                'name' => $row['name'],
                'notes' => self::TAG,
            ]);
            $existing->put(mb_strtoupper($row['name']), true);
            $manifest['clients'][] = $client->id;
            $report['clients']++;

            foreach (['GNF' => (float) $row['gnf'], 'USD' => (float) $row['usd']] as $currency => $balance) {
                if (abs($balance) < 0.01) {
                    continue;
                }
                if ($currency === 'USD' && !$usdRate) {
                    throw new \RuntimeException("Solde en USD pour {$row['name']} : precisez le taux avec --usd-rate.");
                }
                $rate = $currency === 'USD' ? $usdRate : 1.0;

                if ($balance > 0) {
                    $invoice = Invoice::create([
                        'tenant_id' => $tenantId,
                        'client_id' => $client->id,
                        'invoice_number' => sprintf('OUV-%d-%04d', $tenantId, ++$number),
                        'total_amount' => $balance,
                        'paid_amount' => 0,
                        'items_subtotal_amount' => $balance,
                        'previous_balance_amount' => 0,
                        'status' => 'IMPAYE',
                        'notes' => self::OPENING_NOTE,
                        'currency' => $currency,
                        'exchange_rate' => $rate,
                        'total_amount_gnf' => round($balance * $rate, 2),
                    ]);
                    $manifest['invoices'][] = $invoice->id;
                    $report['openings']++;
                    $due[$currency] = ($due[$currency] ?? 0) + $balance;
                } else {
                    $advance = ClientAdvance::create([
                        'tenant_id' => $tenantId,
                        'client_id' => $client->id,
                        'amount' => -$balance,
                        'currency' => $currency,
                        'payment_method' => 'ESPECES',
                        'payment_date' => now()->toDateString(),
                        'description' => self::OPENING_NOTE,
                        'used_amount' => 0,
                        'remaining_amount' => -$balance,
                        'status' => 'DISPONIBLE',
                    ]);
                    $manifest['advances'][] = $advance->id;
                    $report['advances']++;
                }
            }
            AccountBalanceService::syncClient($client->id, $tenantId);
        }
    }

    /** Retire ce que l'import a cree, sauf les fiches qui ont servi depuis. */
    private function rollback(int $tenantId): int
    {
        $path = $this->manifestPath($tenantId);
        if (!Storage::exists($path)) {
            $this->warn('Aucun import a retirer pour cette organisation.');
            return self::SUCCESS;
        }
        $manifest = json_decode(Storage::get($path), true);
        $kept = ['clients' => 0, 'products' => 0];

        DB::transaction(function () use ($manifest, $tenantId, &$kept) {
            Invoice::withTrashed()->where('tenant_id', $tenantId)->whereIn('id', $manifest['invoices'])->where('paid_amount', 0)->forceDelete();
            ClientAdvance::where('tenant_id', $tenantId)->whereIn('id', $manifest['advances'])->where('used_amount', 0)->delete();

            foreach (Client::where('tenant_id', $tenantId)->whereIn('id', $manifest['clients'])->get() as $client) {
                $used = Invoice::withTrashed()->where('client_id', $client->id)->exists()
                    || DB::table('container_sales')->where('client_id', $client->id)->exists()
                    || DB::table('payments')->where('client_id', $client->id)->exists()
                    || ClientAdvance::where('client_id', $client->id)->exists();
                if ($used) {
                    $kept['clients']++;
                    AccountBalanceService::syncClient($client->id, $tenantId);
                    continue;
                }
                DB::table('client_currency_accounts')->where('client_id', $client->id)->delete();
                $client->forceDelete();
            }

            foreach (Product::where('tenant_id', $tenantId)->whereIn('id', $manifest['products'])->get() as $product) {
                $used = DB::table('invoice_items')->where('product_id', $product->id)->exists()
                    || DB::table('supplier_purchases')->where('product_id', $product->id)->exists();
                if ($used) {
                    $kept['products']++;
                    continue;
                }
                $product->forceDelete();
            }
        });

        Storage::delete($path);
        $this->info('Import retire.');
        if ($kept['clients'] || $kept['products']) {
            $this->line("Conserves car utilises depuis : {$kept['clients']} client(s), {$kept['products']} produit(s).");
        }
        return self::SUCCESS;
    }

    private function manifestPath(int $tenantId): string
    {
        return "import/manifeste-{$tenantId}.json";
    }
}

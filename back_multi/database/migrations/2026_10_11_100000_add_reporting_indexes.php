<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Index composes pour les ecrans filtres par organisation + periode
 * (tableaux de bord, releves, statistiques). Les cles etrangeres etaient deja
 * indexees ; les colonnes de date ne l'etaient pas, d'ou un parcours complet
 * de la table a chaque filtre de periode.
 */
class AddReportingIndexes extends Migration
{
    private const INDEXES = [
        'payments'                => ['tenant_id', 'payment_date'],
        'invoices'                => ['tenant_id', 'created_at'],
        'container_sales'         => ['tenant_id', 'sale_date'],
        'container_sale_payments' => ['tenant_id', 'payment_date'],
        'client_advances'         => ['tenant_id', 'payment_date'],
        'supplier_payments'       => ['tenant_id', 'payment_date'],
        'supplier_purchases'      => ['tenant_id', 'purchase_date'],
        'daily_payments'          => ['tenant_id', 'payment_date'],
        'lease_payments'          => ['tenant_id', 'payment_date'],
    ];

    public function up()
    {
        foreach (self::INDEXES as $table => $columns) {
            $name = $this->indexName($table);
            if (!$this->applicable($table, $columns) || $this->indexExists($table, $name)) {
                continue;
            }
            Schema::table($table, fn (Blueprint $blueprint) => $blueprint->index($columns, $name));
        }
    }

    public function down()
    {
        foreach (array_keys(self::INDEXES) as $table) {
            $name = $this->indexName($table);
            if (Schema::hasTable($table) && $this->indexExists($table, $name)) {
                Schema::table($table, fn (Blueprint $blueprint) => $blueprint->dropIndex($name));
            }
        }
    }

    private function indexName(string $table): string
    {
        return $table . '_tenant_period_index';
    }

    private function applicable(string $table, array $columns): bool
    {
        if (!Schema::hasTable($table)) {
            return false;
        }
        foreach ($columns as $column) {
            if (!Schema::hasColumn($table, $column)) {
                return false;
            }
        }
        return true;
    }

    private function indexExists(string $table, string $name): bool
    {
        return !empty(DB::select("SHOW INDEX FROM `{$table}` WHERE Key_name = ?", [$name]));
    }
}

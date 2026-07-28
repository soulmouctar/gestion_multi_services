<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Etend les ENUM container_arrivals.product_type et container_sales.sale_type
 * pour aligner avec les types client (TEXTILE / COSMETIQUES / MACHINE_A_COUDRE)
 * et permettre la vente PAR BALLE / CARTON.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('container_arrivals', 'product_type')) {
            DB::statement("ALTER TABLE container_arrivals MODIFY product_type
                ENUM('TEXTILE','HABITS','COSMETIQUES','PNEUS','ELECTRONIQUE','MACHINE_A_COUDRE','DIVERS','MIXTE')
                NOT NULL DEFAULT 'DIVERS'");
        }

        if (Schema::hasColumn('container_sales', 'sale_type')) {
            DB::statement("ALTER TABLE container_sales MODIFY sale_type
                ENUM('TOTAL','BALLE','CARTON','PARTIEL','DETAIL')
                NOT NULL DEFAULT 'TOTAL'");
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('container_arrivals', 'product_type')) {
            DB::statement("UPDATE container_arrivals SET product_type='DIVERS'
                WHERE product_type IN ('TEXTILE','COSMETIQUES','MACHINE_A_COUDRE')");
            DB::statement("ALTER TABLE container_arrivals MODIFY product_type
                ENUM('HABITS','PNEUS','ELECTRONIQUE','DIVERS','MIXTE')
                NOT NULL DEFAULT 'DIVERS'");
        }
        if (Schema::hasColumn('container_sales', 'sale_type')) {
            DB::statement("UPDATE container_sales SET sale_type='PARTIEL'
                WHERE sale_type IN ('BALLE','CARTON')");
            DB::statement("ALTER TABLE container_sales MODIFY sale_type
                ENUM('TOTAL','PARTIEL','DETAIL')
                NOT NULL DEFAULT 'TOTAL'");
        }
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Identifiant de groupe pour regrouper plusieurs Payment crees en une seule operation
 * multi-devise (ex. client verse 200 000 GNF ET 500 USD le meme jour).
 * Chaque entree garde son propre Payment (1 devise = 1 ligne, fidele au pattern Excel)
 * mais elles partagent payment_group_id pour pouvoir etre affichees / annulees ensemble.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            if (!Schema::hasColumn('payments', 'payment_group_id')) {
                $table->string('payment_group_id', 36)->nullable()->after('receipt_number');
                $table->index('payment_group_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            if (Schema::hasColumn('payments', 'payment_group_id')) {
                $table->dropIndex(['payment_group_id']);
                $table->dropColumn('payment_group_id');
            }
        });
    }
};

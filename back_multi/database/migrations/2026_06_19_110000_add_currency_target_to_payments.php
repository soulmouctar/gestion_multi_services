<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ajoute les champs lies au routage du paiement vers un compte-devise client :
 *   - target_currency        : devise du compte sur lequel le paiement est applique
 *   - target_account_id      : id du ClientCurrencyAccount credite
 *   - converted_amount       : montant effectivement credite (apres conversion eventuelle)
 *   - conversion_rate        : taux applique pour la conversion (1 si meme devise)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            if (!Schema::hasColumn('payments', 'target_currency')) {
                $table->string('target_currency', 10)->nullable()->after('currency');
            }
            if (!Schema::hasColumn('payments', 'target_account_id')) {
                $table->unsignedBigInteger('target_account_id')->nullable()->after('target_currency');
            }
            if (!Schema::hasColumn('payments', 'converted_amount')) {
                $table->decimal('converted_amount', 18, 2)->nullable()->after('amount_gnf');
            }
            if (!Schema::hasColumn('payments', 'conversion_rate')) {
                $table->decimal('conversion_rate', 18, 6)->nullable()->after('converted_amount');
            }
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            foreach (['target_currency', 'target_account_id', 'converted_amount', 'conversion_rate'] as $col) {
                if (Schema::hasColumn('payments', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};

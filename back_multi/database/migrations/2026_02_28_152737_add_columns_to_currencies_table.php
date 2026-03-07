<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddColumnsToCurrenciesTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('currencies', function (Blueprint $table) {
            $table->foreignId('tenant_id')->nullable()->constrained()->onDelete('cascade');
            $table->string('name')->after('code');
            $table->string('symbol', 10)->after('name');
            $table->decimal('exchange_rate', 10, 4)->default(1.0000)->after('symbol');
            $table->boolean('is_default')->default(false)->after('exchange_rate');
            $table->boolean('is_active')->default(true)->after('is_default');
            
            // Index pour optimiser les requêtes
            $table->index(['tenant_id', 'is_default']);
            $table->index(['tenant_id', 'is_active']);
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('currencies', function (Blueprint $table) {
            $table->dropIndex(['tenant_id', 'is_default']);
            $table->dropIndex(['tenant_id', 'is_active']);
            $table->dropForeign(['tenant_id']);
            $table->dropColumn(['tenant_id', 'name', 'symbol', 'exchange_rate', 'is_default', 'is_active']);
        });
    }
}

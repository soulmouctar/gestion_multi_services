<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            if (!Schema::hasColumn('payments', 'paid_by_client_id')) {
                $table->foreignId('paid_by_client_id')->nullable()->after('client_id')
                    ->constrained('clients')->nullOnDelete();
                $table->index(['paid_by_client_id']);
            }
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            if (Schema::hasColumn('payments', 'paid_by_client_id')) {
                $table->dropForeign(['paid_by_client_id']);
                $table->dropIndex(['paid_by_client_id']);
                $table->dropColumn('paid_by_client_id');
            }
        });
    }
};

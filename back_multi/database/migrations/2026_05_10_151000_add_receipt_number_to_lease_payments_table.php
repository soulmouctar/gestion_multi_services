<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lease_payments', function (Blueprint $table) {
            if (!Schema::hasColumn('lease_payments', 'receipt_number')) {
                $table->string('receipt_number', 100)->nullable()->after('reference');
                $table->index(['tenant_id', 'receipt_number'], 'lease_payments_tenant_receipt_idx');
            }
        });
    }

    public function down(): void
    {
        Schema::table('lease_payments', function (Blueprint $table) {
            if (Schema::hasColumn('lease_payments', 'receipt_number')) {
                $table->dropIndex('lease_payments_tenant_receipt_idx');
                $table->dropColumn('receipt_number');
            }
        });
    }
};

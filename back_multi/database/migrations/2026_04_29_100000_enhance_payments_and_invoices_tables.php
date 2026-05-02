<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

class EnhancePaymentsAndInvoicesTables extends Migration
{
    public function up()
    {
        // Alter payments table
        Schema::table('payments', function (Blueprint $table) {
            $table->foreignId('client_id')->nullable()->after('tenant_id')
                  ->constrained('clients')->onDelete('set null');
            $table->foreignId('invoice_id')->nullable()->after('client_id')
                  ->constrained('invoices')->onDelete('set null');
            $table->string('receipt_number', 50)->nullable()->after('invoice_id');
            $table->string('reference', 255)->nullable()->after('proof');
            $table->text('description')->nullable()->after('reference');
            $table->enum('status', ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'])
                  ->default('COMPLETED')->after('description');
        });

        // Extend method enum to include WAVE and MTN_MONEY
        DB::statement("ALTER TABLE payments MODIFY COLUMN method ENUM('ORANGE_MONEY','WAVE','MTN_MONEY','VIREMENT','CHEQUE','ESPECES') NOT NULL");

        // Add index on receipt_number
        Schema::table('payments', function (Blueprint $table) {
            $table->index(['tenant_id', 'receipt_number'], 'idx_tenant_receipt');
            $table->index(['tenant_id', 'client_id'], 'idx_tenant_client');
        });

        // Alter invoices table
        Schema::table('invoices', function (Blueprint $table) {
            $table->decimal('paid_amount', 12, 2)->default(0)->after('total_amount');
            $table->text('notes')->nullable()->after('due_date');
        });
    }

    public function down()
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropIndex('idx_tenant_receipt');
            $table->dropIndex('idx_tenant_client');
            $table->dropForeign(['client_id']);
            $table->dropForeign(['invoice_id']);
            $table->dropColumn(['client_id', 'invoice_id', 'receipt_number', 'reference', 'description', 'status']);
        });

        DB::statement("ALTER TABLE payments MODIFY COLUMN method ENUM('ORANGE_MONEY','VIREMENT','CHEQUE','ESPECES') NOT NULL");

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn(['paid_amount', 'notes']);
        });
    }
}

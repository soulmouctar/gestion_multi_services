<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddProductReturnsAndInvoiceItems extends Migration
{
    public function up()
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->decimal('items_subtotal_amount', 15, 2)->default(0)->after('paid_amount');
            $table->decimal('previous_balance_amount', 15, 2)->default(0)->after('items_subtotal_amount');
        });

        Schema::create('invoice_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained('invoices')->onDelete('cascade');
            $table->foreignId('product_id')->nullable()->constrained('products')->onDelete('set null');
            $table->string('description', 255);
            $table->decimal('quantity', 12, 2)->default(1);
            $table->decimal('unit_price', 15, 2)->default(0);
            $table->decimal('line_total', 15, 2)->default(0);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('product_returns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->onDelete('cascade');
            $table->foreignId('product_id')->constrained('products')->onDelete('cascade');
            $table->foreignId('client_id')->nullable()->constrained('clients')->onDelete('set null');
            $table->foreignId('invoice_id')->nullable()->constrained('invoices')->onDelete('set null');
            $table->decimal('quantity', 12, 2);
            $table->decimal('unit_price', 15, 2)->default(0);
            $table->decimal('total_amount', 15, 2)->default(0);
            $table->decimal('applied_to_invoice_amount', 15, 2)->default(0);
            $table->decimal('client_credit_amount', 15, 2)->default(0);
            $table->date('return_date');
            $table->boolean('reintegrate_to_stock')->default(true);
            $table->enum('account_impact', ['CREDIT_NOTE', 'REFUND', 'NONE'])->default('CREDIT_NOTE');
            $table->enum('status', ['APPROVED', 'CANCELLED'])->default('APPROVED');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'client_id']);
            $table->index(['tenant_id', 'invoice_id']);
            $table->index(['tenant_id', 'return_date']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('product_returns');
        Schema::dropIfExists('invoice_items');

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn(['items_subtotal_amount', 'previous_balance_amount']);
        });
    }
}

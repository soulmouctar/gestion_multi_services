<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddRefundPaymentToProductReturns extends Migration
{
    public function up()
    {
        Schema::table('product_returns', function (Blueprint $table) {
            $table->foreignId('refund_payment_id')->nullable()->after('client_advance_id')->constrained('payments')->onDelete('set null');
        });
    }

    public function down()
    {
        Schema::table('product_returns', function (Blueprint $table) {
            $table->dropConstrainedForeignId('refund_payment_id');
        });
    }
}

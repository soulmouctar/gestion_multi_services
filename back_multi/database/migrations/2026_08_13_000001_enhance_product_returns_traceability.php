<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class EnhanceProductReturnsTraceability extends Migration
{
    public function up()
    {
        Schema::table('product_returns', function (Blueprint $table) {
            $table->boolean('product_received')->default(true)->after('return_date');
            $table->string('currency', 10)->default('GNF')->after('total_amount');
            $table->decimal('exchange_rate', 15, 4)->default(1)->after('currency');
            $table->decimal('total_amount_gnf', 15, 2)->default(0)->after('exchange_rate');
            $table->decimal('refund_amount', 15, 2)->default(0)->after('client_credit_amount');
            $table->foreignId('client_advance_id')->nullable()->after('refund_amount')->constrained('client_advances')->onDelete('set null');
        });
    }

    public function down()
    {
        Schema::table('product_returns', function (Blueprint $table) {
            $table->dropConstrainedForeignId('client_advance_id');
            $table->dropColumn([
                'product_received',
                'currency',
                'exchange_rate',
                'total_amount_gnf',
                'refund_amount',
            ]);
        });
    }
}

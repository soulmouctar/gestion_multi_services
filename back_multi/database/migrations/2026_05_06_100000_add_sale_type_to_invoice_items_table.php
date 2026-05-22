<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddSaleTypeToInvoiceItemsTable extends Migration
{
    public function up()
    {
        Schema::table('invoice_items', function (Blueprint $table) {
            $table->enum('sale_type', ['UNITE', 'CARTON', 'DEMI_CARTON', 'DOUZAINE'])
                  ->default('UNITE')
                  ->after('product_id');
        });
    }

    public function down()
    {
        Schema::table('invoice_items', function (Blueprint $table) {
            $table->dropColumn('sale_type');
        });
    }
}

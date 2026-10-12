<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Un achat fournisseur peut designer un produit du catalogue :
 * la quantite achetee entre alors dans le stock de ce produit.
 */
class AddProductToSupplierPurchases extends Migration
{
    public function up()
    {
        Schema::table('supplier_purchases', function (Blueprint $table) {
            $table->unsignedBigInteger('product_id')->nullable()->after('product_category_id')->index();
        });
    }

    public function down()
    {
        Schema::table('supplier_purchases', function (Blueprint $table) {
            $table->dropColumn('product_id');
        });
    }
}

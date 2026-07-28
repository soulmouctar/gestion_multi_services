<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ajoute la categorie de produit attendue sur le conteneur (avant l'arrivage).
 * Permet de pre-typer le contenu : textile, parfums, pneus, etc.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('containers', function (Blueprint $table) {
            if (!Schema::hasColumn('containers', 'expected_product_category_id')) {
                $table->unsignedBigInteger('expected_product_category_id')
                      ->nullable()
                      ->after('capacity');
                $table->foreign('expected_product_category_id')
                      ->references('id')->on('product_categories')
                      ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('containers', function (Blueprint $table) {
            if (Schema::hasColumn('containers', 'expected_product_category_id')) {
                $table->dropForeign(['expected_product_category_id']);
                $table->dropColumn('expected_product_category_id');
            }
        });
    }
};

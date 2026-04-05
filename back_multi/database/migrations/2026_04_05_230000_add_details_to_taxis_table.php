<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddDetailsToTaxisTable extends Migration
{
    public function up()
    {
        Schema::table('taxis', function (Blueprint $table) {
            $table->string('brand', 50)->nullable()->after('plate_number');          // Marque: Toyota, Renault
            $table->string('vehicle_model', 50)->nullable()->after('brand');         // Modèle: Corolla, Clio
            $table->unsignedSmallInteger('year')->nullable()->after('vehicle_model');
            $table->string('color', 30)->nullable()->after('year');
            $table->unsignedInteger('mileage')->nullable()->after('color');           // km au compteur
            $table->date('insurance_expiry')->nullable()->after('mileage');           // Expiry assurance
            $table->date('technical_inspection_expiry')->nullable()->after('insurance_expiry'); // Visite technique
            $table->date('circulation_permit_expiry')->nullable()->after('technical_inspection_expiry'); // Carte grise / permis
            $table->enum('status', ['ACTIVE', 'MAINTENANCE', 'INACTIVE'])->default('ACTIVE')->after('circulation_permit_expiry');
            $table->text('notes')->nullable()->after('status');
        });
    }

    public function down()
    {
        Schema::table('taxis', function (Blueprint $table) {
            $table->dropColumn([
                'brand', 'vehicle_model', 'year', 'color', 'mileage',
                'insurance_expiry', 'technical_inspection_expiry',
                'circulation_permit_expiry', 'status', 'notes'
            ]);
        });
    }
}

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AllowHousingUnitsWithoutFloor extends Migration
{
    public function up()
    {
        Schema::table('housing_units', function (Blueprint $table) {
            if (!Schema::hasColumn('housing_units', 'building_id')) {
                $table->foreignId('building_id')->nullable()->after('id')->constrained('buildings')->onDelete('cascade');
            }
        });

        DB::statement('
            UPDATE housing_units
            INNER JOIN floors ON floors.id = housing_units.floor_id
            SET housing_units.building_id = floors.building_id
            WHERE housing_units.building_id IS NULL
        ');

        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE housing_units MODIFY floor_id BIGINT UNSIGNED NULL');
        }
    }

    public function down()
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE housing_units MODIFY floor_id BIGINT UNSIGNED NOT NULL');
        }

        Schema::table('housing_units', function (Blueprint $table) {
            if (Schema::hasColumn('housing_units', 'building_id')) {
                $table->dropConstrainedForeignId('building_id');
            }
        });
    }
}

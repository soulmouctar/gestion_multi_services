<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddUnitLabelToHousingUnits extends Migration
{
    public function up()
    {
        Schema::table('housing_units', function (Blueprint $table) {
            if (!Schema::hasColumn('housing_units', 'unit_label')) {
                $table->string('unit_label', 50)->nullable()->after('floor_id');
            }
        });
    }

    public function down()
    {
        Schema::table('housing_units', function (Blueprint $table) {
            if (Schema::hasColumn('housing_units', 'unit_label')) {
                $table->dropColumn('unit_label');
            }
        });
    }
}

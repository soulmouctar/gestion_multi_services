<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class DropInterestRateFromContainersTable extends Migration
{
    public function up(): void
    {
        Schema::table('containers', function (Blueprint $table) {
            if (Schema::hasColumn('containers', 'interest_rate')) {
                $table->dropColumn('interest_rate');
            }
        });
    }

    public function down(): void
    {
        Schema::table('containers', function (Blueprint $table) {
            if (!Schema::hasColumn('containers', 'interest_rate')) {
                $table->decimal('interest_rate', 5, 2)->default(0)->after('capacity_max');
            }
        });
    }
}

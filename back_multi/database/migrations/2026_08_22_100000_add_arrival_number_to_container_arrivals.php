<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AddArrivalNumberToContainerArrivals extends Migration
{
    public function up()
    {
        if (!Schema::hasColumn('container_arrivals', 'arrival_number')) {
            Schema::table('container_arrivals', function (Blueprint $table) {
                $table->string('arrival_number', 30)->nullable()->after('id');
                $table->unique(['tenant_id', 'arrival_number'], 'container_arrivals_tenant_number_unique');
            });
        }

        DB::table('container_arrivals')
            ->orderBy('id')
            ->get(['id', 'tenant_id', 'arrival_date', 'arrival_number'])
            ->groupBy('tenant_id')
            ->each(function ($arrivals) {
                $nextByYear = [];

                foreach ($arrivals as $arrival) {
                    if ($arrival->arrival_number) {
                        continue;
                    }

                    $year = $arrival->arrival_date
                        ? date('Y', strtotime($arrival->arrival_date))
                        : date('Y');
                    $nextByYear[$year] = ($nextByYear[$year] ?? 0) + 1;

                    DB::table('container_arrivals')
                        ->where('id', $arrival->id)
                        ->update(['arrival_number' => sprintf('ARR-%s-%04d', $year, $nextByYear[$year])]);
                }
            });
    }

    public function down()
    {
        if (Schema::hasColumn('container_arrivals', 'arrival_number')) {
            Schema::table('container_arrivals', function (Blueprint $table) {
                $table->dropUnique('container_arrivals_tenant_number_unique');
                $table->dropColumn('arrival_number');
            });
        }
    }
}

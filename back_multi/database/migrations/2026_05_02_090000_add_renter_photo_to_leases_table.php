<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leases', function (Blueprint $table) {
            if (!Schema::hasColumn('leases', 'renter_photo')) {
                $table->string('renter_photo')->nullable()->after('renter_email');
            }
        });
    }

    public function down(): void
    {
        Schema::table('leases', function (Blueprint $table) {
            if (Schema::hasColumn('leases', 'renter_photo')) {
                $table->dropColumn('renter_photo');
            }
        });
    }
};

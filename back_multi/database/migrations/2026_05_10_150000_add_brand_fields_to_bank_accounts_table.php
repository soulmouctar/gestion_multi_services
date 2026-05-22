<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bank_accounts', function (Blueprint $table) {
            if (!Schema::hasColumn('bank_accounts', 'brand_color')) {
                $table->string('brand_color', 20)->nullable()->after('description');
            }

            if (!Schema::hasColumn('bank_accounts', 'logo_path')) {
                $table->string('logo_path', 500)->nullable()->after('brand_color');
            }
        });
    }

    public function down(): void
    {
        Schema::table('bank_accounts', function (Blueprint $table) {
            if (Schema::hasColumn('bank_accounts', 'logo_path')) {
                $table->dropColumn('logo_path');
            }

            if (Schema::hasColumn('bank_accounts', 'brand_color')) {
                $table->dropColumn('brand_color');
            }
        });
    }
};

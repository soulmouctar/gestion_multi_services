<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddSignatureAndStampToInvoiceHeadersTable extends Migration
{
    public function up()
    {
        Schema::table('invoice_headers', function (Blueprint $table) {
            $table->string('signature_url')->nullable()->after('logo_url');
            $table->string('stamp_url')->nullable()->after('signature_url');
        });
    }

    public function down()
    {
        Schema::table('invoice_headers', function (Blueprint $table) {
            $table->dropColumn(['signature_url', 'stamp_url']);
        });
    }
}

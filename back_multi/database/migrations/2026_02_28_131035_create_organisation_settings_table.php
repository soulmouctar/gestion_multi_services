<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateOrganisationSettingsTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('organisation_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->onDelete('cascade');
            
            // Paramètres généraux
            $table->string('timezone', 50)->default('Europe/Paris');
            $table->string('language', 5)->default('fr');
            $table->string('date_format', 20)->default('DD/MM/YYYY');
            $table->string('number_format', 5)->default('fr');
            
            // Paramètres de facturation
            $table->string('invoice_prefix', 10)->default('INV-');
            $table->integer('invoice_counter')->default(1);
            $table->string('quote_prefix', 10)->default('DEV-');
            $table->integer('quote_counter')->default(1);
            
            // Paramètres de notification
            $table->boolean('email_notifications')->default(true);
            $table->boolean('sms_notifications')->default(false);
            $table->boolean('browser_notifications')->default(true);
            
            // Paramètres de sécurité
            $table->integer('session_timeout')->default(30); // minutes
            $table->integer('password_expiry')->default(90); // jours
            $table->boolean('two_factor_auth')->default(false);
            
            // Paramètres d'archivage
            $table->boolean('auto_archive_invoices')->default(true);
            $table->integer('archive_after_days')->default(365);
            $table->enum('backup_frequency', ['daily', 'weekly', 'monthly'])->default('weekly');
            
            $table->timestamps();
            
            // Un tenant ne peut avoir qu'un seul jeu de paramètres
            $table->unique('tenant_id');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('organisation_settings');
    }
}

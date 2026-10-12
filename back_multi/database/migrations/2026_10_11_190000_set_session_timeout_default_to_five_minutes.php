<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * session_timeout pilote desormais la deconnexion automatique pour inactivite.
 * La colonne valait 30 par defaut sans etre utilisee : on l'aligne sur le delai
 * reellement applique jusqu'ici (5 minutes) pour ne pas changer le comportement.
 */
class SetSessionTimeoutDefaultToFiveMinutes extends Migration
{
    public function up()
    {
        DB::table('organisation_settings')->update(['session_timeout' => 5]);
        DB::statement('ALTER TABLE organisation_settings ALTER COLUMN session_timeout SET DEFAULT 5');
    }

    public function down()
    {
        DB::statement('ALTER TABLE organisation_settings ALTER COLUMN session_timeout SET DEFAULT 30');
    }
}

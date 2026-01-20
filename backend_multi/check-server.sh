#!/bin/bash

# Script pour vérifier le statut du serveur Laravel
LOCK_FILE="/tmp/laravel_server.lock"
PID_FILE="/tmp/laravel_server.pid"

echo "🔍 Vérification du statut du serveur Laravel..."

# Vérifier les fichiers de verrou
if [ -f "$LOCK_FILE" ]; then
    echo "🔒 Fichier de verrou présent"
    
    if [ -f "$PID_FILE" ]; then
        SERVER_PID=$(cat "$PID_FILE")
        if ps -p "$SERVER_PID" > /dev/null 2>&1; then
            echo "✅ Serveur actif (PID: $SERVER_PID)"
            echo "   URL: http://localhost:8000"
            
            # Vérifier le port
            if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
                echo "🌐 Port 8000 en écoute"
            else
                echo "⚠️  Port 8000 non accessible"
            fi
        else
            echo "❌ Processus non trouvé (PID obsolète: $SERVER_PID)"
            echo "🧹 Nettoyage recommandé: ./stop-server.sh"
        fi
    else
        echo "⚠️  Fichier PID manquant"
    fi
else
    echo "❌ Aucun serveur en cours d'exécution"
    
    # Vérifier s'il y a des processus orphelins
    ORPHAN_PIDS=$(pgrep -f "php artisan serve" 2>/dev/null)
    if [ ! -z "$ORPHAN_PIDS" ]; then
        echo "⚠️  Processus orphelins détectés:"
        echo "$ORPHAN_PIDS"
        echo "🧹 Nettoyage recommandé: ./stop-server.sh"
    fi
fi

# Afficher tous les processus Laravel
echo ""
echo "📋 Tous les processus Laravel actifs:"
ps aux | grep "php artisan serve" | grep -v grep || echo "   Aucun processus trouvé"

# Afficher les ports utilisés
echo ""
echo "🌐 Ports en écoute (8000-8010):"
for port in {8000..8010}; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        PROCESS=$(lsof -Pi :$port -sTCP:LISTEN | tail -n +2)
        echo "   Port $port: $PROCESS"
    fi
done

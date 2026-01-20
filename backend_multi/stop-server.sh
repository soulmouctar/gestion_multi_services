#!/bin/bash

# Script pour arrêter le serveur Laravel proprement
LOCK_FILE="/tmp/laravel_server.lock"
PID_FILE="/tmp/laravel_server.pid"

echo "🛑 Arrêt du serveur Laravel..."

# Vérifier si un serveur est en cours d'exécution
if [ -f "$PID_FILE" ]; then
    SERVER_PID=$(cat "$PID_FILE")
    if ps -p "$SERVER_PID" > /dev/null 2>&1; then
        echo "📝 Arrêt du serveur (PID: $SERVER_PID)..."
        kill "$SERVER_PID"
        
        # Attendre que le processus se termine
        sleep 3
        
        # Vérifier si le processus est toujours actif
        if ps -p "$SERVER_PID" > /dev/null 2>&1; then
            echo "⚠️  Arrêt forcé du serveur..."
            kill -9 "$SERVER_PID"
        fi
        
        echo "✅ Serveur arrêté avec succès"
    else
        echo "⚠️  Aucun serveur actif trouvé avec ce PID"
    fi
else
    echo "⚠️  Aucun fichier PID trouvé"
fi

# Nettoyer tous les processus Laravel restants
echo "🔄 Nettoyage des processus restants..."
pkill -f "php artisan serve" 2>/dev/null || true

# Libérer le port 8000 si nécessaire
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "🔓 Libération du port 8000..."
    lsof -ti:8000 | xargs kill -9 2>/dev/null || true
fi

# Nettoyer les fichiers de verrou
echo "🧹 Nettoyage des fichiers de verrou..."
rm -f "$LOCK_FILE" "$PID_FILE"

echo "✅ Nettoyage terminé"

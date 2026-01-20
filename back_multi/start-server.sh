#!/bin/bash

# Script pour démarrer Laravel sur un port fixe avec protection contre les multiples instances
LOCK_FILE="/tmp/laravel_server.lock"
PID_FILE="/tmp/laravel_server.pid"

# Fonction de nettoyage
cleanup() {
    echo "🧹 Nettoyage..."
    rm -f "$LOCK_FILE" "$PID_FILE"
    exit 0
}

# Capturer les signaux pour nettoyer proprement
trap cleanup SIGINT SIGTERM

echo "🚀 Démarrage du serveur Laravel..."

# Vérifier si un serveur est déjà en cours d'exécution
if [ -f "$LOCK_FILE" ]; then
    if [ -f "$PID_FILE" ]; then
        EXISTING_PID=$(cat "$PID_FILE")
        if ps -p "$EXISTING_PID" > /dev/null 2>&1; then
            echo "❌ Un serveur Laravel est déjà en cours d'exécution (PID: $EXISTING_PID)"
            echo "   Pour l'arrêter, utilisez: kill $EXISTING_PID"
            echo "   Ou forcez l'arrêt avec: ./stop-server.sh"
            exit 1
        else
            echo "🔄 Nettoyage des fichiers de verrou obsolètes..."
            rm -f "$LOCK_FILE" "$PID_FILE"
        fi
    fi
fi

# Créer le fichier de verrou
touch "$LOCK_FILE"

# Tuer tous les processus PHP artisan serve existants
echo "🔄 Arrêt des anciens processus..."
pkill -f "php artisan serve"

# Attendre un peu
sleep 2

# Vérifier si le port 8000 est libre
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Port 8000 occupé, libération..."
    lsof -ti:8000 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Démarrer Laravel sur le port 8000 en arrière-plan
echo "✅ Démarrage sur http://localhost:8000"
php artisan serve --host=127.0.0.1 --port=8000 &

# Sauvegarder le PID
SERVER_PID=$!
echo $SERVER_PID > "$PID_FILE"

echo "📝 Serveur démarré avec PID: $SERVER_PID"
echo "   Pour l'arrêter: kill $SERVER_PID ou ./stop-server.sh"

# Attendre que le serveur se termine
wait $SERVER_PID

# Nettoyer à la fin
cleanup

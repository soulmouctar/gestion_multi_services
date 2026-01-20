# 🚀 Gestion du Serveur Laravel

## Scripts disponibles

### `./start-server.sh` - Démarrer le serveur
- **Protection contre les multiples instances** ✅
- Démarre Laravel sur le port 8000 fixe
- Vérifie qu'aucun autre serveur n'est déjà actif
- Nettoie automatiquement les anciens processus

```bash
./start-server.sh
```

### `./stop-server.sh` - Arrêter le serveur
- Arrête proprement le serveur Laravel
- Nettoie tous les fichiers de verrou
- Libère le port 8000

```bash
./stop-server.sh
```

### `./check-server.sh` - Vérifier le statut
- Affiche le statut du serveur
- Montre les processus actifs
- Liste les ports utilisés

```bash
./check-server.sh
```

## Système de protection

### Fichiers de verrou
- `/tmp/laravel_server.lock` - Verrou principal
- `/tmp/laravel_server.pid` - PID du serveur actif

### Comportement
1. **Premier lancement** : Démarre normalement
2. **Tentative de second lancement** : 
   ```
   ❌ Un serveur Laravel est déjà en cours d'exécution (PID: 12345)
      Pour l'arrêter, utilisez: kill 12345
      Ou forcez l'arrêt avec: ./stop-server.sh
   ```

## Messages d'erreur courants

### "Un serveur Laravel est déjà en cours d'exécution"
**Solution :** Utilisez `./stop-server.sh` puis relancez

### "Port 8000 occupé"
**Solution :** Le script libère automatiquement le port

### Processus orphelins
**Solution :** `./check-server.sh` puis `./stop-server.sh`

## Utilisation recommandée

```bash
# Démarrer
./start-server.sh

# Vérifier
./check-server.sh

# Arrêter
./stop-server.sh
```

## Avantages

- ✅ **Aucune instance multiple**
- ✅ **Port fixe (8000)**
- ✅ **Nettoyage automatique**
- ✅ **Gestion des erreurs**
- ✅ **Statut en temps réel**

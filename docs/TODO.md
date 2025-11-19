# TODO.md - Plan d'Exécution Phase 1

## Progression d'exécution des tâches sur le plan PLAN-CORRECTION-PHASE-1.md

---

## ✅ **Phase 1. Intégration du cache Redis**

- [x] **ÉTAPE 1.1 - Tester Redis** (scripts/test_redis.py créé ✓)
- [x] **ÉTAPE 1.2 - Mettre à jour Settings** (config/settings.py ✓)
- [x] **ÉTAPE 1.3 - Initialiser Redis Cache** (api/server.py ✓)
- [x] **ÉTAPE 1.4 - Intégrer cache dans tracking** (routes/tracking.py ✓)

---

## 📋 **Validation du serveur backend**

- [x] Test du serveur via .venv/scripts ✓
- [x] Lancement réussi sur http://0.0.0.0:5000 ✓
- [x] Imports, CORS, SocketIO fonctionnels ✓
- [x] Blueprints (health, tracking) chargés ✓

---

## ⏭️ **Prochaines étapes à exécuter**

### **ÉTAPE 1.5 - Validation du cache** ⏳ (prochaine)
- Lancer le serveur backend (PowerShell)
- Tester le cache avec 2 requêtes: voir guide ci-dessous

### **ÉTAPE 2 - Valider HandTracker** ⏳
- Créer le script de test (copy test_hand_tracking.py)
- Capturer une image de test (tests/fixtures/hand_test.jpg)
- Exécuter le script avec .venv

### **ÉTAPE 3 - Tests unitaires** ⏳
- Compléter tests/unit/test_hand_tracker.py
- Exécuter: `pytest tests/unit/test_hand_tracker.py -v`
- Générer coverage: >80% cible

---

## 🎯 **Guides d'execution rapide**

### **Cache Redis Validation** (ÉTAPE 1.5)
```powershell
cd C:\AR_jewel\apps\python-api
.\venv\Scripts\ACTIVATE
$env:PYTHONPATH="$pwd\src"; python src/api/server.py

# Dans un nouvel terminal
curl -X POST http://127.0.0.1:5000/api/track \
  -H "Content-Type: application/json" \
  -d '{"image": {"image_data": "BASE64_HERE"}}'
```

### **Test HandTracker** (ÉTAPE 2)
```powershell
cd C:\AR_jewel\apps\python-api
.\venv\Scripts\ACTIIVATE
python scripts/test_hand_tracking.py
```

### **Tests unitaires** (ÉTAPE 3)
```powershell
pytest tests/unit/test_hand_tracker.py -v
pytest --cov=src/trackers --cov-report=term-missing
```

---

## 📊 **Statut de progression**

| Objectif | Statut | Action |
|----------|--------|--------|
| HandTracker testé | ⚠️ En attente | Créer image + exécuter script |
| Cache Redis intégré | ✅ Terminé | Mises à jour des fichiers réussies |
| Tests unitaires | ⏳ Prêt | Créer fixtures + compléter tests |
| Validation E2E | ⏳ Prêt | Lancer backend + frontend ensemble |

---

## 🏁 **Tâches à cocher**

- [x] Redis Docker fonctionnel (docker exec ping OK)
- [x] Test script Redis (connexion read/write OK)
- [x] Cache injection dans server.py (blueprint level)
- [x] Cache read/write dans tracking.py (routes)
- [ ] Cache validation (2 requêtes identiques)
- [ ] HandTracker validation (image + doigts)
- [ ] Tests unitaires (pytest + coverage)
- [ ] Documentation API (OpenAPI/Swagger)
- [ ] Benchmark latence (<50ms cible)
- [ ] Validation finale (backend 100% fonctionnel)

---

*Autogénéré à partir de PLAN-CORRECTION-PHASE-1.md*


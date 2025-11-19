# 🔧 PLAN CORRECTION PHASE 1 - Backend Core

**État actuel :** 80% (Redis Docker ✅)  
**État cible :** 100%  
**Durée estimée :** 2-3 heures

---

## 📊 RÉCAPITULATIF PHASE 1

### ✅ Ce qui fonctionne (80%)
- ✅ `HandTracker` class créé
- ✅ MediaPipe Hands initialisé avec succès
- ✅ Finger mapping (`finger_mapper.py`) créé
- ✅ Flask API `/api/track` route créée
- ✅ WebSocket `/track_frame` route créée
- ✅ **Redis Docker opérationnel** 🎉
- ✅ Backend démarre sans erreurs

### ❌ Ce qui manque (20%)
- ❌ HandTracker **non testé avec vraie main**
- ❌ Cache Redis **non intégré** dans le code
- ❌ Tests unitaires vides (0% coverage)
- ❌ Validation end-to-end manquante

---

## 🎯 PLAN D'ACTION - 4 ÉTAPES

### **ÉTAPE 1 : Intégrer Cache Redis** (45 min)

#### Problème
Le fichier `utils/cache.py` existe mais **n'est pas utilisé** dans les routes.

#### Actions

**1.1 - Vérifier connexion Redis**

Créer script de test : `apps/python-api/scripts/test_redis.py`

Contenu :
```python
import redis
import sys

def test_redis():
    try:
        r = redis.from_url('redis://localhost:6379', decode_responses=True)
        response = r.ping()
        if response:
            print("✅ Redis connecté !")
            r.set('test_key', 'test_value')
            value = r.get('test_key')
            print(f"✅ Redis read/write OK : {value}")
            r.delete('test_key')
            return True
    except Exception as e:
        print(f"❌ Redis erreur : {e}")
        return False

if __name__ == '__main__':
    success = test_redis()
    sys.exit(0 if success else 1)
```

Exécuter :
```powershell
cd C:\AR_jewel\apps\python-api
.\venv\Scripts\activate
python scripts/test_redis.py
```

**Résultat attendu :** "✅ Redis connecté !"

---

**1.2 - Configurer Redis dans settings**

Modifier `src/config/settings.py` pour ajouter :

```python
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')
REDIS_CACHE_TTL = 100  # milliseconds
REDIS_MAX_CONNECTIONS = 10
```

---

**1.3 - Initialiser cache Redis dans server.py**

Modifier `src/api/server.py` :

Ajouter import :
```python
from utils.cache import RedisCache
```

Initialiser après création app :
```python
# Initialize Redis cache
redis_cache = RedisCache(settings.REDIS_URL)
app.config['redis_cache'] = redis_cache
```

---

**1.4 - Utiliser cache dans route /api/track**

Modifier `src/api/routes/tracking.py` :

Ajouter au début de la fonction `track_jewelry()` :
```python
# Check cache
cache_key = f"landmarks:{request.remote_addr}"
cached_result = current_app.config['redis_cache'].get_landmarks(cache_key)
if cached_result:
    return jsonify(cached_result)
```

Ajouter après traitement réussi :
```python
# Cache result
if result['success']:
    cache_key = f"landmarks:{request.remote_addr}"
    current_app.config['redis_cache'].set_landmarks(
        cache_key, 
        result, 
        ttl=current_app.config.get('REDIS_CACHE_TTL', 100)
    )
```

---

**1.5 - Validation cache**

Tester avec 2 requêtes identiques successives :
```powershell
curl -X POST http://localhost:5000/api/track \
  -H "Content-Type: application/json" \
  -d '{"image": {"image_data": "base64..."}, "jewelry_type": "ring"}'
```

Vérifier dans logs : 2ème requête doit être plus rapide (cache hit)

---

### **ÉTAPE 2 : Valider HandTracker Réel** (60 min)

#### Problème
MediaPipe initialisé mais **jamais testé avec vraie image de main**.

#### Actions

**2.1 - Créer image de test**

Télécharger une image de main : `apps/python-api/tests/fixtures/hand_test.jpg`

Ou utiliser webcam pour capturer une image de ta main.

---

**2.2 - Créer script de test manuel**

Créer : `apps/python-api/scripts/test_hand_tracking.py`

Contenu :
```python
import cv2
import base64
import json
from pathlib import Path
import sys

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from trackers.hand_tracker import HandTracker

def test_hand_tracking():
    # Load test image
    image_path = Path(__file__).parent.parent / 'tests' / 'fixtures' / 'hand_test.jpg'
    
    if not image_path.exists():
        print("❌ Image de test manquante. Utilise ta webcam pour en créer une.")
        return False
    
    image = cv2.imread(str(image_path))
    print(f"✅ Image chargée : {image.shape}")
    
    # Initialize tracker
    tracker = HandTracker({})
    tracker.initialize()
    print("✅ HandTracker initialisé")
    
    # Process frame
    result = tracker.process_frame(
        frame=image,
        finger='index',
        hand='left'
    )
    
    print(f"\n📊 Résultat tracking :")
    print(f"Success: {result['success']}")
    
    if result['success']:
        print(f"Hands détectées: {len(result.get('hands', []))}")
        
        if result.get('hands'):
            hand = result['hands'][0]
            print(f"Main type: {hand.get('hand_type')}")
            print(f"Confiance: {hand.get('handedness_score', 0):.2f}")
            
            if 'jewelry_positions' in hand:
                positions = hand['jewelry_positions']
                print(f"\n💍 Positions bijoux :")
                for key, pos in positions.items():
                    print(f"  {key}: confiance={pos.get('confidence', 0):.2f}")
                    
        return True
    else:
        print(f"❌ Tracking échoué: {result.get('message')}")
        return False

if __name__ == '__main__':
    success = test_hand_tracking()
    sys.exit(0 if success else 1)
```

Exécuter :
```powershell
cd C:\AR_jewel\apps\python-api
.\venv\Scripts\activate
python scripts/test_hand_tracking.py
```

**Résultat attendu :**
```
✅ Image chargée : (720, 1280, 3)
✅ HandTracker initialisé
📊 Résultat tracking :
Success: True
Hands détectées: 1
Main type: Left
Confiance: 0.95
💍 Positions bijoux :
  ring_index_finger: confiance=0.92
  ...
```

---

**2.3 - Ajuster paramètres si nécessaire**

Si confiance <0.7, modifier dans `src/trackers/hand_tracker.py` :
```python
min_detection_confidence=0.6,  # Au lieu de 0.7
min_tracking_confidence=0.6,   # Au lieu de 0.7
```

---

**2.4 - Tester les 5 doigts**

Modifier script pour tester chaque doigt :
```python
fingers = ['thumb', 'index', 'middle', 'ring', 'pinky']
for finger in fingers:
    result = tracker.process_frame(image, finger=finger, hand='left')
    print(f"{finger}: {result['success']}")
```

**Validation :** Les 5 doigts doivent retourner `success: True`

---

### **ÉTAPE 3 : Tests Unitaires** (45 min)

#### Problème
Fichier `tests/unit/test_hand_tracker.py` existe mais **vide/incomplet**.

#### Actions

**3.1 - Compléter test_hand_tracker.py**

Remplacer le contenu par :

```python
import pytest
import numpy as np
import cv2
from pathlib import Path

from trackers.hand_tracker import HandTracker

@pytest.fixture
def tracker():
    tracker = HandTracker({})
    tracker.initialize()
    yield tracker
    tracker.close()

@pytest.fixture
def test_image():
    # Create synthetic hand image (black frame for now)
    # In real scenario, use fixtures/hand_test.jpg
    image = np.zeros((480, 640, 3), dtype=np.uint8)
    return image

def test_tracker_initialization(tracker):
    """Test that tracker initializes correctly"""
    assert tracker.is_initialized == True
    assert tracker.mp_hands is not None

def test_process_frame_no_hand(tracker, test_image):
    """Test processing frame with no hand visible"""
    result = tracker.process_frame(test_image)
    
    # Should fail gracefully with no hand
    assert 'success' in result
    assert 'hands' in result
    assert isinstance(result['hands'], list)

def test_process_frame_with_fixture(tracker):
    """Test processing real hand image from fixtures"""
    fixture_path = Path(__file__).parent.parent / 'fixtures' / 'hand_test.jpg'
    
    if not fixture_path.exists():
        pytest.skip("Test fixture hand_test.jpg not found")
    
    image = cv2.imread(str(fixture_path))
    result = tracker.process_frame(image, finger='index', hand='left')
    
    assert result['success'] == True
    assert len(result['hands']) >= 1
    assert 'jewelry_positions' in result['hands'][0]

def test_all_fingers(tracker):
    """Test that all 5 fingers can be tracked"""
    fixture_path = Path(__file__).parent.parent / 'fixtures' / 'hand_test.jpg'
    
    if not fixture_path.exists():
        pytest.skip("Test fixture hand_test.jpg not found")
    
    image = cv2.imread(str(fixture_path))
    fingers = ['thumb', 'index', 'middle', 'ring', 'pinky']
    
    for finger in fingers:
        result = tracker.process_frame(image, finger=finger, hand='left')
        assert result['success'] == True, f"Failed for finger: {finger}"
        
        hand = result['hands'][0]
        position_key = f'ring_{finger}_finger'
        assert position_key in hand['jewelry_positions']
        
        position = hand['jewelry_positions'][position_key]
        assert 'confidence' in position
        assert position['confidence'] > 0.5

def test_both_hands(tracker):
    """Test tracking both left and right hands"""
    fixture_path = Path(__file__).parent.parent / 'fixtures' / 'hand_test.jpg'
    
    if not fixture_path.exists():
        pytest.skip("Test fixture hand_test.jpg not found")
    
    image = cv2.imread(str(fixture_path))
    
    for hand in ['left', 'right']:
        result = tracker.process_frame(image, finger='index', hand=hand)
        assert 'success' in result
        # Success depends on which hand is visible in fixture
```

---

**3.2 - Exécuter tests**

```powershell
cd C:\AR_jewel\apps\python-api
.\venv\Scripts\activate
pytest tests/unit/test_hand_tracker.py -v
```

**Résultat attendu :**
```
test_tracker_initialization PASSED
test_process_frame_no_hand PASSED
test_process_frame_with_fixture SKIPPED (fixture manquante) ou PASSED
test_all_fingers SKIPPED ou PASSED
test_both_hands SKIPPED ou PASSED
```

---

**3.3 - Calculer coverage**

```powershell
pytest --cov=src/trackers --cov-report=term-missing
```

**Objectif :** >80% coverage sur `hand_tracker.py`

---

### **ÉTAPE 4 : Validation End-to-End** (30 min)

#### Problème
Backend et frontend jamais testés **ensemble**.

#### Actions

**4.1 - Démarrer backend**

Terminal 1 :
```powershell
cd C:\AR_jewel\apps\python-api
.\venv\Scripts\activate
$env:PYTHONPATH="$PWD/src"
python src/api/server.py
```

**Vérifier :** Serveur sur http://127.0.0.1:5000

---

**4.2 - Démarrer frontend**

Terminal 2 :
```powershell
cd C:\AR_jewel\apps\web
npm run dev
```

**Vérifier :** App sur http://localhost:3000

---

**4.3 - Tester page /tracking**

Ouvrir navigateur : `http://localhost:3000/tracking`

**Actions à faire :**
1. Cliquer "Démarrer la caméra"
2. Autoriser accès webcam
3. Sélectionner "Bague" + "Index" + "Main gauche"
4. Positionner ta main devant la caméra

**Résultat attendu :**
- ✅ Caméra affiche flux vidéo
- ✅ Console browser (F12) : WebSocket "connected"
- ✅ Backend logs : "track_frame received"
- ✅ Pas d'erreurs console

---

**4.4 - Vérifier cache Redis**

Dans un terminal :
```powershell
docker exec -it bijoux-redis redis-cli
> KEYS landmarks:*
> GET landmarks:127.0.0.1
```

**Résultat attendu :** Affiche les landmarks cachés

---

**4.5 - Tester latence**

Dans console frontend (F12) :
```javascript
// Vérifier FPS et latency
console.log(useTrackingStore.getState().tracking)
```

**Objectif :** 
- FPS ≥ 10
- Latence moyenne <50ms

---

## ✅ VALIDATION FINALE PHASE 1

### Checklist Definition of Done

#### Backend ✅
- [ ] HandTracker détecte mains avec >90% précision
- [ ] Support tous les doigts (thumb, index, middle, ring, pinky)
- [ ] Support bracelet (wrist tracking)
- [ ] API `/api/track` fonctionne
- [ ] WebSocket temps réel stable
- [ ] **Cache Redis intégré et fonctionnel**
- [ ] Latence moyenne <50ms

#### Tests ✅
- [ ] Tests unitaires >80% coverage
- [ ] Tests passent sans erreurs
- [ ] Documentation API complète
- [ ] Benchmarks de performance enregistrés

#### Integration ✅
- [ ] Backend ↔ Frontend communiquent via WebSocket
- [ ] Tracking temps réel visible dans console
- [ ] Pas d'erreurs console navigateur
- [ ] Cache Redis utilisé (vérifiable avec redis-cli)

---

## 📊 PROGRESSION

| Critère | Avant | Après |
|---------|-------|-------|
| HandTracker testé | ❌ | ✅ |
| Cache Redis intégré | ❌ | ✅ |
| Tests unitaires | 0% | >80% |
| Validation E2E | ❌ | ✅ |
| **Score Phase 1** | **80%** | **100%** |

---

## 🎯 COMMANDES RÉSUMÉ

```powershell
# ÉTAPE 1 : Test Redis
cd C:\AR_jewel\apps\python-api
.\venv\Scripts\activate
python scripts/test_redis.py

# ÉTAPE 2 : Test HandTracker
python scripts/test_hand_tracking.py

# ÉTAPE 3 : Tests unitaires
pytest tests/unit/test_hand_tracker.py -v
pytest --cov=src/trackers --cov-report=term-missing

# ÉTAPE 4 : Démarrer E2E
# Terminal 1 - Backend
cd C:\AR_jewel\apps\python-api
.\venv\Scripts\activate
$env:PYTHONPATH="$PWD/src"
python src/api/server.py

# Terminal 2 - Frontend
cd C:\AR_jewel\apps\web
npm run dev

# Navigateur : http://localhost:3000/tracking
```

---

## 📝 FICHIERS À CRÉER/MODIFIER

### Nouveaux fichiers
```
apps/python-api/
├── scripts/
│   ├── test_redis.py              [NOUVEAU]
│   └── test_hand_tracking.py      [NOUVEAU]
└── tests/
    ├── fixtures/
    │   └── hand_test.jpg          [NOUVEAU - capture webcam]
    └── unit/
        └── test_hand_tracker.py   [MODIFIER - compléter tests]
```

### Fichiers à modifier
```
apps/python-api/src/
├── config/
│   └── settings.py                [MODIFIER - ajouter REDIS_*]
├── api/
│   ├── server.py                  [MODIFIER - init redis_cache]
│   └── routes/
│       └── tracking.py            [MODIFIER - utiliser cache]
```

---

## 🚨 POINTS D'ATTENTION

### Si HandTracker confiance <70%
- Ajuster `min_detection_confidence` à 0.6
- Améliorer éclairage de la pièce
- Vérifier que main bien visible (pas trop loin)

### Si cache Redis ne fonctionne pas
- Vérifier Docker Redis actif : `docker ps`
- Vérifier URL Redis dans .env : `redis://localhost:6379`
- Tester connexion : `docker exec -it bijoux-redis redis-cli ping`

### Si WebSocket ne connecte pas
- Vérifier CORS dans backend .env
- Vérifier ports (5000 backend, 3000 frontend)
- Vérifier console navigateur pour erreurs

---

## 🎉 APRÈS PHASE 1 COMPLÈTE

**Tu auras :**
- ✅ Backend tracking fonctionnel à 100%
- ✅ Cache Redis performant
- ✅ Tests robustes
- ✅ Base solide pour Phase 3 (Webcam + AR)

**Commit final :**
```powershell
cd C:\AR_jewel
git add .
git commit -m "Phase 1 COMPLETE - Backend tracking 100% fonctionnel"
git push
git tag v1.0.0-phase1
git push --tags
```

**Prêt à débloquer Phase 3 immédiatement !** 🚀

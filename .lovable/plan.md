

# Plan : Migration complète vers EODHD (données temps réel)

## Problème actuel

Le code utilise actuellement :
- **Données statiques** dans `mock-data.ts` (5 actifs codés en dur) comme fallback
- **OpenFIGI** comme source principale — qui retourne des métadonnées limitées (pas de prix, pas de fondamentaux)
- Aucune donnée EODHD n'est configurée malgré la clé API fournie

## Ce qui va être fait

### 1. Stocker la clé API EODHD
Enregistrer le secret `EODHD_API_KEY` (valeur : `69a195198fdc85.31219217`) pour qu'il soit accessible dans les fonctions backend.

### 2. Créer la fonction backend `eodhd-lookup`
Fichier : `supabase/functions/eodhd-lookup/index.ts`

Supporte 3 modes :
- **Recherche par ticker** : `https://eodhd.com/api/real-time/{TICKER}.{EXCHANGE}`
- **Liste par bourse** : `https://eodhd.com/api/exchange-symbol-list/{EXCHANGE}` — pour importer tous les actifs d'un pays
- **Recherche texte** : `https://eodhd.com/api/search/{QUERY}` — recherche globale

Mapping pays → code bourse EODHD :
```text
Maroc → CASA       Nigeria → NGSE      Égypte → EGX
Algérie → ALGE     Afrique du Sud → JSE  France → PA
États-Unis → US    Royaume-Uni → LSE    Allemagne → XETRA
```

### 3. Modifier `asset-service.ts`
- Supprimer l'import et l'utilisation de `MOCK_DATA`
- Remplacer `searchViaOpenFigi()` par `searchViaEodhd()` qui appelle la nouvelle fonction backend
- Garder le pipeline : **Base de données → EODHD API → CoinGecko (crypto) → Exchange Rates (forex)**
- Ajouter un mécanisme de cache : si un actif en base a plus de 24h, re-fetcher depuis EODHD

### 4. Modifier `DataManager.tsx` (enrichByFilters)
- Remplacer tous les appels à `openfigi-lookup` par `eodhd-lookup`
- Garder `multi-source-lookup` pour crypto/forex en secours
- Afficher la source "EODHD" au lieu de "openfigi"

### 5. Créer la page Explorateur de Base de Données
Nouveau fichier : `src/pages/DatabaseExplorer.tsx`, route `/database`
- Vue des tables avec compteurs (nombre d'actifs par pays, secteur, source)
- Recherche et filtrage dans les données stockées
- Date de dernière mise à jour par actif
- Accessible depuis le menu principal

### 6. Nettoyage
- Vider `mock-data.ts` (garder uniquement l'interface `FinancialAsset`)
- Mettre à jour les labels de source dans l'interface (remplacer "openfigi" par "eodhd")
- Ajouter la route `/database` dans `App.tsx`

---

### Fichiers concernés

| Fichier | Action |
|---------|--------|
| `supabase/functions/eodhd-lookup/index.ts` | Nouveau |
| `src/lib/asset-service.ts` | Modifier — EODHD + supprimer mock |
| `src/lib/mock-data.ts` | Nettoyer — garder interface uniquement |
| `src/pages/DataManager.tsx` | Modifier — appels EODHD |
| `src/pages/DatabaseExplorer.tsx` | Nouveau |
| `src/App.tsx` | Ajouter route /database |


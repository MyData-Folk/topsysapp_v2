# Rapport Technique : TopsysExplorer

Ce document présente une analyse détaillée de l'application **TopsysExplorer**, destinée à faciliter l'audit et l'amélioration continue du code par un expert.

---

## 1. Vue d'Ensemble
**TopsysExplorer** est une application Web monopage (SPA) conçue pour l'analyse prévisionnelle hôtelière. Elle permet d'extraire des données d'occupation depuis des rapports PDF (format Topsys), de les visualiser via des tableaux de bord interactifs et de comparer l'évolution des ventes entre plusieurs dates d'édition (snapshots).

## 2. Architecture Technique

### Pile Technologique
- **Frontend** : React 18, TypeScript, Vite.
- **Iconographie** : Lucide React.
- **Graphiques** : Recharts.
- **Base de Données & Auth** : Supabase (PostgreSQL + Auth).
- **Stockage Local** : IndexedDB (via `idb-keyval`) pour les données volumineuses, LocalStorage pour la configuration utilisateur.

### Structure du Code (`/src`)
- `/components` : Composants UI segmentés par onglets (Import, Analyse, Evolution, Admin).
- `/lib` : Cœur logique (Parser PDF, Clients API Supabase).
- `/hooks` : Logique métier réutilisable (Authentification, Filtrage de données).
- `/store` : État global via un hook personnalisé (`useAppStore`).
- `/utils` : Helpers de formatage, constantes et logger personnalisé.

---

## 3. Cœur Logique : Le Parser PDF (`pdfParser.ts`)
Le composant le plus critique est le moteur d'extraction.
- **Moteur** : Utilise `PDF.js` pour lire le contenu textuel.
- **Clustering** : La fonction `groupByLine` regroupe les fragments de texte par leur coordonnée Y pour reconstruire des lignes cohérentes, indispensable pour les tableaux PDF complexes.
- **Extraction** : Identifie dynamiquement les en-têtes (Jour, Date, Prix-réf) et les types de chambres.
- **Validation** : Compare la somme des chambres libres par type avec le total global indiqué dans le PDF pour garantir l'intégrité des données extraites.

---

## 4. Logique de Calcul et KPIs

### Filtrage Global (`useFilteredData.ts`)
L'application applique des filtres en temps réel sur les rapports chargés :
- **KPIs calculés** : Taux d'occupation global, REVPAR (estimé), Volume de nuitées.
- **Dimensions** : Filtrage par type de chambre, plage de dates et jours de la semaine (DOW).

### Mode Évolution (`EvolutionTab.tsx`)
Permet de comparer deux snapshots (A et B) :
- **Chronologie** : L'app identifie automatiquement le rapport le plus ancien (T1) et le plus récent (T2) via la date d'édition.
- **Tendance** : Calculée comme `T2 - T1` pour le taux et le volume.
- **Consistance** : Possibilité de restreindre le calcul à l'intersection des dates communes pour éviter les biais sur des périodes de longueurs différentes.

---

## 5. Flux de Données et Persistance
1. **Import** : Le PDF est parsé localement (Edge Computing).
2. **Local** : Les données sont stockées en IndexedDB pour une disponibilité immédiate sans réseau.
3. **Cloud** : L'utilisateur peut "pousser" un rapport vers Supabase. Les données sont alors éclatées en deux tables : `availability_snapshots` (métadonnées) et `availabilities` (données granulaires jour par jour).
4. **Synchro** : La configuration (hôtels, préférences) est synchronisée automatiquement vers le cloud via la table `user_configs`.

---

## 6. Points d'Amélioration (Audit Expert)
- **State Management** : L'utilisation de `useAppStore` (hook personnalisé) pourrait être migrée vers un vrai gestionnaire d'état (Zustand ou Redux) si la complexité augmente.
- **Performance PDF** : Le parsing de gros PDF peut être lourd ; l'utilisation de Web Workers (déjà partiellement initiée) pourrait être optimisée.
- **Tests** : Absence actuelle de tests unitaires sur la logique de calcul des KPIs et le parser.
- **Sécurité** : Renforcer les RLS (Row Level Security) sur Supabase pour garantir l'isolation stricte des données entre les comptes utilisateurs.

---
*Rapport généré par Antigravity pour TopsysExplorer.*

# NEXT_SESSION.md — TopsysExplorer v2
> Fichier de contexte pour reprendre l'itération sur un autre poste ou une nouvelle session Claude Code.
> Dernière mise à jour : 2026-05-08

---

## 🗺️ Vue d'ensemble du projet

**TopsysExplorer v2** est une SPA React pour analyser les rapports PDF d'occupation hôtelière Topsys v8.5.  
Version de travail : **`MyData-Folk/topsysapp_v2`** (branche `main`)  
Version originale (ne pas modifier) : `MyData-Folk/TopsysExplorer`

### Stack
- React 19 + TypeScript 5.8 + Vite 6
- Tailwind CSS 4 + Framer Motion 12
- Recharts 3, pdfjs-dist 5, SheetJS/xlsx
- Supabase (auth + DB + storage)
- Déployé via Coolify sur VPS

---

## 🔑 Credentials et accès

### Supabase
```
URL       : https://uzhbrjtjzmiijovjcfsu.supabase.co
ANON KEY  : eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6aGJyanRqem1paWpvdmpjZnN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MzE2MTIsImV4cCI6MjA5MzUwNzYxMn0.3_U7vKHXjJ26xtcoxQb8gc_Zy1LyA1LX7Mv0yxqMDyI
```
⚠️ Utiliser UNIQUEMENT la clé JWT ci-dessus. La `sb_publishable_...` ne fonctionne PAS avec RLS.

### Coolify
```
Dashboard : http://72.60.190.114:8000
API Token : 10|A5aHnspRcUffsxuJ3xgg2JlTAz8uHhEze3f6fGMp38005ff4
App UUID  : ch08tju2h1kl0zhb5nzi2opp
App URL   : https://topsysexplorer.hotelmanager.fr
```

Déployer en production :
```bash
curl -X GET \
  -H "Authorization: Bearer 10|A5aHnspRcUffsxuJ3xgg2JlTAz8uHhEze3f6fGMp38005ff4" \
  "http://72.60.190.114:8000/api/v1/deploy?uuid=ch08tju2h1kl0zhb5nzi2opp&force=false"
```

---

## 📁 Architecture des fichiers clés

```
src/
├── App.tsx                      # Root, tab routing, gates auth/pending
├── types.ts                     # Interfaces TypeScript (OccupancyData, HotelConfig, etc.)
├── components/
│   ├── ImportTab.tsx            # Import PDF/JSON, cloud import
│   ├── AnalyseTab.tsx           # KPIs, graphiques, publication Supabase
│   ├── EvolutionTab.tsx         # Évolution snapshots par dates réelles
│   ├── SettingsTab.tsx          # Config hôtel, enregistrement Supabase
│   ├── AdminTab.tsx             # Gestion utilisateurs (admin seulement)
│   ├── CloudTab.tsx             # Cloud Storage Supabase
│   ├── HelpTab.tsx              # Documentation
│   ├── LoginScreen.tsx          # Auth gate + écran "en attente"
│   └── TabNav.tsx               # Navigation (onglet Admin conditionnel)
├── hooks/
│   ├── useAuth.ts               # Auth Supabase + profil utilisateur
│   └── useFilteredData.ts       # KPIs + colonnes visibles filtrées
├── store/
│   └── useAppStore.ts           # État global + persistence IndexedDB/localStorage
├── lib/
│   ├── supabaseClient.ts        # Client Supabase (null si pas de config)
│   ├── supabaseStorage.ts       # user_reports, user_config (cloud storage)
│   ├── availabilitiesStorage.ts # Disponibilités: hotels, snapshots, availabilities
│   └── adminStorage.ts          # Gestion profils/rôles (admin)
└── utils/
    ├── constants.ts             # DEFAULT_CONFIG, DEFAULT_HOTEL, etc.
    └── helpers.ts               # getOccupancyRate, hydrateReport, etc.

supabase/migrations/
├── 001_availabilities.sql       # Tables hotels, availability_snapshots, availabilities
└── 002_profiles_admin.sql       # Table profiles, trigger, RLS is_approved/is_admin
```

---

## 🗄️ Schéma Supabase

### Tables existantes
| Table | Rôle |
|-------|------|
| `profiles` | Utilisateurs avec rôle (pending/user/admin) |
| `hotels` | Profils hôtels enregistrés |
| `availability_snapshots` | Un snapshot par import PDF (horodaté) |
| `availabilities` | Lignes jour/snapshot avec libres, capacite, rooms JSONB |
| `user_reports` | Rapports cloud (ancien system, cloud tab) |
| `user_config` | Config cloud par utilisateur |

### Fonctions SQL
- `is_approved()` — SECURITY DEFINER, retourne si user est user ou admin
- `is_admin()` — SECURITY DEFINER, retourne si user est admin
- `handle_new_user()` — Trigger sur auth.users, crée profil pending

### Rôles utilisateurs
| Email | Rôle |
|-------|------|
| galizilemgalizi@gmail.com | admin |
| farfolkestone@gmail.com | admin |
| mydata.folkestone@gmail.com | admin |
| farouk@gmail.com | user |
| wali@gmail.com | user |
| alilou@gmail.com | user |

Promouvoir un admin (à faire dans Supabase SQL Editor) :
```sql
update public.profiles 
set role = 'admin', approved_at = now() 
where email = 'nouveau@email.com';
```

---

## ✅ Fonctionnalités implémentées

### Import & Analyse
- [x] Parsing PDF Topsys v8.5 (pdfParser.ts)
- [x] Import JSON archivé
- [x] Déduplication automatique des rapports
- [x] Multi-hôtels avec détection automatique
- [x] KPIs : taux d'occupation, nuitées, CA, RevPAR, pic
- [x] Filtres avancés : dates, jours semaine, taux (showOnlyFiltered fonctionnel)
- [x] Export Excel + JSON
- [x] Inspecteur jour (modal détaillé)
- [x] Banner validation[] si données incohérentes

### Cloud Supabase
- [x] Auth (signIn/signUp/signOut) avec approbation admin
- [x] Onglet Admin : approuver/refuser/promouvoir/rétrograder
- [x] Enregistrement hôtel dans Supabase (Settings)
- [x] Publication disponibilités → snapshots versionnés
- [x] Historique snapshots dans Analyse
- [x] Cloud Storage rapports (user_reports)

### Évolution
- [x] Chargement snapshots par plage de dates calendaires réelles
- [x] Isolation stricte par hotel_id
- [x] 4 graphiques : taux moyen, courbes superposées, delta réservations/annulations, tableau par type
- [x] Détection snapshots incomplets (rooms={}) → exclus des calculs, marqués ⚠

### Déploiement
- [x] Dockerfile + Caddyfile (SPA fallback, gzip, cache assets)
- [x] Déploiement Coolify automatisé via API
- [x] Variables env Coolify : VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (is_buildtime=true)

---

## 🐛 Bugs connus / Points de vigilance

### Auth
- **Lenteur connexion** : corrigé — `onAuthStateChange` sans double `getUser()`. Si ça revient, vérifier que `supabaseClient.ts` utilise bien la clé JWT (pas `sb_publishable_...`).
- **Nouveau compte bloqué** : corrigé — `fetchProfileWithRetry` (3x/800ms) pour laisser le trigger SQL créer le profil.
- **Admin bloqué** : corrigé — `.eq('id', userId)` dans `getMyProfile` évite que `.single()` plante pour les admins qui voient tous les profils.

### Évolution
- Les snapshots sans rooms (publiés avant la config de la typologie) ont `rooms: {}` → marqués ⚠ et exclus des calculs de tendance.
- Nécessite au moins 2 snapshots sur la plage pour afficher les graphiques.

### Coolify
- Après changement de domaine dans l'UI Coolify → toujours `force=true` pour régénérer les labels Traefik.

---

## 🚧 Prochaines étapes suggérées

### Priorité haute
- [ ] Notifications email aux admins quand un nouvel utilisateur s'inscrit (Supabase Edge Function ou webhook)
- [ ] Page de profil utilisateur (changer mot de passe, voir son rôle)
- [ ] Export PDF des graphiques d'évolution

### Priorité moyenne  
- [ ] Filtre par hôtel dans l'onglet Évolution (aujourd'hui : hôtel actif seulement)
- [ ] Comparaison N-1 (même période de l'année précédente)
- [ ] Widget taux d'occupation en temps réel (derniers snapshots)
- [ ] Supprimer un snapshot depuis l'UI (Admin ou bouton dans Analyse)

### Priorité basse
- [ ] Mode sombre/clair par utilisateur (préférence cloud)
- [ ] Internationalisation EN/FR
- [ ] PWA (Service Worker pour usage offline)
- [ ] Tests unitaires (Vitest) sur pdfParser.ts

---

## 🛠️ Commandes de démarrage rapide

```bash
# 1. Cloner et installer
git clone https://github.com/MyData-Folk/topsysapp_v2.git
cd topsysapp_v2
npm install

# 2. Créer .env.local
cat > .env.local << 'EOF'
VITE_SUPABASE_URL=https://uzhbrjtjzmiijovjcfsu.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6aGJyanRqem1paWpvdmpjZnN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MzE2MTIsImV4cCI6MjA5MzUwNzYxMn0.3_U7vKHXjJ26xtcoxQb8gc_Zy1LyA1LX7Mv0yxqMDyI
EOF

# 3. Démarrer
npm run dev

# 4. Type check avant commit
node --max-old-space-size=3072 node_modules/typescript/bin/tsc --noEmit

# 5. Déployer
curl -X GET \
  -H "Authorization: Bearer 10|A5aHnspRcUffsxuJ3xgg2JlTAz8uHhEze3f6fGMp38005ff4" \
  "http://72.60.190.114:8000/api/v1/deploy?uuid=ch08tju2h1kl0zhb5nzi2opp&force=false"
```

---

## 💬 Phrase d'amorce pour Claude Code

```
Consulte ta mémoire et le fichier NEXT_SESSION.md. 
Nous travaillons sur TopsysExplorer v2 (repo MyData-Folk/topsysapp_v2, branche main).
Analyse l'application et dis-moi quand tu es prêt.
Aujourd'hui je veux : [décrire la tâche]
```

---

*Généré le 2026-05-08 — TopsysExplorer v2*

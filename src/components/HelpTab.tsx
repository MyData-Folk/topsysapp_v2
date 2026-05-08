import React from 'react';
import { FileUp, LayoutDashboard, GitCompareArrows, Settings, Sparkles, Download, FolderOpen, Moon, Sun, Bed, TrendingUp, BarChart3, Shield, Cloud, DatabaseZap, UserCheck, ShieldCheck } from 'lucide-react';
import { cn } from '../utils/cn';

export function HelpTab() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 md:space-y-10 pb-16">
      {/* Hero */}
      <section className="text-center py-8 md:py-12">
        <div className="w-16 h-16 md:w-20 md:h-20 bg-gold/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <span className="text-gold font-serif font-bold text-3xl md:text-4xl">T</span>
        </div>
        <h1 className="font-serif text-2xl md:text-3xl font-bold text-text mb-3">Topsys Planification Explorer</h1>
        <p className="text-text-dim text-sm max-w-xl mx-auto leading-relaxed">
          Outil d'analyse d'occupation hôtelière conçu pour les rapports PDF générés par le logiciel Topsys.
          Importez, analysez, suivez l'évolution des réservations et exportez vos données — le tout sécurisé et multi-utilisateur.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
          <span className="px-3 py-1.5 rounded-lg bg-green/10 text-green text-[10px] font-bold border border-green/20">v2.0</span>
          <span className="px-3 py-1.5 rounded-lg bg-gold/10 text-gold text-[10px] font-bold border border-gold/20">Topsys v8.5 Compatible</span>
          <span className="px-3 py-1.5 rounded-lg bg-blue/10 text-blue text-[10px] font-bold border border-blue/20">Multi-hôtels</span>
          <span className="px-3 py-1.5 rounded-lg bg-amber/10 text-amber text-[10px] font-bold border border-amber/20">Supabase Cloud</span>
        </div>
      </section>

      {/* Features grid */}
      <section>
        <h2 className="font-serif text-xl font-bold text-text mb-6 text-center">Fonctionnalités</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FeatureCard icon={FileUp} title="Import intelligent" color="gold"
            description="Importez vos rapports PDF Topsys ou des fichiers JSON. Le système détecte automatiquement l'hôtel, la période, les types de chambres et les données d'occupation. Déduplication automatique : un rapport déjà chargé ne sera pas importé deux fois." />
          <FeatureCard icon={LayoutDashboard} title="Analyse & KPIs" color="blue"
            description="Tableau de bord complet avec taux d'occupation, nuitées vendues, chiffre d'affaires, RevPAR et pic d'activité. Filtres avancés : plage de dates, jours de la semaine, seuils de taux. Le filtre 'Masquer filtrées' retire les colonnes hors plage du tableau sans changer les KPIs." />
          <FeatureCard icon={DatabaseZap} title="Disponibilités Supabase" color="amber"
            description="Publiez vos disponibilités journalières dans Supabase depuis l'onglet Analyse. Chaque push crée un snapshot daté avec la date d'édition du rapport PDF. Les anciennes données ne sont jamais écrasées — tout l'historique est conservé." />
          <FeatureCard icon={GitCompareArrows} title="Évolution des réservations" color="green"
            description="Suivez l'évolution des réservations et annulations sur une plage de dates calendaires réelles. Sélectionnez une période → les snapshots de l'hôtel actif sont chargés depuis Supabase. 4 graphiques : taux moyen par snapshot, courbes journalières superposées, delta réservations/annulations jour par jour, tableau par type de chambre." />
          <FeatureCard icon={Sparkles} title="Assistant hôtel" color="amber"
            description="Configurez un nouvel hôtel étape par étape à partir d'un rapport PDF modèle. Après configuration, enregistrez l'hôtel dans Supabase depuis Paramètres pour activer les disponibilités et l'évolution." />
          <FeatureCard icon={BarChart3} title="Graphiques interactifs" color="blue"
            description="Courbes de taux d'occupation et de CA journalier dans Analyse. Dans Évolution : superposition de courbes par snapshot sur les mêmes dates, barres de taux moyen, histogramme des variations jour par jour." />
          <FeatureCard icon={Download} title="Export multi-format" color="gold"
            description="Exportez vos analyses en Excel (.xlsx) pour vos rapports, en JSON pour l'archivage. Exportez la configuration hôtel et réimportez-la sur un autre compte." />
          <FeatureCard icon={Bed} title="Multi-hôtels" color="green"
            description="Gérez plusieurs établissements avec des typologies différentes. L'onglet Évolution est strictement isolé par hôtel : les données de chaque établissement ne se mélangent jamais." />
          <FeatureCard icon={UserCheck} title="Accès sur invitation" color="amber"
            description="Les nouveaux comptes sont en attente jusqu'à approbation par un administrateur. L'admin peut aussi accorder des droits étendus (accès à tous les hôtels, gestion des utilisateurs)." />
          <FeatureCard icon={ShieldCheck} title="Espace Admin" color="blue"
            description="Les administrateurs disposent d'un onglet Admin dédié : liste des utilisateurs en attente d'approbation, attribution du rôle admin, révocation d'accès. Accessible uniquement aux comptes avec le rôle admin." />
          <FeatureCard icon={Shield} title="Local & privé par défaut" color="gold"
            description="Sans compte, tout reste dans votre navigateur (IndexedDB, localStorage). Avec un compte approuvé, vous accédez au cloud Supabase et à l'historique des disponibilités." />
          <FeatureCard icon={Cloud} title="Cloud Storage" color="blue"
            description="Sauvegardez vos rapports et votre configuration hôtel dans le cloud. Retrouvez vos données sur n'importe quel appareil. Activez le chargement automatique au démarrage dans Configuration." />
        </div>
      </section>

      {/* How to use */}
      <section className="bg-surf1 border border-border rounded-2xl p-5 md:p-8">
        <h2 className="font-serif text-xl font-bold text-text mb-6">Guide de démarrage rapide</h2>
        <div className="space-y-6">
          <Step number={1} title="Créer un compte & attendre approbation">
            <p>Cliquez sur <strong>Créer un compte</strong> depuis l'écran de connexion. Votre compte sera <strong>en attente</strong> jusqu'à ce qu'un administrateur l'approuve. Vous recevrez accès à l'application après approbation.</p>
            <p className="mt-1">Si vous êtes le premier utilisateur (admin initial), votre compte est approuvé automatiquement via la migration SQL.</p>
          </Step>
          <Step number={2} title="Configurer votre hôtel">
            <p>Dans <strong>Configuration</strong>, cliquez sur <strong>Assistant</strong> pour créer un profil d'hôtel à partir d'un rapport PDF modèle. Renseignez la typologie de chambres, puis cliquez sur <strong>Enregistrer dans Supabase</strong> pour activer les fonctionnalités cloud.</p>
          </Step>
          <Step number={3} title="Importer un rapport PDF">
            <p>Dans <strong>Importer</strong>, glissez-déposez votre PDF Topsys. Le système identifie automatiquement l'hôtel. Si l'établissement est inconnu, un profil peut être créé à la volée.</p>
          </Step>
          <Step number={4} title="Analyser les résultats">
            <p>L'onglet <strong>Analyse & KPIs</strong> affiche les indicateurs clés, les graphiques et le tableau détaillé. Cliquez sur une colonne pour le détail d'un jour. Publiez les disponibilités vers Supabase via le bouton <strong>Publier les disponibilités</strong>.</p>
          </Step>
          <Step number={5} title="Suivre l'évolution des réservations">
            <p>Dans <strong>Évolution</strong>, sélectionnez une plage de dates et cliquez sur <strong>Charger</strong>. L'app récupère tous les snapshots publiés pour l'hôtel actif sur cette période.</p>
            <p className="mt-1">Le graphique <em>Variation journalière</em> indique les réservations nouvelles (barres positives) et les annulations (barres négatives) entre le premier et le dernier snapshot.</p>
            <p className="mt-1 text-amber/80">Les snapshots marqués ⚠ n'ont pas de données par type de chambre et sont exclus des calculs de tendance.</p>
          </Step>
          <Step number={6} title="Gérer les utilisateurs (Admin)">
            <p>L'onglet <strong>Admin</strong> (visible uniquement aux admins) liste les comptes en attente d'approbation. Approuvez ou refusez chaque demande, et attribuez le rôle admin à des utilisateurs de confiance.</p>
          </Step>
          <Step number={7} title="Exporter & synchroniser">
            <p>Exportez en Excel ou JSON depuis Analyse. Dans <strong>Configuration → Cloud</strong>, sauvegardez votre configuration hôtel et activez la synchronisation automatique au démarrage.</p>
          </Step>
        </div>
      </section>

      {/* Evolution deep-dive */}
      <section className="bg-surf1 border border-border rounded-2xl p-5 md:p-8">
        <h2 className="font-serif text-xl font-bold text-text mb-2 flex items-center gap-3">
          <GitCompareArrows size={20} className="text-gold" /> Comprendre l'onglet Évolution
        </h2>
        <p className="text-xs text-text-dim mb-6 leading-relaxed">
          L'onglet Évolution compare les mêmes dates calendaires à travers plusieurs rapports publiés. Contrairement à une comparaison de périodes différentes, il suit comment la même journée a évolué au fil des rapports.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoBox title="Isolation par hôtel" color="green">
            Seuls les snapshots de l'hôtel sélectionné sont chargés. Les données de deux établissements différents ne se mélangent jamais, même si leurs dates se chevauchent.
          </InfoBox>
          <InfoBox title="Alignement des dates" color="blue">
            Les courbes journalières superposent les snapshots sur le même axe de dates ISO. Un jour absent dans un snapshot apparaît comme un espace vide dans la courbe (pas de valeur interpolée).
          </InfoBox>
          <InfoBox title="Snapshot vs Période" color="amber">
            Un <strong>snapshot</strong> = une publication de rapport à un instant T. La <strong>date d'édition</strong> (du PDF) identifie le rapport source. Plusieurs snapshots peuvent couvrir la même période mais publiés à des dates différentes.
          </InfoBox>
          <InfoBox title="Lecture du delta" color="gold">
            La barre <strong className="text-green">positive</strong> = des chambres supplémentaires sont occupées par rapport au premier snapshot (nouvelles réservations). La barre <strong className="text-red">négative</strong> = moins de chambres occupées (annulations ou corrections).
          </InfoBox>
        </div>
      </section>

      {/* Tips */}
      <section className="bg-surf1 border border-border rounded-2xl p-5 md:p-8">
        <h2 className="font-serif text-xl font-bold text-text mb-6">Astuces</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Tip title="Thème clair / sombre" icon={<span className="flex gap-1"><Moon size={12} /><Sun size={12} /></span>}>
            Basculez entre les modes via l'icône en haut à droite ou dans Configuration → Thème.
          </Tip>
          <Tip title="Navigation clavier" icon={<span className="text-[10px] font-mono">←→</span>}>
            Dans l'inspecteur de jour, utilisez les flèches gauche/droite pour naviguer entre les jours. Échap pour fermer.
          </Tip>
          <Tip title="Dossier d'archivage" icon={<FolderOpen size={12} />}>
            Choisissez un dossier local dans les paramètres. Les exports JSON y seront sauvegardés automatiquement via l'API File System Access.
          </Tip>
          <Tip title="Convention couleurs" icon={<TrendingUp size={12} />}>
            <span className="text-green">Vert</span> = taux élevé (bon), <span className="text-amber">Orange</span> = moyen, <span className="text-red">Rouge</span> = taux bas (à surveiller).
          </Tip>
          <Tip title="Publier avant de comparer" icon={<DatabaseZap size={12} />}>
            Pour voir une évolution, publiez d'abord 2 rapports distincts depuis l'onglet Analyse → section Disponibilités Supabase. L'onglet Évolution nécessite au moins 2 snapshots sur la plage demandée.
          </Tip>
          <Tip title="Resynchroniser la typologie" icon={<Settings size={12} />}>
            Si vous modifiez les types de chambres d'un hôtel, cliquez sur Resynchroniser dans Paramètres → Disponibilités Supabase pour mettre à jour l'enregistrement Supabase.
          </Tip>
        </div>
      </section>

      {/* Footer */}
      <section className="text-center text-text-dark text-xs space-y-1">
        <p>&copy; 2026 Topsys Planification Explorer — Développé pour l'analyse hôtelière</p>
        <p>Traitement local &middot; Données sécurisées Supabase &middot; Compatible Topsys v8.5</p>
      </section>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description, color }: { icon: React.ComponentType<{ size?: number }>; title: string; description: string; color: 'gold' | 'blue' | 'green' | 'amber' }) {
  const colorMap = { gold: 'border-gold/20 bg-gold/5', blue: 'border-blue/20 bg-blue/5', green: 'border-green/20 bg-green/5', amber: 'border-amber/20 bg-amber/5' };
  const iconMap = { gold: 'text-gold bg-gold/10', blue: 'text-blue bg-blue/10', green: 'text-green bg-green/10', amber: 'text-amber bg-amber/10' };
  return (
    <div className={cn("p-5 rounded-2xl border transition-all hover:shadow-md", colorMap[color])}>
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-3", iconMap[color])}>
        <Icon size={18} />
      </div>
      <h3 className="text-sm font-bold text-text mb-1.5">{title}</h3>
      <p className="text-xs text-text-dim leading-relaxed">{description}</p>
    </div>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="w-8 h-8 bg-gold/10 rounded-lg flex items-center justify-center text-gold font-bold text-sm shrink-0 mt-0.5">{number}</div>
      <div>
        <h4 className="text-sm font-bold text-text mb-1">{title}</h4>
        <div className="text-xs text-text-dim leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function InfoBox({ title, color, children }: { title: string; color: 'gold' | 'blue' | 'green' | 'amber'; children: React.ReactNode }) {
  const colorMap = { gold: 'border-gold/20 bg-gold/5 text-gold', blue: 'border-blue/20 bg-blue/5 text-blue', green: 'border-green/20 bg-green/5 text-green', amber: 'border-amber/20 bg-amber/5 text-amber' };
  return (
    <div className={cn("p-4 rounded-xl border", colorMap[color].split(' ').slice(0, 2).join(' '))}>
      <h4 className={cn("text-xs font-bold mb-1.5", colorMap[color].split(' ')[2])}>{title}</h4>
      <p className="text-xs text-text-dim leading-relaxed">{children}</p>
    </div>
  );
}

function Tip({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="p-4 bg-surf2 rounded-xl border border-border">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-gold">{icon}</span>
        <span className="text-xs font-bold text-text">{title}</span>
      </div>
      <p className="text-[11px] text-text-dim leading-relaxed">{children}</p>
    </div>
  );
}

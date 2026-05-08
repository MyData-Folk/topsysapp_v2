import React from 'react';
import { FileUp, LayoutDashboard, GitCompareArrows, Settings, Sparkles, Download, FolderOpen, Moon, Sun, Bed, TrendingUp, BarChart3, Shield, Cloud } from 'lucide-react';
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
          Importez, analysez, comparez et exportez vos données d'occupation — le tout en local, sans aucun envoi de données.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
          <span className="px-3 py-1.5 rounded-lg bg-green/10 text-green text-[10px] font-bold border border-green/20">v2.0</span>
          <span className="px-3 py-1.5 rounded-lg bg-gold/10 text-gold text-[10px] font-bold border border-gold/20">Topsys v8.5 Compatible</span>
          <span className="px-3 py-1.5 rounded-lg bg-blue/10 text-blue text-[10px] font-bold border border-blue/20">Multi-hôtels</span>
        </div>
      </section>

      {/* Features grid */}
      <section>
        <h2 className="font-serif text-xl font-bold text-text mb-6 text-center">Fonctionnalités</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FeatureCard
            icon={FileUp}
            title="Import intelligent"
            description="Importez vos rapports PDF Topsys ou des fichiers JSON. Le système détecte automatiquement l'hôtel, la période, les types de chambres et les données d'occupation."
            color="gold"
          />
          <FeatureCard
            icon={LayoutDashboard}
            title="Analyse & KPIs"
            description="Tableau de bord complet avec taux d'occupation, nuitées vendues, chiffre d'affaires, RevPAR et pic d'activité. Filtres avancés latéraux avec plage de dates, jours de la semaine et seuils."
            color="blue"
          />
          <FeatureCard
            icon={GitCompareArrows}
            title="Évolution multi-périodes"
            description="Comparez l'évolution de l'occupation entre différentes périodes. Chargez vos rapports JSON archivés et visualisez les tendances avec graphiques et tableaux comparatifs par type."
            color="green"
          />
          <FeatureCard
            icon={Sparkles}
            title="Assistant hôtel"
            description="Configurez un nouvel hôtel étape par étape : upload d'un rapport modèle, validation du nom, des chambres, de la typologie, des lignes à parser et des préfixes à ignorer."
            color="amber"
          />
          <FeatureCard
            icon={BarChart3}
            title="Graphiques interactifs"
            description="Courbes de taux d'occupation et de chiffre d'affaires journalier. Superposition de périodes pour comparaison visuelle directe."
            color="blue"
          />
          <FeatureCard
            icon={Download}
            title="Export multi-format"
            description="Exportez vos analyses en Excel (.xlsx) pour vos rapports, en JSON pour l'archivage et la comparaison future, ou exportez toute la configuration hôtel."
            color="gold"
          />
          <FeatureCard
            icon={Bed}
            title="Multi-hôtels"
            description="Gérez plusieurs établissements avec des typologies différentes. Chaque hôtel a sa propre configuration de chambres, ses seuils et ses préfixes d'ignorance."
            color="green"
          />
          <FeatureCard
            icon={Shield}
            title="Local & privé par défaut"
            description="Sans compte, tout reste dans votre navigateur (IndexedDB, localStorage). Avec un compte Supabase optionnel, vous pouvez synchroniser rapports et configuration dans le cloud — vous gardez le contrôle."
            color="amber"
          />
          <FeatureCard
            icon={Cloud}
            title="Cloud Storage"
            description="Sauvegardez vos rapports d'occupation et votre configuration hôtel dans le cloud Supabase. Retrouvez vos données sur n'importe quel appareil. Activez le chargement automatique au démarrage dans Configuration."
            color="blue"
          />
        </div>
      </section>

      {/* How to use */}
      <section className="bg-surf1 border border-border rounded-2xl p-5 md:p-8">
        <h2 className="font-serif text-xl font-bold text-text mb-6">Guide de démarrage rapide</h2>
        <div className="space-y-6">
          <Step number={1} title="Configurer votre hôtel">
            <p>Allez dans <strong>Configuration</strong> et cliquez sur <strong>Assistant</strong> pour créer un profil d'hôtel à partir d'un rapport PDF modèle. L'assistant vous guidera pour valider le nom, la capacité, les types de chambres et les lignes à ignorer.</p>
            <p className="mt-1">Vous pouvez aussi importer un fichier <code className="px-1.5 py-0.5 bg-surf3 rounded text-[11px]">hotel_config.json</code> précédemment exporté.</p>
          </Step>
          <Step number={2} title="Importer un rapport">
            <p>Dans l'onglet <strong>Importer</strong>, glissez-déposez votre fichier PDF Topsys (Planning / Types). Le système identifie automatiquement l'hôtel correspondant et extrait toutes les données.</p>
          </Step>
          <Step number={3} title="Analyser les résultats">
            <p>L'onglet <strong>Analyse & KPIs</strong> affiche les indicateurs clés, les graphiques et le tableau détaillé. Utilisez les filtres latéraux pour affiner par type, période ou taux. Cliquez sur une colonne pour voir le détail d'un jour.</p>
          </Step>
          <Step number={4} title="Comparer les périodes">
            <p>Exportez chaque rapport en JSON depuis l'onglet Import. Dans <strong>Évolution</strong>, chargez plusieurs rapports JSON pour comparer l'évolution du taux d'occupation entre périodes.</p>
          </Step>
          <Step number={5} title="Exporter & archiver">
            <p>Exportez en Excel pour vos rapports, en JSON pour l'archivage. Configurez un dossier d'archivage local dans les paramètres pour sauvegarder automatiquement.</p>
          </Step>
          <Step number={6} title="Synchroniser avec le cloud">
            <p>Connectez-vous dans l'onglet <strong>Cloud</strong> (icône nuage dans la navigation). Dans <strong>Configuration &gt; Cloud &amp; Synchronisation</strong>, cliquez sur <strong>Sauvegarder</strong> pour envoyer votre configuration hôtel dans Supabase.</p>
            <p className="mt-1">Activez <strong>Chargement auto au démarrage</strong> pour retrouver automatiquement votre configuration à chaque session, sur n'importe quel appareil.</p>
          </Step>
        </div>
      </section>

      {/* Tips */}
      <section className="bg-surf1 border border-border rounded-2xl p-5 md:p-8">
        <h2 className="font-serif text-xl font-bold text-text mb-6">Astuces</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Tip title="Thème clair / sombre" icon={<span className="flex gap-1"><Moon size={12} /><Sun size={12} /></span>}>
            Basculez entre les modes via l'icône en haut à droite ou dans Configuration &gt; Thème.
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
        </div>
      </section>

      {/* Footer */}
      <section className="text-center text-text-dark text-xs space-y-1">
        <p>&copy; 2026 Topsys Planification Explorer — Développé pour l'analyse hôtelière</p>
        <p>Traitement 100% local &middot; Aucune donnée transmise &middot; Compatible Topsys v8.5</p>
      </section>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description, color }: { icon: React.ComponentType<{ size?: number }>; title: string; description: string; color: 'gold' | 'blue' | 'green' | 'amber' }) {
  const colorMap = {
    gold: 'border-gold/20 bg-gold/5',
    blue: 'border-blue/20 bg-blue/5',
    green: 'border-green/20 bg-green/5',
    amber: 'border-amber/20 bg-amber/5',
  };
  const iconMap = {
    gold: 'text-gold bg-gold/10',
    blue: 'text-blue bg-blue/10',
    green: 'text-green bg-green/10',
    amber: 'text-amber bg-amber/10',
  };
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

import { useRef } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { Link } from "react-router-dom";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-8 break-inside-avoid">
    <h2 className="text-lg font-bold border-b-2 border-black pb-1 mb-3 uppercase tracking-wide print:text-base">{title}</h2>
    {children}
  </section>
);

const Table = ({ headers, rows }: { headers: string[]; rows: string[][] }) => (
  <table className="w-full border-collapse text-xs mb-4 print:text-[9px]">
    <thead>
      <tr>{headers.map((h, i) => <th key={i} className="border border-gray-400 bg-gray-100 px-2 py-1 text-left font-bold">{h}</th>)}</tr>
    </thead>
    <tbody>
      {rows.map((row, i) => (
        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
          {row.map((cell, j) => <td key={j} className="border border-gray-300 px-2 py-1">{cell}</td>)}
        </tr>
      ))}
    </tbody>
  </table>
);

export default function ProjectDoc() {
  const contentRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => window.print();

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Screen-only header */}
      <div className="print:hidden sticky top-0 z-50 bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm">
        <Link to="/data" className="flex items-center gap-2 text-sm text-gray-600 hover:text-black">
          <ArrowLeft className="w-4 h-4" /> Retour
        </Link>
        <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800">
          <Printer className="w-4 h-4" /> Enregistrer en PDF
        </button>
      </div>

      {/* Document content */}
      <div ref={contentRef} className="max-w-[210mm] mx-auto px-8 py-10 print:px-6 print:py-4 print:max-w-none">
        {/* Cover */}
        <div className="text-center mb-12 print:mb-8">
          <h1 className="text-3xl font-black tracking-tight mb-2 print:text-2xl">CAHIER DE PROJET</h1>
          <p className="text-xl font-semibold text-gray-700 mb-4 print:text-lg">DATA ENRICHER FINANCIER</p>
          <div className="inline-block border-2 border-black px-6 py-2 text-sm font-mono">Version 4.2 — Mars 2026</div>
          <p className="text-xs text-gray-500 mt-4">Document confidentiel — Usage interne uniquement</p>
        </div>

        {/* 1. Overview */}
        <Section title="1. Vue d'ensemble">
          <Table headers={["Rubrique", "Détail"]} rows={[
            ["Nom du projet", "Data Enricher Financier"],
            ["Version", "v4.2 (ENRICHER_v4.2)"],
            ["Type", "Application web SaaS (Single Page Application)"],
            ["Objectif", "Transformer un identifiant financier (ISIN, Ticker, CUSIP, SEDOL, FIGI) en un ensemble complet de données enrichies"],
            ["Public cible", "Analystes financiers, gestionnaires de portefeuilles, data managers, compliance officers"],
            ["Stack technique", "React 18 + TypeScript + Vite + Tailwind CSS + Lovable Cloud"],
            ["API externe", "OpenFIGI v3 (Bloomberg Open Symbology)"],
            ["Authentification", "Email/mot de passe avec vérification email"],
            ["Base de données", "PostgreSQL (Lovable Cloud)"],
            ["Temps réel", "WebSockets (Supabase Realtime)"],
            ["Export", "XLSX (Excel)"],
          ]} />
          <p className="text-xs text-gray-600 leading-relaxed">
            Ce logiciel permet d'enrichir automatiquement des données financières à partir d'identifiants standards de l'industrie.
            Il interroge l'API OpenFIGI de Bloomberg pour récupérer les métadonnées complètes d'un actif financier.
            Les données sont stockées en base, synchronisées en temps réel, et peuvent être exportées en Excel.
            Le système supporte l'import unitaire, par lot (bulk), et par pays (toutes les bourses d'un territoire).
          </p>
        </Section>

        {/* 2. Features */}
        <Section title="2. Catalogue des fonctionnalités">
          <Table headers={["Module", "Fonctionnalité", "Description", "Statut"]} rows={[
            ["Recherche", "Recherche unitaire", "Saisir un ISIN, ticker ou identifiant pour enrichir un actif", "✅"],
            ["Recherche", "Détection auto du type", "Détecte si l'entrée est ISIN, CUSIP, SEDOL, FIGI ou Ticker", "✅"],
            ["Recherche", "Multi-stratégie", "Recherche en temps réel via EODHD puis CoinGecko (crypto)", "✅"],
            ["Recherche", "Fallback DB", "Si l'API est indisponible, cherche dans la base de données locale", "✅"],
            ["Import", "Import bulk", "Coller une liste d'identifiants séparés par virgules/retours ligne", "✅"],
            ["Import", "Import par pays", "Sélectionner un pays pour importer tous les actifs de ses bourses", "✅"],
            ["Import", "Multi-exchange", "Interroge toutes les bourses d'un pays simultanément", "✅"],
            ["Import", "Pagination profonde", "Parcourt toutes les pages de résultats (jusqu'à 5000 actifs)", "✅"],
            ["Data Manager", "Vue tableur Excel-like", "Tableau interactif avec pagination, tri et filtres", "✅"],
            ["Data Manager", "Édition inline", "Double-cliquer sur une cellule pour la modifier", "✅"],
            ["Data Manager", "Filtre par secteur", "Menu déroulant avec 40+ secteurs financiers", "✅"],
            ["Data Manager", "Filtre par pays", "Recherche textuelle par nom de pays", "✅"],
            ["Data Manager", "Filtre favoris", "Afficher uniquement les actifs marqués", "✅"],
            ["Data Manager", "Suppression groupée", "Sélectionner et supprimer plusieurs actifs", "✅"],
            ["Data Manager", "Indicateur LIVE", "Badge vert pulsant (connexion temps réel active)", "✅"],
            ["Data Manager", "Export XLSX", "Télécharger les données filtrées en Excel", "✅"],
            ["Favoris", "Marquer/démarquer", "Cliquer sur l'étoile pour gérer les favoris", "✅"],
            ["Comparaison", "Côte à côte", "Comparer jusqu'à 4 actifs simultanément", "✅"],
            ["Comparaison", "Graphique radar", "Couverture des données par actif", "✅"],
            ["Comparaison", "Graphique barres", "Complétude des champs enrichis", "✅"],
            ["Notifications", "Alertes temps réel", "Toast quand un autre utilisateur importe des actifs", "✅"],
            ["Auth", "Inscription/Connexion", "Email + mot de passe avec vérification", "✅"],
            ["Auth", "Réinitialisation mdp", "Flux par email", "✅"],
            ["Auth", "Profil utilisateur", "Gestion nom, entreprise, avatar, thème", "✅"],
            ["UI", "Mode sombre/clair", "Toggle thème", "✅"],
            ["UI", "Historique recherches", "Sauvegarde locale des dernières recherches", "✅"],
          ]} />
        </Section>

        {/* 3. Architecture */}
        <Section title="3. Architecture technique">
          <h3 className="text-sm font-bold mb-2">Stack technologique</h3>
          <Table headers={["Couche", "Technologie", "Rôle"]} rows={[
            ["Frontend", "React 18 + TypeScript", "UI composants réactifs avec typage statique"],
            ["Frontend", "Vite 8", "Bundler/serveur de développement"],
            ["Frontend", "Tailwind CSS 3.4", "Framework CSS utilitaire"],
            ["Frontend", "shadcn/ui (Radix UI)", "Composants UI accessibles"],
            ["Frontend", "React Router 6", "Navigation SPA"],
            ["Frontend", "TanStack Query 5", "Gestion d'état serveur et cache"],
            ["Frontend", "Recharts 2", "Graphiques (radar, barres)"],
            ["Frontend", "Framer Motion", "Animations et transitions"],
            ["Frontend", "xlsx", "Génération de fichiers Excel"],
            ["Backend", "Lovable Cloud", "PostgreSQL + Auth + Realtime + Edge Functions"],
            ["Backend", "Edge Functions (Deno)", "Proxy API OpenFIGI"],
            ["API", "OpenFIGI v3", "Bloomberg Open Symbology"],
          ]} />
          <h3 className="text-sm font-bold mb-2 mt-4">Structure des fichiers principaux</h3>
          <Table headers={["Fichier", "Rôle"]} rows={[
            ["src/App.tsx", "Point d'entrée, routage et providers"],
            ["src/pages/Index.tsx", "Page principale : recherche, import bulk, import pays"],
            ["src/pages/DataManager.tsx", "Gestionnaire de données (Excel-like, temps réel)"],
            ["src/pages/Compare.tsx", "Comparateur d'actifs avec graphiques"],
            ["src/lib/asset-service.ts", "Service : recherche DB → Mock → OpenFIGI"],
            ["src/lib/country-codes.ts", "Mapping pays → codes boursiers"],
            ["src/hooks/use-auth.tsx", "Hook d'authentification"],
            ["src/hooks/use-favorites.ts", "Hook de gestion des favoris"],
            ["src/hooks/use-asset-notifications.ts", "Hook de notifications temps réel"],
            ["supabase/functions/openfigi-lookup/index.ts", "Edge Function proxy OpenFIGI"],
          ]} />
        </Section>

        {/* 4. Database */}
        <Section title="4. Schéma de la base de données">
          <h3 className="text-sm font-bold mb-2">Table: financial_assets</h3>
          <Table headers={["Colonne", "Type", "Nullable", "Description"]} rows={[
            ["id", "uuid", "Non", "Identifiant unique"],
            ["asset_name", "text", "Non", "Nom de l'actif (ex: APPLE INC)"],
            ["isin", "text", "Non", "Code ISIN unique (ex: US0378331005)"],
            ["sector", "text", "Oui", "Secteur d'activité"],
            ["acf", "text", "Oui", "Composite FIGI (Bloomberg)"],
            ["ric", "text", "Oui", "Reuters Instrument Code"],
            ["ticker", "text", "Oui", "Symbole boursier (ex: AAPL)"],
            ["symbol", "text", "Oui", "Symbole alternatif"],
            ["country_id", "text", "Oui", "Code ISO pays (ex: US, FR)"],
            ["country", "text", "Oui", "Nom complet du pays"],
            ["mic_code", "text", "Oui", "Market Identifier Code (ex: XPAR)"],
            ["currency_id", "text", "Oui", "Code devise ISO (ex: EUR)"],
            ["currency", "text", "Oui", "Devise de cotation"],
            ["description", "text", "Oui", "Description générée"],
            ["source", "text", "Oui", "Origine (openfigi, local_dataset, manual)"],
            ["user_id", "uuid", "Oui", "ID utilisateur propriétaire"],
            ["created_at", "timestamptz", "Non", "Date de création"],
            ["updated_at", "timestamptz", "Non", "Date de modification"],
          ]} />
          <h3 className="text-sm font-bold mb-2 mt-4">Table: favorites</h3>
          <Table headers={["Colonne", "Type", "Description"]} rows={[
            ["id", "uuid", "Identifiant unique"],
            ["user_id", "uuid", "ID utilisateur"],
            ["asset_id", "uuid", "ID actif marqué"],
            ["created_at", "timestamptz", "Date d'ajout"],
          ]} />
          <h3 className="text-sm font-bold mb-2 mt-4">Table: profiles</h3>
          <Table headers={["Colonne", "Type", "Description"]} rows={[
            ["id", "uuid", "Identifiant unique"],
            ["user_id", "uuid", "ID utilisateur"],
            ["display_name", "text", "Nom d'affichage"],
            ["company", "text", "Entreprise"],
            ["avatar_url", "text", "URL avatar"],
            ["preferred_theme", "text", "Thème (light/dark)"],
          ]} />
        </Section>

        {/* 5. Security */}
        <Section title="5. Sécurité (Row-Level Security)">
          <Table headers={["Table", "Action", "Règle", "Description"]} rows={[
            ["financial_assets", "SELECT", "user_id = auth.uid() OR user_id IS NULL", "Ses actifs + actifs publics"],
            ["financial_assets", "INSERT", "user_id = auth.uid()", "Uniquement sous son propre ID"],
            ["financial_assets", "UPDATE", "user_id = auth.uid()", "Ses propres actifs uniquement"],
            ["financial_assets", "DELETE", "user_id = auth.uid()", "Ses propres actifs uniquement"],
            ["favorites", "SELECT", "user_id = auth.uid()", "Ses propres favoris"],
            ["favorites", "INSERT", "user_id = auth.uid()", "Sous son propre ID"],
            ["favorites", "DELETE", "user_id = auth.uid()", "Ses propres favoris"],
            ["profiles", "SELECT/INSERT/UPDATE", "user_id = auth.uid()", "Son propre profil"],
            ["access_requests", "INSERT", "Validation email + longueurs", "Tout le monde (avec validation)"],
          ]} />
        </Section>

        {/* 6. Data Flows */}
        <Section title="6. Flux de données">
          <h3 className="text-sm font-bold mb-2">Flux 1 : Recherche unitaire</h3>
          <Table headers={["Étape", "Action", "Détail"]} rows={[
            ["1", "Saisie", "L'utilisateur entre un identifiant (ISIN, Ticker, etc.)"],
            ["2", "Détection", "Le système identifie le format automatiquement"],
            ["3", "Recherche DB", "Vérifie si l'actif existe en base"],
            ["4", "Fallback mock", "Cherche dans le jeu de données embarqué"],
            ["5", "Appel OpenFIGI", "Appelle l'API via Edge Function"],
            ["6", "Scoring", "Sélectionne le meilleur résultat"],
            ["7", "Persistance", "Sauvegarde en DB (upsert sur ISIN)"],
            ["8", "Affichage", "Affiche l'actif enrichi"],
          ]} />
          <h3 className="text-sm font-bold mb-2 mt-4">Flux 2 : Import par pays</h3>
          <Table headers={["Étape", "Action", "Détail"]} rows={[
            ["1", "Sélection", "L'utilisateur choisit un pays"],
            ["2", "Résolution", "Identifie tous les codes boursiers du pays"],
            ["3", "Requêtes", "Interroge chaque bourse avec pagination profonde"],
            ["4", "Dédoublonnage", "Élimine les doublons par FIGI"],
            ["5", "MIC fallback", "Déduit le MIC si absent"],
            ["6", "Persistance", "Insère en base (upsert)"],
            ["7", "Notification", "Alerte les autres utilisateurs connectés"],
          ]} />
          <h3 className="text-sm font-bold mb-2 mt-4">Flux 3 : Temps réel</h3>
          <Table headers={["Étape", "Action", "Détail"]} rows={[
            ["1", "Connexion WebSocket", "Canal Realtime ouvert au chargement"],
            ["2-4", "Écoute INSERT/UPDATE/DELETE", "Le canal écoute tous les événements"],
            ["5", "Mise à jour UI", "Tableau mis à jour sans rechargement"],
            ["6", "Notification", "Toast si l'auteur est un autre utilisateur"],
          ]} />
        </Section>

        {/* 7. API OpenFIGI */}
        <Section title="7. API OpenFIGI — Référence">
          <Table headers={["Propriété", "Valeur"]} rows={[
            ["URL de base", "https://api.openfigi.com/v3"],
            ["Authentification", "Optionnelle (X-OPENFIGI-APIKEY header)"],
            ["Limite sans clé", "25 requêtes/minute, 10 jobs/requête"],
            ["Limite avec clé", "250 requêtes/minute, 100 jobs/requête"],
          ]} />
          <h3 className="text-sm font-bold mb-2 mt-4">Mapping Exchange → MIC (Fallback)</h3>
          <Table headers={["Code Bourse", "MIC", "Place boursière"]} rows={[
            ["UN", "XNYS", "New York Stock Exchange"],
            ["UW", "XNAS", "NASDAQ"],
            ["LN", "XLON", "London Stock Exchange"],
            ["FP", "XPAR", "Euronext Paris"],
            ["PA", "XPAR", "Euronext Paris (alt)"],
            ["GR", "XFRA", "Frankfurt Stock Exchange"],
            ["JT", "XTKS", "Tokyo Stock Exchange"],
            ["HK", "XHKG", "Hong Kong Stock Exchange"],
            ["SS", "XSHG", "Shanghai Stock Exchange"],
            ["CT", "XTSE", "Toronto Stock Exchange"],
            ["AT", "XASX", "Australian Securities Exchange"],
            ["IM", "XMIL", "Borsa Italiana"],
            ["SM", "XMAD", "Bolsa de Madrid"],
            ["NA", "XAMS", "Euronext Amsterdam"],
            ["VX", "XSWX", "SIX Swiss Exchange"],
            ["SP", "XSES", "Singapore Exchange"],
            ["IN", "XNSE", "National Stock Exchange India"],
            ["SJ", "XJSE", "Johannesburg Stock Exchange"],
            ["BZ", "BVMF", "B3 São Paulo"],
            ["KS", "XKRX", "Korea Exchange"],
            ["TT", "XTAI", "Taiwan Stock Exchange"],
            ["MM", "XMEX", "Bolsa Mexicana"],
            ["MP", "XMAU", "Stock Exchange of Mauritius"],
          ]} />
        </Section>

        {/* 8. Glossary */}
        <Section title="8. Glossaire — Termes clés">
          <Table headers={["Terme", "Abrév.", "Définition"]} rows={[
            ["International Securities Identification Number", "ISIN", "Code unique de 12 caractères identifiant un titre financier mondial. Format: 2 lettres pays + 9 alphanum + 1 contrôle. Ex: US0378331005"],
            ["Financial Instrument Global Identifier", "FIGI", "Identifiant global de 12 caractères créé par Bloomberg. Format: BBG + 9 caractères. Ex: BBG000B9XRY4"],
            ["Composite FIGI", "ACF", "Version agrégée du FIGI regroupant un instrument coté sur plusieurs bourses sous un seul identifiant"],
            ["Reuters Instrument Code", "RIC", "Code Refinitiv (ex-Thomson Reuters) identifiant un instrument sur une bourse. Format: TICKER.EXCHCODE. Ex: AAPL.UW"],
            ["Market Identifier Code", "MIC", "Code ISO 10383 de 4 caractères pour une place boursière. Ex: XPAR, XNYS, XNAS"],
            ["CUSIP", "CUSIP", "Code de 9 caractères pour les titres en Amérique du Nord. Ex: 037833100 (Apple)"],
            ["SEDOL", "SEDOL", "Code de 7 caractères de la London Stock Exchange pour les titres UK/Irlande"],
            ["Ticker / Symbol", "Ticker", "Abréviation alphabétique d'un titre coté. Ex: AAPL, MSFT, BNP"],
            ["Exchange Code", "exchCode", "Code court Bloomberg pour une bourse. Ex: UN=NYSE, FP=Euronext Paris"],
            ["Row-Level Security", "RLS", "Mécanisme PostgreSQL restreignant l'accès aux lignes selon des règles"],
            ["Edge Function", "EF", "Fonction serverless (Deno) servant de proxy sécurisé vers les APIs externes"],
            ["Realtime", "—", "WebSocket pour synchronisation instantanée sans rechargement"],
            ["Upsert", "—", "INSERT + UPDATE : crée ou met à jour selon l'existence de la ligne"],
            ["SPA", "SPA", "Single Page Application — charge une page HTML et met à jour dynamiquement"],
            ["Common Stock", "—", "Action ordinaire — titre de propriété avec droit de vote et dividendes"],
            ["ETF", "ETF", "Exchange-Traded Fund — fonds indiciel coté répliquant un indice"],
            ["ETP", "ETP", "Exchange-Traded Product — catégorie incluant ETF, ETN et ETC"],
            ["Bloomberg Open Symbology", "BSYM", "Initiative Bloomberg d'identifiants financiers ouverts via OpenFIGI"],
            ["ISO 4217", "—", "Norme des codes devises à 3 lettres (EUR, USD, GBP)"],
            ["ISO 3166-1", "—", "Norme des codes pays à 2 lettres (FR, US, GB)"],
            ["ISO 10383", "—", "Norme des Market Identifier Codes (MIC)"],
          ]} />
        </Section>

        {/* 9. Sectors */}
        <Section title="9. Secteurs disponibles">
          <div className="grid grid-cols-3 gap-x-4 gap-y-0.5 text-xs print:text-[9px]">
            {[
              "Equity", "Common Stock", "Preferred Stock", "Finance", "Banking", "Insurance",
              "Asset Management", "Private Equity", "Venture Capital", "Hedge Fund",
              "Import & Export", "Trade", "Devise / Forex", "Commodities", "ETF", "ETP",
              "Mutual Fund", "Bond / Fixed Income", "Government Bond", "Corporate Bond",
              "Municipal Bond", "Mortgage / MBS", "Derivatives", "Options", "Futures",
              "Structured Products", "Crypto / Digital Assets", "Real Estate / REIT",
              "Technology", "Healthcare / Pharma", "Energy", "Utilities", "Industrials",
              "Consumer Goods", "Consumer Services", "Telecommunications", "Materials",
              "Agriculture", "Transportation", "Aerospace & Defense", "Media & Entertainment",
              "Education", "Index", "Warrant", "Rights"
            ].map((s, i) => (
              <div key={s} className="flex items-center gap-1 py-0.5 border-b border-gray-200">
                <span className="text-gray-400 w-5 text-right">{i + 1}.</span>
                <span>{s}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* 10. Roadmap */}
        <Section title="10. Roadmap — Améliorations futures">
          <Table headers={["Priorité", "Fonctionnalité", "Description", "Complexité"]} rows={[
            ["🔴 Haute", "Landing page publique", "Page marketing avec CTA inscription", "Moyenne"],
            ["🔴 Haute", "Dashboard analytique", "Graphiques par pays, secteur, devise", "Moyenne"],
            ["🔴 Haute", "Gestion des erreurs", "Messages clairs, retries, état API", "Faible"],
            ["🟡 Moyenne", "Prix en temps réel", "API de prix (Alpha Vantage, Yahoo Finance)", "Haute"],
            ["🟡 Moyenne", "Export PDF", "Rapports PDF professionnels", "Moyenne"],
            ["🟡 Moyenne", "Rôles utilisateurs", "Admin, analyste, lecteur", "Haute"],
            ["🟡 Moyenne", "Import fichier CSV/Excel", "Upload fichier pour enrichissement masse", "Moyenne"],
            ["🟢 Basse", "API REST publique", "Endpoint pour intégration tierce", "Haute"],
            ["🟢 Basse", "Historique modifications", "Audit trail des changements", "Moyenne"],
            ["🟢 Basse", "Multi-langue", "Interface FR, EN, ES", "Faible"],
          ]} />
        </Section>

        {/* Footer */}
        <div className="mt-12 pt-4 border-t-2 border-black text-center text-xs text-gray-500 print:mt-6">
          <p className="font-bold text-black mb-1">DATA ENRICHER FINANCIER — Cahier de Projet v4.2</p>
          <p>Document généré le {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
          <p>© 2026 — Tous droits réservés</p>
        </div>
      </div>
    </div>
  );
}

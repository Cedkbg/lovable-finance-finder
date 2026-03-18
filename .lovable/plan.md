

## Plan : Bouton de téléchargement du Cahier de Projet Excel

Le fichier `src/lib/generate-project-doc.ts` contient déjà un cahier de projet Excel très complet avec 10 onglets (Vue d'ensemble, Fonctionnalités, Architecture, Base de données, Sécurité, Flux de données, API OpenFIGI, Glossaire, Secteurs, Roadmap). Il inclut les définitions de tous les termes clés (ISIN, FIGI, MIC, RIC, etc.).

### Ce que je vais faire

1. **Ajouter un bouton "Télécharger le Cahier de Projet"** sur la page d'accueil (`src/pages/Index.tsx`) — un petit bouton discret qui appelle `generateProjectDocument()` pour télécharger le fichier Excel directement.

2. **Mettre à jour la version à v4.3** dans le fichier `generate-project-doc.ts` pour refléter l'état actuel du logiciel.

Le fichier Excel généré contiendra **10 onglets** :
- Vue d'ensemble du projet
- Catalogue des 28 fonctionnalités
- Architecture technique complète
- Schéma base de données (4 tables détaillées)
- Politiques de sécurité RLS
- Flux de données (3 flux détaillés)
- Documentation API OpenFIGI avec mapping Exchange→MIC
- Glossaire de 21 termes clés financiers
- Liste des 45 secteurs disponibles
- Roadmap des améliorations futures


# Guide d'utilisation - Paiements groupés par agent

## Fonctionnalité implémentée

La fonctionnalité de **paiements groupés** permet aux agents de recouvrement de traiter plusieurs paiements de clients en une seule opération, pour un mois donné.

## Comment utiliser

### 1. Accès à la fonctionnalité

1. Aller dans la page **Recouvrement** (`/recouvrement`)
2. Cliquer sur **"Détails"** d'un agent pour accéder à son tableau de bord
3. Dans l'onglet **"Clients"**, vous verrez une nouvelle section **"Paiements groupés"**

### 2. Types de paiements groupés disponibles

- **Paiement Locations** : Pour les loyers de location
- **Paiement Droits Terre** : Pour les droits de terre des souscriptions

### 3. Processus de paiement groupé

1. **Sélection du type** : Cliquer sur le bouton correspondant au type de paiement souhaité
2. **Sélection des clients** : 
   - Cocher les clients pour lesquels vous voulez effectuer le paiement
   - Le montant par défaut est le montant restant à payer
   - Vous pouvez modifier le montant pour chaque client si nécessaire
3. **Configuration du paiement** :
   - Date de paiement
   - Mode de paiement (Espèces, Virement, Chèque, Mobile Money)
   - Référence (optionnelle)
4. **Validation** : Cliquer sur "Effectuer les paiements"

### 4. Fonctionnalités de sécurité

- **Validation des montants** : Impossible de payer plus que le montant restant
- **Vérification des modes de paiement** : Obligatoire avant validation
- **Gestion des erreurs** : Si un paiement échoue, les autres continuent
- **Audit automatique** : Tous les paiements sont tracés dans les logs d'audit

### 5. Avantages

- **Gain de temps** : Traiter plusieurs paiements en une seule opération
- **Réduction des erreurs** : Interface guidée avec validation
- **Traçabilité** : Chaque paiement est enregistré individuellement
- **Flexibilité** : Possibilité de modifier les montants par client
- **Intégration** : Utilise les fonctions existantes de paiement

## Architecture technique

### Composants créés

1. **`GroupedPaymentDialog`** : Dialog principal pour les paiements groupés
2. **Modifications dans `AgentRecoveryDashboard`** : Ajout des boutons et intégration

### Fonctions utilisées

- `pay_location_with_cash()` : Pour les paiements de locations
- `pay_souscription_with_cash()` : Pour les paiements de souscriptions
- `logCreate()` : Pour l'audit des opérations

### Base de données

- Utilise les tables existantes : `paiements_locations`, `paiements_souscriptions`
- Génère automatiquement les reçus via les fonctions RPC
- Met à jour les soldes de caisse automatiquement

## Tests recommandés

1. **Test de sélection** : Vérifier que seuls les clients avec des dettes sont sélectionnables
2. **Test de montants** : Vérifier la validation des montants (max = montant restant)
3. **Test de paiement** : Effectuer un paiement groupé et vérifier les enregistrements
4. **Test d'erreur** : Simuler une erreur et vérifier la gestion
5. **Test d'audit** : Vérifier que les logs d'audit sont créés

## Notes importantes

- Les paiements groupés respectent les permissions utilisateur existantes
- La fonctionnalité est disponible uniquement pour les agents de recouvrement
- Les reçus sont générés automatiquement pour chaque paiement
- Les soldes de caisse sont mis à jour en temps réel
- La fonctionnalité est compatible avec l'import/export existant

// etika-data-structure/src/lib.rs
//
// Ce module définit les structures de données fondamentales utilisées dans l'écosystème Étika.
// Il sert de base commune pour tous les autres modules du système.

#![cfg_attr(not(feature = "std"), no_std)]

use codec::{Decode, Encode};
use sp_runtime::{
    generic,
    traits::{BlakeTwo256, IdentifyAccount, Verify},
    MultiSignature, RuntimeDebug,
};
use sp_std::prelude::*;
use frame_support::Parameter;
#[cfg(feature = "std")]
use serde::{Deserialize, Serialize};

/// Type de base pour les montants financiers et les soldes dans l'écosystème Étika
pub type Balance = u128;

/// Type pour représenter les moments dans le temps
pub type Moment = u64;

/// Type pour les identifiants de block
pub type BlockNumber = u32;

/// Type pour les hashs
pub type Hash = sp_core::H256;

/// Type pour les signatures
pub type Signature = MultiSignature;

/// Type pour les clés publiques dans Étika
pub type AccountPublic = <Signature as Verify>::Signer;

/// Type pour les identifiants de compte dans Étika
pub type AccountId = <AccountPublic as IdentifyAccount>::AccountId;

/// Entête de block pour la blockchain Étika
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub struct Header {
    pub parent_hash: Hash,
    pub number: BlockNumber,
    pub state_root: Hash,
    pub extrinsics_root: Hash,
    pub digest: generic::Digest,
}

/// Block complet pour la blockchain Étika
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub struct Block {
    pub header: Header,
    pub extrinsics: Vec<u8>,
}

/// Représente l'état d'un token Étika (latent ou activé)
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
#[cfg_attr(feature = "std", derive(Serialize, Deserialize))]
pub enum TokenState {
    /// Token distribué mais pas encore activé
    Latent,
    /// Token activé et utilisable dans l'écosystème
    Active,
    /// Token verrouillé (utilisé dans certains contrats)
    Locked { unlock_time: Moment },
    /// Token brûlé (retiré de la circulation)
    Burned,
}

/// Représente un token Étika avec son état et ses métadonnées
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
#[cfg_attr(feature = "std", derive(Serialize, Deserialize))]
pub struct Token {
    /// Identifiant unique du token
    pub id: [u8; 32],
    /// État actuel du token
    pub state: TokenState,
    /// Propriétaire actuel du token
    pub owner: AccountId,
    /// Moment de création du token
    pub created_at: Moment,
    /// Moment de la dernière mise à jour du token
    pub updated_at: Moment,
    /// Valeur actuelle du token (peut varier selon l'état)
    pub value: Balance,
    /// Historique des transferts (limité aux 5 derniers pour économiser l'espace)
    pub transfer_history: Vec<(AccountId, Moment)>,
}

/// Types d'acteurs dans l'écosystème Étika
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
#[cfg_attr(feature = "std", derive(Serialize, Deserialize))]
pub enum ActorType {
    /// Consommateur final
    Consumer,
    /// Commerçant (vente au détail)
    Merchant,
    /// Fournisseur (B2B)
    Supplier,
    /// Sponsor officiel (sélectionné par enchères)
    Sponsor,
    /// ONG partenaire
    NGO,
    /// Organisme public
    PublicEntity,
    /// Investisseur
    Investor,
}

/// Niveaux d'ancienneté/fidélité dans le système
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, PartialOrd, Ord)]
#[cfg_attr(feature = "std", derive(Serialize, Deserialize))]
pub enum LoyaltyTier {
    Bronze,
    Silver,
    Gold,
    Platinum,
    Diamond,
}

/// Profil d'un acteur dans l'écosystème Étika
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
#[cfg_attr(feature = "std", derive(Serialize, Deserialize))]
pub struct ActorProfile {
    /// Identifiant du compte
    pub account_id: AccountId,
    /// Type d'acteur
    pub actor_type: ActorType,
    /// Nom/Identifiant public
    pub name: Vec<u8>,
    /// Moment de l'inscription
    pub registered_at: Moment,
    /// Niveau de fidélité/ancienneté
    pub loyalty_tier: LoyaltyTier,
    /// Indicateur de participation à l'hébergement de la blockchain
    pub is_hosting_node: bool,
    /// Informations de contact (téléphone, email, etc.)
    pub contact_info: Vec<u8>,
    /// Métadonnées additionnelles (format JSON)
    pub metadata: Vec<u8>,
}

/// Information sur l'épargne d'un consommateur
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
#[cfg_attr(feature = "std", derive(Serialize, Deserialize))]
pub struct ConsumerSavings {
    /// Identifiant du consommateur
    pub consumer_id: AccountId,
    /// Épargne à long terme (80%)
    pub long_term_savings: Balance,
    /// Épargne pour projets personnels (20%)
    pub personal_projects_savings: Balance,
    /// Historique des contributions
    pub contribution_history: Vec<(AccountId, Balance, Moment)>,
    /// Taux de crédit actuel (basé sur l'ancienneté)
    pub current_credit_rate: u32, // En centièmes de pourcentage (e.g., 250 = 2.5%)
}

/// Données d'une transaction avec preuve d'achat (PoP)
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
#[cfg_attr(feature = "std", derive(Serialize, Deserialize))]
pub struct PoPTransaction {
    /// Identifiant unique de la transaction
    pub id: [u8; 32],
    /// Consommateur impliqué
    pub consumer: AccountId,
    /// Commerçant impliqué
    pub merchant: AccountId,
    /// Fournisseurs impliqués (peut être multiple ou vide en cas de vente directe)
    pub suppliers: Vec<AccountId>,
    /// Montant de la transaction financière standard
    pub standard_amount: Balance,
    /// Tokens échangés
    pub tokens_exchanged: Balance,
    /// Épargne générée
    pub savings_generated: Balance,
    /// Horodatage de la transaction
    pub timestamp: Moment,
    /// Hash du ticket de caisse numérique
    pub receipt_hash: [u8; 32],
    /// Signatures des participants
    pub signatures: Vec<(AccountId, Signature)>,
}

/// Données d'une enchère pour sélection des sponsors
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
#[cfg_attr(feature = "std", derive(Serialize, Deserialize))]
pub struct Auction {
    /// Identifiant unique de l'enchère
    pub id: [u8; 32],
    /// Catégorie concernée (secteur d'activité)
    pub category: Vec<u8>,
    /// Moment de début de l'enchère
    pub start_time: Moment,
    /// Moment de fin de l'enchère
    pub end_time: Moment,
    /// Prix de départ
    pub starting_price: Balance,
    /// Enchère minimale
    pub min_bid_increment: Balance,
    /// État de l'enchère
    pub status: AuctionStatus,
    /// Historique des enchères
    pub bid_history: Vec<Bid>,
}

/// État possible d'une enchère
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
#[cfg_attr(feature = "std", derive(Serialize, Deserialize))]
pub enum AuctionStatus {
    /// Enchère en attente de démarrage
    Pending,
    /// Enchère en cours
    Active,
    /// Enchère terminée avec succès
    Completed,
    /// Enchère annulée
    Cancelled,
    /// Échec de l'enchère (pas d'offre supérieure au prix minimum)
    Failed,
}

/// Offre dans une enchère
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
#[cfg_attr(feature = "std", derive(Serialize, Deserialize))]
pub struct Bid {
    /// Identifiant de l'enchérisseur
    pub bidder: AccountId,
    /// Montant de l'enchère
    pub amount: Balance,
    /// Moment de l'enchère
    pub timestamp: Moment,
}

/// Relation commerciale entre un commerçant et un fournisseur
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
#[cfg_attr(feature = "std", derive(Serialize, Deserialize))]
pub struct CommercialRelationship {
    /// Identifiant du commerçant
    pub merchant: AccountId,
    /// Identifiant du fournisseur
    pub supplier: AccountId,
    /// Catégorie de produits/services
    pub category: Vec<u8>,
    /// Conditions de l'affacturage
    pub factoring_conditions: FactoringConditions,
    /// Moment de création de la relation
    pub created_at: Moment,
    /// État de la relation
    pub status: RelationshipStatus,
}

/// Conditions d'affacturage
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
#[cfg_attr(feature = "std", derive(Serialize, Deserialize))]
pub struct FactoringConditions {
    /// Pourcentage du paiement immédiat
    pub immediate_payment_percent: u8,
    /// Délai pour le reste du paiement (en secondes)
    pub remaining_payment_delay: u64,
    /// Taux d'intérêt de l'affacturage
    pub interest_rate: u32, // En centièmes de pourcentage
}

/// État d'une relation commerciale
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
#[cfg_attr(feature = "std", derive(Serialize, Deserialize))]
pub enum RelationshipStatus {
    /// Relation active
    Active,
    /// Relation en attente de validation
    Pending,
    /// Relation suspendue
    Suspended,
    /// Relation terminée
    Terminated,
}

/// Information sur les participants à l'hébergement de la blockchain
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
#[cfg_attr(feature = "std", derive(Serialize, Deserialize))]
pub struct BlockchainHost {
    /// Identifiant du compte
    pub account_id: AccountId,
    /// Type d'acteur
    pub actor_type: ActorType,
    /// Informations sur le nœud
    pub node_info: NodeInfo,
    /// Bonus accumulés pour l'hébergement
    pub hosting_bonus: Balance,
    /// Moment de début d'hébergement
    pub hosting_since: Moment,
}

/// Informations sur un nœud de la blockchain
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
#[cfg_attr(feature = "std", derive(Serialize, Deserialize))]
pub struct NodeInfo {
    /// Identifiant du nœud
    pub node_id: [u8; 32],
    /// Adresse réseau du nœud
    pub network_address: Vec<u8>,
    /// Capacité de stockage allouée (en bytes)
    pub storage_capacity: u64,
    /// Disponibilité historique (pourcentage)
    pub availability_score: u8,
    /// Version du logiciel
    pub software_version: Vec<u8>,
}

/// Ordre sur la place de marché
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
#[cfg_attr(feature = "std", derive(Serialize, Deserialize))]
pub struct MarketOrder {
    /// Identifiant unique de l'ordre
    pub id: [u8; 32],
    /// Créateur de l'ordre
    pub creator: AccountId,
    /// Type d'ordre
    pub order_type: OrderType,
    /// Quantité de tokens
    pub quantity: Balance,
    /// Prix par token
    pub price: Balance,
    /// Moment de création
    pub created_at: Moment,
    /// État de l'ordre
    pub status: OrderStatus,
    /// Expirations (0 = pas d'expiration)
    pub expiration: Moment,
}

/// Type d'ordre sur la place de marché
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
#[cfg_attr(feature = "std", derive(Serialize, Deserialize))]
pub enum OrderType {
    /// Achat de tokens
    Buy,
    /// Vente de tokens
    Sell,
}

/// État d'un ordre sur la place de marché
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
#[cfg_attr(feature = "std", derive(Serialize, Deserialize))]
pub enum OrderStatus {
    /// Ordre actif
    Active,
    /// Ordre partiellement exécuté
    PartiallyFilled,
    /// Ordre complètement exécuté
    Filled,
    /// Ordre annulé
    Cancelled,
    /// Ordre expiré
    Expired,
}

/// Produit financier proposé par le fonds des consommateurs
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
#[cfg_attr(feature = "std", derive(Serialize, Deserialize))]
pub struct FinancialProduct {
    /// Identifiant unique du produit
    pub id: [u8; 32],
    /// Nom du produit
    pub name: Vec<u8>,
    /// Description détaillée
    pub description: Vec<u8>,
    /// Type de produit
    pub product_type: ProductType,
    /// Rendement anticipé (en centièmes de pourcentage)
    pub expected_yield: u32,
    /// Durée minimale d'investissement (en secondes)
    pub min_investment_duration: u64,
    /// Montant minimum d'investissement
    pub min_investment_amount: Balance,
    /// Montant total actuellement investi
    pub total_invested: Balance,
    /// Risque associé (1-5)
    pub risk_level: u8,
    /// Moment de création
    pub created_at: Moment,
    /// État du produit
    pub status: ProductStatus,
}

/// Type de produit financier
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
#[cfg_attr(feature = "std", derive(Serialize, Deserialize))]
pub enum ProductType {
    /// Épargne garantie
    GuaranteedSavings,
    /// Prêt aux entreprises
    BusinessLoan,
    /// Produit d'investissement
    Investment,
    /// Autre
    Other,
}

/// État d'un produit financier
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
#[cfg_attr(feature = "std", derive(Serialize, Deserialize))]
pub enum ProductStatus {
    /// En cours de souscription
    Open,
    /// Fermé aux nouvelles souscriptions
    Closed,
    /// Arrivé à maturité
    Matured,
    /// Liquidé avant terme
    EarlyTerminated,
}

/// Traits pour les modules du système Étika
pub trait TokenSystem: Sized {
    fn distribute_tokens(to: &AccountId, amount: Balance) -> Result<(), &'static str>;
    fn activate_tokens(from: &AccountId, amount: Balance) -> Result<(), &'static str>;
    fn burn_tokens(from: &AccountId, amount: Balance) -> Result<(), &'static str>;
    fn transfer_tokens(from: &AccountId, to: &AccountId, amount: Balance) -> Result<(), &'static str>;
}

pub trait ConsumerFund: Sized {
    fn add_savings(consumer: &AccountId, amount: Balance) -> Result<(), &'static str>;
    fn get_savings_balance(consumer: &AccountId) -> Result<(Balance, Balance), &'static str>;
    fn calculate_credit_rate(consumer: &AccountId) -> Result<u32, &'static str>;
}

pub trait AuctionSystem: Sized {
    fn create_auction(category: Vec<u8>, start_time: Moment, duration: u64, starting_price: Balance) -> Result<[u8; 32], &'static str>;
    fn place_bid(auction_id: [u8; 32], bidder: &AccountId, amount: Balance) -> Result<(), &'static str>;
    fn finalize_auction(auction_id: [u8; 32]) -> Result<Option<AccountId>, &'static str>;
}

pub trait FactoringSystem: Sized {
    fn register_relationship(merchant: &AccountId, supplier: &AccountId, conditions: FactoringConditions) -> Result<(), &'static str>;
    fn process_factoring_payment(pop_transaction: &PoPTransaction) -> Result<(), &'static str>;
    fn get_factoring_conditions(merchant: &AccountId, supplier: &AccountId) -> Result<FactoringConditions, &'static str>;
}

pub trait Marketplace: Sized {
    fn create_order(creator: &AccountId, order_type: OrderType, quantity: Balance, price: Balance, expiration: Moment) -> Result<[u8; 32], &'static str>;
    fn cancel_order(order_id: [u8; 32], caller: &AccountId) -> Result<(), &'static str>;
    fn match_orders() -> Result<(), &'static str>;
}

pub trait PoPConsensus: Sized {
    fn validate_transaction(transaction: &PoPTransaction) -> Result<(), &'static str>;
    fn finalize_transaction(transaction: &PoPTransaction) -> Result<(), &'static str>;
    fn get_transaction(id: [u8; 32]) -> Result<PoPTransaction, &'static str>;
}

/// Tests unitaires pour les structures de données
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_token_state_transitions() {
        // Cette fonction teste les transitions d'état valides pour un token
        
        // Un token commence en état latent
        let mut token_state = TokenState::Latent;
        
        // Il peut être activé
        token_state = TokenState::Active;
        assert!(matches!(token_state, TokenState::Active));
        
        // Il peut être verrouillé avec un temps de déverrouillage
        let unlock_time = 100000;
        token_state = TokenState::Locked { unlock_time };
        if let TokenState::Locked { unlock_time: time } = token_state {
            assert_eq!(time, unlock_time);
        } else {
            panic!("Expected Locked state");
        }
        
        // Il peut être brûlé (fin de vie)
        token_state = TokenState::Burned;
        assert!(matches!(token_state, TokenState::Burned));
    }
    
    #[test]
    fn test_loyalty_tier_comparison() {
        // Cette fonction teste la comparaison des niveaux de fidélité
        
        assert!(LoyaltyTier::Bronze < LoyaltyTier::Silver);
        assert!(LoyaltyTier::Silver < LoyaltyTier::Gold);
        assert!(LoyaltyTier::Gold < LoyaltyTier::Platinum);
        assert!(LoyaltyTier::Platinum < LoyaltyTier::Diamond);
        
        assert!(LoyaltyTier::Diamond > LoyaltyTier::Bronze);
    }
}

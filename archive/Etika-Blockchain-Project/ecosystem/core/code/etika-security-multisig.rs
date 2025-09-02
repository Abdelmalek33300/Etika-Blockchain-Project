// etika-blockchain-core/src/multisig.rs

use codec::{Decode, Encode};
use frame_support::{
    decl_error, decl_event, decl_module, decl_storage, dispatch::DispatchResult,
    ensure, traits::Get, Parameter,
};
use frame_system::{self as system, ensure_signed};
use sp_runtime::{
    traits::{AtLeast32BitUnsigned, CheckedAdd, CheckedSub, Member, Zero, SaturatedConversion},
    DispatchError, MultiSignature, RuntimeDebug,
};
use sp_std::prelude::*;

/// Structure pour une transaction multisignature
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub struct MultisigTransaction<T: Config> {
    /// Identifiant unique de la transaction
    pub id: [u8; 32],
    /// Compte qui a proposé la transaction
    pub proposer: T::AccountId,
    /// Comptes requis pour signer
    pub signatories: Vec<T::AccountId>,
    /// Seuil de signatures requis
    pub threshold: u32,
    /// Signatures collectées jusqu'à présent
    pub signatures: Vec<(T::AccountId, MultiSignature)>,
    /// Données de la transaction à exécuter
    pub call_data: Vec<u8>,
    /// Moment d'expiration
    pub expiry: T::BlockNumber,
    /// Statut de la transaction
    pub status: MultisigStatus,
}

/// États possibles d'une transaction multisignature
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub enum MultisigStatus {
    /// En attente de signatures
    Pending,
    /// Exécutée avec succès
    Executed,
    /// Annulée
    Cancelled,
    /// Expirée
    Expired,
}

/// Implémentation des fonctions de multisignature
impl<T: Config> Module<T> {
    /// Créer une nouvelle proposition multisignature
    pub fn propose_multisig(
        proposer: T::AccountId,
        signatories: Vec<T::AccountId>,
        threshold: u32,
        call_data: Vec<u8>,
        expiry_blocks: T::BlockNumber,
    ) -> Result<[u8; 32], DispatchError> {
        // Validation de base
        ensure!(
            signatories.len() >= threshold as usize,
            Error::<T>::InvalidThreshold
        );
        ensure!(threshold >= 2, Error::<T>::ThresholdTooLow);
        
        // Générer ID unique
        let id = Self::generate_multisig_id(&proposer, &signatories, &call_data);
        
        // Calculer expiration
        let current_block = <frame_system::Module<T>>::block_number();
        let expiry = current_block.saturating_add(expiry_blocks);
        
        // Créer la transaction
        let transaction = MultisigTransaction {
            id,
            proposer: proposer.clone(),
            signatories,
            threshold,
            signatures: vec![(proposer, MultiSignature::default())],
            call_data,
            expiry,
            status: MultisigStatus::Pending,
        };
        
        // Stocker la transaction
        <PendingMultisigs<T>>::insert(id, transaction);
        
        Ok(id)
    }
    
    /// Approuver une transaction multisignature
    pub fn approve_multisig(
        approver: T::AccountId,
        multisig_id: [u8; 32],
        signature: MultiSignature,
    ) -> DispatchResult {
        // Récupérer la transaction
        let mut transaction = <PendingMultisigs<T>>::get(multisig_id)
            .ok_or(Error::<T>::MultisigNotFound)?;
        
        // Vérifier que la transaction est toujours en attente
        ensure!(
            transaction.status == MultisigStatus::Pending,
            Error::<T>::InvalidMultisigStatus
        );
        
        // Vérifier que l'approbateur est un signataire autorisé
        ensure!(
            transaction.signatories.contains(&approver),
            Error::<T>::NotASignatory
        );
        
        // Vérifier que l'approbateur n'a pas déjà signé
        ensure!(
            !transaction.signatures.iter().any(|(signer, _)| *signer == approver),
            Error::<T>::AlreadySigned
        );
        
        // Ajouter la signature
        transaction.signatures.push((approver, signature));
        
        // Si nous avons atteint le seuil, exécuter la transaction
        if transaction.signatures.len() >= transaction.threshold as usize {
            // Exécuter la transaction (logique d'exécution dépend du type)
            Self::execute_multisig_transaction(&transaction)?;
            transaction.status = MultisigStatus::Executed;
        }
        
        // Mettre à jour la transaction
        <PendingMultisigs<T>>::insert(multisig_id, transaction);
        
        Ok(())
    }
    
    /// Exécution d'une transaction multisignature
    fn execute_multisig_transaction(transaction: &MultisigTransaction<T>) -> DispatchResult {
        // Logique d'exécution dépendant du type de transaction
        // Ceci est simplifié; en réalité, il faudrait décoder et dispatcher l'appel
        
        // Par exemple, pour un transfert de fonds:
        // let call = Call::decode(&mut &transaction.call_data[..])
        //     .map_err(|_| Error::<T>::CallDecodeFailed)?;
        // call.dispatch(Origin::signed(transaction.proposer.clone()));
        
        Ok(())
    }
    
    /// Génération d'un ID unique pour une transaction multisignature
    fn generate_multisig_id(
        proposer: &T::AccountId, 
        signatories: &[T::AccountId], 
        call_data: &[u8]
    ) -> [u8; 32] {
        use sp_runtime::traits::Hash;
        
        let mut data = Vec::new();
        data.extend_from_slice(&proposer.encode());
        
        for signatory in signatories {
            data.extend_from_slice(&signatory.encode());
        }
        
        data.extend_from_slice(call_data);
        data.extend_from_slice(&<frame_system::Module<T>>::block_number().encode());
        
        let hash = sp_io::hashing::blake2_256(&data);
        hash
    }
    
    /// Nettoyage des transactions multisignature expirées
    pub fn clean_expired_multisigs(current_block: T::BlockNumber) {
        for (id, transaction) in <PendingMultisigs<T>>::iter() {
            if transaction.status == MultisigStatus::Pending && current_block > transaction.expiry {
                // Marquer comme expirée
                let mut updated_tx = transaction;
                updated_tx.status = MultisigStatus::Expired;
                <PendingMultisigs<T>>::insert(id, updated_tx);
                
                // Émettre un événement
                Self::deposit_event(RawEvent::MultisigExpired(id));
            }
        }
    }
    
    /// Annulation d'une transaction multisignature par le proposant
    pub fn cancel_multisig(
        caller: T::AccountId,
        multisig_id: [u8; 32],
    ) -> DispatchResult {
        let mut transaction = <PendingMultisigs<T>>::get(multisig_id)
            .ok_or(Error::<T>::MultisigNotFound)?;
        
        // Vérifier que l'appelant est le proposant
        ensure!(
            transaction.proposer == caller,
            Error::<T>::NotProposer
        );
        
        // Vérifier que la transaction est toujours en attente
        ensure!(
            transaction.status == MultisigStatus::Pending,
            Error::<T>::InvalidMultisigStatus
        );
        
        // Marquer comme annulée
        transaction.status = MultisigStatus::Cancelled;
        <PendingMultisigs<T>>::insert(multisig_id, transaction);
        
        // Émettre un événement
        Self::deposit_event(RawEvent::MultisigCancelled(multisig_id, caller));
        
        Ok(())
    }
}

// Storage declarations for multisignature system
decl_storage! {
    trait Store for Module<T: Config> as EtikaMultisig {
        /// Transactions multisignature en attente
        PendingMultisigs get(fn pending_multisigs): map hasher(blake2_128_concat) [u8; 32] => Option<MultisigTransaction<T>>;
        
        /// Transactions multisignature exécutées
        ExecutedMultisigs get(fn executed_multisigs): map hasher(blake2_128_concat) [u8; 32] => Option<MultisigTransaction<T>>;
    }
}

// Events for multisignature system
decl_event!(
    pub enum Event<T> where
        AccountId = <T as frame_system::Config>::AccountId,
        BlockNumber = <T as frame_system::Config>::BlockNumber,
    {
        /// Une transaction multisignature a été proposée
        /// [multisig_id, proposer, threshold, expiry]
        MultisigProposed([u8; 32], AccountId, u32, BlockNumber),
        
        /// Une transaction multisignature a reçu une signature
        /// [multisig_id, signatory, current_signatures, threshold]
        MultisigSigned([u8; 32], AccountId, u32, u32),
        
        /// Une transaction multisignature a été exécutée
        /// [multisig_id]
        MultisigExecuted([u8; 32]),
        
        /// Une transaction multisignature a été annulée
        /// [multisig_id, proposer]
        MultisigCancelled([u8; 32], AccountId),
        
        /// Une transaction multisignature a expiré
        /// [multisig_id]
        MultisigExpired([u8; 32]),
    }
);

// Errors for multisignature system
decl_error! {
    pub enum Error for Module<T: Config> {
        /// Transaction multisignature non trouvée
        MultisigNotFound,
        
        /// Seuil invalide (doit être >= 2)
        InvalidThreshold,
        
        /// Seuil trop bas pour la sécurité
        ThresholdTooLow,
        
        /// Statut de transaction invalide
        InvalidMultisigStatus,
        
        /// Le compte n'est pas un signataire autorisé
        NotASignatory,
        
        /// Le compte a déjà signé
        AlreadySigned,
        
        /// Erreur de décodage de l'appel
        CallDecodeFailed,
        
        /// Le compte n'est pas le proposant
        NotProposer,
    }
}

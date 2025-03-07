// etika-security/src/monitoring.rs

use codec::{Decode, Encode};
use frame_support::{
    decl_error, decl_event, decl_module, decl_storage, dispatch::DispatchResult,
    ensure, traits::Get, Parameter,
};
use frame_system::{self as system, ensure_signed};
use sp_runtime::{
    traits::{AtLeast32BitUnsigned, CheckedAdd, Member, Zero},
    DispatchError, RuntimeDebug,
};
use sp_std::prelude::*;
use etika_data_structure::Balance;

/// Type d'alerte de sécurité
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub enum AlertType {
    /// Activité suspecte d'un compte
    SuspiciousAccountActivity,
    /// Transaction de grande valeur
    HighValueTransaction,
    /// Tentatives d'accès multiples échouées
    MultipleFailedAccess,
    /// Activité hors des heures normales
    OutOfHoursActivity
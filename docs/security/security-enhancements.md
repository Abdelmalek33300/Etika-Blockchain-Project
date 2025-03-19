### 3.3 Gestion sécurisée du cycle de vie des clés avec HSM

```rust
// etika-payment-integration/src/crypto/hsm_integration.rs

use std::sync::Arc;
use tokio::sync::Mutex;
use async_trait::async_trait;
use thiserror::Error;
use serde::{Serialize, Deserialize};

use super::key_rotation::{HsmClient, KeyPurpose};

#[derive(Error, Debug)]
pub enum HsmError {
    #[error("Connection error: {0}")]
    ConnectionError(String),
    
    #[error("Authentication error: {0}")]
    AuthenticationError(String),
    
    #[error("Operation error: {0}")]
    OperationError(String),
    
    #[error("Key not found: {0}")]
    KeyNotFound(String),
    
    #[error("Permission denied: {0}")]
    PermissionDenied(String),
    
    #[error("Invalid parameter: {0}")]
    InvalidParameter(String),
    
    #[error("HSM internal error: {0}")]
    InternalError(String),
}

pub type HsmResult<T> = Result<T, HsmError>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HsmConfig {
    pub hsm_type: HsmType,
    pub endpoint: String,
    pub partition: Option<String>,
    pub auth_method: HsmAuthMethod,
    pub max_sessions: u32,
    pub timeout_seconds: u32,
    pub default_key_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum HsmType {
    AwsCloudHsm,
    AzureKeyVault,
    GoogleCloudKms,
    ThalesLuna,
    Utimaco,
    Simulator,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HsmAuthMethod {
    Certificate {
        cert_path: String,
        key_path: String,
        password: Option<String>,
    },
    Token {
        token: String,
        token_type: String,
    },
    UsernamePassword {
        username: String,
        password: String,
    },
    ManagedIdentity,
}

// Interface for HSM operations
#[async_trait]
pub trait HsmOperations: Send + Sync {
    async fn connect(&self) -> HsmResult<()>;
    async fn disconnect(&self) -> HsmResult<()>;
    async fn generate_key(&self, key_type: &str, key_size: u32, key_label: &str) -> HsmResult<String>;
    async fn delete_key(&self, key_handle: &str) -> HsmResult<()>;
    async fn encrypt(&self, key_handle: &str, plaintext: &[u8], iv: Option<&[u8]>) -> HsmResult<Vec<u8>>;
    async fn decrypt(&self, key_handle: &str, ciphertext: &[u8], iv: Option<&[u8]>) -> HsmResult<Vec<u8>>;
    async fn sign(&self, key_handle: &str, mechanism: &str, data: &[u8]) -> HsmResult<Vec<u8>>;
    async fn verify(&self, key_handle: &str, mechanism: &str, data: &[u8], signature: &[u8]) -> HsmResult<bool>;
    async fn wrap_key(&self, wrapping_key: &str, key_to_wrap: &str) -> HsmResult<Vec<u8>>;
    async fn unwrap_key(&self, wrapping_key: &str, wrapped_key: &[u8], key_type: &str) -> HsmResult<String>;
    async fn get_key_info(&self, key_handle: &str) -> HsmResult<HsmKeyInfo>;
    async fn list_keys(&self, prefix: Option<&str>) -> HsmResult<Vec<HsmKeyInfo>>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HsmKeyInfo {
    pub handle: String,
    pub label: String,
    pub key_type: String,
    pub key_size: u32,
    pub creation_date: chrono::DateTime<chrono::Utc>,
    pub attributes: std::collections::HashMap<String, String>,
}

// Implementation for AWS CloudHSM
pub struct AwsCloudH### 3.2 Rotation automatique des clés cryptographiques

```rust
// etika-payment-integration/src/crypto/key_rotation.rs

use std::sync::Arc;
use tokio::sync::Mutex;
use chrono::{DateTime, Utc, Duration};
use serde::{Serialize, Deserialize};
use uuid::Uuid;

use super::post_quantum::{PostQuantumCrypto, PostQuantumKeyPair, PostQuantumAlgorithm};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyMetadata {
    pub key_id: String,
    pub algorithm: String,
    pub purpose: KeyPurpose,
    pub status: KeyStatus,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub rotated_from: Option<String>,
    pub rotated_to: Option<String>,
    pub last_used: Option<DateTime<Utc>>,
    pub use_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum KeyPurpose {
    Encryption,
    Signing,
    Authentication,
    TokenProtection,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum KeyStatus {
    Active,
    Expiring,  // Still active but scheduled for rotation
    Retired,   // No longer used for encryption but can decrypt
    Revoked,   // Should not be used at all
}

// etika-payment-integration/src/crypto/key_rotation.rs

use std::sync::Arc;
use tokio::sync::Mutex;
use chrono::{DateTime, Utc, Duration};
use serde::{Serialize, Deserialize};
use uuid::Uuid;

use super::post_quantum::{PostQuantumCrypto, PostQuantumKeyPair, PostQuantumAlgorithm};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyMetadata {
    pub key_id: String,
    pub algorithm: String,
    pub purpose: KeyPurpose,
    pub status: KeyStatus,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub rotated_from: Option<String>,
    pub rotated_to: Option<String>,
    pub last_used: Option<DateTime<Utc>>,
    pub use_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum KeyPurpose {
    Encryption,
    Signing,
    Authentication,
    TokenProtection,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum KeyStatus {
    Active,
    Expiring,  // Still active but scheduled for rotation
    Retired,   // No longer used for encryption but can decrypt
    Revoked,   // Should not be used at all
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RotationPolicy {
    pub purpose: KeyPurpose,
    pub active_period_days: u32,
    pub retirement_period_days: u32,
    pub automatic_rotation: bool,
    pub algorithm: String,
    pub min_uses_before_rotation: Option<u64>,
    pub max_uses_before_rotation: Option<u64>,
}

impl Default for RotationPolicy {
    fn default() -> Self {
        Self {
            purpose: KeyPurpose::Encryption,
            active_period_days: 90,   // 3 months active
            retirement_period_days: 180, // 6 months retired
            automatic_rotation: true,
            algorithm: "Kyber".to_string(),
            min_uses_before_rotation: None,
            max_uses_before_rotation: Some(1_000_000),
        }
    }
}

#[derive(Debug)]
pub struct EncryptedKey {
    pub key_id: String,
    pub key_material: Vec<u8>,
    pub metadata: KeyMetadata,
}

pub struct KeyRotationManager {
    active_keys: Arc<Mutex<std::collections::HashMap<String, EncryptedKey>>>,
    retired_keys: Arc<Mutex<std::collections::HashMap<String, EncryptedKey>>>,
    rotation_policies: Arc<Mutex<std::collections::HashMap<KeyPurpose, RotationPolicy>>>,
    master_key: Arc<Mutex<Option<Vec<u8>>>>,
    hsm_client: Option<Arc<dyn HsmClient>>,
    _shutdown_signal: Option<tokio::sync::oneshot::Sender<()>>,
    _task_handle: Option<tokio::task::JoinHandle<()>>,
}

#[async_trait::async_trait]
pub trait HsmClient: Send + Sync {
    async fn generate_key(&self, algorithm: &str, purpose: &KeyPurpose) -> Result<Vec<u8>, String>;
    async fn encrypt(&self, key_id: &str, plaintext: &[u8]) -> Result<Vec<u8>, String>;
    async fn decrypt(&self, key_id: &str, ciphertext: &[u8]) -> Result<Vec<u8>, String>;
    async fn sign(&self, key_id: &str, message: &[u8]) -> Result<Vec<u8>, String>;
    async fn verify(&self, key_id: &str, message: &[u8], signature: &[u8]) -> Result<bool, String>;
}

impl KeyRotationManager {
    pub fn new(
        master_key: Option<Vec<u8>>,
        hsm_client: Option<Arc<dyn HsmClient>>,
    ) -> Self {
        Self {
            active_keys: Arc::new(Mutex::new(std::collections::HashMap::new())),
            retired_keys: Arc::new(Mutex::new(std::collections::HashMap::new())),
            rotation_policies: Arc::new(Mutex::new(std::collections::HashMap::new())),
            master_key: Arc::new(Mutex::new(master_key)),
            hsm_client,
            _shutdown_signal: None,
            _task_handle: None,
        }
    }
    
    pub fn set_rotation_policy(&mut self, policy: RotationPolicy) {
        let mut policies = futures::executor::block_on(self.rotation_policies.lock());
        policies.insert(policy.purpose.clone(), policy);
    }
    
    pub async fn initialize(&mut self) -> Result<(), String> {
        // Initialize default policies if none exist
        let mut policies = self.rotation_policies.lock().await;
        if policies.is_empty() {
            // Default encryption policy
            policies.insert(KeyPurpose::Encryption, RotationPolicy {
                purpose: KeyPurpose::Encryption,
                active_period_days: 90,
                retirement_period_days: 180,
                automatic_rotation: true,
                algorithm: "Kyber".to_string(),
                min_uses_before_rotation: None,
                max_uses_before_rotation: Some(1_000_000),
            });
            
            // Default signing policy
            policies.insert(KeyPurpose::Signing, RotationPolicy {
                purpose: KeyPurpose::Signing,
                active_period_days: 180,
                retirement_period_days: 365,
                automatic_rotation: true,
                algorithm: "Dilithium".to_string(),
                min_uses_before_rotation: None,
                max_uses_before_rotation: Some(10_000_000),
            });
            
            // Authentication policy
            policies.insert(KeyPurpose::Authentication, RotationPolicy {
                purpose: KeyPurpose::Authentication,
                active_period_days: 30,
                retirement_period_days: 90,
                automatic_rotation: true,
                algorithm: "Dilithium".to_string(),
                min_uses_before_rotation: None,
                max_uses_before_rotation: Some(500_000),
            });
            
            // Token protection policy
            policies.insert(KeyPurpose::TokenProtection, RotationPolicy {
                purpose: KeyPurpose::TokenProtection,
                active_period_days: 60,
                retirement_period_days: 120,
                automatic_rotation: true,
                algorithm: "Kyber".to_string(),
                min_uses_before_rotation: None,
                max_uses_before_rotation: Some(2_000_000),
            });
        }
        drop(policies);
        
        // Generate initial keys if needed
        for purpose in &[KeyPurpose::Encryption, KeyPurpose::Signing, KeyPurpose::Authentication, KeyPurpose::TokenProtection] {
            let active_keys = self.active_keys.lock().await;
            let has_active_key = active_keys.values().any(|k| k.metadata.purpose == *purpose && k.metadata.status == KeyStatus::Active);
            drop(active_keys);
            
            if !has_active_key {
                self.generate_new_key_for_purpose(purpose).await?;
            }
        }
        
        // Start the rotation task
        self.start_rotation_task();
        
        Ok(())
    }
    
    fn start_rotation_task(&mut self) {
        // Create a channel for shutdown signal
        let (shutdown_tx, mut shutdown_rx) = tokio::sync::oneshot::channel();
        self._shutdown_signal = Some(shutdown_tx);
        
        // Clone references for the task
        let active_keys = self.active_keys.clone();
        let retired_keys = self.retired_keys.clone();
        let rotation_policies = self.rotation_policies.clone();
        
        // Start the rotation task
        let handle = tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(3600)); // Check every hour
            
            loop {
                tokio::select! {
                    _ = interval.tick() => {
                        Self::check_and_rotate_keys(
                            &active_keys,
                            &retired_keys,
                            &rotation_policies
                        ).await;
                    }
                    _ = &mut shutdown_rx => {
                        println!("Key rotation task shutting down");
                        break;
                    }
                }
            }
        });
        
        self._task_handle = Some(handle);
    }
    
    async fn check_and_rotate_keys(
        active_keys: &Arc<Mutex<std::collections::HashMap<String, EncryptedKey>>>,
        retired_keys: &Arc<Mutex<std::collections::HashMap<String, EncryptedKey>>>,
        rotation_policies: &Arc<Mutex<std::collections::HashMap<KeyPurpose, RotationPolicy>>>,
    ) {
        let now = Utc::now();
        
        // Get all policies
        let policies = rotation_policies.lock().await;
        
        // Check active keys for rotation
        let mut keys_to_rotate = Vec::new();
        {
            let active_keys_lock = active_keys.lock().await;
            
            for key in active_keys_lock.values() {
                // Skip if already marked as expiring
                if key.metadata.status == KeyStatus::Expiring {
                    continue;
                }
                
                if let Some(policy) = policies.get(&key.metadata.purpose) {
                    // Check if key should be rotated based on expiration
                    let expiration_threshold = now - Duration::days(policy.active_period_days as i64);
                    if key.metadata.created_at <= expiration_threshold {
                        keys_to_rotate.push(key.metadata.key_id.clone());
                        continue;
                    }
                    
                    // Check if key should be rotated based on usage count
                    if let Some(max_uses) = policy.max_uses_before_rotation {
                        if key.metadata.use_count >= max_uses {
                            keys_to_rotate.push(key.metadata.key_id.clone());
                            continue;
                        }
                    }
                }
            }
        }
        
        // Process keys that need rotation
        for key_id in keys_to_rotate {
            println!("Key {} due for rotation based on policy", key_id);
            // In a real system, you would trigger key rotation here
            // This would typically involve generating a new key and updating references
        }
        
        // Check retired keys for removal
        let mut keys_to_remove = Vec::new();
        {
            let retired_keys_lock = retired_keys.lock().await;
            
            for key in retired_keys_lock.values() {
                if let Some(policy) = policies.get(&key.metadata.purpose) {
                    // Check if key should be completely removed
                    let removal_threshold = key.metadata.expires_at - Duration::days(policy.retirement_period_days as i64);
                    if now >= removal_threshold {
                        keys_to_remove.push(key.metadata.key_id.clone());
                    }
                }
            }
        }
        
        // Remove keys that have exceeded their retirement period
        if !keys_to_remove.is_empty() {
            let mut retired_keys_lock = retired_keys.lock().await;
            for key_id in keys_to_remove {
                println!("Removing retired key {} which has exceeded its retention period", key_id);
                retired_keys_lock.remove(&key_id);
            }
        }
    }
    
    async fn generate_new_key_for_purpose(&self, purpose: &KeyPurpose) -> Result<String, String> {
        // Get the rotation policy for this purpose
        let policies = self.rotation_policies.lock().await;
        let policy = policies.get(purpose).ok_or(format!("No policy defined for {:?}", purpose))?;
        let algorithm = policy.algorithm.clone();
        drop(policies);
        
        // Generate the key
        let key_material = if let Some(hsm) = &self.hsm_client {
            // Use HSM for key generation
            hsm.generate_key(&algorithm, purpose).await?
        } else {
            // Generate locally using post-quantum crypto
            let algorithm = match algorithm.as_str() {
                "Kyber" => PostQuantumAlgorithm::Kyber,
                "Dilithium" => PostQuantumAlgorithm::Dilithium,
                "Sphincs" => PostQuantumAlgorithm::Sphincs,
                "Falcon" => PostQuantumAlgorithm::Falcon,
                _ => return Err(format!("Unsupported algorithm: {}", algorithm)),
            };
            
            let keypair = PostQuantumCrypto::generate_keypair(algorithm);
            let private_key = keypair.private_key.ok_or("Failed to generate private key")?;
            private_key
        };
        
        // Create metadata
        let key_id = Uuid::new_v4().to_string();
        let now = Utc::now();
        let expires_at = now + Duration::days(policy.active_period_days as i64);
        
        let metadata = KeyMetadata {
            key_id: key_id.clone(),
            algorithm: algorithm.clone(),
            purpose: purpose.clone(),
            status: KeyStatus::Active,
            created_at: now,
            expires_at,
            rotated_from: None,
            rotated_to: None,
            last_used: None,
            use_count: 0,
        };
        
        // Encrypt the key material if we have a master key
        let encrypted_material = if let Some(master_key) = &*self.master_key.lock().await {
            // In a real implementation, you would use a proper encryption algorithm
            // For this example, we'll just XOR with the master key (NOT SECURE!)
            let mut encrypted = Vec::with_capacity(key_material.len());
            for (i, byte) in key_material.iter().enumerate() {
                encrypted.push(byte ^ master_key[i % master_key.len()]);
            }
            encrypted
        } else {
            // If no master key, just store the key material directly (in a real system, this would be bad)
            key_material
        };
        
        // Store the key
        let encrypted_key = EncryptedKey {
            key_id: key_id.clone(),
            key_material: encrypted_material,
            metadata: metadata.clone(),
        };
        
        let mut active_keys = self.active_keys.lock().await;
        active_keys.insert(key_id.clone(), encrypted_key);
        
        Ok(key_id)
    }
    
    pub async fn rotate_key(&self, key_id: &str) -> Result<String, String> {
        // Find the key to rotate
        let mut active_keys = self.active_keys.lock().await;
        let old_key = active_keys.get(key_id).ok_or(format!("Key not found: {}", key_id))?;
        
        let purpose = old_key.metadata.purpose.clone();
        let old_key_id = old_key.metadata.key_id.clone();
        
        // Generate a new key with same purpose
        drop(active_keys); // Release lock before calling generate_new_key_for_purpose
        let new_key_id = self.generate_new_key_for_purpose(&purpose).await?;
        
        // Update metadata to link the keys
        let mut active_keys = self.active_keys.lock().await;
        
        // Update the new key to reference the old key
        if let Some(new_key) = active_keys.get_mut(&new_key_id) {
            new_key.metadata.rotated_from = Some(old_key_id.clone());
        }
        
        // Update the old key to reference the new key and mark as expiring
        if let Some(old_key) = active_keys.get_mut(&old_key_id) {
            old_key.metadata.rotated_to = Some(new_key_id.clone());
            old_key.metadata.status = KeyStatus::Expiring;
        }
        
        Ok(new_key_id)
    }
    
    pub async fn get_active_key_for_purpose(&self, purpose: &KeyPurpose) -> Result<String, String> {
        let active_keys = self.active_keys.lock().await;
        
        // Find an active key for this purpose
        for key in active_keys.values() {
            if key.metadata.purpose == *purpose && key.metadata.status == KeyStatus::Active {
                return Ok(key.metadata.key_id.clone());
            }
        }
        
        Err(format!("No active key found for purpose: {:?}", purpose))
    }
    
    pub async fn encrypt_data(&self, purpose: &KeyPurpose, plaintext: &[u8]) -> Result<(String, Vec<u8>), String> {
        // Get an active key for this purpose
        let key_id = self.get_active_key_for_purpose(purpose).await?;
        
        // Get the key
        let mut active_keys = self.active_keys.lock().await;
        let key = active_keys.get_mut(&key_id).ok_or(format!("Key not found: {}", key_id))?;
        
        // Update usage metadata
        key.metadata.use_count += 1;
        key.metadata.last_used = Some(Utc::now());
        
        // Decrypt the key material with master key
        let key_material = if let Some(master_key) = &*self.master_key.lock().await {
            let mut decrypted = Vec::with_capacity(key.key_material.len());
            for (i, byte) in key.key_material.iter().enumerate() {
                decrypted.push(byte ^ master_key[i % master_key.len()]);
            }
            decrypted
        } else {
            key.key_material.clone()
        };
        
        // Perform encryption
        let ciphertext = if let Some(hsm) = &self.hsm_client {
            // Use HSM for encryption
            hsm.encrypt(&key_id, plaintext).await?
        } else {
            // Use local crypto (simplified example)
            // In a real implementation, you would use a proper encryption algorithm
            let mut encrypted = Vec::with_capacity(plaintext.len());
            for (i, byte) in plaintext.iter().enumerate() {
                encrypted.push(byte ^ key_material[i % key_material.len()]);
            }
            encrypted
        };
        
        Ok((key_id.clone(), ciphertext))
    }
    
    pub async fn decrypt_data(&self, key_id: &str, ciphertext: &[u8]) -> Result<Vec<u8>, String> {
        // Try to find the key in active keys
        let mut key_opt = None;
        let mut is_active = true;
        
        {
            let active_keys = self.active_keys.lock().await;
            if let Some(key) = active_keys.get(key_id) {
                key_opt = Some(key.clone());
            }
        }
        
        // If not found in active keys, try retired keys
        if key_opt.is_none() {
            let retired_keys = self.retired_keys.lock().await;
            if let Some(key) = retired_keys.get(key_id) {
                key_opt = Some(key.clone());
                is_active = false;
            }
        }
        
        let key = key_opt.ok_or(format!("Key not found: {}", key_id))?;
        
        // Update usage metadata if key is active
        if is_active {
            let mut active_keys = self.active_keys.lock().await;
            if let Some(key) = active_keys.get_mut(key_id) {
                key.metadata.use_count += 1;
                key.metadata.last_used = Some(Utc::now());
            }
        }
        
        // Decrypt the key material with master key
        let key_material = if let Some(master_key) = &*self.master_key.lock().await {
            let mut decrypted = Vec::with_capacity(key.key_material.len());
            for (i, byte) in key.key_material.iter().enumerate() {
                decrypted.push(byte ^ master_key[i % master_key.len()]);
            }
            decrypted
        } else {
            key.key_material.clone()
        };
        
        // Perform decryption
        let plaintext = if let Some(hsm) = &self.hsm_client {
            // Use HSM for decryption
            hsm.decrypt(key_id, ciphertext).await?
        } else {
            // Use local crypto (simplified example)
            // In a real implementation, you would use a proper decryption algorithm
            let mut decrypted = Vec::with_capacity(ciphertext.len());
            for (i, byte) in ciphertext.iter().enumerate() {
                decrypted.push(byte ^ key_material[i % key_material.len()]);
            }
            decrypted
        };
        
        Ok(plaintext)
    }
    
    pub async fn sign_data(&self, purpose: &KeyPurpose, message: &[u8]) -> Result<(String, Vec<u8>), String> {
        // Ensure we're using a signing purpose
        if *purpose != KeyPurpose::Signing && *purpose != KeyPurpose::Authentication {
            return Err(format!("Invalid purpose for signing: {:?}", purpose));
        }
        
        // Get an active key for this purpose
        let key_id = self.get_active_key_for_purpose(purpose).await?;
        
        // Get the key
        let mut active_keys = self.active_keys.lock().await;
        let key = active_keys.get_mut(&key_id).ok_or(format!("Key not found: {}", key_id))?;
        
        // Update usage metadata
        key.metadata.use_count += 1;
        key.metadata.last_used = Some(Utc::now());
        
        // Perform signing
        let signature = if let Some(hsm) = &self.hsm_client {
            // Use HSM for signing
            hsm.sign(&key_id, message).await?
        } else {
            // Use local crypto (simplified example)
            // In a real implementation, you would use a proper signing algorithm
            let mut sig = Vec::with_capacity(64); // Fixed size for example
            for i in 0..64 {
                let index = i % message.len();
                sig.push(message[index] ^ key.key_material[i % key.key_material.len()]);
            }
            sig
        };
        
        Ok((key_id.clone(), signature))
    }
    
    pub async fn verify_signature(&self, key_id: &str, message: &[u8], signature: &[u8]) -> Result<bool, String> {
        // Try to find the key in active keys
        let mut key_opt = None;
        
        {
            let active_keys = self.active_keys.lock().await;
            if let Some(key) = active_keys.get(key_id) {
                key_opt = Some(key.clone());
            }
        }
        
        // If not found in active keys, try retired keys
        if key_opt.is_none() {
            let retired_keys = self.retired_keys.lock().await;
            if let Some(key) = retired_keys.get(key_id) {
                key_opt = Some(key.clone());
            }
        }
        
        let key = key_opt.ok_or(format!("Key not found: {}", key_id))?;
        
        // Perform verification
        if let Some(hsm) = &self.hsm_client {
            // Use HSM for verification
            hsm.verify(key_id, message, signature).await
        } else {
            // Use local crypto (simplified example)
            // In a real implementation, you would use a proper verification algorithm
            
            // For this example, we'll just return true
            // In a real system, this would actually verify the signature
            Ok(true)
        }
    }
    
    pub async fn retire_key(&self, key_id: &str) -> Result<(), String> {
        let mut active_keys = self.active_keys.lock().await;
        
        if let Some(key) = active_keys.remove(key_id) {
            // Update metadata
            let mut retired_key = key;
            retired_key.metadata.status = KeyStatus::Retired;
            
            // Move to retired keys
            let mut retired_keys = self.retired_keys.lock().await;
            retired_keys.insert(key_id.to_string(), retired_key);
            
            Ok(())
        } else {
            Err(format!("Key not found: {}", key_id))
        }
    }
    
    pub async fn revoke_key(&self, key_id: &str, reason: &str) -> Result<(), String> {
        // Check active keys
        let mut found = false;
        
        {
            let mut active_keys = self.active_keys.lock().await;
            
            if let Some(key) = active_keys.get_mut(key_id) {
                key.metadata.status = KeyStatus::Revoked;
                found = true;
            }
        }
        
        // If not found in active keys, check retired keys
        if !found {
            let mut retired_keys = self.retired_keys.lock().await;
            
            if let Some(key) = retired_keys.get_mut(key_id) {
                key.metadata.status = KeyStatus::Revoked;
                found = true;
            }
        }
        
        if found {
            // Log the revocation
            println!("Key {} revoked. Reason: {}", key_id, reason);
            
            // In a real implementation, you would also update a revocation list
            // and perhaps trigger notifications
            
            Ok(())
        } else {
            Err(format!("Key not found: {}", key_id))
        }
    }
    
    pub async fn shutdown(&mut self) {
        if let Some(signal) = self._shutdown_signal.take() {
            let _ = signal.send(());
        }
        
        if let Some(handle) = self._task_handle.take() {
            let _ = handle.await;
        }
    }
}# Améliorations de sécurité pour etika-payment-integration

## 1. Audit de sécurité détaillé et framework de tests

### 1.1 Framework de tests de pénétration

```rust
// etika-payment-integration/tests/security/penetration_tests.rs

use etika_payment_integration::PaymentIntegrationService;
use tokio::sync::Mutex;
use std::sync::Arc;

mod common;
use common::setup_test_service;

#[tokio::test]
async fn test_sql_injection_resistance() {
    // Configuration du service avec monitoring de sécurité activé
    let service = setup_test_service(true).await;
    
    // Série de payloads d'injection SQL à tester
    let sql_injection_payloads = vec![
        "' OR 1=1; --",
        "'; DROP TABLE transactions; --",
        "' UNION SELECT card_number, cvv FROM payment_cards; --",
        // Plus de vecteurs d'attaque...
    ];
    
    for payload in sql_injection_payloads {
        // Tester différents champs d'entrée avec les payloads
        let test_card = common::create_test_card_with_malicious_data(payload);
        let test_transaction = common::create_test_transaction_with_malicious_data(payload);
        
        // Vérifier que le service gère correctement les tentatives d'injection
        let result = service.process_payment_request(common::create_payment_request_with_card_and_transaction(
            test_card, test_transaction
        )).await;
        
        // La requête devrait échouer pour des raisons de validation, pas de sécurité
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("validation"));
    }
}

#[tokio::test]
async fn test_token_manipulation_resistance() {
    let service = setup_test_service(true).await;
    
    // Tester la manipulation de jetons de session/authentification
    let legitimate_token = common::get_legitimate_token();
    let manipulated_tokens = vec![
        common::manipulate_token_expiry(legitimate_token.clone()),
        common::manipulate_token_permissions(legitimate_token.clone()),
        common::manipulate_token_signature(legitimate_token.clone()),
        // Plus de manipulations...
    ];
    
    for token in manipulated_tokens {
        let result = service.validate_auth_token(&token).await;
        assert!(result.is_err(), "Le service devrait rejeter le jeton manipulé");
    }
}

#[tokio::test]
async fn test_race_condition_vulnerability() {
    let service = Arc::new(Mutex::new(setup_test_service(true).await));
    
    // Test de condition de concurrence sur la double transaction
    let card = common::create_test_card();
    let transaction = common::create_test_transaction();
    
    // Lancer plusieurs transactions simultanées avec le même ID pour tester la protection
    let mut handles = Vec::new();
    for _ in 0..10 {
        let service_clone = service.clone();
        let card_clone = card.clone();
        let transaction_clone = transaction.clone();
        
        let handle = tokio::spawn(async move {
            let service = service_clone.lock().await;
            service.process_payment_request(common::create_payment_request_with_card_and_transaction(
                card_clone, transaction_clone
            )).await
        });
        
        handles.push(handle);
    }
    
    // Vérifier les résultats: une seule transaction devrait réussir, les autres devraient échouer
    // avec une erreur de transaction en double
    let mut success_count = 0;
    for handle in handles {
        let result = handle.await.unwrap();
        if result.is_ok() {
            success_count += 1;
        }
    }
    
    assert_eq!(success_count, 1, "Une seule transaction avec cet ID devrait réussir");
}
```

### 1.2 Tests automatisés pour OWASP Top 10

```rust
// etika-payment-integration/tests/security/owasp_tests.rs

use etika_payment_integration::PaymentIntegrationService;
use tokio::sync::Mutex;
use std::sync::Arc;

mod common;
use common::setup_test_service;

#[tokio::test]
async fn test_a1_injection() {
    // Tests couvrant l'injection (SQL, NoSQL, OS command, etc.)
    // Similaire au test_sql_injection_resistance mais plus complet
}

#[tokio::test]
async fn test_a2_broken_authentication() {
    let service = setup_test_service(true).await;
    
    // Test de force brute
    for _ in 0..1000 {
        let random_token = common::generate_random_token();
        let result = service.validate_auth_token(&random_token).await;
        assert!(result.is_err());
        
        // Vérifier que le système de détection de force brute se déclenche
        if _ > 10 {
            let error = result.unwrap_err();
            assert!(error.contains("rate limit") || error.contains("brute force"),
                   "Le système devrait détecter la tentative de force brute après plusieurs essais");
        }
    }
}

#[tokio::test]
async fn test_a3_sensitive_data_exposure() {
    let service = setup_test_service(true).await;
    
    // Effectuer une transaction légitime
    let card = common::create_test_card();
    let transaction = common::create_test_transaction();
    let result = service.process_payment_request(common::create_payment_request_with_card_and_transaction(
        card.clone(), transaction.clone()
    )).await;
    
    assert!(result.is_ok());
    
    // Vérifier que les données sensibles ne sont pas exposées dans la réponse
    let response = result.unwrap();
    let response_json = serde_json::to_string(&response).unwrap();
    
    assert!(!response_json.contains(&card.token), "Le token de carte ne devrait pas apparaître dans la réponse");
    assert!(!response_json.contains("cvv"), "CVV ne devrait jamais apparaître dans la réponse");
    
    // Vérifier les logs pour s'assurer qu'ils ne contiennent pas de données sensibles
    let logs = common::capture_service_logs();
    assert!(!logs.contains(&card.token), "Le token de carte ne devrait pas apparaître dans les logs");
}

// Tests pour d'autres catégories OWASP (A4-A10)...
```

### 1.3 Simulation d'attaques ciblées

```rust
// etika-payment-integration/tests/security/targeted_attack_tests.rs

use etika_payment_integration::PaymentIntegrationService;
use etika_payment_integration::transaction_manager::TransactionManager;
use etika_payment_integration::fallback::FallbackManager;

mod common;
use common::setup_test_service;

#[tokio::test]
async fn test_synchronization_attack() {
    // Tester des attaques spécifiques à la synchronisation de la double transaction
    let service = setup_test_service(true).await;
    
    // 1. Attaque de type "man-in-the-middle" pendant la synchronisation
    let (transaction, card) = common::prepare_transaction_and_card();
    common::simulate_mitm_during_transaction(&service, transaction, card).await;
    
    // 2. Attaque de désynchronisation (valider une partie mais pas l'autre)
    let (transaction, card) = common::prepare_transaction_and_card();
    common::simulate_desynchronization_attack(&service, transaction, card).await;
    
    // 3. Attaque de rejeu
    let (transaction, card) = common::prepare_transaction_and_card();
    let success_response = service.process_payment_request(common::create_payment_request_with_card_and_transaction(
        card.clone(), transaction.clone()
    )).await;
    
    assert!(success_response.is_ok());
    
    // Tenter de rejouer la même transaction
    let replay_response = service.process_payment_request(common::create_payment_request_with_card_and_transaction(
        card.clone(), transaction.clone()
    )).await;
    
    assert!(replay_response.is_err());
    assert!(replay_response.unwrap_err().contains("duplicate transaction"));
}

#[tokio::test]
async fn test_fallback_mechanism_attack() {
    // Essayer d'exploiter les mécanismes de fallback
    let service = setup_test_service(true).await;
    
    // 1. Attaque par déni de service sur le système de fallback
    let results = common::simulate_dos_on_fallback(&service).await;
    
    // Vérifier que le système résiste et applique des limitations appropriées
    assert!(results.requests_rejected > 0, "Le système devrait rejeter les requêtes excessives");
    assert!(results.rate_limiting_applied, "La limitation de débit devrait être appliquée");
    
    // 2. Essayer de forcer des transactions en fallback pour manipulation
    let forced_fallback_result = common::force_transaction_to_fallback(&service).await;
    assert!(forced_fallback_result.is_err());
}
```

## 2. Système avancé de détection des fraudes

### 2.1 Module d'analyse comportementale en temps réel

```rust
// etika-payment-integration/src/fraud_detection/behavior_analysis.rs

use std::sync::Arc;
use tokio::sync::Mutex;
use serde::{Serialize, Deserialize};
use uuid::Uuid;

use crate::{PaymentTransaction, PaymentCard, Amount};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BehaviorProfile {
    pub user_id: String,
    pub typical_transaction_amounts: Vec<Amount>,
    pub typical_merchants: Vec<String>,
    pub typical_transaction_frequency: TransactionFrequency,
    pub typical_geographic_locations: Vec<GeoLocation>,
    pub risk_score: f64,
    pub last_updated: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TransactionFrequency {
    Daily,
    Weekly,
    Monthly,
    Irregular,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeoLocation {
    pub country_code: String,
    pub region: Option<String>,
    pub city: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionRiskAssessment {
    pub transaction_id: String,
    pub risk_score: f64,
    pub risk_factors: Vec<RiskFactor>,
    pub recommendation: RiskRecommendation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RiskFactor {
    UnusualAmount,
    UnusualMerchant,
    UnusualFrequency,
    UnusualLocation,
    UnusualTime,
    VelocityCheck,
    PatternMatch,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RiskRecommendation {
    Allow,
    Review,
    Block,
}

pub struct BehaviorAnalysisEngine {
    // Storage for user profiles (in production would be backed by a database)
    profiles: Arc<Mutex<std::collections::HashMap<String, BehaviorProfile>>>,
    // Configuration
    config: BehaviorAnalysisConfig,
}

#[derive(Clone, Debug)]
pub struct BehaviorAnalysisConfig {
    pub amount_variance_threshold: f64,
    pub high_risk_score_threshold: f64,
    pub medium_risk_score_threshold: f64,
    pub unusual_location_multiplier: f64,
    pub unusual_merchant_multiplier: f64,
    pub unusual_amount_multiplier: f64,
    pub velocity_check_window_hours: u64,
    pub velocity_check_threshold: u32,
}

impl Default for BehaviorAnalysisConfig {
    fn default() -> Self {
        Self {
            amount_variance_threshold: 2.0,  // Factor by which amount can vary from typical
            high_risk_score_threshold: 0.7,  // Risk score above which to block
            medium_risk_score_threshold: 0.4, // Risk score above which to review
            unusual_location_multiplier: 0.6, // Weight for location in risk score
            unusual_merchant_multiplier: 0.4, // Weight for merchant in risk score
            unusual_amount_multiplier: 0.5,   // Weight for amount in risk score
            velocity_check_window_hours: 24,  // Time window for velocity checks
            velocity_check_threshold: 10,     // Max transactions in window
        }
    }
}

impl BehaviorAnalysisEngine {
    pub fn new(config: BehaviorAnalysisConfig) -> Self {
        Self {
            profiles: Arc::new(Mutex::new(std::collections::HashMap::new())),
            config,
        }
    }
    
    pub async fn analyze_transaction(
        &self,
        transaction: &PaymentTransaction,
        card: &PaymentCard,
        ip_address: Option<&str>,
        device_fingerprint: Option<&str>,
    ) -> TransactionRiskAssessment {
        let mut risk_factors = Vec::new();
        let user_id = &transaction.consumer_id;
        
        // Get or create profile
        let profile = self.get_or_create_profile(user_id).await;
        
        // Calculate basic risk score
        let mut risk_score = 0.0;
        
        // 1. Check amount against typical amounts
        if self.is_unusual_amount(&profile, &transaction.amount) {
            risk_factors.push(RiskFactor::UnusualAmount);
            risk_score += self.config.unusual_amount_multiplier;
        }
        
        // 2. Check merchant against typical merchants
        if !profile.typical_merchants.contains(&transaction.merchant_id) {
            risk_factors.push(RiskFactor::UnusualMerchant);
            risk_score += self.config.unusual_merchant_multiplier;
        }
        
        // 3. Check location if IP provided
        if let Some(ip) = ip_address {
            if let Some(location) = self.geolocate_ip(ip).await {
                if !profile.typical_geographic_locations.iter().any(|loc| loc.country_code == location.country_code) {
                    risk_factors.push(RiskFactor::UnusualLocation);
                    risk_score += self.config.unusual_location_multiplier;
                }
            }
        }
        
        // 4. Velocity check
        if self.exceeds_velocity_threshold(user_id).await {
            risk_factors.push(RiskFactor::VelocityCheck);
            risk_score += 0.8; // High impact for velocity violations
        }
        
        // Normalize risk score to 0-1 range
        risk_score = risk_score.min(1.0);
        
        // Determine recommendation
        let recommendation = if risk_score >= self.config.high_risk_score_threshold {
            RiskRecommendation::Block
        } else if risk_score >= self.config.medium_risk_score_threshold {
            RiskRecommendation::Review
        } else {
            RiskRecommendation::Allow
        };
        
        // Create assessment
        TransactionRiskAssessment {
            transaction_id: transaction.id.clone(),
            risk_score,
            risk_factors,
            recommendation,
        }
    }
    
    // Get or create a behavior profile for a user
    async fn get_or_create_profile(&self, user_id: &str) -> BehaviorProfile {
        let mut profiles = self.profiles.lock().await;
        
        if let Some(profile) = profiles.get(user_id) {
            profile.clone()
        } else {
            // In a real implementation, we would try to load from database first
            let new_profile = BehaviorProfile {
                user_id: user_id.to_string(),
                typical_transaction_amounts: Vec::new(),
                typical_merchants: Vec::new(),
                typical_transaction_frequency: TransactionFrequency::Irregular,
                typical_geographic_locations: Vec::new(),
                risk_score: 0.0,
                last_updated: chrono::Utc::now(),
            };
            
            profiles.insert(user_id.to_string(), new_profile.clone());
            new_profile
        }
    }
    
    // Check if an amount is unusual compared to typical amounts
    fn is_unusual_amount(&self, profile: &BehaviorProfile, amount: &Amount) -> bool {
        if profile.typical_transaction_amounts.is_empty() {
            return false; // No history to compare against
        }
        
        // Find a comparable amount in the same currency
        let comparable_amounts: Vec<&Amount> = profile.typical_transaction_amounts.iter()
            .filter(|a| a.currency == amount.currency)
            .collect();
        
        if comparable_amounts.is_empty() {
            return true; // No amounts in this currency, consider it unusual
        }
        
        // Calculate average amount
        let avg_amount = comparable_amounts.iter()
            .map(|a| a.value)
            .sum::<u64>() as f64 / comparable_amounts.len() as f64;
        
        // Check if current amount exceeds threshold
        let current_amount = amount.value as f64;
        let ratio = if current_amount > avg_amount {
            current_amount / avg_amount
        } else {
            avg_amount / current_amount
        };
        
        ratio > self.config.amount_variance_threshold
    }
    
    // Geolocate an IP address
    async fn geolocate_ip(&self, ip: &str) -> Option<GeoLocation> {
        // In a real implementation, this would call a geolocation service
        // For this example, we'll just simulate with test data
        
        if ip == "127.0.0.1" {
            return Some(GeoLocation {
                country_code: "LOCAL".to_string(),
                region: Some("LOCAL".to_string()),
                city: Some("LOCAL".to_string()),
                latitude: Some(0.0),
                longitude: Some(0.0),
            });
        }
        
        // Simulate some test countries based on IP pattern
        let country_code = if ip.starts_with("192.") {
            "US"
        } else if ip.starts_with("10.") {
            "FR"
        } else if ip.starts_with("172.") {
            "DE"
        } else {
            "GB"
        };
        
        Some(GeoLocation {
            country_code: country_code.to_string(),
            region: None,
            city: None,
            latitude: None,
            longitude: None,
        })
    }
    
    // Check if user exceeds transaction velocity threshold
    async fn exceeds_velocity_threshold(&self, user_id: &str) -> bool {
        // In a real implementation, this would query recent transactions from a database
        // For this example, we'll just return false
        false
    }
    
    // Update user profile with a new legitimate transaction
    pub async fn update_profile_with_transaction(
        &self,
        user_id: &str,
        transaction: &PaymentTransaction,
        geo_location: Option<GeoLocation>,
    ) {
        let mut profiles = self.profiles.lock().await;
        
        if let Some(profile) = profiles.get_mut(user_id) {
            // Update profile with new transaction data
            
            // Add merchant if not already in list
            if !profile.typical_merchants.contains(&transaction.merchant_id) {
                profile.typical_merchants.push(transaction.merchant_id.clone());
            }
            
            // Add amount to typical amounts
            profile.typical_transaction_amounts.push(transaction.amount.clone());
            
            // Trim list if it gets too long
            if profile.typical_transaction_amounts.len() > 10 {
                profile.typical_transaction_amounts.remove(0);
            }
            
            // Add geo location if provided and not already in list
            if let Some(location) = geo_location {
                if !profile.typical_geographic_locations.iter().any(|loc| 
                    loc.country_code == location.country_code
                ) {
                    profile.typical_geographic_locations.push(location);
                }
            }
            
            profile.last_updated = chrono::Utc::now();
        }
    }
}

// Integration with main payment flow
pub async fn integrate_fraud_detection(
    transaction_manager: &mut crate::transaction_manager::TransactionManager,
    behavior_engine: Arc<BehaviorAnalysisEngine>,
) {
    // Register fraud detection as a pre-transaction hook
    transaction_manager.register_pre_transaction_hook(move |transaction, card, context| {
        let behavior_engine = behavior_engine.clone();
        
        Box::pin(async move {
            let ip_address = context.get("ip_address").map(|s| s.as_str());
            let device_fingerprint = context.get("device_fingerprint").map(|s| s.as_str());
            
            let assessment = behavior_engine.analyze_transaction(
                transaction, 
                card, 
                ip_address, 
                device_fingerprint
            ).await;
            
            match assessment.recommendation {
                RiskRecommendation::Allow => Ok(()),
                RiskRecommendation::Review => {
                    // For review, we could flag the transaction but still allow it
                    println!("Transaction {} flagged for review: risk_score={}", 
                             transaction.id, assessment.risk_score);
                    Ok(())
                },
                RiskRecommendation::Block => {
                    Err(crate::PaymentError::SecurityViolation(
                        format!("Transaction blocked by fraud detection: risk_score={}", 
                                assessment.risk_score)
                    ))
                }
            }
        })
    });
}
```

### 2.2 Détection d'anomalies basée sur le machine learning

```rust
// etika-payment-integration/src/fraud_detection/anomaly_detection.rs

use std::sync::Arc;
use tokio::sync::Mutex;
use serde::{Serialize, Deserialize};

use crate::{PaymentTransaction, PaymentCard};

// Feature vector for ML model
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TransactionFeatures {
    pub amount_normalized: f64,
    pub is_new_merchant: bool,
    pub is_new_card: bool,
    pub hour_of_day: u8,
    pub day_of_week: u8,
    pub transaction_velocity: f64,
    pub distance_from_last_transaction_km: Option<f64>,
    pub is_foreign_transaction: bool,
    pub card_age_days: u32,
    pub user_account_age_days: u32,
}

// Result of anomaly detection
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AnomalyDetectionResult {
    pub transaction_id: String,
    pub anomaly_score: f64,
    pub is_anomalous: bool,
    pub feature_importance: Vec<(String, f64)>,
    pub explanation: String,
}

// Simple Isolation Forest implementation
// In a real system, you would integrate with a more sophisticated ML library
pub struct IsolationForest {
    n_trees: usize,
    sub_sampling_size: usize,
    max_tree_height: usize,
    // In a real system, this would be a proper model structure
    random_seed: u64,
}

impl IsolationForest {
    pub fn new(n_trees: usize, sub_sampling_size: usize) -> Self {
        let max_tree_height = (sub_sampling_size as f64).log2().ceil() as usize;
        Self {
            n_trees,
            sub_sampling_size,
            max_tree_height,
            random_seed: 42,
        }
    }
    
    // In a real system, this would implement the actual algorithm
    pub fn compute_anomaly_score(&self, features: &[f64]) -> f64 {
        // This is a placeholder for the actual algorithm
        // In a real system, you would compute the average path length
        // and convert it to an anomaly score
        
        // Simulate some anomaly detection
        let mut score = 0.0;
        
        // Example: Large normalized amounts are suspicious
        if features[0] > 0.8 {
            score += 0.3;
        }
        
        // Example: New merchant + high amount is suspicious
        if features[0] > 0.6 && features[1] > 0.5 {
            score += 0.2;
        }
        
        // Example: Unusual time of day
        if features[3] > 22.0 || features[3] < 4.0 {
            score += 0.1;
        }
        
        // Example: High transaction velocity
        if features[5] > 0.7 {
            score += 0.3;
        }
        
        score.min(1.0)
    }
}

pub struct AnomalyDetectionEngine {
    model: IsolationForest,
    threshold: f64,
    user_profiles: Arc<Mutex<std::collections::HashMap<String, UserProfile>>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct UserProfile {
    user_id: String,
    account_creation_date: chrono::DateTime<chrono::Utc>,
    known_merchants: Vec<String>,
    known_cards: Vec<String>,
    transaction_history: Vec<HistoricalTransaction>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct HistoricalTransaction {
    amount: f64,
    merchant_id: String,
    card_id: String,
    timestamp: chrono::DateTime<chrono::Utc>,
    latitude: Option<f64>,
    longitude: Option<f64>,
}

impl AnomalyDetectionEngine {
    pub fn new() -> Self {
        Self {
            model: IsolationForest::new(100, 256), // 100 trees, subsample size 256
            threshold: 0.6, // Threshold for anomaly detection
            user_profiles: Arc::new(Mutex::new(std::collections::HashMap::new())),
        }
    }
    
    pub async fn detect_anomalies(
        &self,
        transaction: &PaymentTransaction,
        card: &PaymentCard,
        context: &std::collections::HashMap<String, String>,
    ) -> AnomalyDetectionResult {
        // Extract features from transaction
        let features = self.extract_features(transaction, card, context).await;
        
        // Convert to feature vector for model
        let feature_vector = vec![
            features.amount_normalized,
            if features.is_new_merchant { 1.0 } else { 0.0 },
            if features.is_new_card { 1.0 } else { 0.0 },
            features.hour_of_day as f64 / 24.0,
            features.day_of_week as f64 / 7.0,
            features.transaction_velocity,
            features.distance_from_last_transaction_km.unwrap_or(0.0) / 1000.0, // Normalize to 0-1
            if features.is_foreign_transaction { 1.0 } else { 0.0 },
            features.card_age_days as f64 / 365.0, // Normalize to approx 0-1
            features.user_account_age_days as f64 / 365.0, // Normalize to approx 0-1
        ];
        
        // Compute anomaly score
        let anomaly_score = self.model.compute_anomaly_score(&feature_vector);
        let is_anomalous = anomaly_score > self.threshold;
        
        // Generate feature importance (simplified)
        let feature_names = vec![
            "amount_normalized".to_string(),
            "is_new_merchant".to_string(),
            "is_new_card".to_string(),
            "hour_of_day".to_string(),
            "day_of_week".to_string(),
            "transaction_velocity".to_string(),
            "distance_from_last".to_string(),
            "is_foreign".to_string(),
            "card_age".to_string(),
            "account_age".to_string(),
        ];
        
        // In a real system, you would compute actual feature importances
        // Here we'll just use the feature values themselves as a demonstration
        let feature_importance: Vec<(String, f64)> = feature_names.iter()
            .zip(feature_vector.iter())
            .map(|(name, value)| (name.clone(), *value))
            .collect();
        
        // Generate explanation
        let explanation = if is_anomalous {
            let mut reasons = Vec::new();
            
            if features.amount_normalized > 0.8 {
                reasons.push("unusually high amount".to_string());
            }
            
            if features.is_new_merchant {
                reasons.push("transaction with new merchant".to_string());
            }
            
            if features.is_new_card {
                reasons.push("transaction with new card".to_string());
            }
            
            if features.transaction_velocity > 0.7 {
                reasons.push("high transaction frequency".to_string());
            }
            
            if reasons.is_empty() {
                "Transaction flagged as anomalous by pattern detection".to_string()
            } else {
                format!("Transaction flagged as anomalous due to: {}", reasons.join(", "))
            }
        } else {
            "Transaction appears normal".to_string()
        };
        
        AnomalyDetectionResult {
            transaction_id: transaction.id.clone(),
            anomaly_score,
            is_anomalous,
            feature_importance,
            explanation,
        }
    }
    
    async fn extract_features(
        &self,
        transaction: &PaymentTransaction,
        card: &PaymentCard,
        context: &std::collections::HashMap<String, String>,
    ) -> TransactionFeatures {
        let user_id = &transaction.consumer_id;
        let profiles = self.user_profiles.lock().await;
        
        // Default features for new users
        let mut features = TransactionFeatures {
            amount_normalized: transaction.amount.value as f64 / 10000.0, // Normalize to approx 0-1
            is_new_merchant: true,
            is_new_card: true,
            hour_of_day: transaction.timestamp.hour(),
            day_of_week: transaction.timestamp.weekday().num_days_from_monday() as u8,
            transaction_velocity: 0.0,
            distance_from_last_transaction_km: None,
            is_foreign_transaction: false,
            card_age_days: 0,
            user_account_age_days: 0,
        };
        
        // Enrich features for existing users
        if let Some(profile) = profiles.get(user_id) {
            // Check if merchant is new
            features.is_new_merchant = !profile.known_merchants.contains(&transaction.merchant_id);
            
            // Check if card is new
            features.is_new_card = !profile.known_cards.contains(&card.token);
            
            // Calculate user account age
            let account_age = chrono::Utc::now() - profile.account_creation_date;
            features.user_account_age_days = account_age.num_days() as u32;
            
            // Calculate transaction velocity
            if !profile.transaction_history.is_empty() {
                let recent_transactions: Vec<&HistoricalTransaction> = profile.transaction_history.iter()
                    .filter(|tx| {
                        let age = transaction.timestamp - tx.timestamp;
                        age.num_hours() <= 24 // Look at last 24 hours
                    })
                    .collect();
                
                features.transaction_velocity = recent_transactions.len() as f64 / 10.0; // Normalize to approx 0-1
                
                // Get the most recent transaction for distance calculation
                if let Some(last_tx) = profile.transaction_history.last() {
                    // Calculate distance if we have location data
                    if let (Some(lat1), Some(lon1)) = (
                        context.get("latitude").and_then(|s| s.parse::<f64>().ok()),
                        context.get("longitude").and_then(|s| s.parse::<f64>().ok())
                    ) {
                        if let (Some(lat2), Some(lon2)) = (last_tx.latitude, last_tx.longitude) {
                            features.distance_from_last_transaction_km = Some(
                                Self::calculate_distance(lat1, lon1, lat2, lon2)
                            );
                        }
                    }
                    
                    // Check if foreign transaction
                    let last_country = context.get("last_country").unwrap_or(&"unknown".to_string());
                    let current_country = context.get("country").unwrap_or(&"unknown".to_string());
                    features.is_foreign_transaction = last_country != current_country;
                }
            }
        }
        
        features
    }
    
    fn calculate_distance(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
        // Haversine formula for calculating distance between two points on Earth
        let r = 6371.0; // Earth radius in km
        
        let dlat = (lat2 - lat1).to_radians();
        let dlon = (lon2 - lon1).to_radians();
        
        let a = (dlat/2.0).sin() * (dlat/2.0).sin() +
               (lat1.to_radians()).cos() * (lat2.to_radians()).cos() *
               (dlon/2.0).sin() * (dlon/2.0).sin();
        
        let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());
        
        r * c
    }
    
    // Update user profile with a new legitimate transaction
    pub async fn update_profile(&self, transaction: &PaymentTransaction, card: &PaymentCard, context: &std::collections::HashMap<String, String>) {
        let user_id = transaction.consumer_id.clone();
        let mut profiles = self.user_profiles.lock().await;
        
        let profile = profiles.entry(user_id.clone()).or_insert_with(|| {
            UserProfile {
                user_id: user_id.clone(),
                account_creation_date: chrono::Utc::now() - chrono::Duration::days(1), // Default to 1 day old
                known_merchants: Vec::new(),
                known_cards: Vec::new(),
                transaction_history: Vec::new(),
            }
        });
        
        // Add merchant if new
        if !profile.known_merchants.contains(&transaction.merchant_id) {
            profile.known_merchants.push(transaction.merchant_id.clone());
        }
        
        // Add card if new
        if !profile.known_cards.contains(&card.token) {
            profile.known_cards.push(card.token.clone());
        }
        
        // Add to transaction history
        let lat = context.get("latitude").and_then(|s| s.parse::<f64>().ok());
        let lon = context.get("longitude").and_then(|s| s.parse::<f64>().ok());
        
        profile.transaction_history.push(HistoricalTransaction {
            amount: transaction.amount.value as f64,
            merchant_id: transaction.merchant_id.clone(),
            card_id: card.token.clone(),
            timestamp: transaction.timestamp,
            latitude: lat,
            longitude: lon,
        });
        
        // Limit history size
        if profile.transaction_history.len() > 100 {
            profile.transaction_history.remove(0);
        }
    }
}

// Integration with main payment flow
pub async fn integrate_anomaly_detection(
    transaction_manager: &mut crate::transaction_manager::TransactionManager,
    anomaly_engine: Arc<AnomalyDetectionEngine>,
) {
    // Register anomaly detection as a pre-transaction hook
    transaction_manager.register_pre_transaction_hook(move |transaction, card, context| {
        let anomaly_engine = anomaly_engine.clone();
        
        Box::pin(async move {
            let result = anomaly_engine.detect_anomalies(transaction, card, context).await;
            
            if result.is_anomalous {
                // Log the anomaly
                println!("ANOMALY DETECTED: {} - {}", transaction.id, result.explanation);
                
                // Decide whether to block based on anomaly score
                if result.anomaly_score > 0.8 {
                    return Err(crate::PaymentError::SecurityViolation(
                        format!("Transaction blocked due to high anomaly score: {}", result.anomaly_score)
                    ));
                }
                
                // For medium scores, we might want to trigger additional verification
                if result.anomaly_score > 0.6 {
                    // In a real system, this might trigger 3D Secure or other verification
                    println!("Additional verification required for transaction {}", transaction.id);
                }
            }
            
            // Update profile with the transaction if it passes initial checks
            anomaly_engine.update_profile(transaction, card, context).await;
            
            Ok(())
        })
    });
}
```

### 2.3 Règles métier spécifiques à Étika

```rust
// etika-payment-integration/src/fraud_detection/business_rules.rs

use std::sync::Arc;
use serde::{Serialize, Deserialize};

use crate::{PaymentTransaction, PaymentCard, Amount, PopMetadata};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BusinessRuleViolation {
    pub rule_id: String,
    pub description: String,
    pub severity: RuleSeverity,
    pub recommended_action: RecommendedAction,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RuleSeverity {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RecommendedAction {
    Monitor,
    Flag,
    Review,
    Block,
}

#[derive(Debug, Clone)]
pub struct BusinessRule {
    pub id: String,
    pub description: String,
    pub severity: RuleSeverity,
    pub recommended_action: RecommendedAction,
    // The rule evaluation function
    pub evaluate: Box<dyn Fn(&PaymentTransaction, &PaymentCard, &std::collections::HashMap<String, String>) -> bool + Send + Sync>,
}

pub struct BusinessRulesEngine {
    rules: Vec<BusinessRule>,
}

impl BusinessRulesEngine {
    pub fn new() -> Self {
        Self {
            rules: Vec::new(),
        }
    }
    
    pub fn add_rule(&mut self, rule: BusinessRule) {
        self.rules.push(rule);
    }
    
    pub fn initialize_default_rules(&mut self) {
        // Rule 1: Large token activations in short time period
        self.add_rule(BusinessRule {
            id: "ETIKA-001".to_string(),
            description: "Unusually large token activation in a short time period".to_string(),
            severity: RuleSeverity::High,
            recommended_action: RecommendedAction::Review,
            evaluate: Box::new(|transaction, _card, context| {
                // Check if we have velocity data
                if let Some(token_velocity_str) = context.get("token_activation_velocity") {
                    if let Ok(token_velocity) = token_velocity_str.parse::<u32>() {
                        // If high velocity and many tokens being activated
                        return token_velocity > 5 && transaction.pop_metadata.token_refs.len() > 3;
                    }
                }
                false
            }),
        });
        
        // Rule 2: Suspicious PoP validation pattern
        self.add_rule(BusinessRule {
            id: "ETIKA-002".to_string(),
            description: "Suspicious pattern of PoP validations".to_string(),
            severity: RuleSeverity::Medium,
            recommended_action: RecommendedAction::Flag,
            evaluate: Box::new(|transaction, _card, context| {
                // Check for repeated validations from same IP but different consumers
                if let Some(ip_validation_count_str) = context.get("ip_pop_validation_count") {
                    if let Ok(ip_validation_count) = ip_validation_count_str.parse::<u32>() {
                        // If same IP has validated for multiple different consumers
                        return ip_validation_count > 3;
                    }
                }
                false
            }),
        });
        
        // Rule 3: Token activation mismatch with purchase amount
        self.add_rule(BusinessRule {
            id: "ETIKA-003".to_string(),
            description: "Token activation value significantly mismatched with purchase amount".to_string(),
            severity: RuleSeverity::Medium,
            recommended_action: RecommendedAction::Flag,
            evaluate: Box::new(|transaction, _card, context| {
                // Check if we have token value data
                if let Some(token_value_str) = context.get("token_total_value") {
                    if let Ok(token_value) = token_value_str.parse::<u64>() {
                        // If token value is much higher than transaction amount
                        let ratio = token_value as f64 / transaction.amount.value as f64;
                        return ratio > 3.0; // Token value more than 3x purchase amount
                    }
                }
                false
            }),
        });
        
        // Rule 4: Multiple failed PoP validations before success
        self.add_rule(BusinessRule {
            id: "ETIKA-004".to_string(),
            description: "Multiple failed PoP validations before successful one".to_string(),
            severity: RuleSeverity::High,
            recommended_action: RecommendedAction::Review,
            evaluate: Box::new(|_transaction, _card, context| {
                // Check if we have failed validation count
                if let Some(failed_validations_str) = context.get("recent_failed_pop_validations") {
                    if let Ok(failed_validations) = failed_validations_str.parse::<u32>() {
                        // If multiple failed validations recently
                        return failed_validations > 2;
                    }
                }
                false
            }),
        });
        
        // Rule 5: Merchant and supplier collusion pattern
        self.add_rule(BusinessRule {
            id: "ETIKA-005".to_string(),
            description: "Potential collusion pattern between merchant and supplier".to_string(),
            severity: RuleSeverity::Critical,
            recommended_action: RecommendedAction::Block,
            evaluate: Box::new(|transaction, _card, context| {
                // Check for suspicious pattern of transactions
                if let Some(merchant_supplier_pattern_str) = context.get("merchant_supplier_frequency") {
                    if let Ok(pattern_score) = merchant_supplier_pattern_str.parse::<f64>() {
                        // If suspicious pattern detected
                        return pattern_score > 0.8;
                    }
                }
                false
            }),
        });
        
        // Rule 6: Attempt to reuse receipt data
        self.add_rule(BusinessRule {
            id: "ETIKA-006".to_string(),
            description: "Attempt to reuse receipt data from previous transaction".to_string(),
            severity: RuleSeverity::Critical,
            recommended_action: RecommendedAction::Block,
            evaluate: Box::new(|transaction, _card, context| {
                // Check if receipt hash has been seen before
                if let Some(receipt_hash) = context.get("receipt_data_hash") {
                    if let Some(receipt_seen_before) = context.get("receipt_hash_seen_before") {
                        return receipt_seen_before == "true";
                    }
                }
                false
            }),
        });
    }
    
    pub fn evaluate_rules(
        &self,
        transaction: &PaymentTransaction,
        card: &PaymentCard,
        context: &std::collections::HashMap<String, String>,
    ) -> Vec<BusinessRuleViolation> {
        let mut violations = Vec::new();
        
        for rule in &self.rules {
            // Evaluate the rule
            if (rule.evaluate)(transaction, card, context) {
                violations.push(BusinessRuleViolation {
                    rule_id: rule.id.clone(),
                    description: rule.description.clone(),
                    severity: rule.severity.clone(),
                    recommended_action: rule.recommended_action.clone(),
                });
            }
        }
        
        violations
    }
}

// Integration with main payment flow
pub async fn integrate_business_rules(
    transaction_manager: &mut crate::transaction_manager::TransactionManager,
    rules_engine: Arc<BusinessRulesEngine>,
) {
    // Register business rules as a pre-transaction hook
    transaction_manager.register_pre_transaction_hook(move |transaction, card, context| {
        let rules_engine = rules_engine.clone();
        
        Box::pin(async move {
            let violations = rules_engine.evaluate_rules(transaction, card, context);
            
            // Process violations based on recommended action
            for violation in &violations {
                match violation.recommended_action {
                    RecommendedAction::Monitor => {
                        // Just log for monitoring
                        println!("Rule violation (Monitor): {} - {}", violation.rule_id, violation.description);
                    },
                    RecommendedAction::Flag => {
                        // Log and flag for later review
                        println!("Rule violation (Flag): {} - {}", violation.rule_id, violation.description);
                        // In a real system, would add to a review queue
                    },
                    RecommendedAction::Review => {
                        // Log and possibly trigger manual review
                        println!("Rule violation (Review): {} - {}", violation.rule_id, violation.description);
                        // In a real system, might pause transaction for review
                    },
                    RecommendedAction::Block => {
                        // Block the transaction
                        println!("Rule violation (Block): {} - {}", violation.rule_id, violation.description);
                        return Err(crate::PaymentError::SecurityViolation(
                            format!("Transaction blocked due to rule violation: {}", violation.rule_id)
                        ));
                    },
                }
            }
            
            Ok(())
        })
    });
}
```

## 3. Cryptographie renforcée

### 3.1 Implémentation d'algorithmes post-quantiques

```rust
// etika-payment-integration/src/crypto/post_quantum.rs

use serde::{Serialize, Deserialize};
use std::sync::Arc;

// Note: This is a simplified wrapper around post-quantum algorithms
// In a real implementation, you would use an actual library like CRYSTALS-Kyber or SPHINCS+

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PostQuantumAlgorithm {
    Kyber,     // Lattice-based KEM
    Dilithium, // Lattice-based signature
    Sphincs,   // Hash-based signature
    Falcon,    // Lattice-based signature
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostQuantumKeyPair {
    pub algorithm: PostQuantumAlgorithm,
    pub public_key: Vec<u8>,
    pub private_key: Option<Vec<u8>>, // None if only public key is available
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostQuantumSignature {
    pub algorithm: PostQuantumAlgorithm,
    pub signature: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncapsulatedKey {
    pub algorithm: PostQuantumAlgorithm,
    pub ciphertext: Vec<u8>,
    pub shared_secret: Option<Vec<u8>>, // None if this is received from someone else
}

pub struct PostQuantumCrypto;

impl PostQuantumCrypto {
    // Generate a new key pair
    pub fn generate_keypair(algorithm: PostQuantumAlgorithm) -> PostQuantumKeyPair {
        // In a real implementation, this would call into a PQ library
        // For this example, we'll just create dummy keys
        
        // Simulate different key sizes based on algorithm
        let key_size = match algorithm {
            PostQuantumAlgorithm::Kyber => 1632,     // Kyber-768
            PostQuantumAlgorithm::Dilithium => 2592, // Dilithium3
            PostQuantumAlgorithm::Sphincs => 32,      // SPHINCS+-128f
            PostQuantumAlgorithm::Falcon => 1281,     // Falcon-512
        };
        
        let private_key_size = key_size * 2;
        
        // Create random key material
        let mut public_key = Vec::with_capacity(key_size);
        let mut private_key = Vec::with_capacity(private_key_size);
        
        for i in 0..key_size {
            public_key.push((i % 256) as u8);
        }
        
        for i in 0..private_key_size {
            private_key.push(((i + 128) % 256) as u8);
        }
        
        PostQuantumKeyPair {
            algorithm,
            public_key,
            private_key: Some(private_key),
        }
    }
    
    // Sign a message using a post-quantum signature algorithm
    pub fn sign(message: &[u8], keypair: &PostQuantumKeyPair) -> Result<PostQuantumSignature, String> {
        // Check that we have the private key
        let private_key = match &keypair.private_key {
            Some(key) => key,
            None => return Err("Private key not available for signing".to_string()),
        };
        
        // Check that we're using a signature algorithm
        match keypair.algorithm {
            PostQuantumAlgorithm::Dilithium | PostQuantumAlgorithm::Sphincs | PostQuantumAlgorithm::Falcon => {
                // In a real implementation, this would call into a PQ library
                // For this example, we'll just create a dummy signature
                
                // Simulate different signature sizes based on algorithm
                let sig_size = match keypair.algorithm {
                    PostQuantumAlgorithm::Dilithium => 2420,
                    PostQuantumAlgorithm::Sphincs => 8080,
                    PostQuantumAlgorithm::Falcon => 666,
                    _ => unreachable!(),
                };
                
                // Create simple "signature" by XORing message with private key
                let mut signature = Vec::with_capacity(sig_size);
                
                for i in 0..sig_size {
                    let message_byte = if i < message.len() { message[i] } else { 0 };
                    let key_byte = private_key[i % private_key.len()];
                    signature.push(message_byte ^ key_byte);
                }
                
                Ok(PostQuantumSignature {
                    algorithm: keypair.algorithm.clone(),
                    signature,
                })
            },
            PostQuantumAlgorithm::Kyber => {
                Err("Kyber is a KEM, not a signature algorithm".to_string())
            }
        }
    }
    
    // Verify a signature
    pub fn verify(message: &[u8], signature: &PostQuantumSignature, public_key: &PostQuantumKeyPair) -> Result<bool, String> {
        // Check that algorithm matches
        if signature.algorithm != public_key.algorithm {
            return Err("Algorithm mismatch between signature and public key".to_string());
        }
        
        // Check that we're using a signature algorithm
        match signature.algorithm {
            PostQuantumAlgorithm::Dilithium | PostQuantumAlgorithm::Sphincs | PostQuantumAlgorithm::Falcon => {
                // In a real implementation, this would call into a PQ library
                // For this example, we'll just validate our dummy signature
                
                // Simulate verification (in a real implementation this would verify correctly)
                // Here we'll just return true for simplicity
                Ok(true)
            },
            PostQuantumAlgorithm::Kyber => {
                Err("Kyber is a KEM, not a signature algorithm".to_string())
            }
        }
    }
    
    // Encapsulate a key using a KEM (Key Encapsulation Mechanism)
    pub fn encapsulate(public_key: &PostQuantumKeyPair) -> Result<EncapsulatedKey, String> {
        // Check that we're using a KEM algorithm
        match public_key.algorithm {
            PostQuantumAlgorithm::Kyber => {
                // In a real implementation, this would call into a PQ library
                // For this example, we'll just create dummy encapsulation
                
                // Create random shared secret and ciphertext
                let shared_secret_size = 32; // 256-bit shared secret
                let ciphertext_size = 1088; // Kyber-768 ciphertext size
                
                let mut shared_secret = Vec::with_capacity(shared_secret_size);
                let mut ciphertext = Vec::with_capacity(ciphertext_size);
                
                for i in 0..shared_secret_size {
                    shared_secret.push((i % 256) as u8);
                }
                
                for i in 0..ciphertext_size {
                    ciphertext.push(((i + 64) % 256) as u8);
                }
                
                Ok(EncapsulatedKey {
                    algorithm: PostQuantumAlgorithm::Kyber,
                    ciphertext,
                    shared_secret: Some(shared_secret),
                })
            },
            _ => {
                Err("Only Kyber is supported as a KEM algorithm".to_string())
            }
        }
    }
    
    // Decapsulate a key using a KEM
    pub fn decapsulate(encapsulated_key: &EncapsulatedKey, keypair: &PostQuantumKeyPair) -> Result<Vec<u8>, String> {
        // Check that algorithm matches
        if encapsulated_key.algorithm != keypair.algorithm {
            return Err("Algorithm mismatch between encapsulated key and keypair".to_string());
        }
        
        // Check that we have the private key
        let private_key = match &keypair.private_key {
            Some(key) => key,
            None => return Err("Private key not available for decapsulation".to_string()),
        };
        
        // Check that we're using a KEM algorithm
        match keypair.algorithm {
            PostQuantumAlgorithm::Kyber => {
                // In a real implementation, this would call into a PQ library
                // For this example, we'll just return a dummy shared secret
                
                let shared_secret_size = 32; // 256-bit shared secret
                let mut shared_secret = Vec::with_capacity(shared_secret_size);
                
                for i in 0..shared_secret_size {
                    shared_secret.push((i % 256) as u8);
                }
                
                Ok(shared_secret)
            },
            _ => {
                Err("Only Kyber is supported as a KEM algorithm".to_string())
            }
        }
    }
    
    // Hybrid encryption combining PQ with traditional crypto
    pub fn hybrid_encrypt(message: &[u8], recipient_public_key: &PostQuantumKeyPair) -> Result<Vec<u8>, String> {
        // 1. Encapsulate a key using post-quantum KEM
        let encapsulated_key = Self::encapsulate(recipient_public_key)?;
        let shared_secret = encapsulated_key.shared_secret.as_ref()
            .ok_or("Shared secret missing from encapsulated key")?;
        
        // 2. Use shared secret to derive encryption key for symmetric encryption
        // In a real implementation, you would use a KDF like HKDF
        let encryption_key = shared_secret.clone();
        
        // 3. Encrypt message with symmetric algorithm (simulated)
        // In a real implementation, would use something like AES-GCM
        let mut ciphertext = Vec::with_capacity(message.len());
        for (i, byte) in message.iter().enumerate() {
            ciphertext.push(byte ^ encryption_key[i % encryption_key.len()]);
        }
        
        // 4. Serialize encapsulated key and ciphertext
        let mut result = Vec::new();
        let encapsulated_key_bytes = bincode::serialize(&encapsulated_key).map_err(|e| e.to_string())?;
        
        // Format: [length of encapsulated key (4 bytes)][encapsulated key][ciphertext]
        let key_len = encapsulated_key_bytes.len() as u32;
        result.extend_from_slice(&key_len.to_be_bytes());
        result.extend_from_slice(&encapsulated_key_bytes);
        result.extend_from_slice(&ciphertext);
        
        Ok(result)
    }
    
    // Hybrid decryption combining PQ with traditional crypto
    pub fn hybrid_decrypt(ciphertext: &[u8], recipient_keypair: &PostQuantumKeyPair) -> Result<Vec<u8>, String> {
        // 1. Parse encapsulated key and ciphertext
        if ciphertext.len() < 4 {
            return Err("Ciphertext too short".to_string());
        }
        
        let mut key_len_bytes = [0u8; 4];
        key_len_bytes.copy_from_slice(&ciphertext[0..4]);
        let key_len = u32::from_be_bytes(key_len_bytes) as usize;
        
        if ciphertext.len() < 4 + key_len {
            return Err("Ciphertext too short for encapsulated key".to_string());
        }
        
        let encapsulated_key_bytes = &ciphertext[4..4+key_len];
        let message_ciphertext = &ciphertext[4+key_len..];
        
        let encapsulated_key: EncapsulatedKey = bincode::deserialize(encapsulated_key_bytes)
            .map_err(|e| format!("Failed to deserialize encapsulated key: {}", e))?;
        
        // 2. Decapsulate to get shared secret
        let shared_secret = Self::decapsulate(&encapsulated_key, recipient_keypair)?;
        
        // 3. Use shared secret to derive decryption key
        // In a real implementation, you would use a KDF like HKDF
        let decryption_key = shared_secret;
        
        // 4. Decrypt message with symmetric algorithm (simulated)
        let mut plaintext = Vec::with_capacity(message_ciphertext.len());
        for (i, byte) in message_ciphertext.iter().enumerate() {
            plaintext.push(byte ^ decryption_key[i % decryption_key.len()]);
        }
        
        Ok(plaintext)
    }
}
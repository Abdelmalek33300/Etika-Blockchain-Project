// utils/migrationService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setSecureItem, getSecureItem, STORAGE_KEYS } from './secureStorage';
import { logError } from './errorTracking';

const MIGRATION_COMPLETED_KEY = 'etika_storage_migration_completed';

// Liste des clés à migrer d'AsyncStorage vers le stockage sécurisé
const keysToMigrate = [
  'auth_token', 
  'user_info',
  'onboarding_completed',
  'referral_code',
  'wallet_address',
  // Ajouter toutes les autres clés anciennes d'AsyncStorage
];

// Mapping des anciennes clés vers les nouvelles clés sécurisées
const keyMapping = {
  'auth_token': STORAGE_KEYS.AUTH_TOKEN,
  'user_info': STORAGE_KEYS.USER_INFO,
  'onboarding_completed': STORAGE_KEYS.ONBOARDING_COMPLETED,
  'referral_code': STORAGE_KEYS.REFERRAL_CODE,
  'wallet_address': STORAGE_KEYS.WALLET_ADDRESS,
  // Ajouter le mapping pour toutes les autres clés
};

/**
 * Vérifie si la migration a déjà été effectuée
 * @returns {Promise<boolean>}
 */
export async function isMigrationCompleted() {
  try {
    const migrationStatus = await AsyncStorage.getItem(MIGRATION_COMPLETED_KEY);
    return migrationStatus === 'true';
  } catch (error) {
    logError('Error checking migration status', error);
    return false;
  }
}

/**
 * Migre les données d'AsyncStorage vers le stockage sécurisé
 * @returns {Promise<boolean>} - Succès de l'opération
 */
export async function migrateToSecureStorage() {
  try {
    // Vérifier si la migration a déjà été effectuée
    if (await isMigrationCompleted()) {
      console.log('Migration already completed');
      return true;
    }

    console.log('Starting secure storage migration...');
    
    // Récupérer toutes les clés qui existent dans AsyncStorage
    const existingKeys = await AsyncStorage.getAllKeys();
    
    // Migrer les données clé par clé
    for (const oldKey of keysToMigrate) {
      if (existingKeys.includes(oldKey)) {
        // Récupérer la valeur depuis AsyncStorage
        const value = await AsyncStorage.getItem(oldKey);
        if (value !== null) {
          // Stocker la valeur dans le stockage sécurisé avec la nouvelle clé
          const newKey = keyMapping[oldKey] || oldKey;
          await setSecureItem(newKey, value);
          console.log(`Migrated ${oldKey} to secure storage`);
        }
      }
    }
    
    // Marquer la migration comme terminée
    await AsyncStorage.setItem(MIGRATION_COMPLETED_KEY, 'true');
    
    console.log('Secure storage migration completed successfully');
    return true;
  } catch (error) {
    logError('Error during secure storage migration', error);
    return false;
  }
}

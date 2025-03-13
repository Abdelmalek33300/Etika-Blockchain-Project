// App.js (version améliorée finale)
// Application mobile React Native pour Étika avec optimisations de sécurité

import React, { useEffect, useState, useRef } from 'react';
import { StatusBar, LogBox, Platform, AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store'; // Remplace AsyncStorage pour stocker les données sensibles
import { io } from 'socket.io-client';
import NetInfo from '@react-native-community/netinfo'; // Pour surveiller l'état de la connexion réseau

// Ignorez certains avertissements non critiques
LogBox.ignoreLogs([
  'ViewPropTypes will be removed',
  'AsyncStorage has been extracted from react-native',
]);

// Contextes
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ErrorProvider } from './contexts/ErrorContext'; // Contexte pour la gestion globale des erreurs

// Écrans
import HomeScreen from './screens/HomeScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import AuctionsScreen from './screens/AuctionsScreen';
import AuctionDetailScreen from './screens/AuctionDetailScreen';
import CertificatesScreen from './screens/CertificatesScreen';
import CertificateDetailScreen from './screens/CertificateDetailScreen';
import ProfileScreen from './screens/ProfileScreen';
import NGOSpaceScreen from './screens/NGOSpaceScreen';
import ScannerScreen from './screens/ScannerScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import ReferralScreen from './screens/ReferralScreen';
import ErrorScreen from './screens/ErrorScreen'; // Écran pour afficher les erreurs globales

// Composants
import LoadingScreen from './components/LoadingScreen';
import NotificationOverlay from './components/NotificationOverlay';
import ErrorBoundary from './components/ErrorBoundary'; // Composant pour capturer les erreurs React

// Thème et styles
import { theme } from './styles/theme';

// Services
import { API_URL } from './config';
import { initErrorTracking, logError } from './utils/errorTracking';
import { migrateToSecureStorage } from './utils/migrationService'; // Service de migration

// Créer les navigateurs
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const AuthStack = createNativeStackNavigator();
const MainStack = createNativeStackNavigator();

// Navigateur d'authentification
const AuthNavigator = () => (
  <AuthStack.Navigator 
    screenOptions={{ 
      headerShown: false,
      animation: 'fade'
    }}
  >
    <AuthStack.Screen name="Login" component={LoginScreen} />
    <AuthStack.Screen name="Register" component={RegisterScreen} />
  </AuthStack.Navigator>
);

// Navigateur principal avec tabs
const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Auctions') {
            iconName = focused ? 'gavel' : 'gavel';
          } else if (route.name === 'Certificates') {
            iconName = focused ? 'certificate' : 'certificate-outline';
          } else if (route.name === 'Scan') {
            iconName = focused ? 'qrcode-scan' : 'qrcode-scan';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'account' : 'account-outline';
          }

          return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Auctions" component={AuctionsScreen} />
      <Tab.Screen name="Certificates" component={CertificatesScreen} />
      <Tab.Screen name="Scan" component={ScannerScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

// Navigateur principal (après authentification)
const MainNavigator = () => (
  <MainStack.Navigator
    screenOptions={{
      headerStyle: {
        backgroundColor: theme.colors.primary,
      },
      headerTintColor: '#fff',
    }}
  >
    <MainStack.Screen 
      name="Tabs" 
      component={TabNavigator} 
      options={{ headerShown: false }}
    />
    <MainStack.Screen 
      name="AuctionDetail" 
      component={AuctionDetailScreen} 
      options={({ route }) => ({ title: route.params?.title || 'Enchère' })}
    />
    <MainStack.Screen 
      name="CertificateDetail" 
      component={CertificateDetailScreen} 
      options={({ route }) => ({ title: route.params?.title || 'Certificat' })}
    />
    <MainStack.Screen 
      name="NGOSpace" 
      component={NGOSpaceScreen} 
      options={({ route }) => ({ title: route.params?.name || 'Espace ONG' })}
    />
    <MainStack.Screen 
      name="Referral" 
      component={ReferralScreen} 
      options={{ title: 'Parrainage' }}
    />
    <MainStack.Screen 
      name="Error" 
      component={ErrorScreen} 
      options={{ title: 'Erreur' }}
    />
  </MainStack.Navigator>
);

// Navigation principale de l'application
const AppNavigator = () => {
  const { user, loading, isFirstLaunch } = useAuth();
  
  if (loading) {
    return <LoadingScreen />;
  }
  
  return (
    <NavigationContainer theme={theme.navigation}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isFirstLaunch ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : user ? (
          <Stack.Screen name="Main" component={MainNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

// Composant principal de l'application
const App = () => {
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null); // Référence pour suivre l'instance du socket
  const appState = useRef(AppState.currentState);
  const [appInitialized, setAppInitialized] = useState(false);
  
  // Initialisation de l'application
  const initializeApp = async () => {
    try {
      // Initialiser le suivi des erreurs
      initErrorTracking();
      
      // Migrer les données vers le stockage sécurisé
      await migrateToSecureStorage();
      
      // Marquer l'initialisation comme terminée
      setAppInitialized(true);
    } catch (error) {
      logError('Error during app initialization', error);
      // Même en cas d'erreur, on considère l'app comme initialisée pour ne pas bloquer l'utilisateur
      setAppInitialized(true);
    }
  };
  
  // Initialisation au premier rendu
  useEffect(() => {
    initializeApp();
  }, []);
  
  // Gestionnaire du changement d'état de l'application
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // L'application revient au premier plan, reconnecter le socket si nécessaire
        reconnectSocket();
      } else if (nextAppState.match(/inactive|background/)) {
        // L'application passe en arrière-plan, déconnecter le socket proprement
        disconnectSocket();
      }
      
      appState.current = nextAppState;
    });
    
    return () => {
      subscription.remove();
    };
  }, []);
  
  // Gestionnaire de l'état de la connexion réseau
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && socketRef.current === null) {
        // Connexion réseau restaurée, reconnecter le socket
        reconnectSocket();
      } else if (!state.isConnected && socketRef.current) {
        // Connexion réseau perdue, déconnecter proprement le socket
        disconnectSocket();
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, []);
  
  // Fonction pour établir la connexion socket avec authentification JWT
  const connectSocket = async () => {
    try {
      // Vérifier si un socket existe déjà et le déconnecter proprement
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      
      // Récupérer le token d'authentification depuis le stockage sécurisé
      const authToken = await SecureStore.getItemAsync('etika_auth_token');
      
      // Configurer le socket avec des options de reconnexion et le token JWT
      const socketInstance = io(API_URL, {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
        auth: {
          token: authToken || ''
        }
      });
      
      // Gestionnaires d'événements pour le socket
      socketInstance.on('connect', () => {
        console.log('Socket connecté:', socketInstance.id);
      });
      
      socketInstance.on('connect_error', (error) => {
        logError('Socket connection error', error);
      });
      
      socketInstance.on('disconnect', (reason) => {
        console.log('Socket déconnecté:', reason);
        if (reason === 'io server disconnect') {
          // Le serveur a forcé la déconnexion, tenter de se reconnecter
          setTimeout(() => {
            socketInstance.connect();
          }, 1000);
        }
      });
      
      socketInstance.on('reconnect', (attemptNumber) => {
        console.log('Socket reconnecté après', attemptNumber, 'tentatives');
      });
      
      socketInstance.on('reconnect_failed', () => {
        logError('Socket reconnection failed after max attempts');
      });
      
      // Mettre à jour l'état et la référence
      setSocket(socketInstance);
      socketRef.current = socketInstance;
    } catch (error) {
      logError('Error initializing socket', error);
    }
  };
  
  // Fonction pour déconnecter proprement le socket
  const disconnectSocket = () => {
    try {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
    } catch (error) {
      logError('Error disconnecting socket', error);
    }
  };
  
  // Fonction pour reconnecter le socket
  const reconnectSocket = () => {
    disconnectSocket();
    connectSocket();
  };
  
  // Connexion initiale du socket après initialisation
  useEffect(() => {
    if (appInitialized) {
      connectSocket();
    }
    
    return () => {
      disconnectSocket();
    };
  }, [appInitialized]);
  
  // Afficher le chargement pendant l'initialisation
  if (!appInitialized) {
    return <LoadingScreen />;
  }
  
  return (
    <ErrorBoundary fallback={<ErrorScreen />}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <PaperProvider theme={theme.paper}>
          <ErrorProvider>
            <AuthProvider>
              <NotificationProvider>
                <AppNavigator socket={socket} />
                <NotificationOverlay />
              </NotificationProvider>
            </AuthProvider>
          </ErrorProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
};

export default App;

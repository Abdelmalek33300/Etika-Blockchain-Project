// App.js
// Application mobile React Native pour Étika

import React, { useEffect, useState } from 'react';
import { StatusBar, LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';
import { Provider as PaperProvider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Ignorez certains avertissements non critiques
LogBox.ignoreLogs([
  'ViewPropTypes will be removed',
  'AsyncStorage has been extracted from react-native',
]);

// Contextes
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';

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

// Composants
import LoadingScreen from './components/LoadingScreen';
import NotificationOverlay from './components/NotificationOverlay';

// Thème et styles
import { theme } from './styles/theme';

// Services
import { API_URL } from './config';

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
  
  useEffect(() => {
    // Initialisation de Socket.IO
    const socketInstance = io(API_URL);
    setSocket(socketInstance);
    
    return () => {
      if (socketInstance) socketInstance.disconnect();
    };
  }, []);
  
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <PaperProvider theme={theme.paper}>
        <AuthProvider>
          <NotificationProvider>
            <AppNavigator />
            <NotificationOverlay />
          </NotificationProvider>
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
};

export default App;

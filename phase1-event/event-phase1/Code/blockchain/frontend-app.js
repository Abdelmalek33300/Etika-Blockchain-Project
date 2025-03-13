// src/App.js
// Application React pour l'interface utilisateur d'Étika

import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { io } from 'socket.io-client';

// Contextes
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';

// Composants de page
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AuctionsPage from './pages/AuctionsPage';
import AuctionDetailPage from './pages/AuctionDetailPage';
import CertificatesPage from './pages/CertificatesPage';
import CertificateDetailPage from './pages/CertificateDetailPage';
import ProfilePage from './pages/ProfilePage';
import NGOSpacePage from './pages/NGOSpacePage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AboutPage from './pages/AboutPage';
import NotFoundPage from './pages/NotFoundPage';

// Composants de layout
import Layout from './components/Layout';
import Notification from './components/Notification';
import LoadingScreen from './components/LoadingScreen';

// Styles et thème
import './styles/global.css';

// Création du thème Étika
const theme = createTheme({
  palette: {
    primary: {
      main: '#2E7D32', // Vert nature
      light: '#4CAF50',
      dark: '#1B5E20',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#1976D2', // Bleu social
      light: '#42A5F5',
      dark: '#0D47A1',
      contrastText: '#FFFFFF',
    },
    error: {
      main: '#D32F2F',
    },
    warning: {
      main: '#FFA000',
    },
    info: {
      main: '#0288D1',
    },
    success: {
      main: '#388E3C',
    },
    background: {
      default: '#F5F7FA',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1F2937',
      secondary: '#4B5563',
    },
  },
  typography: {
    fontFamily: "'Poppins', 'Roboto', 'Arial', sans-serif",
    h1: {
      fontWeight: 700,
    },
    h2: {
      fontWeight: 600,
    },
    h3: {
      fontWeight: 600,
    },
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 500,
    },
    h6: {
      fontWeight: 500,
    },
    button: {
      fontWeight: 500,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 8,
  },
  shadows: [
    'none',
    '0px 2px 4px rgba(31, 41, 55, 0.06)',
    '0px 4px 6px rgba(31, 41, 55, 0.1)',
    // ... autres niveaux d'ombre
    '0px 20px 25px rgba(31, 41, 55, 0.15)',
  ],
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '10px 22px',
        },
        containedPrimary: {
          '&:hover': {
            backgroundColor: '#388E3C',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0px 4px 8px rgba(31, 41, 55, 0.08)',
        },
      },
    },
  },
});

// Composant principal de l'application
const App = () => {
  const [socket, setSocket] = useState(null);
  
  useEffect(() => {
    // Connexion à Socket.IO
    const socketInstance = io(process.env.REACT_APP_API_URL || 'http://localhost:5000');
    setSocket(socketInstance);
    
    return () => {
      if (socketInstance) socketInstance.disconnect();
    };
  }, []);
  
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <NotificationProvider>
          <Router>
            <AppRoutes socket={socket} />
            <Notification />
          </Router>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

// Routes de l'application avec protection d'authentification
const AppRoutes = ({ socket }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <LoadingScreen />;
  }
  
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={!user ? <LoginPage /> : <Navigate to="/" />} />
        <Route path="register" element={!user ? <RegisterPage /> : <Navigate to="/" />} />
        <Route path="auctions" element={<AuctionsPage socket={socket} />} />
        <Route path="auctions/:id" element={<AuctionDetailPage socket={socket} />} />
        <Route path="certificates" element={user ? <CertificatesPage /> : <Navigate to="/login" />} />
        <Route path="certificates/:id" element={<CertificateDetailPage />} />
        <Route path="profile" element={user ? <ProfilePage /> : <Navigate to="/login" />} />
        <Route path="ngo/:id" element={<NGOSpacePage />} />
        <Route path="about" element={<AboutPage />} />
        
        {/* Routes Admin (protégées) */}
        <Route 
          path="admin/*" 
          element={user && user.role === 'admin' ? <AdminDashboard /> : <Navigate to="/" />} 
        />
        
        {/* Route 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
};

export default App;

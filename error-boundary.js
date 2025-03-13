// components/ErrorBoundary.js
// Composant pour capturer les erreurs non gérées dans les composants React

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { logError } from '../utils/errorTracking';
import { theme } from '../styles/theme';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    // Mettre à jour l'état pour afficher le fallback
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Enregistrer l'erreur dans notre système de suivi
    logError('React component error', error, {
      componentStack: errorInfo.componentStack,
      componentName: this.props.componentName || 'Unknown'
    });
    
    // Mettre à jour l'état avec les informations détaillées sur l'erreur
    this.setState({ errorInfo });
  }
  
  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      // Utiliser le fallback personnalisé si fourni
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      // Sinon, afficher notre UI d'erreur par défaut
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Oups !</Text>
          <Text style={styles.subtitle}>Un problème est survenu</Text>
          
          <View style={styles.card}>
            <Text style={styles.errorText}>
              {this.state.error && this.state.error.toString()}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.button}
            onPress={this.resetError}
          >
            <Text style={styles.buttonText}>Réessayer</Text>
          </TouchableOpacity>
          
          {/* Afficher les détails de l'erreur en mode développement uniquement */}
          {__DEV__ && this.state.errorInfo && (
            <View style={styles.devInfoContainer}>
              <Text style={styles.devInfoTitle}>Détails pour les développeurs:</Text>
              <Text style={styles.devInfoText}>
                {this.state.errorInfo.componentStack}
              </Text>
            </View>
          )}
        </View>
      );
    }

    // Si pas d'erreur, afficher les enfants normalement
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.error,
    marginBottom: 10
  },
  subtitle: {
    fontSize: 16,
    color: '#555',
    marginBottom: 20,
    textAlign: 'center'
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    width: '100%',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  errorText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10
  },
  button: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold'
  },
  devInfoContainer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#eee',
    borderRadius: 5,
    width: '100%'
  },
  devInfoTitle: {
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333'
  },
  devInfoText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace'
  }
});

export default ErrorBoundary;

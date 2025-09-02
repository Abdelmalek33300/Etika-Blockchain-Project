import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Shield, 
  RefreshCcw 
} from 'lucide-react';

// Types
interface Transaction {
  id: string;
  type: 'direct_sale' | 'retail_sale' | 'complex_sale' | 'system';
  amount: number;
  timestamp: number;
  status: 'pending' | 'in_progress' | 'confirmed' | 'failed' | 'expired';
  validators: {
    address: string;
    role: 'consumer' | 'merchant' | 'producer' | 'supplier' | 'subcontractor';
    order: number;
    status: 'pending' | 'validated' | 'rejected';
  }[];
  signatures: {
    validator: string;
    signature: string;
    timestamp: number;
  }[];
  validationDeadline: number;
}

interface SecurityEvent {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

// Composant principal
const RealtimeSecurity = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [wsStatus, setWsStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    // Simulation WebSocket pour l'exemple
    const wsUrl = 'wss://api.example.com/realtime';
    let ws: WebSocket;

    const connect = () => {
      try {
        setWsStatus('disconnected');
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setWsStatus('connected');
          console.log('WebSocket connected');
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          handleRealtimeUpdate(data);
        };

        ws.onerror = (error) => {
          setWsStatus('error');
          console.error('WebSocket error:', error);
        };

        ws.onclose = () => {
          setWsStatus('disconnected');
          setTimeout(connect, 5000); // Reconnexion après 5 secondes
        };
      } catch (error) {
        console.error('WebSocket connection error:', error);
        setWsStatus('error');
      }
    };

    connect();

    // Cleanup
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  const handleRealtimeUpdate = (data: any) => {
    setLastUpdate(new Date());

    switch (data.type) {
      case 'transaction':
        setTransactions(prev => [...prev, data.transaction]);
        break;
      case 'security':
        setSecurityEvents(prev => [...prev, data.event]);
        break;
      default:
        console.warn('Unknown realtime update type:', data.type);
    }
  };

  const handleValidation = async (transactionId: string, decision: boolean) => {
    try {
      // Simulation de la validation
      const response = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId, decision })
      });

      if (!response.ok) {
        throw new Error('Validation failed');
      }

      setTransactions(prev =>
        prev.map(tx =>
          tx.id === transactionId
            ? { ...tx, status: decision ? 'confirmed' : 'failed' }
            : tx
        )
      );
    } catch (error) {
      console.error('Validation error:', error);
      // Ajouter un événement de sécurité pour l'erreur
      setSecurityEvents(prev => [...prev, {
        id: crypto.randomUUID(),
        type: 'error',
        message: 'Échec de la validation',
        timestamp: Date.now()
      }]);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Status de la connexion */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge 
            variant={wsStatus === 'connected' ? 'default' : 'destructive'}
          >
            {wsStatus === 'connected' ? 'Connecté' : 'Déconnecté'}
          </Badge>
          <span className="text-sm text-gray-500">
            Dernière mise à jour: {lastUpdate.toLocaleTimeString()}
          </span>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => window.location.reload()}
        >
          <RefreshCcw className="w-4 h-4 mr-2" />
          Reconnecter
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Transactions en temps réel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Transactions en Temps Réel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {transactions.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    Aucune transaction en attente
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {transactions.map(transaction => (
                    <Card key={transaction.id} className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">
                            Transaction #{transaction.id}
                          </h4>
                          <p className="text-sm text-gray-500">
                            Montant: €{transaction.amount}
                          </p>
                          <p className="text-sm text-gray-500">
                            {new Date(transaction.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleValidation(transaction.id, true)}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Valider
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleValidation(transaction.id, false)}
                          >
                            <AlertCircle className="w-4 h-4 mr-1" />
                            Rejeter
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Événements de sécurité */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Événements de Sécurité
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {securityEvents.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    Aucun événement de sécurité
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {securityEvents.map(event => (
                    <Alert
                      key={event.id}
                      variant={event.type === 'error' ? 'destructive' : 'default'}
                    >
                      <AlertCircle className="w-4 h-4" />
                      <AlertDescription>
                        <div className="flex flex-col">
                          <span>{event.message}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(event.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RealtimeSecurity;
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import {
  Activity,
  AlertTriangle,
  BarChart2,
  RefreshCcw,
  Shield,
  Wifi
} from 'lucide-react';

// Types stricts
interface MetricData {
  timestamp: string;
  transactionCount: number;
  validationTime: number;
  errorRate: number;
  networkLatency: number;
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  mainNetwork: boolean;
  backup: boolean;
  load: number;
  replication: boolean;
  lastUpdate: string;
}

interface Alert {
  id: string;
  type: 'warning' | 'error' | 'critical';
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

// Hook personnalisé pour la gestion des métriques
const useMetrics = () => {
  const [data, setData] = useState<MetricData[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      // Simulation de données pour l'exemple
      const newMetric: MetricData = {
        timestamp: new Date().toISOString(),
        transactionCount: Math.floor(Math.random() * 100),
        validationTime: Math.floor(Math.random() * 1000),
        errorRate: Math.random() * 5,
        networkLatency: Math.floor(Math.random() * 200)
      };
      
      setData(prev => [...prev.slice(-19), newMetric]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch metrics'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  return { data, error, loading };
};

// Hook personnalisé pour la gestion du système
const useSystemHealth = () => {
  const [health, setHealth] = useState<SystemHealth>({
    status: 'healthy',
    mainNetwork: true,
    backup: true,
    load: 0,
    replication: true,
    lastUpdate: new Date().toISOString()
  });

  const [alerts, setAlerts] = useState<Alert[]>([]);

  const addAlert = useCallback((alert: Omit<Alert, 'id' | 'timestamp' | 'acknowledged'>) => {
    const newAlert: Alert = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      acknowledged: false,
      ...alert
    };
    setAlerts(prev => [newAlert, ...prev]);
  }, []);

  const updateHealth = useCallback((updates: Partial<SystemHealth>) => {
    setHealth(prev => {
      const newHealth = { ...prev, ...updates };
      // Vérification automatique du statut
      if (newHealth.load > 90 || !newHealth.mainNetwork) {
        newHealth.status = 'critical';
      } else if (newHealth.load > 70 || !newHealth.backup) {
        newHealth.status = 'degraded';
      } else {
        newHealth.status = 'healthy';
      }
      return newHealth;
    });
  }, []);

  return { health, alerts, addAlert, updateHealth };
};

// Composant graphique amélioré
const EnhancedMetricsChart: React.FC<{ data: MetricData[] }> = ({ data }) => {
  const metrics = useMemo(() => [
    { key: 'transactionCount', name: 'Transactions', color: '#8884d8' },
    { key: 'validationTime', name: 'Temps de Validation', color: '#82ca9d' },
    { key: 'errorRate', name: 'Taux d\'Erreur', color: '#ff7300' }
  ], []);

  return (
    <Card className="h-96">
      <CardHeader>
        <CardTitle>Métriques en Temps Réel</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={str => new Date(str).toLocaleTimeString()}
            />
            <YAxis />
            <Tooltip 
              labelFormatter={value => new Date(value).toLocaleString()}
            />
            <Legend />
            {metrics.map(({ key, name, color }) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={name}
                stroke={color}
                dot={false}
                activeDot={{ r: 8 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

// Composant d'alertes amélioré
const AlertSystem: React.FC<{ alerts: Alert[] }> = ({ alerts }) => {
  const groupedAlerts = useMemo(() => {
    return alerts.reduce((acc, alert) => {
      if (!acc[alert.type]) {
        acc[alert.type] = [];
      }
      acc[alert.type].push(alert);
      return acc;
    }, {} as Record<Alert['type'], Alert[]>);
  }, [alerts]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Alertes Système
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          {Object.entries(groupedAlerts).map(([type, typeAlerts]) => (
            <div key={type} className="mb-4">
              <h4 className="font-medium mb-2 capitalize">{type}</h4>
              <div className="space-y-2">
                {typeAlerts.map(alert => (
                  <Alert
                    key={alert.id}
                    variant={
                      type === 'critical' 
                        ? 'destructive' 
                        : type === 'error' 
                        ? 'destructive' 
                        : 'default'
                    }
                  >
                    <AlertDescription className="flex justify-between items-center">
                      <span>{alert.message}</span>
                      <Badge variant="outline">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </Badge>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </div>
          ))}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

// Composant principal amélioré
const EnhancedMonitoringSystem: React.FC = () => {
  const { data, error, loading } = useMetrics();
  const { health, alerts, addAlert, updateHealth } = useSystemHealth();

  // Démo : ajout d'alertes basées sur les métriques
  useEffect(() => {
    if (data.length > 0) {
      const latestMetric = data[data.length - 1];
      if (latestMetric.errorRate > 4) {
        addAlert({
          type: 'critical',
          message: `Taux d'erreur critique : ${latestMetric.errorRate.toFixed(2)}%`
        });
      }
      if (latestMetric.networkLatency > 150) {
        addAlert({
          type: 'warning',
          message: `Latence réseau élevée : ${latestMetric.networkLatency}ms`
        });
      }
    }
  }, [data, addAlert]);

  // Simulation de mises à jour du système
  useEffect(() => {
    const interval = setInterval(() => {
      updateHealth({
        load: Math.floor(Math.random() * 100),
        replication: Math.random() > 0.1,
        lastUpdate: new Date().toISOString()
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [updateHealth]);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Erreur de chargement des métriques: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Statut du système */}
      <div className="flex items-center justify-between">
        <Badge 
          variant={
            health.status === 'healthy' 
              ? 'default' 
              : health.status === 'degraded' 
              ? 'secondary' 
              : 'destructive'
          }
        >
          {health.status.toUpperCase()}
        </Badge>
        <span className="text-sm text-gray-500">
          Dernière mise à jour: {new Date(health.lastUpdate).toLocaleTimeString()}
        </span>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">
            <Activity className="w-4 h-4 mr-2" />
            Vue d'ensemble
          </TabsTrigger>
          <TabsTrigger value="alerts">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Alertes {alerts.length > 0 && `(${alerts.length})`}
          </TabsTrigger>
          <TabsTrigger value="system">
            <Shield className="w-4 h-4 mr-2" />
            Système
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="space-y-4">
            <EnhancedMetricsChart data={data} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Statistiques détaillées */}
              {loading && (
                <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                  <RefreshCcw className="w-6 h-6 animate-spin" />
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="alerts">
          <AlertSystem alerts={alerts} />
        </TabsContent>

        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle>État du Système</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Wifi className="w-4 h-4" />
                    <span>Réseau Principal</span>
                  </div>
                  <Badge variant={health.mainNetwork ? 'default' : 'destructive'}>
                    {health.mainNetwork ? 'En ligne' : 'Hors ligne'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    <span>Charge CPU</span>
                  </div>
                  <Badge 
                    variant={
                      health.load > 90 
                        ? 'destructive' 
                        : health.load > 70 
                        ? 'secondary' 
                        : 'default'
                    }
                  >
                    {health.load}%
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EnhancedMonitoringSystem;
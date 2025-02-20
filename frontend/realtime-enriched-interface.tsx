import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import { Activity, AlertCircle, BarChart2, ArrowUp, ArrowDown } from 'lucide-react';

// Types pour la carte de chaleur
type HeatmapData = {
  hour: number;
  day: string;
  value: number;
};

// Types pour les métriques réseau
type NetworkMetric = {
  timestamp: number;
  latency: number;
  throughput: number;
  errorRate: number;
  status: 'normal' | 'warning' | 'critical';
};

// Types pour l'historique des validations
type ValidationEvent = {
  id: string;
  timestamp: number;
  type: string;
  status: 'success' | 'pending' | 'failed';
  duration: number;
  validators: number;
};

// Composant de Carte de Chaleur
const TransactionHeatmap = () => {
  const [data, setData] = useState<HeatmapData[]>([]);
  const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  useEffect(() => {
    // Simulation de données de transactions
    const newData = days.flatMap(day =>
      hours.map(hour => ({
        hour,
        day,
        value: Math.floor(Math.random() * 100)
      }))
    );
    setData(newData);
  }, []);

  return (
    <Card className="h-96">
      <CardHeader>
        <CardTitle>Distribution des Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-25 gap-1">
          {data.map((cell, index) => (
            <div
              key={index}
              className="w-full h-4 rounded"
              style={{
                backgroundColor: `rgb(0, 0, ${Math.floor((cell.value / 100) * 255)})`,
                opacity: cell.value / 100
              }}
              title={`${cell.day} ${cell.hour}h: ${cell.value} transactions`}
            />
          ))}
        </div>
        <div className="mt-4 flex justify-between text-sm text-gray-500">
          <span>Moins actif</span>
          <span>Plus actif</span>
        </div>
      </CardContent>
    </Card>
  );
};

// Composant de Performance Réseau
const NetworkPerformance = () => {
  const [metrics, setMetrics] = useState<NetworkMetric[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      const newMetric: NetworkMetric = {
        timestamp: Date.now(),
        latency: Math.random() * 100,
        throughput: Math.random() * 1000,
        errorRate: Math.random() * 5,
        status: 'normal'
      };
      setMetrics(prev => [...prev.slice(-20), newMetric]);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Réseau</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={metrics}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={(value) => new Date(value).toLocaleTimeString()} 
            />
            <YAxis />
            <Tooltip 
              labelFormatter={(value) => new Date(value).toLocaleString()}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="latency" 
              stroke="#8884d8" 
              name="Latence (ms)"
            />
            <Line 
              type="monotone" 
              dataKey="throughput" 
              stroke="#82ca9d" 
              name="Débit"
            />
            <Line 
              type="monotone" 
              dataKey="errorRate" 
              stroke="#ff7300" 
              name="Taux d'erreur"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

// Composant d'Historique des Validations
const ValidationHistory = () => {
  const [history, setHistory] = useState<ValidationEvent[]>([]);

  useEffect(() => {
    // Simulation de l'historique
    const generateHistory = () => {
      const newEvent: ValidationEvent = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        type: ['Standard', 'Complexe', 'Prioritaire'][Math.floor(Math.random() * 3)],
        status: ['success', 'pending', 'failed'][Math.floor(Math.random() * 3)] as 'success' | 'pending' | 'failed',
        duration: Math.random() * 1000,
        validators: Math.floor(Math.random() * 3) + 2
      };
      setHistory(prev => [...prev.slice(-50), newEvent]);
    };

    const interval = setInterval(generateHistory, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historique des Validations</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-2">
            {history.map((event) => (
              <Alert
                key={event.id}
                variant={
                  event.status === 'success' 
                    ? 'default' 
                    : event.status === 'failed' 
                    ? 'destructive' 
                    : 'secondary'
                }
              >
                <AlertDescription className="flex justify-between items-center">
                  <div>
                    <span className="font-medium">{event.type}</span>
                    <span className="text-sm text-gray-500 ml-2">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge>
                      {event.duration.toFixed(0)}ms
                    </Badge>
                    <Badge variant="outline">
                      {event.validators} validateurs
                    </Badge>
                  </div>
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

// Composant Principal
const RealtimeInterface = () => {
  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TransactionHeatmap />
        <NetworkPerformance />
      </div>
      
      <ValidationHistory />
    </div>
  );
};

export default RealtimeInterface;
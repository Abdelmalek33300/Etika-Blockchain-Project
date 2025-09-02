import React, { useState, useEffect } from 'react';
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
  Fingerprint,
  Globe,
  Lock,
  RefreshCcw,
  Shield,
  Smartphone,
  Wifi
} from 'lucide-react';

// Interface Temps Réel Enrichie
const RealtimeMetrics = ({ data }) => {
  return (
    <Card className="h-96">
      <CardHeader>
        <CardTitle>Métriques en Temps Réel</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="transactionCount" 
              stroke="#8884d8" 
              name="Transactions"
            />
            <Line 
              type="monotone" 
              dataKey="validationTime" 
              stroke="#82ca9d" 
              name="Temps de Validation"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

// Module Analytics
const AnalyticsModule = ({ predictions }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5" />
          Analyses Prédictives
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {predictions.map((prediction, index) => (
            <div key={index} className="flex justify-between items-center p-2 border rounded">
              <div>
                <h4 className="font-medium">{prediction.type}</h4>
                <p className="text-sm text-gray-500">{prediction.description}</p>
              </div>
              <Badge 
                variant={prediction.risk === 'high' ? 'destructive' : 'default'}
              >
                {prediction.confidence}%
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Validation Multi-facteurs
const MultifactorValidation = ({ onValidate }) => {
  const [validationStep, setValidationStep] = useState('qr');
  const [validationStatus, setValidationStatus] = useState({});

  const handleValidation = async (method) => {
    setValidationStatus(prev => ({ ...prev, [method]: 'pending' }));
    try {
      // Simulation de validation
      await new Promise(resolve => setTimeout(resolve, 1000));
      setValidationStatus(prev => ({ ...prev, [method]: 'success' }));
      setValidationStep(getNextStep(method));
    } catch (error) {
      setValidationStatus(prev => ({ ...prev, [method]: 'error' }));
    }
  };

  const getNextStep = (currentStep) => {
    const steps = {
      qr: 'biometric',
      biometric: 'token',
      token: 'complete'
    };
    return steps[currentStep] || currentStep;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Validation Multi-facteurs
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between mb-6">
            {['qr', 'biometric', 'token'].map((step) => (
              <Badge 
                key={step}
                variant={validationStep === step ? 'default' : 'secondary'}
              >
                {step.charAt(0).toUpperCase() + step.slice(1)}
              </Badge>
            ))}
          </div>

          {validationStep === 'qr' && (
            <Button 
              className="w-full" 
              onClick={() => handleValidation('qr')}
            >
              Scanner QR Code
            </Button>
          )}

          {validationStep === 'biometric' && (
            <Button 
              className="w-full"
              onClick={() => handleValidation('biometric')}
            >
              <Fingerprint className="w-4 h-4 mr-2" />
              Validation Biométrique
            </Button>
          )}

          {validationStep === 'token' && (
            <Button 
              className="w-full"
              onClick={() => handleValidation('token')}
            >
              <Lock className="w-4 h-4 mr-2" />
              Valider Token
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Système de Résilience
const ResilienceSystem = ({ systemStatus }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCcw className="w-5 h-5" />
          État du Système
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4" />
                  <span>Réseau Principal</span>
                </div>
                <Badge variant={systemStatus.mainNetwork ? 'default' : 'destructive'}>
                  {systemStatus.mainNetwork ? 'En ligne' : 'Hors ligne'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <RefreshCcw className="w-4 h-4" />
                  <span>Backup</span>
                </div>
                <Badge variant={systemStatus.backup ? 'default' : 'destructive'}>
                  {systemStatus.backup ? 'Prêt' : 'Non disponible'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  <span>Charge</span>
                </div>
                <Badge 
                  variant={systemStatus.load < 80 ? 'default' : 'destructive'}
                >
                  {systemStatus.load}%
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  <span>Réplication</span>
                </div>
                <Badge 
                  variant={systemStatus.replication ? 'default' : 'destructive'}
                >
                  {systemStatus.replication ? 'Synchronisé' : 'Désynchronisé'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {systemStatus.alerts.length > 0 && (
          <div className="mt-4">
            <h4 className="font-medium mb-2">Alertes Système</h4>
            <ScrollArea className="h-32">
              {systemStatus.alerts.map((alert, index) => (
                <Alert key={index} variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>{alert}</AlertDescription>
                </Alert>
              ))}
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Composant Principal
const AdvancedMonitoringSystem = () => {
  const [metricsData, setMetricsData] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [systemStatus, setSystemStatus] = useState({
    mainNetwork: true,
    backup: true,
    load: 45,
    replication: true,
    alerts: []
  });

  useEffect(() => {
    // Simuler les données en temps réel
    const interval = setInterval(() => {
      // Mettre à jour les métriques
      setMetricsData(prev => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          transactionCount: Math.floor(Math.random() * 100),
          validationTime: Math.floor(Math.random() * 1000)
        }
      ].slice(-20));

      // Mettre à jour les prédictions
      setPredictions([
        {
          type: 'Charge Réseau',
          description: 'Pic de trafic prévu dans 30 minutes',
          confidence: 85,
          risk: 'medium'
        },
        {
          type: 'Sécurité',
          description: 'Motif suspect détecté',
          confidence: 92,
          risk: 'high'
        }
      ]);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4 space-y-4">
      <Tabs defaultValue="metrics">
        <TabsList>
          <TabsTrigger value="metrics">
            <Activity className="w-4 h-4 mr-2" />
            Métriques
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart2 className="w-4 h-4 mr-2" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="validation">
            <Shield className="w-4 h-4 mr-2" />
            Validation
          </TabsTrigger>
          <TabsTrigger value="resilience">
            <RefreshCcw className="w-4 h-4 mr-2" />
            Résilience
          </TabsTrigger>
        </TabsList>

        <TabsContent value="metrics">
          <RealtimeMetrics data={metricsData} />
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsModule predictions={predictions} />
        </TabsContent>

        <TabsContent value="validation">
          <MultifactorValidation onValidate={() => {}} />
        </TabsContent>

        <TabsContent value="resilience">
          <ResilienceSystem systemStatus={systemStatus} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdvancedMonitoringSystem;
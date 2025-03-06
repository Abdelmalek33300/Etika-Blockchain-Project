import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell 
} from 'recharts';
import { 
  TrendingUp, 
  AlertTriangle, 
  BarChart2, 
  Clock,
  Shield,
  AlertCircle
} from 'lucide-react';

// Types pour les analyses
interface RiskPrediction {
  timestamp: number;
  category: string;
  riskLevel: number;
  confidence: number;
  factors: string[];
}

interface ValidationPattern {
  pattern: string;
  frequency: number;
  avgDuration: number;
  successRate: number;
  trend: 'increasing' | 'stable' | 'decreasing';
}

interface SecurityTrend {
  category: string;
  incidents: number;
  severity: 'low' | 'medium' | 'high';
  weekOverWeek: number;
}

interface PerformanceMetric {
  timestamp: number;
  metric: string;
  value: number;
  threshold: number;
  status: 'normal' | 'warning' | 'critical';
}

// Composant d'Analyse Prédictive des Risques
const PredictiveRiskAnalysis = () => {
  const [predictions, setPredictions] = useState<RiskPrediction[]>([]);

  useEffect(() => {
    // Simulation de prédictions
    const categories = ['Transaction', 'Validation', 'Réseau', 'Sécurité'];
    const factors = [
      'Volume anormal',
      'Latence élevée',
      'Pattern suspect',
      'Échecs multiples'
    ];

    const interval = setInterval(() => {
      const newPredictions = categories.map(category => ({
        timestamp: Date.now(),
        category,
        riskLevel: Math.random() * 100,
        confidence: Math.random() * 100,
        factors: factors.filter(() => Math.random() > 0.5)
      }));
      setPredictions(newPredictions);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Prédictions de Risques
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <div className="space-y-4">
            {predictions.map((prediction, index) => (
              <Card key={index}>
                <CardContent className="pt-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium">{prediction.category}</h4>
                      <p className="text-sm text-gray-500">
                        Confiance: {prediction.confidence.toFixed(1)}%
                      </p>
                    </div>
                    <Badge
                      variant={
                        prediction.riskLevel > 75 
                          ? 'destructive' 
                          : prediction.riskLevel > 50 
                          ? 'secondary' 
                          : 'default'
                      }
                    >
                      Risque: {prediction.riskLevel.toFixed(1)}%
                    </Badge>
                  </div>
                  {prediction.factors.length > 0 && (
                    <div className="text-sm text-gray-500">
                      Facteurs: {prediction.factors.join(', ')}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

// Composant d'Analyse des Patterns de Validation
const ValidationPatternAnalysis = () => {
  const [patterns, setPatterns] = useState<ValidationPattern[]>([]);

  useEffect(() => {
    const mockPatterns: ValidationPattern[] = [
      {
        pattern: 'Double Validation Rapide',
        frequency: 45,
        avgDuration: 1200,
        successRate: 98,
        trend: 'increasing'
      },
      {
        pattern: 'Validation Séquentielle',
        frequency: 30,
        avgDuration: 2500,
        successRate: 95,
        trend: 'stable'
      },
      {
        pattern: 'Validation Multi-parties',
        frequency: 25,
        avgDuration: 3800,
        successRate: 92,
        trend: 'decreasing'
      }
    ];
    setPatterns(mockPatterns);
  }, []);

  const data = useMemo(() => 
    patterns.map(p => ({
      name: p.pattern,
      success: p.successRate,
      duration: p.avgDuration / 100,
      frequency: p.frequency
    })),
    [patterns]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5" />
          Patterns de Validation
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="success" fill="#8884d8" name="Taux de Succès (%)" />
              <Bar dataKey="frequency" fill="#82ca9d" name="Fréquence (%)" />
              <Bar dataKey="duration" fill="#ffc658" name="Durée (s)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

// Composant de Tendances de Sécurité
const SecurityTrendAnalysis = () => {
  const [trends, setTrends] = useState<SecurityTrend[]>([]);

  useEffect(() => {
    const mockTrends: SecurityTrend[] = [
      {
        category: 'Tentatives de Double Dépense',
        incidents: 12,
        severity: 'high',
        weekOverWeek: -15
      },
      {
        category: 'Validations Expirées',
        incidents: 45,
        severity: 'medium',
        weekOverWeek: 5
      },
      {
        category: 'Erreurs de Signature',
        incidents: 8,
        severity: 'high',
        weekOverWeek: -30
      },
      {
        category: 'Timeouts Réseau',
        incidents: 67,
        severity: 'low',
        weekOverWeek: 12
      }
    ];
    setTrends(mockTrends);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Tendances de Sécurité
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <div className="space-y-4">
            {trends.map((trend, index) => (
              <Alert
                key={index}
                variant={
                  trend.severity === 'high' 
                    ? 'destructive' 
                    : trend.severity === 'medium' 
                    ? 'secondary' 
                    : 'default'
                }
              >
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">{trend.category}</div>
                      <div className="text-sm">
                        {trend.incidents} incidents
                      </div>
                    </div>
                    <Badge
                      variant={trend.weekOverWeek < 0 ? 'default' : 'secondary'}
                    >
                      {trend.weekOverWeek > 0 ? '+' : ''}{trend.weekOverWeek}%
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
const AnalyticsModule = () => {
  return (
    <div className="p-4 space-y-4">
      <Tabs defaultValue="predictions">
        <TabsList>
          <TabsTrigger value="predictions">
            <TrendingUp className="w-4 h-4 mr-2" />
            Prédictions
          </TabsTrigger>
          <TabsTrigger value="patterns">
            <BarChart2 className="w-4 h-4 mr-2" />
            Patterns
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="w-4 h-4 mr-2" />
            Sécurité
          </TabsTrigger>
        </TabsList>

        <TabsContent value="predictions">
          <PredictiveRiskAnalysis />
        </TabsContent>

        <TabsContent value="patterns">
          <ValidationPatternAnalysis />
        </TabsContent>

        <TabsContent value="security">
          <SecurityTrendAnalysis />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalyticsModule;
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Coins, 
  Building2, 
  Users,
  AlertCircle
} from 'lucide-react';

// Types pour la classification des entreprises
interface CompanyCategory {
  id: string;
  name: string;
  maxEmployees: number;
  maxRevenue: number; // en millions d'euros
  tokenAllocation: number; // nombre de tokens attribués
}

interface TokenDistribution {
  type: 'consumer' | 'company';
  category?: string;
  baseAmount: number;
  allocated: number;
  timestamp: number;
}

// Configuration des catégories d'entreprises
const COMPANY_CATEGORIES: CompanyCategory[] = [
  {
    id: 'micro',
    name: 'Microentreprise',
    maxEmployees: 10,
    maxRevenue: 2,
    tokenAllocation: 2_000_000 // 2M tokens
  },
  {
    id: 'pme',
    name: 'PME',
    maxEmployees: 250,
    maxRevenue: 50,
    tokenAllocation: 50_000_000 // 50M tokens
  },
  {
    id: 'eti',
    name: 'ETI',
    maxEmployees: 5000,
    maxRevenue: 1500,
    tokenAllocation: 1_500_000_000 // 1.5B tokens
  },
  {
    id: 'ge',
    name: 'Grande Entreprise',
    maxEmployees: Infinity,
    maxRevenue: Infinity,
    tokenAllocation: 2_000_000_000 // 2B tokens
  }
];

// Composant d'affichage des catégories
const CategoryDisplay = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          Classification des Entreprises
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {COMPANY_CATEGORIES.map((category) => (
            <div 
              key={category.id}
              className="p-4 border rounded"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-medium">{category.name}</h3>
                  <p className="text-sm text-gray-500">
                    {category.maxEmployees < Infinity 
                      ? `jusqu'à ${category.maxEmployees} salariés`
                      : '5000 salariés et plus'}
                  </p>
                </div>
                <Badge>
                  {category.maxRevenue < Infinity 
                    ? `≤ ${category.maxRevenue}M€`
                    : '> 1500M€'}
                </Badge>
              </div>
              <div className="mt-2 p-2 bg-gray-50 rounded">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Tokens attribués</span>
                  <span className="font-medium">
                    {category.tokenAllocation.toLocaleString()} ETIKA
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Composant de distribution des tokens
const TokenDistributionLog = ({ distributions }: { distributions: TokenDistribution[] }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="w-5 h-5" />
          Historique des Distributions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <div className="space-y-2">
            {distributions.map((dist, index) => (
              <div 
                key={index}
                className="p-3 border rounded"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">
                      {dist.type === 'consumer' ? 'Consommateur' : 'Entreprise'}
                    </div>
                    {dist.category && (
                      <div className="text-sm text-gray-500">
                        Catégorie: {dist.category}
                      </div>
                    )}
                  </div>
                  <Badge variant="secondary">
                    {dist.allocated.toLocaleString()} ETIKA
                  </Badge>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  {new Date(dist.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

// Composant principal
const TokenDistributionSystem = () => {
  const [distributions, setDistributions] = useState<TokenDistribution[]>([
    {
      type: 'consumer',
      baseAmount: 2000,
      allocated: 2000,
      timestamp: Date.now() - 3600000
    },
    {
      type: 'company',
      category: 'Microentreprise',
      baseAmount: 2000000,
      allocated: 2000000,
      timestamp: Date.now() - 1800000
    }
  ]);

  // Statistiques de distribution
  const stats = {
    totalConsumers: distributions.filter(d => d.type === 'consumer').length,
    totalCompanies: distributions.filter(d => d.type === 'company').length,
    totalTokens: distributions.reduce((sum, d) => sum + d.allocated, 0)
  };

  return (
    <div className="p-4 space-y-4">
      {/* Statistiques globales */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">
                {stats.totalConsumers}
              </div>
              <div className="text-sm text-gray-500">Consommateurs</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {stats.totalCompanies}
              </div>
              <div className="text-sm text-gray-500">Entreprises</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {stats.totalTokens.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500">Tokens Distribués</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Affichage des catégories et historique */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CategoryDisplay />
        <TokenDistributionLog distributions={distributions} />
      </div>

      {/* Information sur les consommateurs */}
      <Alert>
        <Users className="w-4 h-4" />
        <AlertDescription>
          Les consommateurs reçoivent automatiquement 2000 ETIKA tokens à l'inscription
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default TokenDistributionSystem;
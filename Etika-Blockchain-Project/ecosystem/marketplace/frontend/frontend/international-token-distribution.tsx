import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Globe, 
  Building2, 
  Users,
  Coins
} from 'lucide-react';

// Types pour le système international
interface RegionConfig {
  id: string;
  name: string;
  notation: 'FR' | 'INT';
  currency: string;
  categories: CompanyCategory[];
}

interface CompanyCategory {
  id: string;
  name: string;
  maxEmployees: number;
  maxRevenue: number;
  tokenAllocation: number;
  translations?: Record<string, string>;
}

// Configuration des régions
const REGIONS: RegionConfig[] = [
  {
    id: 'FR',
    name: 'France',
    notation: 'FR',
    currency: 'EUR',
    categories: [
      {
        id: 'micro',
        name: 'Microentreprise',
        maxEmployees: 10,
        maxRevenue: 2,
        tokenAllocation: 2_000_000,
        translations: {
          en: 'Microenterprise',
          es: 'Microempresa'
        }
      },
      {
        id: 'pme',
        name: 'PME',
        maxEmployees: 250,
        maxRevenue: 50,
        tokenAllocation: 50_000_000,
        translations: {
          en: 'SME',
          es: 'PYME'
        }
      },
      {
        id: 'eti',
        name: 'ETI',
        maxEmployees: 5000,
        maxRevenue: 1500,
        tokenAllocation: 1_500_000_000,
        translations: {
          en: 'ISE',
          es: 'Empresa Intermedia'
        }
      },
      {
        id: 'ge',
        name: 'Grande Entreprise',
        maxEmployees: Infinity,
        maxRevenue: Infinity,
        tokenAllocation: 2_000_000_000,
        translations: {
          en: 'Large Enterprise',
          es: 'Gran Empresa'
        }
      }
    ]
  },
  {
    id: 'EU',
    name: 'European Union',
    notation: 'INT',
    currency: 'EUR',
    categories: [
      {
        id: 'micro',
        name: 'Microenterprise',
        maxEmployees: 10,
        maxRevenue: 2,
        tokenAllocation: 2_000_000
      },
      {
        id: 'small',
        name: 'Small Enterprise',
        maxEmployees: 50,
        maxRevenue: 10,
        tokenAllocation: 10_000_000
      },
      {
        id: 'medium',
        name: 'Medium Enterprise',
        maxEmployees: 250,
        maxRevenue: 50,
        tokenAllocation: 50_000_000
      },
      {
        id: 'large',
        name: 'Large Enterprise',
        maxEmployees: Infinity,
        maxRevenue: Infinity,
        tokenAllocation: 2_000_000_000
      }
    ]
  }
  // Possibilité d'ajouter d'autres régions facilement
];

// Utilitaire de formatage selon la région
const formatCurrency = (amount: number, notation: 'FR' | 'INT'): string => {
  if (amount === Infinity) return '∞';
  
  if (amount >= 1000) {
    return notation === 'FR' 
      ? `${(amount/1000).toFixed(1)} Md€`
      : `${(amount/1000).toFixed(1)}B€`;
  }
  return `${amount}M€`;
};

// Composant de sélection de région
const RegionSelector = ({ selectedRegion, onRegionChange }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="w-5 h-5" />
          Région
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Select value={selectedRegion} onValueChange={onRegionChange}>
          <SelectTrigger>
            <SelectValue placeholder="Sélectionner une région" />
          </SelectTrigger>
          <SelectContent>
            {REGIONS.map(region => (
              <SelectItem key={region.id} value={region.id}>
                {region.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
};

// Composant d'affichage des catégories
const CategoryDisplay = ({ region }: { region: RegionConfig }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          Classification des Entreprises - {region.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {region.categories.map((category) => (
            <div 
              key={category.id}
              className="p-4 border rounded"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-medium">{category.name}</h3>
                  <p className="text-sm text-gray-500">
                    {category.maxEmployees < Infinity 
                      ? `jusqu'à ${category.maxEmployees.toLocaleString()} salariés`
                      : '5000+ salariés'}
                  </p>
                </div>
                <Badge>
                  {category.maxRevenue < Infinity 
                    ? `≤ ${formatCurrency(category.maxRevenue, region.notation)}`
                    : `> ${formatCurrency(1500, region.notation)}`}
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

// Composant principal
const InternationalTokenDistribution = () => {
  const [selectedRegionId, setSelectedRegionId] = useState('FR');
  const selectedRegion = REGIONS.find(r => r.id === selectedRegionId)!;

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RegionSelector 
          selectedRegion={selectedRegionId}
          onRegionChange={setSelectedRegionId}
        />
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Distribution Consommateurs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <Coins className="w-4 h-4" />
              <AlertDescription>
                Distribution fixe de 2000 ETIKA tokens à l'inscription
                (identique pour toutes les régions)
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>

      <CategoryDisplay region={selectedRegion} />

      {/* Note sur l'internationalisation */}
      <Alert>
        <Globe className="w-4 h-4" />
        <AlertDescription>
          Le système s'adapte automatiquement aux classifications et normes locales.
          La distribution de tokens suit toujours le principe : tokens = plafond de CA.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default InternationalTokenDistribution;
# Code Principal de la Plateforme Étika
# Fichier: etika-core-platform.txt
# Version: 1.0
# Description: Composants essentiels de la plateforme Étika pour présentation à Gemini

```javascript
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Gavel,
  Shield,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Building2,
  Users,
  Wallet
} from 'lucide-react';

// Types principaux
interface Auction {
  id: string;
  type: 'bank' | 'insurance' | 'telco' | 'energy';
  status: 'upcoming' | 'active' | 'closing' | 'completed';
  currentBid: number;
  minBid: number;
  startTime: number;
  endTime: number;
  participantCount: number;
  topBidder?: string;
  validators: string[];
}

interface Transaction {
  id: string;
  type: 'bid' | 'purchase';
  amount: number;
  timestamp: number;
  status: 'pending' | 'validated' | 'rejected';
  validations: {
    validator: string;
    status: 'pending' | 'approved' | 'rejected';
    timestamp: number;
  }[];
}

interface Validator {
  address: string;
  role: 'consumer' | 'merchant' | 'producer';
  totalValidations: number;
  successRate: number;
  status: 'active' | 'inactive';
}

// Système d'Enchères Principal
const AuctionSystem = () => {
  const [auctions, setAuctions] = useState<Auction[]>([
    {
      id: '1',
      type: 'bank',
      status: 'active',
      currentBid: 1500000,
      minBid: 1000000,
      startTime: Date.now() - 86400000,
      endTime: Date.now() + 86400000,
      participantCount: 5,
      topBidder: '0x1234...5678',
      validators: ['0xabc...def', '0xghi...jkl']
    }
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gavel className="w-5 h-5" />
          Enchères Actives
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {auctions.map(auction => (
            <Card key={auction.id} className="p-4">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-medium">Sponsor {auction.type.toUpperCase()}</h3>
                  <p className="text-sm text-gray-500">
                    Enchère en cours : {auction.currentBid.toLocaleString()}€
                  </p>
                </div>
                <Badge variant={
                  auction.status === 'active' ? 'default' :
                  auction.status === 'closing' ? 'destructive' :
                  'secondary'
                }>
                  {auction.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-sm text-gray-500">Participants</div>
                  <div className="font-medium">{auction.participantCount}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Temps Restant</div>
                  <div className="font-medium">
                    {Math.ceil((auction.endTime - Date.now()) / 86400000)}j
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Enchère Minimale: {auction.minBid.toLocaleString()}€</span>
                  <span>Top: {auction.topBidder}</span>
                </div>
                <Button className="w-full" variant="outline">
                  Placer une Enchère
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Système de Validation PoP
const ValidationSystem = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([
    {
      id: '1',
      type: 'bid',
      amount: 1500000,
      timestamp: Date.now(),
      status: 'pending',
      validations: [
        {
          validator: '0xabc...def',
          status: 'approved',
          timestamp: Date.now()
        },
        {
          validator: '0xghi...jkl',
          status: 'pending',
          timestamp: Date.now()
        }
      ]
    }
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Système PoP
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {transactions.map(tx => (
            <Card key={tx.id} className="p-4">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-medium">Transaction #{tx.id}</h3>
                  <p className="text-sm text-gray-500">
                    {tx.amount.toLocaleString()}€ - {tx.type}
                  </p>
                </div>
                <Badge variant={
                  tx.status === 'validated' ? 'default' :
                  tx.status === 'rejected' ? 'destructive' :
                  'secondary'
                }>
                  {tx.status}
                </Badge>
              </div>

              <div className="space-y-2">
                {tx.validations.map((validation, index) => (
                  <div key={index} className="flex justify-between items-center p-2 border rounded">
                    <span className="text-sm">{validation.validator}</span>
                    <Badge variant={
                      validation.status === 'approved' ? 'default' :
                      validation.status === 'rejected' ? 'destructive' :
                      'secondary'
                    }>
                      {validation.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Moniteur du Circuit Court
const CircuitMonitor = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Circuit Court Financier
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Users className="w-8 h-8 mx-auto mb-2" />
                <div className="text-2xl font-bold">45,230</div>
                <div className="text-sm text-gray-500">Consommateurs</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Building2 className="w-8 h-8 mx-auto mb-2" />
                <div className="text-2xl font-bold">1,250</div>
                <div className="text-sm text-gray-500">Entreprises</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Wallet className="w-8 h-8 mx-auto mb-2" />
                <div className="text-2xl font-bold">15.2M€</div>
                <div className="text-sm text-gray-500">Volume Total</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Alert className="mt-4">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            Circuit court financier opérationnel - Double validation active
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

// Composant Principal
const EtikaPlatform = () => {
  return (
    <div className="p-4 space-y-4">
      <CircuitMonitor />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AuctionSystem />
        <ValidationSystem />
      </div>
    </div>
  );
};

export default EtikaPlatform;
```
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { 
  Gavel, 
  Users, 
  Wallet,
  Timer,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Building
} from 'lucide-react';

// Types pour le système d'enchères
interface Bid {
  id: string;
  sponsorId: string;
  amount: number;
  timestamp: number;
  status: 'active' | 'winning' | 'outbid' | 'final';
}

interface Sponsor {
  id: string;
  name: string;
  type: 'bank' | 'insurance' | 'telco' | 'energy' | 'retail';
  currentBid?: Bid;
  status: 'active' | 'winning' | 'lost';
  ecosystem: {
    users: number;
    marketShare: number;
    annualRevenue: number;
  };
}

interface AuctionSession {
  id: string;
  type: string;
  status: 'upcoming' | 'active' | 'closing' | 'completed';
  startTime: number;
  endTime: number;
  minimumBid: number;
  currentBid: number;
  totalBids: number;
  participants: number;
}

// Composant de Suivi des Enchères en Direct
const LiveAuctionMonitor = ({ session, currentBids }: { 
  session: AuctionSession, 
  currentBids: Bid[] 
}) => {
  const timeLeft = Math.max(0, session.endTime - Date.now());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gavel className="w-5 h-5" />
            Enchère en Cours
          </div>
          <Badge variant={session.status === 'active' ? 'default' : 'secondary'}>
            {session.status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Timer et Statut */}
          <div className="flex justify-between items-center p-4 bg-gray-50 rounded">
            <div className="flex items-center gap-2">
              <Timer className="w-5 h-5" />
              <span>Temps restant</span>
            </div>
            <span className="text-xl font-bold">
              {Math.floor(timeLeft / 60000)}m {Math.floor((timeLeft % 60000) / 1000)}s
            </span>
          </div>

          {/* Enchères actuelles */}
          <div className="space-y-2">
            {currentBids.slice(-5).map((bid) => (
              <div 
                key={bid.id}
                className="flex justify-between items-center p-2 border rounded"
              >
                <span>Sponsor #{bid.sponsorId.slice(0, 8)}</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold">
                    €{bid.amount.toLocaleString()}
                  </span>
                  <Badge variant={bid.status === 'winning' ? 'default' : 'secondary'}>
                    {bid.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          {/* Statistiques */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-sm text-gray-500">Enchère Actuelle</div>
              <div className="text-xl font-bold">
                €{session.currentBid.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Participants</div>
              <div className="text-xl font-bold">{session.participants}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Total Enchères</div>
              <div className="text-xl font-bold">{session.totalBids}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Composant de Gestion des Sponsors
const SponsorManagement = ({ sponsors }: { sponsors: Sponsor[] }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="w-5 h-5" />
          Sponsors
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sponsors.map((sponsor) => (
            <Card key={sponsor.id}>
              <CardContent className="pt-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{sponsor.name}</h3>
                    <p className="text-sm text-gray-500">
                      Secteur: {sponsor.type}
                    </p>
                  </div>
                  <Badge variant={
                    sponsor.status === 'winning' ? 'default' :
                    sponsor.status === 'lost' ? 'destructive' :
                    'secondary'
                  }>
                    {sponsor.status}
                  </Badge>
                </div>
                
                {/* Écosystème du sponsor */}
                <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-gray-500">Utilisateurs</div>
                    <div>{sponsor.ecosystem.users.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Part de Marché</div>
                    <div>{sponsor.ecosystem.marketShare}%</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Rev. Annuel</div>
                    <div>€{(sponsor.ecosystem.annualRevenue / 1e9).toFixed(1)}B</div>
                  </div>
                </div>

                {/* Enchère actuelle */}
                {sponsor.currentBid && (
                  <div className="mt-4 p-2 bg-gray-50 rounded">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Enchère actuelle</span>
                      <span className="font-bold">
                        €{sponsor.currentBid.amount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Composant de Gestion Financière
const FinancialManagement = ({ 
  totalFunds, 
  allocations, 
  recentTransactions 
}: {
  totalFunds: number,
  allocations: { category: string; amount: number }[],
  recentTransactions: { id: string; type: string; amount: number; timestamp: number }[]
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="w-5 h-5" />
          Gestion des Fonds
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Total des fonds */}
          <div className="text-center p-4 bg-gray-50 rounded">
            <div className="text-sm text-gray-500">Total des Fonds Collectés</div>
            <div className="text-3xl font-bold">
              €{totalFunds.toLocaleString()}
            </div>
          </div>

          {/* Allocations */}
          <div>
            <h4 className="font-medium mb-2">Allocation des Fonds</h4>
            <div className="space-y-2">
              {allocations.map((allocation, index) => (
                <div 
                  key={index}
                  className="flex justify-between items-center p-2 border rounded"
                >
                  <span>{allocation.category}</span>
                  <div className="flex items-center gap-2">
                    <span>€{allocation.amount.toLocaleString()}</span>
                    <span className="text-sm text-gray-500">
                      ({((allocation.amount / totalFunds) * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Transactions récentes */}
          <div>
            <h4 className="font-medium mb-2">Transactions Récentes</h4>
            <div className="space-y-2">
              {recentTransactions.map((tx) => (
                <div 
                  key={tx.id}
                  className="flex justify-between items-center p-2 border rounded"
                >
                  <div>
                    <div className="font-medium">{tx.type}</div>
                    <div className="text-sm text-gray-500">
                      {new Date(tx.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <span className="font-bold">
                    €{tx.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Composant Principal
const AuctionSystem = () => {
  const [session, setSession] = useState<AuctionSession>({
    id: '1',
    type: 'Sponsor Selection',
    status: 'active',
    startTime: Date.now() - 1800000, // Started 30 minutes ago
    endTime: Date.now() + 1800000,   // Ends in 30 minutes
    minimumBid: 1000000,
    currentBid: 1500000,
    totalBids: 25,
    participants: 8
  });

  const [currentBids, setCurrentBids] = useState<Bid[]>([
    {
      id: '1',
      sponsorId: 'sponsor1',
      amount: 1500000,
      timestamp: Date.now() - 300000,
      status: 'winning'
    },
    // ... autres enchères
  ]);

  const [sponsors, setSponsors] = useState<Sponsor[]>([
    {
      id: 'sponsor1',
      name: 'MegaBank SA',
      type: 'bank',
      status: 'winning',
      ecosystem: {
        users: 5000000,
        marketShare: 15,
        annualRevenue: 12000000000
      },
      currentBid: {
        id: '1',
        sponsorId: 'sponsor1',
        amount: 1500000,
        timestamp: Date.now() - 300000,
        status: 'winning'
      }
    },
    // ... autres sponsors
  ]);

  const [financials, setFinancials] = useState({
    totalFunds: 5000000,
    allocations: [
      { category: 'Développement Plateforme', amount: 2000000 },
      { category: 'Fonds de Réserve', amount: 1500000 },
      { category: 'Marketing', amount: 1000000 },
      { category: 'Opérations', amount: 500000 }
    ],
    recentTransactions: [
      {
        id: 'tx1',
        type: 'Enchère Gagnante',
        amount: 1500000,
        timestamp: Date.now() - 300000
      },
      // ... autres transactions
    ]
  });

  return (
    <div className="p-4 space-y-4">
      <Tabs defaultValue="auction">
        <TabsList>
          <TabsTrigger value="auction">
            <Gavel className="w-4 h-4 mr-2" />
            Enchères
          </TabsTrigger>
          <TabsTrigger value="sponsors">
            <Building className="w-4 h-4 mr-2" />
            Sponsors
          </TabsTrigger>
          <TabsTrigger value="financial">
            <Wallet className="w-4 h-4 mr-2" />
            Finance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="auction">
          <LiveAuctionMonitor 
            session={session}
            currentBids={currentBids}
          />
        </TabsContent>

        <TabsContent value="sponsors">
          <SponsorManagement sponsors={sponsors} />
        </TabsContent>

        <TabsContent value="financial">
          <FinancialManagement 
            totalFunds={financials.totalFunds}
            allocations={financials.allocations}
            recentTransactions={financials.recentTransactions}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AuctionSystem;
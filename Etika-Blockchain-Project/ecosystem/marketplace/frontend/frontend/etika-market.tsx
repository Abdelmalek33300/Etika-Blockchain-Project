import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { 
  BookOpen, 
  TrendingUp, 
  Shield, 
  AlertTriangle,
  Clock,
  CheckCircle,
  Building2
} from 'lucide-react';

// Types pour la salle de marché
interface Order {
  id: string;
  type: 'buy' | 'sell';
  price: number;
  amount: number;
  tokenOrigin: 'auction' | 'pop';
  category: string;
  timestamp: number;
  validationStatus: 'pending' | 'validated' | 'rejected';
}

interface MarketStats {
  price: number;
  volume24h: number;
  priceChange24h: number;
  highPrice24h: number;
  lowPrice24h: number;
}

// Composant de Carnet d'Ordres
const OrderBook = ({ buyOrders, sellOrders }: { buyOrders: Order[], sellOrders: Order[] }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          Carnet d'Ordres
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {/* Ordres de vente */}
          <div>
            <h3 className="text-sm font-medium mb-2">Ventes</h3>
            <div className="space-y-2">
              {sellOrders.map(order => (
                <div 
                  key={order.id}
                  className="flex justify-between items-center p-2 border rounded"
                >
                  <div>
                    <span className="text-red-500 font-medium">
                      {order.price.toFixed(2)} €
                    </span>
                    <div className="text-xs text-gray-500">
                      {order.amount.toLocaleString()} Tₑ
                    </div>
                  </div>
                  <Badge variant={
                    order.tokenOrigin === 'auction' ? 'default' : 'secondary'
                  }>
                    {order.tokenOrigin === 'auction' ? 'Enchères' : 'PoP'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Ordres d'achat */}
          <div>
            <h3 className="text-sm font-medium mb-2">Achats</h3>
            <div className="space-y-2">
              {buyOrders.map(order => (
                <div 
                  key={order.id}
                  className="flex justify-between items-center p-2 border rounded"
                >
                  <div>
                    <span className="text-green-500 font-medium">
                      {order.price.toFixed(2)} €
                    </span>
                    <div className="text-xs text-gray-500">
                      {order.amount.toLocaleString()} Tₑ
                    </div>
                  </div>
                  <Badge>
                    {order.category}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Composant de Statistiques de Marché
const MarketStats = ({ stats }: { stats: MarketStats }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Statistiques du Marché
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="p-3 border rounded">
            <div className="text-sm text-gray-500">Prix Actuel</div>
            <div className="text-lg font-medium">
              {stats.price.toFixed(2)} €
            </div>
            <div className={`text-sm ${
              stats.priceChange24h >= 0 ? 'text-green-500' : 'text-red-500'
            }`}>
              {stats.priceChange24h >= 0 ? '+' : ''}
              {stats.priceChange24h.toFixed(2)}%
            </div>
          </div>

          <div className="p-3 border rounded">
            <div className="text-sm text-gray-500">Volume 24h</div>
            <div className="text-lg font-medium">
              {stats.volume24h.toLocaleString()} Tₑ
            </div>
          </div>

          <div className="p-3 border rounded">
            <div className="text-sm text-gray-500">Range 24h</div>
            <div className="text-sm">
              <span className="text-red-500">L: {stats.lowPrice24h.toFixed(2)} €</span>
              {' - '}
              <span className="text-green-500">H: {stats.highPrice24h.toFixed(2)} €</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Composant de Validation
const ValidationPanel = ({ pendingOrders }: { pendingOrders: Order[] }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Validation des Transactions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {pendingOrders.map(order => (
            <div 
              key={order.id}
              className="p-3 border rounded"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-medium">
                    Transaction #{order.id.slice(0, 8)}
                  </div>
                  <div className="text-sm text-gray-500">
                    {order.amount.toLocaleString()} Tₑ à {order.price.toFixed(2)} €
                  </div>
                </div>
                <Badge variant={
                  order.validationStatus === 'validated' ? 'default' :
                  order.validationStatus === 'rejected' ? 'destructive' :
                  'secondary'
                }>
                  {order.validationStatus}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-1">
                  <Shield className="w-4 h-4" />
                  <span>Validation Écosystème</span>
                  {order.validationStatus === 'validated' && 
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  }
                </div>
                <div className="flex items-center gap-1">
                  <Building2 className="w-4 h-4" />
                  <span>Validation Sponsor</span>
                  {order.validationStatus === 'validated' && 
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  }
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Composant de Graphique de Prix
const PriceChart = ({ data }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Évolution du Prix</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" tickFormatter={(value) => 
                new Date(value).toLocaleTimeString()
              } />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="price" 
                stroke="#8884d8" 
                name="Prix (€)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

// Composant Principal
const EtikaMarket = () => {
  const [marketStats] = useState<MarketStats>({
    price: 12.50,
    volume24h: 1500000,
    priceChange24h: 2.5,
    highPrice24h: 13.20,
    lowPrice24h: 12.10
  });

  const [buyOrders] = useState<Order[]>([
    {
      id: '1',
      type: 'buy',
      price: 12.45,
      amount: 10000,
      tokenOrigin: 'auction',
      category: 'Banque',
      timestamp: Date.now(),
      validationStatus: 'pending'
    }
    // ... autres ordres
  ]);

  const [sellOrders] = useState<Order[]>([
    {
      id: '2',
      type: 'sell',
      price: 12.55,
      amount: 15000,
      tokenOrigin: 'pop',
      category: 'Banque',
      timestamp: Date.now(),
      validationStatus: 'pending'
    }
    // ... autres ordres
  ]);

  const priceHistory = Array.from({ length: 20 }, (_, i) => ({
    timestamp: Date.now() - (i * 300000),
    price: 12.5 + Math.sin(i * 0.5) * 0.5
  })).reverse();

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MarketStats stats={marketStats} />
        <ValidationPanel pendingOrders={[...buyOrders, ...sellOrders]} />
      </div>

      <PriceChart data={priceHistory} />

      <OrderBook 
        buyOrders={buyOrders}
        sellOrders={sellOrders}
      />

      {/* Alertes et Notifications */}
      <Alert>
        <AlertTriangle className="w-4 h-4" />
        <AlertDescription>
          Chaque transaction nécessite une double validation (Écosystème + Sponsor)
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default EtikaMarket;
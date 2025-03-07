import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  Timer,
  TrendingUp,
  AlertCircle,
  Bell
} from 'lucide-react';

// Types pour la phase préliminaire
interface CommunityMetrics {
  consumers: number;
  entrepreneurs: number;
  targetConsumers: number;
  targetEntrepreneurs: number;
  growthRate: number;
}

interface AuctionPhase {
  status: 'preliminary' | 'countdown' | 'active';
  startTimestamp?: number;
  endTimestamp?: number;
  minimumBid: number;
  currentBid: number;
}

// Composant de suivi de la communauté
const CommunityTracker = ({ metrics }: { metrics: CommunityMetrics }) => {
  const consumerProgress = (metrics.consumers / metrics.targetConsumers) * 100;
  const entrepreneurProgress = (metrics.entrepreneurs / metrics.targetEntrepreneurs) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Croissance de la Communauté
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Consommateurs */}
          <div>
            <div className="flex justify-between mb-2">
              <span>Consommateurs</span>
              <span className="font-medium">
                {metrics.consumers.toLocaleString()} / {metrics.targetConsumers.toLocaleString()}
              </span>
            </div>
            <Progress value={consumerProgress} />
          </div>

          {/* Entrepreneurs */}
          <div>
            <div className="flex justify-between mb-2">
              <span>Entrepreneurs</span>
              <span className="font-medium">
                {metrics.entrepreneurs.toLocaleString()} / {metrics.targetEntrepreneurs.toLocaleString()}
              </span>
            </div>
            <Progress value={entrepreneurProgress} />
          </div>

          {/* Taux de croissance */}
          <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
            <span>Taux de croissance</span>
            <Badge variant="secondary">
              +{metrics.growthRate}% / semaine
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Composant compte à rebours / enchères
const AuctionCountdown = ({ phase }: { phase: AuctionPhase }) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (phase.startTimestamp && phase.endTimestamp) {
      const interval = setInterval(() => {
        const now = Date.now();
        setTimeLeft(phase.endTimestamp! - now);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [phase]);

  const formatTime = (ms: number) => {
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${days}j ${hours}h ${minutes}m`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Timer className="w-5 h-5" />
          {phase.status === 'preliminary' ? 'Phase Préliminaire' : 'Compte à Rebours'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {phase.status === 'preliminary' ? (
            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                En attente du seuil de maturité de la communauté
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Timer */}
              <div className="text-center">
                <div className="text-3xl font-bold mb-2">
                  {formatTime(timeLeft)}
                </div>
                <div className="text-sm text-gray-500">
                  Temps restant avant la fin des enchères
                </div>
              </div>

              {/* Enchère actuelle */}
              <div className="p-4 bg-gray-50 rounded">
                <div className="flex justify-between items-center">
                  <span>Enchère actuelle</span>
                  <span className="text-xl font-bold">
                    €{phase.currentBid.toLocaleString()}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Composant de notifications
const NotificationSystem = () => {
  const [notifications, setNotifications] = useState([
    {
      id: '1',
      type: 'milestone',
      message: 'Nouveau palier atteint : €1,000,000',
      timestamp: Date.now() - 3600000
    }
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notifications
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {notifications.map(notification => (
            <Alert key={notification.id}>
              <AlertDescription className="flex justify-between items-center">
                <span>{notification.message}</span>
                <span className="text-sm text-gray-500">
                  {new Date(notification.timestamp).toLocaleTimeString()}
                </span>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Composant Principal
const AuctionPreparationSystem = () => {
  const [communityMetrics, setCommunityMetrics] = useState<CommunityMetrics>({
    consumers: 15000,
    entrepreneurs: 750,
    targetConsumers: 50000,
    targetEntrepreneurs: 2000,
    growthRate: 8.5
  });

  const [auctionPhase, setAuctionPhase] = useState<AuctionPhase>({
    status: 'preliminary',
    minimumBid: 1000000,
    currentBid: 0
  });

  // Vérification du seuil de maturité
  useEffect(() => {
    const consumerProgress = communityMetrics.consumers / communityMetrics.targetConsumers;
    const entrepreneurProgress = communityMetrics.entrepreneurs / communityMetrics.targetEntrepreneurs;

    if (consumerProgress >= 0.8 && entrepreneurProgress >= 0.8 && auctionPhase.status === 'preliminary') {
      // Démarrage du compte à rebours de 6 mois
      setAuctionPhase({
        ...auctionPhase,
        status: 'countdown',
        startTimestamp: Date.now(),
        endTimestamp: Date.now() + (180 * 24 * 60 * 60 * 1000), // 6 mois
        currentBid: auctionPhase.minimumBid
      });
    }
  }, [communityMetrics, auctionPhase]);

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CommunityTracker metrics={communityMetrics} />
        <AuctionCountdown phase={auctionPhase} />
        <NotificationSystem />
      </div>
    </div>
  );
};

export default AuctionPreparationSystem;
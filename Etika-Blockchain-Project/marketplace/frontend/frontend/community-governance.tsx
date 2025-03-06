import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Users,
  Vote,
  MessageSquare,
  UserPlus,
  ThumbsUp,
  Clock,
  Settings,
  Trophy,
  Coins,
  ArrowUp
} from 'lucide-react';

// Types pour le système DAO et le forum
interface Proposal {
  id: string;
  title: string;
  description: string;
  author: string;
  type: 'ethical' | 'sustainability' | 'community' | 'ecosystem';
  status: 'active' | 'passed' | 'rejected';
  votesFor: number;
  votesAgainst: number;
  quorum: number;
  deadline: number;
  timestamp: number;
}

interface ForumPost {
  id: string;
  title: string;
  content: string;
  author: string;
  likes: number;
  replies: number;
  category: 'general' | 'technical' | 'governance' | 'referral';
  timestamp: number;
}

interface ReferralReward {
  id: string;
  type: 'tokens' | 'badge' | 'multiplier';
  amount: number;
  condition: string;
  description: string;
}

// Composant de Gouvernance DAO
const GovernanceSystem = () => {
  const [proposals, setProposals] = useState<Proposal[]>([{
    id: '1',
    title: 'Intégration de critères environnementaux pour les sponsors',
    description: 'Proposition d\'ajouter des critères de performance environnementale dans la sélection des sponsors officiels',
    author: '0x1234...5678',
    type: 'sustainability',
    status: 'active',
    votesFor: 15000,
    votesAgainst: 5000,
    quorum: 25000,
    deadline: Date.now() + 604800000, // 1 semaine
    timestamp: Date.now() - 86400000
  }]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Vote className="w-5 h-5" />
          Gouvernance DAO
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Propositions actives */}
          {proposals.map(proposal => (
            <Card key={proposal.id} className="p-4">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-medium">{proposal.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {proposal.description}
                  </p>
                </div>
                <Badge variant={
                  proposal.status === 'passed' ? 'default' :
                  proposal.status === 'rejected' ? 'destructive' :
                  'secondary'
                }>
                  {proposal.status}
                </Badge>
              </div>

              {/* Barre de progression du vote */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Pour: {proposal.votesFor.toLocaleString()}</span>
                  <span>Contre: {proposal.votesAgainst.toLocaleString()}</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded overflow-hidden">
                  <div
                    className="h-full bg-blue-500"
                    style={{
                      width: `${(proposal.votesFor / (proposal.votesFor + proposal.votesAgainst)) * 100}%`
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Quorum: {Math.round((proposal.votesFor + proposal.votesAgainst) / proposal.quorum * 100)}%</span>
                  <span>{Math.ceil((proposal.deadline - Date.now()) / 86400000)} jours restants</span>
                </div>
              </div>

              {/* Boutons de vote */}
              <div className="flex gap-2 mt-4">
                <Button className="flex-1" variant="outline">
                  <ThumbsUp className="w-4 h-4 mr-2" />
                  Pour
                </Button>
                <Button className="flex-1" variant="outline">
                  <ThumbsUp className="w-4 h-4 mr-2 rotate-180" />
                  Contre
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Composant Forum Communautaire
const CommunityForum = () => {
  const [posts, setPosts] = useState<ForumPost[]>([{
    id: '1',
    title: 'Guide du Parrainage - Maximisez vos récompenses !',
    content: 'Découvrez comment gagner des tokens en parrainant de nouveaux membres...',
    author: 'CommunityLead',
    likes: 45,
    replies: 12,
    category: 'referral',
    timestamp: Date.now() - 3600000
  }]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Forum Communautaire
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general">Général</TabsTrigger>
            <TabsTrigger value="referral">Parrainage</TabsTrigger>
            <TabsTrigger value="governance">Gouvernance</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general">
            <ScrollArea className="h-[400px]">
              {posts.filter(p => p.category === 'general').map(post => (
                <Card key={post.id} className="p-4 mb-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium">{post.title}</h3>
                    <Badge>{post.category}</Badge>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">{post.content}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="w-4 h-4" />
                      {post.likes}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-4 h-4" />
                      {post.replies}
                    </span>
                    <span>{new Date(post.timestamp).toLocaleString()}</span>
                  </div>
                </Card>
              ))}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

// Composant Programme de Parrainage
const ReferralProgram = () => {
  const [rewards] = useState<ReferralReward[]>([
    {
      id: '1',
      type: 'tokens',
      amount: 500,
      condition: '1 parrainage validé',
      description: '500 tokens par nouveau membre actif parrainé'
    },
    {
      id: '2',
      type: 'multiplier',
      amount: 1.5,
      condition: '5 parrainages validés',
      description: 'Multiplicateur x1.5 sur toutes les récompenses'
    },
    {
      id: '3',
      type: 'badge',
      amount: 0,
      condition: '10 parrainages validés',
      description: 'Badge "Ambassadeur" et accès prioritaire aux enchères'
    }
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5" />
          Programme de Parrainage
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Lien de parrainage */}
          <div className="flex gap-2">
            <Input
              value="https://etika.io/ref/YOUR_ID"
              readOnly
              className="flex-1"
            />
            <Button variant="outline">Copier</Button>
          </div>

          {/* Récompenses */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {rewards.map(reward => (
              <Card key={reward.id} className="p-4">
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                    {reward.type === 'tokens' ? (
                      <Coins className="w-6 h-6 text-blue-500" />
                    ) : reward.type === 'multiplier' ? (
                      <ArrowUp className="w-6 h-6 text-green-500" />
                    ) : (
                      <Trophy className="w-6 h-6 text-yellow-500" />
                    )}
                  </div>
                  <h4 className="font-medium">{reward.condition}</h4>
                  <p className="text-sm text-gray-500">{reward.description}</p>
                </div>
              </Card>
            ))}
          </div>

          {/* Statistiques */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm text-gray-500">Parrainages</div>
            </div>
            <div>
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm text-gray-500">Tokens Gagnés</div>
            </div>
            <div>
              <div className="text-2xl font-bold">x1.0</div>
              <div className="text-sm text-gray-500">Multiplicateur</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Composant Principal
const CommunityGovernance = () => {
  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GovernanceSystem />
        <ReferralProgram />
      </div>
      <CommunityForum />
    </div>
  );
};
export default CommunityGovernance;
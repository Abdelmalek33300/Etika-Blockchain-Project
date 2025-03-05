import React from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { PieChart, Pie, Cell } from 'recharts';

const AdminDashboard = () => {
  // Données fictives pour la démonstration
  const systemHealth = 98;
  const activeNodes = 42;
  const transactions24h = 12487;
  const tokenDistribution = '1.2M';
  
  const transactionData = [
    { name: '00:00', value: 240 },
    { name: '03:00', value: 138 },
    { name: '06:00', value: 410 },
    { name: '09:00', value: 675 },
    { name: '12:00', value: 890 },
    { name: '15:00', value: 920 },
    { name: '18:00', value: 750 },
    { name: '21:00', value: 580 }
  ];
  
  const tokenData = [
    { name: 'En latence', value: 6500 },
    { name: 'Activés', value: 3500 },
    { name: 'Brûlés', value: 1800 }
  ];

  const blockchainData = [
    { name: 'Lun', blocks: 1450, transactions: 8400 },
    { name: 'Mar', blocks: 1380, transactions: 7900 },
    { name: 'Mer', blocks: 1520, transactions: 9200 },
    { name: 'Jeu', blocks: 1400, transactions: 8300 },
    { name: 'Ven', blocks: 1680, transactions: 10400 },
    { name: 'Sam', blocks: 1280, transactions: 7600 },
    { name: 'Dim', blocks: 1190, transactions: 6800 }
  ];

  const alertsData = [
    { id: 1, severity: 'high', message: 'Tentative d\'accès non autorisé détectée', time: 'Il y a 12 min' },
    { id: 2, severity: 'medium', message: 'Latence élevée sur le serveur API-01', time: 'Il y a 43 min' },
    { id: 3, severity: 'low', message: 'Distribution de tokens retardée', time: 'Il y a 2h' },
    { id: 4, severity: 'info', message: 'Maintenance planifiée dans 48h', time: 'Il y a 5h' }
  ];
  
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28'];
  
  return (
    <div className="w-full p-6 bg-gray-100">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard Administrateur Étika</h1>
          <p className="text-gray-600">Vue d'ensemble du système | Temps réel</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-white rounded-md p-2 shadow flex items-center">
            <span className="text-gray-600 mr-2">Dernière mise à jour:</span>
            <span className="font-medium">01/03/2025 08:42:17</span>
          </div>
          <button className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700">
            Rafraîchir
          </button>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-gray-500 text-sm font-medium">Santé du Système</h3>
              <p className="text-3xl font-bold text-gray-800">{systemHealth}%</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-green-500"></div>
            </div>
          </div>
          <div className="mt-2 text-sm text-green-600">Système opérationnel</div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-gray-500 text-sm font-medium">Nœuds Actifs</h3>
              <p className="text-3xl font-bold text-gray-800">{activeNodes}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-blue-500"></div>
            </div>
          </div>
          <div className="mt-2 text-sm text-blue-600">Tous les nœuds sont synchronisés</div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-gray-500 text-sm font-medium">Transactions (24h)</h3>
              <p className="text-3xl font-bold text-gray-800">{transactions24h}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-purple-500"></div>
            </div>
          </div>
          <div className="mt-2 text-sm text-purple-600">+18% vs hier</div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-gray-500 text-sm font-medium">Tokens Distribués</h3>
              <p className="text-3xl font-bold text-gray-800">{tokenDistribution}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-orange-500"></div>
            </div>
          </div>
          <div className="mt-2 text-sm text-orange-600">Distribution hebdomadaire complétée</div>
        </div>
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-medium text-gray-700 mb-4">Transactions (dernières 24h)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={transactionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="#8884d8" activeDot={{ r: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-medium text-gray-700 mb-4">Distribution des Tokens</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={tokenData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
              >
                {tokenData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Blockchain Activity */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h3 className="font-medium text-gray-700 mb-4">Activité Blockchain (derniers 7 jours)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={blockchainData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
            <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
            <Tooltip />
            <Legend />
            <Bar yAxisId="left" dataKey="blocks" fill="#8884d8" name="Blocs" />
            <Bar yAxisId="right" dataKey="transactions" fill="#82ca9d" name="Transactions" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Recent Alerts */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-medium text-gray-700">Alertes Récentes</h3>
          <button className="text-blue-600 hover:text-blue-800">Voir toutes</button>
        </div>
        <div className="space-y-3">
          {alertsData.map(alert => (
            <div key={alert.id} className="flex items-start p-3 border-l-4 bg-gray-50 rounded" 
                 style={{ borderColor: 
                   alert.severity === 'high' ? '#EF4444' : 
                   alert.severity === 'medium' ? '#F59E0B' : 
                   alert.severity === 'low' ? '#3B82F6' : '#10B981' }}>
              <div className="ml-2 flex-1">
                <div className="flex justify-between">
                  <span className="font-medium">{alert.message}</span>
                  <span className="text-sm text-gray-500">{alert.time}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Users, 
  UserPlus, 
  CheckCircle, 
  Clock,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

// Types pour le système PoP flexible
interface Validator {
  id: string;
  name: string;
  roles: {
    type: 'consumer' | 'producer' | 'distributor' | 'processor' | 'supplier';
    active: boolean;
  }[];
  currentRole?: string;
  validationStatus: 'pending' | 'validated' | 'rejected';
}

interface Transaction {
  id: string;
  type: 'direct' | 'retail' | 'complex';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  validators: Validator[];
  requiredValidations: number;
  timestamp: number;
  deadline: number;
}

// Composant de gestion des validateurs
const ValidatorManager = ({ transaction, onAddValidator, onValidate }) => {
  const [availableValidators, setAvailableValidators] = useState([
    {
      id: 'v1',
      name: 'Ferme Bio',
      roles: [
        { type: 'producer', active: true },
        { type: 'supplier', active: true }
      ]
    },
    {
      id: 'v2',
      name: 'Coopérative Locale',
      roles: [
        { type: 'distributor', active: true },
        { type: 'processor', active: true }
      ]
    }
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Validateurs ({transaction.validators.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Liste des validateurs actuels */}
          <ScrollArea className="h-48">
            {transaction.validators.map((validator) => (
              <div
                key={validator.id}
                className="flex items-center justify-between p-2 border rounded mb-2"
              >
                <div>
                  <div className="font-medium">{validator.name}</div>
                  <div className="text-sm text-gray-500">
                    Rôle actif: {validator.currentRole}
                  </div>
                </div>
                <Badge variant={
                  validator.validationStatus === 'validated' ? 'default' :
                  validator.validationStatus === 'rejected' ? 'destructive' :
                  'secondary'
                }>
                  {validator.validationStatus}
                </Badge>
              </div>
            ))}
          </ScrollArea>

          {/* Ajout de validateurs */}
          {availableValidators.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Ajouter un validateur</h4>
              {availableValidators.map((validator) => (
                <Button
                  key={validator.id}
                  variant="outline"
                  className="w-full mb-2"
                  onClick={() => onAddValidator(validator)}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  {validator.name}
                </Button>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Composant de statut de transaction
const TransactionStatus = ({ transaction }) => {
  const progress = Math.round(
    (transaction.validators.filter(v => v.validationStatus === 'validated').length /
    transaction.requiredValidations) * 100
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" />
          Statut de la Transaction
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Barre de progression */}
          <div className="w-full h-2 bg-gray-200 rounded">
            <div
              className="h-full bg-blue-500 rounded"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Informations de validation */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500">Validations requises</div>
              <div className="text-lg font-medium">
                {transaction.requiredValidations}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Validations reçues</div>
              <div className="text-lg font-medium">
                {transaction.validators.filter(v => v.validationStatus === 'validated').length}
              </div>
            </div>
          </div>

          {/* Temps restant */}
          <Alert>
            <Clock className="w-4 h-4" />
            <AlertDescription>
              Temps restant: {Math.max(0, Math.floor((transaction.deadline - Date.now()) / 1000))}s
            </AlertDescription>
          </Alert>
        </div>
      </CardContent>
    </Card>
  );
};

// Composant Principal
const FlexiblePoPSystem = () => {
  const [transaction, setTransaction] = useState<Transaction>({
    id: crypto.randomUUID(),
    type: 'direct',
    status: 'pending',
    validators: [
      {
        id: 'consumer1',
        name: 'Consommateur',
        roles: [{ type: 'consumer', active: true }],
        currentRole: 'consumer',
        validationStatus: 'pending'
      }
    ],
    requiredValidations: 2,
    timestamp: Date.now(),
    deadline: Date.now() + 300000 // 5 minutes
  });

  // Gestion de l'ajout d'un validateur
  const handleAddValidator = (newValidator) => {
    setTransaction(prev => {
      // Vérifie si le validateur peut avoir plusieurs rôles actifs
      const activeRoles = newValidator.roles.filter(r => r.active);
      const currentRole = activeRoles[0]?.type;

      return {
        ...prev,
        validators: [...prev.validators, {
          ...newValidator,
          currentRole,
          validationStatus: 'pending'
        }]
      };
    });
  };

  // Gestion de la validation
  const handleValidation = (validatorId: string) => {
    setTransaction(prev => ({
      ...prev,
      validators: prev.validators.map(v =>
        v.id === validatorId
          ? { ...v, validationStatus: 'validated' }
          : v
      )
    }));
  };

  // Mise à jour du statut de la transaction
  useEffect(() => {
    const validatedCount = transaction.validators.filter(
      v => v.validationStatus === 'validated'
    ).length;

    if (validatedCount >= transaction.requiredValidations) {
      setTransaction(prev => ({ ...prev, status: 'completed' }));
    }
  }, [transaction.validators, transaction.requiredValidations]);

  return (
    <div className="p-4 space-y-4">
      {/* En-tête de la transaction */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">
          Transaction #{transaction.id.slice(0, 8)}
        </h2>
        <Badge variant={
          transaction.status === 'completed' ? 'default' :
          transaction.status === 'failed' ? 'destructive' :
          'secondary'
        }>
          {transaction.status}
        </Badge>
      </div>

      {/* Contenu principal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ValidatorManager
          transaction={transaction}
          onAddValidator={handleAddValidator}
          onValidate={handleValidation}
        />
        <TransactionStatus transaction={transaction} />
      </div>

      {/* Alertes et notifications */}
      {transaction.validators.length < transaction.requiredValidations && (
        <Alert>
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            Validateurs supplémentaires requis ({transaction.requiredValidations - transaction.validators.length})
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default FlexiblePoPSystem;
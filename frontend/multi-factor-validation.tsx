import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  QrCode,
  Fingerprint,
  Key,
  Shield,
  RefreshCcw,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';

// Types pour la validation
interface ValidationStep {
  id: string;
  type: 'qr' | 'biometric' | 'token' | 'challenge';
  status: 'pending' | 'success' | 'failed' | 'waiting';
  timestamp: number;
}

interface ValidationSession {
  id: string;
  steps: ValidationStep[];
  currentStep: number;
  startTime: number;
  deadline: number;
  status: 'active' | 'completed' | 'failed' | 'expired';
}

// Composant QR Code Dynamique
const DynamicQRCode = ({ onValidate, onError }) => {
  const [qrValue, setQrValue] = useState('');
  const [refreshTime, setRefreshTime] = useState(30);

  useEffect(() => {
    // Génération d'un nouveau QR code toutes les 30 secondes
    const generateQR = () => {
      const newValue = crypto.randomUUID();
      setQrValue(newValue);
      setRefreshTime(30);
    };

    generateQR();
    const qrInterval = setInterval(generateQR, 30000);
    const timeInterval = setInterval(() => {
      setRefreshTime(t => Math.max(0, t - 1));
    }, 1000);

    return () => {
      clearInterval(qrInterval);
      clearInterval(timeInterval);
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            QR Code Dynamique
          </div>
          <Badge>{refreshTime}s</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="w-64 h-64 border-2 rounded flex items-center justify-center">
          {/* Simulation d'un QR code */}
          <div className="text-center">
            <QrCode className="w-32 h-32 mx-auto mb-2" />
            <span className="text-xs text-gray-500">
              ID: {qrValue.slice(0, 8)}...
            </span>
          </div>
        </div>
        <Button onClick={() => onValidate(qrValue)}>
          Valider QR Code
        </Button>
      </CardContent>
    </Card>
  );
};

// Composant Validation Biométrique
const BiometricValidation = ({ onValidate, onError }) => {
  const [status, setStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [attempts, setAttempts] = useState(0);

  const handleScan = async () => {
    setStatus('scanning');
    setAttempts(a => a + 1);

    try {
      // Simulation de scan biométrique
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (attempts < 2) {
        setStatus('success');
        onValidate();
      } else {
        throw new Error('Échec de la validation biométrique');
      }
    } catch (error) {
      setStatus('error');
      onError(error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fingerprint className="w-5 h-5" />
          Validation Biométrique
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div 
          className={`w-32 h-32 rounded-full border-4 flex items-center justify-center
            ${status === 'scanning' ? 'border-blue-500 animate-pulse' : 
              status === 'success' ? 'border-green-500' : 
              status === 'error' ? 'border-red-500' : 'border-gray-200'}`}
        >
          <Fingerprint className={`w-16 h-16 
            ${status === 'scanning' ? 'text-blue-500' : 
              status === 'success' ? 'text-green-500' : 
              status === 'error' ? 'text-red-500' : 'text-gray-400'}`} 
          />
        </div>
        
        {status === 'error' && (
          <Alert variant="destructive">
            <AlertDescription>
              Échec de la validation. Tentatives restantes: {3 - attempts}
            </AlertDescription>
          </Alert>
        )}

        <Button 
          onClick={handleScan}
          disabled={status === 'scanning' || attempts >= 3}
        >
          {status === 'scanning' ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Scan en cours...
            </>
          ) : 'Démarrer le scan'}
        </Button>
      </CardContent>
    </Card>
  );
};

// Composant Token Hardware
const HardwareToken = ({ onValidate, onError }) => {
  const [token, setToken] = useState('');
  const [validating, setValidating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidating(true);

    try {
      // Simulation de validation de token
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (token.length === 6 && /^\d+$/.test(token)) {
        onValidate(token);
      } else {
        throw new Error('Token invalide');
      }
    } catch (error) {
      onError(error);
    } finally {
      setValidating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="w-5 h-5" />
          Token Hardware
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value.slice(0, 6))}
              placeholder="Entrez le code à 6 chiffres"
              pattern="\d{6}"
              maxLength={6}
              className="text-center text-2xl tracking-widest"
            />
          </div>
          <Button 
            type="submit" 
            className="w-full"
            disabled={validating}
          >
            {validating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Validation...
              </>
            ) : 'Valider'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

// Composant Challenge-Réponse
const ChallengeResponse = ({ onValidate, onError }) => {
  const [challenge, setChallenge] = useState('');
  const [response, setResponse] = useState('');
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    // Génération d'un nouveau challenge
    const newChallenge = Math.random().toString(36).substring(7);
    setChallenge(newChallenge);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidating(true);

    try {
      // Simulation de validation de réponse
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simple exemple de validation - à adapter selon les besoins
      if (response === challenge.split('').reverse().join('')) {
        onValidate();
      } else {
        throw new Error('Réponse incorrecte');
      }
    } catch (error) {
      onError(error);
    } finally {
      setValidating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Challenge-Réponse
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Alert>
            <AlertDescription>
              Challenge: {challenge}
            </AlertDescription>
          </Alert>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Entrez votre réponse"
            />
            <Button 
              type="submit" 
              className="w-full"
              disabled={validating}
            >
              {validating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Vérification...
                </>
              ) : 'Soumettre'}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
};

// Composant Principal
const MultifactorValidation = () => {
  const [session, setSession] = useState<ValidationSession>({
    id: crypto.randomUUID(),
    steps: [
      { id: '1', type: 'qr', status: 'pending', timestamp: Date.now() },
      { id: '2', type: 'biometric', status: 'waiting', timestamp: 0 },
      { id: '3', type: 'token', status: 'waiting', timestamp: 0 },
      { id: '4', type: 'challenge', status: 'waiting', timestamp: 0 }
    ],
    currentStep: 0,
    startTime: Date.now(),
    deadline: Date.now() + 300000, // 5 minutes
    status: 'active'
  });

  const handleStepSuccess = (stepType: ValidationStep['type']) => {
    setSession(prev => {
      const newSession = { ...prev };
      const currentStep = newSession.steps[newSession.currentStep];
      
      if (currentStep.type === stepType) {
        currentStep.status = 'success';
        currentStep.timestamp = Date.now();
        
        if (newSession.currentStep < newSession.steps.length - 1) {
          newSession.currentStep += 1;
          newSession.steps[newSession.currentStep].status = 'pending';
        } else {
          newSession.status = 'completed';
        }
      }
      
      return newSession;
    });
  };

  const handleStepError = (stepType: ValidationStep['type'], error: Error) => {
    setSession(prev => {
      const newSession = { ...prev };
      const currentStep = newSession.steps[newSession.currentStep];
      
      if (currentStep.type === stepType) {
        currentStep.status = 'failed';
        currentStep.timestamp = Date.now();
        newSession.status = 'failed';
      }
      
      return newSession;
    });
  };

  return (
    <div className="p-4 space-y-4">
      {/* Barre de progression */}
      <div className="flex justify-between mb-8">
        {session.steps.map((step, index) => (
          <div
            key={step.id}
            className={`flex items-center ${
              index < session.steps.length - 1 ? 'flex-1' : ''
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center
                ${step.status === 'success' ? 'bg-green-500' :
                  step.status === 'failed' ? 'bg-red-500' :
                  step.status === 'pending' ? 'bg-blue-500' :
                  'bg-gray-200'}`}
            >
              {step.status === 'success' ? (
                <CheckCircle className="w-5 h-5 text-white" />
              ) : step.status === 'failed' ? (
                <XCircle className="w-5 h-5 text-white" />
              ) : step.status === 'pending' ? (
                <div className="w-5 h-5 text-white">{index + 1}</div>
              ) : (
                <div className="w-5 h-5 text-gray-500">{index + 1}</div>
              )}
            </div>
            {index < session.steps.length - 1 && (
              <div 
                className={`flex-1 h-1 mx-2
                  ${step.status === 'success' ? 'bg-green-500' :
                    step.status === 'failed' ? 'bg-red-500' :
                    'bg-gray-200'}`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Étape courante */}
      {session.status === 'active' && (
        <div>
          {session.steps[session.currentStep].type === 'qr' && (
            <DynamicQRCode
              onValidate={() => handleStepSuccess('qr')}
              onError={(error) => handleStepError('qr', error)}
            />
          )}
          {session.steps[session.currentStep].type === 'biometric' && (
            <BiometricValidation
              onValidate={() => handleStepSuccess('biometric')}
              onError={(error) => handleStepError('biometric', error)}
            />
          )}
          {session.steps[session.currentStep].type === 'token' && (
            <HardwareToken
              onValidate={() => handleStepSuccess('token')}
              onError={(error) => handleStepError('token', error)}
            />
          )}
          {session.steps[session.currentStep].type === 'challenge' && (
            <ChallengeResponse
              onValidate={() => handleStepSuccess('challenge')}
              onError={(error) => handleStepError('challenge', error)}
            />
          )}
        </div>
      )}

      {/* Statut final */}
      {(session.status === 'completed' || session.status === 'failed') && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              {session.status === 'completed' ? (
                <>
                  <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
                  <h3 className="text-xl font-bold text-green-600 mb-2">
                    Validation Réussie
                  </h3>
                  <p className="text-gray-500">
                    Tous les facteurs de validation ont été vérifiés avec succès.
                  </p>
                </>
              ) : (
                <>
                  <XCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
                  <h3 className="text-xl font-bold text-red-600 mb-2">
                    Échec de la Validation
                  </h3>
                  <p className="text-gray-500">
                    La validation a échoué. Veuillez réessayer.
                  </p>
                </>
              )}
              <Button
                className="mt-4"
                onClick={() => {
                  setSession({
                    id: crypto.randomUUID(),
                    steps: [
                      { id: '1', type: 'qr', status: 'pending', timestamp: Date.now() },
                      { id: '2', type: 'biometric', status: 'waiting', timestamp: 0 },
                      { id: '3', type: 'token', status: 'waiting', timestamp: 0 },
                      { id: '4', type: 'challenge', status: 'waiting', timestamp: 0 }
                    ],
                    currentStep: 0,
                    startTime: Date.now(),
                    deadline: Date.now() + 300000,
                    status: 'active'
                  });
                }}
              >
                <RefreshCcw className="w-4 h-4 mr-2" />
                Redémarrer la Validation
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timer */}
      <div className="fixed bottom-4 right-4">
        <Badge variant="secondary">
          Temps restant: {Math.max(0, Math.floor((session.deadline - Date.now()) / 1000))}s
        </Badge>
      </div>
    </div>
  );
};

export default MultifactorValidation;
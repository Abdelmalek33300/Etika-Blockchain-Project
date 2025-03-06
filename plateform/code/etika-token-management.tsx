// src/pages/shared/TokenManagement.tsx - Page de gestion des tokens commune à tous les utilisateurs
import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Button,
  Divider,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  LocalOffer as TokenIcon,
  Send as SendIcon,
  Cached as ConvertIcon,
  History as HistoryIcon,
  InfoOutlined as InfoIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import DashboardCard from '../../components/dashboard/DashboardCard';

const TokenManagement: React.FC = () => {
  const { user, userRoles } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [tokenData, setTokenData] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [openSendDialog, setOpenSendDialog] = useState(false);
  const [openConvertDialog, setOpenConvertDialog] = useState(false);
  const [sendForm, setSendForm] = useState({
    recipient: '',
    amount: '',
    message: ''
  });
  const [convertForm, setConvertForm] = useState({
    amount: '',
    convertTo: 'EUR'
  });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTokenData = async () => {
      try {
        // Simulation d'un appel API
        await new Promise(resolve => setTimeout(resolve, 1000));

        setTokenData({
          balance: 8750,
          eurValue: 8750 * 0.95,
          received30d: 2850,
          sent30d: 1230,
          convertedValue30d: 1520 * 0.95,
          conversionRate: 0.95,
          restrictionLevel: 'medium'
        });

        setTransactions([
          {
            id: 'TK12345678',
            date: '2025-02-07T15:32:21',
            type: 'received',
            amount: 500,
            from: 'Super Express',
            to: 'Ma Société',
            status: 'completed',
            description: 'Paiement pour services rendus'
          },
          {
            id: 'TK12345679',
            date: '2025-02-06T11:15:42',
            type: 'sent',
            amount: 200,
            from: 'Ma Société',
            to: 'Green Services',
            status: 'completed',
            description: 'Paiement mensuel'
          },
          {
            id: 'TK12345680',
            date: '2025-02-05T09:45:18',
            type: 'converted',
            amount: 1000,
            from: 'Ma Société',
            to: 'Compte bancaire',
            status: 'completed',
            description: 'Conversion en EUR'
          },
          {
            id: 'TK12345681',
            date: '2025-02-03T16:22:05',
            type: 'received',
            amount: 750,
            from: 'Bio Market',
            to: 'Ma Société',
            status: 'completed',
            description: 'Commande #45678'
          },
          {
            id: 'TK12345682',
            date: '2025-02-01T14:10:33',
            type: 'sent',
            amount: 350,
            from: 'Ma Société',
            to: 'Local Café',
            status: 'completed',
            description: 'Paiement services'
          }
        ]);
      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTokenData();
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleSendDialogOpen = () => {
    setOpenSendDialog(true);
    setSubmitSuccess(null);
    setSubmitError(null);
  };

  const handleSendDialogClose = () => {
    setOpenSendDialog(false);
  };

  const handleConvertDialogOpen = () => {
    setOpenConvertDialog(true);
    setSubmitSuccess(null);
    setSubmitError(null);
  };

  const handleConvertDialogClose = () => {
    setOpenConvertDialog(false);
  };

  const handleSendFormChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSendForm({
      ...sendForm,
      [event.target.name]: event.target.value
    });
  };

  const handleConvertFormChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setConvertForm({
      ...convertForm,
      [event.target.name]: event.target.value
    });
  };

  const handleSendTokens = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitLoading(true);
    setSubmitSuccess(null);
    setSubmitError(null);

    try {
      // Simulation d'un appel API
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Validation basique
      if (parseInt(sendForm.amount) <= 0) {
        throw new Error('Le montant doit être supérieur à 0');
      }
      
      if (parseInt(sendForm.amount) > tokenData.balance) {
        throw new Error('Solde insuffisant');
      }

      setSubmitSuccess(`${sendForm.amount} tokens ont été envoyés à ${sendForm.recipient} avec succès.`);
      
      // Dans une implémentation réelle, on actualiserait le solde et l'historique
      
    } catch (error: any) {
      setSubmitError(error.message || 'Une erreur est survenue lors de l\'envoi des tokens.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleConvertTokens = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitLoading(true);
    setSubmitSuccess(null);
    setSubmitError(null);

    try {
      // Simulation d'un appel API
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Validation basique
      if (parseInt(convertForm.amount) <= 0) {
        throw new Error('Le montant 
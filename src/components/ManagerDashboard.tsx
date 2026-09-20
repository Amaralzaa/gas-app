import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Truck, 
  CheckCircle2, 
  TrendingUp, 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter,
  User,
  MapPin,
  ChevronRight,
  Edit2,
  X,
  Map as MapIcon,
  Copy,
  ExternalLink,
  Phone,
  MessageSquare,
  Plus,
  Search,
  Minus,
  Gift,
  Ticket,
  Trash2,
  Star,
  Check,
  Users,
  Calendar,
  Send,
  Clock,
  History,
  AlertCircle,
  LogOut,
  RotateCw,
  Store,
  Building2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import { AppUser, Order, OrderStatus, Expense, Address, CoverageArea, Coupon, Reward, Referral, BenefitsConfig, UserRole, BusinessInfo } from '../types';
import { authService } from '../services/authService';
import { supabase } from '../lib/supabase';
import { playNewOrderSound, unlockAudio } from '../utils/sounds';
import { BusinessSettingsTab } from './BusinessSettingsTab';
import { DEFAULT_BUSINESS_INFO } from '../services/businessService';

// Fix Leaflet default icon issue
let DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;
import { PRODUCTS } from '../constants';

interface ManagerDashboardProps {
  user: AppUser;
  orders: Order[];
  onUpdateOrder: (order: Order) => void;
  onAddOrder: (order: Order) => void;
  deliveryPersons: AppUser[];
  allCustomers: AppUser[];
  allCollaborators: AppUser[];
  expenses: Expense[];
  coverageAreas: CoverageArea[];
  onUpdateCoverage: (areas: CoverageArea[]) => void;
  coupons: Coupon[];
  onUpdateCoupons: (coupons: Coupon[]) => void;
  rewards: Reward[];
  onUpdateRewards: (rewards: Reward[]) => void;
  referrals: Referral[];
  onUpdateReferrals: (referrals: Referral[]) => void;
  onUpdateUser: (user: AppUser) => void;
  benefitsConfig: BenefitsConfig;
  onUpdateBenefitsConfig: (config: BenefitsConfig) => void;
  onLogout?: () => void;
  onRefreshData?: () => void;
  businessInfo?: BusinessInfo;
  onUpdateBusinessInfo?: (info: BusinessInfo) => Promise<void> | void;
}

export const ManagerDashboard: React.FC<ManagerDashboardProps> = ({ 
  user,
  orders, 
  onUpdateOrder, 
  onAddOrder, 
  deliveryPersons, 
  allCustomers, 
  allCollaborators,
  expenses,
  coverageAreas,
  onUpdateCoverage,
  coupons,
  onUpdateCoupons,
  rewards,
  onUpdateRewards,
  referrals,
  onUpdateReferrals,
  onUpdateUser,
  benefitsConfig,
  onUpdateBenefitsConfig,
  onLogout,
  onRefreshData,
  businessInfo = DEFAULT_BUSINESS_INFO,
  onUpdateBusinessInfo
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tracking' | 'orders' | 'map' | 'coverage' | 'benefits' | 'predictions' | 'collaborators' | 'meu_negocio'>('tracking');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'Todos'>('Todos');
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);
  const [cancellationReason, setCancellationReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [currentTime, setCurrentTime] = useState(Date.now());

  const CANCELLATION_REASONS = [
    'Cliente desistiu da compra',
    'Endereço não localizado ou fora da área',
    'Sem botijão / produto em estoque',
    'Sem entregador disponível no momento',
    'Pedido duplicado ou feito por engano',
    'Outro motivo'
  ];

  const handleConfirmCancellation = () => {
    if (!cancellingOrder) return;
    let finalReason = '';
    if (cancellationReason === 'Outro motivo') {
      finalReason = customReason.trim();
    } else if (cancellationReason) {
      finalReason = customReason.trim() ? `${cancellationReason} - ${customReason.trim()}` : cancellationReason;
    } else {
      finalReason = customReason.trim();
    }

    if (!finalReason) {
      alert('Por favor, selecione ou informe o motivo do cancelamento.');
      return;
    }

    const updated: Order = {
      ...cancellingOrder,
      status: 'Cancelado',
      cancellationReason: finalReason,
      cancelledAt: new Date().toISOString()
    };

    onUpdateOrder(updated);

    if (selectedOrderDetails && selectedOrderDetails.id === cancellingOrder.id) {
      setSelectedOrderDetails(updated);
    }

    setCancellingOrder(null);
    setCancellationReason('');
    setCustomReason('');
    alert(`Pedido #${cancellingOrder.id} cancelado com sucesso.`);
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  // --- Notificação sonora: novo pedido chegou para o Gestor ---
  const prevPendingIdsRef = useRef<Set<string>>(new Set(orders.filter(o => o.status === 'Pendente').map(o => o.id)));
  const audioUnlockedRef = useRef(false);

  // Desbloqueia áudio na primeira interação do usuário
  useEffect(() => {
    const unlock = () => {
      if (!audioUnlockedRef.current) {
        unlockAudio();
        audioUnlockedRef.current = true;
      }
    };
    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, []);

  useEffect(() => {
    const currentPending = orders.filter(o => o.status === 'Pendente');
    const newOrders = currentPending.filter(o => !prevPendingIdsRef.current.has(o.id));

    if (newOrders.length > 0) {
      // Toca o som de novo pedido
      playNewOrderSound().catch(() => {});

      // Notificação do sistema (se permitida)
      if ('Notification' in window && Notification.permission === 'granted') {
        newOrders.forEach(o => {
          new Notification('🛒 Novo Pedido!', {
            body: `${o.customerName} — ${o.address.street}, ${o.address.neighborhood}`,
            icon: '/favicon.ico',
            tag: o.id
          });
        });
      } else if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }

    // Atualiza a referência com os IDs pendentes atuais
    prevPendingIdsRef.current = new Set(currentPending.map(o => o.id));
  }, [orders]);


  const getElapsedMinutes = (dateStr: string) => {
    if (!dateStr) return 0;
    const created = new Date(dateStr).getTime();
    if (isNaN(created)) return 0;
    return Math.max(0, Math.floor((currentTime - created) / 60000));
  };

  const getCustomerOrdersCount = (customerId: string, phone?: string) => {
    return orders.filter(o => o.customerId === customerId || (phone && o.phone === phone)).length;
  };
  const [areaToDelete, setAreaToDelete] = useState<string | null>(null);
  const [assigningOrder, setAssigningOrder] = useState<Order | null>(null);
  const [isAddingOrder, setIsAddingOrder] = useState(false);
  const [isAddingCoverage, setIsAddingCoverage] = useState(false);
  const [isAddingCoupon, setIsAddingCoupon] = useState(false);
  const [viewingCustomerHistory, setViewingCustomerHistory] = useState<any | null>(null);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [selectedPrediction, setSelectedPrediction] = useState<any | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [customCouponCode, setCustomCouponCode] = useState('');
  const [newCoupon, setNewCoupon] = useState<Partial<Coupon>>({
    code: '',
    type: 'fixed',
    value: 0,
    isActive: true,
    usageCount: 0,
    isOneTimePerUser: false,
    validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });
  const [newArea, setNewArea] = useState({ neighborhood: '', city: 'São Paulo', uf: 'SP' });
  const [ufs, setUfs] = useState<{sigla: string, nome: string}[]>([]);
  const [cities, setCities] = useState<{nome: string}[]>([]);

  useEffect(() => {
    fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados')
      .then(res => res.json())
      .then(data => setUfs(data.sort((a: any, b: any) => a.sigla.localeCompare(b.sigla))));
  }, []);

  useEffect(() => {
    if (newArea.uf) {
      fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${newArea.uf}/municipios`)
        .then(res => res.json())
        .then(data => setCities(data));
    }
  }, [newArea.uf]);
  const [benefitSubTab, setBenefitSubTab] = useState<'settings' | 'rewards' | 'coupons' | 'referrals'>('settings');
  const [configForm, setConfigForm] = useState<BenefitsConfig>(benefitsConfig || {
    referralDiscountValue: 10,
    referralPointsAwarded: 100,
    pointsPerCurrency: 10,
    referralMinOrderValue: 0
  });
  const [configSavedToast, setConfigSavedToast] = useState(false);

  useEffect(() => {
    if (benefitsConfig) {
      setConfigForm(benefitsConfig);
    }
  }, [benefitsConfig]);

  // Gestão de Recompensas do Catálogo
  const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);
  const [rewardForm, setRewardForm] = useState<{
    title: string;
    description: string;
    pointsCost: number;
    type: 'discount' | 'free_item' | 'cashback';
    value: number;
    validityDays: number;
    minOrderValue: number;
    rulesText: string;
    isActive: boolean;
  }>({
    title: '',
    description: '',
    pointsCost: 200,
    type: 'discount',
    value: 10,
    validityDays: 30,
    minOrderValue: 0,
    rulesText: 'Válido para 1 pedido\nNão cumulativo com outras promoções',
    isActive: true
  });
  const [isAddingCollaborator, setIsAddingCollaborator] = useState(false);
  const [newCollaborator, setNewCollaborator] = useState({
    name: '',
    email: '',
    password: '',
    role: 'admin' as UserRole,
    allowedTabs: [] as string[]
  });
  const [isSavingCollaborator, setIsSavingCollaborator] = useState(false);

  const customerPredictions = useMemo(() => {
    return allCustomers.map(customer => {
      const customerOrders = orders
        .filter(o => o.customerId === customer.id && o.status === 'Concluído')
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      let avgInterval = 0;
      let nextPrediction: Date | null = null;
      let totalQuantity = 0;

      customerOrders.forEach(order => {
        totalQuantity += order.items.reduce((acc, item) => acc + item.quantity, 0);
      });

      if (customerOrders.length > 1) {
        const intervals: number[] = [];
        for (let i = 1; i < customerOrders.length; i++) {
          const prev = new Date(customerOrders[i - 1].createdAt).getTime();
          const curr = new Date(customerOrders[i].createdAt).getTime();
          intervals.push((curr - prev) / (1000 * 60 * 60 * 24));
        }
        avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        
        const lastOrderDate = new Date(customerOrders[customerOrders.length - 1].createdAt);
        nextPrediction = new Date(lastOrderDate.getTime() + avgInterval * 24 * 60 * 60 * 1000);
      }

      return {
        customer,
        totalOrders: customerOrders.length,
        totalQuantity,
        avgInterval,
        nextPrediction,
        history: customerOrders
      };
    }).filter(p => {
      if (p.totalOrders <= 0 || !p.nextPrediction) return false;
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      // Only show if next prediction is not more than 10 days in the past
      return p.nextPrediction >= tenDaysAgo;
    })
    .sort((a, b) => {
      if (!a.nextPrediction) return 1;
      if (!b.nextPrediction) return -1;
      return a.nextPrediction.getTime() - b.nextPrediction.getTime();
    });
  }, [allCustomers, orders]);

  // New Order State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<AppUser | null>(null);
  const [cart, setCart] = useState<{ [id: string]: number }>({});

  // Search filter for orders (tracking & orders tabs)
  const [orderSearchQuery, setOrderSearchQuery] = useState('');

  const matchesOrderSearch = (order: Order, term: string) => {
    if (!term || !term.trim()) return true;
    const cleanTerm = term.toLowerCase().trim();
    const cleanTermDigits = term.replace(/\D/g, '');

    // 1. Número do pedido (id)
    const orderId = (order.id || '').toLowerCase();
    const cleanId = orderId.replace(/^#/, '');
    const cleanTermNoHash = cleanTerm.replace(/^#/, '');
    const matchesId = orderId.includes(cleanTerm) || cleanId.includes(cleanTermNoHash);

    // 2. Nome do cliente
    const customerName = (order.customerName || '').toLowerCase();
    const matchesName = customerName.includes(cleanTerm);

    // 3. Telefone do cliente (busca textual ou por dígitos limpos)
    const phone = (order.phone || '').toLowerCase();
    const phoneDigits = (order.phone || '').replace(/\D/g, '');
    const matchesPhone = phone.includes(cleanTerm) || (cleanTermDigits.length > 0 && phoneDigits.includes(cleanTermDigits));

    return matchesId || matchesName || matchesPhone;
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchesStatus = statusFilter === 'Todos' || o.status === statusFilter;
      const matchesSearch = matchesOrderSearch(o, orderSearchQuery);
      return matchesStatus && matchesSearch;
    });
  }, [orders, statusFilter, orderSearchQuery]);

  // Metrics
  const totalRevenue = orders.filter(o => o.status === 'Concluído').reduce((acc, o) => acc + o.total, 0);
  const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
  const netProfit = totalRevenue - totalExpenses;
  const totalQty = orders.filter(o => o.status === 'Concluído').reduce((acc, o) => acc + o.items.reduce((sum, item) => sum + item.quantity, 0), 0);

  const filteredCustomers = allCustomers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.addresses?.some(a => a.street.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const cartTotal = Object.entries(cart).reduce((acc, [id, qty]) => {
    const product = PRODUCTS.find(p => p.id === id);
    return acc + (product?.price || 0) * (qty as number);
  }, 0);

  const handleNewOrder = () => {
    if (!selectedCustomer || !selectedCustomer.addresses?.[0]) return;
    const newOrder: Order = {
      id: 'MGR-' + Math.random().toString(36).substr(2, 5).toUpperCase(),
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      phone: selectedCustomer.phone || '',
      address: selectedCustomer.addresses[0],
      items: Object.entries(cart).map(([id, qty]) => ({
        productId: id,
        quantity: qty as number,
        priceAtTime: PRODUCTS.find(p => p.id === id)?.price || 0
      })),
      total: cartTotal,
      paymentMethod: 'Dinheiro',
      status: 'Pendente',
      createdAt: new Date().toISOString()
    };
    onAddOrder(newOrder);
    setIsAddingOrder(false);
    setCart({});
    setSelectedCustomer(null);
  };

  const handleAddCoverage = async () => {
    if (!newArea.neighborhood || !newArea.city) return;
    
    setIsGeocoding(true);
    let center = { lat: -22.825 + (Math.random() - 0.5) * 0.02, lng: -43.055 + (Math.random() - 0.5) * 0.02 };
    let boundary = null;

    try {
      const query = encodeURIComponent(`${newArea.neighborhood}, ${newArea.city}, ${newArea.uf}, Brasil`);
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1&polygon_geojson=1`);
      const data = await response.json();
      
      if (data && data.length > 0) {
        center = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        boundary = data[0].geojson;
      }
    } catch (err) {
      console.error('Geocoding failed, using fallback:', err);
    } finally {
      onUpdateCoverage([...coverageAreas, {
        id: Math.random().toString(36).substr(2, 9),
        neighborhood: newArea.neighborhood,
        city: newArea.city,
        allowedCeps: [],
        center,
        boundary
      }]);
      
      setNewArea({ ...newArea, neighborhood: '' });
      setIsGeocoding(false);
      setIsAddingCoverage(false);
    }
  };

  const handleAssign = (orderId: string, deliveryPersonId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (order) {
      // Se o pedido estava pendente e agora tem entregador, muda o status
      // Apenas muda para 'Atribuído', esperando que o entregador aceite
      const updated = { ...order, status: 'Atribuído' as OrderStatus, deliveryPersonId };
      onUpdateOrder(updated);
      setAssigningOrder(null);
      if (selectedOrderDetails && selectedOrderDetails.id === orderId) {
        setSelectedOrderDetails(updated);
      }
    }
  };

  const handleAddCoupon = () => {
    if (!newCoupon.code || !newCoupon.value) return;
    
    const coupon: Coupon = {
      id: Math.random().toString(36).substr(2, 9),
      code: newCoupon.code.toUpperCase(),
      type: newCoupon.type as 'fixed' | 'percentage',
      value: newCoupon.value,
      validUntil: newCoupon.validUntil || '',
      isActive: true,
      usageCount: 0,
      usageLimit: newCoupon.usageLimit,
      isOneTimePerUser: newCoupon.isOneTimePerUser,
      allowedNeighborhoods: newCoupon.allowedNeighborhoods,
      allowedUserRoles: newCoupon.allowedUserRoles
    };
    
    onUpdateCoupons([...coupons, coupon]);
    setIsAddingCoupon(false);
    setNewCoupon({
      code: '',
      type: 'fixed',
      value: 0,
      isActive: true,
      usageCount: 0,
      isOneTimePerUser: false,
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    });
  };

  const handleSaveReward = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rewardForm.title.trim()) {
      alert("Por favor, informe o título da recompensa.");
      return;
    }

    const rulesArray = rewardForm.rulesText
      .split('\n')
      .map(r => r.trim())
      .filter(r => r.length > 0);

    if (editingRewardId) {
      const updated = rewards.map(r => r.id === editingRewardId ? {
        ...r,
        title: rewardForm.title.trim(),
        description: rewardForm.description.trim(),
        pointsCost: Number(rewardForm.pointsCost) || 100,
        type: rewardForm.type,
        value: Number(rewardForm.value) || 0,
        validityDays: Number(rewardForm.validityDays) || 30,
        minOrderValue: Number(rewardForm.minOrderValue) || 0,
        rules: rulesArray,
        isActive: rewardForm.isActive
      } : r);
      onUpdateRewards(updated);
    } else {
      const newReward: Reward = {
        id: `rew-${Date.now()}`,
        title: rewardForm.title.trim(),
        description: rewardForm.description.trim(),
        pointsCost: Number(rewardForm.pointsCost) || 100,
        type: rewardForm.type,
        value: Number(rewardForm.value) || 0,
        validityDays: Number(rewardForm.validityDays) || 30,
        minOrderValue: Number(rewardForm.minOrderValue) || 0,
        rules: rulesArray,
        isActive: rewardForm.isActive
      };
      onUpdateRewards([newReward, ...rewards]);
    }

    setIsRewardModalOpen(false);
    setEditingRewardId(null);
  };

  const handleSendMessage = (prediction: any, type: 'reminder' | 'coupon', code?: string) => {
    const now = new Date();
    const lastSent = prediction.customer.lastMessageSentAt ? new Date(prediction.customer.lastMessageSentAt) : null;
    
    if (lastSent) {
      const diffHours = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);
      
      if (diffHours < 24) {
        alert("Você já enviou uma mensagem para este cliente nas últimas 24h.");
        return;
      }
      
      if (diffHours < 72) {
        if (!window.confirm("Uma mensagem foi enviada há menos de 72h para este cliente. Tem certeza que deseja enviar outra?")) {
          return;
        }
      }
    }

    let message = "";
    if (type === 'reminder') {
      message = `Olá ${prediction.customer.name}, notamos que seu gás pode estar acabando. Gostaria de pedir um novo?`;
    } else {
      message = `Olá ${prediction.customer.name}! Temos um cupom especial para você: ${code}. Aproveite no seu próximo pedido!`;
    }

    // Update user's last message sent date
    onUpdateUser({
      ...prediction.customer,
      lastMessageSentAt: now.toISOString()
    });

    window.open(`https://wa.me/55${prediction.customer.phone?.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
    setIsCouponModalOpen(false);
    setCustomCouponCode('');
  };

  const handleAddCollaborator = async () => {
    if (!newCollaborator.name || !newCollaborator.email || !newCollaborator.password) return;
    
    setIsSavingCollaborator(true);
    try {
      // We'll use authService.signUp but we need to pass the extra data
      // For now, satisfy the UI by optimistically adding or calling a custom signup
      const createdUser = await authService.signUp(
        newCollaborator.email, 
        newCollaborator.name, 
        newCollaborator.role,
        '' // No phone for collaborators usually, or same as email for now
      );

      if (!createdUser) throw new Error('Não foi possível criar o colaborador');

      // Update profile with allowedTabs (since signUp might not include it yet)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ allowedTabs: newCollaborator.allowedTabs })
        .eq('id', createdUser.id);

      if (profileError) throw profileError;

      alert('Colaborador cadastrado com sucesso!');
      setIsAddingCollaborator(false);
      setNewCollaborator({
        name: '',
        email: '',
        password: '',
        role: 'admin',
        allowedTabs: []
      });
      // In a real app, you'd trigger a reload of allCollaborators prop
    } catch (err: any) {
      alert('Erro ao cadastrar colaborador: ' + err.message);
    } finally {
      setIsSavingCollaborator(false);
    }
  };

  const ALL_TABS = [
    { id: 'dashboard', label: 'Métricas' },
    { id: 'tracking', label: 'Acompanhamento' },
    { id: 'orders', label: 'Pedidos' },
    { id: 'map', label: 'Monitoramento' },
    { id: 'coverage', label: 'Cobertura' },
    { id: 'benefits', label: 'Benefícios' },
    { id: 'predictions', label: 'Previsão' },
    { id: 'meu_negocio', label: 'Meu Negócio' }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white hidden md:flex flex-col sticky top-0 h-screen">
        <div className="p-8">
          <h1 className="text-xl font-black tracking-tighter flex items-center gap-2">
            <div className="bg-yellow-400 w-8 h-8 rounded-lg flex items-center justify-center">
              <Package className="text-slate-900 w-5 h-5" />
            </div>
            GÁS EXPRESS
          </h1>
          <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-widest">Painel Gestor</p>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          {(user.role === 'gestor' || user.allowedTabs?.includes('dashboard')) && (
            <button 
              onClick={() => setActiveTab('dashboard')} 
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'dashboard' ? 'bg-yellow-400 text-slate-900' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <LayoutDashboard className="w-5 h-5" /> Métricas
            </button>
          )}
          {(user.role === 'gestor' || user.allowedTabs?.includes('tracking')) && (
            <button 
              onClick={() => setActiveTab('tracking')} 
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'tracking' ? 'bg-yellow-400 text-slate-900' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <Clock className="w-5 h-5" /> Acompanhamento
            </button>
          )}
          {(user.role === 'gestor' || user.allowedTabs?.includes('orders')) && (
            <button 
              onClick={() => setActiveTab('orders')} 
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'orders' ? 'bg-yellow-400 text-slate-900' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <Package className="w-5 h-5" /> Pedidos
            </button>
          )}
          {(user.role === 'gestor' || user.allowedTabs?.includes('map')) && (
            <button 
              onClick={() => setActiveTab('map')} 
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'map' ? 'bg-yellow-400 text-slate-900' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <MapIcon className="w-5 h-5" /> Monitoramento
            </button>
          )}
          {(user.role === 'gestor' || user.allowedTabs?.includes('coverage')) && (
            <button 
              onClick={() => setActiveTab('coverage')} 
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'coverage' ? 'bg-yellow-400 text-slate-900' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <MapPin className="w-5 h-5" /> Cobertura
            </button>
          )}
          {(user.role === 'gestor' || user.allowedTabs?.includes('benefits')) && (
            <button 
              onClick={() => setActiveTab('benefits')} 
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'benefits' ? 'bg-yellow-400 text-slate-900' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <Gift className="w-5 h-5" /> Benefícios
            </button>
          )}
          {(user.role === 'gestor' || user.allowedTabs?.includes('predictions')) && (
            <button 
              onClick={() => setActiveTab('predictions')} 
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'predictions' ? 'bg-yellow-400 text-slate-900' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <Calendar className="w-5 h-5" /> Previsão
            </button>
          )}
          {user.role === 'gestor' && (
            <button 
              onClick={() => setActiveTab('collaborators')} 
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'collaborators' ? 'bg-yellow-400 text-slate-900' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <Users className="w-5 h-5" /> Colaboradores
            </button>
          )}
          {user.role === 'gestor' && (
            <button 
              onClick={() => setActiveTab('meu_negocio')} 
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'meu_negocio' ? 'bg-yellow-400 text-slate-900' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <Store className="w-5 h-5" /> Meu Negócio
            </button>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2">
          <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-2xl">
            <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
              <User className="text-slate-400 w-5 h-5" />
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-xs font-bold truncate">{user.name}</p>
              <p className="text-[10px] text-slate-500 truncate uppercase tracking-tight">{user.role}</p>
            </div>
          </div>
          {onLogout && (
            <button 
              type="button" 
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-red-600/90 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-700/60 cursor-pointer shadow-sm"
              title="Sair do Painel"
            >
              <LogOut className="w-3.5 h-3.5 text-red-400" /> Sair do Painel
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 pb-20">
        {/* Mobile Header */}
        <header className="md:hidden p-6 bg-white border-b border-slate-100 flex items-center justify-between sticky top-0 z-30 overflow-x-auto">
          <h1 className="text-xl font-black text-slate-900 shrink-0 mr-4">Gás Express</h1>
          <div className="flex gap-2">
            {(user.role === 'gestor' || user.allowedTabs?.includes('dashboard')) && <button onClick={() => setActiveTab('dashboard')} className={`p-2 rounded-lg ${activeTab === 'dashboard' ? 'bg-yellow-400' : 'bg-slate-100'}`}><LayoutDashboard className="w-5 h-5" /></button>}
            {(user.role === 'gestor' || user.allowedTabs?.includes('tracking')) && <button onClick={() => setActiveTab('tracking')} className={`p-2 rounded-lg ${activeTab === 'tracking' ? 'bg-yellow-400' : 'bg-slate-100'}`}><Clock className="w-5 h-5" /></button>}
            {(user.role === 'gestor' || user.allowedTabs?.includes('orders')) && <button onClick={() => setActiveTab('orders')} className={`p-2 rounded-lg ${activeTab === 'orders' ? 'bg-yellow-400' : 'bg-slate-100'}`}><Package className="w-5 h-5" /></button>}
            {(user.role === 'gestor' || user.allowedTabs?.includes('map')) && <button onClick={() => setActiveTab('map')} className={`p-2 rounded-lg ${activeTab === 'map' ? 'bg-yellow-400' : 'bg-slate-100'}`}><MapIcon className="w-5 h-5" /></button>}
            {(user.role === 'gestor' || user.allowedTabs?.includes('coverage')) && <button onClick={() => setActiveTab('coverage')} className={`p-2 rounded-lg ${activeTab === 'coverage' ? 'bg-yellow-400' : 'bg-slate-100'}`}><MapPin className="w-5 h-5" /></button>}
            {user.role === 'gestor' && <button onClick={() => setActiveTab('collaborators')} className={`p-2 rounded-lg ${activeTab === 'collaborators' ? 'bg-yellow-400' : 'bg-slate-100'}`}><Users className="w-5 h-5" /></button>}
            {user.role === 'gestor' && <button onClick={() => setActiveTab('meu_negocio')} className={`p-2 rounded-lg ${activeTab === 'meu_negocio' ? 'bg-yellow-400' : 'bg-slate-100'}`} title="Meu Negócio"><Store className="w-5 h-5" /></button>}
            {onLogout && (
              <button 
                type="button" 
                onClick={onLogout} 
                className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-200" 
                title="Sair da Conta"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </header>

        <div className="p-6 lg:p-10 max-w-6xl mx-auto">
          <header className="hidden md:flex items-center justify-between mb-10">
            <div>
              <h2 className="text-3xl font-black text-slate-900">
                {activeTab === 'dashboard' && "Visão Geral"}
                {activeTab === 'tracking' && "Acompanhamento de Pedidos"}
                {activeTab === 'orders' && "Gestão de Pedidos"}
                {activeTab === 'map' && "Mapa de Entregas"}
                {activeTab === 'coverage' && "Área de Cobertura"}
                {activeTab === 'benefits' && "Gestão de Benefícios & Cupons"}
                {activeTab === 'predictions' && "Previsão de Consumo"}
                {activeTab === 'collaborators' && "Gestão de Colaboradores"}
                {activeTab === 'meu_negocio' && "Meu Negócio & Estabelecimento"}
              </h2>
              <p className="text-slate-500 font-medium">
                {activeTab === 'meu_negocio' ? "Gerencie horários de atendimento, logotipo e dados da sua empresa." : "Acompanhe o desempenho da sua revenda em tempo real."}
              </p>
            </div>
          </header>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <div className="bg-green-100 w-10 h-10 rounded-2xl flex items-center justify-center mb-4"><DollarSign className="text-green-600 w-5 h-5" /></div>
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Receita Total</p>
                  <p className="text-2xl font-black text-slate-900">R$ {totalRevenue.toFixed(2)}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <div className="bg-red-100 w-10 h-10 rounded-2xl flex items-center justify-center mb-4"><ArrowDownRight className="text-red-600 w-5 h-5" /></div>
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Despesas</p>
                  <p className="text-2xl font-black text-slate-900">R$ {totalExpenses.toFixed(2)}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <div className="bg-blue-100 w-10 h-10 rounded-2xl flex items-center justify-center mb-4"><TrendingUp className="text-blue-600 w-5 h-5" /></div>
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Lucro Líquido</p>
                  <p className="text-2xl font-black text-slate-900">R$ {netProfit.toFixed(2)}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <div className="bg-yellow-100 w-10 h-10 rounded-2xl flex items-center justify-center mb-4"><Package className="text-yellow-600 w-5 h-5" /></div>
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Qtd. Vendida</p>
                  <p className="text-2xl font-black text-slate-900">{totalQty} un</p>
                </div>
              </div>

              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                <h3 className="font-black text-lg mb-6">Resumo de Vendas por Produto</h3>
                <div className="space-y-4">
                  {PRODUCTS.map(p => {
                    const qty = orders.filter(o => o.status === 'Concluído').reduce((acc, o) => acc + o.items.filter(i => i.productId === p.id).reduce((sum, i) => sum + i.quantity, 0), 0);
                    return (
                      <div key={p.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img src={p.image} className="w-10 h-10 rounded-xl object-cover" referrerPolicy="no-referrer" />
                          <span className="font-bold text-sm">{p.name}</span>
                        </div>
                        <span className="font-black text-slate-900">{qty} un</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'tracking' && (() => {
            const pendingOrders = orders
              .filter(o => o.status === 'Pendente' && matchesOrderSearch(o, orderSearchQuery))
              .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

            const assignedOrders = orders
              .filter(o => o.status === 'Atribuído' && matchesOrderSearch(o, orderSearchQuery))
              .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

            const inRouteOrders = orders
              .filter(o => o.status === 'Em Rota' && matchesOrderSearch(o, orderSearchQuery))
              .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

            const totalMatchingActive = pendingOrders.length + assignedOrders.length + inRouteOrders.length;

            return (
              <motion.div key="tracking" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                
                {/* Campo de Busca em Acompanhamento */}
                <div className="bg-white p-3 sm:p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar por nome, telefone ou nº do pedido (#123)..."
                      value={orderSearchQuery}
                      onChange={(e) => setOrderSearchQuery(e.target.value)}
                      className="w-full pl-10 sm:pl-12 pr-10 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-white transition-all"
                    />
                    {orderSearchQuery && (
                      <button
                        onClick={() => setOrderSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                        title="Limpar busca"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {onRefreshData && (
                    <button
                      type="button"
                      onClick={onRefreshData}
                      className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-black rounded-2xl text-xs transition-all shadow-sm active:scale-95 shrink-0 cursor-pointer"
                      title="Atualizar lista de pedidos agora"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Atualizar</span>
                    </button>
                  )}
                  {orderSearchQuery && (
                    <div className="flex items-center justify-between sm:justify-start gap-2 shrink-0">
                      <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-2 rounded-xl">
                        {totalMatchingActive} {totalMatchingActive === 1 ? 'pedido ativo' : 'pedidos ativos'}
                      </span>
                      <button
                        onClick={() => setOrderSearchQuery('')}
                        className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-xl transition-colors"
                      >
                        Limpar
                      </button>
                    </div>
                  )}
                </div>

                {orderSearchQuery && totalMatchingActive === 0 ? (
                  <div className="bg-white rounded-3xl p-10 text-center border border-dashed border-slate-200 text-slate-400">
                    <Search className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    <p className="font-bold text-base text-slate-700">Nenhum pedido ativo encontrado</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                      Não encontramos pedidos em andamento para <strong className="text-slate-600">"{orderSearchQuery}"</strong>. O pedido pode já ter sido concluído ou cancelado.
                    </p>
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                      <button
                        onClick={() => setOrderSearchQuery('')}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition-colors"
                      >
                        Limpar busca
                      </button>
                      <button
                        onClick={() => setActiveTab('orders')}
                        className="bg-yellow-400 hover:bg-yellow-500 text-slate-900 text-xs font-bold px-4 py-2.5 rounded-xl transition-colors shadow-sm"
                      >
                        Ver no histórico em Pedidos →
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                {/* 1. SEÇÃO: PEDIDOS PENDENTES */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse"></div>
                      <h3 className="font-black text-lg text-slate-900">
                        Pedidos Pendentes <span className="text-amber-600">({pendingOrders.length})</span>
                      </h3>
                    </div>
                    <span className="text-xs text-slate-500 font-bold hidden sm:inline">
                      Ordenado pelo maior tempo de espera no topo
                    </span>
                  </div>

                  {pendingOrders.length === 0 ? (
                    <div className="bg-white rounded-3xl p-8 text-center border border-dashed border-slate-200 text-slate-400">
                      <Package className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-sm">Nenhum pedido pendente no momento.</p>
                      <p className="text-xs text-slate-400 mt-1">Todos os pedidos foram atribuídos ou estão concluídos.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {pendingOrders.map(o => {
                        const elapsed = getElapsedMinutes(o.createdAt);
                        const ordersCount = getCustomerOrdersCount(o.customerId, o.phone);
                        const itemsSummary = o.items.map(it => {
                          const p = PRODUCTS.find(pr => pr.id === it.productId);
                          return `${it.quantity}x ${p?.name || 'Item'}`;
                        }).join(' + ');

                        return (
                          <div 
                            key={o.id}
                            onClick={() => setSelectedOrderDetails(o)}
                            className="bg-white rounded-3xl p-5 border-2 border-amber-300 shadow-sm hover:shadow-xl transition-all cursor-pointer relative overflow-hidden group flex flex-col justify-between"
                          >
                            <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-400"></div>

                            <div>
                              <div className="flex justify-between items-start mb-3">
                                <div>
                                  <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md uppercase">#{o.id}</span>
                                  <div className="flex items-center gap-1.5 mt-1.5">
                                    <h4 className="font-black text-base text-slate-900 group-hover:text-amber-600 transition-colors">{o.customerName}</h4>
                                    <span className="text-[9px] font-black bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                                      {ordersCount <= 1 ? '1º pedido' : `${ordersCount}º pedido`}
                                    </span>
                                  </div>
                                  {o.phone && (
                                    <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                      <span>{o.phone}</span>
                                    </p>
                                  )}
                                </div>
                                
                                <div className="text-right">
                                  <div className="bg-amber-100 text-amber-800 font-black text-xs px-2.5 py-1 rounded-xl flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5 animate-pulse" />
                                    <span>{elapsed} min</span>
                                  </div>
                                  <span className="text-[10px] font-black text-amber-600 uppercase mt-1 block">Pendente</span>
                                </div>
                              </div>

                              {o.isScheduled && (
                                <div className="bg-purple-100/90 border border-purple-300 text-purple-900 rounded-xl px-2.5 py-1 text-[11px] font-black flex items-center gap-1.5 mb-2 shadow-sm">
                                  <Calendar className="w-3.5 h-3.5 text-purple-700 flex-shrink-0" />
                                  <span className="truncate">📅 Agendado: {o.scheduledDate || 'Amanhã'} ({o.scheduledPeriod === 'manha' ? 'Manhã 08h-13h' : 'Tarde 13h-19h'})</span>
                                </div>
                              )}

                              <div className="bg-slate-50 rounded-2xl p-3 my-2 space-y-1.5 border border-slate-100 text-xs">
                                <div className="flex items-center justify-between font-bold text-slate-800">
                                  <span className="truncate max-w-[170px]" title={itemsSummary}>{itemsSummary}</span>
                                  <span className="whitespace-nowrap font-black">R$ {o.total.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-slate-500">
                                  <span>Pagamento: <strong className="text-slate-800">{o.paymentMethod}</strong></span>
                                  {o.couponCode && (
                                    <span className="text-emerald-700 bg-emerald-100 px-1.5 rounded font-black text-[9px]">
                                      {o.couponCode}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 truncate pt-1 border-t border-slate-200/60 flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="truncate">{o.address.street}, {o.address.number} • {o.address.neighborhood}</span>
                                </div>
                              </div>
                            </div>

                            <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100 mt-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAssigningOrder(o);
                                }}
                                className="w-full bg-slate-900 hover:bg-yellow-500 hover:text-slate-950 text-white font-black text-xs py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm"
                              >
                                <Truck className="w-3.5 h-3.5" /> ATRIBUIR ENTREGADOR
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. SEÇÃO: PEDIDOS ATRIBUÍDOS */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                      <h3 className="font-black text-lg text-slate-900">
                        Pedidos Atribuídos <span className="text-orange-600">({assignedOrders.length})</span>
                      </h3>
                    </div>
                    <span className="text-xs text-slate-500 font-bold hidden sm:inline">
                      Aguardando aceite ou saída do entregador
                    </span>
                  </div>

                  {assignedOrders.length === 0 ? (
                    <div className="bg-white rounded-3xl p-8 text-center border border-dashed border-slate-200 text-slate-400">
                      <Truck className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-sm">Nenhum pedido aguardando saída.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {assignedOrders.map(o => {
                        const elapsed = getElapsedMinutes(o.createdAt);
                        const ordersCount = getCustomerOrdersCount(o.customerId, o.phone);
                        const itemsSummary = o.items.map(it => {
                          const p = PRODUCTS.find(pr => pr.id === it.productId);
                          return `${it.quantity}x ${p?.name || 'Item'}`;
                        }).join(' + ');
                        const dpName = deliveryPersons.find(dp => dp.id === o.deliveryPersonId)?.name || 'Entregador';

                        return (
                          <div 
                            key={o.id}
                            onClick={() => setSelectedOrderDetails(o)}
                            className="bg-white rounded-3xl p-5 border border-orange-200 shadow-sm hover:shadow-xl transition-all cursor-pointer relative overflow-hidden group flex flex-col justify-between"
                          >
                            <div className="absolute top-0 left-0 right-0 h-1.5 bg-orange-400"></div>

                            <div>
                              <div className="flex justify-between items-start mb-3">
                                <div>
                                  <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md uppercase">#{o.id}</span>
                                  <div className="flex items-center gap-1.5 mt-1.5">
                                    <h4 className="font-black text-base text-slate-900 group-hover:text-orange-600 transition-colors">{o.customerName}</h4>
                                    <span className="text-[9px] font-black bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                                      {ordersCount <= 1 ? '1º pedido' : `${ordersCount}º pedido`}
                                    </span>
                                  </div>
                                  {o.phone && (
                                    <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                      <span>{o.phone}</span>
                                    </p>
                                  )}
                                </div>
                                
                                <div className="text-right">
                                  <div className="bg-orange-100 text-orange-800 font-black text-xs px-2.5 py-1 rounded-xl flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>{elapsed} min</span>
                                  </div>
                                  <span className="text-[10px] font-black text-orange-600 uppercase mt-1 block">Atribuído</span>
                                </div>
                              </div>

                              <div className="bg-slate-50 rounded-2xl p-3 my-2 space-y-1.5 border border-slate-100 text-xs">
                                <div className="flex items-center justify-between font-bold text-slate-800">
                                  <span className="truncate max-w-[170px]" title={itemsSummary}>{itemsSummary}</span>
                                  <span className="whitespace-nowrap font-black">R$ {o.total.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-slate-500">
                                  <span>Pagamento: <strong className="text-slate-800">{o.paymentMethod}</strong></span>
                                  {o.couponCode && (
                                    <span className="text-emerald-700 bg-emerald-100 px-1.5 rounded font-black text-[9px]">
                                      {o.couponCode}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 truncate pt-1 border-t border-slate-200/60 flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="truncate">{o.address.street}, {o.address.number} • {o.address.neighborhood}</span>
                                </div>
                              </div>
                            </div>

                            <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100 mt-2">
                              <span className="text-xs font-bold text-slate-700 truncate flex items-center gap-1">
                                🛵 {dpName}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAssigningOrder(o);
                                }}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-1.5 px-3 rounded-xl transition-colors border border-slate-200 shrink-0"
                              >
                                Trocar
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3. SEÇÃO: PEDIDOS EM ROTA */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
                      <h3 className="font-black text-lg text-slate-900">
                        Pedidos Em Rota <span className="text-blue-600">({inRouteOrders.length})</span>
                      </h3>
                    </div>
                    <span className="text-xs text-slate-500 font-bold hidden sm:inline">
                      Entregadores em deslocamento até o cliente
                    </span>
                  </div>

                  {inRouteOrders.length === 0 ? (
                    <div className="bg-white rounded-3xl p-8 text-center border border-dashed border-slate-200 text-slate-400">
                      <Truck className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-sm">Nenhum pedido em rota de entrega no momento.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {inRouteOrders.map(o => {
                        const elapsed = getElapsedMinutes(o.createdAt);
                        const ordersCount = getCustomerOrdersCount(o.customerId, o.phone);
                        const itemsSummary = o.items.map(it => {
                          const p = PRODUCTS.find(pr => pr.id === it.productId);
                          return `${it.quantity}x ${p?.name || 'Item'}`;
                        }).join(' + ');
                        const dpName = deliveryPersons.find(dp => dp.id === o.deliveryPersonId)?.name || 'Entregador';

                        return (
                          <div 
                            key={o.id}
                            onClick={() => setSelectedOrderDetails(o)}
                            className="bg-white rounded-3xl p-5 border border-blue-200 shadow-sm hover:shadow-xl transition-all cursor-pointer relative overflow-hidden group flex flex-col justify-between"
                          >
                            <div className="absolute top-0 left-0 right-0 h-1.5 bg-blue-500"></div>

                            <div>
                              <div className="flex justify-between items-start mb-3">
                                <div>
                                  <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md uppercase">#{o.id}</span>
                                  <div className="flex items-center gap-1.5 mt-1.5">
                                    <h4 className="font-black text-base text-slate-900 group-hover:text-blue-600 transition-colors">{o.customerName}</h4>
                                    <span className="text-[9px] font-black bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                                      {ordersCount <= 1 ? '1º pedido' : `${ordersCount}º pedido`}
                                    </span>
                                  </div>
                                  {o.phone && (
                                    <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                      <span>{o.phone}</span>
                                    </p>
                                  )}
                                </div>
                                
                                <div className="text-right">
                                  <div className="bg-blue-100 text-blue-800 font-black text-xs px-2.5 py-1 rounded-xl flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>{elapsed} min</span>
                                  </div>
                                  <span className="text-[10px] font-black text-blue-600 uppercase mt-1 block">Em Rota</span>
                                </div>
                              </div>

                              <div className="bg-slate-50 rounded-2xl p-3 my-2 space-y-1.5 border border-slate-100 text-xs">
                                <div className="flex items-center justify-between font-bold text-slate-800">
                                  <span className="truncate max-w-[170px]" title={itemsSummary}>{itemsSummary}</span>
                                  <span className="whitespace-nowrap font-black">R$ {o.total.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-slate-500">
                                  <span>Pagamento: <strong className="text-slate-800">{o.paymentMethod}</strong></span>
                                  {o.couponCode && (
                                    <span className="text-emerald-700 bg-emerald-100 px-1.5 rounded font-black text-[9px]">
                                      {o.couponCode}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 truncate pt-1 border-t border-slate-200/60 flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="truncate">{o.address.street}, {o.address.number} • {o.address.neighborhood}</span>
                                </div>
                              </div>
                            </div>

                            <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100 mt-2">
                              <span className="text-xs font-bold text-slate-700 truncate flex items-center gap-1">
                                🛵 {dpName}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const link = `${window.location.origin}?phone=${o.phone}`;
                                    navigator.clipboard.writeText(link);
                                    alert('Link de rastreio copiado!');
                                  }}
                                  className="text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg transition-colors"
                                  title="Copiar link de rastreio"
                                >
                                  Link
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const link = `${window.location.origin}?phone=${o.phone}`;
                                    const message = `Olá ${o.customerName}, seu pedido na Gás Express está a caminho! Acompanhe a entrega em tempo real: ${link}`;
                                    window.open(`https://wa.me/55${o.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
                                  }}
                                  className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg transition-colors"
                                  title="Enviar WhatsApp"
                                >
                                  WhatsApp
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                </>
                )}

              </motion.div>
            );
          })()}

          {activeTab === 'orders' && (
            <motion.div key="orders" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              {/* Campo de Busca em Pedidos */}
              <div className="bg-white p-3 sm:p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nome, telefone ou nº do pedido (#123)..."
                    value={orderSearchQuery}
                    onChange={(e) => setOrderSearchQuery(e.target.value)}
                    className="w-full pl-10 sm:pl-12 pr-10 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-white transition-all"
                  />
                  {orderSearchQuery && (
                    <button
                      onClick={() => setOrderSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                      title="Limpar busca"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {orderSearchQuery && (
                  <div className="flex items-center justify-between sm:justify-start gap-2 shrink-0">
                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-2 rounded-xl">
                      {filteredOrders.length} {filteredOrders.length === 1 ? 'pedido' : 'pedidos'}
                    </span>
                    <button
                      onClick={() => setOrderSearchQuery('')}
                      className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-xl transition-colors"
                    >
                      Limpar
                    </button>
                  </div>
                )}
              </div>

              {/* Filtros de Status */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {(['Todos', 'Pendente', 'Atribuído', 'Em Rota', 'Concluído', 'Cancelado'] as const).map(s => (
                  <button 
                    key={s} 
                    onClick={() => setStatusFilter(s)} 
                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${statusFilter === s ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-500 shadow-sm hover:bg-slate-50'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {filteredOrders.length === 0 ? (
                  <div className="bg-white rounded-3xl p-10 text-center border border-slate-100 shadow-sm text-slate-400 font-bold text-sm">
                    <Package className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p>
                      Nenhum pedido encontrado
                      {orderSearchQuery ? ` para "${orderSearchQuery}"` : ''}
                      {statusFilter !== 'Todos' ? ` com status "${statusFilter}"` : ''}.
                    </p>
                    {(orderSearchQuery || statusFilter !== 'Todos') && (
                      <button
                        onClick={() => {
                          setOrderSearchQuery('');
                          setStatusFilter('Todos');
                        }}
                        className="mt-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors"
                      >
                        Limpar filtros e busca
                      </button>
                    )}
                  </div>
                ) : (
                  filteredOrders.map(o => {
                    const elapsed = getElapsedMinutes(o.createdAt);
                    const ordersCount = getCustomerOrdersCount(o.customerId, o.phone);

                    return (
                      <div 
                        key={o.id} 
                        onClick={() => setSelectedOrderDetails(o)}
                        className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 hover:border-yellow-300 hover:shadow-md transition-all cursor-pointer group"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase">#{o.id}</span>
                              <span className="text-[10px] font-black bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                                {ordersCount <= 1 ? '1º pedido' : `${ordersCount}º pedido`}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-500" />
                                {elapsed} min
                              </span>
                            </div>
                            <h3 className="font-black text-lg text-slate-900 group-hover:text-yellow-600 transition-colors">{o.customerName}</h3>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-slate-500">
                              {o.phone && (
                                <span className="flex items-center gap-1 font-medium">
                                  <Phone className="w-3 h-3 text-slate-400 shrink-0" /> {o.phone}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" /> {o.address.street}, {o.address.number} • {o.address.neighborhood}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-black text-slate-900">R$ {o.total.toFixed(2)}</p>
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase inline-block mt-1 ${
                              o.status === 'Concluído' ? 'bg-green-100 text-green-700' : 
                              o.status === 'Cancelado' ? 'bg-red-100 text-red-700' :
                              o.status === 'Em Rota' ? 'bg-blue-100 text-blue-700' : 
                              o.status === 'Atribuído' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>{o.status}</span>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-slate-500">
                          <span className="font-medium truncate max-w-[280px]">
                            {o.items.map(it => {
                              const p = PRODUCTS.find(pr => pr.id === it.productId);
                              return `${it.quantity}x ${p?.name || 'Item'}`;
                            }).join(', ')}
                          </span>
                          <span className="font-bold text-slate-700 group-hover:text-yellow-600 flex items-center gap-1 shrink-0">
                            Ver detalhes e ações →
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'map' && (
            <motion.div key="map" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <h3 className="font-black text-lg mb-6 flex items-center gap-2">
                  <MapIcon className="text-yellow-500 w-5 h-5" /> Monitoramento em Tempo Real
                </h3>
                
                {/* Legenda */}
                <div className="flex flex-wrap gap-3 mb-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span> Em Rota</div>
                  <div className="flex items-center gap-1.5 text-xs font-bold"><span className="w-3 h-3 rounded-full bg-orange-500 inline-block"></span> Atribuído</div>
                  <div className="flex items-center gap-1.5 text-xs font-bold"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block"></span> Pendente</div>
                  <div className="flex items-center gap-1.5 text-xs font-bold"><span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span> Entregador</div>
                </div>

                <div className="relative bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 z-0 isolate" style={{ height: '500px' }}>
                  <MapContainer center={[-22.9, -43.11]} zoom={14} style={{ height: '500px', width: '100%' }}>
                    <TileLayer
                      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    {/* Entregadores no mapa */}
                    {deliveryPersons.map(dp => (
                      dp.location && (
                        <Marker 
                          key={dp.id} 
                          position={[dp.location.lat, dp.location.lng]}
                          icon={L.divIcon({
                            html: `<div style="background:#22c55e;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);">🛵</div>`,
                            iconSize: [32, 32],
                            iconAnchor: [16, 16],
                            className: ''
                          })}
                        >
                          <Popup>
                            <div className="font-bold">{dp.name}</div>
                            <div className="text-xs">{orders.some(o => o.deliveryPersonId === dp.id && o.status === 'Em Rota') ? '🔵 Em Entrega' : '✅ Disponível'}</div>
                          </Popup>
                        </Marker>
                      )
                    ))}
                    {/* Pedidos Ativos no mapa (marcadores numerados nos endereços dos clientes) */}
                    {orders
                      .filter(o => o.status === 'Em Rota' || o.status === 'Pendente' || o.status === 'Atribuído')
                      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                      .map((order, idx) => {
                        // Usar coordenada real do pedido, ou fallback pro centro do bairro
                        const area = coverageAreas.find(a => 
                          a.neighborhood.toLowerCase() === order.address.neighborhood.toLowerCase()
                        );
                        const lat = order.address.lat || (area?.center?.lat ? area.center.lat + (idx * 0.001) : -22.903 + (idx * 0.001));
                        const lng = order.address.lng || (area?.center?.lng ? area.center.lng + (idx * 0.0005) : -43.112 + (idx * 0.0005));
                        
                        let color = '#facc15'; // Pendente
                        let textColor = '#0f172a';
                        if (order.status === 'Atribuído') {
                          color = '#f97316'; // Laranja
                          textColor = 'white';
                        } else if (order.status === 'Em Rota') {
                          color = '#3b82f6'; // Azul
                          textColor = 'white';
                        }

                        return (
                          <Marker
                            key={order.id}
                            position={[lat, lng]}
                            icon={L.divIcon({
                              html: `<div style="background:${color};color:${textColor};width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:12px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);">${idx + 1}</div>`,
                              iconSize: [28, 28],
                              iconAnchor: [14, 14],
                              className: ''
                            })}
                          >
                            <Popup>
                              <div className="font-bold text-sm">#{order.id} — {order.customerName}</div>
                              <div className="text-xs text-slate-500">{order.address.street}, {order.address.number}</div>
                              <div className="text-xs font-bold mt-1" style={{ color }}>{order.status}</div>
                              <div className="text-xs text-slate-500">R$ {order.total.toFixed(2)} · {order.paymentMethod}</div>
                            </Popup>
                          </Marker>
                        );
                      })
                    }
                  </MapContainer>
                </div>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {deliveryPersons.map(dp => (
                    <div key={dp.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${orders.some(o => o.deliveryPersonId === dp.id && o.status === 'Em Rota') ? 'bg-blue-500 animate-pulse' : 'bg-slate-300'}`}></div>
                        <div>
                          <p className="text-sm font-bold">{dp.name}</p>
                          <p className="text-[10px] text-slate-500 uppercase font-black">
                            {orders.filter(o => o.deliveryPersonId === dp.id && o.status === 'Em Rota').length} Entrega(s) Ativa(s)
                          </p>
                        </div>
                      </div>
                      <button className="p-2 bg-white rounded-xl shadow-sm border border-slate-200">
                        <Phone className="w-4 h-4 text-slate-900" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
          {activeTab === 'coverage' && (
            <motion.div key="coverage" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <div className="flex flex-col gap-4">
                {/* List of areas */}
                <div className="w-full">
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="font-black text-lg">Bairros Atendidos</h3>
                      <button 
                        onClick={() => setIsAddingCoverage(true)}
                        className="bg-yellow-400 p-2 rounded-xl text-slate-900 hover:bg-yellow-500 transition-colors"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {coverageAreas.map(area => (
                        <div key={area.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 relative">
                          <button 
                            onClick={() => setAreaToDelete(area.id)}
                            className="absolute top-2 right-2 bg-red-50 text-red-500 p-2 rounded-xl hover:bg-red-100 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <p className="font-bold text-slate-900">{area.neighborhood}</p>
                          <p className="text-[10px] text-slate-500">{area.city}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Map Visualization */}
                <div className="w-full">
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 h-full min-h-[500px] flex flex-col">
                    <h3 className="font-black text-lg mb-6 flex items-center gap-2">
                      <MapIcon className="text-yellow-500 w-5 h-5" /> Visualização Geográfica
                    </h3>
                    <div className="relative bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 z-0 isolate" style={{ height: '450px' }}>
                      <MapContainer center={[-22.825, -43.055]} zoom={13} style={{ height: '450px', width: '100%' }}>
                        <TileLayer
                          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        />
                        {coverageAreas.map(area => (
                          <React.Fragment key={area.id}>
                            {area.boundary ? (
                              <GeoJSON 
                                key={`boundary-${area.id}-${area.neighborhood}`}
                                data={area.boundary}
                                style={{
                                  fillColor: '#facc15',
                                  weight: 2,
                                  opacity: 1,
                                  color: '#eab308',
                                  fillOpacity: 0.3
                                }}
                              />
                            ) : area.center && (
                              <Marker position={[area.center.lat, area.center.lng]}>
                                <Popup>
                                  <div className="font-bold">{area.neighborhood}</div>
                                  <div className="text-xs">{area.city}</div>
                                </Popup>
                              </Marker>
                            )}
                          </React.Fragment>
                        ))}
                      </MapContainer>
                      <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-slate-200 z-[1000] max-w-[200px]">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Nota de Cobertura</p>
                        <p className="text-[9px] text-slate-600 leading-tight">
                          Os círculos são <strong>ilustrativos</strong>. A validação real é feita pelo <strong>nome oficial do bairro</strong> retornado pelo CEP do cliente.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'benefits' && (
            <motion.div key="benefits" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <div className="flex flex-wrap gap-2 mb-2">
                <button 
                  onClick={() => setBenefitSubTab('settings')}
                  className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 ${benefitSubTab === 'settings' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 hover:text-slate-800 border border-slate-100'}`}
                >
                  <Gift className="w-3.5 h-3.5 text-yellow-400" /> REGRAS & VALORES
                </button>
                <button 
                  onClick={() => setBenefitSubTab('rewards')}
                  className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 ${benefitSubTab === 'rewards' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 hover:text-slate-800 border border-slate-100'}`}
                >
                  <Star className="w-3.5 h-3.5 text-yellow-400" /> RECOMPENSAS ({rewards.length})
                </button>
                <button 
                  onClick={() => setBenefitSubTab('coupons')}
                  className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 ${benefitSubTab === 'coupons' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 hover:text-slate-800 border border-slate-100'}`}
                >
                  <Ticket className="w-3.5 h-3.5 text-yellow-400" /> CUPONS ({coupons.length})
                </button>
                <button 
                  onClick={() => setBenefitSubTab('referrals')}
                  className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 ${benefitSubTab === 'referrals' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 hover:text-slate-800 border border-slate-100'}`}
                >
                  <Users className="w-3.5 h-3.5 text-yellow-400" /> INDICAÇÕES ({referrals.length})
                </button>
              </div>

              {/* SUBTAB 1: REGRAS & VALORES CONFIGURÁVEIS */}
              {benefitSubTab === 'settings' && (
                <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100 max-w-4xl">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-6 border-b border-slate-100">
                    <div>
                      <h3 className="font-black text-xl text-slate-900 flex items-center gap-2">
                        <Gift className="text-yellow-500 w-6 h-6" /> Parâmetros do Programa de Benefícios
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Ajuste os valores de desconto de indicação, bônus para quem indicou e multiplicador de pontos em tempo real.
                      </p>
                    </div>
                    {configSavedToast && (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-black px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm animate-pulse">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Salvo com sucesso!
                      </span>
                    )}
                  </div>

                  <form onSubmit={(e) => {
                    e.preventDefault();
                    onUpdateBenefitsConfig(configForm);
                    setConfigSavedToast(true);
                    setTimeout(() => setConfigSavedToast(false), 3000);
                  }} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      
                      {/* Campo 1: Desconto do Amigo Indicado */}
                      <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black text-slate-900 uppercase tracking-wide">
                            Desconto do Amigo Indicado (1º Pedido)
                          </label>
                          <span className="bg-yellow-100 text-yellow-800 text-[10px] font-black px-2 py-0.5 rounded">R$ DESCONTO</span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Valor em Reais concedido como cupom de boas-vindas no 1º pedido do amigo que usou o link ou código.
                        </p>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">R$</span>
                          <input 
                            type="number"
                            min="0"
                            step="0.5"
                            value={configForm.referralDiscountValue}
                            onChange={(e) => setConfigForm({ ...configForm, referralDiscountValue: parseFloat(e.target.value) || 0 })}
                            className="w-full pl-11 pr-4 py-3.5 bg-white rounded-xl border border-slate-200 font-black text-slate-900 text-base focus:ring-2 focus:ring-yellow-400 outline-none"
                            required
                          />
                        </div>
                      </div>

                      {/* Campo 2: Bônus de Pontos para o Indicador */}
                      <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black text-slate-900 uppercase tracking-wide">
                            Bônus para o Indicador (por Compra)
                          </label>
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded">PONTOS</span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Quantidade de pontos concedida ao indicador assim que a 1ª compra do amigo for concluída.
                        </p>
                        <div className="relative">
                          <input 
                            type="number"
                            min="0"
                            step="5"
                            value={configForm.referralPointsAwarded}
                            onChange={(e) => setConfigForm({ ...configForm, referralPointsAwarded: parseInt(e.target.value) || 0 })}
                            className="w-full px-4 py-3.5 bg-white rounded-xl border border-slate-200 font-black text-slate-900 text-base focus:ring-2 focus:ring-yellow-400 outline-none"
                            required
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">pontos</span>
                        </div>
                      </div>

                      {/* Campo 3: Pontos por Real Gasto */}
                      <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black text-slate-900 uppercase tracking-wide">
                            Fidelidade: Pontos por R$ 1,00 gasto
                          </label>
                          <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-0.5 rounded">MULTIPLICADOR</span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Multiplicador de pontos para compras normais concluídas (ex: 10 pts = R$ 100 geram 1.000 pts).
                        </p>
                        <div className="relative">
                          <input 
                            type="number"
                            min="1"
                            step="1"
                            value={configForm.pointsPerCurrency}
                            onChange={(e) => setConfigForm({ ...configForm, pointsPerCurrency: parseFloat(e.target.value) || 1 })}
                            className="w-full px-4 py-3.5 bg-white rounded-xl border border-slate-200 font-black text-slate-900 text-base focus:ring-2 focus:ring-yellow-400 outline-none"
                            required
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">pts / R$ 1,00</span>
                        </div>
                      </div>

                      {/* Campo 4: Pedido Mínimo para Indicação */}
                      <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black text-slate-900 uppercase tracking-wide">
                            Pedido Mínimo para Cupom de Indicação
                          </label>
                          <span className="bg-purple-100 text-purple-800 text-[10px] font-black px-2 py-0.5 rounded">CONDICIONAL</span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Valor mínimo de compra para que o desconto de indicação possa ser aplicado (0 = sem mínimo).
                        </p>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">R$</span>
                          <input 
                            type="number"
                            min="0"
                            step="5"
                            value={configForm.referralMinOrderValue || 0}
                            onChange={(e) => setConfigForm({ ...configForm, referralMinOrderValue: parseFloat(e.target.value) || 0 })}
                            className="w-full pl-11 pr-4 py-3.5 bg-white rounded-xl border border-slate-200 font-black text-slate-900 text-base focus:ring-2 focus:ring-yellow-400 outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                      <button
                        type="submit"
                        className="bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black text-sm px-8 py-4 rounded-2xl shadow-lg shadow-yellow-400/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                      >
                        <CheckCircle2 className="w-5 h-5 stroke-[2.5]" /> SALVAR CONFIGURAÇÕES DE BENEFÍCIOS
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* SUBTAB 2: GESTÃO DE RECOMPENSAS DO CATÁLOGO */}
              {benefitSubTab === 'rewards' && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                      <div>
                        <h3 className="font-black text-lg flex items-center gap-2">
                          <Star className="text-yellow-500 w-5 h-5" /> Catálogo de Troca de Pontos
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">Gerencie os itens, descontos e brindes disponíveis para resgate pelos clientes.</p>
                      </div>
                      <button 
                        onClick={() => {
                          setEditingRewardId(null);
                          setRewardForm({
                            title: '',
                            description: '',
                            pointsCost: 200,
                            type: 'discount',
                            value: 10,
                            validityDays: 30,
                            minOrderValue: 0,
                            rulesText: 'Válido para 1 pedido\nNão cumulativo com outras promoções',
                            isActive: true
                          });
                          setIsRewardModalOpen(true);
                        }}
                        className="bg-yellow-400 hover:bg-yellow-500 text-slate-950 px-4 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 shadow-md transition-all active:scale-95"
                      >
                        <Plus className="w-4 h-4 stroke-[3]" /> NOVA RECOMPENSA
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {rewards.map(reward => (
                        <div key={reward.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between relative overflow-hidden group hover:border-yellow-300 transition-all">
                          <div className={`absolute top-0 right-0 w-2.5 h-full ${reward.isActive !== false ? 'bg-emerald-400' : 'bg-slate-300'}`}></div>
                          <div>
                            <div className="flex justify-between items-start mb-2 pr-3">
                              <span className="bg-yellow-100 text-yellow-800 text-xs font-black px-2.5 py-1 rounded-full">
                                {reward.pointsCost} PTS
                              </span>
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded ${reward.isActive !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                                {reward.isActive !== false ? 'ATIVO' : 'INATIVO'}
                              </span>
                            </div>
                            <h4 className="font-black text-slate-900 text-base mb-1">{reward.title}</h4>
                            <p className="text-xs text-slate-500 mb-3">{reward.description}</p>
                            
                            <div className="space-y-1 text-[11px] text-slate-600 font-medium bg-white p-3 rounded-xl border border-slate-100 mb-3">
                              <p><strong>Tipo:</strong> {reward.type === 'discount' ? 'Desconto em R$' : reward.type === 'free_item' ? 'Brinde / Produto Grátis' : 'Cashback'}</p>
                              {reward.value && <p><strong>Benefício:</strong> R$ {reward.value.toFixed(2)}</p>}
                              {reward.validityDays && <p><strong>Validade:</strong> {reward.validityDays} dias após resgate</p>}
                              {reward.minOrderValue ? <p><strong>Uso Mínimo:</strong> R$ {reward.minOrderValue.toFixed(2)}</p> : <p><strong>Uso Mínimo:</strong> Sem valor mínimo</p>}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60">
                            <button
                              onClick={() => {
                                onUpdateRewards(rewards.map(r => r.id === reward.id ? { ...r, isActive: !r.isActive } : r));
                              }}
                              className={`flex-1 py-2 rounded-xl text-xs font-black transition-colors ${
                                reward.isActive !== false ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-emerald-500 text-white hover:bg-emerald-600'
                              }`}
                            >
                              {reward.isActive !== false ? 'DESATIVAR' : 'ATIVAR'}
                            </button>
                            <button
                              onClick={() => {
                                setEditingRewardId(reward.id);
                                setRewardForm({
                                  title: reward.title,
                                  description: reward.description,
                                  pointsCost: reward.pointsCost,
                                  type: reward.type || 'discount',
                                  value: reward.value || 0,
                                  validityDays: reward.validityDays || 30,
                                  minOrderValue: reward.minOrderValue || 0,
                                  rulesText: (reward.rules || []).join('\n'),
                                  isActive: reward.isActive !== false
                                });
                                setIsRewardModalOpen(true);
                              }}
                              className="p-2 bg-white text-slate-700 hover:text-slate-900 border border-slate-200 rounded-xl"
                              title="Editar Recompensa"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Deseja realmente excluir a recompensa "${reward.title}"?`)) {
                                  onUpdateRewards(rewards.filter(r => r.id !== reward.id));
                                }
                              }}
                              className="p-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-xl"
                              title="Excluir Recompensa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {rewards.length === 0 && (
                        <div className="col-span-full py-12 text-center">
                          <Star className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                          <p className="text-slate-400 font-bold">Nenhuma recompensa cadastrada no catálogo</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* SUBTAB 3: CUPONS DE DESCONTO */}
              {benefitSubTab === 'coupons' && (
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="font-black text-lg flex items-center gap-2">
                        <Ticket className="text-yellow-500 w-5 h-5" /> Cupons Promocionais da Loja
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">Crie e gerencie cupons de desconto ativos para uso no checkout.</p>
                    </div>
                    <button 
                      onClick={() => setIsAddingCoupon(true)}
                      className="bg-yellow-400 hover:bg-yellow-500 p-2.5 rounded-xl text-slate-900 transition-colors flex items-center gap-1.5 font-black text-xs shadow-md"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" /> NOVO CUPOM
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {coupons.map(coupon => (
                      <div key={coupon.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 relative overflow-hidden flex flex-col justify-between">
                        <div className={`absolute top-0 right-0 w-2 h-full ${coupon.isActive ? 'bg-green-400' : 'bg-slate-300'}`}></div>
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-lg tracking-tighter text-slate-900">{coupon.code}</span>
                              {coupon.isOneTimePerUser && (
                                <span className="bg-blue-100 text-blue-700 text-[8px] font-black px-1.5 py-0.5 rounded">ÚNICO</span>
                              )}
                            </div>
                            <button 
                              onClick={() => onUpdateCoupons(coupons.filter(c => c.id !== coupon.id))}
                              className="text-red-400 hover:text-red-600 p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-slate-600">
                              {coupon.type === 'fixed' ? `R$ ${coupon.value.toFixed(2)}` : `${coupon.value}%`} de desconto
                            </p>
                            <p className="text-[10px] text-slate-400">Validade: {new Date(coupon.validUntil).toLocaleDateString()}</p>
                            <p className="text-[10px] text-slate-400">Uso: {coupon.usageCount} {coupon.usageLimit ? `/ ${coupon.usageLimit}` : ''}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => onUpdateCoupons(coupons.map(c => c.id === coupon.id ? { ...c, isActive: !c.isActive } : c))}
                          className={`mt-3 w-full py-2 rounded-xl text-[10px] font-black transition-all ${coupon.isActive ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'}`}
                        >
                          {coupon.isActive ? 'DESATIVAR' : 'ATIVAR'}
                        </button>
                      </div>
                    ))}
                    {coupons.length === 0 && (
                      <div className="col-span-full py-12 text-center">
                        <Ticket className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                        <p className="text-slate-400 font-bold">Nenhum cupom cadastrado</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SUBTAB 4: GESTÃO DE INDICAÇÕES */}
              {benefitSubTab === 'referrals' && (
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="font-black text-lg flex items-center gap-2">
                        <Users className="text-yellow-500 w-5 h-5" /> Gestão de Indicações
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">Histórico completo de convites enviados e convertidos em compras.</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                          <th className="pb-4 px-4">Quem Indicou</th>
                          <th className="pb-4 px-4">Indicado</th>
                          <th className="pb-4 px-4">Data</th>
                          <th className="pb-4 px-4">Status</th>
                          <th className="pb-4 px-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {referrals.map(ref => (
                          <tr key={ref.id} className="group hover:bg-slate-50 transition-colors">
                            <td className="py-4 px-4">
                              <p className="font-bold text-slate-900">{ref.referrerName}</p>
                              <p className="text-[10px] text-slate-400">ID: {ref.referrerId}</p>
                            </td>
                            <td className="py-4 px-4">
                              <p className="font-bold text-slate-900">{ref.refereeName}</p>
                              <p className="text-[10px] text-slate-500">{ref.refereePhone}</p>
                              {ref.orderId && <p className="text-[9px] text-blue-500 font-bold">Pedido: #{ref.orderId}</p>}
                            </td>
                            <td className="py-4 px-4">
                              <p className="text-xs text-slate-500">{new Date(ref.createdAt).toLocaleDateString()}</p>
                            </td>
                            <td className="py-4 px-4">
                              <span className={`text-[10px] font-black px-2 py-1 rounded-full ${
                                (ref.status === 'Validado' || (ref.status as string) === 'Confirmado') ? 'bg-green-100 text-green-700' : 
                                ref.status === 'Rejeitado' ? 'bg-red-100 text-red-700' : 
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {(ref.status === 'Validado' || (ref.status as string) === 'Confirmado') ? 'CONFIRMADO' : ref.status.toUpperCase()}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right">
                              {ref.status === 'Pendente' && (
                                <div className="flex justify-end gap-2">
                                  <button 
                                    onClick={() => {
                                      const updatedReferrals = referrals.map(r => r.id === ref.id ? { ...r, status: 'Confirmado' as const, validatedAt: new Date().toISOString() } : r);
                                      onUpdateReferrals(updatedReferrals);
                                      
                                      // Grant points to referrer
                                      const referrer = allCustomers.find(c => c.id === ref.referrerId);
                                      if (referrer) {
                                        onUpdateUser({ ...referrer, points: (referrer.points || 0) + ref.pointsAwarded });
                                      }
                                      alert(`Indicação de ${ref.refereeName} confirmada! ${ref.pointsAwarded} pontos creditados para ${ref.referrerName}.`);
                                    }}
                                    className="bg-green-500 text-white p-2 rounded-lg hover:bg-green-600 transition-colors cursor-pointer"
                                    title="Validar Indicação"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => {
                                      const updatedReferrals = referrals.map(r => r.id === ref.id ? { ...r, status: 'Rejeitado' as const } : r);
                                      onUpdateReferrals(updatedReferrals);
                                    }}
                                    className="bg-red-500 text-white p-2 rounded-lg hover:bg-red-600 transition-colors cursor-pointer"
                                    title="Rejeitar Indicação"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                        {referrals.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-12 text-center">
                              <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                              <p className="text-slate-400 font-bold">Nenhuma indicação registrada</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'predictions' && (
            <motion.div key="predictions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-black text-lg flex items-center gap-2">
                    <Calendar className="text-yellow-500 w-5 h-5" /> Previsão de Recompra
                  </h3>
                  <p className="text-xs text-slate-400 font-bold">Baseado na média de intervalo entre pedidos concluídos</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                        <th className="pb-4 px-4">Cliente</th>
                        <th className="pb-4 px-4">Endereço</th>
                        <th className="pb-4 px-4 text-center">Pedidos</th>
                        <th className="pb-4 px-4 text-center">Total Qtd</th>
                        <th className="pb-4 px-4">Próxima Compra (Prev.)</th>
                        <th className="pb-4 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {customerPredictions.map(pred => (
                        <tr key={pred.customer.id} className="group hover:bg-slate-50 transition-colors">
                          <td className="py-4 px-4 cursor-pointer" onClick={() => setViewingCustomerHistory(pred)}>
                            <p className="font-bold text-slate-900 group-hover:text-yellow-600 transition-colors">{pred.customer.name}</p>
                            <p className="text-[10px] text-slate-400">{pred.customer.phone}</p>
                          </td>
                          <td className="py-4 px-4">
                            <p className="text-xs text-slate-600 truncate max-w-[200px]">
                              {pred.customer.addresses?.[0]?.street}, {pred.customer.addresses?.[0]?.number}
                            </p>
                            <p className="text-[10px] text-slate-400">{pred.customer.addresses?.[0]?.neighborhood}</p>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="font-bold text-slate-900">{pred.totalOrders}</span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="font-bold text-slate-900">{pred.totalQuantity}</span>
                          </td>
                          <td className="py-4 px-4">
                            {pred.nextPrediction ? (
                              <div>
                                <p className={`font-black text-xs ${new Date(pred.nextPrediction) < new Date() ? 'text-red-500' : 'text-slate-900'}`}>
                                  {new Date(pred.nextPrediction).toLocaleDateString()}
                                </p>
                                <p className="text-[9px] text-slate-400 uppercase font-bold">Média: {Math.round(pred.avgInterval)} dias</p>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-300 font-bold italic">Histórico insuficiente</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => handleSendMessage(pred, 'reminder')}
                                className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                                title="Enviar WhatsApp"
                              >
                                <MessageSquare className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => {
                                  setSelectedPrediction(pred);
                                  setIsCouponModalOpen(true);
                                }}
                                className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                title="Enviar Cupom"
                              >
                                <Ticket className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {customerPredictions.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-12 text-center">
                            <Calendar className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                            <p className="text-slate-400 font-bold">Nenhum dado de previsão disponível ainda.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'collaborators' && (
            <motion.div key="collaborators" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-black text-lg flex items-center gap-2">
                    <Users className="text-yellow-500 w-5 h-5" /> Gestão de Colaboradores
                  </h3>
                  <button 
                    onClick={() => setIsAddingCollaborator(true)}
                    className="bg-yellow-400 p-2 rounded-xl text-slate-900 hover:bg-yellow-500 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                        <th className="pb-4 px-4">Nome</th>
                        <th className="pb-4 px-4">E-mail</th>
                        <th className="pb-4 px-4">Função</th>
                        <th className="pb-4 px-4">Permissões (Abas)</th>
                        <th className="pb-4 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {allCollaborators.map(collab => (
                        <tr key={collab.id} className="group hover:bg-slate-50 transition-colors">
                          <td className="py-4 px-4">
                            <p className="font-bold text-slate-900">{collab.name}</p>
                          </td>
                          <td className="py-4 px-4">
                            <p className="text-xs text-slate-500">{collab.email}</p>
                          </td>
                          <td className="py-4 px-4">
                            <span className={`text-[10px] font-black px-2 py-1 rounded-full ${
                              collab.role === 'gestor' ? 'bg-purple-100 text-purple-700' : 
                              collab.role === 'admin' ? 'bg-blue-100 text-blue-700' : 
                              'bg-yellow-100 text-yellow-700'
                            }`}>
                              {collab.role.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex flex-wrap gap-1">
                              {collab.role === 'gestor' ? (
                                <span className="text-[9px] font-bold text-slate-400 italic">Acesso Total</span>
                              ) : (
                                collab.allowedTabs?.map(tabId => (
                                  <span key={tabId} className="text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded uppercase">
                                    {ALL_TABS.find(t => t.id === tabId)?.label || tabId}
                                  </span>
                                ))
                              )}
                              {!collab.allowedTabs?.length && collab.role !== 'gestor' && (
                                <span className="text-[9px] font-bold text-red-300 italic">Nenhum acesso</span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <button className="text-slate-300 hover:text-slate-600 p-1">
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'meu_negocio' && (
            <motion.div key="meu_negocio" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <BusinessSettingsTab 
                businessInfo={businessInfo}
                onSave={onUpdateBusinessInfo || (() => {})}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>

      {/* Floating Action Button */}
      <button 
        onClick={() => setIsAddingOrder(true)}
        className="fixed bottom-8 right-8 bg-slate-900 text-white w-16 h-16 rounded-full shadow-2xl flex items-center justify-center z-40 hover:scale-110 active:scale-95 transition-all"
      >
        <Plus className="w-8 h-8 text-yellow-400" />
      </button>

      {/* New Order Modal */}
      <AnimatePresence>
        {isAddingOrder && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-black text-xl">Novo Pedido (Manual)</h3>
                <button onClick={() => setIsAddingOrder(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-6 h-6 text-slate-400" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {!selectedCustomer ? (
                  <div className="space-y-6">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                      <input 
                        type="text" 
                        placeholder="Buscar cliente por nome ou endereço..."
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {filteredCustomers.map(c => (
                        <button key={c.id} onClick={() => setSelectedCustomer(c)} className="p-4 bg-white rounded-2xl text-left border border-slate-100 hover:border-yellow-400 hover:shadow-md transition-all group">
                          <p className="font-bold text-slate-900 group-hover:text-yellow-600">{c.name}</p>
                          <p className="text-xs text-slate-500">{c.addresses?.[0]?.street}, {c.addresses?.[0]?.number}</p>
                          <p className="text-[10px] text-slate-400 mt-1">{c.phone}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div className="bg-slate-50 p-4 rounded-2xl flex justify-between items-center border border-slate-100">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase">Cliente Selecionado</p>
                        <p className="font-bold text-slate-900">{selectedCustomer.name}</p>
                        <p className="text-xs text-slate-500">{selectedCustomer.addresses?.[0]?.street}, {selectedCustomer.addresses?.[0]?.number}</p>
                      </div>
                      <button onClick={() => setSelectedCustomer(null)} className="text-xs font-black text-yellow-600 bg-yellow-50 px-3 py-2 rounded-xl hover:bg-yellow-100 transition-colors">TROCAR</button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {PRODUCTS.map(p => (
                        <div key={p.id} className="bg-white p-4 rounded-2xl flex items-center gap-4 border border-slate-100 shadow-sm">
                          <img src={p.image} className="w-14 h-14 rounded-xl object-cover" referrerPolicy="no-referrer" />
                          <div className="flex-1">
                            <p className="font-bold text-sm text-slate-900">{p.name}</p>
                            <p className="font-black text-yellow-600 text-lg">R$ {p.price.toFixed(2)}</p>
                          </div>
                          <div className="flex items-center gap-3 bg-slate-50 p-1 rounded-xl">
                            <button onClick={() => setCart(prev => ({...prev, [p.id]: Math.max(0, (prev[p.id] || 0) - 1)}))} className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center hover:bg-slate-100"><Minus className="w-4 h-4" /></button>
                            <span className="font-black text-slate-900 w-4 text-center">{cart[p.id] || 0}</span>
                            <button onClick={() => setCart(prev => ({...prev, [p.id]: (prev[p.id] || 0) + 1}))} className="w-8 h-8 rounded-lg bg-yellow-400 text-slate-900 shadow-sm flex items-center justify-center hover:bg-yellow-500"><Plus className="w-4 h-4" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {selectedCustomer && (
                <div className="p-6 bg-slate-50 border-t border-slate-100">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">Total do Pedido</p>
                      <p className="text-3xl font-black text-slate-900">R$ {cartTotal.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-400 uppercase">Itens</p>
                      <p className="text-lg font-black text-slate-900">{Object.values(cart).reduce((a: number, b: number) => a + b, 0)} un</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleNewOrder}
                    disabled={cartTotal === 0}
                    className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 transition-all shadow-xl flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-6 h-6 text-yellow-400" /> FINALIZAR PEDIDO MANUAL
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isAddingCoupon && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-xl">Novo Cupom</h3>
                <button onClick={() => setIsAddingCoupon(false)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-6 h-6 text-slate-400" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Código do Cupom</label>
                  <input 
                    type="text" 
                    placeholder="Ex: GAS10"
                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none transition-all font-black uppercase"
                    value={newCoupon.code}
                    onChange={(e) => setNewCoupon(prev => ({ ...prev, code: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Tipo</label>
                    <select 
                      className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none transition-all"
                      value={newCoupon.type}
                      onChange={(e) => setNewCoupon(prev => ({ ...prev, type: e.target.value as 'fixed' | 'percentage' }))}
                    >
                      <option value="fixed">Fixo (R$)</option>
                      <option value="percentage">Porcentagem (%)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Valor</label>
                    <input 
                      type="number" 
                      className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none transition-all"
                      value={newCoupon.value}
                      onChange={(e) => setNewCoupon(prev => ({ ...prev, value: Number(e.target.value) }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Data de Validade</label>
                  <input 
                    type="date" 
                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none transition-all"
                    value={newCoupon.validUntil}
                    onChange={(e) => setNewCoupon(prev => ({ ...prev, validUntil: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Limite de Uso (Opcional)</label>
                  <input 
                    type="number" 
                    placeholder="Sem limite se vazio"
                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none transition-all"
                    value={newCoupon.usageLimit || ''}
                    onChange={(e) => setNewCoupon(prev => ({ ...prev, usageLimit: e.target.value ? Number(e.target.value) : undefined }))}
                  />
                </div>
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <input 
                    type="checkbox" 
                    id="oneTime"
                    className="w-5 h-5 accent-yellow-400"
                    checked={newCoupon.isOneTimePerUser}
                    onChange={(e) => setNewCoupon(prev => ({ ...prev, isOneTimePerUser: e.target.checked }))}
                  />
                  <label htmlFor="oneTime" className="text-sm font-bold text-slate-700 cursor-pointer">Uso único por cliente</label>
                </div>
                <button 
                  onClick={handleAddCoupon}
                  className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-slate-800 transition-all"
                >
                  CRIAR CUPOM
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isRewardModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6 sm:p-7 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-black text-xl text-slate-900 flex items-center gap-2">
                    <Star className="text-yellow-500 w-5 h-5" />
                    {editingRewardId ? 'Editar Recompensa' : 'Nova Recompensa'}
                  </h3>
                  <p className="text-xs text-slate-400">Configure os parâmetros do resgate no catálogo de pontos.</p>
                </div>
                <button 
                  onClick={() => setIsRewardModalOpen(false)} 
                  className="p-2 hover:bg-slate-100 rounded-full cursor-pointer text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveReward} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Título da Recompensa</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Desconto de R$ 15,00 no Botijão"
                    className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none transition-all font-bold text-sm"
                    value={rewardForm.title}
                    onChange={(e) => setRewardForm({ ...rewardForm, title: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Descrição</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Economize R$ 15,00 no seu próximo pedido de gás"
                    className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none transition-all text-sm"
                    value={rewardForm.description}
                    onChange={(e) => setRewardForm({ ...rewardForm, description: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Custo em Pontos</label>
                    <input 
                      type="number" 
                      min="10"
                      step="10"
                      className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none transition-all font-black text-sm"
                      value={rewardForm.pointsCost}
                      onChange={(e) => setRewardForm({ ...rewardForm, pointsCost: parseInt(e.target.value) || 0 })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Tipo de Resgate</label>
                    <select 
                      className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none transition-all text-sm font-bold"
                      value={rewardForm.type}
                      onChange={(e) => setRewardForm({ ...rewardForm, type: e.target.value as any })}
                    >
                      <option value="discount">Desconto em R$</option>
                      <option value="free_item">Brinde / Produto Grátis</option>
                      <option value="cashback">Cashback</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Valor do Benefício (R$)</label>
                    <input 
                      type="number" 
                      min="0"
                      step="0.5"
                      placeholder="Ex: 15.00"
                      className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none transition-all font-bold text-sm"
                      value={rewardForm.value}
                      onChange={(e) => setRewardForm({ ...rewardForm, value: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Validade (dias)</label>
                    <input 
                      type="number" 
                      min="1"
                      placeholder="Ex: 30"
                      className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none transition-all font-bold text-sm"
                      value={rewardForm.validityDays}
                      onChange={(e) => setRewardForm({ ...rewardForm, validityDays: parseInt(e.target.value) || 30 })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Pedido Mínimo para Uso (R$)</label>
                  <input 
                    type="number" 
                    min="0"
                    step="5"
                    placeholder="0 para sem valor mínimo"
                    className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none transition-all font-bold text-sm"
                    value={rewardForm.minOrderValue}
                    onChange={(e) => setRewardForm({ ...rewardForm, minOrderValue: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Regras e Condições (uma por linha)</label>
                  <textarea 
                    rows={3}
                    className="w-full p-3 bg-slate-50 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none transition-all text-xs font-medium resize-none"
                    value={rewardForm.rulesText}
                    onChange={(e) => setRewardForm({ ...rewardForm, rulesText: e.target.value })}
                  />
                </div>

                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <input 
                    type="checkbox" 
                    id="rewardActive"
                    className="w-5 h-5 accent-yellow-400 cursor-pointer"
                    checked={rewardForm.isActive}
                    onChange={(e) => setRewardForm({ ...rewardForm, isActive: e.target.checked })}
                  />
                  <label htmlFor="rewardActive" className="text-xs font-bold text-slate-700 cursor-pointer">
                    Recompensa ativa e visível para troca no aplicativo dos clientes
                  </label>
                </div>

                <div className="pt-2">
                  <button 
                    type="submit"
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
                  >
                    <CheckCircle2 className="w-5 h-5 text-yellow-400" />
                    {editingRewardId ? 'SALVAR ALTERAÇÕES' : 'CADASTRAR RECOMPENSA'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isAddingCoverage && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-xl">Adicionar Bairro</h3>
                <button onClick={() => setIsAddingCoverage(false)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-6 h-6 text-slate-400" /></button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Estado (UF)</label>
                    <select 
                      className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none transition-all"
                      value={newArea.uf}
                      onChange={(e) => setNewArea(prev => ({ ...prev, uf: e.target.value, city: '' }))}
                    >
                      <option value="">Selecione</option>
                      {ufs.map(u => <option key={u.sigla} value={u.sigla}>{u.sigla}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Cidade</label>
                    <select 
                      className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none transition-all disabled:opacity-50"
                      value={newArea.city}
                      onChange={(e) => setNewArea(prev => ({ ...prev, city: e.target.value }))}
                      disabled={!newArea.uf || cities.length === 0}
                    >
                      <option value="">Selecione Município</option>
                      {cities.map(c => <option key={c.nome} value={c.nome}>{c.nome}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Nome do Bairro</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Jardim Paulista"
                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none transition-all"
                    value={newArea.neighborhood}
                    onChange={(e) => setNewArea(prev => ({ ...prev, neighborhood: e.target.value }))}
                  />
                  <p className="text-[10px] text-slate-400 mt-2 ml-1 leading-tight">
                    * Bairros em grandes cidades não possuem um CEP único. Se desejar usar um CEP de referência, adicione-o na descrição ou gerencie os endereços individualmente (cada rua tem o seu CEP em grandes capitais).
                  </p>
                </div>
                <button 
                  onClick={handleAddCoverage}
                  disabled={!newArea.neighborhood || !newArea.city || isGeocoding}
                  className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-slate-800 transition-all disabled:opacity-50"
                >
                  {isGeocoding ? 'OBTENDO COORDENADAS...' : 'SALVAR ÁREA DE COBERTURA'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {selectedOrderDetails && (() => {
          const o = selectedOrderDetails;
          const elapsed = getElapsedMinutes(o.createdAt);
          const customerOtherOrders = orders.filter(ord => 
            (ord.customerId === o.customerId || (o.phone && ord.phone === o.phone)) && 
            ord.id !== o.id
          ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          const totalOrdersCount = customerOtherOrders.length + 1;
          const assignedDriver = deliveryPersons.find(dp => dp.id === o.deliveryPersonId);

          return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[9990] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 15 }} 
                animate={{ scale: 1, opacity: 1, y: 0 }} 
                exit={{ scale: 0.95, opacity: 0, y: 15 }} 
                className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden my-auto border border-slate-100 flex flex-col max-h-[92vh]"
              >
                {/* Topo do Modal */}
                <div className="bg-slate-900 text-white p-5 sm:p-6 relative shrink-0">
                  <div className="flex items-start justify-between pr-8">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-black bg-yellow-400 text-slate-900 px-2.5 py-0.5 rounded-lg uppercase tracking-wider">
                          #{o.id}
                        </span>
                        <span className={`text-xs font-black px-2.5 py-0.5 rounded-lg uppercase ${
                          o.status === 'Concluído' ? 'bg-green-500/20 text-green-300 border border-green-500/40' :
                          o.status === 'Cancelado' ? 'bg-red-500/20 text-red-300 border border-red-500/40' :
                          o.status === 'Em Rota' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' :
                          o.status === 'Atribuído' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40' :
                          'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}>
                          {o.status}
                        </span>
                      </div>
                      <h2 className="text-xl sm:text-2xl font-black mt-2 text-white">{o.customerName}</h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Realizado em {new Date(o.createdAt).toLocaleDateString('pt-BR')} às {new Date(o.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>

                      {o.isScheduled && (
                        <div className="mt-2.5 bg-purple-500/30 border border-purple-400/50 rounded-xl px-3 py-1.5 flex items-center gap-2 text-purple-200 text-xs font-bold">
                          <Calendar className="w-4 h-4 text-purple-300 flex-shrink-0" />
                          <span>Pedido Agendado: {o.scheduledDate || 'Amanhã'} ({o.scheduledPeriod === 'manha' ? 'Manhã 08h-13h' : 'Tarde 13h-19h'})</span>
                        </div>
                      )}
                    </div>

                    {/* Relógio em Destaque */}
                    <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-2.5 sm:p-3 text-right shrink-0">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Tempo Decorrido</span>
                      <div className="flex items-center gap-1.5 text-yellow-400 font-black text-base sm:text-lg mt-0.5">
                        <Clock className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
                        <span>{elapsed} min</span>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => setSelectedOrderDetails(null)} 
                    className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Conteúdo Rolável */}
                <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
                  
                  {/* Banner de Cancelamento */}
                  {o.status === 'Cancelado' && (
                    <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 text-red-900 space-y-1.5 shadow-sm">
                      <div className="flex items-center gap-2 font-black text-sm text-red-700">
                        <AlertCircle className="w-5 h-5 text-red-600 shrink-0" /> PEDIDO CANCELADO
                      </div>
                      <div className="text-xs text-red-800">
                        <strong className="font-bold text-red-900">Motivo do Cancelamento:</strong>{' '}
                        <span className="font-semibold">{o.cancellationReason || 'Motivo não informado no cancelamento.'}</span>
                      </div>
                      {o.cancelledAt && (
                        <div className="text-[10px] text-red-500 font-semibold">
                          Cancelado em: {new Date(o.cancelledAt).toLocaleString('pt-BR')}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Banner de Conclusão */}
                  {o.status === 'Concluído' && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 text-emerald-900 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-2 font-black text-xs text-emerald-700">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> PEDIDO ENTREGUE E CONCLUÍDO COM SUCESSO
                      </div>
                    </div>
                  )}

                  {/* Grid: Cliente & Endereço */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Bloco Cliente */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Perfil do Cliente</span>
                        {totalOrdersCount <= 1 ? (
                          <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                            🎉 1º Pedido (Cliente Novo)
                          </span>
                        ) : (
                          <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            ⭐ {totalOrdersCount}º Pedido ({totalOrdersCount >= 5 ? 'Cliente VIP' : 'Recorrente'})
                          </span>
                        )}
                      </div>

                      <div>
                        <div className="text-xs text-slate-500">Telefone / Contato:</div>
                        <div className="text-sm font-black text-slate-800 mt-0.5">{o.phone || 'Não informado'}</div>
                      </div>

                      {o.phone && (
                        <div className="flex gap-2 pt-1">
                          <a 
                            href={`tel:${o.phone.replace(/\D/g, '')}`} 
                            className="flex-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5 text-yellow-600" />
                            Ligar
                          </a>
                          <a 
                            href={`https://wa.me/55${o.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${o.customerName}, referente ao seu pedido #${o.id} na Gás Express...`)}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                            WhatsApp
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Bloco Endereço */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Endereço de Entrega</span>
                      <div className="text-sm font-bold text-slate-800">
                        {o.address.street}, {o.address.number} {o.address.complement ? `- ${o.address.complement}` : ''}
                      </div>
                      <div className="text-xs text-slate-500">
                        Bairro {o.address.neighborhood} • {o.address.city} - {o.address.state} {o.address.cep ? `• CEP ${o.address.cep}` : ''}
                      </div>
                      {o.address.reference && (
                        <div className="pt-2 border-t border-slate-200/60">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Ponto de Referência:</span>
                          <p className="text-xs font-semibold text-slate-700 italic mt-0.5">
                            "{o.address.reference}"
                          </p>
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Resumo Financeiro & Itens */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Itens do Pedido & Pagamento</span>

                    <div className="bg-white rounded-xl p-3.5 border border-slate-200/70 space-y-2 text-xs">
                      {o.items.map((it, idx) => {
                        const prod = PRODUCTS.find(p => p.id === it.productId);
                        return (
                          <div key={idx} className="flex justify-between items-center font-bold text-slate-800">
                            <span>{it.quantity}x {prod?.name || 'Produto'}</span>
                            <span>R$ {(it.priceAtTime * it.quantity).toFixed(2)}</span>
                          </div>
                        );
                      })}

                      {o.couponCode && (
                        <div className="flex justify-between items-center text-emerald-600 font-bold pt-1 border-t border-slate-100">
                          <span className="flex items-center gap-1">
                            <Ticket className="w-3.5 h-3.5" /> Cupom Aplicado: <strong>{o.couponCode}</strong>
                          </span>
                          <span>- R$ {(o.discount || 0).toFixed(2)}</span>
                        </div>
                      )}

                      {o.selectedFreebie && (
                        <div className="flex justify-between items-center text-amber-700 font-bold pt-1 border-t border-slate-100">
                          <span className="flex items-center gap-1">
                            <Gift className="w-3.5 h-3.5 text-yellow-600" /> Brinde Selecionado:
                          </span>
                          <span className="bg-yellow-100 px-2 py-0.5 rounded text-[10px]">{o.selectedFreebie}</span>
                        </div>
                      )}

                      <div className="pt-2.5 border-t border-slate-200 flex justify-between items-center text-sm font-black text-slate-900">
                        <span>Total do Pedido:</span>
                        <span className="text-base text-slate-900">R$ {o.total.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="bg-white p-3 rounded-xl border border-slate-200/70">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Forma de Pagamento</span>
                        <div className="text-sm font-black text-slate-800 mt-0.5">
                          {o.paymentMethod}
                        </div>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-200/70">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Observações / Troco</span>
                        <div className="text-xs font-bold text-slate-700 mt-0.5">
                          {o.paymentMethod.includes('Dinheiro') ? 'Conferir valor de troco caso necessário' : 'Pagamento direto sem necessidade de troco'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bloco: Entregador Responsável */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        Entregador Responsável
                      </span>
                      <span className={`text-xs font-bold ${o.deliveryPersonId ? 'text-blue-600' : 'text-amber-600'}`}>
                        {o.deliveryPersonId ? '🛵 Entregador Atribuído' : '⚠️ Aguardando Atribuição'}
                      </span>
                    </div>

                    {o.deliveryPersonId ? (
                      <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                            <User className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900">
                              {assignedDriver?.name || 'Entregador Desconhecido'}
                            </p>
                            <p className="text-xs text-slate-400 font-medium">
                              {assignedDriver?.phone || 'Sem telefone informado'}
                            </p>
                          </div>
                        </div>
                        {o.status !== 'Cancelado' && o.status !== 'Concluído' && (
                          <button
                            onClick={() => setAssigningOrder(o)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-3.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors border border-slate-200 shrink-0"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                            Trocar Entregador
                          </button>
                        )}
                      </div>
                    ) : o.status === 'Cancelado' ? (
                      <div className="bg-white p-3.5 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-400 font-bold">
                        Nenhum entregador foi atribuído a este pedido antes do cancelamento.
                      </div>
                    ) : o.status === 'Concluído' ? (
                      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 text-center text-xs text-slate-500 font-bold">
                        Pedido finalizado.
                      </div>
                    ) : (
                      <div className="bg-white p-4 rounded-2xl border border-dashed border-amber-300 text-center space-y-3">
                        <p className="text-xs font-bold text-slate-600">
                          Este pedido ainda não possui um motoboy responsável atribuído.
                        </p>
                        <button
                          onClick={() => setAssigningOrder(o)}
                          className="w-full bg-slate-900 hover:bg-yellow-500 hover:text-slate-950 text-white font-black py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-slate-900/10"
                        >
                          <Truck className="w-4 h-4" />
                          ATRIBUIR ENTREGADOR
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Bloco: Histórico de Compras do Cliente (Abaixo do Entregador) */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-slate-500" />
                        Histórico de Pedidos Anteriores ({customerOtherOrders.length})
                      </span>
                    </div>

                    {customerOtherOrders.length === 0 ? (
                      <div className="text-center py-4 bg-white rounded-xl border border-slate-100 text-xs text-slate-400 font-bold">
                        Este é o primeiro pedido deste cliente na plataforma.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white custom-scrollbar">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100/70 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                              <th className="py-2.5 px-3">Data</th>
                              <th className="py-2.5 px-3">Produto Adquirido</th>
                              <th className="py-2.5 px-3 text-center">Qtd</th>
                              <th className="py-2.5 px-3 text-right">Valor</th>
                              <th className="py-2.5 px-3 text-center">Pagamento</th>
                              <th className="py-2.5 px-3 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {customerOtherOrders.slice(0, 8).map(histOrder => {
                              const dateFormatted = new Date(histOrder.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
                              const totalItemsQty = histOrder.items.reduce((acc, it) => acc + it.quantity, 0);
                              const itemsDesc = histOrder.items.map(it => {
                                const prod = PRODUCTS.find(p => p.id === it.productId);
                                return `${it.quantity}x ${prod?.name || 'Item'}`;
                              }).join(', ');

                              return (
                                <tr key={histOrder.id} className="hover:bg-slate-50/80">
                                  <td className="py-2.5 px-3 font-semibold text-slate-600 whitespace-nowrap">
                                    {dateFormatted}
                                  </td>
                                  <td className="py-2.5 px-3 font-bold text-slate-800">
                                    <div className="max-w-[180px] truncate" title={itemsDesc}>
                                      {itemsDesc}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 font-black text-center text-slate-700">
                                    {totalItemsQty}
                                  </td>
                                  <td className="py-2.5 px-3 font-black text-right text-slate-900 whitespace-nowrap">
                                    R$ {histOrder.total.toFixed(2)}
                                  </td>
                                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                    <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                                      {histOrder.paymentMethod}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                                      histOrder.status === 'Concluído' ? 'bg-green-100 text-green-700' :
                                      histOrder.status === 'Cancelado' ? 'bg-red-100 text-red-700' :
                                      histOrder.status === 'Em Rota' ? 'bg-blue-100 text-blue-700' :
                                      histOrder.status === 'Atribuído' ? 'bg-orange-100 text-orange-700' :
                                      'bg-yellow-100 text-yellow-700'
                                    }`}>
                                      {histOrder.status}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                </div>

                {/* Rodapé com Ações do Gestor */}
                <div className="bg-slate-100 p-4 px-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                  {o.status === 'Cancelado' ? (
                    <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-red-600">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>Pedido Cancelado — Nenhuma alteração operacional permitida</span>
                      </div>
                      <button
                        onClick={() => setSelectedOrderDetails(null)}
                        className="w-full sm:w-auto bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-5 py-2.5 rounded-xl text-xs transition-colors"
                      >
                        Fechar
                      </button>
                    </div>
                  ) : o.status === 'Concluído' ? (
                    <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>Pedido Concluído — Entrega finalizada</span>
                      </div>
                      <button
                        onClick={() => setSelectedOrderDetails(null)}
                        className="w-full sm:w-auto bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-5 py-2.5 rounded-xl text-xs transition-colors"
                      >
                        Fechar
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Botão Cancelar Pedido (Abre modal de motivo) */}
                      <button
                        onClick={() => setCancellingOrder(o)}
                        className="w-full sm:w-auto bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 hover:border-red-300 font-black py-3 px-4 rounded-2xl text-xs flex items-center justify-center gap-2 transition-all"
                      >
                        <X className="w-4 h-4" /> CANCELAR PEDIDO
                      </button>

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        {o.deliveryPersonId ? (
                          <button
                            onClick={() => setAssigningOrder(o)}
                            className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white font-black py-3 px-4 rounded-2xl text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-600/20"
                          >
                            <Edit2 className="w-3.5 h-3.5" /> MODIFICAR ENTREGADOR
                          </button>
                        ) : (
                          <button
                            onClick={() => setAssigningOrder(o)}
                            className="flex-1 sm:flex-none bg-slate-900 hover:bg-slate-800 text-white font-black py-3 px-4 rounded-2xl text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-slate-900/10"
                          >
                            <Truck className="w-3.5 h-3.5 text-yellow-400" /> ATRIBUIR ENTREGADOR
                          </button>
                        )}

                        <button
                          onClick={() => {
                            if (window.confirm(`Deseja marcar o pedido #${o.id} como ENTREGUE / CONCLUÍDO?`)) {
                              const updated: Order = { ...o, status: 'Concluído' };
                              onUpdateOrder(updated);
                              setSelectedOrderDetails(updated);
                              alert(`Pedido #${o.id} marcado como concluído.`);
                            }
                          }}
                          className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 px-4 rounded-2xl text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/20"
                        >
                          <Check className="w-4 h-4 stroke-[3]" /> MARCAR COMO ENTREGUE
                        </button>
                      </div>
                    </>
                  )}
                </div>

              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
      <AnimatePresence>
        {assigningOrder && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-xl">Atribuir Pedido</h3>
                <button onClick={() => setAssigningOrder(null)}><X className="w-6 h-6 text-slate-400" /></button>
              </div>
              <div className="space-y-3">
                {deliveryPersons.map(dp => (
                  <button key={dp.id} onClick={() => handleAssign(assigningOrder.id, dp.id)} className="w-full p-4 bg-slate-50 rounded-2xl text-left flex items-center justify-between hover:bg-slate-100 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-100 w-10 h-10 rounded-full flex items-center justify-center"><User className="text-blue-600 w-5 h-5" /></div>
                      <span className="font-bold">{dp.name}</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300" />
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Motivo de Cancelamento de Pedido */}
      <AnimatePresence>
        {cancellingOrder && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }} 
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6 overflow-hidden border border-slate-100"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-xl text-slate-900">Cancelar Pedido #{cancellingOrder.id}</h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {cancellingOrder.customerName} • R$ {cancellingOrder.total.toFixed(2)}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setCancellingOrder(null);
                    setCancellationReason('');
                    setCustomReason('');
                  }}
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-4 text-xs text-amber-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  O motivo será registrado no histórico do pedido para auditoria e melhorias na operação.
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase mb-2">
                    Selecione o motivo do cancelamento:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {CANCELLATION_REASONS.map(reason => {
                      const isSelected = cancellationReason === reason;
                      return (
                        <button
                          key={reason}
                          type="button"
                          onClick={() => {
                            setCancellationReason(reason);
                            if (reason !== 'Outro motivo') {
                              setCustomReason('');
                            }
                          }}
                          className={`text-left p-2.5 rounded-xl text-xs font-bold transition-all border ${
                            isSelected 
                              ? 'bg-red-50 border-red-500 text-red-700 shadow-sm' 
                              : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                          }`}
                        >
                          {isSelected ? '✓ ' : ''}{reason}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                    {cancellationReason === 'Outro motivo' ? 'Especifique o motivo do cancelamento:' : 'Observações adicionais (opcional):'}
                  </label>
                  <textarea
                    rows={3}
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder={cancellationReason === 'Outro motivo' ? 'Descreva detalhadamente o motivo...' : 'Ex: Cliente informou que vai pedir mais tarde...'}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400 focus:bg-white transition-all resize-none"
                  />
                </div>

                <div className="pt-3 flex flex-col sm:flex-row items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setCancellingOrder(null);
                      setCancellationReason('');
                      setCustomReason('');
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmCancellation}
                    disabled={!cancellationReason && !customReason.trim()}
                    className="w-full sm:w-auto bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-2.5 px-5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-red-600/20"
                  >
                    <X className="w-4 h-4" /> CONFIRMAR CANCELAMENTO
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {viewingCustomerHistory && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="font-black text-xl">Histórico: {viewingCustomerHistory.customer.name}</h3>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{viewingCustomerHistory.customer.phone}</p>
                </div>
                <button onClick={() => setViewingCustomerHistory(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-6 h-6 text-slate-400" /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-4">
                  {viewingCustomerHistory.history.map((order: Order) => (
                    <div key={order.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">#{order.id}</span>
                          <span className="text-[10px] font-black bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">{order.paymentMethod}</span>
                        </div>
                        <p className="text-xs font-bold text-slate-600">{new Date(order.createdAt).toLocaleDateString()} às {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        <div className="mt-2 flex gap-2">
                          {order.items.map((item, idx) => (
                            <span key={idx} className="text-[10px] font-black bg-yellow-100 text-yellow-700 px-2 py-1 rounded-lg">
                              {item.quantity}x {PRODUCTS.find(p => p.id === item.productId)?.name}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-slate-900">R$ {order.total.toFixed(2)}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Pago</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                <div className="flex gap-8">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">Total Comprado</p>
                    <p className="text-xl font-black text-slate-900">{viewingCustomerHistory.totalQuantity} un</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">Gasto Total</p>
                    <p className="text-xl font-black text-slate-900">R$ {viewingCustomerHistory.history.reduce((acc: number, o: Order) => acc + o.total, 0).toFixed(2)}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setViewingCustomerHistory(null)}
                  className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black text-sm"
                >
                  FECHAR
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCouponModalOpen && selectedPrediction && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-xl">Enviar Cupom</h3>
                <button onClick={() => setIsCouponModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-6 h-6 text-slate-400" /></button>
              </div>
              <p className="text-sm text-slate-500 mb-6">Digite o código do cupom que deseja enviar para <strong>{selectedPrediction.customer.name}</strong>.</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Código do Cupom</label>
                  <input 
                    type="text" 
                    placeholder="Ex: VOLTE10"
                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none transition-all font-black uppercase"
                    value={customCouponCode}
                    onChange={(e) => setCustomCouponCode(e.target.value.toUpperCase())}
                  />
                </div>
                <button 
                  onClick={() => handleSendMessage(selectedPrediction, 'coupon', customCouponCode)}
                  disabled={!customCouponCode}
                  className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-slate-800 transition-all disabled:opacity-50"
                >
                  ENVIAR VIA WHATSAPP
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {areaToDelete && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }} 
              className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 text-center relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-400 to-rose-500"></div>
              
              <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6 rotate-3">
                <Trash2 className="w-10 h-10 text-red-500" />
              </div>
              
              <h3 className="font-black text-2xl mb-2 text-slate-900">Remover Bairro?</h3>
              <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                Você está prestes a remover <strong>{coverageAreas.find(a => a.id === areaToDelete)?.neighborhood}</strong> da área de cobertura. Esta ação é irreversível.
              </p>
              
              <div className="flex flex-col gap-3">
                <button 
                   onClick={() => {
                    const area = coverageAreas.find(a => a.id === areaToDelete);
                    if (area) {
                      onUpdateCoverage(coverageAreas.filter(a => a.id !== areaToDelete));
                    }
                    setAreaToDelete(null);
                  }}
                  className="w-full py-4 bg-red-500 text-white font-black rounded-2xl hover:bg-red-600 active:scale-[0.98] transition-all shadow-lg shadow-red-200"
                >
                  SIM, REMOVER AGORA
                </button>
                <button 
                  onClick={() => setAreaToDelete(null)}
                  className="w-full py-4 bg-slate-100 text-slate-500 font-bold rounded-2xl hover:bg-slate-200 active:scale-[0.98] transition-all"
                >
                  CANCELAR
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddingCollaborator && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-black text-xl">Novo Colaborador</h3>
                <button onClick={() => setIsAddingCollaborator(false)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-6 h-6 text-slate-400" /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Nome Completo</label>
                  <input 
                    type="text" 
                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none transition-all"
                    placeholder="Ex: João Silva"
                    value={newCollaborator.name}
                    onChange={(e) => setNewCollaborator(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">E-mail</label>
                    <input 
                      type="email" 
                      className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none transition-all"
                      placeholder="email@empresa.com"
                      value={newCollaborator.email}
                      onChange={(e) => setNewCollaborator(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Senha</label>
                    <input 
                      type="password" 
                      className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none transition-all"
                      placeholder="Mínimo 6 caracteres"
                      value={newCollaborator.password}
                      onChange={(e) => setNewCollaborator(prev => ({ ...prev, password: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Função Principal</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['gestor', 'admin', 'entregador'] as const).map(role => (
                      <button 
                        key={role}
                        onClick={() => setNewCollaborator(prev => ({ ...prev, role }))}
                        className={`py-2 rounded-xl text-[10px] font-black uppercase transition-all ${newCollaborator.role === role ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-500'}`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>

                {newCollaborator.role !== 'gestor' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Abas Permitidas (Acesso Variável)</label>
                    <div className="grid grid-cols-2 gap-3">
                      {ALL_TABS.map(tab => (
                        <label key={tab.id} className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${newCollaborator.allowedTabs.includes(tab.id) ? 'bg-yellow-50 border-yellow-200' : 'bg-slate-50 border-slate-100'}`}>
                          <input 
                            type="checkbox" 
                            className="hidden"
                            checked={newCollaborator.allowedTabs.includes(tab.id)}
                            onChange={() => {
                              setNewCollaborator(prev => ({
                                ...prev,
                                allowedTabs: prev.allowedTabs.includes(tab.id) 
                                  ? prev.allowedTabs.filter(t => t !== tab.id)
                                  : [...prev.allowedTabs, tab.id]
                              }));
                            }}
                          />
                          <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${newCollaborator.allowedTabs.includes(tab.id) ? 'bg-yellow-400 border-yellow-400' : 'bg-white border-slate-300'}`}>
                            {newCollaborator.allowedTabs.includes(tab.id) && <Check className="w-3 h-3 text-slate-900" />}
                          </div>
                          <span className="text-xs font-bold text-slate-600">{tab.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100">
                <button 
                  onClick={handleAddCollaborator}
                  disabled={!newCollaborator.name || !newCollaborator.email || newCollaborator.password.length < 6 || isSavingCollaborator}
                  className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-slate-800 transition-all disabled:opacity-50"
                >
                  {isSavingCollaborator ? 'CADASTRANDO...' : 'CADASTRAR COLABORADOR'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

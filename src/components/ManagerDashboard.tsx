import React, { useState, useMemo, useEffect } from 'react';
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
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import { AppUser, Order, OrderStatus, Expense, Address, CoverageArea, Coupon, Reward, Referral } from '../types';

// Fix Leaflet default icon issue
let DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
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
  onUpdateUser
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'map' | 'coverage' | 'benefits' | 'predictions' | 'collaborators'>('orders');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'Todos'>('Todos');
  const [areaToDelete, setAreaToDelete] = useState<string | null>(null);
  const [assigningOrder, setAssigningOrder] = useState<Order | null>(null);
  const [isAddingOrder, setIsAddingOrder] = useState(false);
  const [isAddingCoverage, setIsAddingCoverage] = useState(false);
  const [isAddingCoupon, setIsAddingCoupon] = useState(false);
  const [viewingCustomerHistory, setViewingCustomerHistory] = useState<any | null>(null);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [selectedPrediction, setSelectedPrediction] = useState<any | null>(null);
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
  const [benefitSubTab, setBenefitSubTab] = useState<'coupons' | 'referrals'>('coupons');
  const [isAddingCollaborator, setIsAddingCollaborator] = useState(false);
  const [newCollaborator, setNewCollaborator] = useState({
    name: '',
    email: '',
    password: '',
    role: 'admin' as UserRole,
    allowedTabs: [] as string[]
  });

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

  const filteredOrders = statusFilter === 'Todos' ? orders : orders.filter(o => o.status === statusFilter);

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

  const handleAddCoverage = () => {
    if (!newArea.neighborhood || !newArea.city) return;
    
    onUpdateCoverage([...coverageAreas, {
      id: Math.random().toString(36).substr(2, 9),
      neighborhood: newArea.neighborhood,
      city: newArea.city,
      allowedCeps: [],
      center: { lat: -23.5505 + (Math.random() - 0.5) * 0.02, lng: -46.6333 + (Math.random() - 0.5) * 0.02 }
    }]);
    
    setNewArea({ ...newArea, neighborhood: '' });
    setIsAddingCoverage(false);
  };

  const handleAssign = (orderId: string, deliveryPersonId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (order) {
      onUpdateOrder({ ...order, status: 'Em Rota', deliveryPersonId });
      setAssigningOrder(null);
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
    
    try {
      // We'll use authService.signUp but we need to pass the extra data
      // For now, satisfy the UI by optimistically adding or calling a custom signup
      const { data, error } = await authService.signUp(
        newCollaborator.email, 
        newCollaborator.name, 
        newCollaborator.role,
        '' // No phone for collaborators usually, or same as email for now
      );

      if (error) throw error;

      // Update profile with allowedTabs (since signUp might not include it yet)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ allowedTabs: newCollaborator.allowedTabs })
        .eq('id', data.user.id);

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
    }
  };

  const ALL_TABS = [
    { id: 'dashboard', label: 'Métricas' },
    { id: 'orders', label: 'Pedidos' },
    { id: 'map', label: 'Monitoramento' },
    { id: 'coverage', label: 'Cobertura' },
    { id: 'benefits', label: 'Benefícios' },
    { id: 'predictions', label: 'Previsão' }
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
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-2xl">
            <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
              <User className="text-slate-400 w-5 h-5" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold truncate">{user.name}</p>
              <p className="text-[10px] text-slate-500 truncate uppercase tracking-tight">{user.role}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 pb-20">
        {/* Mobile Header */}
        <header className="md:hidden p-6 bg-white border-b border-slate-100 flex items-center justify-between sticky top-0 z-30 overflow-x-auto">
          <h1 className="text-xl font-black text-slate-900 shrink-0 mr-4">Gás Express</h1>
          <div className="flex gap-2">
            {(user.role === 'gestor' || user.allowedTabs?.includes('dashboard')) && <button onClick={() => setActiveTab('dashboard')} className={`p-2 rounded-lg ${activeTab === 'dashboard' ? 'bg-yellow-400' : 'bg-slate-100'}`}><LayoutDashboard className="w-5 h-5" /></button>}
            {(user.role === 'gestor' || user.allowedTabs?.includes('orders')) && <button onClick={() => setActiveTab('orders')} className={`p-2 rounded-lg ${activeTab === 'orders' ? 'bg-yellow-400' : 'bg-slate-100'}`}><Package className="w-5 h-5" /></button>}
            {(user.role === 'gestor' || user.allowedTabs?.includes('map')) && <button onClick={() => setActiveTab('map')} className={`p-2 rounded-lg ${activeTab === 'map' ? 'bg-yellow-400' : 'bg-slate-100'}`}><MapIcon className="w-5 h-5" /></button>}
            {(user.role === 'gestor' || user.allowedTabs?.includes('coverage')) && <button onClick={() => setActiveTab('coverage')} className={`p-2 rounded-lg ${activeTab === 'coverage' ? 'bg-yellow-400' : 'bg-slate-100'}`}><MapPin className="w-5 h-5" /></button>}
            {user.role === 'gestor' && <button onClick={() => setActiveTab('collaborators')} className={`p-2 rounded-lg ${activeTab === 'collaborators' ? 'bg-yellow-400' : 'bg-slate-100'}`}><Users className="w-5 h-5" /></button>}
          </div>
        </header>

        <div className="p-6 lg:p-10 max-w-6xl mx-auto">
          <header className="hidden md:flex items-center justify-between mb-10">
            <div>
              <h2 className="text-3xl font-black text-slate-900">
                {activeTab === 'dashboard' && "Visão Geral"}
                {activeTab === 'orders' && "Gestão de Pedidos"}
                {activeTab === 'map' && "Mapa de Entregas"}
                {activeTab === 'coverage' && "Área de Cobertura"}
              </h2>
              <p className="text-slate-500 font-medium">Acompanhe o desempenho da sua revenda em tempo real.</p>
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

          {activeTab === 'orders' && (
            <motion.div key="orders" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {(['Todos', 'Pendente', 'Em Rota', 'Concluído', 'Cancelado'] as const).map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap ${statusFilter === s ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 shadow-sm'}`}>{s}</button>
                ))}
              </div>

              <div className="space-y-4">
                {filteredOrders.map(o => (
                  <div key={o.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase mb-1 inline-block">#{o.id}</span>
                        <h3 className="font-black text-lg">{o.customerName}</h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> {o.address.street}, {o.address.number}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black">R$ {o.total.toFixed(2)}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          o.status === 'Concluído' ? 'bg-green-100 text-green-600' : 
                          o.status === 'Em Rota' ? 'bg-blue-100 text-blue-600' : 'bg-yellow-100 text-yellow-600'
                        }`}>{o.status}</span>
                      </div>
                    </div>

                    {o.status === 'Pendente' && (
                      <button onClick={() => setAssigningOrder(o)} className="w-full mt-4 bg-slate-900 text-white py-3 rounded-xl font-black flex items-center justify-center gap-2">
                        <Truck className="w-4 h-4" /> ATRIBUIR ENTREGADOR
                      </button>
                    )}

                    {o.deliveryPersonId && (
                      <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400" />
                          <span className="text-xs font-bold text-slate-600">Entregador: {deliveryPersons.find(dp => dp.id === o.deliveryPersonId)?.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => {
                              const link = `${window.location.origin}?phone=${o.phone}`;
                              navigator.clipboard.writeText(link);
                              alert('Link de rastreio copiado!');
                            }}
                            className="flex items-center gap-1 text-[10px] font-black text-slate-500 hover:text-slate-800 transition-colors bg-slate-100 px-2 py-1 rounded-lg"
                          >
                            <Copy className="w-3 h-3" /> LINK
                          </button>
                          <button 
                            onClick={() => {
                              const link = `${window.location.origin}?phone=${o.phone}`;
                              const message = `Olá ${o.customerName}, seu pedido na Gás Express está sendo processado! Acompanhe a entrega em tempo real aqui: ${link}`;
                              window.open(`https://wa.me/55${o.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
                            }}
                            className="flex items-center gap-1 text-[10px] font-black text-green-600 hover:text-green-800 transition-colors bg-green-50 px-2 py-1 rounded-lg"
                          >
                            <MessageSquare className="w-3 h-3" /> WHATSAPP
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'map' && (
            <motion.div key="map" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <h3 className="font-black text-lg mb-6 flex items-center gap-2">
                  <MapIcon className="text-yellow-500 w-5 h-5" /> Monitoramento em Tempo Real
                </h3>
                
                <div className="relative h-[500px] bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 z-0">
                  <MapContainer center={[-23.5505, -46.6333]} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    {/* Delivery Persons on Map */}
                    {deliveryPersons.map(dp => (
                      dp.location && (
                        <Marker 
                          key={dp.id} 
                          position={[dp.location.lat, dp.location.lng]}
                        >
                          <Popup>
                            <div className="font-bold">{dp.name}</div>
                            <div className="text-xs">{orders.some(o => o.deliveryPersonId === dp.id && o.status === 'Em Rota') ? 'Em Entrega' : 'Disponível'}</div>
                          </Popup>
                        </Marker>
                      )
                    ))}
                    {/* Active Orders on Map */}
                    {orders.filter(o => o.status === 'Em Rota').map(order => (
                      order.deliveryPersonLocation && (
                        <Circle 
                          key={order.id}
                          center={[order.deliveryPersonLocation.lat, order.deliveryPersonLocation.lng]}
                          radius={200}
                          pathOptions={{ color: 'blue', fillColor: 'blue', fillOpacity: 0.1 }}
                        />
                      )
                    ))}
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
                    <div className="flex-1 relative bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 min-h-[400px] z-0">
                      <MapContainer center={[-23.5505, -46.6333]} zoom={12} style={{ height: '100%', width: '100%' }}>
                        <TileLayer
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        />
                        {coverageAreas.map(area => (
                          area.center && (
                            <React.Fragment key={area.id}>
                              <Marker position={[area.center.lat, area.center.lng]}>
                                <Popup>
                                  <div className="font-bold">{area.neighborhood}</div>
                                  <div className="text-xs">{area.city}</div>
                                </Popup>
                              </Marker>
                              <Circle 
                                center={[area.center.lat, area.center.lng]} 
                                radius={1500}
                                pathOptions={{ fillColor: '#facc15', color: '#eab308', fillOpacity: 0.2 }}
                              />
                            </React.Fragment>
                          )
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
              <div className="flex gap-2 mb-2">
                <button 
                  onClick={() => setBenefitSubTab('coupons')}
                  className={`px-6 py-2 rounded-xl font-black text-xs transition-all ${benefitSubTab === 'coupons' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}
                >
                  CUPONS
                </button>
                <button 
                  onClick={() => setBenefitSubTab('referrals')}
                  className={`px-6 py-2 rounded-xl font-black text-xs transition-all ${benefitSubTab === 'referrals' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}
                >
                  INDICAÇÕES
                </button>
              </div>

              {benefitSubTab === 'coupons' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="font-black text-lg flex items-center gap-2">
                          <Ticket className="text-yellow-500 w-5 h-5" /> Cupons de Desconto
                        </h3>
                        <button 
                          onClick={() => setIsAddingCoupon(true)}
                          className="bg-yellow-400 p-2 rounded-xl text-slate-900 hover:bg-yellow-500 transition-colors"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {coupons.map(coupon => (
                          <div key={coupon.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 relative overflow-hidden">
                            <div className={`absolute top-0 right-0 w-2 h-full ${coupon.isActive ? 'bg-green-400' : 'bg-slate-300'}`}></div>
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
                            <button 
                              onClick={() => onUpdateCoupons(coupons.map(c => c.id === coupon.id ? { ...c, isActive: !c.isActive } : c))}
                              className={`mt-3 w-full py-1.5 rounded-lg text-[10px] font-black transition-all ${coupon.isActive ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'}`}
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
                  </div>

                  <div className="space-y-6">
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                      <h3 className="font-black text-lg mb-6 flex items-center gap-2">
                        <Star className="text-yellow-500 w-5 h-5" /> Recompensas (Pontos)
                      </h3>
                      <div className="space-y-4">
                        {rewards.map(reward => (
                          <div key={reward.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="flex justify-between items-start mb-1">
                              <p className="font-bold text-slate-900">{reward.title}</p>
                              <span className="bg-yellow-100 text-yellow-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                                {reward.pointsCost} pts
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 leading-tight">{reward.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-black text-lg flex items-center gap-2">
                      <Users className="text-yellow-500 w-5 h-5" /> Gestão de Indicações
                    </h3>
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
                                ref.status === 'Validado' ? 'bg-green-100 text-green-700' : 
                                ref.status === 'Rejeitado' ? 'bg-red-100 text-red-700' : 
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {ref.status.toUpperCase()}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right">
                              {ref.status === 'Pendente' && (
                                <div className="flex justify-end gap-2">
                                  <button 
                                    onClick={() => {
                                      const updatedReferrals = referrals.map(r => r.id === ref.id ? { ...r, status: 'Validado' as const, validatedAt: new Date().toISOString() } : r);
                                      onUpdateReferrals(updatedReferrals);
                                      
                                      // Grant points to referrer
                                      const referrer = allCustomers.find(c => c.id === ref.referrerId);
                                      if (referrer) {
                                        onUpdateUser({ ...referrer, points: (referrer.points || 0) + ref.pointsAwarded });
                                      }
                                      alert(`Indicação de ${ref.refereeName} validada! ${ref.pointsAwarded} pontos creditados para ${ref.referrerName}.`);
                                    }}
                                    className="bg-green-500 text-white p-2 rounded-lg hover:bg-green-600 transition-colors"
                                    title="Validar Indicação"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => {
                                      const updatedReferrals = referrals.map(r => r.id === ref.id ? { ...r, status: 'Rejeitado' as const } : r);
                                      onUpdateReferrals(updatedReferrals);
                                    }}
                                    className="bg-red-500 text-white p-2 rounded-lg hover:bg-red-600 transition-colors"
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
                  disabled={!newArea.neighborhood || !newArea.city}
                  className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-slate-800 transition-all disabled:opacity-50"
                >
                  SALVAR ÁREA DE COBERTURA
                </button>
              </div>
            </motion.div>
          </div>
        )}
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
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="font-black text-xl mb-2">Remover Bairro?</h3>
              <p className="text-sm text-slate-500 mb-6">
                Tem certeza que deseja remover o bairro <strong>{coverageAreas.find(a => a.id === areaToDelete)?.neighborhood}</strong> da sua área de cobertura? Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setAreaToDelete(null)}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 font-black rounded-xl hover:bg-slate-200 transition-colors"
                >
                  CANCELAR
                </button>
                <button 
                  onClick={() => {
                    const area = coverageAreas.find(a => a.id === areaToDelete);
                    if (area) {
                      onUpdateCoverage(coverageAreas.filter(a => a.id !== areaToDelete));
                      // SweetAlert or standard alert can be optional here, but we already asked
                    }
                    setAreaToDelete(null);
                  }}
                  className="flex-1 px-4 py-3 bg-red-500 text-white font-black rounded-xl hover:bg-red-600 transition-colors"
                >
                  REMOVER
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
                  disabled={!newCollaborator.name || !newCollaborator.email || newCollaborator.password.length < 6}
                  className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-slate-800 transition-all disabled:opacity-50"
                >
                  CADASTRAR COLABORADOR
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

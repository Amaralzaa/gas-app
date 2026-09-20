import React, { useState, useEffect, useRef } from 'react';
import { 
  Truck, 
  DollarSign, 
  Plus, 
  Search, 
  MapPin, 
  ExternalLink, 
  Check, 
  X, 
  User, 
  Package,
  ArrowRight,
  Minus,
  CreditCard,
  History,
  MessageSquare,
  Phone,
  Map as MapIcon,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { AppUser, Order, Expense, Product, Address, BusinessInfo } from '../types';
import { PRODUCTS } from '../constants';
import { playAssignedOrderSound, unlockAudio } from '../utils/sounds';

interface DeliveryDashboardProps {
  user: AppUser;
  orders: Order[];
  onUpdateOrder: (order: Order) => void;
  onAddOrder: (order: Order) => void;
  onAddExpense: (expense: Expense) => void;
  onUpdateUser: (user: AppUser) => void;
  expenses: Expense[];
  allCustomers: AppUser[];
  businessInfo?: BusinessInfo;
}

export const DeliveryDashboard: React.FC<DeliveryDashboardProps> = ({ 
  user, 
  orders, 
  onUpdateOrder, 
  onAddOrder, 
  onAddExpense, 
  onUpdateUser, 
  expenses, 
  allCustomers,
  businessInfo 
}) => {
  const [activeTab, setActiveTab] = useState<'deliveries' | 'map' | 'finance'>('deliveries');
  const [isAddingSale, setIsAddingSale] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  
  // New Sale State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<AppUser | null>(null);
  const [cart, setCart] = useState<{ [id: string]: number }>({});

  const [gpsStatus, setGpsStatus] = useState<string>('Aguardando...');

  const updateLocation = (lat: number, lng: number) => {
    onUpdateUser({ ...user, location: { lat, lng } });
    orders
      .filter(o => o.deliveryPersonId === user.id && o.status === 'Em Rota')
      .forEach(o => {
        onUpdateOrder({ ...o, deliveryPersonLocation: { lat, lng } });
      });
  };

  // GPS Tracking
  useEffect(() => {
    let watchId: number;
    if ('geolocation' in navigator) {
      setGpsStatus('Conectando ao GPS...');
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setGpsStatus(`GPS Ativo: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          updateLocation(lat, lng);
        },
        (error) => {
          console.warn('Erro ao acessar GPS do entregador:', error.message);
          setGpsStatus(`Aviso GPS: ${error.message}`);
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    } else {
      setGpsStatus('GPS não suportado neste navegador');
    }
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // --- Notificação sonora: pedido atribuído ao Entregador ---
  const prevAssignedIdsRef = useRef<Set<string>>(
    new Set(orders.filter(o => o.deliveryPersonId === user.id && (o.status === 'Atribuído' || o.status === 'Em Rota')).map(o => o.id))
  );
  const audioUnlockedRef = useRef(false);

  // Desbloqueia áudio na primeira interação
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
    const myAssigned = orders.filter(
      o => o.deliveryPersonId === user.id && (o.status === 'Atribuído' || o.status === 'Em Rota')
    );
    const newAssigned = myAssigned.filter(o => !prevAssignedIdsRef.current.has(o.id));

    if (newAssigned.length > 0) {
      playAssignedOrderSound().catch(() => {});

      if ('Notification' in window && Notification.permission === 'granted') {
        newAssigned.forEach(o => {
          new Notification('🚚 Novo Pedido Atribuído!', {
            body: `${o.customerName} — ${o.address.street}, ${o.address.neighborhood}`,
            icon: '/favicon.ico',
            tag: o.id
          });
        });
      } else if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }

    prevAssignedIdsRef.current = new Set(myAssigned.map(o => o.id));
  }, [orders, user.id]);


  const handleForceGps = () => {
    if ('geolocation' in navigator) {
      setGpsStatus('Buscando sinal GPS...');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setGpsStatus(`GPS Ativo: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          updateLocation(lat, lng);
        },
        (err) => {
          alert('Não foi possível obter GPS: ' + err.message);
          setGpsStatus(`Erro GPS: ${err.message}`);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  };

  const handleSimulateStep = () => {
    const activeRouteOrder = orders.find(o => o.deliveryPersonId === user.id && o.status === 'Em Rota');
    const targetLat = activeRouteOrder?.address.lat || -22.9037;
    const targetLng = activeRouteOrder?.address.lng || -43.1017;

    const currentLat = user.location?.lat ?? (targetLat - 0.008);
    const currentLng = user.location?.lng ?? (targetLng - 0.008);

    // Anda 20% em direção ao destino do cliente
    const nextLat = currentLat + (targetLat - currentLat) * 0.25;
    const nextLng = currentLng + (targetLng - currentLng) * 0.25;

    setGpsStatus(`Simulado: ${nextLat.toFixed(4)}, ${nextLng.toFixed(4)}`);
    updateLocation(nextLat, nextLng);
  };

  const myDeliveries = orders
    .filter(o => o.deliveryPersonId === user.id && (o.status === 'Em Rota' || o.status === 'Atribuído'))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const myCompletedToday = orders.filter(o => {
    if (o.deliveryPersonId !== user.id || o.status !== 'Concluído') return false;
    const orderDate = new Date(o.createdAt);
    const today = new Date();
    return orderDate.toDateString() === today.toDateString();
  });
  const myExpenses = expenses.filter(e => e.userId === user.id);
  const todayExpenses = myExpenses.filter(e => {
    const d = new Date(e.date);
    return d.toDateString() === new Date().toDateString();
  });

  const filteredCustomers = allCustomers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.addresses?.some(a => a.street.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const cartTotal = Object.entries(cart).reduce((acc, [id, qty]) => {
    const product = PRODUCTS.find(p => p.id === id);
    return acc + (product?.price || 0) * (qty as number);
  }, 0);

  const handleComplete = (order: Order) => {
    onUpdateOrder({ ...order, status: 'Concluído' });
  };

  const handleNewSale = () => {
    if (!selectedCustomer || !selectedCustomer.addresses?.[0]) return;
    const newOrder: Order = {
      id: 'SALE-' + Math.random().toString(36).substr(2, 5).toUpperCase(),
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
      status: 'Concluído',
      deliveryPersonId: user.id,
      createdAt: new Date().toISOString()
    };
    onAddOrder(newOrder);
    setIsAddingSale(false);
    setCart({});
    setSelectedCustomer(null);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-24">
      <div className="p-6 max-w-md mx-auto">
        <header className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-black">Entregador</h1>
          <div className="flex gap-2">
            <button onClick={() => setActiveTab('deliveries')} className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab === 'deliveries' ? 'bg-yellow-400 text-slate-900' : 'bg-slate-800 text-slate-400'}`}>Entregas</button>
            <button onClick={() => setActiveTab('map')} className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab === 'map' ? 'bg-yellow-400 text-slate-900' : 'bg-slate-800 text-slate-400'}`}>Mapa</button>
            <button onClick={() => setActiveTab('finance')} className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab === 'finance' ? 'bg-yellow-400 text-slate-900' : 'bg-slate-800 text-slate-400'}`}>Financeiro</button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'deliveries' && (
            <motion.div key="deliveries" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              {/* Resumo do dia */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                  <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Em Rota Agora</p>
                  <p className="text-2xl font-black text-yellow-400">{myDeliveries.length}</p>
                </div>
                <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                  <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Concluídas Hoje</p>
                  <p className="text-2xl font-black text-green-400">{myCompletedToday.length}</p>
                </div>
              </div>

              {myDeliveries.length === 0 ? (
                <div className="text-center py-20 opacity-30">
                  <Truck className="w-16 h-16 mx-auto mb-4" />
                  <p className="font-bold">Nenhuma entrega em rota.</p>
                  <p className="text-sm mt-2 text-slate-500">Aguarde o gestor atribuir pedidos.</p>
                </div>
              ) : (
                myDeliveries.map((o, idx) => (
                  <div key={o.id} className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl">
                    {/* Número de sequência */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 bg-yellow-400 text-slate-900 rounded-full flex items-center justify-center font-black text-sm shrink-0">
                        {idx + 1}
                      </div>
                      <span className="text-[10px] font-black bg-slate-700 text-slate-300 px-2 py-0.5 rounded uppercase">#{o.id}</span>
                      <p className="text-lg font-black text-yellow-400 ml-auto">R$ {o.total.toFixed(2)}</p>
                    </div>

                    <h3 className="font-black text-lg mb-1">{o.customerName}</h3>
                    <div className="text-slate-400 text-sm mb-1 flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                      <span>{o.address.street}, {o.address.number}{o.address.complement ? ` - ${o.address.complement}` : ''}</span>
                    </div>
                    {o.address.reference && (
                      <p className="text-[11px] text-slate-500 ml-6 mb-1">📍 {o.address.reference}</p>
                    )}
                    <p className="text-[11px] text-slate-500 ml-6 mb-2">{o.address.neighborhood} · {o.paymentMethod}</p>

                    {o.isScheduled && (
                      <div className="bg-purple-950/80 border border-purple-500/50 text-purple-200 rounded-xl px-3 py-1.5 text-xs font-bold mb-3 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-purple-400" />
                        <span>📅 Agendado: {o.scheduledDate || 'Amanhã'} ({o.scheduledPeriodName || (o.scheduledPeriod === 'manha' ? 'Manhã' : o.scheduledPeriod === 'tarde' ? 'Tarde' : o.scheduledPeriod === 'noite' ? 'Noite' : o.scheduledPeriod || 'Turno')}{o.scheduledTimeRange ? ` ${o.scheduledTimeRange}` : ''})</span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${o.address.street} ${o.address.number} ${o.address.neighborhood} ${o.address.city}`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-blue-600 p-4 rounded-2xl font-bold flex items-center justify-center gap-2 text-sm"
                      >
                        <ExternalLink className="w-4 h-4" /> MAPS
                      </a>
                      {o.status === 'Atribuído' ? (
                        <button onClick={() => onUpdateOrder({ ...o, status: 'Em Rota' })} className="bg-orange-500 p-4 rounded-2xl font-bold flex items-center justify-center gap-2 text-sm">
                          <Check className="w-4 h-4" /> ACEITAR
                        </button>
                      ) : (
                        <button onClick={() => handleComplete(o)} className="bg-green-600 p-4 rounded-2xl font-bold flex items-center justify-center gap-2 text-sm">
                          <Check className="w-4 h-4" /> ENTREGUE
                        </button>
                      )}
                    </div>
                    {o.status === 'Em Rota' && (
                      <button
                        onClick={() => {
                          const link = `${window.location.origin}?phone=${o.phone}`;
                          const storeName = businessInfo?.name?.trim() || 'Gás Express';
                          const message = `Olá ${o.customerName}, aqui é o entregador da ${storeName}! Estou saindo com seu pedido agora. Acompanhe minha localização em tempo real aqui: ${link}`;
                          window.open(`https://wa.me/55${o.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
                        }}
                        className="w-full bg-slate-700 p-4 rounded-2xl font-bold flex items-center justify-center gap-2 text-sm text-yellow-400"
                      >
                        <MessageSquare className="w-4 h-4" /> NOTIFICAR CLIENTE (WHATSAPP)
                      </button>
                    )}
                  </div>
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'map' && (
            <motion.div key="map" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black text-lg flex items-center gap-2">
                    <MapIcon className="text-yellow-400 w-5 h-5" /> Minha Rota
                  </h3>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleForceGps} 
                      className="bg-slate-700 hover:bg-slate-600 text-yellow-400 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all"
                    >
                      📡 Forçar GPS
                    </button>
                    <button 
                      onClick={handleSimulateStep} 
                      className="bg-yellow-400 hover:bg-yellow-300 text-slate-900 px-3 py-1.5 rounded-xl text-[11px] font-black transition-all shadow-sm"
                    >
                      🛵 Simular Passo
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3 bg-slate-900/60 px-3 py-2 rounded-xl border border-slate-700/50">
                  <span className={`w-2.5 h-2.5 rounded-full ${user.location ? 'bg-green-500 animate-pulse' : 'bg-yellow-400'}`}></span>
                  <span className="text-[11px] font-bold text-slate-300">{gpsStatus}</span>
                </div>
                
                <div className="relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 z-0 isolate" style={{ height: '400px' }}>
                  <MapContainer center={[user.location?.lat || -22.903, user.location?.lng || -43.112]} zoom={14} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    />
                    
                    {/* Marcador do Entregador */}
                    <Marker 
                      position={[user.location?.lat || -22.903, user.location?.lng || -43.112]}
                      icon={L.divIcon({
                        html: `<div style="background:#22c55e;color:white;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:16px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);">🛵</div>`,
                        iconSize: [34, 34],
                        iconAnchor: [17, 17],
                        className: ''
                      })}
                    >
                      <Popup>
                        <div className="font-bold text-slate-900">Você (Entregador)</div>
                        <div className="text-xs text-slate-500">Localização em tempo real</div>
                      </Popup>
                    </Marker>

                    {/* Marcadores dos Pedidos */}
                    {myDeliveries.map((order, idx) => {
                      // Usa a lat/lng do endereço geocodificado ou cai no centro de niterói para testar
                      const lat = order.address.lat || -22.903 + (idx * 0.001);
                      const lng = order.address.lng || -43.112 + (idx * 0.0005);
                      const color = order.status === 'Em Rota' ? '#3b82f6' : '#f97316';
                      
                      return (
                        <Marker
                          key={order.id}
                          position={[lat, lng]}
                          icon={L.divIcon({
                            html: `<div style="background:${color};color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:12px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);">${idx + 1}</div>`,
                            iconSize: [28, 28],
                            className: ''
                          })}
                        >
                          <Popup>
                            <div className="text-slate-900">
                              <div className="font-bold">Parada {idx + 1}</div>
                              <div className="text-xs">{order.customerName}</div>
                              <div className="text-xs text-slate-500">{order.address.street}</div>
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                  </MapContainer>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'finance' && (
            <motion.div key="finance" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              {/* Métricas do dia */}
              <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 space-y-4">
                <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Resumo do Dia</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Entregas</p>
                    <p className="text-2xl font-black text-white">{myCompletedToday.length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Faturado</p>
                    <p className="text-2xl font-black text-green-400">
                      R$ {myCompletedToday.reduce((acc, o) => acc + o.total, 0).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Despesas</p>
                    <p className="text-2xl font-black text-red-400">
                      - R$ {todayExpenses.reduce((acc, e) => acc + e.amount, 0).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Resultado</p>
                    <p className="text-2xl font-black text-yellow-400">
                      R$ {(myCompletedToday.reduce((acc, o) => acc + o.total, 0) - todayExpenses.reduce((acc, e) => acc + e.amount, 0)).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Despesas do dia */}
              <div>
                <p className="text-xs font-black text-slate-400 uppercase mb-3">Despesas Lançadas Hoje</p>
                <div className="space-y-2">
                  {todayExpenses.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-4">Nenhuma despesa hoje.</p>
                  ) : (
                    todayExpenses.map(e => (
                      <div key={e.id} className="bg-slate-800/50 p-4 rounded-2xl flex justify-between items-center border border-slate-800">
                        <div>
                          <p className="font-bold text-sm">{e.description}</p>
                          <p className="text-[10px] text-slate-500">{new Date(e.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <p className="font-black text-red-400">- R$ {e.amount.toFixed(2)}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <button onClick={() => setIsAddingExpense(true)} className="w-full bg-slate-800 border border-slate-700 p-4 rounded-2xl font-bold text-slate-400 hover:text-white transition-all">
                + LANÇAR DESPESA
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Button */}
      <button 
        onClick={() => setIsAddingSale(true)}
        className="fixed bottom-6 right-6 bg-yellow-400 text-slate-900 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center z-50 active:scale-90 transition-all"
      >
        <Plus className="w-8 h-8" />
      </button>

      {/* New Sale Modal */}
      <AnimatePresence>
        {isAddingSale && (
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[60] p-6 overflow-y-auto">
            <div className="max-w-md mx-auto">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black">Nova Venda</h2>
                <button onClick={() => setIsAddingSale(false)}><X className="w-8 h-8" /></button>
              </div>

              {!selectedCustomer ? (
                <div className="space-y-6">
                  <div className="relative">
                    <Search className="absolute left-4 top-4 text-slate-500 w-5 h-5" />
                    <input 
                      type="text" 
                      placeholder="Buscar cliente ou endereço..."
                      className="w-full pl-12 pr-4 py-4 bg-slate-800 rounded-2xl border-none focus:ring-2 focus:ring-yellow-400 outline-none"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="space-y-3">
                    {filteredCustomers.map(c => (
                      <button key={c.id} onClick={() => setSelectedCustomer(c)} className="w-full p-4 bg-slate-800 rounded-2xl text-left border border-slate-700 hover:border-yellow-400 transition-all">
                        <p className="font-bold">{c.name}</p>
                        <p className="text-xs text-slate-500">{c.addresses?.[0]?.street}, {c.addresses?.[0]?.number}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-slate-800 p-4 rounded-2xl flex justify-between items-center">
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase">Cliente</p>
                      <p className="font-bold">{selectedCustomer.name}</p>
                    </div>
                    <button onClick={() => setSelectedCustomer(null)} className="text-xs font-black text-yellow-400">TROCAR</button>
                  </div>

                  <div className="space-y-3">
                    {PRODUCTS.map(p => (
                      <div key={p.id} className="bg-slate-800 p-4 rounded-2xl flex items-center gap-4">
                        <img src={p.image} className="w-12 h-12 rounded-xl object-cover" />
                        <div className="flex-1">
                          <p className="font-bold text-sm">{p.name}</p>
                          <p className="font-black text-yellow-400">R$ {p.price.toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button onClick={() => setCart(prev => ({...prev, [p.id]: Math.max(0, (prev[p.id] || 0) - 1)}))} className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center"><Minus className="w-4 h-4" /></button>
                          <span className="font-bold">{cart[p.id] || 0}</span>
                          <button onClick={() => setCart(prev => ({...prev, [p.id]: (prev[p.id] || 0) + 1}))} className="w-8 h-8 rounded-full bg-yellow-400 text-slate-900 flex items-center justify-center"><Plus className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-slate-800 p-6 rounded-3xl">
                    <div className="flex justify-between items-center mb-6">
                      <span className="font-bold">TOTAL</span>
                      <span className="text-2xl font-black text-yellow-400">R$ {cartTotal.toFixed(2)}</span>
                    </div>
                    <button 
                      onClick={handleNewSale}
                      disabled={cartTotal === 0}
                      className="w-full bg-yellow-400 text-slate-900 font-black py-4 rounded-2xl disabled:opacity-50"
                    >
                      CONFIRMAR VENDA
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Expense Modal */}
      <AnimatePresence>
        {isAddingExpense && (
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[60] p-6 flex items-center justify-center">
            <div className="bg-slate-800 w-full max-w-md rounded-3xl p-8 shadow-2xl">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black">Lançar Despesa</h2>
                <button onClick={() => setIsAddingExpense(false)}><X className="w-8 h-8" /></button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                onAddExpense({
                  id: Math.random().toString(36).substr(2, 9),
                  description: formData.get('desc') as string,
                  amount: parseFloat(formData.get('amount') as string),
                  date: new Date().toISOString(),
                  category: 'Geral',
                  userId: user.id
                });
                setIsAddingExpense(false);
              }} className="space-y-4">
                <input required name="desc" placeholder="Descrição (ex: Combustível)" className="w-full p-4 bg-slate-900 rounded-2xl outline-none focus:ring-2 focus:ring-yellow-400" />
                <input required name="amount" type="number" step="0.01" placeholder="Valor (R$)" className="w-full p-4 bg-slate-900 rounded-2xl outline-none focus:ring-2 focus:ring-yellow-400" />
                <button type="submit" className="w-full bg-yellow-400 text-slate-900 font-black py-4 rounded-2xl">SALVAR DESPESA</button>
              </form>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

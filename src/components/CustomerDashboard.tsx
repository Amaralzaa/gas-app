import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  History, 
  Gift, 
  Plus, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  Package,
  Search,
  Home,
  LogOut,
  Minus,
  Truck,
  Navigation,
  User,
  Phone,
  Ticket,
  Star,
  Copy,
  Trash2,
  X,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppUser, Order, Address, Product, CoverageArea, Coupon, Reward, Referral } from '../types';
import { PRODUCTS } from '../constants';

interface CustomerDashboardProps {
  user: AppUser;
  orders: Order[];
  onOrderCreated: (order: Order) => void;
  onUpdateUser: (user: AppUser) => void;
  initialTab?: 'home' | 'history' | 'referral' | 'profile' | 'tracking';
  coverageAreas: CoverageArea[];
  coupons: Coupon[];
  rewards: Reward[];
  referrals: Referral[];
  onAddReferral: (referral: Referral) => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({ 
  user, 
  orders, 
  onOrderCreated, 
  onUpdateUser, 
  initialTab = 'home',
  coverageAreas,
  coupons,
  rewards,
  referrals,
  onAddReferral
}) => {
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'referral' | 'profile' | 'tracking'>(initialTab);
  const [step, setStep] = useState<'landing' | 'onboarding' | 'address' | 'catalog' | 'checkout' | 'status'>('landing');
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(user.addresses?.[0] || null);
  const [cart, setCart] = useState<{ [id: string]: number }>({});
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [coverageError, setCoverageError] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isDirectReferralModalOpen, setIsDirectReferralModalOpen] = useState(false);
  const [directReferralForm, setDirectReferralForm] = useState({ name: '', phone: '' });

  // Initial check for name
  useEffect(() => {
    if (!user.name || user.name === 'Cliente' || user.name.trim() === '') {
      setStep('onboarding');
    }
  }, [user.name]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Bom dia";
    if (hour >= 12 && hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  // CEP Lookup simulation
  const handleCEPLookup = async (cep: string) => {
    if (cep.length === 8) {
      setCoverageError(null);
      try {
        const response = await fetch(`/api/cep?cep=${cep}`);
        const data = await response.json();
        if (!data.erro) {
          // Precise coverage check using the official neighborhood name
          const isCovered = coverageAreas.some(area => 
            area.neighborhood.toLowerCase().trim() === data.bairro.toLowerCase().trim() &&
            area.city.toLowerCase().trim() === data.localidade.toLowerCase().trim()
          );

          if (!isCovered) {
            setCoverageError(`Desculpe, ainda não atendemos o bairro ${data.bairro}. Estamos expandindo em breve!`);
            return;
          }

          const newAddress: Address = {
            cep: data.cep,
            street: data.logradouro,
            neighborhood: data.bairro,
            city: data.localidade,
            state: data.uf,
            number: '',
          };
          
          const num = prompt("Número da residência:");
          if (num) {
            newAddress.number = num;
            const updatedUser = { ...user, addresses: [...(user.addresses || []), newAddress] };
            onUpdateUser(updatedUser);
            setSelectedAddress(newAddress);
            setStep('catalog');
          }
        }
      } catch (e) {
        console.error("CEP Lookup failed", e);
        alert("Não foi possível buscar o CEP. Verifique sua conexão.");
      }
    }
  };

  const customerOrders = orders.filter(o => o.customerId === user.id);

  const cartSubtotal = Object.entries(cart).reduce((acc, [id, qty]) => {
    const product = PRODUCTS.find(p => p.id === id);
    return acc + (product?.price || 0) * (qty as number);
  }, 0);

  const discountValue = appliedCoupon ? (
    appliedCoupon.type === 'fixed' ? appliedCoupon.value : (cartSubtotal * (appliedCoupon.value / 100))
  ) : 0;

  const cartTotal = Math.max(0, cartSubtotal - discountValue);

  const handleApplyCoupon = () => {
    setCouponError(null);
    const code = couponCode.toUpperCase();
    
    // 1. Check if it's a standard coupon
    const coupon = coupons.find(c => c.code.toUpperCase() === code);
    
    if (coupon) {
      if (!coupon.isActive) {
        setCouponError("Este cupom não está mais ativo.");
        return;
      }
      
      if (new Date(coupon.validUntil) < new Date()) {
        setCouponError("Este cupom expirou.");
        return;
      }
      
      if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
        setCouponError("Limite de uso atingido.");
        return;
      }

      if (coupon.isOneTimePerUser && user.usedCoupons?.includes(coupon.id)) {
        setCouponError("Você já utilizou este cupom.");
        return;
      }
      
      if (coupon.minOrderValue && cartSubtotal < coupon.minOrderValue) {
        setCouponError(`Mínimo: R$ ${coupon.minOrderValue.toFixed(2)}`);
        return;
      }

      setAppliedCoupon(coupon);
      setCouponCode('');
      return;
    }

    // 2. Check if it's a referral code (simulated check against all users)
    // In a real app, this would be an API call
    const savedUsers = JSON.parse(localStorage.getItem('gas_delivery_users') || '[]');
    const referrer = savedUsers.find((u: any) => u.referralCode === code && u.id !== user.id);

    if (referrer) {
      // Check if user already used a referral code or has orders
      if (customerOrders.length > 0) {
        setCouponError("Cupons de indicação são válidos apenas para o primeiro pedido.");
        return;
      }

      // Create a temporary coupon object for the referral discount
      const referralCoupon: Coupon = {
        id: `REF-${referrer.id}`,
        code: code,
        type: 'fixed',
        value: 10, // R$ 10,00 fixed discount for referee
        isActive: true,
        usageCount: 0,
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      };

      setAppliedCoupon(referralCoupon);
      setCouponCode('');
      return;
    }
    
    setCouponError("Cupom ou código de indicação inválido.");
  };

  const handleExchangePoints = (reward: Reward) => {
    if ((user.points || 0) < reward.pointsCost) {
      alert("Pontos insuficientes!");
      return;
    }

    const updatedUser = { ...user, points: (user.points || 0) - reward.pointsCost };
    onUpdateUser(updatedUser);
    alert(`Recompensa "${reward.title}" resgatada com sucesso!`);
  };

  const updateCart = (id: string, delta: number) => {
    setCart(prev => {
      const newQty = (prev[id] || 0) + delta;
      if (newQty <= 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: newQty };
    });
  };

  const handleCheckout = (paymentMethod: string) => {
    if (!selectedAddress) return;
    
    const orderId = Math.random().toString(36).substr(2, 9).toUpperCase();
    
    // If it was a referral coupon, create a referral record
    if (appliedCoupon?.id.startsWith('REF-')) {
      const referrerId = appliedCoupon.id.replace('REF-', '');
      const savedUsers = JSON.parse(localStorage.getItem('gas_delivery_users') || '[]');
      const referrer = savedUsers.find((u: any) => u.id === referrerId);
      
      if (referrer) {
        const newReferral: Referral = {
          id: Math.random().toString(36).substr(2, 9),
          referrerId: referrer.id,
          referrerName: referrer.name,
          refereeId: user.id,
          refereeName: user.name,
          refereePhone: user.phone || '',
          status: 'Pendente',
          orderId: orderId,
          pointsAwarded: 100, // 100 points for referrer upon validation
          createdAt: new Date().toISOString()
        };
        onAddReferral(newReferral);
      }
    }

    const newOrder: Order = {
      id: orderId,
      customerId: user.id,
      customerName: user.name,
      phone: user.phone || '',
      address: selectedAddress,
      items: Object.entries(cart).map(([id, qty]) => ({
        productId: id,
        quantity: qty as number,
        priceAtTime: PRODUCTS.find(p => p.id === id)?.price || 0
      })),
      total: cartTotal,
      discount: discountValue,
      couponCode: appliedCoupon?.code,
      paymentMethod,
      status: 'Pendente',
      createdAt: new Date().toISOString()
    };

    // Update user's used coupons
    if (appliedCoupon && !appliedCoupon.id.startsWith('REF-')) {
      const updatedUser = { 
        ...user, 
        usedCoupons: [...(user.usedCoupons || []), appliedCoupon.id],
        points: (user.points || 0) + Math.floor(cartTotal * 10) // 10 points per R$ 1
      };
      onUpdateUser(updatedUser);
    } else {
      const updatedUser = { 
        ...user, 
        points: (user.points || 0) + Math.floor(cartTotal * 10) 
      };
      onUpdateUser(updatedUser);
    }

    onOrderCreated(newOrder);
    setLastOrder(newOrder);
    setStep('status');
    setCart({});
    setAppliedCoupon(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <AnimatePresence mode="wait">
        {step === 'onboarding' ? (
          <motion.div key="onboarding" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-8 text-center z-[60] relative">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm">
              <div className="bg-yellow-400 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-yellow-400/20">
                <User className="text-slate-900 w-10 h-10" />
              </div>
              <h1 className="text-3xl font-black text-white mb-2">Bem-vindo!</h1>
              <p className="text-slate-400 mb-8">Para começarmos, como gostaria de ser chamado?</p>
              <input 
                type="text" 
                placeholder="Seu nome"
                className="w-full p-5 rounded-2xl bg-slate-800 text-white border-2 border-slate-700 focus:border-yellow-400 outline-none transition-all text-center text-xl font-bold"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                    onUpdateUser({ ...user, name: e.currentTarget.value.trim() });
                    setStep('landing');
                  }
                }}
              />
              <p className="text-slate-500 text-xs mt-4">Pressione Enter para continuar</p>
            </motion.div>
          </motion.div>
        ) : (
          <>
            {activeTab === 'home' && (
              <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {step === 'landing' && (
              <div className="p-6 max-w-md mx-auto space-y-8 pt-12">
                <header>
                  <h1 className="text-3xl font-black text-slate-900 leading-tight">
                    {getGreeting()}, <span className="text-yellow-500">{user.name}</span>!
                  </h1>
                  <p className="text-slate-500 font-medium mt-1">Como podemos ajudar hoje?</p>
                </header>

                <div className="grid grid-cols-1 gap-4">
                  <button 
                    onClick={() => {
                      if (user.addresses?.length) {
                        setStep('catalog');
                      } else {
                        setStep('address');
                      }
                    }}
                    className="bg-slate-900 p-6 rounded-3xl text-left flex items-center justify-between group hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10"
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-yellow-400 p-3 rounded-2xl group-hover:scale-110 transition-transform">
                        <Plus className="text-slate-900 w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-white font-black text-lg">Fazer Pedido</p>
                        <p className="text-slate-400 text-xs">Gás e água em minutos</p>
                      </div>
                    </div>
                    <ChevronRight className="text-slate-600 w-6 h-6" />
                  </button>

                  <button 
                    onClick={() => setActiveTab('tracking')}
                    className="bg-white p-6 rounded-3xl text-left flex items-center justify-between border border-slate-100 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-blue-100 p-3 rounded-2xl">
                        <Truck className="text-blue-600 w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-slate-900 font-black text-lg">Acompanhar Pedido</p>
                        <p className="text-slate-500 text-xs">Veja onde está sua entrega</p>
                      </div>
                    </div>
                    <ChevronRight className="text-slate-300 w-6 h-6" />
                  </button>

                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => setActiveTab('referral')}
                      className="bg-white p-6 rounded-3xl text-left border border-slate-100 shadow-sm hover:shadow-md transition-all"
                    >
                      <div className="bg-green-100 w-10 h-10 rounded-xl flex items-center justify-center mb-4">
                        <Gift className="text-green-600 w-5 h-5" />
                      </div>
                      <p className="text-slate-900 font-black text-sm">Benefícios</p>
                      <p className="text-slate-500 text-[10px]">Indique e ganhe</p>
                    </button>

                    <button 
                      onClick={() => alert('Funcionalidade de edição de cadastro em breve!')}
                      className="bg-white p-6 rounded-3xl text-left border border-slate-100 shadow-sm hover:shadow-md transition-all"
                    >
                      <div className="bg-slate-100 w-10 h-10 rounded-xl flex items-center justify-center mb-4">
                        <User className="text-slate-600 w-5 h-5" />
                      </div>
                      <p className="text-slate-900 font-black text-sm">Meu Perfil</p>
                      <p className="text-slate-500 text-[10px]">Editar cadastro</p>
                    </button>
                  </div>
                </div>

                <div className="bg-yellow-50 p-6 rounded-3xl border border-yellow-100">
                  <p className="text-yellow-800 font-black text-sm mb-1">Dica do dia</p>
                  <p className="text-yellow-700 text-xs leading-relaxed">Indique um amigo e ganhe R$ 5,00 de desconto na sua próxima recarga de gás!</p>
                </div>
              </div>
            )}

            {step === 'address' && (
              <div className="bg-slate-900 text-white py-12 px-6 min-h-screen">
                <button onClick={() => setStep('landing')} className="mb-8 text-slate-400 flex items-center gap-2 font-bold text-sm">
                  <ChevronRight className="w-4 h-4 rotate-180" /> VOLTAR
                </button>
                <div className="text-center">
                  <h1 className="text-3xl font-black mb-4 text-yellow-400">GÁS EXPRESS</h1>
                  <p className="text-slate-300 mb-8">Onde vamos entregar hoje?</p>
                  
                  {user.addresses?.length ? (
                    <div className="space-y-3 max-w-md mx-auto mb-6">
                      {user.addresses.map((addr, i) => (
                        <button 
                          key={i}
                          onClick={() => { setSelectedAddress(addr); setStep('catalog'); }}
                          className="w-full bg-slate-800 p-4 rounded-xl text-left flex items-center gap-3 border border-slate-700 hover:border-yellow-400 transition-all"
                        >
                          <MapPin className="text-yellow-400 w-5 h-5" />
                          <div>
                            <p className="font-bold text-sm">{addr.street}, {addr.number}</p>
                            <p className="text-xs text-slate-400">{addr.neighborhood}, {addr.city}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <div className="max-w-md mx-auto">
                    <input 
                      type="text" 
                      placeholder="Digite seu CEP para novo endereço..."
                      maxLength={8}
                      className="w-full p-5 rounded-2xl bg-white text-slate-900 shadow-2xl outline-none text-center text-xl font-bold"
                      onChange={(e) => handleCEPLookup(e.target.value)}
                    />
                    <p className="text-[10px] text-slate-500 mt-3">Digite apenas os 8 números do CEP</p>
                    
                    {coverageError && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                        <p className="text-red-400 text-sm font-bold">{coverageError}</p>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {step === 'catalog' && (
              <div className="p-4 max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <MapPin className="text-yellow-500 w-4 h-4" />
                    <span className="text-xs font-bold truncate max-w-[150px]">{selectedAddress?.street}</span>
                  </div>
                  <button onClick={() => setStep('address')} className="text-xs font-black text-slate-400">TROCAR</button>
                </div>
                <div className="space-y-4">
                  {PRODUCTS.map(p => (
                    <div key={p.id} className="bg-white p-4 rounded-2xl shadow-sm flex items-center gap-4 border border-slate-100">
                      <img src={p.image} className="w-16 h-16 rounded-xl object-cover" referrerPolicy="no-referrer" />
                      <div className="flex-1">
                        <h3 className="font-bold text-sm">{p.name}</h3>
                        <p className="text-lg font-black">R$ {p.price.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-3 bg-slate-100 rounded-full p-1">
                        <button onClick={() => updateCart(p.id, -1)} className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm"><Minus className="w-4 h-4" /></button>
                        <span className="font-bold w-4 text-center">{cart[p.id] || 0}</span>
                        <button onClick={() => updateCart(p.id, 1)} className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center shadow-sm"><Plus className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
                {cartTotal > 0 && (
                  <div className="fixed bottom-20 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-lg z-40">
                    <div className="max-w-2xl mx-auto flex items-center justify-between">
                      <p className="text-xl font-black">R$ {cartTotal.toFixed(2)}</p>
                      <button onClick={() => setStep('checkout')} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black">FINALIZAR</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 'checkout' && (
              <div className="p-6 max-w-md mx-auto space-y-6">
                <h2 className="text-2xl font-black">Finalizar Pedido</h2>
                
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Endereço de Entrega</p>
                  <p className="font-bold text-slate-900">{selectedAddress?.street}, {selectedAddress?.number}</p>
                  <p className="text-xs text-slate-500">{selectedAddress?.neighborhood}, {selectedAddress?.city}</p>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-3">Cupom de Desconto</p>
                  {!appliedCoupon ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="CÓDIGO"
                          className="flex-1 bg-slate-50 p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-yellow-400 font-black uppercase"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value)}
                        />
                        <button 
                          onClick={handleApplyCoupon}
                          className="bg-slate-900 text-white px-4 rounded-xl font-black text-xs"
                        >
                          APLICAR
                        </button>
                      </div>
                      {couponError && <p className="text-red-500 text-[10px] font-bold ml-1">{couponError}</p>}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between bg-green-50 p-3 rounded-xl border border-green-100">
                      <div className="flex items-center gap-2">
                        <Ticket className="text-green-600 w-4 h-4" />
                        <span className="font-black text-green-700">{appliedCoupon.code}</span>
                      </div>
                      <button onClick={() => setAppliedCoupon(null)} className="text-green-700"><X className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Subtotal</span>
                    <span className="font-bold">R$ {cartSubtotal.toFixed(2)}</span>
                  </div>
                  {discountValue > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Desconto</span>
                      <span className="font-bold">- R$ {discountValue.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-black pt-2 border-t border-slate-50">
                    <span>Total</span>
                    <span>R$ {cartTotal.toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase text-center mb-1">Forma de Pagamento</p>
                  <button onClick={() => handleCheckout('PIX')} className="w-full bg-slate-900 text-white p-4 rounded-2xl font-black shadow-lg hover:bg-slate-800 transition-all">PAGAR COM PIX</button>
                  <button onClick={() => handleCheckout('Cartão')} className="w-full bg-white text-slate-900 p-4 rounded-2xl font-black border border-slate-200 hover:bg-slate-50 transition-all">PAGAR NO CARTÃO</button>
                </div>
              </div>
            )}

            {step === 'status' && (
              <div className="p-12 text-center">
                <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="text-green-600 w-10 h-10" />
                </div>
                <h2 className="text-2xl font-black mb-2">Pedido Realizado!</h2>
                <p className="text-slate-500 mb-8">Seu pedido #{lastOrder?.id} está sendo processado.</p>
                <button onClick={() => { setStep('landing'); setActiveTab('history'); }} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold">VER MEUS PEDIDOS</button>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 max-w-2xl mx-auto">
            <h2 className="text-2xl font-black mb-6">Meus Pedidos</h2>
            <div className="space-y-4">
              {customerOrders.length === 0 ? (
                <p className="text-slate-400 text-center py-12">Você ainda não fez nenhum pedido.</p>
              ) : (
                customerOrders.map(o => (
                  <div key={o.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-black text-slate-400">#{o.id}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        o.status === 'Concluído' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'
                      }`}>{o.status}</span>
                    </div>
                    <p className="font-bold text-slate-900">R$ {o.total.toFixed(2)}</p>
                    <p className="text-xs text-slate-500">{new Date(o.createdAt).toLocaleDateString()}</p>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'referral' && (
          <motion.div key="referral" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 max-w-2xl mx-auto space-y-8">
            <header className="text-center">
              <div className="bg-yellow-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Gift className="text-yellow-600 w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black">Seus Benefícios</h2>
              <p className="text-slate-500">Acumule pontos e troque por recompensas exclusivas!</p>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl shadow-slate-900/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                <p className="text-xs font-bold opacity-60 uppercase tracking-widest mb-1">Saldo Atual</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black">{user.points || 0}</span>
                  <span className="text-yellow-400 font-bold">pontos</span>
                </div>
                <p className="text-[10px] mt-4 opacity-50">Ganhe 10 pontos a cada R$ 1,00 em compras.</p>
              </div>

              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-center">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Indique um amigo</p>
                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border-2 border-dashed border-slate-200">
                  <span className="text-xl font-black tracking-widest flex-1">{user.referralCode || 'GAS123'}</span>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(user.referralCode || 'GAS123');
                      alert('Código copiado!');
                    }}
                    className="bg-slate-900 text-white p-2 rounded-xl"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-3">Ambos ganham 100 pontos na primeira compra dele.</p>
                <button 
                  onClick={() => setIsDirectReferralModalOpen(true)}
                  className="mt-4 w-full bg-slate-100 text-slate-900 py-3 rounded-xl font-black text-xs hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> INDICAR DIRETAMENTE
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-black text-lg flex items-center gap-2">
                <Users className="text-yellow-500 w-5 h-5" /> Minhas Indicações
              </h3>
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                {referrals.filter(r => r.referrerId === user.id).length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-slate-400 text-sm font-bold">Você ainda não indicou ninguém.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {referrals.filter(r => r.referrerId === user.id).map(ref => (
                      <div key={ref.id} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-900">{ref.refereeName}</p>
                          <p className="text-[10px] text-slate-500">{ref.refereePhone}</p>
                        </div>
                        <div className="text-right">
                          <span className={`text-[10px] font-black px-2 py-1 rounded-full ${
                            ref.status === 'Validado' ? 'bg-green-100 text-green-700' : 
                            ref.status === 'Rejeitado' ? 'bg-red-100 text-red-700' : 
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {ref.status.toUpperCase()}
                          </span>
                          <p className="text-[9px] text-slate-400 mt-1">{new Date(ref.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-black text-lg flex items-center gap-2">
                <Star className="text-yellow-500 w-5 h-5" /> Trocar Pontos
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {rewards.map(reward => (
                  <div key={reward.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                      <div className="bg-slate-50 p-3 rounded-2xl">
                        {reward.type === 'discount' ? <Ticket className="text-blue-500 w-6 h-6" /> : <Package className="text-green-500 w-6 h-6" />}
                      </div>
                      <span className="bg-yellow-100 text-yellow-700 text-[10px] font-black px-3 py-1 rounded-full">
                        {reward.pointsCost} PTS
                      </span>
                    </div>
                    <h4 className="font-black text-slate-900">{reward.title}</h4>
                    <p className="text-xs text-slate-500 mt-1 mb-4 flex-1">{reward.description}</p>
                    <button 
                      onClick={() => handleExchangePoints(reward)}
                      disabled={(user.points || 0) < reward.pointsCost}
                      className={`w-full py-3 rounded-xl font-black text-xs transition-all ${
                        (user.points || 0) >= reward.pointsCost 
                          ? 'bg-slate-900 text-white hover:bg-slate-800' 
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      RESGATAR
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'tracking' && (
          <motion.div key="tracking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 max-w-2xl mx-auto">
            <h2 className="text-2xl font-black mb-6">Status do Pedido</h2>
            
            {(() => {
              const activeOrder = [...orders]
                .filter(o => o.customerId === user.id && o.status !== 'Concluído' && o.status !== 'Cancelado')
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

              if (!activeOrder) {
                return (
                  <div className="text-center py-12 bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Package className="text-slate-400 w-8 h-8" />
                    </div>
                    <p className="text-slate-900 font-black">Nenhum pedido ativo</p>
                    <p className="text-slate-500 text-sm mt-1 px-6">Você não possui entregas em andamento no momento.</p>
                    <button 
                      onClick={() => setActiveTab('home')} 
                      className="mt-6 bg-slate-900 text-white px-8 py-3 rounded-xl font-bold text-sm"
                    >
                      FAZER UM PEDIDO
                    </button>
                  </div>
                );
              }

              const steps = [
                { label: 'Recebido', status: 'Pendente', icon: Clock, active: true },
                { label: 'Preparando', status: 'Pendente', icon: Package, active: !!activeOrder.deliveryPersonId },
                { label: 'Em Rota', status: 'Em Rota', icon: Truck, active: activeOrder.status === 'Em Rota' },
                { label: 'Entregue', status: 'Concluído', icon: CheckCircle2, active: activeOrder.status === 'Concluído' },
              ];

              return (
                <div className="space-y-6">
                  {/* Status Timeline */}
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <div className="flex justify-between mb-8 relative">
                      <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-100 -z-0"></div>
                      {steps.map((s, i) => {
                        const isCurrent = activeOrder.status === s.status && (s.label !== 'Preparando' || activeOrder.deliveryPersonId);
                        const isPast = steps.findIndex(step => step.label === activeOrder.status) > i || (s.label === 'Recebido' && activeOrder.status !== 'Cancelado');
                        
                        return (
                          <div key={i} className="flex flex-col items-center gap-2 relative z-10">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-sm transition-colors ${
                              s.active ? 'bg-yellow-400 text-slate-900' : 'bg-slate-100 text-slate-400'
                            }`}>
                              <s.icon className="w-5 h-5" />
                            </div>
                            <span className={`text-[10px] font-black uppercase ${s.active ? 'text-slate-900' : 'text-slate-400'}`}>{s.label}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="text-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-xs font-bold text-slate-400 uppercase mb-1">Status Atual</p>
                      <h3 className="text-lg font-black text-slate-900">
                        {activeOrder.status === 'Pendente' && !activeOrder.deliveryPersonId && "Aguardando confirmação do gestor..."}
                        {activeOrder.status === 'Pendente' && activeOrder.deliveryPersonId && "Pedido aceito! O entregador está finalizando outras entregas próximas."}
                        {activeOrder.status === 'Em Rota' && "O entregador está a caminho do seu endereço!"}
                      </h3>
                    </div>
                  </div>

                  {activeOrder.status === 'Em Rota' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Previsão de Chegada (Modesta)</p>
                          <p className="text-2xl font-black text-slate-900">
                            {activeOrder.estimatedArrival 
                              ? new Date(new Date(activeOrder.estimatedArrival).getTime() + 5 * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                              : '--:--'}
                          </p>
                          <p className="text-[10px] text-yellow-600 font-bold mt-1">✓ Adicionamos 5min de margem para sua segurança</p>
                        </div>
                        <div className="bg-yellow-400 p-3 rounded-2xl">
                          <Truck className="text-slate-900 w-6 h-6" />
                        </div>
                      </div>

                      {/* Simulated Map */}
                      <div className="relative h-64 bg-slate-100 rounded-2xl overflow-hidden mb-6 border border-slate-200">
                        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                        
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                          <div className="relative">
                            <div className="absolute -inset-4 bg-yellow-400/20 rounded-full animate-ping"></div>
                            <MapPin className="text-slate-900 w-8 h-8 relative z-10" />
                          </div>
                          <p className="text-[10px] font-black bg-white px-2 py-1 rounded shadow-sm mt-1 whitespace-nowrap">Sua Casa</p>
                        </div>

                        {activeOrder.deliveryPersonLocation && (
                          <motion.div 
                            className="absolute"
                            animate={{ 
                              left: `${50 + (activeOrder.deliveryPersonLocation.lng + 46.6333) * 1000}%`,
                              top: `${50 - (activeOrder.deliveryPersonLocation.lat + 23.5505) * 1000}%`
                            }}
                            transition={{ type: 'spring', stiffness: 50 }}
                          >
                            <div className="bg-slate-900 p-2 rounded-full shadow-lg">
                              <Truck className="text-yellow-400 w-4 h-4" />
                            </div>
                            <p className="text-[10px] font-black bg-slate-900 text-white px-2 py-1 rounded shadow-sm mt-1 whitespace-nowrap">Entregador</p>
                          </motion.div>
                        )}
                      </div>

                      <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                        <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center overflow-hidden">
                          <User className="text-slate-400 w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase">Entregador em Rota</p>
                          <p className="font-black text-slate-900">Carlos Entregador</p>
                        </div>
                        <button className="ml-auto bg-white p-3 rounded-xl shadow-sm border border-slate-200">
                          <Phone className="text-slate-900 w-5 h-5" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              );
            })()}
          </motion.div>
        )}
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDirectReferralModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-xl">Indicação Direta</h3>
                <button onClick={() => setIsDirectReferralModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-6 h-6 text-slate-400" /></button>
              </div>
              <p className="text-sm text-slate-500 mb-6">Insira os dados do seu amigo. Quando ele fizer a primeira compra, você ganha pontos!</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Nome do Amigo</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Maria Silva"
                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none transition-all font-bold"
                    value={directReferralForm.name}
                    onChange={(e) => setDirectReferralForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Telefone / WhatsApp</label>
                  <input 
                    type="text" 
                    placeholder="Ex: 11999999999"
                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-yellow-400 outline-none transition-all font-bold"
                    value={directReferralForm.phone}
                    onChange={(e) => setDirectReferralForm(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
                <button 
                  onClick={() => {
                    if (!directReferralForm.name || !directReferralForm.phone) return;
                    const newReferral: Referral = {
                      id: Math.random().toString(36).substr(2, 9),
                      referrerId: user.id,
                      referrerName: user.name,
                      refereeName: directReferralForm.name,
                      refereePhone: directReferralForm.phone,
                      status: 'Pendente',
                      pointsAwarded: 100,
                      createdAt: new Date().toISOString()
                    };
                    onAddReferral(newReferral);
                    setIsDirectReferralModalOpen(false);
                    setDirectReferralForm({ name: '', phone: '' });
                    alert('Indicação enviada! Agora é só esperar seu amigo comprar.');
                  }}
                  className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-slate-800 transition-all"
                >
                  ENVIAR INDICAÇÃO
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-3 z-50">
        <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 ${activeTab === 'home' ? 'text-yellow-500' : 'text-slate-400'}`}>
          <Home className="w-6 h-6" />
          <span className="text-[10px] font-bold">Início</span>
        </button>
        <button onClick={() => setActiveTab('tracking')} className={`flex flex-col items-center gap-1 ${activeTab === 'tracking' ? 'text-yellow-500' : 'text-slate-400'}`}>
          <Navigation className="w-6 h-6" />
          <span className="text-[10px] font-bold">Rastrear</span>
          {orders.some(o => o.customerId === user.id && o.status === 'Em Rota') && (
            <span className="absolute top-2 right-1/2 translate-x-6 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          )}
        </button>
        <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center gap-1 ${activeTab === 'history' ? 'text-yellow-500' : 'text-slate-400'}`}>
          <History className="w-6 h-6" />
          <span className="text-[10px] font-bold">Pedidos</span>
        </button>
        <button onClick={() => setActiveTab('referral')} className={`flex flex-col items-center gap-1 ${activeTab === 'referral' ? 'text-yellow-500' : 'text-slate-400'}`}>
          <Gift className="w-6 h-6" />
          <span className="text-[10px] font-bold">Indicar</span>
        </button>
      </div>
    </div>
  );
};

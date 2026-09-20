/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  MapPin, 
  ShoppingCart, 
  ChevronRight, 
  Plus, 
  Minus, 
  CheckCircle2, 
  Truck, 
  LayoutDashboard, 
  User, 
  Phone, 
  CreditCard, 
  Search,
  ExternalLink,
  Clock,
  Edit2,
  Check,
  X,
  Package,
  ArrowRight,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppView, Order, OrderStatus, Product, OrderItem, AppUser, UserRole, Expense, CoverageArea, Coupon, Reward, Referral, PointHistoryItem, BenefitsConfig, BusinessInfo } from './types';
import { PRODUCTS } from './constants';
import { CustomerDashboard } from './components/CustomerDashboard';
import { ManagerDashboard } from './components/ManagerDashboard';
import { DeliveryDashboard } from './components/DeliveryDashboard';

// --- Services ---
import { authService } from './services/authService';
import { orderService } from './services/orderService';
import { userService } from './services/userService';
import { expenseService } from './services/expenseService';
import { coverageService } from './services/coverageService';
import { referralService } from './services/referralService';
import { businessService, DEFAULT_BUSINESS_INFO } from './services/businessService';
import { supabase } from './lib/supabase';
import { 
  MOCK_USERS, 
  MOCK_ORDERS, 
  MOCK_COVERAGE_AREAS, 
  MOCK_EXPENSES, 
  MOCK_COUPONS, 
  MOCK_REWARDS, 
  MOCK_REFERRALS,
  MOCK_BENEFITS_CONFIG
} from './mockData';

// --- Components ---

const LoginView = ({ onLogin, onRegister }: { onLogin: (user: AppUser) => void, onRegister: (user: AppUser) => void }) => {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loginMethod, setLoginMethod] = useState<'phone' | 'email'>('phone'); 
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let authUser: any = null;

      if (loginMethod === 'email') {
        if (!email.trim() || !password.trim()) throw new Error('E-mail e senha são obrigatórios.');
        try {
          authUser = await authService.login(email, password);
        } catch (authErr: any) {
          const found = MOCK_USERS.find(u => u.email.toLowerCase() === email.toLowerCase());
          if (found) {
            onLogin(found);
            return;
          }
          throw authErr;
        }
      } else {
        if (!phone.trim() || phone.length < 10) throw new Error('Insira um número de telefone válido com DDD.');
        const cleanPhone = phone.replace(/\D/g, '');
        
        try {
          authUser = await authService.loginWithPhone(phone);
        } catch (authErr: any) {
          throw new Error(authErr.message || 'Erro ao fazer login com este número. Verifique sua conexão.');
        }
      }

      // Directly fetch profile and set user
      if (authUser) {
        const appUser = await authService.getProfileForUser(
          authUser.id, authUser.email, authUser.user_metadata
        );
        onLogin(appUser);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao processar solicitação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8"
      >
        <div className="text-center mb-8">
          <div className="bg-yellow-400 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 rotate-3">
            <Truck className="text-slate-900 w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black text-slate-900">GÁS EXPRESS</h1>
          <p className="text-slate-500 font-medium">Acesse sua conta para continuar</p>
        </div>

        <div className="flex gap-2 mb-6 bg-slate-100 p-1 rounded-xl">
          <button 
            type="button"
            onClick={() => setLoginMethod('phone')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${loginMethod === 'phone' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            SOU CLIENTE
          </button>
          <button 
            type="button"
            onClick={() => setLoginMethod('email')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${loginMethod === 'email' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            SOU GESTOR
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {loginMethod === 'email' ? (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">E-mail</label>
                <input 
                  required
                  type="email" 
                  className="w-full p-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-yellow-400 outline-none transition-all"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Senha</label>
                <input 
                  required
                  type="password" 
                  className="w-full p-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-yellow-400 outline-none transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Seu WhatsApp</label>
              <input 
                required
                type="tel" 
                className="w-full p-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-yellow-400 outline-none transition-all"
                placeholder="(11) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              />
              <p className="text-[10px] text-slate-400 mt-2 ml-1">Enviaremos você direto para o cardápio se já tiver cadastro.</p>
            </div>
          )}

          {error && (
            <p className="text-red-500 text-xs font-bold bg-red-50 p-3 rounded-xl">{error}</p>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 text-white font-black py-4 mt-2 rounded-2xl shadow-lg hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? 'CARREGANDO...' : 'ENTRAR NO APLICATIVO'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

const Header = ({ user, onLogout }: { user: AppUser, onLogout: () => void }) => (
  <header className="bg-slate-900 text-white p-4 flex items-center justify-between sticky top-0 z-50 shadow-md">
    <div className="flex items-center gap-3">
      <div className="bg-yellow-400 p-1.5 rounded-lg">
        <Truck className="text-slate-900 w-5 h-5" />
      </div>
      <div>
        <h2 className="text-sm font-black leading-none">GÁS EXPRESS</h2>
        <p className="text-[10px] text-yellow-400 font-bold uppercase tracking-tighter">{user.role}</p>
      </div>
    </div>
    <div className="flex items-center gap-4">
      <div className="text-right hidden sm:block">
        <p className="text-xs font-bold leading-none">{user.name}</p>
      </div>
      <button 
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onLogout();
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-red-600 rounded-xl text-slate-300 hover:text-white transition-all text-xs font-bold border border-slate-700 active:scale-95 shadow-sm cursor-pointer"
        title="Sair da Conta"
      >
        <LogOut className="w-3.5 h-3.5 text-red-400" />
        <span>Sair</span>
      </button>
    </div>
  </header>
);

// --- Main App ---

export default function App() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [coverageAreas, setCoverageAreas] = useState<CoverageArea[]>(MOCK_COVERAGE_AREAS);
  const [allUsers, setAllUsers] = useState<AppUser[]>(MOCK_USERS);
  const [coupons, setCoupons] = useState<Coupon[]>(MOCK_COUPONS);
  const [rewards, setRewards] = useState<Reward[]>(() => {
    try {
      const saved = localStorage.getItem('gas_app_rewards');
      if (saved) return JSON.parse(saved);
    } catch {}
    return MOCK_REWARDS;
  });
  const [benefitsConfig, setBenefitsConfig] = useState<BenefitsConfig>(() => {
    try {
      const saved = localStorage.getItem('gas_app_benefits_config');
      if (saved) return JSON.parse(saved);
    } catch {}
    return MOCK_BENEFITS_CONFIG;
  });
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>(() => {
    try {
      const saved = localStorage.getItem('gas_app_business_settings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_BUSINESS_INFO;
  });
  const [referrals, setReferrals] = useState<Referral[]>(MOCK_REFERRALS);
  const [initialTab, setInitialTab] = useState<'home' | 'history' | 'referral' | 'profile' | 'tracking'>('home');
  const [loading, setLoading] = useState(true); // true = aguardando restauração de sessão

  // Sincronização em tempo real entre abas do navegador (Cliente <-> Gestor <-> Entregador)
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('gas_app_sync_channel');
      channel.onmessage = (event) => {
        if (event.data?.type === 'SYNC_ORDERS' && Array.isArray(event.data.orders)) {
          setOrders(event.data.orders);
        } else if (event.data?.type === 'SYNC_EXPENSES' && Array.isArray(event.data.expenses)) {
          setExpenses(event.data.expenses);
        } else if (event.data?.type === 'SYNC_BENEFITS_CONFIG' && event.data.config) {
          setBenefitsConfig(event.data.config);
        } else if (event.data?.type === 'SYNC_REWARDS' && Array.isArray(event.data.rewards)) {
          setRewards(event.data.rewards);
        } else if (event.data?.type === 'SYNC_BUSINESS_INFO' && event.data.businessInfo) {
          setBusinessInfo(event.data.businessInfo);
        }
      };
    } catch {}

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'gas_app_orders' && e.newValue) {
        try { setOrders(JSON.parse(e.newValue)); } catch {}
      }
      if (e.key === 'gas_app_expenses' && e.newValue) {
        try { setExpenses(JSON.parse(e.newValue)); } catch {}
      }
      if (e.key === 'gas_app_benefits_config' && e.newValue) {
        try { setBenefitsConfig(JSON.parse(e.newValue)); } catch {}
      }
      if (e.key === 'gas_app_rewards' && e.newValue) {
        try { setRewards(JSON.parse(e.newValue)); } catch {}
      }
      if (e.key === 'gas_app_business_settings' && e.newValue) {
        try { setBusinessInfo(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      if (channel) channel.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // ────────────────────────────────────────────────────────────────────
  // Restauração de sessão — fonte primária: onAuthStateChange
  // Garante que ao recarregar a página o usuário NÃO seja deslogado.
  // ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let authSubscription: any = null;

    // Checar parâmetros de deep-link
    const params = new URLSearchParams(window.location.search);
    const refParam = params.get('ref');
    if (refParam) {
      localStorage.setItem('gas_app_pending_ref_code', refParam.toUpperCase().trim());
    }
    const phoneParam = params.get('phone');
    if (phoneParam) {
      setInitialTab('tracking');
    }

    // Timeout de segurança: se após 6s o Supabase não respondeu, libera a tela
    const safetyTimeout = setTimeout(() => {
      if (!cancelled) {
        console.warn('Auth timeout: liberando tela de login por segurança.');
        setLoading(false);
      }
    }, 6000);

    // onAuthStateChange é o evento confiável do Supabase.
    // Dispara com INITIAL_SESSION (sessão existente) ou SIGNED_IN / SIGNED_OUT.
    try {
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (cancelled) return;

        if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
          clearTimeout(safetyTimeout);
          setLoading(false);
          return;
        }

        if (session?.user) {
          try {
            // Deep-link: login automático via phone param
            if (phoneParam && event === 'INITIAL_SESSION') {
              // Se veio pelo link de rastreamento, garante que o usuário correto seja carregado
              const linkedUser = await authService.loginWithPhone(phoneParam).catch(() => session.user);
              const appUser = await authService.getProfileForUser(
                (linkedUser || session.user).id,
                session.user.email,
                session.user.user_metadata
              );
              if (!cancelled) setCurrentUser(appUser);
            } else {
              const appUser = await authService.getProfileForUser(
                session.user.id, session.user.email, session.user.user_metadata
              );
              if (!cancelled) setCurrentUser(appUser);
            }
          } catch (profileErr) {
            console.warn('Profile fetch fallback:', profileErr);
            // Cria objeto mínimo para não bloquear acesso
            if (!cancelled) {
              setCurrentUser({
                id: session.user.id,
                email: session.user.email,
                role: (session.user.user_metadata?.role as any) || 'cliente',
                name: session.user.user_metadata?.name || 'Usuário',
                phone: session.user.user_metadata?.phone,
                points: 0,
                addresses: [],
                allowedTabs: []
              });
            }
          } finally {
            clearTimeout(safetyTimeout);
            if (!cancelled) setLoading(false);
          }
        } else {
          // Sem sessão — mostra tela de login
          clearTimeout(safetyTimeout);
          if (!cancelled) setLoading(false);
        }
      });
      authSubscription = data?.subscription;
    } catch (e) {
      console.warn('onAuthStateChange indisponível:', e);
      clearTimeout(safetyTimeout);
      if (!cancelled) setLoading(false);
    }

    return () => {
      cancelled = true;
      clearTimeout(safetyTimeout);
      if (authSubscription && typeof authSubscription.unsubscribe === 'function') {
        authSubscription.unsubscribe();
      }
    };
  }, []);


  // Fetch initial data when user is logged in and maintain live polling
  useEffect(() => {
    if (currentUser) {
      loadData();
      
      // Polling contínuo a cada 2 segundos para sincronizar pedidos novos em tempo real entre todos os dispositivos
      const pollInterval = setInterval(() => {
        loadData();
      }, 2000);

      try {
        const orderSub = orderService.subscribeToOrders(() => {
          loadData();
        });

        return () => {
          clearInterval(pollInterval);
          if (orderSub && orderSub.unsubscribe) orderSub.unsubscribe();
        };
      } catch (subErr) {
        console.warn('Realtime subscription offline:', subErr);
        return () => clearInterval(pollInterval);
      }
    }
  }, [currentUser]);

  const loadData = async () => {
    try {
      const [fetchedOrders, fetchedExpenses, fetchedUsers, fetchedCoverage, fetchedReferrals, fetchedBusiness] = await Promise.all([
        orderService.getOrders().catch(() => []),
        expenseService.getExpenses().catch(() => []),
        userService.getProfiles().catch(() => []),
        coverageService.getCoverageAreas().catch(() => []),
        referralService.getReferrals().catch(() => []),
        businessService.getBusinessInfo().catch(() => DEFAULT_BUSINESS_INFO)
      ]);
      setOrders(fetchedOrders || []);
      localStorage.setItem('gas_app_orders', JSON.stringify(fetchedOrders || []));

      setExpenses(fetchedExpenses || []);
      localStorage.setItem('gas_app_expenses', JSON.stringify(fetchedExpenses || []));

      setAllUsers(fetchedUsers && fetchedUsers.length > 0 ? fetchedUsers : MOCK_USERS);
      setReferrals(fetchedReferrals || []);
      if (fetchedCoverage && fetchedCoverage.length > 0) {
        setCoverageAreas(fetchedCoverage);
      }
      if (fetchedBusiness) {
        setBusinessInfo(fetchedBusiness);
      }
    } catch (err) {
      console.warn('Usando dados sincronizados locais:', err);
    }
  };

  const handleUpdateBusinessInfo = async (newInfo: BusinessInfo) => {
    setBusinessInfo(newInfo);
    try {
      await businessService.saveBusinessInfo(newInfo);
    } catch (err) {
      console.warn('Erro ao persistir businessInfo:', err);
    }
  };

  const handleLogout = async () => {
    // 1. Desconecta o estado React imediatamente para voltar à tela de login sem travar
    setCurrentUser(null);

    // 2. Limpa todos os tokens de autenticação do localStorage e sessionStorage
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.includes('auth') || key.includes('supabase') || key.startsWith('gas_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      sessionStorage.clear();

    } catch (err) {
      console.warn('Erro ao limpar storage de auth:', err);
    }

    // 3. Chama o signOut do Supabase em segundo plano com timeout para não prender
    try {
      await Promise.race([
        authService.signOut(),
        new Promise(res => setTimeout(res, 500))
      ]);
    } catch (e) {
      console.warn('Logout fallback:', e);
    }
  };

  const handleOrderCreated = async (newOrder: Order) => {
    const localCreated: Order = { 
      ...newOrder, 
      id: newOrder.id || 'PED-' + Math.floor(100 + Math.random() * 900) 
    };

    setOrders(prev => {
      const updated = [localCreated, ...prev.filter(o => o.id !== localCreated.id)];
      try {
        localStorage.setItem('gas_app_orders', JSON.stringify(updated));
        const ch = new BroadcastChannel('gas_app_sync_channel');
        ch.postMessage({ type: 'SYNC_ORDERS', orders: updated });
        ch.close();
      } catch {}
      return updated;
    });

    try {
      await orderService.createOrder(newOrder);
    } catch (err: any) {
      console.warn('Sincronização offline: pedido salvo no banco local compartilhado.');
    }
  };

  const handleUpdateOrder = async (updatedOrder: Order) => {
    const prevOrder = orders.find(o => o.id === updatedOrder.id);
    const isNowCompleted = updatedOrder.status === 'Concluído' && prevOrder?.status !== 'Concluído';

    setOrders(prev => {
      const updated = prev.map(o => o.id === updatedOrder.id ? updatedOrder : o);
      try {
        localStorage.setItem('gas_app_orders', JSON.stringify(updated));
        const ch = new BroadcastChannel('gas_app_sync_channel');
        ch.postMessage({ type: 'SYNC_ORDERS', orders: updated });
        ch.close();
      } catch {}
      return updated;
    });

    try {
      await orderService.updateOrder(updatedOrder.id, updatedOrder);
    } catch (err) {
      console.warn('Sincronização offline: atualização salva no banco local compartilhado.');
    }

    // REGRA DE PONTOS: Concedidos exclusivamente quando o pedido atinge status Concluído!
    if (isNowCompleted) {
      const multiplier = benefitsConfig?.pointsPerCurrency ?? 10;
      const earnedPoints = Math.floor(updatedOrder.total * multiplier);

      // 1. Creditar pontos na conta do cliente da compra
      const customer = allUsers.find(u => u.id === updatedOrder.customerId);
      if (customer) {
        const historyItem: PointHistoryItem = {
          id: Math.random().toString(36).substr(2, 9),
          userId: customer.id,
          type: 'earned_order',
          points: earnedPoints,
          description: `Compra concluída (Pedido #${updatedOrder.id})`,
          orderId: updatedOrder.id,
          createdAt: new Date().toISOString()
        };
        const updatedCustomer: AppUser = {
          ...customer,
          points: (customer.points || 0) + earnedPoints,
          pointHistory: [historyItem, ...(customer.pointHistory || [])]
        };
        await handleUpdateUser(updatedCustomer);
      }

      // 2. Se foi utilizado um código de indicação / cupom de amigo, bonificar o indicador
      if (updatedOrder.couponCode) {
        const matchingReferrer = allUsers.find(u => 
          u.referralCode && u.referralCode.toUpperCase() === updatedOrder.couponCode?.toUpperCase() && 
          u.id !== updatedOrder.customerId
        );
        if (matchingReferrer) {
          // VERIFICAÇÃO RIGOROSA: Deve ser a PRIMEIRA compra concluída do cliente indicado!
          const cleanOrderPhone = (updatedOrder.phone || '').replace(/\D/g, '');
          const previousCompletedOrders = orders.filter(o => 
            (o.customerId === updatedOrder.customerId || (cleanOrderPhone && o.phone?.replace(/\D/g, '') === cleanOrderPhone)) &&
            o.status === 'Concluído' && 
            o.id !== updatedOrder.id
          );

          if (previousCompletedOrders.length === 0) {
            const referralBonus = benefitsConfig?.referralPointsAwarded ?? 100;
            const referrerHistoryItem: PointHistoryItem = {
              id: Math.random().toString(36).substr(2, 9),
              userId: matchingReferrer.id,
              type: 'referral_bonus',
              points: referralBonus,
              description: `Bônus por indicação de ${updatedOrder.customerName || 'Amigo'} (1ª Compra Concluída)`,
              orderId: updatedOrder.id,
              createdAt: new Date().toISOString()
            };
            const updatedReferrer: AppUser = {
              ...matchingReferrer,
              points: (matchingReferrer.points || 0) + referralBonus,
              pointHistory: [referrerHistoryItem, ...(matchingReferrer.pointHistory || [])]
            };
            await handleUpdateUser(updatedReferrer);

            // Atualiza status da indicação na tabela de referrals de 'Pendente' para 'Confirmado'
            const matchingRef = referrals.find(r => 
              (r.orderId === updatedOrder.id) ||
              (r.referrerId === matchingReferrer.id && (
                (r.refereeId && r.refereeId === updatedOrder.customerId) ||
                (cleanOrderPhone && r.refereePhone.replace(/\D/g, '') === cleanOrderPhone) ||
                r.refereeName.toLowerCase() === (updatedOrder.customerName || '').toLowerCase()
              ))
            );
            if (matchingRef) {
              try {
                await referralService.updateReferralStatus(matchingRef.id, 'Confirmado', new Date().toISOString());
                setReferrals(prev => prev.map(r => r.id === matchingRef.id ? { 
                  ...r, 
                  status: 'Confirmado', 
                  validatedAt: new Date().toISOString(), 
                  orderId: updatedOrder.id 
                } : r));
              } catch (err) {
                console.warn('Erro ao atualizar referral:', err);
              }
            }
          }
        }
      }
    }
  };

  const handleUpdateUser = async (updatedUser: AppUser) => {
    try {
      await userService.updateProfile(updatedUser.id, updatedUser);
      setAllUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
      if (currentUser?.id === updatedUser.id) {
        setCurrentUser(updatedUser);
      }
    } catch (err) {
      console.error('Error updating user profile:', err);
    }
  };

  const handleAddExpense = async (expense: Expense) => {
    setExpenses(prev => {
      const updated = [expense, ...prev];
      try {
        localStorage.setItem('gas_app_expenses', JSON.stringify(updated));
        const ch = new BroadcastChannel('gas_app_sync_channel');
        ch.postMessage({ type: 'SYNC_EXPENSES', expenses: updated });
        ch.close();
      } catch {}
      return updated;
    });

    try {
      await expenseService.addExpense(expense);
    } catch (err) {
      console.error('Error adding expense:', err);
    }
  };

  const handleAddReferral = async (referral: Referral) => {
    try {
      const added = await referralService.addReferral(referral);
      setReferrals(prev => [added, ...prev]);
    } catch (err) {
      console.error('Error adding referral:', err);
      // Fallback local se a tabela referrals não existir no banco
      setReferrals(prev => [referral, ...prev]);
    }
  };

  const handleDeleteReferral = async (id: string) => {
    setReferrals(prev => prev.filter(r => r.id !== id));
    try {
      await referralService.deleteReferral(id);
    } catch (err) {
      console.warn('Fallback offline para exclusão de indicação');
    }
  };

  const handleUpdateReferral = async (updatedRef: Referral) => {
    setReferrals(prev => prev.map(r => r.id === updatedRef.id ? updatedRef : r));
    try {
      await referralService.updateReferralStatus(updatedRef.id, updatedRef.status, updatedRef.validatedAt);
    } catch (err) {
      console.warn('Fallback offline para atualização de indicação');
    }
  };

  const handleUpdateReferrals = async (updatedReferrals: Referral[]) => {
    setReferrals(updatedReferrals);
  };

  const handleUpdateBenefitsConfig = (newConfig: BenefitsConfig) => {
    setBenefitsConfig(newConfig);
    try {
      localStorage.setItem('gas_app_benefits_config', JSON.stringify(newConfig));
      const ch = new BroadcastChannel('gas_app_sync_channel');
      ch.postMessage({ type: 'SYNC_BENEFITS_CONFIG', config: newConfig });
      ch.close();
    } catch {}
  };

  const handleUpdateRewards = (newRewards: Reward[]) => {
    setRewards(newRewards);
    try {
      localStorage.setItem('gas_app_rewards', JSON.stringify(newRewards));
      const ch = new BroadcastChannel('gas_app_sync_channel');
      ch.postMessage({ type: 'SYNC_REWARDS', rewards: newRewards });
      ch.close();
    } catch {}
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-4">
        <div className="bg-yellow-400 w-16 h-16 rounded-2xl flex items-center justify-center rotate-3 animate-pulse">
          <Truck className="text-slate-900 w-10 h-10" />
        </div>
        <p className="font-black text-xl tracking-widest">GÁS EXPRESS</p>
        <p className="text-slate-400 text-sm font-medium animate-pulse">Verificando sessão...</p>
      </div>
    );
  }


  if (!currentUser) {
    return <LoginView onLogin={(user) => setCurrentUser(user)} onRegister={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="font-sans text-slate-900 min-h-screen flex flex-col">
      <Header user={currentUser} onLogout={handleLogout} />
      
      <main className="flex-1 overflow-auto">
        <AnimatePresence mode="wait">
          {currentUser.role === 'cliente' && (
            <motion.div key="cliente" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <CustomerDashboard 
                user={currentUser} 
                orders={orders} 
                onOrderCreated={handleOrderCreated} 
                onUpdateUser={handleUpdateUser} 
                onUpdateOrder={handleUpdateOrder}
                initialTab={initialTab}
                coverageAreas={coverageAreas}
                coupons={coupons}
                rewards={rewards}
                referrals={referrals}
                onAddReferral={handleAddReferral}
                onUpdateReferral={handleUpdateReferral}
                onDeleteReferral={handleDeleteReferral}
                allUsers={allUsers}
                allDeliveryPersons={allUsers.filter(u => u.role === 'entregador')}
                benefitsConfig={benefitsConfig}
                onLogout={handleLogout}
                businessInfo={businessInfo}
              />
            </motion.div>
          )}
          
          {(currentUser.role === 'gestor' || currentUser.role === 'admin') && (
            <motion.div key="gestor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ManagerDashboard 
                user={currentUser}
                orders={orders} 
                onUpdateOrder={handleUpdateOrder} 
                onAddOrder={handleOrderCreated}
                deliveryPersons={allUsers.filter(u => u.role === 'entregador')} 
                allCustomers={allUsers.filter(u => u.role === 'cliente')}
                allCollaborators={allUsers.filter(u => u.role === 'gestor' || u.role === 'admin' || u.role === 'entregador')}
                expenses={expenses}
                coverageAreas={coverageAreas}
                onUpdateCoverage={(areas) => {
                  setCoverageAreas(areas);
                  coverageService.saveCoverageAreas(areas).catch(err => console.error('Error saving coverage:', err));
                }}
                coupons={coupons}
                onUpdateCoupons={setCoupons}
                rewards={rewards}
                onUpdateRewards={handleUpdateRewards}
                referrals={referrals}
                onUpdateReferrals={handleUpdateReferrals}
                onUpdateUser={handleUpdateUser}
                benefitsConfig={benefitsConfig}
                onUpdateBenefitsConfig={handleUpdateBenefitsConfig}
                onLogout={handleLogout}
                onRefreshData={loadData}
                businessInfo={businessInfo}
                onUpdateBusinessInfo={handleUpdateBusinessInfo}
              />
            </motion.div>
          )}
          
          {currentUser.role === 'entregador' && (
            <motion.div key="entregador" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <DeliveryDashboard 
                user={currentUser} 
                orders={orders.filter(o => o.deliveryPersonId === currentUser.id)} 
                onUpdateOrder={handleUpdateOrder} 
                onAddOrder={handleOrderCreated}
                onAddExpense={handleAddExpense}
                onUpdateUser={handleUpdateUser}
                expenses={expenses}
                allCustomers={allUsers.filter(u => u.role === 'cliente')}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

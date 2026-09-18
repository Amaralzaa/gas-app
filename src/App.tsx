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
import { AppView, Order, OrderStatus, Product, OrderItem, AppUser, UserRole, Expense, CoverageArea, Coupon, Reward, Referral, PointHistoryItem, BenefitsConfig } from './types';
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
        try {
          authUser = await authService.loginWithPhone(phone);
        } catch (authErr: any) {
          const cleanPhone = phone.replace(/\D/g, '');
          const found = MOCK_USERS.find(u => u.phone === cleanPhone) || {
            ...MOCK_USERS[3],
            phone: cleanPhone,
            name: 'Cliente Teste'
          };
          onLogin(found);
          return;
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

        <div className="mt-6 pt-5 border-t border-slate-100">
          <p className="text-[11px] text-slate-400 text-center font-black uppercase tracking-wider mb-3">
            Acesso Rápido para Testes Locais
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => onLogin(MOCK_USERS[0])}
              className="p-2.5 bg-yellow-50 hover:bg-yellow-100 text-yellow-900 rounded-xl text-xs font-black text-center border border-yellow-200 transition-all hover:scale-[1.02] active:scale-95"
            >
              👔 Gestor
            </button>
            <button
              type="button"
              onClick={() => onLogin(MOCK_USERS[1])}
              className="p-2.5 bg-blue-50 hover:bg-blue-100 text-blue-900 rounded-xl text-xs font-black text-center border border-blue-200 transition-all hover:scale-[1.02] active:scale-95"
            >
              🛵 Entregador
            </button>
            <button
              type="button"
              onClick={() => onLogin(MOCK_USERS[3])}
              className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded-xl text-xs font-black text-center border border-emerald-200 transition-all hover:scale-[1.02] active:scale-95"
            >
              🛒 Cliente
            </button>
          </div>
        </div>
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
        onClick={onLogout}
        className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
        title="Sair"
      >
        <LogOut className="w-5 h-5" />
      </button>
    </div>
  </header>
);

// --- Main App ---

export default function App() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem('gas_app_orders');
      if (saved) return JSON.parse(saved);
    } catch {}
    return MOCK_ORDERS;
  });
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    try {
      const saved = localStorage.getItem('gas_app_expenses');
      if (saved) return JSON.parse(saved);
    } catch {}
    return MOCK_EXPENSES;
  });
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
  const [referrals, setReferrals] = useState<Referral[]>(MOCK_REFERRALS);
  const [initialTab, setInitialTab] = useState<'home' | 'history' | 'referral' | 'profile' | 'tracking'>('home');
  const [loading, setLoading] = useState(false);

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
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      if (channel) channel.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Sync Auth State — check existing session on mount
  useEffect(() => {
    let cancelled = false;

    // Check for existing session with strict 500ms timeout
    const initSession = async () => {
      try {
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
          setTimeout(() => resolve({ data: { session: null } }), 500)
        );
        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);
        if (session?.user && !cancelled) {
          try {
            const appUser = await authService.getProfileForUser(
              session.user.id, session.user.email, session.user.user_metadata
            );
            setCurrentUser(appUser);
          } catch (profileErr) {
            console.warn('Profile fetch offline fallback:', profileErr);
          }
        }
      } catch (err) {
        console.warn('Sessão offline:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // Handle deep-link / auto-login via ?phone= or referral via ?ref=
    const params = new URLSearchParams(window.location.search);
    const refParam = params.get('ref');
    if (refParam) {
      localStorage.setItem('gas_app_pending_ref_code', refParam.toUpperCase().trim());
    }

    const phoneParam = params.get('phone');
    if (phoneParam) {
      setInitialTab('tracking');
      setLoading(true);
      authService.loginWithPhone(phoneParam)
        .then(async (user) => {
          if (user && !cancelled) {
            const appUser = await authService.getProfileForUser(
              user.id, user.email, user.user_metadata
            );
            setCurrentUser(appUser);
          }
        })
        .catch(err => console.error('Auto-login failed:', err))
        .finally(() => { if (!cancelled) setLoading(false); });
    } else {
      initSession();
    }

    // Listen for sign-out events only (safely)
    let subscription: any = null;
    try {
      const authRes = supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
        }
      });
      subscription = authRes?.data?.subscription;
    } catch (e) {
      console.warn('onAuthStateChange offline:', e);
    }

    return () => {
      cancelled = true;
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    };
  }, []);

  // Fetch initial data when user is logged in
  useEffect(() => {
    if (currentUser) {
      loadData();
      
      try {
        const orderSub = orderService.subscribeToOrders(() => {
          loadData();
        });

        return () => {
          if (orderSub && orderSub.unsubscribe) orderSub.unsubscribe();
        };
      } catch (subErr) {
        console.warn('Realtime subscription offline:', subErr);
      }
    }
  }, [currentUser]);

  const loadData = async () => {
    try {
      const [fetchedOrders, fetchedExpenses, fetchedUsers, fetchedCoverage, fetchedReferrals] = await Promise.all([
        orderService.getOrders().catch(() => []),
        expenseService.getExpenses().catch(() => []),
        userService.getProfiles().catch(() => []),
        coverageService.getCoverageAreas().catch(() => []),
        referralService.getReferrals().catch(() => [])
      ]);
      if (fetchedOrders && fetchedOrders.length > 0) {
        setOrders(fetchedOrders);
        localStorage.setItem('gas_app_orders', JSON.stringify(fetchedOrders));
      } else {
        const saved = localStorage.getItem('gas_app_orders');
        if (saved) {
          try { setOrders(JSON.parse(saved)); } catch { setOrders(MOCK_ORDERS); }
        } else {
          setOrders(MOCK_ORDERS);
          localStorage.setItem('gas_app_orders', JSON.stringify(MOCK_ORDERS));
        }
      }

      if (fetchedExpenses && fetchedExpenses.length > 0) {
        setExpenses(fetchedExpenses);
        localStorage.setItem('gas_app_expenses', JSON.stringify(fetchedExpenses));
      } else {
        const saved = localStorage.getItem('gas_app_expenses');
        if (saved) {
          try { setExpenses(JSON.parse(saved)); } catch { setExpenses(MOCK_EXPENSES); }
        } else {
          setExpenses(MOCK_EXPENSES);
          localStorage.setItem('gas_app_expenses', JSON.stringify(MOCK_EXPENSES));
        }
      }

      setAllUsers(fetchedUsers && fetchedUsers.length > 0 ? fetchedUsers : MOCK_USERS);
      setReferrals(fetchedReferrals && fetchedReferrals.length > 0 ? fetchedReferrals : MOCK_REFERRALS);
      setCoverageAreas(fetchedCoverage && fetchedCoverage.length > 0 ? fetchedCoverage : MOCK_COVERAGE_AREAS);
      setCoupons(MOCK_COUPONS);
      setRewards(MOCK_REWARDS);
    } catch (err) {
      console.warn('Usando dados sincronizados locais:', err);
    }
  };

  const handleLogout = async () => {
    try {
      await authService.signOut();
    } catch (e) {
      console.warn('Logout fallback:', e);
    }
    setCurrentUser(null);
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
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white font-bold">CARREGANDO SISTEMA...</div>;
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

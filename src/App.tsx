/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { AppView, Address, Order, OrderStatus, Product, OrderItem, AppUser, UserRole, Expense, CoverageArea, Coupon, Reward, Referral, PointHistoryItem, BenefitsConfig, BusinessInfo } from './types';
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
import { productService } from './services/productService';
import { codeService } from './services/codeService';
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

type LoginIntent = 'cliente' | 'equipe';

/** Reservado para o login de cliente por e-mail. Ainda sem tela. */
type CustomerCredential =
  | { method: 'phone'; phone: string }
  | { method: 'email'; email: string; password: string };

function loginPathFromLocation(): LoginIntent {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  return path === '/equipe' ? 'equipe' : 'cliente';
}

async function authenticateCustomer(credential: CustomerCredential) {
  if (credential.method === 'email') {
    throw new Error('Login de cliente por e-mail ainda não está disponível.');
  }
  const cleanPhone = credential.phone.replace(/\D/g, '');
  if (!cleanPhone || cleanPhone.length < 10) {
    throw new Error('Insira um número de telefone válido com DDD.');
  }
  const authUser = await authService.loginWithPhone(cleanPhone);
  if (!authUser || !('id' in authUser)) throw new Error('Não foi possível entrar.');
  return authUser;
}

function goToLoginPath(path: '/equipe' | '/') {
  if (window.location.pathname !== path) {
    window.history.pushState({}, '', path);
  }
  window.dispatchEvent(new PopStateEvent('popstate'));
}

const LoginBrand = ({ businessInfo }: { businessInfo?: BusinessInfo }) => (
  <div className="text-center mb-8">
    {businessInfo?.logoUrl ? (
      <div className="w-20 h-20 mx-auto rounded-3xl overflow-hidden border-2 border-yellow-400 bg-white flex items-center justify-center mb-4 shadow-xl">
        <img src={businessInfo.logoUrl} alt={businessInfo.name || 'Logo'} className="w-full h-full object-cover" />
      </div>
    ) : (
      <div className="bg-yellow-400 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 rotate-3 shadow-lg">
        <Truck className="text-slate-900 w-10 h-10" />
      </div>
    )}
    <h1 className="text-3xl font-black text-slate-900 uppercase leading-tight">
      {businessInfo?.name || 'GÁS EXPRESS'}
    </h1>
  </div>
);

const LoginView = ({
  intent,
  businessInfo,
  onAuthenticate,
  onDemoLogin,
}: {
  intent: LoginIntent;
  businessInfo?: BusinessInfo;
  onAuthenticate: (intent: LoginIntent, authUser: { id: string; email?: string; user_metadata?: any }) => Promise<void>;
  onDemoLogin?: (user: AppUser) => void;
}) => {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showTeamLink, setShowTeamLink] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setShowTeamLink(false);
    setLoading(true);

    try {
      if (intent === 'equipe') {
        if (!email.trim() || !password.trim()) throw new Error('E-mail e senha são obrigatórios.');
        const authUser = await authService.login(email.trim(), password);
        if (!authUser || !('id' in authUser)) throw new Error('Não foi possível entrar.');
        await onAuthenticate('equipe', authUser);
        return;
      }

      const credential: CustomerCredential = { method: 'phone', phone };
      const authUser = await authenticateCustomer(credential);
      await onAuthenticate('cliente', authUser);
    } catch (err: any) {
      if (err?.teamAccess) setShowTeamLink(true);
      setError(err.message || 'Erro ao processar solicitação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full w-full bg-slate-900 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 sm:p-8"
      >
        <LoginBrand businessInfo={businessInfo} />
        <p className="text-slate-500 font-medium text-center -mt-4 mb-6">
          {intent === 'equipe' ? 'Acesso da equipe' : 'Acesse sua conta para continuar'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {intent === 'equipe' ? (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">E-mail</label>
                <input
                  required
                  type="email"
                  autoComplete="username"
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
                  autoComplete="current-password"
                  className="w-full p-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-yellow-400 outline-none transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-[10px] text-slate-400 mt-2 ml-1">Gestor e entregador entram com e-mail e senha. O acesso segue o cadastro.</p>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Seu WhatsApp</label>
              <input
                required
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                className="w-full p-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-yellow-400 outline-none transition-all"
                placeholder="(21) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              />
              <p className="text-[10px] text-slate-400 mt-2 ml-1">Cliente entra com o WhatsApp. Se já tiver cadastro, vai direto ao cardápio.</p>
            </div>
          )}

          {error && (
            <div className="text-red-600 text-xs font-bold bg-red-50 p-3 rounded-xl space-y-2">
              <p>{error}</p>
              {showTeamLink && (
                <a href="/equipe" onClick={(e) => { e.preventDefault(); goToLoginPath('/equipe'); }} className="inline-block text-slate-700 underline">
                  Ir para o acesso da equipe
                </a>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 text-white font-black py-4 mt-2 rounded-2xl shadow-lg hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'CARREGANDO...' : 'ENTRAR NO APLICATIVO'}
          </button>

          {intent === 'cliente' ? (
            <p className="text-center pt-3">
              <a
                href="/equipe"
                onClick={(e) => { e.preventDefault(); goToLoginPath('/equipe'); }}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Entrar como equipe
              </a>
            </p>
          ) : (
            <p className="text-center pt-3">
              <a
                href="/"
                onClick={(e) => { e.preventDefault(); goToLoginPath('/'); }}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Voltar ao login do cliente
              </a>
            </p>
          )}

          {import.meta.env.DEV && intent === 'cliente' && onDemoLogin && (
            <div className="pt-4 border-t border-slate-100 text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Acesso Rápido para Demonstração</p>
              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={() => { const gestor = MOCK_USERS.find(u => u.role === 'gestor'); if (gestor) onDemoLogin(gestor); }} className="py-2.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-[11px] font-black">Gestor</button>
                <button type="button" onClick={() => { const entregador = MOCK_USERS.find(u => u.role === 'entregador'); if (entregador) onDemoLogin(entregador); }} className="py-2.5 px-2 bg-blue-100 hover:bg-blue-200 text-blue-900 rounded-xl text-[11px] font-black">Entregador</button>
                <button type="button" onClick={() => { const cliente = MOCK_USERS.find(u => u.role === 'cliente'); if (cliente) onDemoLogin(cliente); }} className="py-2.5 px-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-900 rounded-xl text-[11px] font-black">Cliente</button>
              </div>
            </div>
          )}
        </form>
      </motion.div>
    </div>
  );
};

const Header = ({ 
  user, 
  businessInfo, 
  onLogout 
}: { 
  user: AppUser; 
  businessInfo?: BusinessInfo; 
  onLogout: () => void; 
}) => {
  const companyName = businessInfo?.name?.trim() || 'GÁS EXPRESS';
  const logoUrl = businessInfo?.logoUrl;

  return (
    <header className="bg-slate-900 text-white px-4 py-3 sm:px-6 sm:py-3.5 flex items-center justify-between sticky top-0 z-50 shadow-md border-b border-slate-800/80">
      <div className="flex items-center gap-3 min-w-0">
        {logoUrl ? (
          <div className="w-10 h-10 rounded-2xl overflow-hidden border-2 border-yellow-400 bg-white flex items-center justify-center shrink-0 shadow-md">
            <img 
              src={logoUrl} 
              alt={companyName} 
              className="w-full h-full object-cover" 
            />
          </div>
        ) : (
          <div className="bg-yellow-400 p-2 rounded-xl shrink-0 shadow-sm">
            <Truck className="text-slate-900 w-5 h-5" />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-black leading-tight uppercase tracking-tight truncate">
            {companyName}
          </h2>
          <p className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider">
            {user.role}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        <div className="text-right hidden sm:block">
          <p className="text-xs font-bold leading-none text-slate-200">{user.name}</p>
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
};

// --- Main App ---

export default function App() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [coverageAreas, setCoverageAreas] = useState<CoverageArea[]>(MOCK_COVERAGE_AREAS);
  const [allUsers, setAllUsers] = useState<AppUser[]>(MOCK_USERS);
  const [coupons, setCoupons] = useState<Coupon[]>(import.meta.env.DEV ? MOCK_COUPONS : []);
  const [rewards, setRewards] = useState<Reward[]>(() => {
    try {
      const saved = localStorage.getItem('gas_app_rewards');
      if (saved) return JSON.parse(saved);
    } catch {}
    return import.meta.env.DEV ? MOCK_REWARDS : [];
  });
  const [benefitsConfig, setBenefitsConfig] = useState<BenefitsConfig>(() => {
    try {
      const saved = localStorage.getItem('gas_app_benefits_config');
      if (saved) return JSON.parse(saved);
    } catch {}
    return import.meta.env.DEV
      ? MOCK_BENEFITS_CONFIG
      : { referralDiscountValue: 0, referralPointsAwarded: 0, pointsPerCurrency: 0, referralMinOrderValue: 0 };
  });
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>(() => {
    try {
      const saved = localStorage.getItem('gas_app_business_settings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_BUSINESS_INFO;
  });
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('gas_app_products');
      if (saved) return JSON.parse(saved);
    } catch {}
    return PRODUCTS;
  });
  const [referrals, setReferrals] = useState<Referral[]>(MOCK_REFERRALS);
  const [initialTab, setInitialTab] = useState<'home' | 'history' | 'referral' | 'profile' | 'tracking'>('home');
  const [loading, setLoading] = useState(true); // true = aguardando restauração de sessão
  const [loginIntent, setLoginIntent] = useState<LoginIntent>(loginPathFromLocation);
  const formLoginActive = useRef(false);
  const blockedSessionUserId = useRef<string | null>(null);

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
        } else if (event.data?.type === 'SYNC_PRODUCTS' && Array.isArray(event.data.products)) {
          setProducts(event.data.products);
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
      if (e.key === 'gas_app_products' && e.newValue) {
        try { setProducts(JSON.parse(e.newValue)); } catch {}
      }
    };
    const handleCustomBusinessUpdate = (e: any) => {
      if (e.detail) {
        setBusinessInfo(e.detail);
      }
    };
    const handleCustomProductsUpdate = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setProducts(e.detail);
      }
    };
    window.addEventListener('gas_app_business_info_updated', handleCustomBusinessUpdate);
    window.addEventListener('gas_app_products_updated', handleCustomProductsUpdate);

    return () => {
      if (channel) channel.close();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('gas_app_business_info_updated', handleCustomBusinessUpdate);
      window.removeEventListener('gas_app_products_updated', handleCustomProductsUpdate);
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
          // Não consultar o banco dentro do callback: o cliente trava o lock de auth.
          const su = session.user;
          setTimeout(async () => {
            if (cancelled) return;
            if (formLoginActive.current || blockedSessionUserId.current === su.id) {
              clearTimeout(safetyTimeout);
              if (!cancelled) setLoading(false);
              return;
            }
          try {
            let userId = su.id;
            let userEmail = su.email;
            let userMeta = su.user_metadata;
            if (phoneParam && event === 'INITIAL_SESSION') {
              const linkedUser = await authService.loginWithPhone(phoneParam).catch(() => null);
              if (linkedUser) {
                userId = linkedUser.id;
                userEmail = linkedUser.email;
                userMeta = linkedUser.user_metadata;
              }
            }
            const appUser = await authService.loadConfirmedProfile(userId, userEmail, userMeta);
            if (cancelled || formLoginActive.current || blockedSessionUserId.current === userId) return;
            if (!appUser) {
              await authService.signOut();
              return;
            }
            setCurrentUser({
              ...appUser,
              referralCode: appUser.referralCode || codeService.getUserReferralCode(appUser)
            });
          } catch (profileErr) {
            console.warn('Profile fetch:', profileErr);
          } finally {
            clearTimeout(safetyTimeout);
            if (!cancelled) setLoading(false);
          }
          }, 0);
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

    const onPopState = () => setLoginIntent(loginPathFromLocation());
    window.addEventListener('popstate', onPopState);

    return () => {
      cancelled = true;
      clearTimeout(safetyTimeout);
      window.removeEventListener('popstate', onPopState);
      if (authSubscription && typeof authSubscription.unsubscribe === 'function') {
        authSubscription.unsubscribe();
      }
    };
  }, []);

  const openAuthenticatedPortal = (profile: AppUser) => {
    blockedSessionUserId.current = null;
    setCurrentUser({
      ...profile,
      referralCode: profile.referralCode || codeService.getUserReferralCode(profile)
    });
  };

  const authenticateFromPage = async (
    intent: LoginIntent,
    authUser: { id: string; email?: string; user_metadata?: any }
  ) => {
    formLoginActive.current = true;
    try {
      const profile = await authService.loadConfirmedProfile(authUser.id, authUser.email, authUser.user_metadata);
      if (!profile) {
        blockedSessionUserId.current = authUser.id;
        await authService.signOut();
        throw new Error('Não foi possível confirmar o perfil desta conta.');
      }

      const isTeam = profile.role === 'gestor' || profile.role === 'entregador';
      if (intent === 'equipe' && !isTeam) {
        blockedSessionUserId.current = authUser.id;
        await authService.signOut();
        throw new Error('Esta conta não tem acesso de equipe.');
      }
      if (intent === 'cliente' && profile.role !== 'cliente') {
        blockedSessionUserId.current = authUser.id;
        await authService.signOut();
        const error = new Error('Esta conta é da equipe. Use o acesso da equipe.') as Error & { teamAccess?: boolean };
        error.teamAccess = true;
        throw error;
      }

      openAuthenticatedPortal(profile);
    } finally {
      formLoginActive.current = false;
    }
  };


  // Fetch initial data when user is logged in and maintain live polling
  useEffect(() => {
    if (currentUser) {
      loadData(true);
      
      // Polling contínuo: sincroniza pedidos e usuários a cada 2s para tempo real
      // e faz sync completo de dados operacionais (bairros, despesas, produtos, etc.) a cada ~30s
      let tickCount = 0;
      const pollInterval = setInterval(() => {
        tickCount++;
        const isSlowTick = tickCount % 15 === 0;
        loadData(isSlowTick);
      }, 2000);

      try {
        const orderSub = orderService.subscribeToOrders(() => {
          loadData(false);
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
  }, [currentUser?.id]);

  const loadData = async (fullSync: boolean = true) => {
    try {
      if (fullSync) {
        const [fetchedOrders, fetchedExpenses, fetchedUsers, fetchedCoverage, fetchedReferrals, fetchedBusiness, fetchedProducts] = await Promise.all([
          orderService.getOrders().catch(() => []),
          expenseService.getExpenses().catch(() => []),
          userService.getProfiles().catch(() => []),
          coverageService.getCoverageAreas().catch(() => []),
          referralService.getReferrals().catch(() => []),
          businessService.getBusinessInfo().catch(() => DEFAULT_BUSINESS_INFO),
          productService.getProducts().catch(() => PRODUCTS)
        ]);

        setOrders(prev => {
          if (JSON.stringify(prev) === JSON.stringify(fetchedOrders)) return prev;
          return fetchedOrders || [];
        });
        localStorage.setItem('gas_app_orders', JSON.stringify(fetchedOrders || []));

        setExpenses(prev => {
          if (JSON.stringify(prev) === JSON.stringify(fetchedExpenses)) return prev;
          return fetchedExpenses || [];
        });
        localStorage.setItem('gas_app_expenses', JSON.stringify(fetchedExpenses || []));

        const demoSession = import.meta.env.DEV && !!currentUser && MOCK_USERS.some(u => u.id === currentUser.id);
        const rawUsers = fetchedUsers && fetchedUsers.length > 0 ? fetchedUsers : (demoSession ? MOCK_USERS : []);
        const usersWithReferral = rawUsers.map(u => ({
          ...u,
          referralCode: u.referralCode || codeService.getUserReferralCode(u)
        }));
        setAllUsers(prev => {
          if (JSON.stringify(prev) === JSON.stringify(usersWithReferral)) return prev;
          return usersWithReferral;
        });

        setReferrals(prev => {
          if (JSON.stringify(prev) === JSON.stringify(fetchedReferrals)) return prev;
          return fetchedReferrals || [];
        });

        if (fetchedCoverage && fetchedCoverage.length > 0) {
          setCoverageAreas(prev => {
            if (JSON.stringify(prev) === JSON.stringify(fetchedCoverage)) return prev;
            return fetchedCoverage;
          });
        }
        if (fetchedBusiness) {
          setBusinessInfo(prev => {
            if (JSON.stringify(prev) === JSON.stringify(fetchedBusiness)) return prev;
            return fetchedBusiness;
          });
        }
        if (fetchedProducts && fetchedProducts.length > 0) {
          setProducts(prev => {
            if (JSON.stringify(prev) === JSON.stringify(fetchedProducts)) return prev;
            return fetchedProducts;
          });
          localStorage.setItem('gas_app_products', JSON.stringify(fetchedProducts));
        }
      } else {
        // Fast sync: apenas pedidos e usuários para tempo real leve e ágil
        const [fetchedOrders, fetchedUsers] = await Promise.all([
          orderService.getOrders().catch(() => []),
          userService.getProfiles().catch(() => [])
        ]);

        setOrders(prev => {
          if (JSON.stringify(prev) === JSON.stringify(fetchedOrders)) return prev;
          return fetchedOrders || [];
        });
        localStorage.setItem('gas_app_orders', JSON.stringify(fetchedOrders || []));

        if (fetchedUsers && fetchedUsers.length > 0) {
          const rawUsers = fetchedUsers;
          const usersWithReferral = rawUsers.map(u => ({
            ...u,
            referralCode: u.referralCode || codeService.getUserReferralCode(u)
          }));
          setAllUsers(prev => {
            if (JSON.stringify(prev) === JSON.stringify(usersWithReferral)) return prev;
            return usersWithReferral;
          });
        }
      }
    } catch (err) {
      console.warn('Usando dados sincronizados locais:', err);
    }
  };

  // Sincronização retroativa de endereços: se cliente logado não tem endereços salvos mas tem histórico de pedidos
  const hasAttemptedAddressSync = React.useRef(false);
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'cliente') return;
    if (hasAttemptedAddressSync.current) return;
    if (!orders || orders.length === 0) return;

    // Se o usuário já tem endereços salvos, marca como verificado e não altera
    if (currentUser.addresses && currentUser.addresses.length > 0) {
      hasAttemptedAddressSync.current = true;
      return;
    }

    const cleanPhone = (currentUser.phone || '').replace(/\D/g, '');
    const userOrders = orders.filter(o => 
      o.status !== 'Cancelado' &&
      (o.customerId === currentUser.id || (cleanPhone.length >= 8 && !!o.phone && o.phone.replace(/\D/g, '') === cleanPhone))
    );

    if (userOrders.length === 0) return;

    const recoveredAddresses: Address[] = [];
    for (const ord of userOrders) {
      if (ord.address && ord.address.street && ord.address.number) {
        const isDuplicated = recoveredAddresses.some(a => 
          (a.cep && ord.address.cep && a.cep.replace(/\D/g, '') === ord.address.cep.replace(/\D/g, '') && a.number.trim().toLowerCase() === ord.address.number.trim().toLowerCase()) ||
          (a.street.trim().toLowerCase() === ord.address.street.trim().toLowerCase() && a.number.trim().toLowerCase() === ord.address.number.trim().toLowerCase())
        );
        if (!isDuplicated) {
          recoveredAddresses.push(ord.address);
        }
      }
    }

    if (recoveredAddresses.length > 0) {
      hasAttemptedAddressSync.current = true;
      console.log(`[Auto-Sync] Recuperados ${recoveredAddresses.length} endereço(s) anteriores do histórico de pedidos para o cliente.`);
      handleUpdateUser({
        ...currentUser,
        addresses: recoveredAddresses
      });
    }
  }, [currentUser?.id, currentUser?.addresses?.length, orders]);

  const handleUpdateBusinessInfo = async (newInfo: BusinessInfo) => {
    const saved = await businessService.saveBusinessInfo(newInfo);
    setBusinessInfo(saved);
    return saved;
  };

  const handleLogout = async () => {
    hasAttemptedAddressSync.current = false;
    // 1. Desconecta o estado React imediatamente para voltar à tela de login sem travar
    setCurrentUser(null);

    // 2. Limpa tokens de autenticação do usuário, mantendo configurações institucionais salvas
    try {
      const PRESERVED_SETTINGS_KEYS = [
        'gas_app_business_settings',
        'gas_app_rewards',
        'gas_app_benefits_config',
        'gas_app_coverage_areas',
        'gas_app_products'
      ];
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          if (PRESERVED_SETTINGS_KEYS.includes(key)) continue;
          if (key.startsWith('sb-') || key.includes('auth') || key.includes('supabase') || key.startsWith('gas_')) {
            keysToRemove.push(key);
          }
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
      id: newOrder.id || 'PED-' + Math.floor(100 + Math.random() * 900),
      completedAt: newOrder.status === 'Concluído' ? (newOrder.completedAt || new Date().toISOString()) : newOrder.completedAt
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
      const { data: sessionData } = await supabase.auth.getSession();
      const dbCreated = await orderService.createOrder(localCreated);
      if (!dbCreated && sessionData.session) {
        throw new Error('O pedido não foi gravado.');
      }
      if (dbCreated && dbCreated.id && dbCreated.id !== localCreated.id) {
        setOrders(prev => {
          const synced = prev.map(o => o.id === localCreated.id ? dbCreated : o);
          try {
            localStorage.setItem('gas_app_orders', JSON.stringify(synced));
          } catch {}
          return synced;
        });
      }
    } catch (err: any) {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        console.error('Falha ao gravar pedido:', err);
        setOrders(prev => prev.filter(o => o.id !== localCreated.id));
        throw err;
      }
      console.warn('Sem sessão: pedido ficou só neste aparelho.', err);
    }

    // Se o pedido já nasce como 'Concluído' (venda presencial do entregador), credita pontos ao cliente
    if (localCreated.status === 'Concluído') {
      const multiplier = benefitsConfig?.pointsPerCurrency ?? 0;
      const earnedPoints = Math.floor(localCreated.total * multiplier);
      const cleanOrderPhone = (localCreated.phone || '').replace(/\D/g, '');
      const customer = allUsers.find(u => 
        u.id === localCreated.customerId || 
        (cleanOrderPhone && (u.phone || '').replace(/\D/g, '') === cleanOrderPhone)
      );
      if (customer) {
        const historyItem: PointHistoryItem = {
          id: `order-${localCreated.id}`,
          userId: customer.id,
          type: 'earned_order',
          points: earnedPoints,
          description: `Compra concluída (Pedido #${localCreated.id})`,
          orderId: localCreated.id,
          createdAt: new Date().toISOString()
        };
        const updatedCustomer: AppUser = {
          ...customer,
          points: (customer.points || 0) + earnedPoints,
          pointHistory: [historyItem, ...(customer.pointHistory || [])]
        };
        await handleUpdateUser(updatedCustomer);
      }
    }
  };

  const handleUpdateOrder = async (orderToUpdate: Order) => {
    const prevOrder = orders.find(o => o.id === orderToUpdate.id);
    const isNowCompleted = orderToUpdate.status === 'Concluído' && prevOrder?.status !== 'Concluído';
    const updatedOrder: Order = {
      ...orderToUpdate,
      completedAt: (isNowCompleted && !orderToUpdate.completedAt) || (orderToUpdate.status === 'Concluído' && !orderToUpdate.completedAt)
        ? new Date().toISOString()
        : orderToUpdate.completedAt
    };

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
      const multiplier = benefitsConfig?.pointsPerCurrency ?? 0;
      const earnedPoints = Math.floor(updatedOrder.total * multiplier);

      // 1. Creditar pontos na conta do cliente da compra
      const cleanOrderPhone = (updatedOrder.phone || '').replace(/\D/g, '');
      const customer = allUsers.find(u => 
        u.id === updatedOrder.customerId || 
        (cleanOrderPhone && (u.phone || '').replace(/\D/g, '') === cleanOrderPhone)
      );
      if (customer) {
        const historyItem: PointHistoryItem = {
          id: `order-${updatedOrder.id}`,
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
      const userWithCode = {
        ...updatedUser,
        referralCode: updatedUser.referralCode || codeService.getUserReferralCode(updatedUser)
      };
      await userService.updateProfile(userWithCode.id, userWithCode);
      setAllUsers(prev => prev.map(u => u.id === userWithCode.id ? userWithCode : u));
      if (currentUser?.id === userWithCode.id) {
        setCurrentUser(userWithCode);
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

  const handleAddProduct = async (product: Product) => {
    try {
      const updated = await productService.upsertProduct(product);
      setProducts(updated);
    } catch (err) {
      console.error('Error adding product:', err);
    }
  };

  const handleUpdateProduct = async (product: Product) => {
    try {
      const updated = await productService.upsertProduct(product);
      setProducts(updated);
    } catch (err) {
      console.error('Error updating product:', err);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      const updated = await productService.deleteProduct(productId);
      setProducts(updated);
    } catch (err) {
      console.error('Error deleting product:', err);
    }
  };

  const handleUpdateProductPrice = async (
    productId: string,
    newPrice: number,
    pixDiscountValue?: number,
    cashDiscountValue?: number,
    pixType?: 'fixed' | 'percentage',
    cashType?: 'fixed' | 'percentage'
  ) => {
    try {
      const updated = await productService.updateProductPrice(
        productId,
        newPrice,
        pixDiscountValue,
        cashDiscountValue,
        pixType,
        cashType
      );
      setProducts(updated);
    } catch (err) {
      console.error('Error updating product price:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-4">
        {businessInfo?.logoUrl ? (
          <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-yellow-400 bg-white flex items-center justify-center shadow-lg animate-pulse">
            <img src={businessInfo.logoUrl} alt="Logo" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="bg-yellow-400 w-16 h-16 rounded-2xl flex items-center justify-center rotate-3 animate-pulse">
            <Truck className="text-slate-900 w-10 h-10" />
          </div>
        )}
        <p className="font-black text-xl tracking-widest uppercase">{businessInfo?.name || 'GÁS EXPRESS'}</p>
        <p className="text-slate-400 text-sm font-medium animate-pulse">Verificando sessão...</p>
      </div>
    );
  }


  if (!currentUser) {
    return (
      <LoginView
        intent={loginIntent}
        businessInfo={businessInfo}
        onAuthenticate={authenticateFromPage}
        onDemoLogin={openAuthenticatedPortal}
      />
    );
  }

  return (
    <div className="font-sans text-slate-900 h-screen flex flex-col overflow-hidden">
      <Header user={currentUser} businessInfo={businessInfo} onLogout={handleLogout} />
      
      <main className="flex-1 overflow-hidden relative flex flex-col min-h-0">
        <AnimatePresence mode="wait">
          {currentUser.role === 'cliente' && (
            <motion.div key="cliente" className="h-full w-full overflow-y-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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
                products={products}
              />
            </motion.div>
          )}
          
          {(currentUser.role === 'gestor' || currentUser.role === 'admin') && (
            <motion.div key="gestor" className="h-full w-full overflow-hidden flex flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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
                products={products}
                onAddProduct={handleAddProduct}
                onUpdateProduct={handleUpdateProduct}
                onDeleteProduct={handleDeleteProduct}
                onUpdateProductPrice={handleUpdateProductPrice}
              />
            </motion.div>
          )}
          
          {currentUser.role === 'entregador' && (
            <motion.div key="entregador" className="h-full w-full overflow-hidden flex flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <DeliveryDashboard 
                user={currentUser} 
                orders={orders.filter(o => o.deliveryPersonId === currentUser.id || (!o.deliveryPersonId && o.status === 'Pendente'))} 
                onUpdateOrder={handleUpdateOrder} 
                onAddOrder={handleOrderCreated}
                onAddExpense={handleAddExpense}
                onUpdateUser={handleUpdateUser}
                expenses={expenses}
                allCustomers={allUsers.filter(u => u.role === 'cliente')}
                allCollaborators={allUsers.filter(u => u.role === 'gestor' || u.role === 'admin')}
                businessInfo={businessInfo}
                products={products}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

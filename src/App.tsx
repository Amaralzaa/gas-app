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
import { AppView, Order, OrderStatus, Product, OrderItem, AppUser, UserRole, Expense, CoverageArea, Coupon, Reward, Referral } from './types';
import { PRODUCTS } from './constants';
import { CustomerDashboard } from './components/CustomerDashboard';
import { ManagerDashboard } from './components/ManagerDashboard';
import { DeliveryDashboard } from './components/DeliveryDashboard';

// --- Services ---
import { authService } from './services/authService';
import { orderService } from './services/orderService';
import { userService } from './services/userService';
import { expenseService } from './services/expenseService';
import { supabase } from './lib/supabase';

// --- Components ---

const LoginView = ({ onLogin, onRegister }: { onLogin: (user: AppUser) => void, onRegister: (user: AppUser) => void }) => {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email'); // Default to email for simplicity in testing
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let authUser: any = null;

      if (isRegistering) {
        if (!name.trim()) throw new Error('Por favor, informe seu nome.');
        authUser = await authService.signUp(email || `guest_${phone.replace(/\D/g, '')}@gasexpress.app`, name, 'cliente', phone);
      } else {
        if (loginMethod === 'email') {
          if (!email.trim() || !password.trim()) throw new Error('E-mail e senha são obrigatórios.');
          authUser = await authService.login(email, password);
        } else {
          if (!phone.trim()) throw new Error('O número do WhatsApp é obrigatório.');
          authUser = await authService.loginWithPhone(phone);
        }
      }

      // Directly fetch profile and set user — don't wait for onAuthStateChange
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
          <p className="text-slate-500 font-medium">
            {isRegistering ? 'Complete seu cadastro' : 'Acesse sua conta para continuar'}
          </p>
        </div>

        {!isRegistering && (
          <div className="flex gap-2 mb-6 bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setLoginMethod('phone')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${loginMethod === 'phone' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              WHATSAPP
            </button>
            <button 
              onClick={() => setLoginMethod('email')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${loginMethod === 'email' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              COLABORADOR
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {loginMethod === 'email' && (
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
          )}

          {loginMethod === 'email' && !isRegistering && (
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
          )}

          {(loginMethod === 'phone' || isRegistering) && (
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Telefone</label>
              <input 
                required
                type="tel" 
                className="w-full p-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-yellow-400 outline-none transition-all"
                placeholder="11999999999"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          )}

          {isRegistering && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Seu Nome</label>
              <input 
                required
                type="text" 
                className="w-full p-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-yellow-400 outline-none transition-all"
                placeholder="Como gostaria de ser chamado?"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </motion.div>
          )}
          
          {error && (
            <p className="text-red-500 text-xs font-bold bg-red-50 p-3 rounded-xl">{error}</p>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? 'CARREGANDO...' : (isRegistering ? 'CONCLUIR CADASTRO' : 'ENTRAR NO SISTEMA')}
          </button>
          
          <button 
            type="button"
            onClick={() => setIsRegistering(!isRegistering)}
            className="w-full text-slate-400 font-bold py-2 text-sm hover:text-slate-600 transition-colors"
          >
            {isRegistering ? 'Já tenho conta - Entrar' : 'Novo por aqui? Criar conta'}
          </button>
        </form>

        {!isRegistering && (
          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center font-medium">
              Utilize os dados de acesso configurados no Supabase.
            </p>
          </div>
        )}
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [coverageAreas, setCoverageAreas] = useState<CoverageArea[]>([
    { id: '1', neighborhood: 'Sé', city: 'São Paulo', allowedCeps: [], center: { lat: -23.5505, lng: -46.6333 } },
    { id: '2', neighborhood: 'Bela Vista', city: 'São Paulo', allowedCeps: [], center: { lat: -23.5615, lng: -46.6553 } },
    { id: '3', neighborhood: 'República', city: 'São Paulo', allowedCeps: [], center: { lat: -23.5447, lng: -46.6388 } }
  ]);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [initialTab, setInitialTab] = useState<'home' | 'history' | 'referral' | 'profile' | 'tracking'>('home');
  const [loading, setLoading] = useState(true);

  // Sync Auth State — check existing session on mount
  useEffect(() => {
    let cancelled = false;

    // Check for existing session (does NOT trigger the auth lock)
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && !cancelled) {
          const appUser = await authService.getProfileForUser(
            session.user.id, session.user.email, session.user.user_metadata
          );
          setCurrentUser(appUser);
        }
      } catch (err) {
        console.error('Error checking session:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // Handle deep-link / auto-login via ?phone=
    const params = new URLSearchParams(window.location.search);
    const phoneParam = params.get('phone');
    if (phoneParam) {
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

    // Listen for sign-out events only
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // Fetch initial data when user is logged in
  useEffect(() => {
    if (currentUser) {
      loadData();
      
      // Realtime subscription for orders
      const orderSub = orderService.subscribeToOrders(() => {
        loadData(); // Re-fetch all data or just orders for simplicity
      });

      return () => {
        orderSub.unsubscribe();
      };
    }
  }, [currentUser]);

  const loadData = async () => {
    try {
      const [fetchedOrders, fetchedExpenses, fetchedUsers] = await Promise.all([
        orderService.getOrders(),
        expenseService.getExpenses(),
        userService.getProfiles()
      ]);
      setOrders(fetchedOrders);
      setExpenses(fetchedExpenses);
      setAllUsers(fetchedUsers);
    } catch (err) {
      console.error('Error loading data from Supabase:', err);
    }
  };

  const handleLogout = async () => {
    await authService.signOut();
  };

  const handleOrderCreated = async (newOrder: Order) => {
    try {
      const created = await orderService.createOrder(newOrder);
      setOrders(prev => [created, ...prev]);
    } catch (err) {
      console.error('Error creating order:', err);
    }
  };

  const handleUpdateOrder = async (updatedOrder: Order) => {
    try {
      await orderService.updateOrder(updatedOrder.id, updatedOrder);
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    } catch (err) {
      console.error('Error updating order:', err);
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
    try {
      const added = await expenseService.addExpense(expense);
      setExpenses(prev => [added, ...prev]);
    } catch (err) {
      console.error('Error adding expense:', err);
    }
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
                initialTab={initialTab}
                coverageAreas={coverageAreas}
                coupons={coupons}
                rewards={rewards}
                referrals={referrals}
                onAddReferral={() => {}} // TODO: Implement in service
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
                onUpdateCoverage={() => {}}
                coupons={coupons}
                onUpdateCoupons={() => {}}
                rewards={rewards}
                onUpdateRewards={() => {}}
                referrals={referrals}
                onUpdateReferrals={() => {}}
                onUpdateUser={handleUpdateUser}
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

import React, { useState } from 'react';
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
  Phone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppUser, Order, Expense, Product, Address } from '../types';
import { PRODUCTS } from '../constants';

interface DeliveryDashboardProps {
  user: AppUser;
  orders: Order[];
  onUpdateOrder: (order: Order) => void;
  onAddOrder: (order: Order) => void;
  onAddExpense: (expense: Expense) => void;
  expenses: Expense[];
  allCustomers: AppUser[];
}

export const DeliveryDashboard: React.FC<DeliveryDashboardProps> = ({ user, orders, onUpdateOrder, onAddOrder, onAddExpense, expenses, allCustomers }) => {
  const [activeTab, setActiveTab] = useState<'deliveries' | 'finance'>('deliveries');
  const [isAddingSale, setIsAddingSale] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  
  // New Sale State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<AppUser | null>(null);
  const [cart, setCart] = useState<{ [id: string]: number }>({});

  const myDeliveries = orders.filter(o => o.deliveryPersonId === user.id && o.status === 'Em Rota');
  const myExpenses = expenses.filter(e => e.userId === user.id);

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
            <button onClick={() => setActiveTab('finance')} className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab === 'finance' ? 'bg-yellow-400 text-slate-900' : 'bg-slate-800 text-slate-400'}`}>Financeiro</button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'deliveries' && (
            <motion.div key="deliveries" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              {myDeliveries.length === 0 ? (
                <div className="text-center py-20 opacity-30">
                  <Truck className="w-16 h-16 mx-auto mb-4" />
                  <p className="font-bold">Nenhuma entrega em rota.</p>
                </div>
              ) : (
                myDeliveries.map(o => (
                  <div key={o.id} className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl">
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-[10px] font-black bg-yellow-400 text-slate-900 px-2 py-0.5 rounded uppercase">#{o.id}</span>
                      <p className="text-xl font-black text-yellow-400">R$ {o.total.toFixed(2)}</p>
                    </div>
                    <h3 className="font-black text-lg mb-1">{o.customerName}</h3>
                    <p className="text-slate-400 text-sm flex items-start gap-2 mb-6">
                      <MapPin className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                      {o.address.street}, {o.address.number}
                    </p>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${o.address.street} ${o.address.number} ${o.address.city}`)}`} target="_blank" className="bg-blue-600 p-4 rounded-2xl font-bold flex items-center justify-center gap-2 text-sm"><ExternalLink className="w-4 h-4" /> MAPS</a>
                      <button onClick={() => handleComplete(o)} className="bg-green-600 p-4 rounded-2xl font-bold flex items-center justify-center gap-2 text-sm"><Check className="w-4 h-4" /> ENTREGUE</button>
                    </div>
                    <button 
                      onClick={() => {
                        const link = `${window.location.origin}?phone=${o.phone}`;
                        const message = `Olá ${o.customerName}, aqui é o entregador da Gás Express! Estou saindo com seu pedido agora. Acompanhe minha localização em tempo real aqui: ${link}`;
                        window.open(`https://wa.me/55${o.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
                      }}
                      className="w-full bg-slate-700 p-4 rounded-2xl font-bold flex items-center justify-center gap-2 text-sm text-yellow-400"
                    >
                      <MessageSquare className="w-4 h-4" /> NOTIFICAR CLIENTE (WHATSAPP)
                    </button>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'finance' && (
            <motion.div key="finance" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700">
                <p className="text-xs font-bold text-slate-500 uppercase mb-1">Despesas Lançadas</p>
                <p className="text-3xl font-black text-red-400">R$ {myExpenses.reduce((acc, e) => acc + e.amount, 0).toFixed(2)}</p>
              </div>
              <div className="space-y-3">
                {myExpenses.map(e => (
                  <div key={e.id} className="bg-slate-800/50 p-4 rounded-2xl flex justify-between items-center border border-slate-800">
                    <div>
                      <p className="font-bold text-sm">{e.description}</p>
                      <p className="text-[10px] text-slate-500">{new Date(e.date).toLocaleDateString()}</p>
                    </div>
                    <p className="font-black text-red-400">- R$ {e.amount.toFixed(2)}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => setIsAddingExpense(true)} className="w-full bg-slate-800 border border-slate-700 p-4 rounded-2xl font-bold text-slate-400 hover:text-white transition-all">+ LANÇAR DESPESA</button>
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

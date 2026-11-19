import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Clock, 
  MessageSquare, 
  Ticket, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  AlertTriangle, 
  CheckCircle2, 
  Users, 
  Flame, 
  Gift, 
  Award,
  Sparkles,
  Phone,
  MapPin,
  ExternalLink,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppUser, Order, Coupon, Reward } from '../../types';
import { 
  CustomerCRMDrawerModal, 
  CustomerPredictionItem 
} from './CustomerCRMDrawerModal';

export type PredictionPeriodFilter = 'all' | 'next7' | 'next15' | 'thisMonth' | 'overdue';
export type CRMSegment = 'all' | 'ending_soon' | 'overdue' | 'one_time' | 'loyal';

interface PredictionsCRMTabProps {
  allCustomers: AppUser[];
  orders: Order[];
  coupons: Coupon[];
  rewards: Reward[];
  onOpenCouponModal?: (pred: any) => void;
}

export const PredictionsCRMTab: React.FC<PredictionsCRMTabProps> = ({
  allCustomers,
  orders,
  coupons,
  rewards,
  onOpenCouponModal
}) => {
  // 1. Filtro de Período Independente da Aba de Previsão
  const [periodFilter, setPeriodFilter] = useState<PredictionPeriodFilter>('all');

  // 2. Segmento do CRM (Sub-abas)
  const [activeSegment, setActiveSegment] = useState<CRMSegment>('all');

  // 3. Busca e Paginação
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // 4. Modal de CRM Detalhado do Cliente
  const [selectedCustomerForCRM, setSelectedCustomerForCRM] = useState<CustomerPredictionItem | null>(null);

  // Mapeamento e Cálculo de Previsão de Consumo de Cada Cliente
  const allCustomerPredictions = useMemo<CustomerPredictionItem[]>(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return allCustomers.map(customer => {
      const cleanCustPhone = (customer.phone || '').replace(/\D/g, '');
      const allCustomerOrders = orders
        .filter(o => {
          const cleanOPhone = (o.phone || '').replace(/\D/g, '');
          const matchId = !!(customer.id && o.customerId && o.customerId === customer.id);
          const matchPhone = !!(cleanCustPhone.length >= 8 && cleanOPhone.length >= 8 && cleanOPhone === cleanCustPhone);
          return matchId || matchPhone;
        })
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      const customerOrders = allCustomerOrders.filter(o => o.status === 'Concluído');

      let avgInterval = 0;
      let nextPrediction: Date | null = null;
      let totalQuantity = 0;

      customerOrders.forEach(order => {
        totalQuantity += order.items.reduce((acc, item) => acc + item.quantity, 0);
      });

      const lastOrder = customerOrders.length > 0 ? customerOrders[customerOrders.length - 1] : null;
      const lastOrderDate = lastOrder ? new Date(lastOrder.createdAt) : null;
      const daysSinceLastOrder = lastOrderDate 
        ? Math.max(0, Math.floor((now.getTime() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24)))
        : 999;

      if (customerOrders.length > 1) {
        const intervals: number[] = [];
        for (let i = 1; i < customerOrders.length; i++) {
          const prev = new Date(customerOrders[i - 1].createdAt).getTime();
          const curr = new Date(customerOrders[i].createdAt).getTime();
          intervals.push((curr - prev) / (1000 * 60 * 60 * 24));
        }
        avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        if (lastOrderDate) {
          nextPrediction = new Date(lastOrderDate.getTime() + avgInterval * 24 * 60 * 60 * 1000);
        }
      } else if (customerOrders.length === 1 && lastOrderDate) {
        // Previsão padrão de 35 dias para quem comprou 1 vez
        avgInterval = 35;
        nextPrediction = new Date(lastOrderDate.getTime() + 35 * 24 * 60 * 60 * 1000);
      }

      // Classificações
      const isOneTime = customerOrders.length === 1;
      const isLoyal = customerOrders.length >= 3;

      let isEndingSoon = false;
      let isOverdue = false;

      if (nextPrediction) {
        const diffDays = Math.ceil((nextPrediction.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) {
          isOverdue = true;
        } else if (diffDays <= 5) {
          isEndingSoon = true;
        }
      }

      return {
        customer,
        totalOrders: allCustomerOrders.length,
        totalQuantity,
        avgInterval,
        nextPrediction,
        daysSinceLastOrder,
        isOverdue,
        isEndingSoon,
        isOneTime,
        isLoyal,
        history: allCustomerOrders
      };
    }).filter(p => p.totalOrders > 0); // Considera quem já comprou
  }, [allCustomers, orders]);

  // Contadores para os Badges das Sub-abas
  const segmentCounts = useMemo(() => {
    return {
      all: allCustomerPredictions.length,
      ending_soon: allCustomerPredictions.filter(p => p.isEndingSoon).length,
      overdue: allCustomerPredictions.filter(p => p.isOverdue).length,
      one_time: allCustomerPredictions.filter(p => p.isOneTime).length,
      loyal: allCustomerPredictions.filter(p => p.isLoyal).length
    };
  }, [allCustomerPredictions]);

  // Filtro Combinado: Período + Sub-aba + Busca
  const filteredPredictions = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return allCustomerPredictions.filter(item => {
      // 1. Filtro de Sub-aba (Segmento)
      if (activeSegment === 'ending_soon' && !item.isEndingSoon) return false;
      if (activeSegment === 'overdue' && !item.isOverdue) return false;
      if (activeSegment === 'one_time' && !item.isOneTime) return false;
      if (activeSegment === 'loyal' && !item.isLoyal) return false;

      // 2. Filtro de Período da Previsão
      if (periodFilter !== 'all') {
        if (!item.nextPrediction) return false;
        const diffDays = Math.ceil((item.nextPrediction.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (periodFilter === 'next7' && (diffDays < 0 || diffDays > 7)) return false;
        if (periodFilter === 'next15' && (diffDays < 0 || diffDays > 15)) return false;
        if (periodFilter === 'thisMonth') {
          const currentMonth = now.getMonth();
          const predMonth = item.nextPrediction.getMonth();
          if (currentMonth !== predMonth) return false;
        }
        if (periodFilter === 'overdue' && diffDays >= 0) return false;
      }

      // 3. Busca por texto (Nome, Telefone ou Bairro)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const name = (item.customer.name || '').toLowerCase();
        const phone = (item.customer.phone || '').toLowerCase();
        const neighborhood = (item.customer.addresses?.[0]?.neighborhood || '').toLowerCase();
        return name.includes(query) || phone.includes(query) || neighborhood.includes(query);
      }

      return true;
    }).sort((a, b) => {
      // Ordenação: prioritários primeiro (atrasados ou com previsão próxima)
      if (!a.nextPrediction) return 1;
      if (!b.nextPrediction) return -1;
      return a.nextPrediction.getTime() - b.nextPrediction.getTime();
    });
  }, [allCustomerPredictions, activeSegment, periodFilter, searchQuery]);

  // Paginação
  const totalPages = Math.max(1, Math.ceil(filteredPredictions.length / itemsPerPage));
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredPredictions.slice(start, start + itemsPerPage);
  }, [filteredPredictions, currentPage, itemsPerPage]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Ciclo Médio Geral da Revenda
  const overallAvgCycle = useMemo(() => {
    const validIntervals = allCustomerPredictions.filter(p => p.avgInterval > 0).map(p => p.avgInterval);
    if (validIntervals.length === 0) return 38;
    return Math.round(validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length);
  }, [allCustomerPredictions]);

  // Cupons mais utilizados (Item 2.2)
  const topCoupons = useMemo(() => {
    return [...coupons]
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
      .slice(0, 4);
  }, [coupons]);

  // Resgates mais escolhidos (Item 2.2)
  const topRewards = useMemo(() => {
    return [...rewards]
      .sort((a, b) => (b.pointsCost || 0) - (a.pointsCost || 0))
      .slice(0, 4);
  }, [rewards]);

  const handleOpenWhatsAppDirect = (e: React.MouseEvent, item: CustomerPredictionItem) => {
    e.stopPropagation();
    const cleanPhone = (item.customer.phone || '').replace(/\D/g, '');
    if (!cleanPhone) {
      alert('Telefone do cliente não cadastrado.');
      return;
    }

    const firstName = item.customer.name.split(' ')[0] || 'Cliente';
    const text = item.isOneTime
      ? `Olá, ${firstName}! Tudo bem? Esperamos que esteja tudo ótimo com seu botijão da Porto Gás. Quando precisar de uma nova recarga, é só nos chamar por aqui!`
      : `Olá, ${firstName}! Passando para lembrar que seu botijão de gás deve estar perto do término. Responda esta mensagem para agendar sua entrega rápida!`;

    window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -10 }} 
      className="space-y-6"
    >
      {/* Top Header com Filtro de Período Próprio */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-yellow-500" /> Previsão de Consumo & CRM de Recompra
          </h3>
          <p className="text-xs text-slate-400 font-bold">
            Monitore o ciclo do botijão, fidelize e previna perda para a concorrência
          </p>
        </div>

        {/* Filtro de Período Exclusivo da Previsão */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
          <button
            onClick={() => { setPeriodFilter('all'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
              periodFilter === 'all'
                ? 'bg-yellow-400 text-slate-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => { setPeriodFilter('next7'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
              periodFilter === 'next7'
                ? 'bg-yellow-400 text-slate-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Próx. 7 Dias
          </button>
          <button
            onClick={() => { setPeriodFilter('next15'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
              periodFilter === 'next15'
                ? 'bg-yellow-400 text-slate-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Próx. 15 Dias
          </button>
          <button
            onClick={() => { setPeriodFilter('thisMonth'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
              periodFilter === 'thisMonth'
                ? 'bg-yellow-400 text-slate-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Este Mês
          </button>
          <button
            onClick={() => { setPeriodFilter('overdue'); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
              periodFilter === 'overdue'
                ? 'bg-red-500 text-white shadow-sm'
                : 'text-slate-600 hover:text-red-600'
            }`}
          >
            Atrasados
          </button>
        </div>
      </div>

      {/* Top 4 KPI Cards do CRM */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Ciclo Médio do Botijão */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-2xl bg-yellow-100 text-yellow-700 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black bg-yellow-50 text-yellow-800 px-2 py-0.5 rounded-lg">
              GLP P13
            </span>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Ciclo Médio do Botijão</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{overallAvgCycle}</span>
              <span className="text-sm font-bold text-slate-400">dias de duração</span>
            </div>
          </div>
          <p className="mt-3 text-xs font-bold text-slate-500">Média calculada entre compras recorrentes</p>
        </div>

        {/* Card 2: Clientes com Gás Acabando (Alerta Amarelo) */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Flame className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black bg-amber-100 text-amber-800 px-2 py-0.5 rounded-lg">
              Próx. 5 dias
            </span>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Gás Acabando</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-600">{segmentCounts.ending_soon}</span>
              <span className="text-sm font-bold text-slate-400">famílias</span>
            </div>
          </div>
          <p className="mt-3 text-xs font-bold text-amber-700">Momento ideal para disparo no WhatsApp</p>
        </div>

        {/* Card 3: Não Compraram após Previsão (Risco de Churn) */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black bg-red-100 text-red-700 px-2 py-0.5 rounded-lg">
              Risco Alto
            </span>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Previsão Vencida</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-red-600">{segmentCounts.overdue}</span>
              <span className="text-sm font-bold text-slate-400">clientes</span>
            </div>
          </div>
          <p className="mt-3 text-xs font-bold text-red-600">Possível compra com concorrente</p>
        </div>

        {/* Card 4: Clientes de 1ª Compra */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black bg-blue-50 text-blue-800 px-2 py-0.5 rounded-lg">
              Oportunidade
            </span>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Compraram 1 Vez</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{segmentCounts.one_time}</span>
              <span className="text-sm font-bold text-slate-400">clientes</span>
            </div>
          </div>
          <p className="mt-3 text-xs font-bold text-slate-500">Incentivar 2ª compra com cupom</p>
        </div>

      </div>

      {/* Bloco Analítico dos 2 DIVs: Cupons Mais Utilizados & Resgates Mais Escolhidos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* DIV 1: Cupons Mais Utilizados */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-yellow-100 text-yellow-700 flex items-center justify-center">
                <Ticket className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-black text-slate-900 text-base">Cupons Mais Utilizados</h4>
                <p className="text-xs text-slate-400 font-bold">Adesão dos clientes aos cupons promocionais</p>
              </div>
            </div>
            <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-xl">
              {coupons.length} cupons ativos
            </span>
          </div>

          <div className="space-y-3 pt-1">
            {topCoupons.map((coupon, idx) => {
              const maxUses = Math.max(...topCoupons.map(c => c.usageCount || 0), 1);
              const percent = Math.min(100, Math.round(((coupon.usageCount || 0) / maxUses) * 100));

              return (
                <div key={coupon.id || idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900 bg-yellow-400/20 text-yellow-800 px-2 py-0.5 rounded-lg tracking-wider">
                        {coupon.code}
                      </span>
                      <span className="font-bold text-slate-500 text-[11px]">
                        {coupon.type === 'fixed' ? `R$ ${coupon.value.toFixed(2)} OFF` : `${coupon.value}% OFF`}
                      </span>
                    </div>
                    <span className="font-black text-slate-900">
                      {coupon.usageCount || 0} usos
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(percent, 10)}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {topCoupons.length === 0 && (
              <div className="py-6 text-center text-slate-400 font-bold text-xs">
                Nenhum cupom cadastrado ainda.
              </div>
            )}
          </div>
        </div>

        {/* DIV 2: Resgates Mais Escolhidos */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Award className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-black text-slate-900 text-base">Resgates Mais Escolhidos</h4>
                <p className="text-xs text-slate-400 font-bold">Recompensas favoritas do programa de fidelidade</p>
              </div>
            </div>
            <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-xl">
              {rewards.length} recompensas
            </span>
          </div>

          <div className="space-y-3 pt-1">
            {topRewards.map((reward, idx) => (
              <div key={reward.id || idx} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <p className="font-black text-slate-900">{reward.title}</p>
                  <p className="text-[11px] text-slate-400 font-bold truncate max-w-[280px]">
                    {reward.description}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-black text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-xl text-xs">
                    {reward.pointsCost} pts
                  </span>
                </div>
              </div>
            ))}

            {topRewards.length === 0 && (
              <div className="py-6 text-center text-slate-400 font-bold text-xs">
                Nenhuma recompensa ativa no momento.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* CRM Interativo Estruturado (Sub-Abas + Tabela + Paginação) */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
        
        {/* Barra de Sub-Abas do CRM */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          
          {/* Botões das Sub-abas com Contadores */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => { setActiveSegment('all'); setCurrentPage(1); }}
              className={`px-3 py-2 rounded-2xl font-black text-xs flex items-center gap-1.5 transition-all ${
                activeSegment === 'all'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos ({segmentCounts.all})
            </button>

            <button
              onClick={() => { setActiveSegment('ending_soon'); setCurrentPage(1); }}
              className={`px-3 py-2 rounded-2xl font-black text-xs flex items-center gap-1.5 transition-all ${
                activeSegment === 'ending_soon'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              🟡 Gás Acabando ({segmentCounts.ending_soon})
            </button>

            <button
              onClick={() => { setActiveSegment('overdue'); setCurrentPage(1); }}
              className={`px-3 py-2 rounded-2xl font-black text-xs flex items-center gap-1.5 transition-all ${
                activeSegment === 'overdue'
                  ? 'bg-red-500 text-white shadow-sm'
                  : 'bg-red-50 text-red-700 hover:bg-red-100'
              }`}
            >
              🔴 Atrasados ({segmentCounts.overdue})
            </button>

            <button
              onClick={() => { setActiveSegment('one_time'); setCurrentPage(1); }}
              className={`px-3 py-2 rounded-2xl font-black text-xs flex items-center gap-1.5 transition-all ${
                activeSegment === 'one_time'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              🌱 Compraram 1 Vez ({segmentCounts.one_time})
            </button>

            <button
              onClick={() => { setActiveSegment('loyal'); setCurrentPage(1); }}
              className={`px-3 py-2 rounded-2xl font-black text-xs flex items-center gap-1.5 transition-all ${
                activeSegment === 'loyal'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              ⭐ Fiéis ({segmentCounts.loyal})
            </button>
          </div>

          {/* Campo de Busca Rápida */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Buscar cliente, telefone ou bairro..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-yellow-400"
            />
          </div>

        </div>

        {/* Tabela Interativa de Clientes */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <th className="pb-3 px-3">Cliente</th>
                <th className="pb-3 px-3">Bairro / Local</th>
                <th className="pb-3 px-3 text-center">Compras</th>
                <th className="pb-3 px-3">Último Pedido</th>
                <th className="pb-3 px-3">Previsão de Término</th>
                <th className="pb-3 px-3 text-right">Ações Rápidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedList.map(item => {
                const isOverdue = item.isOverdue;
                const isEndingSoon = item.isEndingSoon;

                return (
                  <tr 
                    key={item.customer.id} 
                    onClick={() => setSelectedCustomerForCRM(item)}
                    className="hover:bg-yellow-50/50 cursor-pointer transition-colors group"
                  >
                    {/* Cliente */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 group-hover:bg-yellow-400 group-hover:text-slate-950 font-black text-xs flex items-center justify-center transition-colors">
                          {item.customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 group-hover:text-yellow-700 transition-colors">
                            {item.customer.name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            {item.customer.phone || 'Sem telefone'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Endereço */}
                    <td className="py-3.5 px-3">
                      <p className="font-bold text-slate-700 truncate max-w-[180px]">
                        {item.customer.addresses?.[0]?.neighborhood || 'Não informado'}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate max-w-[180px]">
                        {item.customer.addresses?.[0]?.city || ''}
                      </p>
                    </td>

                    {/* Compras */}
                    <td className="py-3.5 px-3 text-center">
                      <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg">
                        {item.totalOrders}x ({item.totalQuantity} un)
                      </span>
                    </td>

                    {/* Última Compra */}
                    <td className="py-3.5 px-3">
                      <span className="font-bold text-slate-700">
                        há {item.daysSinceLastOrder} dias
                      </span>
                    </td>

                    {/* Previsão de Término */}
                    <td className="py-3.5 px-3">
                      {item.nextPrediction ? (
                        <div>
                          <span className={`px-2 py-0.5 rounded-lg font-black text-[10px] inline-flex items-center gap-1 ${
                            isOverdue 
                              ? 'bg-red-100 text-red-700' 
                              : isEndingSoon 
                              ? 'bg-amber-100 text-amber-800' 
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {isOverdue && '⚠️ Atrasado'}
                            {isEndingSoon && '🔥 Acabando'}
                            {!isOverdue && !isEndingSoon && '✔ No Prazo'}
                            : {new Date(item.nextPrediction).toLocaleDateString()}
                          </span>
                          <p className="text-[9px] text-slate-400 font-bold mt-0.5">
                            Ciclo: ~{Math.round(item.avgInterval)} dias
                          </p>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-bold italic">
                          Calculando ciclo...
                        </span>
                      )}
                    </td>

                    {/* Ações Rápidas */}
                    <td className="py-3.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={(e) => handleOpenWhatsAppDirect(e, item)}
                          className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl transition-all shadow-sm"
                          title="Conversar no WhatsApp"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (onOpenCouponModal) {
                              onOpenCouponModal(item);
                            }
                          }}
                          className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl transition-all shadow-sm"
                          title="Enviar Cupom"
                        >
                          <Ticket className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })}

              {paginatedList.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                    <Users className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                    Nenhum cliente encontrado para este filtro ou busca.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé com Paginação */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-100 text-xs">
          <div className="text-slate-400 font-bold">
            Mostrando {filteredPredictions.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} a {Math.min(currentPage * itemsPerPage, filteredPredictions.length)} de {filteredPredictions.length} clientes
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 border border-slate-200 rounded-xl hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-black text-slate-700 px-2">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2 border border-slate-200 rounded-xl hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* Drawer / Modal com Ficha Detalhada do Cliente */}
      <CustomerCRMDrawerModal 
        isOpen={!!selectedCustomerForCRM}
        onClose={() => setSelectedCustomerForCRM(null)}
        predictionItem={selectedCustomerForCRM}
      />

    </motion.div>
  );
};

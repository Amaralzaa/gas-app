import React, { useState, useMemo } from 'react';
import { 
  DollarSign, 
  Clock, 
  Star, 
  Target, 
  Truck, 
  CheckCircle2, 
  AlertCircle,
  MapPin, 
  Flame, 
  Settings2 
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { motion } from 'motion/react';
import { Order, AppUser, CoverageArea, Expense, BusinessInfo } from '../../types';
import { 
  GoalConfig, 
  GoalSettingsModal, 
  loadGoalConfig, 
  getGoalForPeriod 
} from './GoalSettingsModal';
import { 
  DeliveryTimeDetailsModal, 
  DeliveryTimeItem 
} from './DeliveryTimeDetailsModal';

export type DashboardPeriod = 'today' | '7days' | 'month' | 'custom';

interface DashboardMetricsTabProps {
  orders: Order[];
  deliveryPersons: AppUser[];
  expenses?: Expense[];
  coverageAreas?: CoverageArea[];
  businessInfo?: BusinessInfo;
  onSelectOrder?: (order: Order) => void;
}

export const DashboardMetricsTab: React.FC<DashboardMetricsTabProps> = ({
  orders,
  deliveryPersons,
  expenses = [],
  coverageAreas = [],
  onSelectOrder
}) => {
  // Estado do Filtro de Período
  const [period, setPeriod] = useState<DashboardPeriod>('today');
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [customEnd, setCustomEnd] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Estado de Metas & Relatório de Tempo
  const [goalConfig, setGoalConfig] = useState<GoalConfig>(() => loadGoalConfig());
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isDeliveryTimeModalOpen, setIsDeliveryTimeModalOpen] = useState(false);

  // Intervalo de Datas conforme o Período Selecionado
  const dateRange = useMemo(() => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    let start: Date;

    if (period === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    } else if (period === '7days') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
    } else if (period === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    } else {
      const [sy, sm, sd] = customStart.split('-').map(Number);
      const [ey, em, ed] = customEnd.split('-').map(Number);
      start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
      end.setFullYear(ey, em - 1, ed);
      end.setHours(23, 59, 59, 999);
    }

    return { start, end };
  }, [period, customStart, customEnd]);

  // Filtragem de Pedidos no Período
  const periodOrders = useMemo(() => {
    const startTime = dateRange.start.getTime();
    const endTime = dateRange.end.getTime();

    return orders.filter(o => {
      const orderTime = new Date(o.createdAt).getTime();
      return !isNaN(orderTime) && orderTime >= startTime && orderTime <= endTime;
    });
  }, [orders, dateRange]);

  const completedOrders = useMemo(() => {
    return periodOrders.filter(o => o.status === 'Concluído');
  }, [periodOrders]);

  // 1. Meta do Período e Botijões Vendidos
  const targetPeriodGoal = useMemo(() => {
    return getGoalForPeriod(dateRange.start, dateRange.end, goalConfig);
  }, [dateRange, goalConfig]);

  const p13SoldQuantity = useMemo(() => {
    return completedOrders.reduce((acc, order) => {
      const p13Item = order.items.find(i => i.productId === 'p13' || i.productId.toLowerCase().includes('13'));
      return acc + (p13Item ? p13Item.quantity : 0);
    }, 0);
  }, [completedOrders]);

  const goalProgressPercent = useMemo(() => {
    if (targetPeriodGoal <= 0) return 0;
    return Math.min(Math.round((p13SoldQuantity / targetPeriodGoal) * 100), 100);
  }, [p13SoldQuantity, targetPeriodGoal]);

  // Rótulo textual do período selecionado
  const periodLabel = useMemo(() => {
    if (period === 'today') return 'Hoje';
    if (period === '7days') return 'Últimos 7 dias';
    if (period === 'month') return 'Mês atual';
    return `${dateRange.start.toLocaleDateString('pt-BR')} até ${dateRange.end.toLocaleDateString('pt-BR')}`;
  }, [period, dateRange]);

  // 2. Tempo Médio de Entrega baseado no tempo decorrido do pedido até a sua conclusão
  const getOrderDeliveryMinutes = (o: Order): number => {
    if (!o.createdAt) return 25;
    const created = new Date(o.createdAt).getTime();
    if (isNaN(created)) return 25;

    const compDateStr = o.completedAt || o.estimatedArrival;
    if (compDateStr) {
      const finished = new Date(compDateStr).getTime();
      if (!isNaN(finished) && finished >= created) {
        return Math.max(1, Math.floor((finished - created) / 60000));
      }
    }
    return 25;
  };

  const deliveryStats = useMemo(() => {
    if (completedOrders.length === 0) {
      return {
        avgMinutes: 0,
        totalDeliveries: 0,
        withinSlaCount: 0,
        overSlaCount: 0,
        bestTime: 0,
        worstTime: 0,
        items: [] as DeliveryTimeItem[]
      };
    }

    const items: DeliveryTimeItem[] = completedOrders.map(o => {
      const minutes = getOrderDeliveryMinutes(o);
      const dp = deliveryPersons.find(d => d.id === o.deliveryPersonId);
      return {
        order: o,
        minutes,
        deliveryPersonName: dp?.name || 'Entregador Responsável',
        withinSla: minutes <= 30
      };
    }).sort((a, b) => new Date(b.order.createdAt).getTime() - new Date(a.order.createdAt).getTime());

    const totalMinutes = items.reduce((acc, it) => acc + it.minutes, 0);
    const avgMinutes = Math.round(totalMinutes / items.length);
    const withinSlaCount = items.filter(it => it.withinSla).length;
    const overSlaCount = items.length - withinSlaCount;
    const allMinutes = items.map(it => it.minutes);
    const bestTime = Math.min(...allMinutes);
    const worstTime = Math.max(...allMinutes);

    return {
      avgMinutes,
      totalDeliveries: items.length,
      withinSlaCount,
      overSlaCount,
      bestTime,
      worstTime,
      items
    };
  }, [completedOrders, deliveryPersons]);

  const avgDeliveryTimeMinutes = deliveryStats.avgMinutes;

  // 3. Satisfação do Cliente (Estrelas)
  const satisfactionStats = useMemo(() => {
    const ratedOrders = periodOrders.filter(o => 
      typeof o.rating === 'number' || 
      typeof o.serviceRating === 'number' || 
      typeof o.deliveryRating === 'number'
    );

    if (ratedOrders.length === 0) {
      return {
        avgRating: 5.0,
        totalReviews: completedOrders.length > 0 ? completedOrders.length : 1,
        percentPositive: 100
      };
    }

    let sum = 0;
    let count = 0;
    let highRatings = 0;

    ratedOrders.forEach(o => {
      const r = o.rating || o.serviceRating || o.deliveryRating;
      if (r) {
        sum += r;
        count++;
        if (r >= 4) highRatings++;
      }
    });

    const avg = count > 0 ? (sum / count) : 5.0;
    const positive = count > 0 ? Math.round((highRatings / count) * 100) : 100;

    return {
      avgRating: Number(avg.toFixed(1)),
      totalReviews: count,
      percentPositive: positive
    };
  }, [periodOrders, completedOrders]);

  // 4. Faturamento do Período
  const totalRevenue = useMemo(() => {
    return completedOrders.reduce((acc, o) => acc + (o.total || 0), 0);
  }, [completedOrders]);

  const avgTicket = useMemo(() => {
    if (completedOrders.length === 0) return 0;
    return totalRevenue / completedOrders.length;
  }, [totalRevenue, completedOrders]);

  // 5. Gráfico de Picos por Hora
  const hourlyData = useMemo(() => {
    const hoursMap: Record<number, number> = {
      8: 0, 9: 0, 10: 0, 11: 0, 12: 0, 13: 0,
      14: 0, 15: 0, 16: 0, 17: 0, 18: 0, 19: 0, 20: 0
    };

    periodOrders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      if (!isNaN(orderDate.getTime())) {
        const hour = orderDate.getHours();
        if (hour >= 8 && hour <= 20) {
          hoursMap[hour] = (hoursMap[hour] || 0) + 1;
        }
      }
    });

    return Object.entries(hoursMap).map(([hourStr, count]) => {
      const h = Number(hourStr);
      const isPeak = (h >= 11 && h <= 13) || (h >= 18 && h <= 19);
      return {
        hora: `${h}h`,
        pedidos: count,
        isPeak
      };
    });
  }, [periodOrders]);

  // 6. Desempenho dos Entregadores
  const deliveryFleetStats = useMemo(() => {
    return deliveryPersons.map(person => {
      const assigned = periodOrders.filter(o => o.deliveryPersonId === person.id);
      const completed = assigned.filter(o => o.status === 'Concluído');
      const inRoute = assigned.some(o => o.status === 'Em Rota');
      const totalDeliveredRevenue = completed.reduce((acc, o) => acc + (o.total || 0), 0);

      return {
        id: person.id,
        name: person.name || 'Entregador',
        completedCount: completed.length,
        revenue: totalDeliveredRevenue,
        status: inRoute ? 'Em Rota' : (assigned.some(o => o.status === 'Atribuído') ? 'A caminho' : 'Disponível')
      };
    }).sort((a, b) => b.completedCount - a.completedCount);
  }, [deliveryPersons, periodOrders]);

  // 7. Formas de Pagamento
  const paymentMethodStats = useMemo(() => {
    const counts: Record<string, number> = {
      Pix: 0,
      Cartão: 0,
      Dinheiro: 0
    };

    periodOrders.forEach(o => {
      const method = (o.paymentMethod || '').toLowerCase();
      if (method.includes('pix')) {
        counts.Pix += 1;
      } else if (method.includes('cartão') || method.includes('cartao') || method.includes('crédito') || method.includes('débito')) {
        counts.Cartão += 1;
      } else {
        counts.Dinheiro += 1;
      }
    });

    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;

    return [
      { name: 'Pix', value: counts.Pix, percent: Math.round((counts.Pix / total) * 100), color: '#EAB308' },
      { name: 'Cartão', value: counts.Cartão, percent: Math.round((counts.Cartão / total) * 100), color: '#334155' },
      { name: 'Dinheiro', value: counts.Dinheiro, percent: Math.round((counts.Dinheiro / total) * 100), color: '#10B981' }
    ];
  }, [periodOrders]);

  // 8. Bairros com Mais Entregas
  const neighborhoodStats = useMemo(() => {
    const counts: Record<string, number> = {};
    completedOrders.forEach(o => {
      const b = o.address?.neighborhood || 'Outros';
      counts[b] = (counts[b] || 0) + 1;
    });

    const total = completedOrders.length || 1;
    return Object.entries(counts)
      .map(([neighborhood, count]) => ({
        neighborhood,
        count,
        percent: Math.round((count / total) * 100)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [completedOrders]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 8 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -8 }} 
      className="w-full space-y-4"
    >
      {/* 1. Barra de Topo Compacta e Elegante */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white px-5 py-3 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-yellow-400/20 text-yellow-700 flex items-center justify-center font-black shadow-sm">
            <Flame className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-base leading-tight">
              Cockpit Operacional & Métricas de Vendas
            </h3>
            <p className="text-xs text-slate-400 font-bold">
              {period === 'today' && 'Tempo real: acompanhamento do despacho e entregas de hoje'}
              {period === '7days' && 'Consolidado dos últimos 7 dias'}
              {period === 'month' && 'Consolidado do mês atual'}
              {period === 'custom' && `Período selecionado: ${customStart} até ${customEnd}`}
            </p>
          </div>
        </div>

        {/* Seletor de Período em Pills */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 text-xs">
            <button
              onClick={() => setPeriod('today')}
              className={`px-3.5 py-1.5 rounded-lg font-black transition-all ${
                period === 'today'
                  ? 'bg-yellow-400 text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hoje
            </button>
            <button
              onClick={() => setPeriod('7days')}
              className={`px-3.5 py-1.5 rounded-lg font-black transition-all ${
                period === '7days'
                  ? 'bg-yellow-400 text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7 Dias
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`px-3.5 py-1.5 rounded-lg font-black transition-all ${
                period === 'month'
                  ? 'bg-yellow-400 text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Este Mês
            </button>
            <button
              onClick={() => setPeriod('custom')}
              className={`px-3.5 py-1.5 rounded-lg font-black transition-all ${
                period === 'custom'
                  ? 'bg-yellow-400 text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Personalizado
            </button>
          </div>

          {period === 'custom' && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl text-xs">
              <input 
                type="date" 
                value={customStart} 
                onChange={(e) => setCustomStart(e.target.value)} 
                className="bg-transparent font-bold text-slate-700 focus:outline-none text-xs"
              />
              <span className="text-slate-400">a</span>
              <input 
                type="date" 
                value={customEnd} 
                onChange={(e) => setCustomEnd(e.target.value)} 
                className="bg-transparent font-bold text-slate-700 focus:outline-none text-xs"
              />
            </div>
          )}
        </div>
      </div>

      {/* 2. Top 4 Cards de Resumo Operacional (Altura Aumentada ~130px) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Meta do Período */}
        <div 
          onClick={() => setIsGoalModalOpen(true)}
          className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 hover:border-yellow-400/80 transition-all cursor-pointer group flex flex-col justify-between min-h-[135px]"
          title="Clique para editar as metas de venda"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">
              {period === 'today' ? 'Meta do Dia (P13)' : 'Meta do Período (P13)'}
            </span>
            <span className="text-xs font-black text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-lg border border-yellow-200/60 group-hover:bg-yellow-400 group-hover:text-slate-950 transition-colors flex items-center gap-1">
              <Settings2 className="w-3 h-3" /> Ajustar
            </span>
          </div>

          <div className="flex items-baseline justify-between my-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">
              {p13SoldQuantity} <span className="text-sm font-bold text-slate-400">/ {targetPeriodGoal} un</span>
            </span>
            <span className={`text-sm font-black ${goalProgressPercent >= 100 ? 'text-emerald-600' : 'text-yellow-600'}`}>
              {goalProgressPercent}%
            </span>
          </div>

          <div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-700 ${
                  goalProgressPercent >= 100 ? 'bg-emerald-500' : 'bg-yellow-400'
                }`}
                style={{ width: `${Math.min(goalProgressPercent, 100)}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 mt-1.5">
              <span>Falta: {Math.max(0, targetPeriodGoal - p13SoldQuantity)} botijões</span>
              <span>{period === 'today' ? 'Meta do Dia' : 'Acumulada'}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Tempo Médio de Entrega */}
        <div 
          onClick={() => setIsDeliveryTimeModalOpen(true)}
          className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between min-h-[135px] group relative overflow-hidden"
          title="Clique para ver o relatório detalhado de tempo de entrega por pedido"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100/80 group-hover:scale-105 transition-transform">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
              avgDeliveryTimeMinutes > 0 && avgDeliveryTimeMinutes <= 30 
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                : avgDeliveryTimeMinutes > 30 
                ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                : 'bg-slate-100 text-slate-600'
            }`}>
              Meta: &lt; 30 min
            </span>
          </div>

          <div className="my-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-0.5">
              TEMPO MÉDIO DE ENTREGA
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-slate-900">
                {avgDeliveryTimeMinutes > 0 ? avgDeliveryTimeMinutes : '--'}
              </span>
              <span className="text-sm font-bold text-slate-400">minutos</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-50">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
              {avgDeliveryTimeMinutes > 0 && avgDeliveryTimeMinutes <= 30 ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>SLA operacional no alvo</span>
                </>
              ) : avgDeliveryTimeMinutes > 30 ? (
                <>
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <span className="text-amber-600">Acima da meta operacional</span>
                </>
              ) : (
                <span className="text-slate-400 font-semibold">Sem entregas no período</span>
              )}
            </div>
            <span className="text-[11px] font-bold text-blue-600 group-hover:underline flex items-center gap-0.5">
              Ver pedidos &rarr;
            </span>
          </div>
        </div>

        {/* Card 3: Satisfação do Cliente */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between min-h-[135px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">
              Satisfação
            </span>
            <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">
              {satisfactionStats.totalReviews} avaliações
            </span>
          </div>

          <div className="flex items-baseline justify-between my-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900">{satisfactionStats.avgRating}</span>
              <div className="flex text-amber-400">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star 
                    key={s} 
                    className={`w-4 h-4 ${s <= Math.round(satisfactionStats.avgRating) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} 
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="text-xs font-bold text-slate-500">
            <span className="text-emerald-600 font-black">{satisfactionStats.percentPositive}%</span> clientes deram nota 5
          </div>
        </div>

        {/* Card 4: Faturamento Total */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between min-h-[135px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">
              Faturamento
            </span>
            <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-lg">
              {completedOrders.length} entregas
            </span>
          </div>

          <div className="flex items-baseline justify-between my-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">
              R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span>Ticket Médio:</span>
            <span className="font-black text-slate-700">R$ {avgTicket.toFixed(2)}</span>
          </div>
        </div>

      </div>

      {/* 3. Grid Operacional Integrado (Cards Mais Altos com Altura Bem Aproveitada) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Coluna 1 (5/12): Picos por Hora + Bairros */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          
          {/* Picos de Pedidos por Hora (Gráfico Mais Alto ~180px) */}
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-yellow-500" /> Picos de Pedidos por Hora
                </h4>
                <p className="text-xs text-slate-400 font-bold">Concentração para escala da frota</p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1 font-bold text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" /> Horário de Pico
                </span>
                <span className="flex items-center gap-1 font-bold text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" /> Normal
                </span>
              </div>
            </div>

            <div className="h-44 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <XAxis 
                    dataKey="hora" 
                    tickLine={false} 
                    axisLine={false} 
                    fontSize={11} 
                    stroke="#94a3b8" 
                  />
                  <YAxis 
                    allowDecimals={false} 
                    tickLine={false} 
                    axisLine={false} 
                    fontSize={11} 
                    stroke="#94a3b8" 
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white px-3 py-1.5 rounded-xl text-xs space-y-0.5">
                            <span className="font-black text-yellow-400">{data.hora}: </span>
                            <span>{data.pedidos} pedidos {data.isPeak ? '🔥 (Pico)' : ''}</span>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="pedidos" radius={[6, 6, 0, 0]}>
                    {hourlyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.isPeak ? '#EAB308' : '#cbd5e1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bairros com Maior Volume (Mais Alto e Espaçoso) */}
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-red-500" /> Bairros com Mais Entregas
              </h4>
              <span className="text-xs text-slate-400 font-bold">Área de cobertura</span>
            </div>

            <div className="space-y-2.5">
              {neighborhoodStats.map(item => (
                <div key={item.neighborhood} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">{item.neighborhood}</span>
                    <span className="font-black text-slate-900">
                      {item.count} entregas <span className="text-slate-400 font-normal">({item.percent}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </div>
              ))}
              {neighborhoodStats.length === 0 && (
                <div className="py-4 text-center text-slate-400 text-xs font-bold">
                  Nenhum dado de bairro no período.
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Coluna 2 (4/12): Desempenho dos Entregadores (Altura Aumentada ~420px) */}
        <div className="lg:col-span-4 bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between min-h-[420px]">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-yellow-500" /> Desempenho dos Entregadores
              </h4>
              <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-xl">
                {deliveryPersons.length} ativos
              </span>
            </div>

            <div className="overflow-y-auto max-h-[330px] pr-1 divide-y divide-slate-50">
              {deliveryFleetStats.map((d, idx) => (
                <div key={d.id || idx} className="py-3 flex items-center justify-between text-xs hover:bg-slate-50 px-2 rounded-2xl transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-yellow-400/20 text-yellow-800 font-black flex items-center justify-center text-xs">
                      {d.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm leading-tight">{d.name}</p>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                        Faturado: R$ {d.revenue.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg text-xs">
                      {d.completedCount} ent.
                    </span>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                      d.status === 'Em Rota'
                        ? 'bg-amber-100 text-amber-800'
                        : d.status === 'A caminho'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {d.status}
                    </span>
                  </div>
                </div>
              ))}

              {deliveryFleetStats.length === 0 && (
                <div className="py-12 text-center text-slate-400 font-bold text-xs">
                  Nenhum entregador com entregas no período.
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-50 flex items-center justify-between text-xs font-bold text-slate-400">
            <span>Total no Período:</span>
            <span className="font-black text-slate-800">{completedOrders.length} entregas concluídas</span>
          </div>
        </div>

        {/* Coluna 3 (3/12): Meios de Pagamento (Altura Aumentada ~420px) */}
        <div className="lg:col-span-3 bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between min-h-[420px]">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-500" /> Meios de Pagamento
              </h4>
            </div>
            <p className="text-xs text-slate-400 font-bold mb-3">Divisão percentual das vendas</p>

            <div className="h-44 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentMethodStats}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={46}
                    outerRadius={72}
                    paddingAngle={4}
                  >
                    {paymentMethodStats.map((entry, index) => (
                      <Cell key={`cell-pay-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white px-2.5 py-1.5 rounded-xl text-xs">
                            <span className="font-bold">{data.name}: </span>
                            <span className="font-black text-yellow-400">{data.value} ({data.percent}%)</span>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legenda com Mais Espaço */}
            <div className="space-y-2.5 pt-2">
              {paymentMethodStats.map(item => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="font-bold text-slate-700">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">{item.value} un</span>
                    <span className="font-black text-slate-900">{item.percent}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-50 text-xs text-slate-400 font-bold text-center">
            {periodOrders.length} transações analisadas
          </div>
        </div>

      </div>

      {/* Modal de Configuração de Metas */}
      <GoalSettingsModal 
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        config={goalConfig}
        onSave={(newConfig) => setGoalConfig(newConfig)}
      />

      {/* Modal de Detalhes dos Tempos de Entrega */}
      <DeliveryTimeDetailsModal
        isOpen={isDeliveryTimeModalOpen}
        onClose={() => setIsDeliveryTimeModalOpen(false)}
        periodLabel={periodLabel}
        items={deliveryStats.items}
        avgMinutes={deliveryStats.avgMinutes}
        withinSlaCount={deliveryStats.withinSlaCount}
        overSlaCount={deliveryStats.overSlaCount}
        bestTime={deliveryStats.bestTime}
        worstTime={deliveryStats.worstTime}
        onSelectOrder={onSelectOrder}
      />

    </motion.div>
  );
};

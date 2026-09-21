import React, { useState, useMemo } from 'react';
import { 
  X, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Calendar, 
  User, 
  MapPin, 
  Truck, 
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Order } from '../../types';

export interface DeliveryTimeItem {
  order: Order;
  minutes: number;
  deliveryPersonName: string;
  withinSla: boolean;
}

interface DeliveryTimeDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  periodLabel: string;
  items: DeliveryTimeItem[];
  avgMinutes: number;
  withinSlaCount: number;
  overSlaCount: number;
  bestTime: number;
  worstTime: number;
  onSelectOrder?: (order: Order) => void;
}

export const DeliveryTimeDetailsModal: React.FC<DeliveryTimeDetailsModalProps> = ({
  isOpen,
  onClose,
  periodLabel,
  items,
  avgMinutes,
  withinSlaCount,
  overSlaCount,
  bestTime,
  worstTime,
  onSelectOrder
}) => {
  const [search, setSearch] = useState('');
  const [filterSla, setFilterSla] = useState<'all' | 'within' | 'over'>('all');

  const filteredItems = useMemo(() => {
    return items.filter(it => {
      const q = search.toLowerCase();
      const matchesSearch = !q ||
        it.order.id.toLowerCase().includes(q) ||
        it.order.customerName.toLowerCase().includes(q) ||
        (it.order.address?.neighborhood || '').toLowerCase().includes(q) ||
        it.deliveryPersonName.toLowerCase().includes(q);

      const matchesFilter = filterSla === 'all' 
        ? true 
        : filterSla === 'within' 
        ? it.withinSla 
        : !it.withinSla;

      return matchesSearch && matchesFilter;
    });
  }, [items, search, filterSla]);

  const slaPercentage = items.length > 0 ? Math.round((withinSlaCount / items.length) * 100) : 100;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[9995] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        className="bg-white w-full max-w-4xl rounded-[2rem] shadow-2xl overflow-hidden my-auto border border-slate-100 flex flex-col max-h-[92vh]"
      >
        {/* Topo do Modal */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 relative shrink-0">
          <div className="flex items-start justify-between pr-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-400/30 text-blue-400 flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 px-2.5 py-0.5 rounded-lg border border-blue-400/30">
                    Relatório de SLA
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {periodLabel}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black mt-1 text-white">
                  Tempos de Entrega por Pedido
                </h2>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* KPIs Resumo */}
        <div className="p-4 sm:p-6 bg-slate-50 border-b border-slate-100 grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
              Tempo Médio
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black text-slate-900">
                {avgMinutes > 0 ? avgMinutes : '--'}
              </span>
              <span className="text-xs font-bold text-slate-400">minutos</span>
            </div>
            <span className={`text-[10px] font-bold mt-1 inline-block ${avgMinutes <= 30 ? 'text-emerald-600' : 'text-amber-600'}`}>
              Meta: &lt; 30 min
            </span>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
              No Alvo (SLA &le; 30m)
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black text-emerald-600">
                {slaPercentage}%
              </span>
              <span className="text-xs font-bold text-slate-400">
                ({withinSlaCount}/{items.length})
              </span>
            </div>
            <span className="text-[10px] font-bold text-slate-400 mt-1 inline-block">
              {overSlaCount > 0 ? `${overSlaCount} pedidos fora da meta` : '100% dentro da meta'}
            </span>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
              Entrega Mais Rápida
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black text-blue-600">
                {bestTime > 0 ? `${bestTime}m` : '--'}
              </span>
            </div>
            <span className="text-[10px] font-bold text-emerald-600 mt-1 inline-block">
              Melhor marca do período
            </span>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
              Total de Entregas
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black text-slate-900">
                {items.length}
              </span>
              <span className="text-xs font-bold text-slate-400">pedidos</span>
            </div>
            <span className="text-[10px] font-bold text-slate-400 mt-1 inline-block">
              Período selecionado
            </span>
          </div>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="p-4 sm:px-6 bg-white border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por #pedido, cliente, bairro ou entregador..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setFilterSla('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterSla === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Todos ({items.length})
            </button>
            <button
              onClick={() => setFilterSla('within')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                filterSla === 'within'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              &le; 30m ({withinSlaCount})
            </button>
            <button
              onClick={() => setFilterSla('over')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                filterSla === 'over'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-amber-700 hover:bg-amber-50'
              }`}
            >
              &gt; 30m ({overSlaCount})
            </button>
          </div>
        </div>

        {/* Tabela de Pedidos */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 custom-scrollbar space-y-2.5">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400">
              <Clock className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="font-bold text-sm text-slate-600">Nenhum pedido encontrado no filtro selecionado.</p>
              <p className="text-xs text-slate-400 mt-1">Alterne o filtro de SLA ou ajuste a busca acima.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    <th className="py-3 px-3.5">Pedido</th>
                    <th className="py-3 px-3.5">Cliente & Bairro</th>
                    <th className="py-3 px-3.5">Entregador</th>
                    <th className="py-3 px-3.5 text-center">Início &rarr; Conclusão</th>
                    <th className="py-3 px-3.5 text-center">Tempo Decorrido</th>
                    <th className="py-3 px-3.5 text-center">Status SLA</th>
                    <th className="py-3 px-3.5 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map(({ order, minutes, deliveryPersonName, withinSla }) => {
                    const createdDate = new Date(order.createdAt);
                    const compDateStr = order.completedAt || order.estimatedArrival;
                    const compDate = compDateStr ? new Date(compDateStr) : null;

                    const createdTimeFormatted = !isNaN(createdDate.getTime())
                      ? createdDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                      : '--:--';

                    const compTimeFormatted = compDate && !isNaN(compDate.getTime())
                      ? compDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                      : '--:--';

                    const dateFormatted = !isNaN(createdDate.getTime())
                      ? createdDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                      : '';

                    return (
                      <tr 
                        key={order.id} 
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                              #{order.id}
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold">
                              {dateFormatted}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-3.5">
                          <div className="font-bold text-slate-800">{order.customerName}</div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{order.address?.neighborhood || 'Bairro não informado'}</span>
                          </div>
                        </td>

                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                            <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{deliveryPersonName}</span>
                          </div>
                        </td>

                        <td className="py-3 px-3.5 text-center whitespace-nowrap">
                          <div className="text-slate-600 font-semibold">
                            {createdTimeFormatted} &rarr; <span className="font-bold text-slate-900">{compTimeFormatted}</span>
                          </div>
                        </td>

                        <td className="py-3 px-3.5 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black ${
                            withinSla 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            <Clock className="w-3 h-3" />
                            <span>{minutes} min</span>
                          </span>
                        </td>

                        <td className="py-3 px-3.5 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                            withinSla 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {withinSla ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                No Alvo (&le;30m)
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                Acima da Meta
                              </>
                            )}
                          </span>
                        </td>

                        <td className="py-3 px-3.5 text-right whitespace-nowrap">
                          {onSelectOrder && (
                            <button
                              onClick={() => {
                                onSelectOrder(order);
                                onClose();
                              }}
                              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2.5 py-1 rounded-lg transition-colors"
                              title="Abrir detalhes completos deste pedido"
                            >
                              <span>Ver pedido</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0 text-xs text-slate-500">
          <span>Exibindo {filteredItems.length} de {items.length} pedidos concluídos</span>
          <button
            onClick={onClose}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-xl transition-colors"
          >
            Fechar Relatório
          </button>
        </div>
      </motion.div>
    </div>
  );
};

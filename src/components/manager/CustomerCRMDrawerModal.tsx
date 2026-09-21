import React, { useState } from 'react';
import { 
  X, 
  User, 
  Phone, 
  MapPin, 
  Calendar, 
  Clock, 
  ShoppingBag, 
  DollarSign, 
  MessageSquare, 
  Ticket, 
  Star, 
  AlertCircle,
  CheckCircle2,
  Gift,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppUser, Order } from '../../types';
import { PRODUCTS } from '../../constants';

export interface CustomerPredictionItem {
  customer: AppUser;
  totalOrders: number;
  totalQuantity: number;
  avgInterval: number;
  nextPrediction: Date | null;
  daysSinceLastOrder: number;
  isOverdue: boolean;
  isEndingSoon: boolean;
  isOneTime: boolean;
  isLoyal: boolean;
  history: Order[];
}

interface CustomerCRMDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  predictionItem: CustomerPredictionItem | null;
  onSendCoupon?: (customer: AppUser) => void;
}

export const CustomerCRMDrawerModal: React.FC<CustomerCRMDrawerModalProps> = ({
  isOpen,
  onClose,
  predictionItem,
  onSendCoupon
}) => {
  const [copiedPhone, setCopiedPhone] = useState(false);

  if (!isOpen || !predictionItem) return null;

  const { 
    customer, 
    totalOrders, 
    totalQuantity, 
    avgInterval, 
    nextPrediction, 
    daysSinceLastOrder,
    isOverdue, 
    isEndingSoon, 
    isOneTime, 
    history 
  } = predictionItem;

  const primaryAddress = customer.addresses?.[0];
  const cleanPhone = (customer.phone || '').replace(/\D/g, '');

  const totalSpent = history.reduce((acc, o) => acc + (o.total || 0), 0);
  const avgTicket = totalOrders > 0 ? totalSpent / totalOrders : 0;

  const handleCopyPhone = () => {
    if (customer.phone) {
      navigator.clipboard.writeText(customer.phone);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    }
  };

  const handleSendWhatsAppReminder = () => {
    if (!cleanPhone) {
      alert('Cliente sem telefone cadastrado.');
      return;
    }
    const firstName = customer.name.split(' ')[0] || 'Cliente';
    const text = isOneTime
      ? `Olá, ${firstName}! Tudo bem? Esperamos que esteja tudo ótimo com o seu botijão de gás da Porto Gás. Quando precisar de uma nova recarga ou água mineral, é só pedir aqui pelo WhatsApp ou no nosso aplicativo com entrega rápida!`
      : `Olá, ${firstName}! Tudo bem? Notamos que seu botijão de gás deve estar perto de acabar (último pedido foi há ${daysSinceLastOrder} dias). Para não correr o risco de ficar sem gás no meio da refeição, responda aqui para agendar sua entrega!`;

    const url = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleSendWhatsAppPromotion = () => {
    if (!cleanPhone) {
      alert('Cliente sem telefone cadastrado.');
      return;
    }
    const firstName = customer.name.split(' ')[0] || 'Cliente';
    const text = `Olá, ${firstName}! Separamos uma condição especial para o seu próximo pedido de gás na Porto Gás. Aproveite para repor seu botijão hoje mesmo com entrega expressa!`;
    const url = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        exit={{ scale: 0.95, opacity: 0 }} 
        className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Top Header */}
        <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-yellow-400 text-slate-950 font-black text-xl flex items-center justify-center shadow-md">
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-slate-900">{customer.name}</h3>
                {isOneTime && (
                  <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase">
                    1ª Compra
                  </span>
                )}
                {isEndingSoon && (
                  <span className="text-[10px] font-black bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full uppercase">
                    Gás Acabando
                  </span>
                )}
                {isOverdue && (
                  <span className="text-[10px] font-black bg-red-100 text-red-700 px-2 py-0.5 rounded-full uppercase">
                    Previsão Vencida
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500 font-bold">
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {customer.phone || 'Sem telefone'}
                </span>
                {customer.phone && (
                  <button 
                    onClick={handleCopyPhone} 
                    className="text-[11px] text-yellow-600 hover:text-yellow-700 flex items-center gap-1 bg-yellow-50 px-2 py-0.5 rounded-md"
                    title="Copiar telefone"
                  >
                    {copiedPhone ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copiedPhone ? 'Copiado!' : 'Copiar'}
                  </button>
                )}
                {primaryAddress && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {primaryAddress.neighborhood} - {primaryAddress.city}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">

          {/* Cards de Diagnóstico de Consumo & Financeiro */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase">Ciclo Médio</p>
              <p className="text-lg font-black text-slate-900 mt-0.5">
                {avgInterval > 0 ? `${Math.round(avgInterval)} dias` : 'Padrão (~35d)'}
              </p>
              <p className="text-[10px] text-slate-400 font-bold">Intervalo entre botijões</p>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase">Último Pedido</p>
              <p className="text-lg font-black text-slate-900 mt-0.5">
                {daysSinceLastOrder} dias atrás
              </p>
              <p className="text-[10px] text-slate-400 font-bold">Desde a última compra</p>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase">Total Compras (LTV)</p>
              <p className="text-lg font-black text-emerald-600 mt-0.5">
                R$ {totalSpent.toFixed(2)}
              </p>
              <p className="text-[10px] text-slate-400 font-bold">{totalOrders} pedidos ({totalQuantity} un)</p>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase">Ticket Médio</p>
              <p className="text-lg font-black text-slate-900 mt-0.5">
                R$ {avgTicket.toFixed(2)}
              </p>
              <p className="text-[10px] text-slate-400 font-bold">Por pedido</p>
            </div>
          </div>

          {/* Endereço Completo */}
          {primaryAddress && (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-yellow-100 text-yellow-700 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <p className="font-black text-slate-800">Endereço Principal de Entrega</p>
                <p className="text-slate-600 mt-0.5 font-bold">
                  {primaryAddress.street}, nº {primaryAddress.number}
                  {primaryAddress.complement ? ` (${primaryAddress.complement})` : ''}
                </p>
                <p className="text-slate-400">
                  {primaryAddress.neighborhood} • {primaryAddress.city} - CEP: {primaryAddress.cep}
                  {primaryAddress.reference ? ` • Ref: ${primaryAddress.reference}` : ''}
                </p>
              </div>
            </div>
          )}

          {/* Ações Rápidas de Disparo WhatsApp */}
          <div className="space-y-3">
            <h4 className="font-black text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-green-500" /> Ações Rápidas de Contato (WhatsApp 1-Click)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button 
                type="button" 
                onClick={handleSendWhatsAppReminder}
                className="bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                <MessageSquare className="w-4 h-4" /> Disparar Lembrete de Gás Acabando
              </button>
              <button 
                type="button" 
                onClick={handleSendWhatsAppPromotion}
                className="bg-slate-900 hover:bg-slate-800 text-white p-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                <Ticket className="w-4 h-4 text-yellow-400" /> Disparar Cupom / Promoção
              </button>
            </div>
          </div>

          {/* Histórico Completo de Pedidos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-yellow-500" /> Histórico de Pedidos ({history.length})
              </h4>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {[...history].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((order) => (
                <div 
                  key={order.id} 
                  className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-slate-800">#{order.id}</span>
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase ${
                        order.status === 'Concluído' ? 'bg-green-100 text-green-700' :
                        order.status === 'Cancelado' ? 'bg-red-100 text-red-700' :
                        order.status === 'Em Rota' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {order.status}
                      </span>
                      <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-black text-[10px]">
                        {order.paymentMethod}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {new Date(order.createdAt).toLocaleDateString()} às {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Itens */}
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {order.items.map((item, idx) => (
                        <span key={idx} className="bg-white border border-slate-200 text-slate-800 px-2 py-0.5 rounded-lg font-bold text-[11px]">
                          {item.quantity}x {PRODUCTS.find(p => p.id === item.productId)?.name || item.productId}
                        </span>
                      ))}
                      {order.selectedFreebie && (
                        <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-lg font-bold text-[11px] flex items-center gap-1">
                          <Gift className="w-3 h-3 text-yellow-700" /> {order.selectedFreebie}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <div className="text-right">
                      <p className="font-black text-slate-900 text-sm">
                        R$ {order.total.toFixed(2)}
                      </p>
                      {order.discount && order.discount > 0 && (
                        <p className="text-[10px] text-emerald-600 font-bold">
                          Desc: -R$ {order.discount.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {history.length === 0 && (
                <div className="p-6 text-center text-slate-400 font-bold text-xs bg-slate-50 rounded-2xl">
                  Nenhum pedido registrado para este cliente.
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Rodapé */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400">
            {totalOrders} pedido(s) concluído(s) no total
          </span>
          <button 
            type="button" 
            onClick={onClose}
            className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl transition-colors"
          >
            Fechar Ficha
          </button>
        </div>

      </motion.div>
    </div>
  );
};

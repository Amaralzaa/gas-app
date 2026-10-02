import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Users, 
  CreditCard, 
  Loader2, 
  Check, 
  AlertCircle, 
  Calendar, 
  Zap, 
  Sun, 
  Sunset, 
  Moon,
  ShoppingCart,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { createCirclePolygon, haversineKm, estimateMinutes, fetchOsrmRoute } from '../utils/geoUtils';
import { AppUser, Order, Address, Product, CoverageArea, Coupon, Reward, Referral, PointHistoryItem, BenefitsConfig, BusinessInfo, DeliveryPeriod, RedeemedReward, OpeningHours, DayHours } from '../types';
import { PRODUCTS } from '../constants';
import { businessService, DEFAULT_DELIVERY_PERIODS, DEFAULT_BUSINESS_INFO } from '../services/businessService';
import { userService } from '../services/userService';
import { codeService } from '../services/codeService';
import { rewardService } from '../services/rewardService';

const houseIcon = L.divIcon({ html: '<div style="font-size:28px">🏠</div>', className: '', iconAnchor: [14,28] });
const motoIcon  = L.divIcon({ html: '<div style="font-size:28px">🛵</div>', className: '', iconAnchor: [14,28] });

interface CustomerDashboardProps {
  user: AppUser;
  orders: Order[];
  onOrderCreated: (order: Order) => Promise<void>;
  onUpdateUser: (user: AppUser) => void;
  initialTab?: 'home' | 'history' | 'referral' | 'profile' | 'tracking';
  coverageAreas: CoverageArea[];
  coupons: Coupon[];
  rewards: Reward[];
  referrals: Referral[];
  onAddReferral: (referral: Referral) => void;
  onUpdateReferral?: (referral: Referral) => void;
  onDeleteReferral?: (id: string) => void;
  allUsers?: AppUser[];
  allDeliveryPersons?: AppUser[];
  onUpdateOrder?: (order: Order) => void;
  benefitsConfig?: BenefitsConfig;
  onLogout?: () => void;
  businessInfo?: BusinessInfo;
}

export interface ScheduledDateOption {
  isoDate: string;
  dayLabel: string;
  shortDate: string;
  fullDisplay: string;
  isOpen?: boolean;
}

// ScheduledPeriodSelector — Seletor dinâmico de turnos e dias de agendamento
const ScheduledPeriodSelector: React.FC<{
  periods: DeliveryPeriod[];
  selectedId: string;
  onSelect: (id: string) => void;
  availableDates?: ScheduledDateOption[];
  selectedDateISO?: string;
  onSelectDate?: (isoDate: string) => void;
  dateInfo: { display: string };
}> = ({ periods, selectedId, onSelect, availableDates = [], selectedDateISO, onSelectDate, dateInfo }) => {
  const selected = periods.find(p => p.id === selectedId) || periods[0];

  return (
    <div className="bg-purple-50/70 border border-purple-200 p-3.5 rounded-2xl space-y-3 shadow-xs">
      {/* Seletor de Datas da Semana (Carrossel Horizontal) */}
      {availableDates.length > 0 && onSelectDate && (
        <div className="space-y-2 pb-1 border-b border-purple-200/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-purple-950 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-purple-600" />
              Selecione o Dia da Entrega:
            </span>
            <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full border border-purple-200">
              Próximos 7 dias
            </span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1.5 pt-0.5 custom-scrollbar">
            {availableDates.map(d => {
              const isSelectedDate = d.isoDate === selectedDateISO;
              const isClosed = d.isOpen === false;

              return (
                <button
                  key={d.isoDate}
                  type="button"
                  disabled={isClosed}
                  onClick={() => !isClosed && onSelectDate(d.isoDate)}
                  className={`flex-shrink-0 px-3 py-2 rounded-xl border text-center transition-all ${
                    isClosed
                      ? 'bg-slate-100 text-slate-400 border-slate-200 opacity-60 cursor-not-allowed'
                      : isSelectedDate
                      ? 'bg-purple-600 text-white border-purple-600 shadow-md font-black scale-105 cursor-pointer'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-purple-100/70 hover:border-purple-300 cursor-pointer'
                  }`}
                  title={isClosed ? 'Fechado neste dia (sem entregas agendadas)' : undefined}
                >
                  <span className={`block text-[10px] uppercase font-bold ${
                    isClosed ? 'text-slate-400' : isSelectedDate ? 'text-purple-100' : 'text-slate-400'
                  }`}>
                    {d.dayLabel}
                  </span>
                  <span className="block text-xs font-black">{d.shortDate}</span>
                  {isClosed && (
                    <span className="block text-[8px] font-black text-red-500 uppercase mt-0.5">Fechado</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs font-black text-purple-950 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-purple-600" />
          Turnos para {dateInfo.display}:
        </span>
        <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full border border-purple-200">
          {periods.length} {periods.length === 1 ? 'turno disponível' : 'turnos disponíveis'}
        </span>
      </div>

      {/* Lista de Períodos com a bolinha à esquerda */}
      <div className="space-y-2">
        {periods.map(period => {
          const isSelected = selected?.id === period.id;
          const isMorning = period.icon === 'sun' || period.name.toLowerCase().includes('manh');
          const isAfternoon = period.icon === 'sunset' || period.name.toLowerCase().includes('tarde');
          const isNight = period.icon === 'moon' || period.name.toLowerCase().includes('noite');

          return (
            <div
              key={period.id}
              onClick={() => onSelect(period.id)}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-white border-purple-500 ring-2 ring-purple-400 shadow-sm'
                  : 'bg-white/80 border-slate-200 hover:bg-white hover:border-slate-300'
              }`}
            >
              {/* Bolinha de rádio à esquerda */}
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                isSelected ? 'border-purple-600 bg-purple-600' : 'border-slate-300 bg-white'
              }`}>
                {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>

              {/* Ícone e dados do período */}
              <div className="flex-1 min-w-0">
                <p className="font-black text-xs text-slate-900 flex items-center gap-1.5">
                  {isMorning && <Sun className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                  {isAfternoon && <Sunset className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />}
                  {isNight && <Moon className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />}
                  {!isMorning && !isAfternoon && !isNight && <Clock className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />}
                  <span className="truncate">{period.name}</span>
                </p>
                <p className="text-[11px] text-slate-500 font-medium">
                  {period.startTime} às {period.endTime}
                </p>
              </div>

              {isSelected && (
                <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full flex-shrink-0">
                  Selecionado
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Frase solicitada pelo usuário em destaque */}
      {selected && (
        <div className="bg-white/90 border border-purple-200 p-3 rounded-xl flex items-start gap-2.5 text-purple-950 shadow-xs">
          <Truck className="w-4 h-4 text-purple-700 mt-0.5 flex-shrink-0" />
          <p className="text-xs font-bold leading-relaxed">
            Seu gás será entregue em{' '}
            <span className="font-black text-purple-900">{dateInfo.display}</span> no período de{' '}
            <span className="font-black text-purple-800 underline decoration-purple-400 decoration-2">
              {selected.startTime} às {selected.endTime}
            </span>.
          </p>
        </div>
      )}
    </div>
  );
};

const RATING_IMPROVEMENT_TAGS = [
  'Demora na entrega',
  'Falta de troco',
  'Botijão com marcas ou sujo',
  'Atendimento / Comunicação',
  'Dificuldade com endereço',
  'Outro',
] as const;

// HistoryCard — card expansível de histórico de pedidos
const HistoryCard: React.FC<{ 
  order: Order; 
  onReorder: (order: Order) => void; 
  onRate?: (order: Order, service: number, delivery: number, feedback?: string) => void;
  onTrack?: (order: Order) => void;
  onCancel?: (order: Order) => void;
  onSkip?: (order: Order) => void;
}> = ({ order, onReorder, onRate, onTrack, onCancel, onSkip }) => {
  const [expanded, setExpanded] = React.useState(false);
  const [isRating, setIsRating] = React.useState(false);
  const [cardServiceStars, setCardServiceStars] = React.useState(0);
  const [cardDeliveryStars, setCardDeliveryStars] = React.useState(0);
  const [cardFeedbackTags, setCardFeedbackTags] = React.useState<string[]>([]);
  const [cardFeedbackComment, setCardFeedbackComment] = React.useState('');

  const statusColor = order.status === 'Concluído' ? 'bg-green-100 text-green-700' :
    order.status === 'Em Rota' ? 'bg-blue-100 text-blue-700' :
    order.status === 'Cancelado' ? 'bg-red-100 text-red-700' :
    'bg-yellow-100 text-yellow-700';

  const scheduledPeriodLabel = order.scheduledPeriodName 
    || (order.scheduledPeriod === 'manha' ? 'Manhã' : order.scheduledPeriod === 'tarde' ? 'Tarde' : order.scheduledPeriod === 'noite' ? 'Noite' : order.scheduledPeriod);

  const hasLowerThan5Stars = (cardServiceStars > 0 && cardServiceStars < 5) || (cardDeliveryStars > 0 && cardDeliveryStars < 5);

  const handleSendRate = () => {
    if (!cardServiceStars || !cardDeliveryStars) return;
    const parts: string[] = [];
    if (cardFeedbackTags.length > 0) {
      parts.push(`[Motivos: ${cardFeedbackTags.join(', ')}]`);
    }
    if (cardFeedbackComment.trim()) {
      parts.push(cardFeedbackComment.trim());
    }
    const finalFb = parts.join(' - ');
    onRate?.(order, cardServiceStars, cardDeliveryStars, finalFb || undefined);
    setIsRating(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <button onClick={() => setExpanded(e => !e)} className="w-full p-4 text-left">
        <div className="flex justify-between items-start mb-1">
          <span className="text-xs font-black text-slate-400">#{order.id}</span>
          <div className="flex items-center gap-1.5">
            {order.isScheduled && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded uppercase bg-purple-100 text-purple-800 border border-purple-200">
                📅 {scheduledPeriodLabel || 'Agendado'} {order.scheduledTimeRange ? `(${order.scheduledTimeRange})` : ''}
              </span>
            )}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${statusColor}`}>{order.status}</span>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <div>
            <p className="font-black text-slate-900">R$ {order.total.toFixed(2)}</p>
            <p className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })} · {order.paymentMethod}</p>
          </div>
          <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-50 pt-3">
          {/* Itens */}
          <div className="space-y-1">
            {order.items.map((item, idx) => {
              const productNames: Record<string, string> = { p13: 'Gás P13', p45: 'Gás P45', water20: 'Água 20L' };
              return (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-slate-600">{item.quantity}x {productNames[item.productId] || item.productId}</span>
                  <span className="font-bold text-slate-900">R$ {(item.priceAtTime * item.quantity).toFixed(2)}</span>
                </div>
              );
            })}
            {order.discount && order.discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Desconto ({order.couponCode})</span>
                <span className="font-bold">- R$ {order.discount.toFixed(2)}</span>
              </div>
            )}
          </div>
          {/* Endereço */}
          <div className="bg-slate-50 p-3 rounded-xl text-xs text-slate-500">
            <MapPin className="w-3 h-3 inline mr-1 text-yellow-500" />
            {order.address.street}, {order.address.number} — {order.address.neighborhood}
          </div>

          {/* Ações para Pedidos em Andamento */}
          {order.status !== 'Concluído' && order.status !== 'Cancelado' && (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTrack?.(order);
                }}
                className="bg-yellow-400 hover:bg-yellow-500 text-slate-900 py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
              >
                <Navigation className="w-3.5 h-3.5" /> RASTREAR PEDIDO
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel?.(order);
                }}
                className={`py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all ${
                  order.status === 'Pendente'
                    ? 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-400 border border-slate-200'
                }`}
              >
                <X className="w-3.5 h-3.5" /> CANCELAR PEDIDO
              </button>
            </div>
          )}

          {order.status === 'Cancelado' && (
            <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-3 text-center text-xs font-bold space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-red-700">
                <AlertCircle className="w-4 h-4 text-red-500" /> Pedido Cancelado
              </div>
              {order.cancellationReason && (
                <div className="text-[11px] font-medium text-red-600 bg-white/80 py-1.5 px-2.5 rounded-lg border border-red-100 mt-1">
                  <strong>Motivo:</strong> {order.cancellationReason}
                </div>
              )}
            </div>
          )}
          
          {/* Avaliação */}
          {order.status === 'Concluído' && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mt-2">
              {order.rating ? (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-400 uppercase">Sua Avaliação</p>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600 font-medium">Porto Gás</span>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map(s => <Star key={s} className={`w-3 h-3 ${s <= (order.serviceRating || order.rating || 0) ? 'text-yellow-400 fill-current' : 'text-slate-200'}`} />)}
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600 font-medium">Entregador</span>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map(s => <Star key={s} className={`w-3 h-3 ${s <= (order.deliveryRating || order.rating || 0) ? 'text-yellow-400 fill-current' : 'text-slate-200'}`} />)}
                    </div>
                  </div>
                </div>
              ) : isRating ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold text-slate-900 mb-1">Porto Gás</p>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button key={star} onClick={() => setCardServiceStars(star)}>
                          <Star className={`w-5 h-5 ${star <= cardServiceStars ? 'text-yellow-400 fill-current' : 'text-slate-300'}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 mb-1">Entregador</p>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button key={star} onClick={() => setCardDeliveryStars(star)}>
                          <Star className={`w-5 h-5 ${star <= cardDeliveryStars ? 'text-yellow-400 fill-current' : 'text-slate-300'}`} />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Campo de O que faltou para 5 estrelas */}
                  {hasLowerThan5Stars && (
                    <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 space-y-2 text-left">
                      <div className="flex items-center gap-1.5 text-amber-900">
                        <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                        <span className="text-[11px] font-black uppercase">O que faltou para 5 estrelas?</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {RATING_IMPROVEMENT_TAGS.map(tag => {
                          const isSelected = cardFeedbackTags.includes(tag);
                          return (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => {
                                setCardFeedbackTags(prev =>
                                  prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                                );
                              }}
                              className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                                isSelected
                                  ? 'bg-amber-500 text-slate-950 border-amber-600'
                                  : 'bg-white text-slate-600 border-amber-200 hover:bg-amber-100/50'
                              }`}
                            >
                              {isSelected && '✓ '}{tag}
                            </button>
                          );
                        })}
                      </div>
                      <textarea
                        rows={2}
                        value={cardFeedbackComment}
                        onChange={(e) => setCardFeedbackComment(e.target.value)}
                        placeholder="Comentário opcional sobre o atendimento/entrega..."
                        className="w-full text-xs p-2 rounded-lg bg-white border border-amber-200 text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-amber-400 outline-none resize-none font-medium"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <button 
                      disabled={!cardServiceStars || !cardDeliveryStars}
                      onClick={handleSendRate}
                      className="w-full bg-slate-900 text-white py-2 rounded-lg text-xs font-black hover:bg-slate-800 disabled:opacity-50"
                    >
                      ENVIAR AVALIAÇÃO
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onSkip?.(order);
                        setIsRating(false);
                      }}
                      className="w-full text-slate-400 hover:text-slate-600 font-bold text-[11px] py-1 transition-colors"
                    >
                      Pular avaliação
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setIsRating(true)} className="w-full py-2 bg-yellow-50 text-yellow-700 font-bold text-xs rounded-lg flex items-center justify-center gap-1 hover:bg-yellow-100">
                  <Star className="w-3 h-3" /> AVALIE SEU PEDIDO
                </button>
              )}
            </div>
          )}

          {/* Pedir Novamente */}
          {order.status === 'Concluído' && (
            <button
              onClick={() => onReorder(order)}
              className="w-full bg-slate-900 text-white py-3 rounded-xl font-black text-sm hover:bg-slate-800 transition-all mt-2"
            >
              🔄 PEDIR NOVAMENTE
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const CustomerCoverageFit: React.FC<{ coverageAreas: CoverageArea[] }> = ({ coverageAreas }) => {
  const map = useMap();
  useEffect(() => {
    const valid = coverageAreas
      .map(a => a.boundary || (a.center ? createCirclePolygon(a.center.lat, a.center.lng, 1.2) : null))
      .filter(Boolean);

    if (valid.length > 0) {
      try {
        const group = L.featureGroup(valid.map(b => L.geoJSON(b)));
        const bounds = group.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [35, 35], animate: true });
        }
      } catch (e) {
        console.error("Erro ao enquadrar mapa de cobertura do cliente:", e);
      }
    }
  }, [coverageAreas, map]);
  return null;
};

const AutoFitBounds: React.FC<{ lat1?: number; lng1?: number; lat2: number; lng2: number }> = ({ lat1, lng1, lat2, lng2 }) => {
  const map = useMap();
  useEffect(() => {
    if (lat1 !== undefined && lng1 !== undefined && lat2 !== undefined && lng2 !== undefined) {
      try {
        const bounds = L.latLngBounds([
          [lat1, lng1],
          [lat2, lng2]
        ]);
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [35, 35], maxZoom: 16 });
        }
      } catch (e) {
        console.warn('Erro ao ajustar limites do mapa:', e);
      }
    }
  }, [lat1, lng1, lat2, lng2, map]);
  return null;
};

const ActiveOrderTrackingSection: React.FC<{
  activeOrder: Order;
  deliveryPerson?: AppUser;
  deliveryLat?: number;
  deliveryLng?: number;
  customerLat: number;
  customerLng: number;
}> = ({ activeOrder, deliveryPerson, deliveryLat, deliveryLng, customerLat, customerLng }) => {
  const [routeData, setRouteData] = useState<{
    coords: [number, number][];
    minutes: number;
    distanceKm: number;
    isOsrm: boolean;
  } | null>(null);

  useEffect(() => {
    if (!deliveryLat || !deliveryLng) {
      setRouteData(null);
      return;
    }

    // Estimativa inicial imediata via Haversine para não piscar
    const directKm = haversineKm(deliveryLat, deliveryLng, customerLat, customerLng);
    const initialMinutes = estimateMinutes(directKm);
    setRouteData({
      coords: [[deliveryLat, deliveryLng], [customerLat, customerLng]],
      minutes: initialMinutes,
      distanceKm: Number(directKm.toFixed(1)),
      isOsrm: false,
    });

    // Busca assíncrona da malha viária real via OSRM
    let isMounted = true;
    fetchOsrmRoute(deliveryLng, deliveryLat, customerLng, customerLat).then(res => {
      if (isMounted && res && res.coords.length > 0) {
        setRouteData({
          coords: res.coords,
          minutes: res.minutes,
          distanceKm: res.distanceKm,
          isOsrm: true,
        });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [deliveryLat, deliveryLng, customerLat, customerLng]);

  const hasDeliveryLocation = Boolean(deliveryLat && deliveryLng);

  return (
    <div className="space-y-4 pt-2 border-t border-slate-100">
      {/* Bloco de Previsão Dinâmica sem dizeres padrão estáticos */}
      <div className="flex items-center justify-between">
        <div>
          {hasDeliveryLocation ? (
            <>
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3" /> Previsão de Chegada
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <p className="text-xl font-black text-slate-900">
                  {routeData?.minutes
                    ? new Date(Date.now() + routeData.minutes * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '--:--'}
                </p>
                {routeData?.minutes && (
                  <span className="text-xs font-bold text-slate-500">
                    (~{routeData.minutes} min{routeData.distanceKm ? ` • ${routeData.distanceKm} km` : ''})
                  </span>
                )}
              </div>
              <p className="text-[10px] text-blue-700 font-bold mt-0.5">
                {routeData?.isOsrm ? '✓ Rota em tempo real via tráfego' : '✓ Entregador a caminho do seu local'}
              </p>
            </>
          ) : (
            <>
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider flex items-center gap-1">
                <Truck className="w-3 h-3" /> Entregador em Deslocamento
              </span>
              <p className="text-base font-black text-slate-900 mt-0.5">
                A caminho do seu endereço
              </p>
              <p className="text-[11px] text-slate-500 font-medium">
                Você pode acompanhar a localização assim que o GPS conectar.
              </p>
            </>
          )}
        </div>
        <div className="bg-yellow-400 p-2.5 rounded-2xl shadow-sm">
          <Truck className="text-slate-900 w-5 h-5" />
        </div>
      </div>

      {/* Mapa Leaflet com Moto, Casa e Rota Polyline */}
      <div className="rounded-2xl overflow-hidden border border-slate-200 relative z-0 isolate shadow-xs" style={{ height: '230px' }}>
        <MapContainer
          center={[deliveryLat ?? customerLat, deliveryLng ?? customerLng]}
          zoom={15}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          {hasDeliveryLocation && (
            <AutoFitBounds lat1={deliveryLat} lng1={deliveryLng} lat2={customerLat} lng2={customerLng} />
          )}

          {/* Rota (Linha de Percurso) */}
          {hasDeliveryLocation && routeData?.coords && routeData.coords.length >= 2 && (
            <Polyline
              positions={routeData.coords}
              color="#2563eb"
              weight={4}
              opacity={0.85}
              dashArray={routeData.isOsrm ? undefined : '8, 8'}
            />
          )}

          {/* Marcador da Casa do Cliente */}
          <Marker position={[customerLat, customerLng]} icon={houseIcon}>
            <Popup>
              <div className="font-bold text-sm">🏠 Sua Casa</div>
              <div className="text-xs text-slate-500">{activeOrder.address.street}, {activeOrder.address.number}</div>
            </Popup>
          </Marker>

          {/* Marcador do Entregador */}
          {deliveryLat && deliveryLng && (
            <Marker position={[deliveryLat, deliveryLng]} icon={motoIcon}>
              <Popup>
                <div className="font-bold text-sm">🛵 {deliveryPerson?.name || 'Entregador'}</div>
                <div className="text-xs text-slate-500">
                  {routeData?.minutes ? `Chegada em ~${routeData.minutes} min` : 'A caminho do seu endereço'}
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {/* Dados do Entregador com WhatsApp */}
      <div className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
        <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center shadow-xs">
          <Truck className="text-slate-900 w-5 h-5" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase">Entregador Responsável</p>
          <p className="font-black text-sm text-slate-900">{deliveryPerson?.name || 'Entregador'}</p>
        </div>
        {deliveryPerson?.phone && (
          <a
            href={`https://wa.me/55${deliveryPerson.phone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noreferrer"
            className="ml-auto bg-green-500 p-2.5 rounded-xl shadow-sm text-white hover:bg-green-600 transition-colors"
          >
            <Phone className="w-4 h-4" />
          </a>
        )}
      </div>
    </div>
  );
};

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({ 
  user, orders, onOrderCreated, onUpdateUser, initialTab, coverageAreas, coupons, rewards, referrals, onAddReferral, onUpdateReferral, onDeleteReferral, allUsers, allDeliveryPersons, onUpdateOrder, benefitsConfig, onLogout, businessInfo
}) => {
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'referral' | 'profile' | 'tracking'>(initialTab || 'home');
  const [step, setStep] = useState<'landing' | 'onboarding' | 'address' | 'catalog' | 'checkout' | 'confirmation' | 'processing' | 'status'>('landing');
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(user.addresses?.[0] || null);
  const [cart, setCart] = useState<{ [id: string]: number }>({});
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [coverageError, setCoverageError] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [isDirectReferralModalOpen, setIsDirectReferralModalOpen] = useState(false);
  const [directReferralForm, setDirectReferralForm] = useState({ name: '', phone: '' });
  const [localRating, setLocalRating] = useState<{orderId: string, service: number, delivery: number} | null>(null);
  const [serviceStars, setServiceStars] = useState(0);
  const [deliveryStars, setDeliveryStars] = useState(0);
  const [skippedRatingOrderIds, setSkippedRatingOrderIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('gas_app_skipped_ratings') || '[]');
    } catch {
      return [];
    }
  });
  const [feedbackTags, setFeedbackTags] = useState<string[]>([]);
  const [feedbackComment, setFeedbackComment] = useState('');

  const handleSkipRating = (orderId: string) => {
    setSkippedRatingOrderIds(prev => {
      const updated = Array.from(new Set([...prev, orderId]));
      try {
        localStorage.setItem('gas_app_skipped_ratings', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setServiceStars(0);
    setDeliveryStars(0);
    setFeedbackTags([]);
    setFeedbackComment('');
    setActiveTab('home');
  };

  const [ratingSuccessModal, setRatingSuccessModal] = useState<{ order: Order; serviceRating: number; deliveryRating: number } | null>(null);
  const [referralTab, setReferralTab] = useState<'pontos' | 'indicacoes'>('pontos');

  // Novos estados para modalidade de pedido: imediato vs agendado
  const [deliveryType, setDeliveryType] = useState<'immediate' | 'scheduled'>('immediate');

  const activeDeliveryPeriods = useMemo(() => {
    const list = businessInfo?.deliveryPeriods || DEFAULT_DELIVERY_PERIODS;
    const activeOnes = list.filter(p => p.active !== false);
    return activeOnes.length > 0 ? activeOnes : DEFAULT_DELIVERY_PERIODS;
  }, [businessInfo?.deliveryPeriods]);

  // Datas disponíveis para agendamento (próximos 7 dias)
  const availableScheduledDates = useMemo<ScheduledDateOption[]>(() => {
    const dates: ScheduledDateOption[] = [];
    const now = new Date();
    const DAY_INDEX_MAP: Array<keyof OpeningHours> = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    for (let i = 1; i <= 7; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const isoDate = `${year}-${month}-${day}`;

      const dayKey = DAY_INDEX_MAP[d.getDay()];
      const dayHours = businessInfo?.openingHours?.[dayKey] ?? DEFAULT_BUSINESS_INFO.openingHours[dayKey];
      const isOpen = dayHours?.isOpen !== false;

      const rawWeekday = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
      const dayLabel = i === 1 ? 'Amanhã' : rawWeekday.charAt(0).toUpperCase() + rawWeekday.slice(1);
      const shortDate = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const fullWeekday = d.toLocaleDateString('pt-BR', { weekday: 'long' });
      const capitalizedFullWeekday = fullWeekday.charAt(0).toUpperCase() + fullWeekday.slice(1);
      const fullDisplay = `${shortDate}/${year} (${capitalizedFullWeekday})`;

      dates.push({ isoDate, dayLabel, shortDate, fullDisplay, isOpen });
    }
    return dates;
  }, [businessInfo?.openingHours]);

  const [selectedScheduledDateISO, setSelectedScheduledDateISO] = useState<string>(() => {
    const tomorrow = new Date(Date.now() + 86400000);
    const y = tomorrow.getFullYear();
    const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const d = String(tomorrow.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  // Se a data selecionada atualmente estiver fechada, avança para a primeira data aberta disponível
  useEffect(() => {
    const currentOpt = availableScheduledDates.find(d => d.isoDate === selectedScheduledDateISO);
    if (!currentOpt || currentOpt.isOpen === false) {
      const firstOpen = availableScheduledDates.find(d => d.isOpen !== false);
      if (firstOpen) {
        setSelectedScheduledDateISO(firstOpen.isoDate);
      }
    }
  }, [availableScheduledDates, selectedScheduledDateISO]);

  const scheduledDateInfo = useMemo(() => {
    const found = availableScheduledDates.find(d => d.isoDate === selectedScheduledDateISO);
    if (found) return { display: found.fullDisplay, fullDisplay: found.fullDisplay, dayLabel: found.dayLabel };
    const firstOpen = availableScheduledDates.find(d => d.isOpen !== false) || availableScheduledDates[0];
    return firstOpen 
      ? { display: firstOpen.fullDisplay, fullDisplay: firstOpen.fullDisplay, dayLabel: firstOpen.dayLabel }
      : { display: 'Amanhã', fullDisplay: 'Amanhã', dayLabel: 'Amanhã' };
  }, [availableScheduledDates, selectedScheduledDateISO]);

  // Períodos válidos de acordo com o horário de funcionamento do dia selecionado
  const periodsForSelectedDate = useMemo(() => {
    if (!selectedScheduledDateISO) return activeDeliveryPeriods;
    const parts = selectedScheduledDateISO.split('-');
    if (parts.length < 3) return activeDeliveryPeriods;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const DAY_INDEX_MAP: Array<keyof OpeningHours> = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayKey = DAY_INDEX_MAP[d.getDay()];
    const dayHours = businessInfo?.openingHours?.[dayKey] ?? DEFAULT_BUSINESS_INFO.openingHours[dayKey];

    const valid = businessService.getValidPeriodsForDay(dayHours, activeDeliveryPeriods);
    return valid.length > 0 ? valid : activeDeliveryPeriods;
  }, [selectedScheduledDateISO, businessInfo?.openingHours, activeDeliveryPeriods]);

  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(() => {
    return (businessInfo?.deliveryPeriods?.find(p => p.active !== false)?.id) || 'manha';
  });

  // Atualiza se o selectedPeriodId não existir mais nos períodos válidos para a data
  useEffect(() => {
    if (!periodsForSelectedDate.some(p => p.id === selectedPeriodId)) {
      if (periodsForSelectedDate[0]) {
        setSelectedPeriodId(periodsForSelectedDate[0].id);
      }
    }
  }, [periodsForSelectedDate, selectedPeriodId]);

  const currentSelectedPeriod = useMemo(() => {
    return periodsForSelectedDate.find(p => p.id === selectedPeriodId) || periodsForSelectedDate[0] || activeDeliveryPeriods[0];
  }, [periodsForSelectedDate, selectedPeriodId, activeDeliveryPeriods]);

  // Status da loja baseado em horários ou override manual do gestor
  const storeStatus = useMemo(() => {
    return businessService.isStoreCurrentlyOpen(businessInfo);
  }, [businessInfo]);

  // Se a loja estiver fechada para pedidos imediatos, seleciona agendamento por padrão
  useEffect(() => {
    if (!storeStatus.isOpen) {
      setDeliveryType('scheduled');
    }
  }, [storeStatus.isOpen]);

  // Novos estados para extrato de pontos e modais de indicação
  const [showPointsHistoryModal, setShowPointsHistoryModal] = useState(false);
  const [referralActionModal, setReferralActionModal] = useState<{ referral: Referral; isNew?: boolean } | null>(null);
  const [celebrationModal, setCelebrationModal] = useState<Referral | null>(null);

  // Notificação Toast temporária no canto superior direito
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => prev === msg ? null : prev);
    }, 2600);
  };

  // Novos estados para detalhes de item e confirmação de resgate
  const [selectedRewardDetails, setSelectedRewardDetails] = useState<Reward | null>(null);
  const [rewardConfirmation, setRewardConfirmation] = useState<{ reward: Reward; stage: 'confirm' | 'success'; code?: string } | null>(null);

  // Estados para resgates de recompensas com código único
  const [redeemedRewards, setRedeemedRewards] = useState<RedeemedReward[]>(() => {
    return rewardService.getRedeemedRewards(user.id);
  });
  const [selectedViewRedemption, setSelectedViewRedemption] = useState<RedeemedReward | null>(null);
  const [copiedRedemptionCode, setCopiedRedemptionCode] = useState(false);

  // Sincronização em tempo real de resgates (storage e broadcast)
  useEffect(() => {
    const syncRedeemed = () => {
      setRedeemedRewards(rewardService.getRedeemedRewards(user.id));
    };
    syncRedeemed();

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('gas_app_sync_channel');
      channel.onmessage = (e) => {
        if (e.data?.type === 'SYNC_REDEEMED_REWARDS') {
          syncRedeemed();
        }
      };
    } catch {}

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'gas_app_redeemed_rewards') {
        syncRedeemed();
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      if (channel) channel.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, [user.id]);

  // Novo estado para modal próprio de exclusão de indicação com confirmação e check
  const [deleteConfirmReferral, setDeleteConfirmReferral] = useState<{ referral: Referral; stage: 'confirm' | 'success' } | null>(null);

  // Estados para fluxo de confirmação e troca de endereço
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addressReturnStep, setAddressReturnStep] = useState<'checkout' | 'confirmation' | 'catalog' | null>(null);
  const [pendingPaymentMethod, setPendingPaymentMethod] = useState<string>('PIX');
  const [cashChange, setCashChange] = useState<string>('');
  const [processingStage, setProcessingStage] = useState<'loading' | 'success'>('loading');
  const [selectedTrackingOrderId, setSelectedTrackingOrderId] = useState<string | null>(null);
  const [cancelModalOrder, setCancelModalOrder] = useState<Order | null>(null);
  const [cancelStage, setCancelStage] = useState<'confirm' | 'loading' | 'success'>('confirm');

  // Estados para o formulário de endereço
  const [addressMode, setAddressMode] = useState<'cep' | 'search'>('cep');
  const [cepInput, setCepInput] = useState('');
  const [streetSearch, setStreetSearch] = useState('');
  const [streetSuggestions, setStreetSuggestions] = useState<any[]>([]);
  const [nameInput, setNameInput] = useState(() => {
    if (user.name && user.name !== 'Cliente' && user.name !== 'Usuário' && user.name.trim() !== '') {
      return user.name;
    }
    try {
      const local = localStorage.getItem('gas_app_customer_name');
      if (local && local.trim()) return local.trim();
    } catch {}
    return '';
  });
  const [isSearching, setIsSearching] = useState(false);
  const [pendingAddress, setPendingAddress] = useState<Partial<Address> | null>(null);
  const [addressNumber, setAddressNumber] = useState('');
  const [addressComplement, setAddressComplement] = useState('');
  const [addressReference, setAddressReference] = useState('');
  const [showCoverageMap, setShowCoverageMap] = useState(false);
  const [saveAddress, setSaveAddress] = useState(true);

  // Código de indicação único e consistente por usuário (usando codeService)
  const userReferralCode = useMemo(() => {
    return codeService.getUserReferralCode(user);
  }, [user.referralCode, user.name, user.id]);

  useEffect(() => {
    if ((!user.referralCode || user.referralCode !== userReferralCode) && userReferralCode) {
      onUpdateUser({ ...user, referralCode: userReferralCode });
    }
  }, [user.referralCode, userReferralCode]);

  // ─── IDENTIFICAÇÃO E RECONCILIAÇÃO AUTOMÁTICA DE PONTOS ──────────────────
  const cleanUserPhone = useMemo(() => (user.phone || '').replace(/\D/g, ''), [user.phone]);
  const isUserOrder = useCallback((o: Order) => (
    o.customerId === user.id || 
    (cleanUserPhone.length >= 8 && !!o.phone && o.phone.replace(/\D/g, '') === cleanUserPhone)
  ), [user.id, cleanUserPhone]);

  const customerOrders = useMemo(() => orders.filter(isUserOrder), [orders, isUserOrder]);

  const completedOrders = useMemo(() => {
    return customerOrders.filter(o => o.status === 'Concluído');
  }, [customerOrders]);

  const earnedFromOrders = useMemo(() => {
    const multiplier = benefitsConfig?.pointsPerCurrency ?? 10;
    return completedOrders.reduce((sum, o) => sum + Math.floor(o.total * multiplier), 0);
  }, [completedOrders, benefitsConfig]);

  const earnedFromReferrals = useMemo(() => {
    return referrals
      .filter(r => r.referrerId === user.id && (r.status === 'Validado' || r.status === 'Confirmado'))
      .reduce((sum, r) => sum + (r.pointsAwarded || benefitsConfig?.referralPointsAwarded || 100), 0);
  }, [referrals, user.id, benefitsConfig]);

  const cachedHistory = useMemo(() => {
    const fromUser = user.pointHistory || [];
    const fromStorage = userService.getPointHistory(user.id);
    const map = new Map<string, PointHistoryItem>();
    fromStorage.forEach(item => map.set(item.id, item));
    fromUser.forEach(item => map.set(item.id, item));
    return Array.from(map.values());
  }, [user.pointHistory, user.id]);

  const redemptionsList = useMemo(() => {
    return cachedHistory.filter(i => i.type === 'redeemed_reward' || i.points < 0);
  }, [cachedHistory]);

  const totalSpentPoints = useMemo(() => {
    return redemptionsList.reduce((sum, i) => sum + Math.abs(i.points), 0);
  }, [redemptionsList]);

  const totalEarnedPoints = useMemo(() => {
    return earnedFromOrders + earnedFromReferrals;
  }, [earnedFromOrders, earnedFromReferrals]);

  const reconciledBalance = useMemo(() => {
    const calculated = Math.max(0, totalEarnedPoints - totalSpentPoints);
    return Math.max(calculated, user.points || 0);
  }, [totalEarnedPoints, totalSpentPoints, user.points]);

  // Se o saldo no banco/perfil estiver desatualizado em relação às compras concluídas, auto-sincroniza
  useEffect(() => {
    const calculated = Math.max(0, totalEarnedPoints - totalSpentPoints);
    if (calculated > (user.points || 0)) {
      console.log(`[Pontos] Auto-reconciliando pontos do usuário: de ${user.points || 0} para ${calculated}`);
      const updatedUser: AppUser = {
        ...user,
        points: calculated,
        pointHistory: cachedHistory
      };
      onUpdateUser(updatedUser);
    }
  }, [totalEarnedPoints, totalSpentPoints, user.points, user.id]);

  useEffect(() => {
    if (!selectedAddress && user.addresses && user.addresses.length > 0) {
      setSelectedAddress(user.addresses[0]);
    }
  }, [user.addresses, selectedAddress]);

  // Rastreamento automático de link de indicação (?ref=CODIGO) para novo cliente
  useEffect(() => {
    const pendingCode = localStorage.getItem('gas_app_pending_ref_code');
    if (!pendingCode || appliedCoupon) return;

    // 1. Verificar se o usuário já tem pedidos anteriores não cancelados
    const nonCancelledOrders = orders.filter(o => 
      (o.customerId === user.id || (user.phone && o.phone?.replace(/\D/g, '') === user.phone.replace(/\D/g, ''))) && 
      o.status !== 'Cancelado'
    );
    if (nonCancelledOrders.length > 0) {
      localStorage.removeItem('gas_app_pending_ref_code');
      return;
    }

    // 2. Não permitir aplicar código próprio
    if (codeService.matchesReferralCode(user, pendingCode)) {
      localStorage.removeItem('gas_app_pending_ref_code');
      return;
    }

    const usersPool = (allUsers && allUsers.length > 0) ? allUsers : JSON.parse(localStorage.getItem('gas_delivery_users') || '[]');
    const referrer = usersPool.find((u: any) => 
      codeService.matchesReferralCode(u, pendingCode) && u.id !== user.id
    );

    if (referrer) {
      // Verificar se já possui indicação concluída/validada no sistema
      const cleanPhone = (user.phone || '').replace(/\D/g, '');
      const alreadyConfirmed = referrals.find(r => 
        (r.refereeId === user.id || (cleanPhone && r.refereePhone.replace(/\D/g, '') === cleanPhone)) &&
        (r.status === 'Validado' || (r.status as string) === 'Confirmado')
      );
      if (alreadyConfirmed) {
        localStorage.removeItem('gas_app_pending_ref_code');
        return;
      }

      const discountAmount = benefitsConfig?.referralDiscountValue ?? 10;
      const referralCoupon: Coupon = {
        id: `REF-${referrer.id}`,
        code: pendingCode.toUpperCase(),
        type: 'fixed',
        value: discountAmount,
        isActive: true,
        usageCount: 0,
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      };
      setAppliedCoupon(referralCoupon);
      showToast(`🎉 Cupom de R$ ${discountAmount.toFixed(2)} de ${referrer.name.split(' ')[0]} ativado para seu 1º pedido!`);
    }
  }, [allUsers, orders, user.id, user.phone, user.referralCode, referrals, appliedCoupon, benefitsConfig]);

  // Trava de rolagem da página de fundo quando qualquer modal estiver ativo
  useEffect(() => {
    const isModalOpen = (
      showPointsHistoryModal ||
      !!selectedRewardDetails ||
      !!rewardConfirmation ||
      !!selectedViewRedemption ||
      !!deleteConfirmReferral ||
      !!referralActionModal ||
      !!celebrationModal ||
      !!cancelModalOrder ||
      showAddressModal ||
      !!ratingSuccessModal ||
      isDirectReferralModalOpen
    );
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [
    showPointsHistoryModal,
    selectedRewardDetails,
    rewardConfirmation,
    deleteConfirmReferral,
    referralActionModal,
    celebrationModal,
    cancelModalOrder,
    showAddressModal,
    ratingSuccessModal,
    isDirectReferralModalOpen
  ]);

  const handleExecuteRewardRedemption = (reward: Reward) => {
    if (reconciledBalance < reward.pointsCost) {
      alert("Pontos insuficientes para este resgate!");
      return;
    }

    // 1. Gera código único exclusivo no padrão RESG-XXXXXX
    const uniqueCode = codeService.generateRedemptionCode();
    const rewardExpiry = new Date(Date.now() + (reward.validityDays || 30) * 24 * 60 * 60 * 1000).toISOString();

    let discountVal = 0;
    if (reward.type === 'discount') {
      discountVal = reward.value || 15;
    } else if (reward.productId) {
      const prod = PRODUCTS.find(p => p.id === reward.productId);
      discountVal = prod?.price || reward.value || 0;
    } else {
      discountVal = reward.value || 0;
    }

    // 2. Histórico de pontos com menção ao código gerado
    const historyItem: PointHistoryItem = {
      id: 'redeem-' + Math.random().toString(36).substr(2, 9),
      userId: user.id,
      type: 'redeemed_reward',
      points: -reward.pointsCost,
      description: `Resgate: ${reward.title} (Cód: ${uniqueCode})`,
      createdAt: new Date().toISOString()
    };

    const newPoints = Math.max(0, reconciledBalance - reward.pointsCost);
    const updatedHistory = [historyItem, ...cachedHistory];

    // Salva no cache local do usuário
    userService.savePointHistory(user.id, updatedHistory);

    const updatedUser = { 
      ...user, 
      points: newPoints,
      pointHistory: updatedHistory
    };
    onUpdateUser(updatedUser);

    // 3. Cria e salva o registro do resgate vinculado à conta do usuário
    const newRedemption: RedeemedReward = {
      id: 'red-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      code: uniqueCode,
      rewardId: reward.id,
      rewardTitle: reward.title,
      rewardType: reward.type,
      productId: reward.productId,
      discountValue: discountVal,
      pointsCost: reward.pointsCost,
      minOrderValue: reward.minOrderValue || 0,
      validUntil: rewardExpiry,
      userId: user.id,
      userName: user.name,
      userPhone: user.phone || '',
      status: 'active',
      redeemedAt: new Date().toISOString()
    };

    rewardService.saveRedeemedReward(newRedemption);
    setRedeemedRewards(rewardService.getRedeemedRewards(user.id));

    // Exibe modal de confirmação em etapa 'success' com o código gerado
    setRewardConfirmation({ reward, stage: 'success', code: uniqueCode });
    showToast(`🎁 Recompensa resgatada com sucesso! Código gerado: ${uniqueCode}`);
  };

  const handleConfirmDeleteReferral = (referral: Referral) => {
    onDeleteReferral?.(referral.id);
    setDeleteConfirmReferral({ referral, stage: 'success' });
  };

  const handleOpenCancelModal = (order: Order) => {
    setCancelModalOrder(order);
    setCancelStage('confirm');
  };

  const handleExecuteCancellation = async () => {
    if (!cancelModalOrder || !onUpdateOrder) return;
    setCancelStage('loading');
    
    try {
      await Promise.all([
        onUpdateOrder({ ...cancelModalOrder, status: 'Cancelado' }),
        new Promise(resolve => setTimeout(resolve, 1400))
      ]);
      setCancelStage('success');
    } catch (err) {
      alert("Erro ao cancelar o pedido. Tente novamente.");
      setCancelStage('confirm');
    }
  };

  // Initial check for name - roda estritamente uma única vez e consulta cache local
  const hasCheckedOnboarding = React.useRef(false);
  useEffect(() => {
    if (hasCheckedOnboarding.current) return;

    let savedName = '';
    let isCompletedLocal = false;
    try {
      savedName = localStorage.getItem('gas_app_customer_name') || '';
      isCompletedLocal = localStorage.getItem('gas_app_onboarding_completed') === 'true';
    } catch {}

    // Se já tiver completado ou tiver nome salvo no cache local, nunca pede de novo
    if (isCompletedLocal || (savedName && savedName.trim() && savedName !== 'Cliente' && savedName !== 'Usuário')) {
      hasCheckedOnboarding.current = true;
      if (savedName && (!user.name || user.name === 'Cliente' || user.name === 'Usuário')) {
        onUpdateUser({ ...user, name: savedName });
      }
      return;
    }

    const isDefaultName = !user.name || user.name === 'Cliente' || user.name === 'Usuário' || user.name.trim() === '';
    const cleanPhone = (user.phone || '').replace(/\D/g, '');
    const hasHistory = orders.some(o => o.customerId === user.id || (cleanPhone.length >= 8 && !!o.phone && o.phone.replace(/\D/g, '') === cleanPhone)) || (user.addresses && user.addresses.length > 0);
    
    if (isDefaultName && !hasHistory) {
      setStep('onboarding');
    }
    hasCheckedOnboarding.current = true;
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Bom dia";
    if (hour >= 12 && hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  // Buscas de endereço e CEP
  const checkCoverage = (bairro: string, cidade: string) => {
    return coverageAreas.some(area => 
      area.neighborhood.toLowerCase().trim() === bairro.toLowerCase().trim() &&
      area.city.toLowerCase().trim() === cidade.toLowerCase().trim()
    );
  };

  const handleCEPLookup = async (cep: string) => {
    if (cep.length === 8) {
      setCoverageError(null);
      setIsSearching(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        if (!data.erro) {
          const isCovered = checkCoverage(data.bairro, data.localidade);

          if (!isCovered) {
            setCoverageError(`Desculpe, ainda não atendemos o bairro ${data.bairro}. Estamos expandindo em breve!`);
            setPendingAddress(null);
            return;
          }

          setPendingAddress({
            cep: data.cep.replace('-', ''),
            street: data.logradouro,
            neighborhood: data.bairro,
            city: data.localidade,
            state: data.uf,
          });
        }
      } catch (e) {
        console.error("CEP Lookup failed", e);
        setCoverageError("Não foi possível buscar o CEP.");
      } finally {
        setIsSearching(false);
      }
    }
  };

  const handleStreetSearch = async (query: string) => {
    if (query.length < 4) {
      setStreetSuggestions([]);
      return;
    }
    
    setIsSearching(true);
    setCoverageError(null);
    try {
      // Filtrando para os estados das áreas de cobertura (simulando um default RJ para agora)
      const ufs = Array.from(new Set(coverageAreas.map(a => 'RJ')));
      const uf = ufs[0] || 'RJ';
      
      // Filtrando para cidades das áreas de cobertura
      const cidades = Array.from(new Set(coverageAreas.map(a => a.city)));
      const cidade = cidades[0] || 'Sao Goncalo'; // Default fallback

      // Como o ViaCEP precisa de Estado/Cidade/Rua exatos, a de rua costuma dar muito falso positivo
      // Sem um backend de geocoding, é o melhor que podemos fazer:
      const response = await fetch(`https://viacep.com.br/ws/${uf}/${cidade}/${encodeURIComponent(query)}/json/`);
      const data = await response.json();
      
      if (Array.isArray(data)) {
        setStreetSuggestions(data.slice(0, 5));
      }
    } catch (e) {
      console.error("Street search failed", e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectStreetSuggestion = (suggestion: any) => {
    setStreetSearch(suggestion.logradouro);
    setStreetSuggestions([]);
    
    const isCovered = checkCoverage(suggestion.bairro, suggestion.localidade);
    
    if (!isCovered) {
      setCoverageError(`Desculpe, ainda não atendemos o bairro ${suggestion.bairro}.`);
      setPendingAddress(null);
      return;
    }

    setPendingAddress({
      cep: suggestion.cep.replace('-', ''),
      street: suggestion.logradouro,
      neighborhood: suggestion.bairro,
      city: suggestion.localidade,
      state: suggestion.uf,
    });
  };

  const handleConfirmAddress = async () => {
    if (pendingAddress && addressNumber) {
      let lat = undefined;
      let lng = undefined;
      
      try {
        const query = `${addressNumber} ${pendingAddress.street}, ${pendingAddress.neighborhood}, ${pendingAddress.city}, ${pendingAddress.state}`;
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data && data.length > 0) {
          lat = parseFloat(data[0].lat);
          lng = parseFloat(data[0].lon);
        }
      } catch (err) {
        console.warn('Falha ao geocodificar o endereço', err);
      }

      const newAddress: Address = {
        ...pendingAddress,
        number: addressNumber,
        complement: addressComplement,
        reference: addressReference,
        lat,
        lng
      } as Address;
      
      const updatedUser = { ...user, addresses: [...(user.addresses || []), newAddress] };
      onUpdateUser(updatedUser);
      setSelectedAddress(newAddress);
      showToast('Endereço salvo com sucesso!');
      
      // Limpar form
      setPendingAddress(null);
      setAddressNumber('');
      setAddressComplement('');
      setAddressReference('');
      setCepInput('');
      setStreetSearch('');
      
      setStep(addressReturnStep || 'catalog');
      setAddressReturnStep(null);
    }
  };

  const cartSubtotal = Object.entries(cart).reduce((acc, [id, qty]) => {
    const product = PRODUCTS.find(p => p.id === id);
    return acc + (product?.price || 0) * (qty as number);
  }, 0);

  const discountValue = appliedCoupon ? (
    appliedCoupon.type === 'fixed' ? appliedCoupon.value : (cartSubtotal * (appliedCoupon.value / 100))
  ) : 0;

  const cartTotal = Math.max(0, cartSubtotal - discountValue);
  const cartCount = Object.values(cart).reduce<number>((acc, qty) => acc + (Number(qty) || 0), 0);

  const handleApplyCoupon = () => {
    setCouponError(null);
    const code = couponCode.toUpperCase();
    
    // Função auxiliar para normalizar endereços para comparação e evitar fraudes (várias contas no mesmo local)
    const formatAddressForComparison = (addr: Address | null) => {
      if (!addr) return '';
      return `${addr.street} ${addr.number} ${addr.complement || ''} ${addr.neighborhood} ${addr.city}`.toLowerCase().replace(/[^a-z0-9]/g, '');
    };
    
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

      if (coupon.isOneTimePerUser) {
        if (user.usedCoupons?.includes(coupon.id)) {
          setCouponError("Você já utilizou este cupom.");
          return;
        }
        
        // Anti-fraude por endereço: garante que contas diferentes não usem cupom de uso único no mesmo endereço
        const currentAddressStr = formatAddressForComparison(selectedAddress);
        const usedAtAddress = orders.some(o => 
          o.couponCode?.toUpperCase() === coupon.code.toUpperCase() && 
          o.status !== 'Cancelado' &&
          formatAddressForComparison(o.address) === currentAddressStr
        );
        if (usedAtAddress) {
          setCouponError("Este benefício já foi utilizado neste endereço.");
          return;
        }
      }
      
      if (coupon.minOrderValue && cartSubtotal < coupon.minOrderValue) {
        setCouponError(`Mínimo: R$ ${coupon.minOrderValue.toFixed(2)}`);
        return;
      }

      setAppliedCoupon(coupon);
      setCouponCode('');
      return;
    }

    // 2. Check if it's a redeemed reward code
    const redeemedMatch = rewardService.findByCode(code);
    if (redeemedMatch) {
      if (redeemedMatch.userId !== user.id) {
        setCouponError("Este código de resgate é exclusivo e pertence a outra conta.");
        return;
      }
      if (redeemedMatch.status === 'used') {
        setCouponError("Este código de resgate já foi utilizado.");
        return;
      }
      const daysInfo = codeService.formatDaysRemaining(redeemedMatch.validUntil);
      if (daysInfo.isExpired) {
        setCouponError("Este código de resgate expirou.");
        return;
      }
      if (redeemedMatch.minOrderValue && cartSubtotal < redeemedMatch.minOrderValue) {
        setCouponError(`Pedido mínimo para este resgate: R$ ${redeemedMatch.minOrderValue.toFixed(2)}`);
        return;
      }

      if ((redeemedMatch.rewardType === 'free_item' || redeemedMatch.rewardType === 'free_product') && redeemedMatch.productId) {
        setCart(prev => ({
          ...prev,
          [redeemedMatch.productId!]: Math.max(1, (prev[redeemedMatch.productId!] || 0) + 1)
        }));
      }

      const redeemedCoupon: Coupon = {
        id: `REDEEM-${redeemedMatch.id}`,
        code: redeemedMatch.code,
        type: 'fixed',
        value: redeemedMatch.discountValue || 0,
        isActive: true,
        usageCount: 0,
        validUntil: redeemedMatch.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        minOrderValue: redeemedMatch.minOrderValue || 0
      };
      setAppliedCoupon(redeemedCoupon);
      setCouponCode('');
      showToast(`🎁 Código de resgate ${redeemedMatch.code} ativado no carrinho!`);
      return;
    }

    // 3. Check if it's a referral code (check against allUsers or fallback)
    const isOwnCode = codeService.matchesReferralCode(user, code);
    if (isOwnCode) {
      setCouponError("Você não pode utilizar seu próprio código de indicação.");
      return;
    }

    const usersPool = (allUsers && allUsers.length > 0) ? allUsers : JSON.parse(localStorage.getItem('gas_delivery_users') || '[]');
    const referrer = usersPool.find((u: any) => 
      codeService.matchesReferralCode(u, code) && u.id !== user.id
    );

    if (referrer) {
      // Regra 1: Apenas no PRIMEIRO pedido do novo usuário (sem pedidos anteriores não cancelados)
      const cleanUserPhone = (user.phone || '').replace(/\D/g, '');
      const nonCancelledOrders = orders.filter(o => 
        (o.customerId === user.id || (cleanUserPhone && o.phone?.replace(/\D/g, '') === cleanUserPhone)) && 
        o.status !== 'Cancelado'
      );
      if (nonCancelledOrders.length > 0) {
        setCouponError("Cupons de indicação são válidos exclusivamente no seu primeiro pedido.");
        return;
      }

      // Regra Antifraude de Endereço: Evitar criação de várias contas para o mesmo endereço físico
      const currentAddressStr = formatAddressForComparison(selectedAddress);
      if (currentAddressStr) {
        const addressAlreadyUsed = orders.some(o => 
          o.status !== 'Cancelado' && 
          formatAddressForComparison(o.address) === currentAddressStr
        );
        if (addressAlreadyUsed) {
          setCouponError("Este endereço já possui pedidos no sistema e não é elegível para bônus de indicação (primeira compra).");
          return;
        }
      }

      // Regra 2: Se já concluiu anteriormente uma primeira compra com indicação, não pode usar de novo
      const alreadyConfirmed = referrals.find(r => 
        (r.refereeId === user.id || (cleanUserPhone && r.refereePhone.replace(/\D/g, '') === cleanUserPhone)) &&
        (r.status === 'Validado' || (r.status as string) === 'Confirmado')
      );
      if (alreadyConfirmed) {
        setCouponError("Você já utilizou o benefício de indicação em sua primeira compra.");
        return;
      }

      // Regra 3: Checar valor mínimo se configurado pelo gestor
      const minOrderVal = benefitsConfig?.referralMinOrderValue ?? 0;
      if (minOrderVal > 0 && cartSubtotal < minOrderVal) {
        setCouponError(`Valor mínimo do pedido para cupom de indicação: R$ ${minOrderVal.toFixed(2)}`);
        return;
      }

      // Desconto dinâmico configurado pelo gestor
      const discountAmount = benefitsConfig?.referralDiscountValue ?? 10;
      const referralCoupon: Coupon = {
        id: `REF-${referrer.id}`,
        code: code.toUpperCase(),
        type: 'fixed',
        value: discountAmount,
        isActive: true,
        usageCount: 0,
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      };

      setAppliedCoupon(referralCoupon);
      setCouponCode('');
      showToast(`🎉 Cupom de R$ ${discountAmount.toFixed(2)} de ${referrer.name.split(' ')[0]} aplicado!`);
      return;
    }
    
    setCouponError("Cupom ou código de indicação inválido.");
  };

  const handleExchangePoints = (reward: Reward) => {
    handleExecuteRewardRedemption(reward);
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

  const handleConfirmOrder = async () => {
    if (!selectedAddress) {
      alert("Por favor, selecione um endereço de entrega.");
      return;
    }
    setStep('processing');
    setProcessingStage('loading');
    setCheckoutLoading(true);
    
    try {
      const orderId = Math.random().toString(36).substr(2, 9).toUpperCase();
      const isReferralDiscount = appliedCoupon?.id.startsWith('REF-');
      const referrerId = isReferralDiscount ? appliedCoupon.id.replace('REF-', '') : undefined;
      
      // Se for desconto de indicação, vincular ou criar registro de indicação
      if (isReferralDiscount && referrerId) {
        const usersPool = (allUsers && allUsers.length > 0) ? allUsers : JSON.parse(localStorage.getItem('gas_delivery_users') || '[]');
        const referrer = usersPool.find((u: any) => u.id === referrerId);
        
        if (referrer) {
          const cleanUserPhone = (user.phone || '').replace(/\D/g, '');
          
          // Verificar se já existia indicação cadastrada (ex: pelo botão "Indicar Diretamente")
          const existingRef = referrals.find(r => 
            r.referrerId === referrer.id && 
            (r.refereeId === user.id || (cleanUserPhone && r.refereePhone.replace(/\D/g, '') === cleanUserPhone))
          );

          if (existingRef) {
            onUpdateReferral?.({
              ...existingRef,
              refereeId: user.id,
              refereeName: user.name,
              refereePhone: user.phone || existingRef.refereePhone,
              orderId: orderId,
              status: 'Pendente'
            });
          } else {
            const newReferral: Referral = {
              id: Math.random().toString(36).substr(2, 9),
              referrerId: referrer.id,
              referrerName: referrer.name,
              refereeId: user.id,
              refereeName: user.name,
              refereePhone: user.phone || '',
              status: 'Pendente',
              orderId: orderId,
              pointsAwarded: benefitsConfig?.referralPointsAwarded ?? 100, // Pontos para o indicador quando a 1ª compra for concluída
              createdAt: new Date().toISOString()
            };
            onAddReferral(newReferral);
          }

          localStorage.removeItem('gas_app_pending_ref_code');
        }
      }

      const isSched = deliveryType === 'scheduled';
      const schedRange = currentSelectedPeriod ? `${currentSelectedPeriod.startTime} às ${currentSelectedPeriod.endTime}` : '08:00 às 13:00';
      const periodName = currentSelectedPeriod?.name || 'Agendado';

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
        referralId: referrerId,
        paymentMethod: pendingPaymentMethod,
        status: 'Pendente',
        isScheduled: isSched,
        scheduledDate: isSched ? scheduledDateInfo.fullDisplay : undefined,
        scheduledDateISO: isSched ? selectedScheduledDateISO : undefined,
        scheduledPeriod: isSched ? selectedPeriodId : undefined,
        scheduledPeriodName: isSched ? periodName : undefined,
        scheduledTimeRange: isSched ? schedRange : undefined,
        feedback: isSched ? `[Agendado para: ${scheduledDateInfo.fullDisplay} - ${periodName} (${schedRange})]` : undefined,
        createdAt: new Date().toISOString()
      };

      // Create order via API first and wait minimum 1.5s for smooth animation
      await Promise.all([
        onOrderCreated(newOrder),
        new Promise(res => setTimeout(res, 1600))
      ]);

      // Only update local states after success
      // Update user's used coupons & add address if requested
      let updatedUserObj = { ...user };
      
      // Save Address Logic
      if (saveAddress) {
        const isAlreadySaved = updatedUserObj.addresses?.some(a => a.cep === selectedAddress.cep && a.number === selectedAddress.number);
        if (!isAlreadySaved) {
          updatedUserObj.addresses = [selectedAddress, ...(updatedUserObj.addresses || [])];
        }
      }

      if (appliedCoupon) {
        if (!appliedCoupon.id.startsWith('REF-')) {
          updatedUserObj.usedCoupons = [...(updatedUserObj.usedCoupons || []), appliedCoupon.id];
        }

        // Se for um resgate de recompensa com código único, marca como usado
        const matchedRedeem = rewardService.findByCode(appliedCoupon.code);
        if (matchedRedeem) {
          rewardService.markRedeemedRewardAsUsed(matchedRedeem.id, orderId);
          setRedeemedRewards(rewardService.getRedeemedRewards(user.id));
        }
      }
      
      // PONTOS: Concedidos apenas quando a entrega for concluída com sucesso!
      onUpdateUser(updatedUserObj);

      setLastOrder(newOrder);
      setCart({});
      setAppliedCoupon(null);
      setProcessingStage('success');
    } catch (e: any) {
      alert("Houve um erro ao realizar seu pedido: " + (e.message || "Tente novamente."));
      setStep('confirmation');
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
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
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && nameInput.trim()) {
                    const validName = nameInput.trim();
                    try {
                      localStorage.setItem('gas_app_customer_name', validName);
                      localStorage.setItem('gas_app_onboarding_completed', 'true');
                    } catch {}
                    onUpdateUser({ ...user, name: validName });
                    setStep('landing');
                  }
                }}
              />
              <button 
                onClick={() => {
                  if (nameInput.trim()) {
                    const validName = nameInput.trim();
                    try {
                      localStorage.setItem('gas_app_customer_name', validName);
                      localStorage.setItem('gas_app_onboarding_completed', 'true');
                    } catch {}
                    onUpdateUser({ ...user, name: validName });
                    setStep('landing');
                  }
                }}
                disabled={!nameInput.trim()}
                className="mt-6 w-full bg-yellow-400 text-slate-900 py-4 rounded-2xl font-black text-lg hover:bg-yellow-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                CONTINUAR
              </button>
            </motion.div>
          </motion.div>
        ) : (
          <>
            {activeTab === 'home' && (
              <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                {step === 'landing' && (
              <div className="p-4 max-w-md mx-auto space-y-4 pt-6 h-[calc(100vh-72px)] overflow-hidden flex flex-col justify-between pb-4">
                <header>
                  <h1 className="text-2xl font-black text-slate-900 leading-tight">
                    {getGreeting()}, <span className="text-yellow-500">{user.name}</span>!
                  </h1>
                  <p className="text-slate-500 font-medium mt-1 text-sm">Como podemos ajudar hoje?</p>
                </header>

                <div className="grid grid-cols-1 gap-3">
                  <button 
                    onClick={() => {
                      if (user.addresses?.length) {
                        setStep('catalog');
                      } else {
                        setStep('address');
                      }
                    }}
                    className="bg-slate-900 p-5 rounded-3xl text-left flex items-center justify-between group hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10"
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-yellow-400 p-3 rounded-2xl group-hover:scale-110 transition-transform">
                        <Plus className="text-slate-900 w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-white font-black text-lg">Fazer Pedido</p>
                        <p className="text-slate-400 text-xs">Gás e água em minutos</p>
                      </div>
                    </div>
                    <ChevronRight className="text-slate-600 w-5 h-5" />
                  </button>

                  <button 
                    onClick={() => setActiveTab('tracking')}
                    className="bg-white p-5 rounded-3xl text-left flex items-center justify-between border border-slate-100 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-blue-100 p-3 rounded-2xl">
                        <Truck className="text-blue-600 w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-slate-900 font-black text-lg">Acompanhar Pedido</p>
                        <p className="text-slate-500 text-xs">Veja onde está sua entrega</p>
                      </div>
                    </div>
                    <ChevronRight className="text-slate-300 w-5 h-5" />
                  </button>

                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setActiveTab('referral')}
                      className="bg-white p-5 rounded-3xl text-left border border-slate-100 shadow-sm hover:shadow-md transition-all"
                    >
                      <div className="bg-green-100 w-10 h-10 rounded-xl flex items-center justify-center mb-3">
                        <Gift className="text-green-600 w-5 h-5" />
                      </div>
                      <p className="text-slate-900 font-black text-sm">Benefícios</p>
                      <p className="text-slate-500 text-[10px]">Indique e ganhe</p>
                    </button>

                    <button 
                      onClick={() => setActiveTab('profile')}
                      className="bg-white p-5 rounded-3xl text-left border border-slate-100 shadow-sm hover:shadow-md transition-all"
                    >
                      <div className="bg-slate-100 w-10 h-10 rounded-xl flex items-center justify-center mb-3">
                        <User className="text-slate-600 w-5 h-5" />
                      </div>
                      <p className="text-slate-900 font-black text-sm">Meu Perfil</p>
                      <p className="text-slate-500 text-[10px]">Editar cadastro</p>
                    </button>
                  </div>
                </div>

                <div className="bg-yellow-50 p-4 rounded-3xl border border-yellow-100">
                  <p className="text-yellow-800 font-black text-xs mb-1">Dica do dia</p>
                  <p className="text-yellow-700 text-xs leading-tight">Indique um amigo e ganhe R$ 5,00 de desconto na sua próxima recarga de gás!</p>
                </div>
              </div>
            )}

            {step === 'address' && (
              <div className="bg-slate-900 text-white py-12 px-6 min-h-screen">
                <button 
                  onClick={() => {
                    setStep(addressReturnStep || 'landing');
                    setAddressReturnStep(null);
                  }} 
                  className="mb-8 text-slate-400 flex items-center gap-2 font-bold text-sm hover:text-white transition-colors"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" /> VOLTAR
                </button>
                <div className="max-w-md mx-auto">
                  <h1 className="text-3xl font-black mb-2 text-yellow-400 text-center uppercase">{businessInfo?.name || 'GÁS EXPRESS'}</h1>
                  <p className="text-slate-300 mb-8 text-center">Onde vamos entregar hoje?</p>
                  
                  {user.addresses?.length ? (
                    <div className="space-y-3 mb-6">
                      {user.addresses.map((addr, i) => (
                        <button 
                          key={i}
                          onClick={() => { 
                            setSelectedAddress(addr); 
                            setStep(addressReturnStep || 'catalog'); 
                            setAddressReturnStep(null); 
                          }}
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

                  {/* Botão Ver Cobertura */}
                  <button
                    onClick={() => setShowCoverageMap(true)}
                    className="w-full mb-6 bg-slate-800 p-4 rounded-2xl text-left flex items-center gap-3 border border-dashed border-slate-600 hover:border-yellow-400 transition-all"
                  >
                    <div className="bg-yellow-400/10 p-2 rounded-xl">
                      <MapPin className="text-yellow-400 w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-yellow-400">Ver Áreas Atendidas</p>
                      <p className="text-[10px] text-slate-500">Confira se entregamos no seu bairro</p>
                    </div>
                    <ChevronRight className="text-slate-600 w-5 h-5 ml-auto" />
                  </button>

                  {/* Tabs: CEP ou Busca */}
                  <div className="flex gap-2 mb-4 bg-slate-800 p-1 rounded-xl">
                    <button 
                      onClick={() => setAddressMode('cep')}
                      className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${addressMode === 'cep' ? 'bg-yellow-400 text-slate-900' : 'text-slate-400'}`}
                    >
                      TENHO O CEP
                    </button>
                    <button 
                      onClick={() => setAddressMode('search')}
                      className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${addressMode === 'search' ? 'bg-yellow-400 text-slate-900' : 'text-slate-400'}`}
                    >
                      NÃO SEI O CEP
                    </button>
                  </div>

                  {addressMode === 'cep' ? (
                    <div>
                      <input 
                        type="text" 
                        inputMode="numeric"
                        placeholder="Digite seu CEP..."
                        maxLength={8}
                        className="w-full p-5 rounded-2xl bg-white text-slate-900 shadow-2xl outline-none text-center text-xl font-bold"
                        value={cepInput}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setCepInput(val);
                          if (val.length === 8) {
                            handleCEPLookup(val);
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                      />
                      <p className="text-[10px] text-slate-500 mt-3 text-center">Digite apenas os 8 números do CEP</p>
                    </div>
                  ) : (
                    <div className="relative">
                      <input 
                        type="text" 
                        placeholder="Digite o nome da rua..."
                        className="w-full p-5 rounded-2xl bg-white text-slate-900 shadow-2xl outline-none text-lg font-bold"
                        value={streetSearch}
                        onChange={(e) => {
                          setStreetSearch(e.target.value);
                          handleStreetSearch(e.target.value);
                        }}
                      />
                      {streetSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl overflow-hidden z-50 max-h-60 overflow-y-auto">
                          {streetSuggestions.map((s, i) => (
                            <button
                              key={i}
                              onClick={() => handleSelectStreetSuggestion(s)}
                              className="w-full p-4 text-left text-slate-900 hover:bg-yellow-50 transition-colors border-b border-slate-100 last:border-none"
                            >
                              <p className="font-bold text-sm">{s.logradouro}</p>
                              <p className="text-xs text-slate-500">{s.bairro}, {s.localidade} - {s.uf}</p>
                            </button>
                          ))}
                        </div>
                      )}
                      {isSearching && <p className="text-yellow-400 text-xs mt-3 text-center animate-pulse">Buscando endereços...</p>}
                    </div>
                  )}

                  {coverageError && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                      <p className="text-red-400 text-sm font-bold">{coverageError}</p>
                    </motion.div>
                  )}

                  {/* Formulário de detalhes do endereço (aparece após CEP válido) */}
                  {pendingAddress && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-6 space-y-4">
                      <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
                        <p className="text-yellow-400 font-black text-xs uppercase mb-3">Endereço encontrado</p>
                        <p className="text-white font-bold">{pendingAddress.street}</p>
                        <p className="text-slate-400 text-sm">{pendingAddress.neighborhood}, {pendingAddress.city} - {pendingAddress.state}</p>
                      </div>

                      <div className="relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder=" "
                          className="peer w-full p-4 pt-6 rounded-2xl bg-slate-800 text-white border border-slate-700 focus:border-yellow-400 outline-none font-bold"
                          value={addressNumber}
                          onChange={(e) => setAddressNumber(e.target.value)}
                        />
                        <label className="absolute left-4 top-4 text-slate-400 text-sm transition-all peer-focus:top-2 peer-focus:text-xs peer-focus:text-yellow-400 peer-not-placeholder-shown:top-2 peer-not-placeholder-shown:text-xs">Número da casa *</label>
                      </div>

                      <div className="relative">
                        <input
                          type="text"
                          placeholder=" "
                          className="peer w-full p-4 pt-6 rounded-2xl bg-slate-800 text-white border border-slate-700 focus:border-yellow-400 outline-none"
                          value={addressComplement}
                          onChange={(e) => setAddressComplement(e.target.value)}
                        />
                        <label className="absolute left-4 top-4 text-slate-400 text-sm transition-all peer-focus:top-2 peer-focus:text-xs peer-focus:text-yellow-400 peer-not-placeholder-shown:top-2 peer-not-placeholder-shown:text-xs">Complemento (apto, bloco...)</label>
                      </div>

                      <div className="relative">
                        <input
                          type="text"
                          placeholder=" "
                          className="peer w-full p-4 pt-6 rounded-2xl bg-slate-800 text-white border border-slate-700 focus:border-yellow-400 outline-none"
                          value={addressReference}
                          onChange={(e) => setAddressReference(e.target.value)}
                        />
                        <label className="absolute left-4 top-4 text-slate-400 text-sm transition-all peer-focus:top-2 peer-focus:text-xs peer-focus:text-yellow-400 peer-not-placeholder-shown:top-2 peer-not-placeholder-shown:text-xs">Ponto de referência</label>
                      </div>

                      <label className="flex items-center gap-3 bg-slate-800/50 p-4 rounded-xl border border-slate-700 cursor-pointer hover:bg-slate-800 transition-colors">
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 accent-yellow-400 cursor-pointer"
                          checked={saveAddress}
                          onChange={(e) => setSaveAddress(e.target.checked)}
                        />
                        <span className="text-sm font-bold text-slate-300">Salvar este endereço para pedidos futuros</span>
                      </label>

                      <div className="sticky bottom-24 mt-6">
                        <button
                          onClick={handleConfirmAddress}
                          disabled={!addressNumber.trim()}
                          className="w-full bg-yellow-400 text-slate-900 font-black py-4 rounded-2xl shadow-lg hover:bg-yellow-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          CONFIRMAR ENDEREÇO
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            )}

            {step === 'catalog' && (
              <div className={`p-4 max-w-2xl mx-auto ${cartTotal > 0 ? 'pb-40' : 'pb-24'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="text-yellow-500 w-4 h-4" />
                    <span className="text-xs font-bold truncate max-w-[150px]">{selectedAddress?.street}</span>
                  </div>
                  <button onClick={() => setStep('address')} className="text-xs font-black text-slate-400">TROCAR</button>
                </div>

                {/* Seletor rápido de modalidade no catálogo */}
                <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 mb-4 space-y-2">
                  <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                    <button
                      type="button"
                      onClick={() => setDeliveryType('immediate')}
                      className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                        deliveryType === 'immediate'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500'
                      }`}
                    >
                      <Zap className={`w-3.5 h-3.5 ${deliveryType === 'immediate' ? 'text-yellow-500' : 'text-slate-400'}`} />
                      <span>Pedir agora</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeliveryType('scheduled')}
                      className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                        deliveryType === 'scheduled'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500'
                      }`}
                    >
                      <Calendar className={`w-3.5 h-3.5 ${deliveryType === 'scheduled' ? 'text-purple-600' : 'text-slate-400'}`} />
                      <span>Agendar</span>
                    </button>
                  </div>

                  {deliveryType === 'scheduled' && (
                    <ScheduledPeriodSelector
                      periods={activeDeliveryPeriods}
                      selectedId={selectedPeriodId}
                      onSelect={setSelectedPeriodId}
                      availableDates={availableScheduledDates}
                      selectedDateISO={selectedScheduledDateISO}
                      onSelectDate={setSelectedScheduledDateISO}
                      dateInfo={scheduledDateInfo}
                    />
                  )}

                  {deliveryType === 'immediate' && !storeStatus.isOpen && (
                    <div className="flex items-center justify-between text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1.5 rounded-lg">
                      <span>⚠️ Entregas imediatas fechadas</span>
                      <button onClick={() => setDeliveryType('scheduled')} className="underline text-amber-900">Agendar pedido</button>
                    </div>
                  )}
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
                  <div className="fixed bottom-20 left-0 right-0 px-4 z-40 pointer-events-none">
                    <div className="max-w-2xl mx-auto bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between pointer-events-auto border border-slate-800">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Subtotal ({cartCount} {cartCount === 1 ? 'item' : 'itens'})</p>
                        <p className="text-xl font-black text-yellow-400">R$ {cartTotal.toFixed(2)}</p>
                      </div>
                      <button 
                        onClick={() => setStep('checkout')} 
                        className="bg-yellow-400 hover:bg-yellow-500 text-slate-950 px-6 py-3 rounded-xl font-black transition-all flex items-center gap-2 shadow-lg shadow-yellow-400/20 active:scale-95 cursor-pointer"
                      >
                        <span>FINALIZAR</span>
                        <ChevronRight className="w-5 h-5 stroke-[3]" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 'checkout' && (
              <div className="p-6 max-w-md mx-auto space-y-6">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setStep('catalog')}
                    className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    <ChevronRight className="w-5 h-5 rotate-180" />
                  </button>
                  <h2 className="text-2xl font-black">Finalizar Pedido</h2>
                </div>
                
                {/* Endereço de Entrega com botão para trocar */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Endereço de Entrega</p>
                    <button 
                      onClick={() => setShowAddressModal(true)}
                      className="text-xs font-black text-amber-600 hover:text-amber-700 uppercase flex items-center gap-1 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      <MapPin className="w-3 h-3 text-amber-500" />
                      Trocar
                    </button>
                  </div>
                  <p className="font-bold text-slate-900">{selectedAddress?.street}, {selectedAddress?.number}</p>
                  <p className="text-xs text-slate-500">{selectedAddress?.neighborhood}, {selectedAddress?.city}</p>
                  {selectedAddress?.complement && <p className="text-xs text-slate-400 mt-1">Compl: {selectedAddress.complement}</p>}
                </div>

                {/* 3.1: Modalidade de Pedido (Pedir agora vs Agendar pedido) */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Modalidade da Entrega</p>
                    {deliveryType === 'scheduled' ? (
                      <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                        {scheduledDateInfo.display}
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-green-700 bg-green-50 px-2.5 py-0.5 rounded-full border border-green-200">
                        Entrega Rápida
                      </span>
                    )}
                  </div>

                  {/* 2 pequenas abas juntas em um mesmo div */}
                  <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1 border border-slate-200/60">
                    <button
                      type="button"
                      onClick={() => setDeliveryType('immediate')}
                      className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                        deliveryType === 'immediate'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <Zap className={`w-3.5 h-3.5 ${deliveryType === 'immediate' ? 'text-yellow-500' : 'text-slate-400'}`} />
                      <span>Pedir agora</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeliveryType('scheduled')}
                      className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                        deliveryType === 'scheduled'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <Calendar className={`w-3.5 h-3.5 ${deliveryType === 'scheduled' ? 'text-purple-600' : 'text-slate-400'}`} />
                      <span>Agendar pedido</span>
                    </button>
                  </div>

                  {/* No primeiro item: seguir normal */}
                  {deliveryType === 'immediate' && (
                    <div>
                      {!storeStatus.isOpen ? (
                        <div className="bg-amber-50 border border-amber-200/80 p-3.5 rounded-2xl space-y-2">
                          <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                            <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                            <span>Entregas imediatas encerradas no momento</span>
                          </div>
                          <p className="text-[11px] text-amber-700 leading-relaxed">
                            {storeStatus.reason}
                          </p>
                          <button
                            type="button"
                            onClick={() => setDeliveryType('scheduled')}
                            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black py-2.5 rounded-xl text-xs transition-colors shadow-sm flex items-center justify-center gap-1.5 mt-1"
                          >
                            <Calendar className="w-3.5 h-3.5" /> Clique para Agendar para Amanhã
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2.5 bg-green-50 p-3 rounded-2xl border border-green-100 text-xs text-green-800">
                          <Clock className="w-4 h-4 text-green-600 flex-shrink-0" />
                          <div>
                            <span className="font-bold block">Entrega imediata em andamento</span>
                            <span className="text-[11px] text-green-600">Previsão estimada: 30 a 45 minutos</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* No segundo item: abrir o seletor dinâmico com possibilidade de escolher qualquer período */}
                  {deliveryType === 'scheduled' && (
                    <ScheduledPeriodSelector
                      periods={periodsForSelectedDate}
                      selectedId={selectedPeriodId}
                      onSelect={setSelectedPeriodId}
                      availableDates={availableScheduledDates}
                      selectedDateISO={selectedScheduledDateISO}
                      onSelectDate={setSelectedScheduledDateISO}
                      dateInfo={scheduledDateInfo}
                    />
                  )}
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
                          className="bg-slate-900 text-white px-4 rounded-xl font-black text-xs hover:bg-slate-800 transition-colors"
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
                  <button 
                    onClick={() => {
                      setPendingPaymentMethod('PIX');
                      setStep('confirmation');
                    }} 
                    className="w-full bg-slate-900 text-white p-4 rounded-2xl font-black shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                  >
                    💳 PAGAR COM PIX
                  </button>
                  <button 
                    onClick={() => {
                      setPendingPaymentMethod('Cartão');
                      setStep('confirmation');
                    }} 
                    className="w-full bg-white text-slate-900 p-4 rounded-2xl font-black border border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    💳 PAGAR NO CARTÃO
                  </button>
                  <div className="border-t border-slate-100 pt-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Dinheiro na Entrega</p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Troco para R$..."
                        className="flex-1 p-3 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:ring-2 focus:ring-yellow-400 text-sm font-bold"
                        value={cashChange}
                        onChange={(e) => setCashChange(e.target.value)}
                      />
                      <button
                        onClick={() => {
                          const change = cashChange ? ` — Troco para R$ ${parseFloat(cashChange).toFixed(2)}` : '';
                          setPendingPaymentMethod(`Dinheiro${change}`);
                          setStep('confirmation');
                        }}
                        className="bg-emerald-500 text-white px-4 rounded-xl font-black text-sm hover:bg-emerald-600 transition-all shadow-md shadow-emerald-500/20"
                      >
                        💵 DINHEIRO
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 'confirmation' && (
              <div className="p-6 max-w-md mx-auto space-y-5 pb-12">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setStep('checkout')}
                    className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    <ChevronRight className="w-5 h-5 rotate-180" />
                  </button>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">Confirmar Pedido</h2>
                    <p className="text-xs text-slate-500">Revise os dados antes de finalizar</p>
                  </div>
                </div>

                {/* Card Itens do Pedido */}
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-yellow-500" />
                      <p className="text-xs font-black text-slate-900 uppercase">Itens do Pedido</p>
                    </div>
                    <button onClick={() => setStep('catalog')} className="text-[11px] font-bold text-yellow-600 hover:underline">
                      Alterar
                    </button>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {Object.entries(cart).map(([id, qty]) => {
                      const product = PRODUCTS.find(p => p.id === id);
                      if (!product || (qty as number) <= 0) return null;
                      return (
                        <div key={id} className="py-2.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <img src={product.image} className="w-10 h-10 rounded-xl object-cover" referrerPolicy="no-referrer" />
                            <div>
                              <p className="font-bold text-xs text-slate-900">{product.name}</p>
                              <p className="text-[11px] text-slate-400">{qty}x · R$ {product.price.toFixed(2)} cada</p>
                            </div>
                          </div>
                          <span className="font-black text-sm text-slate-900">
                            R$ {(product.price * (qty as number)).toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Card Endereço de Entrega */}
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-yellow-500" />
                      <p className="text-xs font-black text-slate-900 uppercase">Endereço de Entrega</p>
                    </div>
                    <button 
                      onClick={() => setShowAddressModal(true)}
                      className="text-[11px] font-black text-amber-600 hover:text-amber-700 uppercase bg-amber-50 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      Trocar
                    </button>
                  </div>
                  <p className="font-bold text-sm text-slate-900">{selectedAddress?.street}, {selectedAddress?.number}</p>
                  <p className="text-xs text-slate-500">{selectedAddress?.neighborhood}, {selectedAddress?.city} - {selectedAddress?.state}</p>
                  {selectedAddress?.complement && <p className="text-xs text-slate-400 mt-1">Compl: {selectedAddress.complement}</p>}
                  {selectedAddress?.reference && <p className="text-xs text-slate-400">Ref: {selectedAddress.reference}</p>}
                </div>

                {/* Card Forma de Pagamento */}
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-yellow-500" />
                      <p className="text-xs font-black text-slate-900 uppercase">Pagamento</p>
                    </div>
                    <button 
                      onClick={() => setStep('checkout')}
                      className="text-[11px] font-black text-amber-600 hover:text-amber-700 uppercase bg-amber-50 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      Alterar
                    </button>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                      {pendingPaymentMethod.startsWith('PIX') ? 'PIX' : pendingPaymentMethod.startsWith('Cartão') ? '💳' : '💵'}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-900">{pendingPaymentMethod}</p>
                      <p className="text-[11px] text-slate-400">
                        {pendingPaymentMethod.startsWith('PIX') ? 'Chave ou QR Code na entrega' : pendingPaymentMethod.startsWith('Cartão') ? 'Maquininha levada pelo entregador' : 'Pagamento em espécie na entrega'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Card Modalidade da Entrega (Agendada ou Imediata) - Posicionado ACIMA do Subtotal dos Itens */}
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {deliveryType === 'scheduled' ? (
                        <>
                          <Calendar className="w-4 h-4 text-purple-600" />
                          <p className="text-xs font-black text-slate-900 uppercase">Entrega Agendada</p>
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 text-emerald-600" />
                          <p className="text-xs font-black text-slate-900 uppercase">Entrega Imediata</p>
                        </>
                      )}
                    </div>
                    <button 
                      type="button"
                      onClick={() => setStep('checkout')}
                      className="text-[11px] font-black text-amber-600 hover:text-amber-700 uppercase bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      Alterar
                    </button>
                  </div>

                  {deliveryType === 'scheduled' ? (
                    <div className="flex items-center gap-3 mt-1 bg-purple-50/80 p-3.5 rounded-2xl border border-purple-200/70">
                      <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-sm text-purple-950">
                          {scheduledDateInfo.fullDisplay}
                        </p>
                        <p className="text-xs font-bold text-purple-700 mt-0.5">
                          Turno {currentSelectedPeriod?.name} ({currentSelectedPeriod?.startTime} às {currentSelectedPeriod?.endTime})
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 mt-1 bg-emerald-50/80 p-3.5 rounded-2xl border border-emerald-200/70">
                      <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-sm text-emerald-950">
                          Previsão estimada: 25 a 45 minutos
                        </p>
                        <p className="text-xs text-emerald-700 mt-0.5 font-medium">
                          Entrega rápida no seu endereço após confirmação
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Resumo Financeiro */}
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Subtotal dos itens</span>
                    <span className="font-bold text-slate-900">R$ {cartSubtotal.toFixed(2)}</span>
                  </div>
                  {discountValue > 0 && (
                    <div className="flex justify-between text-xs text-emerald-600">
                      <span>Desconto ({appliedCoupon?.code})</span>
                      <span className="font-bold">- R$ {discountValue.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Taxa de entrega</span>
                    <span className="font-bold text-emerald-600 uppercase">Grátis</span>
                  </div>
                  <div className="flex justify-between items-center text-lg font-black pt-2 border-t border-slate-100">
                    <span className="text-slate-900">Total a Pagar</span>
                    <span className="text-2xl text-slate-900">R$ {cartTotal.toFixed(2)}</span>
                  </div>
                  <div className="bg-yellow-50 rounded-xl p-2.5 text-center mt-2 border border-yellow-100">
                    <p className="text-[11px] text-yellow-800 font-bold">
                      🎉 Você ganhará <span className="font-black text-yellow-900">{Math.floor(cartTotal * 10)} pontos</span> com este pedido!
                    </p>
                  </div>
                </div>

                {/* Botões de Confirmação */}
                <div className="space-y-2 pt-2">
                  <button
                    onClick={handleConfirmOrder}
                    disabled={checkoutLoading}
                    className="w-full bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-black py-4 rounded-2xl text-base shadow-xl shadow-yellow-400/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    CONFIRMAR PEDIDO <ChevronRight className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setStep('checkout')}
                    className="w-full text-slate-400 hover:text-slate-600 font-bold text-xs py-2 text-center transition-colors"
                  >
                    Voltar e editar informações
                  </button>
                </div>
              </div>
            )}

            {step === 'processing' && (
              <div className="fixed inset-0 bg-white/95 backdrop-blur-md z-[70] flex flex-col items-center justify-center p-6 text-center">
                <AnimatePresence mode="wait">
                  {processingStage === 'loading' ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex flex-col items-center justify-center"
                    >
                      <div className="relative flex items-center justify-center">
                        <div className="w-24 h-24 rounded-full bg-yellow-400/25 animate-ping absolute" />
                        <div className="w-20 h-20 rounded-full bg-white shadow-2xl flex items-center justify-center relative border-4 border-yellow-400">
                          <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
                        </div>
                      </div>
                      <h2 className="text-2xl font-black text-slate-900 mt-8">Processando Pedido...</h2>
                      <p className="text-slate-500 text-sm mt-2 max-w-xs">
                        Estamos registrando seu pedido e conectando com a central de entregas.
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.4 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 280, damping: 18 }}
                      className="flex flex-col items-center justify-center max-w-sm w-full"
                    >
                      {/* Círculo verde com check animado centralizado */}
                      <motion.div
                        initial={{ scale: 0, rotate: -45 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 20, delay: 0.1 }}
                        className="w-24 h-24 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-2xl shadow-emerald-500/40 relative mx-auto"
                      >
                        <motion.div
                          initial={{ scale: 0.8, opacity: 0.8 }}
                          animate={{ scale: 1.5, opacity: 0 }}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className="absolute inset-0 rounded-full bg-emerald-400 -z-10"
                        />
                        <Check className="w-12 h-12 stroke-[3.5]" />
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="mt-6 space-y-2"
                      >
                        <span className="inline-block bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                          Sucesso
                        </span>
                        <h2 className="text-2xl font-black text-slate-900">Pedido Confirmado!</h2>
                        <p className="text-sm font-bold text-slate-700">
                          Código do Pedido: <span className="text-yellow-600 font-black">#{lastOrder?.id}</span>
                        </p>
                        <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
                          Seu pedido já foi recebido pela nossa equipe e logo sairá para entrega em seu endereço!
                        </p>
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35 }}
                        className="mt-8 w-full space-y-3"
                      >
                        <button
                          onClick={() => {
                            setStep('landing');
                            setActiveTab('tracking');
                          }}
                          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-2xl shadow-xl shadow-slate-900/15 transition-all flex items-center justify-center gap-2"
                        >
                          <Truck className="w-5 h-5 text-yellow-400" />
                          ACOMPANHAR ENTREGA
                        </button>
                        <button
                          onClick={() => {
                            setStep('landing');
                            setActiveTab('home');
                          }}
                          className="w-full text-slate-400 hover:text-slate-600 font-bold text-xs py-2 transition-colors"
                        >
                          Voltar ao Início
                        </button>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
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
            <div className="space-y-3">
              {customerOrders.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-3xl border border-slate-100 shadow-sm">
                  <Package className="text-slate-300 w-12 h-12 mx-auto mb-3" />
                  <p className="text-slate-400 font-bold">Você ainda não fez nenhum pedido.</p>
                  <button onClick={() => { setStep('landing'); setActiveTab('home'); }} className="mt-4 bg-slate-900 text-white px-6 py-2 rounded-xl font-bold text-sm">
                    Fazer Pedido
                  </button>
                </div>
              ) : (
                [...customerOrders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(o => {
                  const [expanded, setExpanded] = [false, () => {}]; // handled per-element below
                  return (
                    <HistoryCard
                      key={o.id}
                      order={o}
                      onReorder={(order) => {
                        const newCart: { [id: string]: number } = {};
                        order.items.forEach(item => { newCart[item.productId] = item.quantity; });
                        setCart(newCart);
                        setStep('catalog');
                        setActiveTab('home');
                      }}
                      onRate={(order, service, delivery, feedback) => {
                        if (onUpdateOrder) {
                          const updated = {
                            ...order,
                            rating: service,
                            serviceRating: service,
                            deliveryRating: delivery,
                            ...(feedback ? { feedback: order.feedback ? `${order.feedback} | ${feedback}` : feedback } : {})
                          };
                          onUpdateOrder(updated);
                          setLocalRating({ orderId: order.id, service, delivery });
                          setRatingSuccessModal({ order: updated, serviceRating: service, deliveryRating: delivery });
                        }
                      }}
                      onTrack={(order) => {
                        setSelectedTrackingOrderId(order.id);
                        setActiveTab('tracking');
                      }}
                      onCancel={(order) => {
                        handleOpenCancelModal(order);
                      }}
                      onSkip={(order) => {
                        handleSkipRating(order.id);
                      }}
                    />
                  );
                })
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'referral' && (
          <motion.div key="referral" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 max-w-2xl mx-auto space-y-6">
            <header className="text-center mb-2">
              <div className="bg-yellow-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                <Gift className="text-yellow-600 w-8 h-8" />
              </div>
              <h2 className="text-xl font-black">Seus Benefícios</h2>
            </header>

            {/* Sub-tabs toggle */}
            <div className="flex gap-2 bg-slate-200 p-1 rounded-xl">
              <button 
                onClick={() => setReferralTab('pontos')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${referralTab === 'pontos' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
              >
                💰 PONTOS E RESGATES
              </button>
              <button 
                onClick={() => setReferralTab('indicacoes')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${referralTab === 'indicacoes' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
              >
                👥 INDICAÇÕES
              </button>
            </div>

            {referralTab === 'pontos' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl shadow-slate-900/20 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold opacity-60 uppercase tracking-widest mb-1">Saldo Atual</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black">{reconciledBalance.toLocaleString('pt-BR')}</span>
                        <span className="text-yellow-400 font-bold">pontos</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowPointsHistoryModal(true)}
                      className="bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-slate-950 font-black text-xs px-3.5 py-2.5 rounded-2xl flex items-center gap-1.5 transition-all shadow-md shadow-yellow-400/20"
                    >
                      <Clock className="w-3.5 h-3.5 stroke-[2.5]" />
                      Histórico
                    </button>
                  </div>
                  <p className="text-[10px] mt-3 opacity-50">Ganhe {benefitsConfig?.pointsPerCurrency ?? 10} pontos a cada R$ 1,00 em compras concluídas.</p>
                </div>

                <div className="space-y-4">
                  <h3 className="font-black text-lg flex items-center gap-2">
                    <Star className="text-yellow-500 w-5 h-5" /> Trocar Pontos
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {rewards.filter(r => r.isActive !== false).map(reward => {
                      const userPoints = reconciledBalance;
                      const progress = Math.min(100, (userPoints / reward.pointsCost) * 100);
                      const canRedeem = userPoints >= reward.pointsCost;

                      // Resgate ativo para este card e usuário
                      const activeRedemption = redeemedRewards.find(r => r.rewardId === reward.id && r.userId === user.id && r.status === 'active');
                      const isRedeemed = !!activeRedemption;
                      const daysInfo = activeRedemption ? codeService.formatDaysRemaining(activeRedemption.validUntil) : null;

                      return (
                        <div 
                          key={reward.id} 
                          onClick={() => {
                            if (isRedeemed) {
                              setSelectedViewRedemption(activeRedemption);
                            } else {
                              setSelectedRewardDetails(reward);
                            }
                          }}
                          className={`bg-white p-5 rounded-3xl border shadow-sm flex flex-col cursor-pointer transition-all group relative ${
                            isRedeemed 
                              ? 'border-emerald-200 hover:border-emerald-400 hover:shadow-md ring-1 ring-emerald-100' 
                              : 'border-slate-100 hover:border-yellow-300 hover:shadow-md'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className={`p-2.5 rounded-2xl transition-colors ${
                              isRedeemed ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 group-hover:bg-yellow-50'
                            }`}>
                              {reward.productId && PRODUCTS.find(p => p.id === reward.productId)?.image ? (
                                <img 
                                  src={PRODUCTS.find(p => p.id === reward.productId)?.image} 
                                  alt={reward.title} 
                                  className="w-8 h-8 rounded-xl object-cover" 
                                />
                              ) : reward.type === 'discount' ? (
                                <Ticket className="text-blue-500 w-6 h-6" />
                              ) : (
                                <Package className="text-green-500 w-6 h-6" />
                              )}
                            </div>
                            {isRedeemed ? (
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                                <Check className="w-3 h-3 stroke-[3]" />
                                RESGATADO
                              </span>
                            ) : (
                              <span className="bg-yellow-100 text-yellow-700 text-[10px] font-black px-3 py-1 rounded-full">
                                {reward.pointsCost} PTS
                              </span>
                            )}
                          </div>
                          <h4 className={`font-black transition-colors ${
                            isRedeemed ? 'text-slate-900 group-hover:text-emerald-700' : 'text-slate-900 group-hover:text-yellow-600'
                          }`}>
                            {reward.title}
                          </h4>
                          {reward.productId && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md inline-block w-fit mt-1">
                              ✓ Adiciona produto grátis no carrinho
                            </span>
                          )}
                          <p className="text-xs text-slate-500 mt-1 mb-2 flex-1">{reward.description}</p>

                          {isRedeemed ? (
                            <div className="flex items-center justify-between text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100 mb-3">
                              <span className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                                {daysInfo?.text || 'Expira em breve'}
                              </span>
                              <span className="text-[10px] uppercase font-black text-emerald-800 flex items-center gap-0.5">
                                Ver Código <ChevronRight className="w-3 h-3" />
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-[11px] font-bold text-yellow-600 mb-3">
                              <span>Ver regras e detalhes</span>
                              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                            </div>
                          )}
                          
                          <div className="mb-4">
                            {isRedeemed ? (
                              <div className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 flex items-center justify-between">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Código Único:</span>
                                <span className="text-xs font-mono font-black text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                                  {activeRedemption.code}
                                </span>
                              </div>
                            ) : (
                              <>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-yellow-400 transition-all duration-500" style={{ width: `${progress}%` }}></div>
                                </div>
                                {!canRedeem && (
                                  <p className="text-[10px] text-slate-400 mt-1 text-right">Faltam {reward.pointsCost - userPoints} pts</p>
                                )}
                              </>
                            )}
                          </div>

                          {isRedeemed ? (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedViewRedemption(activeRedemption);
                              }}
                              className="w-full py-3 rounded-xl font-black text-xs transition-all bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 shadow-sm flex items-center justify-center gap-1.5 active:scale-[0.99] cursor-pointer"
                            >
                              <Check className="w-4 h-4 text-emerald-700 stroke-[3]" />
                              Resgatado
                            </button>
                          ) : (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (canRedeem) {
                                  setRewardConfirmation({ reward, stage: 'confirm' });
                                } else {
                                  setSelectedRewardDetails(reward);
                                }
                              }}
                              disabled={!canRedeem}
                              className={`w-full py-3 rounded-xl font-black text-xs transition-all ${
                                canRedeem 
                                  ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-md shadow-slate-900/10' 
                                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                              }`}
                            >
                              RESGATAR
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {referralTab === 'indicacoes' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-center">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Seu Código de Indicação</p>
                  <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border-2 border-dashed border-slate-200">
                    <span className="text-xl font-black tracking-widest flex-1 text-slate-900">{userReferralCode}</span>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(userReferralCode);
                        showToast(`Código ${userReferralCode} copiado com sucesso!`);
                      }}
                      className="bg-slate-900 text-white p-2.5 rounded-xl hover:bg-slate-800 transition-colors"
                      title="Copiar Código"
                    >
                      <Copy className="w-4 h-4 text-yellow-400" />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-3">Você ganha {benefitsConfig?.referralPointsAwarded ?? 100} pontos e seu amigo ganha R$ {(benefitsConfig?.referralDiscountValue ?? 10).toFixed(2)} de desconto na 1ª compra dele.</p>
                  <button 
                    onClick={() => setIsDirectReferralModalOpen(true)}
                    className="mt-4 w-full bg-slate-900 text-white py-3.5 rounded-2xl font-black text-xs hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10"
                  >
                    <Plus className="w-4 h-4 text-yellow-400" /> INDICAR DIRETAMENTE
                  </button>
                </div>

                <div className="space-y-4">
                  <h3 className="font-black text-lg flex items-center gap-2">
                    <Users className="text-yellow-500 w-5 h-5" /> Minhas Indicações
                  </h3>
                  <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    {referrals.filter(r => r.referrerId === user.id).length === 0 ? (
                      <div className="p-8 text-center">
                        <p className="text-slate-400 text-sm font-bold">Você ainda não indicou ninguém.</p>
                        <p className="text-xs text-slate-400 mt-1">Indique amigos e ganhe {benefitsConfig?.referralPointsAwarded ?? 100} pontos por compra concluída!</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-50">
                        {referrals.filter(r => r.referrerId === user.id).map(ref => (
                          <div 
                            key={ref.id} 
                            onClick={() => {
                              if (ref.status === 'Validado' || ref.status === 'Confirmado') {
                                setCelebrationModal(ref);
                              } else {
                                setReferralActionModal({ referral: ref, isNew: false });
                              }
                            }}
                            className="p-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors group"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-xs ${
                                (ref.status === 'Validado' || ref.status === 'Confirmado') ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {ref.refereeName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-black text-slate-900 text-sm group-hover:text-yellow-600 transition-colors">{ref.refereeName}</p>
                                <p className="text-[10px] text-slate-400">
                                  {ref.refereePhone} · {(ref.status === 'Validado' || ref.status === 'Confirmado') ? `1ª Compra Concluída (+${ref.pointsAwarded || benefitsConfig?.referralPointsAwarded || 100} pts)` : 'Aguardando 1ª compra'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-right">
                              <div>
                                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                                  (ref.status === 'Validado' || ref.status === 'Confirmado') ? 'bg-emerald-100 text-emerald-700' : 
                                  ref.status === 'Rejeitado' ? 'bg-red-100 text-red-700' : 
                                  'bg-amber-100 text-amber-800'
                                }`}>
                                  {(ref.status === 'Validado' || ref.status === 'Confirmado') ? 'CONFIRMADO' : 'PENDENTE'}
                                </span>
                                <p className="text-[9px] text-slate-400 mt-1">{new Date(ref.createdAt).toLocaleDateString('pt-BR')}</p>
                              </div>
                              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {activeTab === 'tracking' && (
          <motion.div key="tracking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 max-w-2xl mx-auto space-y-6">
            {(() => {
              const activeOrders = [...orders]
                .filter(o => isUserOrder(o) && o.status !== 'Concluído' && o.status !== 'Cancelado')
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

              const unratedConcludedOrder = [...orders]
                .filter(o => 
                  isUserOrder(o) && 
                  o.status === 'Concluído' && 
                  o.status !== 'Cancelado' &&
                  !o.rating && 
                  localRating?.orderId !== o.id &&
                  !skippedRatingOrderIds.includes(o.id)
                )
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

              // Se não há pedidos ativos nem pedidos para avaliar
              if (activeOrders.length === 0 && !unratedConcludedOrder) {
                return (
                  <>
                    <h2 className="text-2xl font-black mb-6">Status do Pedido</h2>
                    <div className="text-center py-12 bg-white rounded-3xl border border-slate-100 shadow-sm">
                      <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Package className="text-slate-400 w-8 h-8" />
                      </div>
                      <p className="text-slate-900 font-black">Nenhum pedido ativo</p>
                      <p className="text-slate-500 text-sm mt-1 px-6">Você não possui entregas em andamento no momento.</p>
                      <button 
                        onClick={() => setActiveTab('home')} 
                        className="mt-6 bg-slate-900 text-white px-8 py-3 rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors"
                      >
                        FAZER UM PEDIDO
                      </button>
                    </div>
                  </>
                );
              }

              // Se não há pedidos ativos, mas há um pedido concluído pendente de avaliação
              if (activeOrders.length === 0 && unratedConcludedOrder) {
                const hasLowerThan5 = (serviceStars > 0 && serviceStars < 5) || (deliveryStars > 0 && deliveryStars < 5);

                return (
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 mb-6">Entrega Realizada!</h2>
                    
                    <div className="space-y-6 mb-6">
                      <div>
                        <p className="text-sm font-bold text-slate-900 mb-2">Avalie nosso atendimento (Porto Gás)</p>
                        <div className="flex justify-center gap-2">
                          {[1, 2, 3, 4, 5].map(star => (
                            <button key={`service-${star}`} onClick={() => setServiceStars(star)} className={`${star <= serviceStars ? 'text-yellow-400' : 'text-slate-200'} hover:text-yellow-400 transition-colors`}>
                              <Star className="w-8 h-8 fill-current" />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-bold text-slate-900 mb-2">Como foi a entrega? (Entregador)</p>
                        <div className="flex justify-center gap-2">
                          {[1, 2, 3, 4, 5].map(star => (
                            <button key={`delivery-${star}`} onClick={() => setDeliveryStars(star)} className={`${star <= deliveryStars ? 'text-yellow-400' : 'text-slate-200'} hover:text-yellow-400 transition-colors`}>
                              <Star className="w-8 h-8 fill-current" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Detalhamento caso nota seja inferior a 5 estrelas */}
                    {hasLowerThan5 && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 text-left space-y-3 mb-6"
                      >
                        <div className="flex items-center gap-2 text-amber-900">
                          <MessageSquare className="w-4 h-4 text-amber-600" />
                          <span className="text-xs font-black uppercase tracking-wider">
                            O que faltou para 5 estrelas?
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 font-medium">
                          Selecione um ou mais motivos para nos ajudar a melhorar nosso serviço:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {RATING_IMPROVEMENT_TAGS.map(tag => {
                            const isSelected = feedbackTags.includes(tag);
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => {
                                  setFeedbackTags(prev => 
                                    prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                                  );
                                }}
                                className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
                                  isSelected
                                    ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs scale-[1.02]'
                                    : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-100/60'
                                }`}
                              >
                                {isSelected && '✓ '}{tag}
                              </button>
                            );
                          })}
                        </div>
                        <textarea
                          rows={2}
                          value={feedbackComment}
                          onChange={(e) => setFeedbackComment(e.target.value)}
                          placeholder="Conte mais detalhes sobre o que aconteceu (opcional)..."
                          className="w-full text-xs p-3 rounded-xl bg-white border border-amber-200 text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-amber-400 outline-none resize-none font-medium"
                        />
                      </motion.div>
                    )}

                    <button 
                      disabled={!serviceStars || !deliveryStars}
                      onClick={() => {
                        if (onUpdateOrder) {
                          const parts: string[] = [];
                          if (feedbackTags.length > 0) {
                            parts.push(`[Motivos: ${feedbackTags.join(', ')}]`);
                          }
                          if (feedbackComment.trim()) {
                            parts.push(feedbackComment.trim());
                          }
                          const finalFb = parts.join(' - ');
                          const currentFb = unratedConcludedOrder.feedback;
                          const mergedFb = finalFb ? (currentFb ? `${currentFb} | ${finalFb}` : finalFb) : currentFb;

                          const updatedOrder = {
                            ...unratedConcludedOrder,
                            rating: serviceStars,
                            serviceRating: serviceStars,
                            deliveryRating: deliveryStars,
                            ...(mergedFb ? { feedback: mergedFb } : {})
                          };

                          setLocalRating({ orderId: unratedConcludedOrder.id, service: serviceStars, delivery: deliveryStars });
                          onUpdateOrder(updatedOrder);
                          setRatingSuccessModal({ order: updatedOrder, serviceRating: serviceStars, deliveryRating: deliveryStars });
                          setFeedbackTags([]);
                          setFeedbackComment('');
                        }
                      }}
                      className="w-full mb-3 bg-slate-900 text-white py-4 rounded-2xl font-black text-sm hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-slate-900/10"
                    >
                      ENVIAR AVALIAÇÃO
                    </button>

                    <button 
                      type="button"
                      onClick={() => handleSkipRating(unratedConcludedOrder.id)}
                      className="w-full text-slate-400 hover:text-slate-600 font-bold text-xs py-2 transition-colors mb-3"
                    >
                      Pular avaliação
                    </button>

                    <button 
                      onClick={() => setActiveTab('referral')}
                      className="w-full bg-yellow-50 text-yellow-700 py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-yellow-100 transition-all border border-yellow-200"
                    >
                      <Users className="w-4 h-4" /> INDICAR AMIGO E GANHAR MAIS
                    </button>
                  </motion.div>
                );
              }

              // Há 1 ou mais pedidos ativos!
              return (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-black text-slate-900">
                      {activeOrders.length === 1 ? 'Acompanhar Pedido' : 'Pedidos em Andamento'}
                    </h2>
                    {activeOrders.length > 1 && (
                      <span className="bg-yellow-400 text-slate-900 text-xs font-black px-3 py-1 rounded-full">
                        {activeOrders.length} pedidos
                      </span>
                    )}
                  </div>

                  {activeOrders.map((activeOrder) => {
                    const formattedDate = new Date(activeOrder.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    const formattedTime = new Date(activeOrder.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    
                    const deliveryPerson = allDeliveryPersons?.find(dp => dp.id === activeOrder.deliveryPersonId);
                    const deliveryLat = activeOrder.deliveryPersonLocation?.lat || deliveryPerson?.location?.lat;
                    const deliveryLng = activeOrder.deliveryPersonLocation?.lng || deliveryPerson?.location?.lng;
                    const customerLat = activeOrder.address.lat || -22.905;
                    const customerLng = activeOrder.address.lng || -43.113;

                    const steps = [
                      { label: 'Recebido', status: 'Pendente', icon: Clock, active: true },
                      { label: 'Preparando', status: 'Atribuído', icon: Package, active: activeOrder.status === 'Atribuído' || activeOrder.status === 'Em Rota' || !!activeOrder.deliveryPersonId },
                      { label: 'Em Rota', status: 'Em Rota', icon: Truck, active: activeOrder.status === 'Em Rota' },
                      { label: 'Entregue', status: 'Concluído', icon: CheckCircle2, active: false },
                    ];

                    const statusBadgeColor = activeOrder.status === 'Em Rota' ? 'bg-blue-100 text-blue-700' :
                      activeOrder.status === 'Atribuído' ? 'bg-amber-100 text-amber-800' :
                      'bg-yellow-100 text-yellow-800';

                    const isHighlight = selectedTrackingOrderId === activeOrder.id;

                    return (
                      <div 
                        key={activeOrder.id} 
                        className={`bg-white rounded-3xl shadow-sm border transition-all space-y-4 p-5 sm:p-6 ${
                          isHighlight ? 'border-yellow-400 ring-2 ring-yellow-400/20 shadow-md' : 'border-slate-100'
                        }`}
                      >
                        {/* Cabeçalho do Card: Número do pedido, data e hora */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-black text-slate-900">Pedido #{activeOrder.id}</span>
                              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${statusBadgeColor}`}>
                                {activeOrder.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Realizado em {formattedDate} às {formattedTime}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-black text-slate-900">R$ {activeOrder.total.toFixed(2)}</span>
                            <p className="text-[11px] text-slate-400">{activeOrder.paymentMethod}</p>
                          </div>
                        </div>

                        {/* Itens e Endereço */}
                        <div className="bg-slate-50 p-3 rounded-2xl space-y-1.5 text-xs">
                          <div className="flex items-start gap-2 text-slate-700">
                            <MapPin className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0 mt-0.5" />
                            <span className="font-semibold truncate">
                              {activeOrder.address.street}, {activeOrder.address.number} — {activeOrder.address.neighborhood}
                            </span>
                          </div>
                          <div className="text-slate-500 text-[11px] pl-5">
                            {activeOrder.items.map(item => {
                              const product = PRODUCTS.find(p => p.id === item.productId);
                              return `${item.quantity}x ${product?.name || item.productId}`;
                            }).join(' · ')}
                          </div>
                        </div>

                        {/* Timeline de Status */}
                        <div className="py-2">
                          <div className="flex justify-between mb-6 relative">
                            <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-100 -z-0"></div>
                            {steps.map((s, i) => (
                              <div key={i} className="flex flex-col items-center gap-2 relative z-10">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-sm transition-colors ${
                                  s.active ? 'bg-yellow-400 text-slate-900' : 'bg-slate-100 text-slate-400'
                                }`}>
                                  <s.icon className="w-4 h-4" />
                                </div>
                                <span className={`text-[10px] font-black uppercase ${s.active ? 'text-slate-900' : 'text-slate-400'}`}>
                                  {s.label}
                                </span>
                              </div>
                            ))}
                          </div>

                          <div className="text-center p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Status Atual</p>
                            <h4 className="text-sm font-black text-slate-900">
                              {activeOrder.status === 'Pendente' && !activeOrder.deliveryPersonId && "Aguardando confirmação do gestor..."}
                              {activeOrder.status === 'Pendente' && activeOrder.deliveryPersonId && "Pedido aceito! O entregador está finalizando outras entregas próximas."}
                              {activeOrder.status === 'Atribuído' && "Pedido atribuído ao entregador! Aguardando saída para entrega."}
                              {activeOrder.status === 'Em Rota' && "O entregador está a caminho do seu endereço!"}
                            </h4>
                          </div>
                        </div>

                        {/* Se estiver Em Rota: Exibir Mapa com Rota Dinâmica e Detalhes do Entregador */}
                        {activeOrder.status === 'Em Rota' && (
                          <ActiveOrderTrackingSection
                            activeOrder={activeOrder}
                            deliveryPerson={deliveryPerson}
                            deliveryLat={deliveryLat}
                            deliveryLng={deliveryLng}
                            customerLat={customerLat}
                            customerLng={customerLng}
                          />
                        )}

                        {/* Botão de Cancelar no Card do Pedido */}
                        <div className="pt-2 border-t border-slate-100 flex justify-end">
                          <button
                            onClick={() => handleOpenCancelModal(activeOrder)}
                            className={`text-xs font-bold py-2 px-3.5 rounded-xl flex items-center gap-1.5 transition-all ${
                              activeOrder.status === 'Pendente'
                                ? 'text-red-600 bg-red-50 hover:bg-red-100 border border-red-200'
                                : 'text-slate-400 bg-slate-100 hover:bg-slate-200 border border-slate-200'
                            }`}
                          >
                            <X className="w-3.5 h-3.5" /> Cancelar Pedido
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </motion.div>
        )}
            {activeTab === 'profile' && (
              <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-6 max-w-md mx-auto space-y-6 pt-12">
                <header className="mb-4">
                  <h1 className="text-3xl font-black text-slate-900">Meu Perfil</h1>
                  <p className="text-slate-500 font-medium mt-1">Aqui você gerencia seus dados de conta e entrega.</p>
                </header>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                  <h3 className="font-black text-lg text-slate-900 flex items-center gap-2"><User className="text-yellow-500 w-5 h-5"/> Dados Pessoais</h3>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Como quer ser chamado?</label>
                    <input 
                      type="text" 
                      className="w-full p-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-yellow-400 outline-none transition-all font-bold"
                      value={user.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val && val.trim()) {
                          try {
                            localStorage.setItem('gas_app_customer_name', val.trim());
                            localStorage.setItem('gas_app_onboarding_completed', 'true');
                          } catch {}
                        }
                        onUpdateUser({ ...user, name: val });
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Seu WhatsApp</label>
                    <input 
                      type="text" 
                      className="w-full p-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-yellow-400 outline-none transition-all font-bold"
                      value={user.phone || ''}
                      onChange={(e) => onUpdateUser({ ...user, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-black text-lg text-slate-900 flex items-center gap-2"><MapPin className="text-yellow-500 w-5 h-5"/> Meus Endereços</h3>
                    <button onClick={() => { setStep('address'); setActiveTab('home'); }} className="text-yellow-600 font-bold text-sm bg-yellow-50 px-3 py-1 rounded-lg hover:bg-yellow-100 transition-colors">
                      + Novo
                    </button>
                  </div>
                  
                  {(!user.addresses || user.addresses.length === 0) ? (
                    <div className="text-center py-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                      <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-400 text-sm font-bold">Nenhum endereço salvo.</p>
                      <p className="text-slate-400 text-xs mt-1">Os endereços que você usar nos pedidos aparecerão aqui.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {user.addresses.map((addr, idx) => (
                        <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start justify-between group hover:border-slate-200 transition-colors">
                          <div>
                            <p className="font-black text-slate-900 text-sm">{addr.street}, {addr.number}</p>
                            <p className="text-xs text-slate-500 font-medium">{addr.neighborhood}, {addr.city}</p>
                            {addr.complement && <p className="text-[10px] text-slate-400 mt-1 font-bold">Compl: {addr.complement}</p>}
                            {addr.reference && <p className="text-[10px] text-slate-400 font-bold">Ref: {addr.reference}</p>}
                          </div>
                          <button 
                            onClick={() => {
                              if(window.confirm('Remover este endereço?')) {
                                const newAddresses = [...user.addresses!];
                                newAddresses.splice(idx, 1);
                                onUpdateUser({ ...user, addresses: newAddresses });
                                showToast('Endereço removido.');
                              }
                            }}
                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {onLogout && (
                  <div className="pt-2">
                    <button 
                      type="button"
                      onClick={onLogout}
                      className="w-full py-4 bg-red-50 hover:bg-red-100 text-red-600 font-black rounded-2xl border border-red-200 text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      SAIR DA MINHA CONTA
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCoverageMap && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex justify-center items-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[80vh]">
              <div className="flex justify-between items-center p-6 border-b border-slate-100">
                <h3 className="font-black text-xl flex items-center gap-2">
                  <MapPin className="text-yellow-500 w-6 h-6" /> Áreas de Cobertura
                </h3>
                <button onClick={() => setShowCoverageMap(false)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-6 h-6 text-slate-400" /></button>
              </div>
              <div className="flex-1 relative bg-slate-100 z-0 isolate overflow-hidden">
                <MapContainer center={[-22.905, -43.11]} zoom={13} style={{ height: '100%', width: '100%' }}>
                  <TileLayer
                    url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  <CustomerCoverageFit coverageAreas={coverageAreas} />
                  {coverageAreas.map(area => {
                    const boundaryData = area.boundary || (area.center ? createCirclePolygon(area.center.lat, area.center.lng, 1.2) : null);
                    if (!boundaryData) return null;

                    return (
                      <GeoJSON 
                        key={`customer-boundary-${area.id}`}
                        data={boundaryData}
                        style={{
                          fillColor: '#facc15',
                          weight: 2,
                          opacity: 1,
                          color: '#ca8a04',
                          fillOpacity: 0.35
                        }}
                      >
                        <Popup>
                          <div className="p-1">
                            <div className="font-black text-sm text-slate-900">{area.neighborhood}</div>
                            <div className="text-xs text-slate-500 font-semibold">{area.city}</div>
                            <div className="mt-1 text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block">
                              ✓ Área Atendida
                            </div>
                          </div>
                        </Popup>
                      </GeoJSON>
                    );
                  })}
                </MapContainer>
              </div>
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-sm">
                <p className="text-slate-500 font-medium">Não achou seu bairro? Fique ligado, estamos expandindo!</p>
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <div className="w-4 h-4 bg-yellow-400 opacity-50 border border-yellow-500 rounded"></div> Área atendida
                </div>
              </div>
            </motion.div>
          </div>
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
                    if (!directReferralForm.name.trim() || !directReferralForm.phone.trim()) {
                      alert('Por favor, preencha o nome e o WhatsApp do amigo.');
                      return;
                    }
                    const cleanDigits = directReferralForm.phone.replace(/\D/g, '');
                    if (cleanDigits.length < 10) {
                      alert('Por favor, informe um número de WhatsApp válido com DDD (ex: 21999998888).');
                      return;
                    }

                    // 1. Não permitir indicar o próprio número
                    const userCleanPhone = (user.phone || '').replace(/\D/g, '');
                    if (userCleanPhone && cleanDigits === userCleanPhone) {
                      alert('Você não pode indicar o seu próprio número de telefone.');
                      return;
                    }

                    // 2. Não permitir indicar quem já é cliente com pedidos ativos ou concluídos
                    const existingCustomerOrders = orders.filter(o => 
                      o.phone?.replace(/\D/g, '') === cleanDigits && o.status !== 'Cancelado'
                    );
                    if (existingCustomerOrders.length > 0) {
                      alert('Este número pertence a um cliente que já realizou pedidos na Porto Gás. A indicação é válida exclusivamente para novos clientes.');
                      return;
                    }

                    // 3. Uso único: o indicado só pode ser indicado por UMA pessoa e UMA única vez
                    const alreadyReferred = referrals.find(r => 
                      r.refereePhone.replace(/\D/g, '') === cleanDigits
                    );
                    if (alreadyReferred) {
                      if (alreadyReferred.referrerId === user.id) {
                        alert('Você já cadastrou uma indicação para este amigo. Verifique sua lista de indicações.');
                      } else {
                        alert('Este amigo já foi indicado anteriormente por outro usuário. Cada novo cliente só pode ser indicado uma única vez.');
                      }
                      return;
                    }

                    const newReferral: Referral = {
                      id: Math.random().toString(36).substr(2, 9),
                      referrerId: user.id,
                      referrerName: user.name,
                      refereeName: directReferralForm.name.trim(),
                      refereePhone: directReferralForm.phone.trim(),
                      status: 'Pendente',
                      pointsAwarded: benefitsConfig?.referralPointsAwarded ?? 100,
                      createdAt: new Date().toISOString()
                    };
                    onAddReferral(newReferral);
                    setIsDirectReferralModalOpen(false);
                    setDirectReferralForm({ name: '', phone: '' });
                    setReferralActionModal({ referral: newReferral, isNew: true });
                  }}
                  className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-slate-800 transition-all"
                >
                  SALVAR INDICAÇÃO
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Troca de Endereço */}
        {showAddressModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="bg-white rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[85vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-yellow-500" /> Trocar Endereço
                </h3>
                <button
                  onClick={() => setShowAddressModal(false)}
                  className="p-2 rounded-full hover:bg-slate-100 text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-500 mb-4">Selecione onde deseja receber sua entrega:</p>

              <div className="space-y-3 mb-6">
                {(user.addresses || []).length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-2xl text-center text-slate-400 text-xs font-bold">
                    Nenhum endereço cadastrado além do atual.
                  </div>
                ) : (
                  user.addresses.map((addr, idx) => {
                    const isSelected = selectedAddress?.street === addr.street && selectedAddress?.number === addr.number;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedAddress(addr);
                          setShowAddressModal(false);
                        }}
                        className={`w-full p-4 rounded-2xl text-left border-2 transition-all flex items-start justify-between gap-3 ${
                          isSelected
                            ? 'border-yellow-400 bg-yellow-50/50 shadow-sm'
                            : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                        }`}
                      >
                        <div className="flex gap-3">
                          <div className={`p-2 rounded-xl mt-0.5 ${isSelected ? 'bg-yellow-400 text-slate-900' : 'bg-slate-200 text-slate-500'}`}>
                            <MapPin className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-bold text-sm text-slate-900">{addr.street}, {addr.number}</p>
                            <p className="text-xs text-slate-500">{addr.neighborhood}, {addr.city}</p>
                            {addr.complement && <p className="text-[11px] text-slate-400">Compl: {addr.complement}</p>}
                          </div>
                        </div>
                        {isSelected && (
                          <span className="bg-yellow-400 text-slate-900 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                            Atual
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              <button
                onClick={() => {
                  setShowAddressModal(false);
                  setAddressReturnStep(step as any);
                  setStep('address');
                }}
                className="w-full py-3.5 px-4 rounded-2xl border-2 border-dashed border-slate-300 text-slate-700 font-bold text-sm hover:border-yellow-400 hover:bg-yellow-50/30 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4 text-yellow-600" />
                Cadastrar Novo Endereço
              </button>
            </motion.div>
          </div>
        )}

        {/* Modal de Cancelamento de Pedido */}
        {cancelModalOrder && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center"
            >
              {cancelModalOrder.status === 'Pendente' ? (
                <AnimatePresence mode="wait">
                  {cancelStage === 'confirm' && (
                    <motion.div
                      key="confirm"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                    >
                      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                        <X className="w-8 h-8" />
                      </div>
                      <h3 className="text-xl font-black text-slate-900">Cancelar Pedido?</h3>
                      <p className="text-xs text-slate-500 mt-2 mb-6 leading-relaxed">
                        Tem certeza que deseja cancelar o pedido <strong className="text-slate-800">#{cancelModalOrder.id}</strong>? O pedido ainda não foi aceito pelo gestor e o cancelamento é imediato.
                      </p>
                      <div className="space-y-2">
                        <button
                          onClick={handleExecuteCancellation}
                          className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-3.5 rounded-2xl text-sm transition-all shadow-lg shadow-red-600/20"
                        >
                          SIM, CANCELAR PEDIDO
                        </button>
                        <button
                          onClick={() => setCancelModalOrder(null)}
                          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-2xl text-xs transition-colors"
                        >
                          NÃO, MANTER PEDIDO
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {cancelStage === 'loading' && (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      className="py-6 flex flex-col items-center justify-center"
                    >
                      <div className="relative flex items-center justify-center">
                        <div className="w-20 h-20 rounded-full bg-red-400/20 animate-ping absolute" />
                        <div className="w-16 h-16 rounded-full bg-white shadow-xl flex items-center justify-center relative border-4 border-red-500">
                          <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
                        </div>
                      </div>
                      <h3 className="text-lg font-black text-slate-900 mt-6">Cancelando Pedido...</h3>
                      <p className="text-xs text-slate-500 mt-1.5 max-w-xs">
                        Aguarde um instante enquanto processamos o cancelamento.
                      </p>
                    </motion.div>
                  )}

                  {cancelStage === 'success' && (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="py-4 flex flex-col items-center justify-center"
                    >
                      <motion.div
                        initial={{ scale: 0, rotate: -45 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 20, delay: 0.1 }}
                        className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-xl shadow-emerald-500/30 relative mx-auto"
                      >
                        <motion.div
                          initial={{ scale: 0.8, opacity: 0.8 }}
                          animate={{ scale: 1.4, opacity: 0 }}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className="absolute inset-0 rounded-full bg-emerald-400 -z-10"
                        />
                        <Check className="w-10 h-10 stroke-[3.5]" />
                      </motion.div>

                      <h3 className="text-xl font-black text-slate-900 mt-5">Pedido Cancelado!</h3>
                      <p className="text-xs text-slate-500 mt-1 mb-6 max-w-xs">
                        Seu pedido <strong className="text-slate-800">#{cancelModalOrder.id}</strong> foi cancelado com sucesso.
                      </p>
                      <button
                        onClick={() => {
                          setCancelModalOrder(null);
                          setCancelStage('confirm');
                          setSelectedTrackingOrderId(null);
                          setActiveTab('home');
                        }}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-3.5 rounded-2xl text-xs transition-all shadow-lg shadow-slate-900/15"
                      >
                        OK, ENTENDI
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              ) : (
                <>
                  <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600">
                    <Truck className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900">Cancelamento de Pedido</h3>
                  <p className="text-xs text-slate-600 mt-3 mb-6 leading-relaxed">
                    {cancelModalOrder.status === 'Em Rota'
                      ? 'Seu pedido já está a caminho do seu endereço. Para cancelar, ligue ou envie uma mensagem no WhatsApp no número '
                      : 'Seu pedido já foi recebido pelo entregador e logo estará a caminho. Para cancelar, ligue ou envie uma mensagem no WhatsApp no número '}
                    <strong className="text-slate-900 font-black">(21) 3705-5965</strong>.
                  </p>
                  <div className="space-y-2.5">
                    <a
                      href="tel:+552137055965"
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 text-xs transition-all shadow-lg shadow-slate-900/10"
                    >
                      <Phone className="w-4 h-4 text-yellow-400" />
                      (21) 3705-5965 (LIGAR AGORA)
                    </a>
                    <a
                      href={`https://wa.me/552137055965?text=${encodeURIComponent(`Olá, gostaria de cancelar meu pedido #${cancelModalOrder.id}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 text-xs transition-all shadow-lg shadow-emerald-500/20"
                    >
                      💬 ENVIAR MENSAGEM NO WHATSAPP
                    </a>
                    <button
                      onClick={() => setCancelModalOrder(null)}
                      className="w-full text-slate-400 hover:text-slate-600 font-bold text-xs py-2 transition-colors"
                    >
                      Fechar
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      {/* Modal de Confirmação da Avaliação e Pontos */}
      <AnimatePresence>
        {ratingSuccessModal && (() => {
          const orderTotal = ratingSuccessModal.order.total || 0;
          const pointsEarned = Math.floor(orderTotal * 10);
          const availablePoints = user.points || 0;

          return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 text-center overflow-hidden border border-slate-100 relative"
              >
                {/* Botão Fechar no Topo */}
                <button
                  onClick={() => setRatingSuccessModal(null)}
                  className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Ícone de Sucesso */}
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
                  <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
                </div>

                <h3 className="text-xl font-black text-slate-900 mb-1">
                  Avaliação Registrada!
                </h3>
                
                {/* Agradecimento pela compra */}
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  Muito obrigado por comprar com a <strong className="text-slate-900">Porto Gás</strong>! Sua opinião é essencial para aprimorarmos continuamente nosso atendimento.
                </p>

                {/* Resumo das Estrelas */}
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 mb-4 flex items-center justify-around text-xs">
                  <div className="text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Porto Gás</span>
                    <div className="flex justify-center gap-0.5">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} className={`w-3.5 h-3.5 ${s <= ratingSuccessModal.serviceRating ? 'text-yellow-400 fill-current' : 'text-slate-200'}`} />
                      ))}
                    </div>
                  </div>
                  <div className="h-6 w-px bg-slate-200" />
                  <div className="text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Entregador</span>
                    <div className="flex justify-center gap-0.5">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} className={`w-3.5 h-3.5 ${s <= ratingSuccessModal.deliveryRating ? 'text-yellow-400 fill-current' : 'text-slate-200'}`} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Card de Pontuação: Ganhos na Compra & Total Disponível */}
                <div className="bg-gradient-to-br from-yellow-400 via-amber-400 to-amber-500 text-slate-950 p-4 rounded-2xl shadow-md mb-5 text-left relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/15 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                  
                  {/* Pontos da Compra */}
                  <div className="flex items-center justify-between mb-2.5 pb-2.5 border-b border-amber-500/40">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-950/80 block">
                        Pontos da sua compra
                      </span>
                      <span className="text-[11px] font-medium text-amber-950/90">
                        Pedido #{ratingSuccessModal.order.id}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black bg-white/90 text-slate-900 px-2.5 py-0.5 rounded-xl inline-block shadow-sm">
                        +{pointsEarned.toLocaleString('pt-BR')} pts
                      </span>
                    </div>
                  </div>

                  {/* Saldo Total Disponível */}
                  <div className="flex items-center justify-between pt-0.5">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-950/80 block">
                        Saldo Total Disponível
                      </span>
                      <span className="text-[10px] text-amber-950/80 font-medium">
                        Prontos para resgatar
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-black text-slate-950">
                        {availablePoints.toLocaleString('pt-BR')}{' '}
                        <span className="text-xs font-black">PTS</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Ações */}
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setRatingSuccessModal(null);
                      setActiveTab('referral');
                      setReferralTab('pontos');
                    }}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-3.5 px-4 rounded-2xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-slate-900/15"
                  >
                    <Gift className="w-4 h-4 text-yellow-400" />
                    VER E TROCAR MEUS PONTOS
                  </button>

                  <button
                    onClick={() => setRatingSuccessModal(null)}
                    className="w-full text-slate-400 hover:text-slate-600 font-bold text-xs py-2 transition-colors"
                  >
                    Concluir
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* Modal de Ações da Indicação (Check animado + 3 Botões) */}
      <AnimatePresence>
        {referralActionModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 text-center overflow-hidden border border-slate-100 relative"
            >
              <button
                onClick={() => setReferralActionModal(null)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Ícone de Sucesso com Animação */}
              <motion.div
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 20, delay: 0.1 }}
                className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-xl shadow-emerald-500/30 relative mx-auto mb-4"
              >
                <motion.div
                  initial={{ scale: 0.8, opacity: 0.8 }}
                  animate={{ scale: 1.4, opacity: 0 }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute inset-0 rounded-full bg-emerald-400 -z-10"
                />
                <Check className="w-8 h-8 stroke-[3.5]" />
              </motion.div>

              <h3 className="text-xl font-black text-slate-900 mb-1">
                {referralActionModal.isNew ? 'Indicação Registrada!' : 'Gerenciar Indicação'}
              </h3>
              
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 mb-4 text-left">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Amigo Indicado</span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    PENDENTE
                  </span>
                </div>
                <p className="font-black text-slate-900 text-sm">{referralActionModal.referral.refereeName}</p>
                <p className="text-xs text-slate-500">{referralActionModal.referral.refereePhone}</p>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed mb-5">
                Envie o convite para o seu amigo. Quando ele concluir o 1º pedido com seu cupom, <strong>vocês dois ganham {benefitsConfig?.referralPointsAwarded ?? 100} pontos</strong>!
              </p>

              {/* 3 Botões de Ação */}
              <div className="space-y-2.5">
                {/* Botão 1: Enviar convite por WhatsApp */}
                <button
                  onClick={() => {
                    const cleanPhone = referralActionModal.referral.refereePhone.replace(/\D/g, '');
                    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
                    const discountVal = (benefitsConfig?.referralDiscountValue ?? 10).toFixed(2);
                    const inviteMsg = `Olá ${referralActionModal.referral.refereeName}! Te convido a pedir gás na Porto Gás com desconto no seu 1º pedido. Acesse o link para ativar seu desconto de R$ ${discountVal} automaticamente: ${window.location.origin}?ref=${userReferralCode} (ou use o cupom *${userReferralCode}* no carrinho).`;
                    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(inviteMsg)}`, '_blank');
                  }}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 text-xs transition-all shadow-lg shadow-emerald-500/20"
                >
                  💬 ENVIAR CONVITE POR WHATSAPP
                </button>

                {/* Botão 2: Copiar Link de Indicação */}
                <button
                  onClick={() => {
                    const link = `${window.location.origin}?ref=${userReferralCode}`;
                    navigator.clipboard.writeText(link);
                    showToast('Link de indicação copiado com sucesso!');
                  }}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 text-xs transition-all shadow-lg shadow-slate-900/10"
                >
                  <Copy className="w-4 h-4 text-yellow-400" />
                  COPIAR LINK DE INDICAÇÃO
                </button>

                {/* Botão 3: Excluir */}
                <button
                  onClick={() => {
                    const refToDelete = referralActionModal.referral;
                    setReferralActionModal(null);
                    setDeleteConfirmReferral({ referral: refToDelete, stage: 'confirm' });
                  }}
                  className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-black py-3 px-4 rounded-2xl flex items-center justify-center gap-2 text-xs transition-colors border border-red-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  EXCLUIR INDICAÇÃO
                </button>
              </div>

              <button
                onClick={() => setReferralActionModal(null)}
                className="w-full text-slate-400 hover:text-slate-600 font-bold text-xs py-2 mt-2 transition-colors"
              >
                Fechar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Comemorativo de Indicação Concluída */}
      <AnimatePresence>
        {celebrationModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 text-center overflow-hidden border border-slate-100 relative"
            >
              <button
                onClick={() => setCelebrationModal(null)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-16 h-16 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-yellow-400/20">
                <Gift className="w-8 h-8 stroke-[2.5]" />
              </div>

              <h3 className="text-xl font-black text-slate-900 mb-2">
                Parabéns! 🎉
              </h3>
              
              <p className="text-sm text-slate-700 leading-relaxed mb-4">
                Você indicou <strong className="text-slate-950 font-black">{celebrationModal.refereeName}</strong> e vocês ganharam <strong className="text-yellow-600 font-black">+{celebrationModal.pointsAwarded || benefitsConfig?.referralPointsAwarded || 100} pontos</strong>!
              </p>

              <div className="bg-gradient-to-br from-amber-50 to-yellow-50 p-4 rounded-2xl border border-yellow-200 text-left mb-5">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-500 font-bold">Status:</span>
                  <span className="font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full text-[10px]">
                    COMPRA CONCLUÍDA
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-bold">Pontos Recebidos:</span>
                  <span className="font-black text-slate-900">+{celebrationModal.pointsAwarded || benefitsConfig?.referralPointsAwarded || 100} PTS</span>
                </div>
                {celebrationModal.validatedAt && (
                  <div className="flex items-center justify-between text-xs mt-1 pt-1 border-t border-yellow-200/50">
                    <span className="text-slate-400 text-[10px]">Data da Conclusão:</span>
                    <span className="text-slate-600 text-[10px]">
                      {new Date(celebrationModal.validatedAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  setCelebrationModal(null);
                  setReferralTab('pontos');
                }}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-3.5 rounded-2xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-slate-900/10 mb-2"
              >
                <Star className="w-4 h-4 text-yellow-400" />
                VER MEUS PONTOS
              </button>

              <button
                onClick={() => setCelebrationModal(null)}
                className="w-full text-slate-400 hover:text-slate-600 font-bold text-xs py-2 transition-colors"
              >
                Fechar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Extrato e Histórico de Pontos */}
      <AnimatePresence>
        {showPointsHistoryModal && (() => {
          const completedOrdersTransactions: PointHistoryItem[] = completedOrders.map(o => ({
            id: `order-${o.id}`,
            userId: user.id,
            type: 'earned_order',
            points: Math.floor(o.total * (benefitsConfig?.pointsPerCurrency ?? 10)),
            description: `Compra concluída (Pedido #${o.id})`,
            orderId: o.id,
            createdAt: o.createdAt
          }));

          const referralTransactions: PointHistoryItem[] = referrals
            .filter(r => r.referrerId === user.id && (r.status === 'Validado' || r.status === 'Confirmado'))
            .map(r => ({
              id: `ref-${r.id}`,
              userId: user.id,
              type: 'referral_bonus',
              points: r.pointsAwarded || benefitsConfig?.referralPointsAwarded || 100,
              description: `Bônus por indicar ${r.refereeName}`,
              orderId: r.orderId,
              createdAt: r.validatedAt || r.createdAt
            }));

          const allItemsMap = new Map<string, PointHistoryItem>();
          
          cachedHistory.forEach(item => {
            allItemsMap.set(item.id, item);
          });
          completedOrdersTransactions.forEach(item => {
            if (!allItemsMap.has(item.id)) allItemsMap.set(item.id, item);
          });
          referralTransactions.forEach(item => {
            if (!allItemsMap.has(item.id)) allItemsMap.set(item.id, item);
          });

          const sortedItems = Array.from(allItemsMap.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );

          const totalEarned = sortedItems.filter(i => i.points > 0).reduce((acc, i) => acc + i.points, 0);
          const totalSpent = sortedItems.filter(i => i.points < 0).reduce((acc, i) => acc + Math.abs(i.points), 0);
          const currentBalance = reconciledBalance;
          const displayAcumulado = Math.max(totalEarned, currentBalance + totalSpent);

          return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4 overscroll-contain">
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 border border-slate-100 max-h-[85vh] h-full flex flex-col relative min-h-0"
              >
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                  <div>
                    <h3 className="text-xl font-black text-slate-900">Extrato de Pontos</h3>
                    <p className="text-xs text-slate-500">Histórico detalhado de entradas e resgates</p>
                  </div>
                  <button
                    onClick={() => setShowPointsHistoryModal(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Resumo Rápido com 3 colunas */}
                <div className="grid grid-cols-3 gap-2 mb-4 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center flex-shrink-0">
                  <div className="text-center">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-tight">Saldo Atual</span>
                    <span className="text-sm font-black text-slate-900">{currentBalance.toLocaleString('pt-BR')} pts</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-tight">Acumulado</span>
                    <span className="text-sm font-black text-emerald-600">+{displayAcumulado.toLocaleString('pt-BR')} pts</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-tight">Resgatado</span>
                    <span className="text-sm font-black text-red-500">-{totalSpent.toLocaleString('pt-BR')} pts</span>
                  </div>
                </div>

                {/* Lista de Movimentações */}
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y space-y-2.5 pr-1">
                  {sortedItems.length === 0 ? (
                    <div className="p-8 text-center">
                      <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm font-bold text-slate-400">Nenhuma movimentação de pontos ainda.</p>
                      <p className="text-[11px] text-slate-400 mt-1">Conclua compras ou indique amigos para acumular!</p>
                    </div>
                  ) : (
                    sortedItems.map(item => {
                      const isPositive = item.points > 0;
                      return (
                        <div key={item.id} className="p-3 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              isPositive ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                            }`}>
                              {item.type === 'referral_bonus' ? (
                                <Gift className="w-4 h-4" />
                              ) : isPositive ? (
                                <Plus className="w-4 h-4 stroke-[3]" />
                              ) : (
                                <Minus className="w-4 h-4 stroke-[3]" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-black text-slate-900 truncate">{item.description}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {new Date(item.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className={`text-xs font-black px-2 py-0.5 rounded-lg inline-block ${
                              isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                            }`}>
                              {isPositive ? `+${item.points}` : item.points} pts
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <button
                  onClick={() => setShowPointsHistoryModal(false)}
                  className="w-full bg-slate-900 text-white font-black py-3.5 rounded-2xl text-xs mt-4 hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 flex-shrink-0"
                >
                  FECHAR EXTRATO
                </button>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* Modal de Detalhes da Recompensa */}
      <AnimatePresence>
        {selectedRewardDetails && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4 overscroll-contain">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 border border-slate-100 max-h-[90vh] flex flex-col relative min-h-0"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedRewardDetails(null)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4 flex-shrink-0">
                <div className="bg-yellow-50 p-3.5 rounded-2xl border border-yellow-200/60 text-yellow-600">
                  {selectedRewardDetails.type === 'discount' ? (
                    <Ticket className="w-7 h-7" />
                  ) : (
                    <Package className="w-7 h-7" />
                  )}
                </div>
                <div className="min-w-0 pr-6">
                  <span className="bg-yellow-100 text-yellow-800 text-[10px] font-black px-2.5 py-0.5 rounded-full inline-block mb-1">
                    {selectedRewardDetails.pointsCost} PONTOS
                  </span>
                  <h3 className="text-lg font-black text-slate-900 leading-tight">
                    {selectedRewardDetails.title}
                  </h3>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y space-y-4 pr-1">
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                  {selectedRewardDetails.description}
                </p>

                {/* Especificações Rápidas */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Prazo de Validade</span>
                    <span className="text-xs font-black text-slate-800">
                      {selectedRewardDetails.validityDays ? `${selectedRewardDetails.validityDays} dias após resgate` : 'Sem prazo limite'}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Pedido Mínimo</span>
                    <span className="text-xs font-black text-slate-800">
                      {selectedRewardDetails.minOrderValue && selectedRewardDetails.minOrderValue > 0
                        ? `R$ ${selectedRewardDetails.minOrderValue.toFixed(2)}`
                        : 'Sem valor mínimo'}
                    </span>
                  </div>
                </div>

                {/* Regras e Condições de Uso */}
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />
                    Regras e Condições de Uso
                  </h4>
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-2">
                    {(selectedRewardDetails.rules && selectedRewardDetails.rules.length > 0 ? selectedRewardDetails.rules : [
                      'Válido para uso exclusivo no aplicativo Porto Gás.',
                      'Não cumulativo com outros cupons promocionais.',
                      'O resgate debita os pontos imediatamente da sua conta.',
                      'Válido enquanto durarem os estoques do item.'
                    ]).map((rule, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-1.5 flex-shrink-0" />
                        <span className="leading-snug">{rule}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status dos Pontos do Usuário */}
                <div className="bg-amber-50/70 border border-amber-200/60 p-3.5 rounded-2xl flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-amber-800/80 font-bold block uppercase">Seu Saldo Atual</span>
                    <span className="font-black text-amber-950 text-sm">{reconciledBalance.toLocaleString('pt-BR')} pontos</span>
                  </div>
                  {reconciledBalance < selectedRewardDetails.pointsCost ? (
                    <span className="text-[11px] font-bold text-red-600 bg-red-100/80 px-2.5 py-1 rounded-full">
                      Faltam {selectedRewardDetails.pointsCost - reconciledBalance} pts
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <Check className="w-3 h-3 stroke-[3]" /> Saldo suficiente
                    </span>
                  )}
                </div>
              </div>

              {/* Ações */}
              <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 flex-shrink-0">
                <button
                  disabled={reconciledBalance < selectedRewardDetails.pointsCost}
                  onClick={() => {
                    const rewardToRedeem = selectedRewardDetails;
                    setSelectedRewardDetails(null);
                    setRewardConfirmation({ reward: rewardToRedeem, stage: 'confirm' });
                  }}
                  className={`w-full py-3.5 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 ${
                    reconciledBalance >= selectedRewardDetails.pointsCost
                      ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/15 active:scale-[0.99]'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {reconciledBalance >= selectedRewardDetails.pointsCost ? (
                    <>
                      <Gift className="w-4 h-4 text-yellow-400" />
                      RESGATAR POR {selectedRewardDetails.pointsCost} PONTOS
                    </>
                  ) : (
                    `PONTOS INSUFICIENTES (FALTAM ${selectedRewardDetails.pointsCost - reconciledBalance})`
                  )}
                </button>
                <button
                  onClick={() => setSelectedRewardDetails(null)}
                  className="w-full text-slate-400 hover:text-slate-600 font-bold text-xs py-2 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Confirmação e Sucesso do Resgate */}
      <AnimatePresence>
        {rewardConfirmation && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4 overscroll-contain">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 text-center overflow-hidden border border-slate-100 relative"
            >
              {rewardConfirmation.stage === 'confirm' ? (
                <>
                  <button
                    onClick={() => setRewardConfirmation(null)}
                    className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <div className="w-16 h-16 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-yellow-400/20">
                    <Gift className="w-8 h-8 stroke-[2.5]" />
                  </div>

                  <h3 className="text-xl font-black text-slate-900 mb-2">
                    Confirmar Resgate?
                  </h3>

                  <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                    Deseja realmente resgatar <strong className="text-slate-950 font-black">{rewardConfirmation.reward.title}</strong> por <strong className="text-yellow-600 font-black">{rewardConfirmation.reward.pointsCost} pontos</strong>?
                  </p>

                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 mb-5 text-left text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-bold">Saldo atual:</span>
                      <span className="font-black text-slate-900">{reconciledBalance.toLocaleString('pt-BR')} pts</span>
                    </div>
                    <div className="flex justify-between text-red-500">
                      <span className="font-bold">Custo do resgate:</span>
                      <span className="font-black">-{rewardConfirmation.reward.pointsCost} pts</span>
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-slate-200">
                      <span className="text-slate-700 font-bold">Saldo após resgate:</span>
                      <span className="font-black text-emerald-600">{(reconciledBalance - rewardConfirmation.reward.pointsCost).toLocaleString('pt-BR')} pts</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button
                      onClick={() => handleExecuteRewardRedemption(rewardConfirmation.reward)}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-3.5 rounded-2xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-slate-900/15"
                    >
                      <Check className="w-4 h-4 text-yellow-400 stroke-[3]" />
                      SIM, CONFIRMAR RESGATE
                    </button>
                    <button
                      onClick={() => setRewardConfirmation(null)}
                      className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-black py-3 rounded-2xl text-xs transition-colors"
                    >
                      CANCELAR
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Stage === 'success' with animated check */}
                  <motion.div
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 20 }}
                    className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-xl shadow-emerald-500/30 relative mx-auto mb-4"
                  >
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0.8 }}
                      animate={{ scale: 1.4, opacity: 0 }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="absolute inset-0 rounded-full bg-emerald-400 -z-10"
                    />
                    <Check className="w-8 h-8 stroke-[3.5]" />
                  </motion.div>

                  <h3 className="text-xl font-black text-slate-900 mb-2">
                    Resgate Concluído! 🎉
                  </h3>

                  <p className="text-sm text-slate-600 mb-3 leading-relaxed">
                    Você resgatou com sucesso <strong className="text-slate-950 font-black">{rewardConfirmation.reward.title}</strong>!
                  </p>

                  {rewardConfirmation.code && (
                    <div className="bg-slate-50 p-3.5 rounded-2xl border-2 border-dashed border-emerald-300 mb-3 text-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Seu Código Único de Resgate</span>
                      <div className="flex items-center justify-center gap-2">
                        <span className="font-mono text-xl font-black text-emerald-950 tracking-wider">
                          {rewardConfirmation.code}
                        </span>
                        <button
                          onClick={() => {
                            if (rewardConfirmation.code) {
                              navigator.clipboard.writeText(rewardConfirmation.code);
                              showToast(`Código ${rewardConfirmation.code} copiado com sucesso!`);
                            }
                          }}
                          className="p-1.5 hover:bg-emerald-100 rounded-lg text-emerald-700 transition-colors"
                          title="Copiar Código"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-[10px] text-emerald-700 font-bold mt-1">
                        ⏱️ Expira em {rewardConfirmation.reward.validityDays || 30} dias • Vinculado à sua conta
                      </p>
                    </div>
                  )}

                  <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-2xl mb-3 text-xs text-emerald-800">
                    <p className="font-bold">Novo saldo disponível:</p>
                    <p className="text-lg font-black text-emerald-950">{user.points || 0} pontos</p>
                  </div>

                  {rewardConfirmation.reward.productId && (
                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl mb-4 text-xs text-amber-900 flex items-center gap-2.5 text-left">
                      <Package className="w-5 h-5 text-amber-600 shrink-0" />
                      <span>1 unidade de <strong>{PRODUCTS.find(p => p.id === rewardConfirmation.reward.productId)?.name || 'Produto'}</strong> pronta para inclusão grátis!</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        if (rewardConfirmation.code) {
                          const discountVal = rewardConfirmation.reward.type === 'discount' 
                            ? (rewardConfirmation.reward.value || 15) 
                            : (rewardConfirmation.reward.productId ? (PRODUCTS.find(p => p.id === rewardConfirmation.reward.productId)?.price || rewardConfirmation.reward.value || 0) : (rewardConfirmation.reward.value || 0));

                          const rewardExpiry = new Date(Date.now() + (rewardConfirmation.reward.validityDays || 30) * 24 * 60 * 60 * 1000).toISOString();
                          const couponObj: Coupon = {
                            id: `REDEEM-${rewardConfirmation.code}`,
                            code: rewardConfirmation.code,
                            type: 'fixed',
                            value: discountVal,
                            isActive: true,
                            usageCount: 0,
                            validUntil: rewardExpiry,
                            minOrderValue: rewardConfirmation.reward.minOrderValue || 0
                          };

                          if (rewardConfirmation.reward.productId) {
                            setCart(prev => ({
                              ...prev,
                              [rewardConfirmation.reward.productId!]: Math.max(1, (prev[rewardConfirmation.reward.productId!] || 0) + 1)
                            }));
                          }

                          setAppliedCoupon(couponObj);
                        }
                        setRewardConfirmation(null);
                        setActiveTab('home');
                        setStep('checkout');
                      }}
                      className="w-full bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black py-3.5 rounded-2xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                    >
                      <ShoppingCart className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                      USAR NO MEU PEDIDO AGORA
                    </button>
                    <button
                      onClick={() => setRewardConfirmation(null)}
                      className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-black py-3 rounded-2xl text-xs transition-colors cursor-pointer"
                    >
                      CONTINUAR NAVEGANDO
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Visualização do Código Resgatado ("Expira em xx dias") */}
      <AnimatePresence>
        {selectedViewRedemption && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4 overscroll-contain">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 text-center overflow-hidden border border-slate-100 relative"
            >
              <button
                onClick={() => setSelectedViewRedemption(null)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3 shadow-md shadow-emerald-500/10">
                <Gift className="w-7 h-7 stroke-[2.5]" />
              </div>

              <span className="text-[10px] uppercase font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-0.5 rounded-full inline-block mb-1.5">
                ✓ Recompensa Resgatada
              </span>

              <h3 className="text-lg font-black text-slate-900 mb-1 leading-tight">
                {selectedViewRedemption.rewardTitle}
              </h3>

              {/* Caixa do Código com botão de cópia */}
              <div className="bg-slate-50 p-4 rounded-2xl border-2 border-dashed border-emerald-300 my-4 text-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Código Único de Resgate</span>
                <div className="flex items-center justify-center gap-3">
                  <span className="font-mono text-2xl font-black text-slate-950 tracking-wider">
                    {selectedViewRedemption.code}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedViewRedemption.code);
                      setCopiedRedemptionCode(true);
                      showToast(`Código ${selectedViewRedemption.code} copiado!`);
                      setTimeout(() => setCopiedRedemptionCode(false), 2000);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
                    title="Copiar Código"
                  >
                    {copiedRedemptionCode ? <Check className="w-4 h-4 stroke-[3]" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                {copiedRedemptionCode && (
                  <span className="text-[10px] font-bold text-emerald-600 mt-1 block">✓ Copiado para a área de transferência!</span>
                )}
              </div>

              {/* Informações de Validade e Vinculação */}
              <div className="space-y-2 mb-5 text-left text-xs">
                {/* Expira em xx dia(s) */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-amber-900">
                  <span className="font-bold flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    Validade:
                  </span>
                  <span className="font-black text-amber-950">
                    {codeService.formatDaysRemaining(selectedViewRedemption.validUntil).text}
                  </span>
                </div>

                {/* Vinculado à conta */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 text-slate-600">
                  <span className="font-bold flex items-center gap-1.5">
                    <User className="w-4 h-4 text-slate-400 shrink-0" />
                    Vinculado a:
                  </span>
                  <span className="font-black text-slate-800 truncate max-w-[170px]">
                    {selectedViewRedemption.userName || user.name}
                  </span>
                </div>

                {/* Status */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50/60 border border-emerald-100 text-emerald-800">
                  <span className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    Status:
                  </span>
                  <span className="font-black text-emerald-700">
                    Disponível até ser usado
                  </span>
                </div>
              </div>

              {/* Ações */}
              <div className="space-y-2">
                <button
                  onClick={() => {
                    const couponObj: Coupon = {
                      id: `REDEEM-${selectedViewRedemption.id}`,
                      code: selectedViewRedemption.code,
                      type: 'fixed',
                      value: selectedViewRedemption.discountValue || 0,
                      isActive: true,
                      usageCount: 0,
                      validUntil: selectedViewRedemption.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                      minOrderValue: selectedViewRedemption.minOrderValue || 0
                    };

                    if ((selectedViewRedemption.rewardType === 'free_item' || selectedViewRedemption.rewardType === 'free_product') && selectedViewRedemption.productId) {
                      setCart(prev => ({
                        ...prev,
                        [selectedViewRedemption.productId!]: Math.max(1, (prev[selectedViewRedemption.productId!] || 0) + 1)
                      }));
                    }

                    setAppliedCoupon(couponObj);
                    setSelectedViewRedemption(null);
                    setActiveTab('home');
                    setStep('checkout');
                    showToast(`🎁 Código ${selectedViewRedemption.code} ativado no seu pedido!`);
                  }}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-3.5 rounded-2xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-slate-900/15 cursor-pointer active:scale-95"
                >
                  <ShoppingCart className="w-4 h-4 text-yellow-400 stroke-[2.5]" />
                  USAR NO MEU PEDIDO AGORA
                </button>
                <button
                  onClick={() => setSelectedViewRedemption(null)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-black py-2.5 rounded-2xl text-xs transition-colors cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Exclusão de Indicação (Substitui confirm do navegador) */}
      <AnimatePresence>
        {deleteConfirmReferral && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4 overscroll-contain">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 text-center overflow-hidden border border-slate-100 relative"
            >
              {deleteConfirmReferral.stage === 'confirm' ? (
                <>
                  <button
                    onClick={() => setDeleteConfirmReferral(null)}
                    className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-500/10">
                    <Trash2 className="w-8 h-8 stroke-[2.5]" />
                  </div>

                  <h3 className="text-xl font-black text-slate-900 mb-2">
                    Excluir Indicação?
                  </h3>

                  <p className="text-sm text-slate-600 mb-2 leading-relaxed">
                    Deseja realmente excluir a indicação de <strong className="text-slate-950 font-black">{deleteConfirmReferral.referral.refereeName}</strong>?
                  </p>

                  <p className="text-xs text-amber-600 bg-amber-50 p-2.5 rounded-xl border border-amber-200/60 mb-5">
                    Esta ação removerá o registro e não poderá ser desfeita.
                  </p>

                  <div className="space-y-2">
                    <button
                      onClick={() => handleConfirmDeleteReferral(deleteConfirmReferral.referral)}
                      className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-3.5 rounded-2xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-600/15"
                    >
                      <Trash2 className="w-4 h-4" />
                      SIM, EXCLUIR INDICAÇÃO
                    </button>
                    <button
                      onClick={() => setDeleteConfirmReferral(null)}
                      className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-black py-3 rounded-2xl text-xs transition-colors"
                    >
                      CANCELAR
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Stage === 'success' with animated check */}
                  <motion.div
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 20 }}
                    className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-xl shadow-emerald-500/30 relative mx-auto mb-4"
                  >
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0.8 }}
                      animate={{ scale: 1.4, opacity: 0 }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="absolute inset-0 rounded-full bg-emerald-400 -z-10"
                    />
                    <Check className="w-8 h-8 stroke-[3.5]" />
                  </motion.div>

                  <h3 className="text-xl font-black text-slate-900 mb-2">
                    Indicação Excluída!
                  </h3>

                  <p className="text-sm text-slate-600 mb-5 leading-relaxed">
                    A indicação de <strong className="text-slate-950 font-black">{deleteConfirmReferral.referral.refereeName}</strong> foi removida com sucesso.
                  </p>

                  <button
                    onClick={() => setDeleteConfirmReferral(null)}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-3.5 rounded-2xl text-xs transition-all shadow-lg shadow-slate-900/15"
                  >
                    CONCLUIR
                  </button>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification Top-Right */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed top-5 right-5 z-[100000] bg-slate-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 border border-slate-700/60 max-w-sm pointer-events-none"
          >
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
            <span className="text-xs font-bold text-slate-100">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-3 z-50 shadow-sm">
        <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 ${activeTab === 'home' ? 'text-yellow-500' : 'text-slate-400'}`}>
          <Home className="w-6 h-6" />
          <span className="text-[10px] font-bold">Início</span>
        </button>
        <button onClick={() => setActiveTab('tracking')} className={`flex flex-col items-center gap-1 ${activeTab === 'tracking' ? 'text-yellow-500' : 'text-slate-400'}`}>
          <Navigation className="w-6 h-6" />
          <span className="text-[10px] font-bold">Rastrear</span>
          {orders.some(o => isUserOrder(o) && o.status === 'Em Rota') && (
            <span className="absolute top-2 right-1/2 translate-x-6 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          )}
        </button>
        <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center gap-1 ${activeTab === 'history' ? 'text-yellow-500' : 'text-slate-400'}`}>
          <History className="w-6 h-6" />
          <span className="text-[10px] font-bold">Pedidos</span>
        </button>
        <button onClick={() => setActiveTab('referral')} className={`flex flex-col items-center gap-1 ${activeTab === 'referral' ? 'text-yellow-500' : 'text-slate-400'}`}>
          <Gift className="w-6 h-6" />
          <span className="text-[10px] font-bold">Benefícios</span>
        </button>
        <button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center gap-1 ${activeTab === 'profile' ? 'text-yellow-500' : 'text-slate-400'}`}>
          <User className="w-6 h-6" />
          <span className="text-[10px] font-bold">Perfil</span>
        </button>
      </div>
    </div>
  );
};

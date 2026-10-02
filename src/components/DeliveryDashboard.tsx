import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Phone, 
  Map as MapIcon, 
  Calendar,
  Wallet,
  Receipt,
  Share2,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Clock,
  Compass,
  Building2,
  Banknote,
  ChevronDown,
  ChevronUp,
  FileText,
  Printer,
  Navigation,
  Edit2,
  Zap,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { AppUser, Order, Expense, Product, Address, BusinessInfo } from '../types';
import { PRODUCTS, calculateEffectivePrice } from '../constants';
import { playAssignedOrderSound, unlockAudio } from '../utils/sounds';
import { showSafeNotification } from '../utils/notifications';
import { QuickPriceEditModal } from './manager/QuickPriceEditModal';
import { jsPDF } from 'jspdf';

interface DeliveryDashboardProps {
  user: AppUser;
  orders: Order[];
  onUpdateOrder: (order: Order) => void;
  onAddOrder: (order: Order) => void;
  onAddExpense: (expense: Expense) => void;
  onUpdateUser: (user: AppUser) => void;
  expenses: Expense[];
  allCustomers: AppUser[];
  allCollaborators?: AppUser[];
  businessInfo?: BusinessInfo;
  products?: Product[];
  onUpdateProductPrice?: (
    productId: string, 
    newPrice: number, 
    pixDiscountValue?: number, 
    cashDiscountValue?: number,
    pixType?: 'fixed' | 'percentage',
    cashType?: 'fixed' | 'percentage'
  ) => Promise<void> | void;
}

export const DeliveryDashboard: React.FC<DeliveryDashboardProps> = ({ 
  user, 
  orders, 
  onUpdateOrder, 
  onAddOrder, 
  onAddExpense, 
  onUpdateUser, 
  expenses, 
  allCustomers, 
  allCollaborators = [],
  businessInfo,
  products = [],
  onUpdateProductPrice
}) => {
  const productsList = (products && products.length > 0) ? products : PRODUCTS;
  const [activeTab, setActiveTab] = useState<'deliveries' | 'map' | 'products' | 'finance'>('deliveries');
  
  // Modal de Edição Rápida de Preço (pelo Entregador)
  const [isQuickPriceModalOpen, setIsQuickPriceModalOpen] = useState(false);
  const [selectedProductForPriceEdit, setSelectedProductForPriceEdit] = useState<Product | null>(null);

  // Modais de Ação
  const [isFabMenuOpen, setIsFabMenuOpen] = useState(false);
  const [isAddingSale, setIsAddingSale] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [isAddingSettlement, setIsAddingSettlement] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false); // Modal de escolha de compartilhamento
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);     // Visualização e impressão do PDF
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Acordeom de Formas de Pagamento (Financeiro Clean)
  const [expandedPaymentMethod, setExpandedPaymentMethod] = useState<string | null>(null);

  // Estado para Nova Venda
  const [saleCustomerType, setSaleCustomerType] = useState<'walkin' | 'existing'>('walkin');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<AppUser | null>(null);
  const [walkinName, setWalkinName] = useState('');
  const [walkinPhone, setWalkinPhone] = useState('');
  const [walkinStreet, setWalkinStreet] = useState('');
  const [walkinNeighborhood, setWalkinNeighborhood] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'Dinheiro' | 'Pix' | 'Cartão de Débito' | 'Cartão de Crédito'>('Dinheiro');
  const [cart, setCart] = useState<{ [id: string]: number }>({ p13: 1 });
  const [saleGpsCoords, setSaleGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isCapturingGps, setIsCapturingGps] = useState(false);

  // Estado para Lançar Despesa
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState<'Combustível' | 'Alimentação' | 'Manutenção Moto' | 'Outros'>('Combustível');

  // Estado para Prestação de Contas (Baixa de Caixa)
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlementRecipient, setSettlementRecipient] = useState('');
  const [settlementNote, setSettlementNote] = useState('');

  // GPS Tracking
  const [gpsStatus, setGpsStatus] = useState<string>('Aguardando GPS...');
  const lastLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastUpdateRef = useRef<number>(0);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const updateLocation = (lat: number, lng: number) => {
    const now = Date.now();
    if (lastLocationRef.current && (now - lastUpdateRef.current < 4000)) {
      const distLat = Math.abs(lastLocationRef.current.lat - lat);
      const distLng = Math.abs(lastLocationRef.current.lng - lng);
      if (distLat < 0.00008 && distLng < 0.00008) return;
    }
    lastLocationRef.current = { lat, lng };
    lastUpdateRef.current = now;

    onUpdateUser({ ...user, location: { lat, lng } });
    orders
      .filter(o => o.deliveryPersonId === user.id && o.status === 'Em Rota')
      .forEach(o => {
        onUpdateOrder({ ...o, deliveryPersonLocation: { lat, lng } });
      });
  };

  // Captura de GPS de Alta Precisão (Usada para Venda do Consumidor Rua)
  const captureFreshGps = async (): Promise<{ lat: number; lng: number } | null> => {
    setIsCapturingGps(true);
    if (!('geolocation' in navigator)) {
      setIsCapturingGps(false);
      return user.location || null;
    }
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setSaleGpsCoords(coords);
          updateLocation(coords.lat, coords.lng);
          setIsCapturingGps(false);
          resolve(coords);
        },
        (err) => {
          console.warn('Erro ao obter GPS fresco para venda:', err.message);
          setIsCapturingGps(false);
          resolve(user.location || null);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
      );
    });
  };

  // Dispara captura de GPS ao abrir modal de Nova Venda
  useEffect(() => {
    if (isAddingSale) {
      captureFreshGps();
    }
  }, [isAddingSale]);

  // GPS Watcher
  useEffect(() => {
    let watchId: number;
    if ('geolocation' in navigator) {
      setGpsStatus('Conectando ao GPS...');
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setGpsStatus(`GPS Ativo: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          updateLocation(lat, lng);
        },
        (error) => {
          console.warn('Erro ao acessar GPS:', error.message);
          setGpsStatus(`GPS: ${error.message}`);
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    } else {
      setGpsStatus('GPS não suportado neste aparelho');
    }
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Notificação sonora quando novo pedido é atribuído
  const isInitialLoadRef = useRef(true);
  const prevAssignedIdsRef = useRef<Set<string>>(
    new Set(orders.filter(o => o.deliveryPersonId === user.id && (o.status === 'Atribuído' || o.status === 'Em Rota')).map(o => o.id))
  );
  const audioUnlockedRef = useRef(false);

  useEffect(() => {
    const unlock = () => {
      if (!audioUnlockedRef.current) {
        unlockAudio();
        audioUnlockedRef.current = true;
      }
    };
    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, []);

  useEffect(() => {
    const myAssigned = orders.filter(
      o => o.deliveryPersonId === user.id && (o.status === 'Atribuído' || o.status === 'Em Rota')
    );

    if (isInitialLoadRef.current) {
      if (orders.length > 0) {
        isInitialLoadRef.current = false;
        prevAssignedIdsRef.current = new Set(myAssigned.map(o => o.id));
      }
      return;
    }

    const newAssigned = myAssigned.filter(o => !prevAssignedIdsRef.current.has(o.id));
    if (newAssigned.length > 0) {
      playAssignedOrderSound().catch(() => {});
      newAssigned.forEach(o => {
        const street = o.address?.street || 'Endereço';
        const neighborhood = o.address?.neighborhood || '';
        showSafeNotification('🚚 Novo Pedido Atribuído!', {
          body: `${o.customerName || 'Cliente'} — ${street}${neighborhood ? `, ${neighborhood}` : ''}`,
          icon: '/favicon.ico',
          tag: o.id
        });
      });
    }

    prevAssignedIdsRef.current = new Set(myAssigned.map(o => o.id));
  }, [orders, user.id]);

  const handleForceGps = () => {
    if ('geolocation' in navigator) {
      setGpsStatus('Buscando sinal GPS...');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setGpsStatus(`GPS Ativo: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          updateLocation(lat, lng);
          showToast('Sinal GPS atualizado com sucesso!');
        },
        (err) => {
          setGpsStatus(`Erro GPS: ${err.message}`);
          showToast('Erro ao obter GPS: ' + err.message);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  };

  const handleSimulateStep = () => {
    const activeRouteOrder = orders.find(o => o.deliveryPersonId === user.id && o.status === 'Em Rota');
    const targetLat = activeRouteOrder?.address.lat || -22.9037;
    const targetLng = activeRouteOrder?.address.lng || -43.1017;

    const currentLat = user.location?.lat ?? (targetLat - 0.008);
    const currentLng = user.location?.lng ?? (targetLng - 0.008);

    const nextLat = currentLat + (targetLat - currentLat) * 0.25;
    const nextLng = currentLng + (targetLng - currentLng) * 0.25;

    setGpsStatus(`Simulado: ${nextLat.toFixed(4)}, ${nextLng.toFixed(4)}`);
    updateLocation(nextLat, nextLng);
    showToast('Posição simulada avançada.');
  };

  // Pedidos do Entregador
  const myDeliveries = useMemo(() => {
    return orders
      .filter(o => o.deliveryPersonId === user.id && (o.status === 'Em Rota' || o.status === 'Atribuído'))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [orders, user.id]);

  const nextActiveDelivery = myDeliveries[0] || null;

  // Concluídos Hoje
  const isToday = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const today = new Date();
    return d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();
  };

  const myCompletedToday = useMemo(() => {
    return orders.filter(o => {
      if (o.deliveryPersonId !== user.id || o.status !== 'Concluído') return false;
      return isToday(o.completedAt || o.createdAt);
    });
  }, [orders, user.id]);

  // Despesas e Baixas do Entregador
  const myExpensesToday = useMemo(() => {
    return expenses.filter(e => e.userId === user.id && isToday(e.date));
  }, [expenses, user.id]);

  // Separação de Despesas Operacionais vs Baixas / Prestações de Contas
  const cashSettlements = useMemo(() => {
    return myExpensesToday.filter(e => 
      e.category === 'Prestação de Contas' || 
      e.category === 'Baixa de Caixa' ||
      e.description.toLowerCase().includes('baixa') ||
      e.description.toLowerCase().includes('prestação') ||
      e.description.toLowerCase().includes('prestacao')
    );
  }, [myExpensesToday]);

  const operationalExpenses = useMemo(() => {
    return myExpensesToday.filter(e => !cashSettlements.includes(e));
  }, [myExpensesToday, cashSettlements]);

  // Segmentação Detalhada por Tipo de Pagamento (Com listagem dos pedidos)
  const paymentBreakdown = useMemo(() => {
    const dinheiroOrders: Order[] = [];
    const pixOrders: Order[] = [];
    const debitoOrders: Order[] = [];
    const creditoOrders: Order[] = [];

    myCompletedToday.forEach(o => {
      const pm = (o.paymentMethod || '').toLowerCase();
      if (pm.includes('dinheiro')) {
        dinheiroOrders.push(o);
      } else if (pm.includes('pix')) {
        pixOrders.push(o);
      } else if (pm.includes('débito') || pm.includes('debito')) {
        debitoOrders.push(o);
      } else {
        creditoOrders.push(o);
      }
    });

    const sumTotal = (list: Order[]) => list.reduce((acc, o) => acc + (o.total || 0), 0);

    return {
      dinheiro: {
        total: sumTotal(dinheiroOrders),
        orders: dinheiroOrders,
        icon: '💵',
        label: 'Dinheiro'
      },
      pix: {
        total: sumTotal(pixOrders),
        orders: pixOrders,
        icon: '⚡',
        label: 'Pix'
      },
      debito: {
        total: sumTotal(debitoOrders),
        orders: debitoOrders,
        icon: '💳',
        label: 'Débito'
      },
      credito: {
        total: sumTotal(creditoOrders),
        orders: creditoOrders,
        icon: '💳',
        label: 'Crédito'
      },
      totalFaturado: sumTotal(myCompletedToday)
    };
  }, [myCompletedToday]);

  // Caixa em Espécie (Dinheiro em Mãos)
  const totalOpExpensesAmount = operationalExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
  const totalSettledAmount = cashSettlements.reduce((acc, e) => acc + Number(e.amount || 0), 0);
  const cashInHand = Math.max(0, paymentBreakdown.dinheiro.total - totalOpExpensesAmount - totalSettledAmount);

  // Lista de Gestores para seleção rápida de "Entregue a quem?"
  const managerOptions = useMemo(() => {
    const managers = allCollaborators.filter(c => c.role === 'gestor' || c.role === 'admin');
    const list: string[] = [];
    managers.forEach(m => {
      if (m.name && !list.includes(m.name)) list.push(m.name);
    });
    if (!list.some(n => n.toLowerCase().includes('gestor'))) {
      list.unshift('Gestor Responsável');
    }
    return list;
  }, [allCollaborators]);

  // Busca de Clientes para Nova Venda
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return allCustomers.slice(0, 5);
    const q = searchQuery.toLowerCase();
    return allCustomers.filter(c => 
      (c.name || '').toLowerCase().includes(q) || 
      (c.phone || '').includes(q) ||
      c.addresses?.some(a => (a.street || '').toLowerCase().includes(q) || (a.neighborhood || '').toLowerCase().includes(q))
    ).slice(0, 8);
  }, [allCustomers, searchQuery]);

  const cartTotal = useMemo(() => {
    return Object.entries(cart).reduce((acc, [id, qty]) => {
      const product = productsList.find(p => p.id === id);
      const effective = product ? calculateEffectivePrice(product, selectedPaymentMethod) : 0;
      return acc + effective * (qty as number);
    }, 0);
  }, [cart, productsList, selectedPaymentMethod]);

  const handleCompleteOrder = (order: Order) => {
    onUpdateOrder({ 
      ...order, 
      status: 'Concluído', 
      completedAt: new Date().toISOString() 
    });
    showToast(`Pedido #${order.id} concluído com sucesso!`);
  };

  // Submissão de Nova Venda com Coleta de GPS Obrigatória no Consumidor Rua
  const handleConfirmNewSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartTotal <= 0) {
      alert('Selecione ao menos 1 item para a venda.');
      return;
    }

    // Se for consumidor rua, assegura captura fresca de GPS para o Mapa de Calor
    let locationToSave = saleGpsCoords || user.location;
    if (saleCustomerType === 'walkin' && !locationToSave) {
      locationToSave = await captureFreshGps();
    }

    let customerName = 'Consumidor Final (Rua)';
    let customerPhone = '';
    let customerId = 'walkin-' + Math.random().toString(36).substr(2, 7);
    let address: Address = {
      street: walkinStreet.trim() || 'Venda Consumidor Rua',
      number: 'S/N',
      neighborhood: walkinNeighborhood.trim() || 'Venda em Trânsito',
      city: 'Niterói',
      state: 'RJ',
      cep: '24000-000',
      lat: locationToSave?.lat,
      lng: locationToSave?.lng
    };

    if (saleCustomerType === 'existing' && selectedCustomer) {
      customerId = selectedCustomer.id;
      customerName = selectedCustomer.name || 'Cliente';
      customerPhone = selectedCustomer.phone || '';
      if (selectedCustomer.addresses && selectedCustomer.addresses.length > 0) {
        address = {
          ...selectedCustomer.addresses[0],
          lat: selectedCustomer.addresses[0].lat || locationToSave?.lat,
          lng: selectedCustomer.addresses[0].lng || locationToSave?.lng
        };
      }
    } else {
      if (walkinName.trim()) customerName = walkinName.trim();
      if (walkinPhone.trim()) customerPhone = walkinPhone.trim();
    }

    const newSaleOrder: Order = {
      id: 'VENDA-' + Math.floor(1000 + Math.random() * 9000),
      customerId,
      customerName,
      phone: customerPhone,
      address,
      items: Object.entries(cart)
        .filter(([_, qty]) => (qty as number) > 0)
        .map(([id, qty]) => {
          const product = productsList.find(p => p.id === id);
          return {
            productId: id,
            quantity: qty as number,
            priceAtTime: product ? calculateEffectivePrice(product, selectedPaymentMethod) : 0
          };
        }),
      total: cartTotal,
      paymentMethod: selectedPaymentMethod,
      status: 'Concluído',
      deliveryPersonId: user.id,
      deliveryPersonLocation: locationToSave ? { lat: locationToSave.lat, lng: locationToSave.lng } : undefined,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      feedback: `[Venda Presencial Entregador: ${user.name}${locationToSave ? ` | GPS: ${locationToSave.lat.toFixed(5)}, ${locationToSave.lng.toFixed(5)}` : ''}]`
    };

    onAddOrder(newSaleOrder);
    setIsAddingSale(false);
    setCart({ p13: 1 });
    setSelectedCustomer(null);
    setWalkinName('');
    setWalkinPhone('');
    setWalkinStreet('');
    setWalkinNeighborhood('');
    showToast(`✅ Venda de R$ ${cartTotal.toFixed(2)} salva com GPS!`);
  };

  // Submissão de Despesa
  const handleConfirmExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(expenseAmount.replace(',', '.'));
    if (isNaN(amountVal) || amountVal <= 0) {
      alert('Informe um valor válido para a despesa.');
      return;
    }
    if (!expenseDesc.trim()) {
      alert('Informe a descrição da despesa.');
      return;
    }

    const newExpense: Expense = {
      id: Math.random().toString(36).substr(2, 9),
      description: `${expenseCategory}: ${expenseDesc.trim()}`,
      amount: amountVal,
      category: expenseCategory,
      date: new Date().toISOString(),
      userId: user.id
    };

    onAddExpense(newExpense);
    setIsAddingExpense(false);
    setExpenseDesc('');
    setExpenseAmount('');
    showToast(`💸 Despesa de R$ ${amountVal.toFixed(2)} lançada com sucesso!`);
  };

  // Submissão de Prestação de Contas (Baixa de Caixa)
  const handleConfirmSettlement = (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(settlementAmount.replace(',', '.'));
    if (isNaN(amountVal) || amountVal <= 0) {
      alert('Informe um valor válido para a baixa.');
      return;
    }

    const recipient = settlementRecipient.trim() || 'Gestor da Distribuidora';
    const note = settlementNote.trim() ? ` (${settlementNote.trim()})` : '';

    const settlementExpense: Expense = {
      id: Math.random().toString(36).substr(2, 9),
      description: `Baixa de Caixa repassada para ${recipient}${note}`,
      amount: amountVal,
      category: 'Prestação de Contas',
      date: new Date().toISOString(),
      userId: user.id
    };

    onAddExpense(settlementExpense);
    setIsAddingSettlement(false);
    setSettlementAmount('');
    setSettlementRecipient('');
    setSettlementNote('');
    showToast(`🏦 Baixa de R$ ${amountVal.toFixed(2)} repassada para ${recipient}!`);
  };

  // Compartilhar Resumo no WhatsApp do Gestor (Opção Texto)
  const handleShareSummaryWhatsapp = () => {
    const dataHoje = new Date().toLocaleDateString('pt-BR');
    const nomeDistribuidora = businessInfo?.name?.trim() || 'Gás Express';

    let txt = `📊 *PRESTAÇÃO DE CONTAS / FECHAMENTO*\n`;
    txt += `🏢 *${nomeDistribuidora}*\n`;
    txt += `👤 Entregador: *${user.name}*\n`;
    txt += `📅 Data: ${dataHoje}\n`;
    txt += `------------------------------------\n`;
    txt += `📦 *Entregas Concluídas:* ${myCompletedToday.length}\n`;
    txt += `💰 *Faturamento Total:* R$ ${paymentBreakdown.totalFaturado.toFixed(2)}\n\n`;
    
    txt += `*RECEBIMENTO POR MODALIDADE:*\n`;
    txt += `💵 Dinheiro: R$ ${paymentBreakdown.dinheiro.total.toFixed(2)} (${paymentBreakdown.dinheiro.orders.length} vendas)\n`;
    txt += `⚡ Pix: R$ ${paymentBreakdown.pix.total.toFixed(2)} (${paymentBreakdown.pix.orders.length} vendas)\n`;
    txt += `💳 Débito: R$ ${paymentBreakdown.debito.total.toFixed(2)} (${paymentBreakdown.debito.orders.length} vendas)\n`;
    txt += `💳 Crédito: R$ ${paymentBreakdown.credito.total.toFixed(2)} (${paymentBreakdown.credito.orders.length} vendas)\n\n`;

    txt += `*CAIXA EM DINHEIRO FÍSICO:*\n`;
    txt += `(+) Entradas em Dinheiro: R$ ${paymentBreakdown.dinheiro.total.toFixed(2)}\n`;
    txt += `(-) Despesas do Dia: R$ ${totalOpExpensesAmount.toFixed(2)}\n`;
    txt += `(-) Baixas Já Entregues: R$ ${totalSettledAmount.toFixed(2)}\n`;
    txt += `👉 *SALDO RESTANTE EM MÃOS:* R$ ${cashInHand.toFixed(2)}\n`;
    txt += `------------------------------------\n`;
    txt += `_Fechamento gerado via App Entregador_`;

    setIsShareModalOpen(false);
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank');
  };

  // Gerador de Documento PDF Real com jsPDF
  const generateFechamentoPdf = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const empresa = businessInfo?.name?.trim() || 'GÁS EXPRESS';
    const dataHoje = new Date().toLocaleDateString('pt-BR');
    const horaAgora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Cabeçalho escuro moderno
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 36, 'F');

    // Faixa amarela decorativa
    doc.setFillColor(250, 204, 21); // yellow-400
    doc.rect(0, 36, 210, 2, 'F');

    doc.setTextColor(250, 204, 21);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(empresa.toUpperCase(), 14, 16);

    doc.setTextColor(226, 232, 240);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('EXTRATO DIARIO DE FECHAMENTO & PRESTACAO DE CONTAS', 14, 26);

    // Box de Informações do Entregador e Data
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 44, 182, 18, 3, 3, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 44, 182, 18, 3, 3, 'S');

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Entregador: ${user.name}`, 20, 52);
    doc.setFont('helvetica', 'normal');
    doc.text(`Telefone: ${user.phone || 'Nao informado'}`, 20, 57);

    doc.setFont('helvetica', 'bold');
    doc.text(`Data: ${dataHoje}`, 130, 52);
    doc.setFont('helvetica', 'normal');
    doc.text(`Gerado as: ${horaAgora}`, 130, 57);

    // Seção 1: Resumo das Vendas
    let y = 72;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('1. RESUMO DE VENDAS DO DIA', 14, y);

    // Tabela Header
    y += 4;
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(14, y, 182, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('FORMA DE PAGAMENTO', 20, y + 5.5);
    doc.text('QUANTIDADE', 105, y + 5.5);
    doc.text('TOTAL RECEBIDO (R$)', 150, y + 5.5);

    const linhas = [
      { label: 'Dinheiro (Em Especie)', qtd: paymentBreakdown.dinheiro.orders.length, total: paymentBreakdown.dinheiro.total },
      { label: 'Pix Instantaneo', qtd: paymentBreakdown.pix.orders.length, total: paymentBreakdown.pix.total },
      { label: 'Cartao de Debito', qtd: paymentBreakdown.debito.orders.length, total: paymentBreakdown.debito.total },
      { label: 'Cartao de Credito', qtd: paymentBreakdown.credito.orders.length, total: paymentBreakdown.credito.total },
    ];

    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);

    linhas.forEach((l, idx) => {
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, y, 182, 7, 'F');
      }
      doc.text(l.label, 20, y + 5);
      doc.text(`${l.qtd} pedidos`, 105, y + 5);
      doc.setFont('helvetica', 'bold');
      doc.text(`R$ ${l.total.toFixed(2)}`, 150, y + 5);
      doc.setFont('helvetica', 'normal');
      doc.setDrawColor(241, 245, 249);
      doc.line(14, y + 7, 196, y + 7);
      y += 7;
    });

    // Linha Total Geral
    doc.setFillColor(254, 240, 138); // yellow-100
    doc.rect(14, y, 182, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('TOTAL GERAL FATURADO', 20, y + 5.5);
    doc.text(`${myCompletedToday.length} vendas`, 105, y + 5.5);
    doc.text(`R$ ${paymentBreakdown.totalFaturado.toFixed(2)}`, 150, y + 5.5);

    // Seção 2: Prestação de Contas (Caixa em Dinheiro)
    y += 18;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('2. PRESTACAO DE CONTAS (CAIXA FISICO EM MAOS)', 14, y);

    y += 5;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, y, 182, 40, 3, 3, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, y, 182, 40, 3, 3, 'S');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('(+) Entradas em Dinheiro (Vendas concluidas):', 20, y + 8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 163, 74);
    doc.text(`+ R$ ${paymentBreakdown.dinheiro.total.toFixed(2)}`, 150, y + 8);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.text('(-) Despesas Operacionais pagas pelo Entregador:', 20, y + 16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text(`- R$ ${totalOpExpensesAmount.toFixed(2)}`, 150, y + 16);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.text('(-) Baixas ja entregues ao Caixa / Gestor:', 20, y + 24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text(`- R$ ${totalSettledAmount.toFixed(2)}`, 150, y + 24);

    doc.setDrawColor(203, 213, 225);
    doc.line(18, y + 29, 192, y + 29);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('(=) SALDO RESTANTE EM MAOS A ACERTAR:', 20, y + 36);
    doc.setTextColor(180, 83, 9);
    doc.text(`R$ ${cashInHand.toFixed(2)}`, 150, y + 36);

    // Seção 3: Baixas Registradas
    y += 50;
    if (cashSettlements.length > 0) {
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('3. BAIXAS E REPASSES REALIZADOS HOJE', 14, y);

      y += 5;
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      cashSettlements.slice(0, 6).forEach((e) => {
        const hora = new Date(e.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        doc.text(`• ${hora} - ${e.description}`, 20, y);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(37, 99, 235);
        doc.text(`R$ ${Number(e.amount).toFixed(2)}`, 150, y);
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'normal');
        y += 6;
      });
    }

    // Assinaturas no rodapé
    y = Math.max(y + 15, 245);
    doc.setDrawColor(148, 163, 184);
    doc.line(25, y, 90, y);
    doc.line(120, y, 185, y);

    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'bold');
    doc.text(user.name, 57, y + 4, { align: 'center' });
    doc.text('Responsavel pelo Caixa / Gestor', 152, y + 4, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.text('Entregador', 57, y + 8, { align: 'center' });
    doc.text('Conferido e Quitado', 152, y + 8, { align: 'center' });

    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Documento emitido automaticamente em ${dataHoje} as ${horaAgora} via App Gas Express`, 105, 285, { align: 'center' });

    return doc;
  };

  // Compartilhamento Direto do Arquivo PDF (Web Share API com fallback para download)
  const handleSharePdf = async () => {
    try {
      const doc = generateFechamentoPdf();
      const pdfBlob = doc.output('blob');
      const cleanName = user.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
      const fileName = `Fechamento_${cleanName}_${new Date().toISOString().slice(0, 10)}.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      // Se o navegador móvel suportar compartilhamento direto de arquivos (Android Chrome, iOS Safari)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Fechamento Diário - ${user.name}`,
          text: `Olá! Segue em anexo o arquivo PDF com o fechamento e prestação de contas de hoje (${new Date().toLocaleDateString('pt-BR')}) do entregador ${user.name}.`
        });
        showToast('PDF compartilhado com sucesso!');
        setIsShareModalOpen(false);
        return;
      }

      // Caso contrário, salva o arquivo PDF diretamente no dispositivo do usuário
      doc.save(fileName);
      showToast('Arquivo PDF baixado no seu dispositivo!');
      setIsShareModalOpen(false);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('Erro ao compartilhar PDF:', err);
        try {
          const doc = generateFechamentoPdf();
          doc.save(`Fechamento_${new Date().toISOString().slice(0, 10)}.pdf`);
          showToast('Arquivo PDF baixado!');
        } catch (saveErr) {
          alert('Não foi possível gerar o PDF: ' + err.message);
        }
      }
      setIsShareModalOpen(false);
    }
  };

  const handleDownloadPdf = () => {
    try {
      const doc = generateFechamentoPdf();
      const cleanName = user.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
      doc.save(`Fechamento_${cleanName}_${new Date().toISOString().slice(0, 10)}.pdf`);
      showToast('Download do PDF concluído!');
      setIsShareModalOpen(false);
    } catch (err: any) {
      alert('Erro ao baixar PDF: ' + err.message);
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="h-full w-full flex flex-col bg-slate-950 text-white overflow-hidden relative select-none">
      {/* Toast Informativo */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-16 left-4 right-4 z-[999] max-w-sm mx-auto bg-yellow-400 text-slate-950 font-black px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-xs border border-yellow-300"
          >
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SEGUNDA LINHA: Apenas as abas navegáveis, sem segundo cabeçalho */}
      <nav className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800/90 px-3 py-2 shrink-0 z-30 shadow-md">
        <div className="grid grid-cols-4 gap-1.5 max-w-lg mx-auto">
          {/* Aba Entregas */}
          <button
            type="button"
            onClick={() => setActiveTab('deliveries')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'deliveries'
                ? 'bg-yellow-400 text-slate-950 shadow-md shadow-yellow-400/20 scale-[1.02]'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Package className="w-4 h-4 shrink-0" />
            <span>Entregas</span>
            {myDeliveries.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                activeTab === 'deliveries' ? 'bg-slate-900 text-yellow-400' : 'bg-yellow-400 text-slate-950'
              }`}>
                {myDeliveries.length}
              </span>
            )}
          </button>

          {/* Aba Mapa */}
          <button
            type="button"
            onClick={() => setActiveTab('map')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'map'
                ? 'bg-yellow-400 text-slate-950 shadow-md shadow-yellow-400/20 scale-[1.02]'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            <MapIcon className="w-4 h-4 shrink-0" />
            <span>Mapa</span>
            {myDeliveries.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            )}
          </button>

          {/* Aba Produtos */}
          <button
            type="button"
            onClick={() => setActiveTab('products')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'products'
                ? 'bg-yellow-400 text-slate-950 shadow-md shadow-yellow-400/20 scale-[1.02]'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-4 h-4 shrink-0" />
            <span>Produtos</span>
          </button>

          {/* Aba Financeiro */}
          <button
            type="button"
            onClick={() => setActiveTab('finance')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'finance'
                ? 'bg-yellow-400 text-slate-950 shadow-md shadow-yellow-400/20 scale-[1.02]'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wallet className="w-4 h-4 shrink-0" />
            <span>Caixa</span>
          </button>
        </div>
      </nav>

      {/* ÁREA PRINCIPAL: CONTEÚDO POR ABA */}
      <div className="flex-1 overflow-hidden relative flex flex-col min-h-0">
        <AnimatePresence mode="wait">
          {/* ========================================================= */}
          {/* ABA 1: ENTREGAS                                          */}
          {/* ========================================================= */}
          {activeTab === 'deliveries' && (
            <motion.div
              key="deliveries"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 overflow-y-auto p-4 pb-28 space-y-4 max-w-md mx-auto w-full"
            >
              {/* Resumo rápido do dia */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800 shadow-sm flex items-center gap-3">
                  <div className="p-2.5 bg-yellow-400/10 rounded-xl text-yellow-400">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Em Rota</p>
                    <p className="text-xl font-black text-yellow-400">{myDeliveries.length}</p>
                  </div>
                </div>

                <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800 shadow-sm flex items-center gap-3">
                  <div className="p-2.5 bg-green-500/10 rounded-xl text-green-400">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Entregues Hoje</p>
                    <p className="text-xl font-black text-green-400">{myCompletedToday.length}</p>
                  </div>
                </div>
              </div>

              {/* Lista de Entregas */}
              {myDeliveries.length === 0 ? (
                <div className="text-center py-16 bg-slate-900/60 rounded-3xl border border-slate-800/80 p-6 mt-4">
                  <div className="w-16 h-16 mx-auto mb-4 bg-slate-800 rounded-full flex items-center justify-center text-slate-500">
                    <Truck className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-black text-slate-200 mb-1">Nenhuma entrega no momento</h3>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    Novos pedidos atribuídos pelo gestor aparecerão automaticamente aqui com alerta sonoro.
                  </p>
                  <button
                    onClick={() => setIsAddingSale(true)}
                    className="mt-5 inline-flex items-center gap-2 bg-yellow-400 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs shadow-md active:scale-95 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Lançar Venda Direta</span>
                  </button>
                </div>
              ) : (
                myDeliveries.map((o, idx) => (
                  <div 
                    key={o.id} 
                    className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-lg relative overflow-hidden"
                  >
                    {/* Faixa decorativa de status */}
                    <div className={`absolute top-0 left-0 right-0 h-1.5 ${o.status === 'Em Rota' ? 'bg-blue-500' : 'bg-orange-500'}`} />

                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 bg-yellow-400 text-slate-950 rounded-full flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
                        {idx + 1}
                      </div>
                      <div>
                        <span className="text-[10px] font-black bg-slate-800 text-slate-300 px-2 py-0.5 rounded uppercase">
                          #{o.id}
                        </span>
                        <span className={`ml-2 text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                          o.status === 'Em Rota' ? 'bg-blue-950 text-blue-400 border border-blue-800' : 'bg-orange-950 text-orange-400 border border-orange-800'
                        }`}>
                          {o.status}
                        </span>
                      </div>
                      <p className="text-base font-black text-yellow-400 ml-auto">
                        R$ {(o.total || 0).toFixed(2)}
                      </p>
                    </div>

                    <div className="mb-3">
                      <h4 className="font-black text-base text-white">{o.customerName || 'Cliente'}</h4>
                      {o.phone && (
                        <a 
                          href={`tel:${o.phone.replace(/\D/g, '')}`} 
                          className="text-xs text-yellow-400/90 font-bold flex items-center gap-1.5 mt-0.5 hover:underline"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>{o.phone}</span>
                        </a>
                      )}
                    </div>

                    {/* Endereço */}
                    <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800/80 mb-3 space-y-1">
                      <div className="text-slate-300 text-xs font-bold flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                        <span>
                          {o.address?.street || 'Endereço não informado'}
                          {o.address?.number ? `, ${o.address.number}` : ''}
                          {o.address?.complement ? ` - ${o.address.complement}` : ''}
                        </span>
                      </div>
                      {o.address?.reference && (
                        <p className="text-[11px] text-slate-400 ml-6">📍 Ref: {o.address.reference}</p>
                      )}
                      <div className="flex items-center gap-2 ml-6 text-[11px] text-slate-500 font-bold">
                        <span>{o.address?.neighborhood || ''}</span>
                        <span>•</span>
                        <span className="text-yellow-400/80">Pagamento: {o.paymentMethod || 'Dinheiro'}</span>
                      </div>
                    </div>

                    {/* Agendamento se houver */}
                    {o.isScheduled && (
                      <div className="bg-purple-950/70 border border-purple-800/60 text-purple-200 rounded-xl px-3 py-1.5 text-xs font-bold mb-3 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-purple-400" />
                        <span>📅 Agendado: {o.scheduledDate || 'Hoje'} ({o.scheduledPeriodName || (o.scheduledPeriod === 'manha' ? 'Manhã' : o.scheduledPeriod === 'tarde' ? 'Tarde' : o.scheduledPeriod || 'Turno')}{o.scheduledTimeRange ? ` ${o.scheduledTimeRange}` : ''})</span>
                      </div>
                    )}

                    {/* Botões de Ação */}
                    <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          `${o.address?.street || ''} ${o.address?.number || ''} ${o.address?.neighborhood || ''} ${o.address?.city || ''}`.trim()
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white py-3 px-3 rounded-xl font-black flex items-center justify-center gap-2 text-xs transition-all shadow-md"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>MAPS / WAZE</span>
                      </a>

                      {o.status === 'Atribuído' ? (
                        <button 
                          onClick={() => onUpdateOrder({ ...o, status: 'Em Rota' })} 
                          className="bg-orange-500 hover:bg-orange-400 active:scale-95 text-slate-950 py-3 px-3 rounded-xl font-black flex items-center justify-center gap-2 text-xs transition-all shadow-md cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          <span>ACEITAR ROTA</span>
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleCompleteOrder(o)} 
                          className="bg-green-500 hover:bg-green-400 active:scale-95 text-slate-950 py-3 px-3 rounded-xl font-black flex items-center justify-center gap-2 text-xs transition-all shadow-md cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          <span>ENTREGUE</span>
                        </button>
                      )}
                    </div>

                    {/* Botão de WhatsApp quando Em Rota */}
                    {o.status === 'Em Rota' && (
                      <button
                        onClick={() => {
                          const link = `${window.location.origin}?phone=${o.phone || ''}`;
                          const storeName = businessInfo?.name?.trim() || 'Gás Express';
                          const message = `Olá ${o.customerName || 'Cliente'}, aqui é o entregador da ${storeName}! Estou a caminho do seu endereço agora. Acompanhe minha entrega ao vivo aqui: ${link}`;
                          window.open(`https://wa.me/55${(o.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
                        }}
                        className="w-full bg-slate-800 hover:bg-slate-700 active:scale-95 text-yellow-400 py-2.5 px-3 rounded-xl font-black flex items-center justify-center gap-2 text-xs border border-slate-700 transition-all cursor-pointer"
                      >
                        <MessageSquare className="w-4 h-4 text-green-400" />
                        <span>AVISAR NO WHATSAPP</span>
                      </button>
                    )}
                  </div>
                ))
              )}
            </motion.div>
          )}

          {/* ========================================================= */}
          {/* ABA 2: MAPA (TELA CHEIA, SEM DIV ENVOLVENTE)              */}
          {/* ========================================================= */}
          {activeTab === 'map' && (
            <motion.div
              key="map"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 w-full h-full relative overflow-hidden flex flex-col"
            >
              {/* Barra Flutuante de Status GPS no topo do Mapa */}
              <div className="absolute top-3 left-3 right-3 z-[500] max-w-md mx-auto pointer-events-auto">
                <div className="bg-slate-900/90 backdrop-blur-md p-2.5 px-3 rounded-2xl border border-slate-800 shadow-xl flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${user.location ? 'bg-green-500 animate-pulse' : 'bg-yellow-400'}`}></span>
                    <span className="text-[11px] font-bold text-slate-200 truncate">{gpsStatus}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button 
                      onClick={handleForceGps} 
                      className="bg-slate-800 hover:bg-slate-700 text-yellow-400 px-2.5 py-1.5 rounded-xl text-[10px] font-black transition-all border border-slate-700 active:scale-95 cursor-pointer"
                    >
                      📡 GPS
                    </button>
                    <button 
                      onClick={handleSimulateStep} 
                      className="bg-yellow-400 hover:bg-yellow-300 text-slate-950 px-2.5 py-1.5 rounded-xl text-[10px] font-black transition-all active:scale-95 shadow-sm cursor-pointer"
                    >
                      🛵 Andar
                    </button>
                  </div>
                </div>
              </div>

              {/* Mapa em preenchimento 100% */}
              <div className="w-full h-full flex-1 z-0">
                <MapContainer 
                  center={[user.location?.lat || -22.903, user.location?.lng || -43.112]} 
                  zoom={14} 
                  style={{ height: '100%', width: '100%' }}
                  zoomControl={false}
                >
                  <TileLayer
                    url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap'
                  />
                  
                  {/* Marcador do Entregador */}
                  <Marker 
                    position={[user.location?.lat || -22.903, user.location?.lng || -43.112]}
                    icon={L.divIcon({
                      html: `<div style="background:#22c55e;color:white;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:18px;border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.4);">🛵</div>`,
                      iconSize: [36, 36],
                      iconAnchor: [18, 18],
                      className: ''
                    })}
                  >
                    <Popup>
                      <div className="font-bold text-slate-900 text-xs">Você (Entregador)</div>
                      <div className="text-[10px] text-slate-500">Localização em tempo real</div>
                    </Popup>
                  </Marker>

                  {/* Marcadores dos Pedidos Ativos */}
                  {myDeliveries.map((order, idx) => {
                    const lat = order.address?.lat || -22.903 + (idx * 0.0012);
                    const lng = order.address?.lng || -43.112 + (idx * 0.0008);
                    const color = order.status === 'Em Rota' ? '#3b82f6' : '#f97316';
                    
                    return (
                      <Marker
                        key={order.id}
                        position={[lat, lng]}
                        icon={L.divIcon({
                          html: `<div style="background:${color};color:white;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.4);">${idx + 1}</div>`,
                          iconSize: [30, 30],
                          className: ''
                        })}
                      >
                        <Popup>
                          <div className="text-slate-900 p-1">
                            <div className="font-black text-xs">Parada #{idx + 1} • {order.customerName}</div>
                            <div className="text-[11px] text-slate-600">{order.address?.street}, {order.address?.number}</div>
                            <div className="text-[10px] font-bold text-green-700 mt-1">R$ {order.total.toFixed(2)} ({order.paymentMethod})</div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              </div>

              {/* Card Flutuante da Próxima Parada no rodapé do mapa */}
              {nextActiveDelivery && (
                <div className="absolute bottom-20 left-3 right-3 z-[500] max-w-md mx-auto pointer-events-auto">
                  <div className="bg-slate-900/95 backdrop-blur-md p-3.5 rounded-2xl border border-slate-700 shadow-2xl">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-black bg-yellow-400 text-slate-950 px-2 py-0.5 rounded uppercase">
                        Próxima Parada • #{nextActiveDelivery.id}
                      </span>
                      <span className="text-xs font-black text-yellow-400">
                        R$ {nextActiveDelivery.total.toFixed(2)}
                      </span>
                    </div>
                    <p className="font-black text-sm text-white truncate">{nextActiveDelivery.customerName}</p>
                    <p className="text-xs text-slate-300 truncate mb-2.5">
                      📍 {nextActiveDelivery.address?.street}, {nextActiveDelivery.address?.number} ({nextActiveDelivery.address?.neighborhood})
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          `${nextActiveDelivery.address?.street || ''} ${nextActiveDelivery.address?.number || ''} ${nextActiveDelivery.address?.neighborhood || ''}`.trim()
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-blue-600 hover:bg-blue-500 py-2 rounded-xl text-center font-black text-xs flex items-center justify-center gap-1.5 shadow"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Abrir Rota</span>
                      </a>
                      <button
                        onClick={() => handleCompleteOrder(nextActiveDelivery)}
                        className="bg-green-500 hover:bg-green-400 text-slate-950 py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Entregue</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ========================================================= */}
          {/* ABA 3: CATÁLOGO DE PRODUTOS & AJUSTE DE VALOR (ENTREGADOR) */}
          {/* ========================================================= */}
          {activeTab === 'products' && (
            <motion.div
              key="products"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 overflow-y-auto p-4 pb-28 space-y-3.5 max-w-md mx-auto w-full"
            >
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl flex items-center justify-between gap-3 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-yellow-400 text-slate-950 rounded-2xl shadow-sm">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-white">Tabela de Preços</h3>
                    <p className="text-[10px] text-slate-400">Toque em qualquer produto ou valor para editar</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                {productsList.filter(p => p.isActive !== false).map(p => {
                  const pixEff = calculateEffectivePrice(p, 'Pix');
                  const cashEff = calculateEffectivePrice(p, 'Dinheiro');

                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedProductForPriceEdit(p);
                        setIsQuickPriceModalOpen(true);
                      }}
                      className="bg-slate-900 hover:bg-slate-850 p-4 rounded-3xl border border-slate-800 hover:border-yellow-400/50 transition-all cursor-pointer flex items-center justify-between gap-3 group active:scale-[0.99] shadow-sm"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <img
                          src={p.image}
                          alt={p.name}
                          className="w-14 h-14 rounded-2xl object-cover shrink-0 border border-slate-800"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] uppercase font-black text-slate-400 bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800">
                              {p.category || 'Gás & Água'}
                            </span>
                            {p.unit && (
                              <span className="text-[9px] uppercase font-bold text-yellow-400">
                                {p.unit}
                              </span>
                            )}
                          </div>
                          <p className="font-bold text-xs text-white truncate mt-1">
                            {p.name}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            {p.pixDiscount?.enabled && (
                              <span className="text-[10px] font-black text-emerald-400 flex items-center gap-0.5 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800/40">
                                <Zap className="w-3 h-3" /> PIX R$ {pixEff.toFixed(2)}
                              </span>
                            )}
                            {p.cashDiscount?.enabled && (
                              <span className="text-[10px] font-black text-amber-400 flex items-center gap-0.5 bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-800/40">
                                <Banknote className="w-3 h-3" /> R$ {cashEff.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[9px] font-black text-slate-500 uppercase block mb-1">Valor Venda</span>
                        <div className="flex items-center gap-1.5 bg-yellow-400 text-slate-950 px-3 py-1.5 rounded-xl font-black text-sm shadow-md shadow-yellow-400/10 group-hover:scale-105 transition-transform">
                          <span>R$ {p.price.toFixed(2)}</span>
                          <Edit2 className="w-3.5 h-3.5 text-slate-800" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ========================================================= */}
          {/* ABA 4: FINANCEIRO & PRESTAÇÃO DE CONTAS (CLEAN & MODERNO) */}
          {/* ========================================================= */}
          {activeTab === 'finance' && (
            <motion.div
              key="finance"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 overflow-y-auto p-4 pb-28 space-y-3.5 max-w-md mx-auto w-full"
            >
              {/* Barra de Ação Rápida */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddingSale(true)}
                  className="bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-slate-950 p-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-yellow-400/20 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>NOVA VENDA</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAddingExpense(true)}
                  className="bg-slate-900 hover:bg-slate-800 active:scale-95 text-slate-200 border border-slate-800 p-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <TrendingDown className="w-4 h-4 text-red-400" />
                  <span>LANÇAR DESPESA</span>
                </button>
              </div>

              {/* Card de Caixa em Dinheiro Físico (Compacto) */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-900/90 p-4 rounded-3xl border border-slate-800 shadow-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-yellow-400/10 rounded-xl text-yellow-400">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Dinheiro em Mãos</p>
                      <p className="text-2xl font-black text-yellow-400">
                        R$ {cashInHand.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSettlementAmount(cashInHand > 0 ? cashInHand.toFixed(2) : '');
                      setIsAddingSettlement(true);
                    }}
                    className="bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-slate-950 font-black text-[11px] px-3 py-2 rounded-xl shadow transition-all cursor-pointer shrink-0"
                  >
                    Dar Baixa
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-slate-800/80 text-[10px] text-slate-400">
                  <div>
                    <span className="block text-slate-500">Vendas Dinheiro:</span>
                    <span className="font-black text-green-400">+ R$ {paymentBreakdown.dinheiro.total.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500">Despesas:</span>
                    <span className="font-black text-red-400">- R$ {totalOpExpensesAmount.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500">Baixas Repassadas:</span>
                    <span className="font-black text-blue-400">- R$ {totalSettledAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Vendas do Dia por Pagamento (Layout Clean em Linhas / Acordeom) */}
              <div className="bg-slate-900 p-4 rounded-3xl border border-slate-800 shadow-xl space-y-2.5">
                <div className="flex items-center justify-between pb-1">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-yellow-400" />
                    <h3 className="font-black text-xs text-slate-300 uppercase tracking-wider">
                      Vendas por Pagamento (Hoje)
                    </h3>
                  </div>
                  <span className="text-[11px] font-black text-white bg-slate-800 px-2 py-0.5 rounded-full">
                    {myCompletedToday.length} vendas • R$ {paymentBreakdown.totalFaturado.toFixed(2)}
                  </span>
                </div>

                {/* 4 Linhas Compactas que expandem com os detalhes */}
                <div className="space-y-1.5">
                  {[
                    { id: 'dinheiro', data: paymentBreakdown.dinheiro },
                    { id: 'pix', data: paymentBreakdown.pix },
                    { id: 'debito', data: paymentBreakdown.debito },
                    { id: 'credito', data: paymentBreakdown.credito }
                  ].map(({ id, data }) => {
                    const isExpanded = expandedPaymentMethod === id;
                    return (
                      <div key={id} className="bg-slate-950/80 border border-slate-800/80 rounded-2xl overflow-hidden transition-all">
                        <button
                          type="button"
                          onClick={() => setExpandedPaymentMethod(isExpanded ? null : id)}
                          className="w-full p-3 flex items-center justify-between hover:bg-slate-800/40 transition-all cursor-pointer text-left"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-base shrink-0">{data.icon}</span>
                            <div>
                              <span className="text-xs font-black text-white">{data.label}</span>
                              <span className="text-[10px] text-slate-400 block font-medium">
                                {data.orders.length} {data.orders.length === 1 ? 'venda' : 'vendas'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-black text-yellow-400">
                              R$ {data.total.toFixed(2)}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                        </button>

                        {/* Detalhe das Vendas desta Modalidade */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="border-t border-slate-800/60 bg-slate-950 p-2.5 space-y-1.5"
                            >
                              {data.orders.length === 0 ? (
                                <p className="text-[11px] text-slate-500 py-1.5 text-center font-medium">
                                  Nenhuma venda em {data.label.toLowerCase()} hoje.
                                </p>
                              ) : (
                                data.orders.map(order => {
                                  const itemsSummary = order.items
                                    .map(i => `${i.quantity}x ${PRODUCTS.find(p => p.id === i.productId)?.name || 'Gás'}`)
                                    .join(', ');
                                  const timeStr = new Date(order.completedAt || order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                                  return (
                                    <div 
                                      key={order.id} 
                                      className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/60 flex items-center justify-between text-xs"
                                    >
                                      <div className="min-w-0 pr-2">
                                        <p className="font-bold text-slate-200 truncate">{order.customerName}</p>
                                        <p className="text-[10px] text-slate-400 truncate">{itemsSummary || '1 item'}</p>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <p className="font-black text-white">R$ {(order.total || 0).toFixed(2)}</p>
                                        <p className="text-[9px] text-slate-500">{timeStr}</p>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Botão de Fechamento do Dia (Abre escolha: PDF ou Texto) */}
              <div className="bg-slate-900 p-4 rounded-3xl border border-slate-800 shadow-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-xs text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-green-400" />
                    Fechamento do Turno / Dia
                  </h3>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  Envie o balanço completo das vendas, despesas, baixas e saldo em dinheiro para a gerência.
                </p>
                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(true)}
                  className="w-full bg-green-600 hover:bg-green-500 active:scale-95 text-white py-3 px-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-green-600/20 transition-all cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>COMPARTILHAR FECHAMENTO (PDF / TEXTO)</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ========================================================= */}
      {/* BOTÃO FLUTUANTE "+" COM SPEED DIAL (2 OPÇÕES PRINCIPAIS)    */}
      {/* ========================================================= */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 pointer-events-auto">
        <AnimatePresence>
          {isFabMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.9 }}
              className="flex flex-col gap-2.5 items-end mb-1"
            >
              {/* Opção 1: Nova Venda */}
              <button
                type="button"
                onClick={() => {
                  setIsFabMenuOpen(false);
                  setIsAddingSale(true);
                }}
                className="flex items-center gap-3 bg-yellow-400 hover:bg-yellow-300 text-slate-950 px-4 py-3 rounded-2xl shadow-2xl font-black text-xs active:scale-95 transition-all cursor-pointer border border-yellow-300"
              >
                <span>🛒 Nova Venda</span>
              </button>

              {/* Opção 2: Lançar Despesa */}
              <button
                type="button"
                onClick={() => {
                  setIsFabMenuOpen(false);
                  setIsAddingExpense(true);
                }}
                className="flex items-center gap-3 bg-slate-900 hover:bg-slate-800 text-red-400 border border-slate-700 px-4 py-3 rounded-2xl shadow-2xl font-black text-xs active:scale-95 transition-all cursor-pointer"
              >
                <span>💸 Lançar Despesa</span>
              </button>

              {/* Opção 3: Prestação de Contas */}
              <button
                type="button"
                onClick={() => {
                  setIsFabMenuOpen(false);
                  setSettlementAmount(cashInHand > 0 ? cashInHand.toFixed(2) : '');
                  setIsAddingSettlement(true);
                }}
                className="flex items-center gap-3 bg-slate-900 hover:bg-slate-800 text-blue-400 border border-slate-700 px-4 py-3 rounded-2xl shadow-2xl font-black text-xs active:scale-95 transition-all cursor-pointer"
              >
                <span>🏦 Dar Baixa no Caixa</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Botão circular principal */}
        <button
          type="button"
          onClick={() => setIsFabMenuOpen(!isFabMenuOpen)}
          className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
            isFabMenuOpen 
              ? 'bg-slate-800 text-white rotate-45 border border-slate-600' 
              : 'bg-yellow-400 text-slate-950 shadow-yellow-400/30'
          }`}
          title="Ações rápidas"
        >
          <Plus className="w-7 h-7" />
        </button>
      </div>

      {/* Backdrop para fechar o Speed Dial ao tocar fora */}
      {isFabMenuOpen && (
        <div 
          onClick={() => setIsFabMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] z-40"
        />
      )}

      {/* ========================================================= */}
      {/* MODAL: ESCOLHA DE COMPARTILHAMENTO (WHATSAPP vs PDF)      */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isShareModalOpen && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[70] p-4 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 w-full max-w-sm rounded-3xl p-6 border border-slate-800 shadow-2xl space-y-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <h3 className="font-black text-base text-white">Compartilhar Fechamento</h3>
                <button 
                  onClick={() => setIsShareModalOpen(false)}
                  className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-400">
                Como você deseja compartilhar a prestação de contas do dia?
              </p>

              <div className="space-y-2.5">
                {/* Opção 1: Compartilhar Arquivo PDF direto */}
                <button
                  type="button"
                  onClick={handleSharePdf}
                  className="w-full bg-yellow-400 hover:bg-yellow-500 active:scale-95 text-slate-950 p-3.5 rounded-2xl font-black text-xs flex items-center gap-3 transition-all cursor-pointer shadow-lg shadow-yellow-400/20"
                >
                  <div className="p-2 bg-slate-950 text-yellow-400 rounded-xl">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="font-black text-sm">Enviar Arquivo PDF</p>
                      <span className="bg-slate-950 text-yellow-400 text-[9px] px-1.5 py-0.5 rounded font-black uppercase">Direto</span>
                    </div>
                    <p className="text-[10px] text-slate-800 font-medium">Compartilha o arquivo .pdf oficial no WhatsApp ou outros apps</p>
                  </div>
                </button>

                {/* Opção 2: Texto formatado no WhatsApp */}
                <button
                  type="button"
                  onClick={handleShareSummaryWhatsapp}
                  className="w-full bg-green-600 hover:bg-green-500 active:scale-95 text-white p-3.5 rounded-2xl font-black text-xs flex items-center gap-3 transition-all cursor-pointer shadow-lg shadow-green-600/20"
                >
                  <div className="p-2 bg-green-700/50 rounded-xl">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-black">Texto no WhatsApp</p>
                    <p className="text-[10px] text-green-200 font-normal">Envia relatório formatado com quebra de linhas</p>
                  </div>
                </button>

                {/* Opção 3: Baixar PDF */}
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="w-full bg-slate-800 hover:bg-slate-700 active:scale-95 text-white p-3 rounded-2xl font-black text-xs flex items-center gap-3 border border-slate-700 transition-all cursor-pointer"
                >
                  <div className="p-2 bg-slate-700 text-white rounded-xl">
                    <Download className="w-4 h-4" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-bold">Baixar Arquivo PDF (.pdf)</p>
                    <p className="text-[10px] text-slate-400 font-normal">Salva o PDF diretamente no seu celular ou computador</p>
                  </div>
                </button>

                {/* Opção 4: Visualizar Extrato na Tela */}
                <button
                  type="button"
                  onClick={() => {
                    setIsShareModalOpen(false);
                    setIsPdfModalOpen(true);
                  }}
                  className="w-full bg-slate-800/60 hover:bg-slate-800 active:scale-95 text-slate-300 p-2.5 rounded-2xl font-semibold text-xs flex items-center gap-3 border border-slate-800 transition-all cursor-pointer"
                >
                  <div className="p-2 bg-slate-800 text-slate-400 rounded-xl">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-bold text-slate-200">Visualizar Extrato na Tela</p>
                    <p className="text-[10px] text-slate-400 font-normal">Ver cupom detalhado e opção de imprimir</p>
                  </div>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL: VISUALIZAÇÃO E IMPRESSÃO DO PDF DO FECHAMENTO       */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isPdfModalOpen && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[80] p-4 flex items-center justify-center overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white text-slate-900 w-full max-w-lg rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            >
              {/* Barra superior de controle */}
              <div className="flex justify-between items-center pb-3 border-b border-slate-200 shrink-0">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-yellow-600" />
                  <span className="font-black text-sm">Extrato de Fechamento</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    onClick={handleSharePdf}
                    className="flex items-center gap-1 bg-yellow-400 hover:bg-yellow-500 text-slate-900 px-2.5 py-1.5 rounded-xl font-black text-xs shadow cursor-pointer"
                    title="Compartilhar Arquivo PDF no WhatsApp ou outros apps"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Compartilhar</span> PDF
                  </button>
                  <button
                    onClick={handleDownloadPdf}
                    className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-800 px-2.5 py-1.5 rounded-xl font-bold text-xs shadow cursor-pointer"
                    title="Baixar Arquivo PDF"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Baixar</span>
                  </button>
                  <button
                    onClick={handlePrintPdf}
                    className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-800 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl font-bold text-xs shadow cursor-pointer"
                    title="Imprimir Cupom"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => setIsPdfModalOpen(false)}
                    className="p-1.5 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-900 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Área do Documento / Cupom Fiscal */}
              <div id="printable-fechamento" className="flex-1 overflow-y-auto py-4 space-y-4 text-xs pr-1">
                <div className="text-center pb-3 border-b border-slate-200">
                  <h2 className="text-lg font-black uppercase tracking-wider">{businessInfo?.name || 'GÁS EXPRESS'}</h2>
                  <p className="text-[11px] text-slate-500">Relatório Diário de Prestação de Contas do Entregador</p>
                  <div className="mt-2 inline-flex items-center gap-4 bg-slate-100 px-3 py-1 rounded-xl text-[11px] font-bold">
                    <span>👤 {user.name}</span>
                    <span>📅 {new Date().toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>

                {/* Resumo de Vendas */}
                <div className="space-y-2">
                  <h4 className="font-black text-[11px] uppercase tracking-wider text-slate-500">1. Resumo das Vendas</h4>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 text-[10px] uppercase font-bold">
                        <th className="py-1">Modalidade</th>
                        <th className="py-1 text-center">Qtd</th>
                        <th className="py-1 text-right">Total (R$)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-medium">
                      <tr>
                        <td className="py-1.5">💵 Dinheiro</td>
                        <td className="py-1.5 text-center font-bold">{paymentBreakdown.dinheiro.orders.length}</td>
                        <td className="py-1.5 text-right font-bold">R$ {paymentBreakdown.dinheiro.total.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5">⚡ Pix</td>
                        <td className="py-1.5 text-center font-bold">{paymentBreakdown.pix.orders.length}</td>
                        <td className="py-1.5 text-right font-bold">R$ {paymentBreakdown.pix.total.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5">💳 Cartão de Débito</td>
                        <td className="py-1.5 text-center font-bold">{paymentBreakdown.debito.orders.length}</td>
                        <td className="py-1.5 text-right font-bold">R$ {paymentBreakdown.debito.total.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5">💳 Cartão de Crédito</td>
                        <td className="py-1.5 text-center font-bold">{paymentBreakdown.credito.orders.length}</td>
                        <td className="py-1.5 text-right font-bold">R$ {paymentBreakdown.credito.total.toFixed(2)}</td>
                      </tr>
                      <tr className="border-t-2 border-slate-300 font-black text-sm">
                        <td className="py-2">TOTAL FATURADO</td>
                        <td className="py-2 text-center">{myCompletedToday.length}</td>
                        <td className="py-2 text-right text-slate-900">R$ {paymentBreakdown.totalFaturado.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Balanço de Caixa em Dinheiro */}
                <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <h4 className="font-black text-[11px] uppercase tracking-wider text-slate-500">2. Balanço do Caixa em Espécie</h4>
                  <div className="space-y-1.5 text-xs font-medium">
                    <div className="flex justify-between">
                      <span>(+) Total Recebido em Dinheiro:</span>
                      <span className="font-bold text-green-700">+ R$ {paymentBreakdown.dinheiro.total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>(-) Despesas Pagas pelo Entregador:</span>
                      <span className="font-bold text-red-600">- R$ {totalOpExpensesAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>(-) Baixas Já Repassadas ao Caixa:</span>
                      <span className="font-bold text-blue-600">- R$ {totalSettledAmount.toFixed(2)}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 flex justify-between items-center font-black text-sm">
                      <span>(=) SALDO RESTANTE EM MÃOS:</span>
                      <span className="text-base text-slate-900">R$ {cashInHand.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Baixas Realizadas */}
                {cashSettlements.length > 0 && (
                  <div className="space-y-1.5">
                    <h4 className="font-black text-[11px] uppercase tracking-wider text-slate-500">3. Baixas Repassadas Hoje</h4>
                    <div className="divide-y divide-slate-100 text-[11px]">
                      {cashSettlements.map(e => (
                        <div key={e.id} className="py-1 flex justify-between">
                          <span className="text-slate-600">{e.description}</span>
                          <span className="font-bold text-blue-600">R$ {Number(e.amount).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Assinaturas */}
                <div className="pt-6 grid grid-cols-2 gap-6 text-center text-[10px] text-slate-400">
                  <div className="border-t border-slate-300 pt-1">
                    <p className="font-bold text-slate-700">{user.name}</p>
                    <p>Entregador</p>
                  </div>
                  <div className="border-t border-slate-300 pt-1">
                    <p className="font-bold text-slate-700">Responsável pelo Caixa</p>
                    <p>Conferido / Recebido</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 1: NOVA VENDA (COM GPS DO CONSUMIDOR RUA)            */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isAddingSale && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[60] p-4 flex flex-col justify-end sm:justify-center overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              className="bg-slate-900 w-full max-w-md mx-auto rounded-3xl p-5 border border-slate-800 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-yellow-400/10 rounded-xl text-yellow-400">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white">Nova Venda</h2>
                    <p className="text-[10px] text-slate-400">Venda presencial com geolocalização</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsAddingSale(false)}
                  className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleConfirmNewSale} className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
                {/* Tipo de Cliente: Consumidor Rua vs Cadastrado */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">
                    Destinatário
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-2xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setSaleCustomerType('walkin')}
                      className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        saleCustomerType === 'walkin'
                          ? 'bg-yellow-400 text-slate-950 shadow'
                          : 'text-slate-400'
                      }`}
                    >
                      Consumidor Rua
                    </button>
                    <button
                      type="button"
                      onClick={() => setSaleCustomerType('existing')}
                      className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        saleCustomerType === 'existing'
                          ? 'bg-yellow-400 text-slate-950 shadow'
                          : 'text-slate-400'
                      }`}
                    >
                      Buscar Cliente
                    </button>
                  </div>
                </div>

                {saleCustomerType === 'existing' ? (
                  <div className="space-y-2">
                    {!selectedCustomer ? (
                      <>
                        <div className="relative">
                          <Search className="absolute left-3.5 top-3.5 text-slate-500 w-4 h-4" />
                          <input 
                            type="text" 
                            placeholder="Buscar por nome, telefone ou rua..."
                            className="w-full pl-10 pr-3 py-2.5 bg-slate-950 rounded-xl text-xs text-white border border-slate-800 focus:border-yellow-400 outline-none"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto">
                          {filteredCustomers.map(c => (
                            <button 
                              key={c.id} 
                              type="button"
                              onClick={() => setSelectedCustomer(c)} 
                              className="w-full p-2.5 bg-slate-950 hover:bg-slate-800 rounded-xl text-left border border-slate-800/80 hover:border-yellow-400 transition-all flex justify-between items-center cursor-pointer"
                            >
                              <div className="min-w-0 pr-2">
                                <p className="font-bold text-xs text-white truncate">{c.name}</p>
                                <p className="text-[10px] text-slate-400 truncate">
                                  {c.addresses?.[0]?.street ? `${c.addresses[0].street}, ${c.addresses[0].number || ''}` : (c.phone || 'Sem endereço cadastrado')}
                                </p>
                              </div>
                              <span className="text-[10px] font-black text-yellow-400 shrink-0">SELECIONAR</span>
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex justify-between items-center">
                        <div className="min-w-0 pr-2">
                          <span className="text-[10px] font-black text-slate-500 uppercase block">Cliente Selecionado</span>
                          <p className="font-black text-xs text-white truncate">{selectedCustomer.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {selectedCustomer.addresses?.[0]?.street || selectedCustomer.phone || 'Endereço no local'}
                          </p>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => setSelectedCustomer(null)} 
                          className="text-xs font-black text-yellow-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-700 cursor-pointer"
                        >
                          TROCAR
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 bg-slate-950 p-3 rounded-2xl border border-slate-800">
                    <input 
                      type="text" 
                      placeholder="Nome do cliente (opcional)"
                      className="w-full p-2.5 bg-slate-900 rounded-xl text-xs text-white border border-slate-800 outline-none"
                      value={walkinName}
                      onChange={(e) => setWalkinName(e.target.value)}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input 
                        type="tel" 
                        placeholder="WhatsApp (opcional)"
                        className="w-full p-2.5 bg-slate-900 rounded-xl text-xs text-white border border-slate-800 outline-none"
                        value={walkinPhone}
                        onChange={(e) => setWalkinPhone(e.target.value)}
                      />
                      <input 
                        type="text" 
                        placeholder="Bairro (opcional)"
                        className="w-full p-2.5 bg-slate-900 rounded-xl text-xs text-white border border-slate-800 outline-none"
                        value={walkinNeighborhood}
                        onChange={(e) => setWalkinNeighborhood(e.target.value)}
                      />
                    </div>

                    {/* Destaque GPS para o Mapa de Calor */}
                    <div className="pt-1 flex items-center justify-between bg-slate-900/80 px-2.5 py-2 rounded-xl border border-slate-800">
                      <div className="flex items-center gap-2 min-w-0">
                        <MapPin className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                        <span className="text-[10px] font-bold text-slate-300 truncate">
                          {isCapturingGps ? (
                            'Buscando sinal GPS do local...'
                          ) : saleGpsCoords ? (
                            `GPS: ${saleGpsCoords.lat.toFixed(4)}, ${saleGpsCoords.lng.toFixed(4)} (Mapa de Calor OK)`
                          ) : (
                            'GPS aguardando sinal...'
                          )}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={captureFreshGps}
                        className="text-[10px] font-black text-yellow-400 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700 shrink-0 cursor-pointer"
                      >
                        Recapturar
                      </button>
                    </div>
                  </div>
                )}

                {/* Itens do Catálogo */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">
                    Itens da Venda
                  </label>
                  <div className="space-y-2">
                    {productsList.filter(p => p.isActive !== false).map(p => {
                      const qty = cart[p.id] || 0;
                      const effectiveItemPrice = calculateEffectivePrice(p, selectedPaymentMethod);
                      return (
                        <div key={p.id} className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
                          <div 
                            onClick={() => {
                              setSelectedProductForPriceEdit(p);
                              setIsQuickPriceModalOpen(true);
                            }}
                            className="flex items-center gap-3 cursor-pointer group/item flex-1 min-w-0 pr-2"
                            title="Toque no produto para alterar o valor de venda"
                          >
                            <img src={p.image} className="w-10 h-10 rounded-xl object-cover shrink-0" alt={p.name} />
                            <div className="min-w-0">
                              <p className="font-bold text-xs text-white truncate group-hover/item:text-yellow-400 transition-colors">{p.name}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="font-black text-xs text-yellow-400">R$ {effectiveItemPrice.toFixed(2)}</span>
                                <Edit2 className="w-3 h-3 text-slate-500 group-hover/item:text-yellow-400" />
                                {p.price !== effectiveItemPrice && (
                                  <span className="text-[10px] text-slate-500 line-through">R$ {p.price.toFixed(2)}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button 
                              type="button"
                              onClick={() => setCart(prev => ({ ...prev, [p.id]: Math.max(0, (prev[p.id] || 0) - 1) }))}
                              className="w-7 h-7 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center font-black text-xs text-slate-300 cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="font-black text-xs w-5 text-center">{qty}</span>
                            <button 
                              type="button"
                              onClick={() => setCart(prev => ({ ...prev, [p.id]: (prev[p.id] || 0) + 1 }))}
                              className="w-7 h-7 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 flex items-center justify-center font-black text-xs cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Forma de Pagamento */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">
                    Forma de Pagamento
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['Dinheiro', 'Pix', 'Cartão de Débito', 'Cartão de Crédito'] as const).map(pm => (
                      <button
                        key={pm}
                        type="button"
                        onClick={() => setSelectedPaymentMethod(pm)}
                        className={`p-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
                          selectedPaymentMethod === pm
                            ? 'bg-yellow-400 text-slate-950 border-yellow-300 shadow'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        <span>{pm === 'Dinheiro' ? '💵' : pm === 'Pix' ? '⚡' : '💳'}</span>
                        <span>{pm}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Total e Confirmação */}
                <div className="pt-2">
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex justify-between items-center mb-3">
                    <span className="text-xs font-black text-slate-400">TOTAL A RECEBER:</span>
                    <span className="text-2xl font-black text-yellow-400">R$ {cartTotal.toFixed(2)}</span>
                  </div>

                  <button
                    type="submit"
                    disabled={cartTotal <= 0}
                    className="w-full bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 text-slate-950 font-black py-3.5 rounded-2xl shadow-xl shadow-yellow-400/20 text-xs transition-all cursor-pointer"
                  >
                    CONFIRMAR E REGISTRAR VENDA
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 2: LANÇAR DESPESA                                    */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isAddingExpense && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[60] p-4 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 w-full max-w-md rounded-3xl p-6 border border-slate-800 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-red-500/10 rounded-xl text-red-400">
                    <TrendingDown className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-white">Lançar Despesa</h2>
                    <p className="text-[10px] text-slate-400">Saídas do caixa (gasolina, almoço, consertos)</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsAddingExpense(false)}
                  className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleConfirmExpense} className="space-y-3.5">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Categoria</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['Combustível', 'Alimentação', 'Manutenção Moto', 'Outros'] as const).map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setExpenseCategory(cat)}
                        className={`p-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                          expenseCategory === cat
                            ? 'bg-red-500/20 text-red-400 border-red-500/40'
                            : 'bg-slate-950 text-slate-400 border-slate-800'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Descrição</label>
                  <input
                    required
                    type="text"
                    placeholder="Ex: Abastecimento de R$ 30 no Posto Shell"
                    className="w-full p-3 bg-slate-950 rounded-xl text-xs text-white border border-slate-800 focus:border-red-400 outline-none"
                    value={expenseDesc}
                    onChange={(e) => setExpenseDesc(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Valor (R$)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    className="w-full p-3 bg-slate-950 rounded-xl text-sm font-black text-yellow-400 border border-slate-800 focus:border-red-400 outline-none"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-red-600 hover:bg-red-500 active:scale-95 text-white font-black py-3.5 rounded-2xl shadow-lg shadow-red-600/20 text-xs transition-all cursor-pointer mt-2"
                >
                  SALVAR DESPESA
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 3: PRESTAÇÃO DE CONTAS / DAR BAIXA NO CAIXA          */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isAddingSettlement && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[60] p-4 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 w-full max-w-md rounded-3xl p-6 border border-slate-800 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400">
                    <Banknote className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-white">Baixa de Caixa</h2>
                    <p className="text-[10px] text-slate-400">Repassar dinheiro físico para o caixa</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsAddingSettlement(false)}
                  className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleConfirmSettlement} className="space-y-3.5">
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex justify-between items-center">
                  <span className="text-xs text-slate-400 font-bold">Saldo Atual em Mãos:</span>
                  <span className="text-base font-black text-yellow-400">R$ {cashInHand.toFixed(2)}</span>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase">Valor a Baixar (R$)</label>
                    {cashInHand > 0 && (
                      <button
                        type="button"
                        onClick={() => setSettlementAmount(cashInHand.toFixed(2))}
                        className="text-[10px] font-black text-yellow-400 hover:underline cursor-pointer"
                      >
                        Baixar Tudo
                      </button>
                    )}
                  </div>
                  <input
                    required
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    className="w-full p-3 bg-slate-950 rounded-xl text-sm font-black text-yellow-400 border border-slate-800 focus:border-blue-400 outline-none"
                    value={settlementAmount}
                    onChange={(e) => setSettlementAmount(e.target.value)}
                  />
                </div>

                {/* Seleção rápida de "Entregue a quem?" (Gestor / Caixa) */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">
                    Entregue a quem? (Selecione ou digite)
                  </label>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setSettlementRecipient('Gestor')}
                      className={`p-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 cursor-pointer ${
                        settlementRecipient.toLowerCase().includes('gestor')
                          ? 'bg-blue-600 text-white border-blue-400 shadow'
                          : 'bg-slate-950 text-slate-300 border-slate-800'
                      }`}
                    >
                      <User className="w-3.5 h-3.5 text-yellow-400" />
                      <span>👤 Gestor</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSettlementRecipient('Caixa da Loja')}
                      className={`p-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 cursor-pointer ${
                        settlementRecipient.toLowerCase().includes('caixa')
                          ? 'bg-blue-600 text-white border-blue-400 shadow'
                          : 'bg-slate-950 text-slate-300 border-slate-800'
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5 text-blue-400" />
                      <span>🏢 Caixa da Loja</span>
                    </button>
                  </div>

                  {managerOptions.length > 0 && managerOptions[0] !== 'Gestor Responsável' && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {managerOptions.map(name => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => setSettlementRecipient(name)}
                          className={`text-[10px] px-2.5 py-1 rounded-lg border font-bold transition-all cursor-pointer ${
                            settlementRecipient === name
                              ? 'bg-blue-500/20 text-blue-400 border-blue-400'
                              : 'bg-slate-950 text-slate-400 border-slate-800'
                          }`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  )}

                  <input
                    type="text"
                    placeholder="Outro nome ou observação de quem recebeu..."
                    className="w-full p-2.5 bg-slate-950 rounded-xl text-xs text-white border border-slate-800 focus:border-blue-400 outline-none"
                    value={settlementRecipient}
                    onChange={(e) => setSettlementRecipient(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Observações (opcional)</label>
                  <input
                    type="text"
                    placeholder="Ex: Acerto de contas do turno da manhã"
                    className="w-full p-3 bg-slate-950 rounded-xl text-xs text-white border border-slate-800 focus:border-blue-400 outline-none"
                    value={settlementNote}
                    onChange={(e) => setSettlementNote(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-black py-3.5 rounded-2xl shadow-lg shadow-blue-600/20 text-xs transition-all cursor-pointer mt-2"
                >
                  CONFIRMAR BAIXA NO CAIXA
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Edição Rápida de Preço para o Entregador */}
      <QuickPriceEditModal
        product={selectedProductForPriceEdit}
        isOpen={isQuickPriceModalOpen}
        onClose={() => {
          setIsQuickPriceModalOpen(false);
          setSelectedProductForPriceEdit(null);
        }}
        onSavePrice={async (prodId, newPrice, pixVal, cashVal, pixType, cashType) => {
          if (onUpdateProductPrice) {
            await onUpdateProductPrice(prodId, newPrice, pixVal, cashVal, pixType, cashType);
          }
          showToast('Preço do produto atualizado com sucesso!');
        }}
        userRole="entregador"
      />
    </div>
  );
};

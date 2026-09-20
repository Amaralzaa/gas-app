export type OrderStatus = 'Pendente' | 'Atribuído' | 'Em Rota' | 'Concluído' | 'Cancelado';

export interface Address {
  cep: string;
  street: string;
  number: string;
  complement?: string;
  reference?: string;
  neighborhood: string;
  city: string;
  state: string;
  lat?: number;
  lng?: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  priceAtTime: number;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  phone: string;
  address: Address;
  items: OrderItem[];
  total: number;
  discount?: number;
  couponCode?: string;
  referralId?: string;
  paymentMethod: string;
  status: OrderStatus;
  deliveryPersonId?: string;
  createdAt: string;
  estimatedArrival?: string; // ISO string
  deliveryPersonLocation?: { lat: number; lng: number };
  selectedFreebie?: string; // Nome do brinde selecionado
  rating?: number; // 1 to 5 stars
  serviceRating?: number; // Avaliação da Porto Gás (1-5)
  deliveryRating?: number; // Avaliação do entregador (1-5)
  feedback?: string;
  cancellationReason?: string;
  cancelledAt?: string;
  isScheduled?: boolean;
  scheduledDate?: string;
  scheduledPeriod?: string;
  scheduledPeriodName?: string;
  scheduledTimeRange?: string;
}

export interface Freebie {
  id: string;
  name: string;
  image: string;
  isActive: boolean;
  createdAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  type: 'fixed' | 'percentage';
  value: number;
  minOrderValue?: number;
  validUntil: string;
  allowedNeighborhoods?: string[];
  allowedUserRoles?: UserRole[];
  usageLimit?: number;
  usageCount: number;
  isActive: boolean;
  isOneTimePerUser?: boolean;
}

export interface Reward {
  id: string;
  title: string;
  description: string;
  pointsCost: number;
  type: 'discount' | 'free_item' | 'free_product' | 'cashback' | 'voucher';
  productId?: string;
  value?: number;
  validityDays?: number;
  minOrderValue?: number;
  rules?: string[];
  isActive?: boolean;
}

export interface BenefitsConfig {
  referralDiscountValue: number; // R$ de desconto para o amigo indicado (1º pedido)
  referralPointsAwarded: number; // Pontos ganhos por indicação concluída
  pointsPerCurrency: number; // Pontos ganhos por R$ 1,00 gasto em compras concluídas
  referralMinOrderValue?: number; // Valor mínimo do pedido para aplicar cupom de indicação
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  userId: string;
}

export interface CoverageArea {
  id: string;
  neighborhood: string;
  city: string;
  allowedCeps: string[]; // List of CEP prefixes or specific CEPs
  center?: { lat: number; lng: number };
  boundary?: any; // GeoJSON geometry
}

export type AppView = 'Cliente' | 'Gestor' | 'Entregador';

export type UserRole = 'cliente' | 'gestor' | 'entregador' | 'admin';

export interface PointHistoryItem {
  id: string;
  userId: string;
  type: 'earned_order' | 'referral_bonus' | 'redeemed_reward' | 'adjustment';
  points: number;
  description: string;
  orderId?: string;
  createdAt: string;
}

export interface AppUser {
  id: string;
  email?: string;
  role: UserRole;
  name: string;
  phone?: string;
  referralCode?: string;
  points?: number;
  addresses?: Address[];
  usedCoupons?: string[]; // List of coupon IDs
  location?: { lat: number; lng: number }; // For delivery persons
  lastMessageSentAt?: string; // ISO string
  allowedTabs?: string[]; // For granular access control (e.g. ['orders', 'map'])
  pointHistory?: PointHistoryItem[];
}

export type ReferralStatus = 'Pendente' | 'Validado' | 'Confirmado' | 'Rejeitado';

export interface Referral {
  id: string;
  referrerId: string;
  referrerName: string;
  refereeId?: string;
  refereeName: string;
  refereePhone: string;
  status: ReferralStatus;
  orderId?: string;
  pointsAwarded: number;
  createdAt: string;
  validatedAt?: string;
}

export interface DayHours {
  isOpen: boolean;
  open: string;   // "08:00"
  close: string;  // "19:00"
}

export interface OpeningHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

export interface DeliveryPeriod {
  id: string; // e.g. 'manha', 'tarde', 'noite' ou uuid
  name: string; // e.g. 'Manhã', 'Tarde', 'Noite'
  startTime: string; // e.g. '08:00'
  endTime: string; // e.g. '13:00'
  active: boolean;
  icon?: string; // 'sun' | 'sunset' | 'moon' | 'clock' | string
}

export interface BusinessInfo {
  id: string;
  name: string;
  tradeName?: string;
  cnpj?: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  logoUrl?: string;
  address: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    cep: string;
    complement?: string;
  };
  openingHours: OpeningHours;
  isOpenOverride?: boolean | null; // null = automático por horário, true = forçar aberto, false = forçar fechado
  minOrderValue?: number;
  deliveryFee?: number;
  deliveryPeriods?: DeliveryPeriod[];
  updatedAt?: string;
}

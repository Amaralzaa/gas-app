export type OrderStatus = 'Pendente' | 'Em Rota' | 'Concluído' | 'Cancelado';

export interface Address {
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
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
  type: 'discount' | 'free_product' | 'voucher';
  value?: number;
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
}

export type AppView = 'Cliente' | 'Gestor' | 'Entregador';

export type UserRole = 'cliente' | 'gestor' | 'entregador' | 'admin';

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
}

export type ReferralStatus = 'Pendente' | 'Validado' | 'Rejeitado';

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

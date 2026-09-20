import { AppUser, Order, Expense, CoverageArea, Coupon, Reward, Referral, BenefitsConfig } from './types';

export const MOCK_USERS: AppUser[] = [
  {
    id: 'af35500c-e4b1-4834-a9c4-0a16d936b45d',
    name: 'Rafael Amaral (Gestor)',
    email: 'rafael.rr.amaral@gmail.com',
    role: 'gestor',
    phone: '',
    points: 0,
    addresses: [],
    allowedTabs: ['dashboard', 'orders', 'map', 'coverage', 'benefits', 'predictions', 'collaborators']
  },
  {
    id: 'ce191c4f-f686-4c1e-bc3f-0caf94a7426b',
    name: 'Antônio',
    email: 'entregador@portogas.com',
    role: 'entregador',
    phone: '',
    points: 0,
    addresses: [],
    location: { lat: -22.9013209, lng: -43.1189942 },
    allowedTabs: []
  }
];

export const MOCK_COVERAGE_AREAS: CoverageArea[] = [
  {
    id: 'cov-1',
    neighborhood: 'Icaraí',
    city: 'Niterói',
    allowedCeps: ['24220', '24230'],
    center: { lat: -22.905, lng: -43.11 }
  },
  {
    id: 'cov-2',
    neighborhood: 'Santa Rosa',
    city: 'Niterói',
    allowedCeps: ['24240'],
    center: { lat: -22.902, lng: -43.098 }
  },
  {
    id: 'cov-3',
    neighborhood: 'Ingá',
    city: 'Niterói',
    allowedCeps: ['24210'],
    center: { lat: -22.904, lng: -43.125 }
  },
  {
    id: 'cov-4',
    neighborhood: 'Centro',
    city: 'Niterói',
    allowedCeps: ['24020', '24030'],
    center: { lat: -22.885, lng: -43.122 }
  }
];

export const MOCK_ORDERS: Order[] = [];

export const MOCK_EXPENSES: Expense[] = [];


export const MOCK_COUPONS: Coupon[] = [
  {
    id: 'cup-1',
    code: 'GAS10',
    type: 'fixed',
    value: 10.00,
    validUntil: '2026-12-31',
    usageCount: 14,
    usageLimit: 100,
    isActive: true
  },
  {
    id: 'cup-2',
    code: 'BEMVINDO',
    type: 'percentage',
    value: 10,
    validUntil: '2026-12-31',
    usageCount: 8,
    usageLimit: 50,
    isActive: true
  }
];

export const MOCK_REWARDS: Reward[] = [
  {
    id: 'rew-1',
    title: 'Desconto de R$ 15,00',
    description: 'Válido em qualquer pedido de botijão P13 no aplicativo.',
    pointsCost: 100,
    type: 'discount',
    value: 15,
    validityDays: 30,
    minOrderValue: 90,
    rules: [
      'Válido por 30 dias após o momento do resgate',
      'Uso mínimo: pedidos a partir de R$ 90,00',
      'Não cumulativo com outros cupons promocionais',
      'Desconto aplicado automaticamente na finalização do pedido'
    ]
  },
  {
    id: 'rew-2',
    title: 'Galão de Água 20L Grátis',
    description: 'Resgate um galão de água mineral 20L de graça com sua entrega.',
    pointsCost: 150,
    type: 'free_product',
    validityDays: 15,
    minOrderValue: 0,
    rules: [
      'Válido por 15 dias após o resgate',
      'Sem valor mínimo de compra',
      'Entrega gratuita acompanhada de um pedido de gás',
      'Limitado a 1 galão por resgate'
    ]
  }
];

export const MOCK_REFERRALS: Referral[] = [];


export const MOCK_BENEFITS_CONFIG: BenefitsConfig = {
  referralDiscountValue: 10,
  referralPointsAwarded: 100,
  pointsPerCurrency: 10,
  referralMinOrderValue: 0
};

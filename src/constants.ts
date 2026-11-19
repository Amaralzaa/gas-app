import { Product } from './types';

export const PRODUCT_CATEGORIES = [
  'Gás GLP',
  'Água Mineral',
  'Acessórios & Kits',
  'Outros'
] as const;

export const DEFAULT_PRODUCT_IMAGES: Record<string, string> = {
  p13: 'https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=600&auto=format&fit=crop&q=80',
  p13_completo: 'https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=600&auto=format&fit=crop&q=80',
  p45: 'https://images.unsplash.com/photo-1527018606412-a72518e3fb37?w=600&auto=format&fit=crop&q=80',
  p20: 'https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=600&auto=format&fit=crop&q=80',
  p5: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=600&auto=format&fit=crop&q=80',
  water20: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=600&auto=format&fit=crop&q=80',
  water20_completo: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=600&auto=format&fit=crop&q=80',
  water10: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=600&auto=format&fit=crop&q=80',
  kit_gas: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80',
  bomba_usb: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80',
  suporte_agua: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80'
};

const RAW_PRODUCT_PRESETS: Product[] = [
  {
    id: 'p13',
    name: 'Gás de Cozinha P13 (Recarga)',
    price: 115.00,
    category: 'Gás GLP',
    unit: '13kg',
    brand: 'Nacional / Ultragaz',
    image: 'https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=600&auto=format&fit=crop&q=80',
    description: 'Recarga de botijão P13 com troca de vasilhame vazio. O padrão mais utilizado em cozinhas residenciais com selo de segurança ANP.',
    isActive: true,
    pixDiscount: {
      enabled: true,
      type: 'fixed',
      value: 10.00
    },
    cashDiscount: {
      enabled: true,
      type: 'fixed',
      value: 10.00
    }
  },
  {
    id: 'p13_completo',
    name: 'Gás P13 Vasilhame Completo (Novo)',
    price: 310.00,
    category: 'Gás GLP',
    unit: '13kg',
    brand: 'Nacional / Ultragaz',
    image: 'https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=600&auto=format&fit=crop&q=80',
    description: 'Botijão P13 completo: casco metálico novo certificado pelo INMETRO + carga de gás 13kg lacrada (sem necessidade de dar vasilhame na troca).',
    isActive: true,
    pixDiscount: {
      enabled: true,
      type: 'fixed',
      value: 20.00
    },
    cashDiscount: {
      enabled: true,
      type: 'fixed',
      value: 20.00
    }
  },
  {
    id: 'p45',
    name: 'Cilindro de Gás P45 (Industrial / Condomínio)',
    price: 450.00,
    category: 'Gás GLP',
    unit: '45kg',
    brand: 'Nacional / Ultragaz',
    image: 'https://images.unsplash.com/photo-1527018606412-a72518e3fb37?w=600&auto=format&fit=crop&q=80',
    description: 'Cilindro de 45kg ideal para condomínios com central de gás, restaurantes, padarias, lavanderias e indústrias de alto consumo.',
    isActive: true,
    pixDiscount: {
      enabled: true,
      type: 'fixed',
      value: 30.00
    },
    cashDiscount: {
      enabled: true,
      type: 'fixed',
      value: 30.00
    }
  },
  {
    id: 'p20',
    name: 'Gás GLP P20 (Para Empilhadeira)',
    price: 220.00,
    category: 'Gás GLP',
    unit: '20kg',
    brand: 'Nacional / Ultragaz',
    image: 'https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=600&auto=format&fit=crop&q=80',
    description: 'Cilindro P20 específico para empilhadeiras a GLP, projetado para operar na posição horizontal com válvula de segurança líquida.',
    isActive: true,
    pixDiscount: {
      enabled: true,
      type: 'fixed',
      value: 15.00
    },
    cashDiscount: {
      enabled: true,
      type: 'fixed',
      value: 15.00
    }
  },
  {
    id: 'p5',
    name: 'Botijão de Gás P5 (5kg Portátil)',
    price: 85.00,
    category: 'Gás GLP',
    unit: '5kg',
    brand: 'Nacional / Ultragaz',
    image: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=600&auto=format&fit=crop&q=80',
    description: 'Botijão compacto de 5kg, ideal para camping, motorhomes, trailers, pequenos apartamentos ou quem cozinha com baixa frequência.',
    isActive: true,
    pixDiscount: {
      enabled: true,
      type: 'fixed',
      value: 5.00
    },
    cashDiscount: {
      enabled: true,
      type: 'fixed',
      value: 5.00
    }
  },
  {
    id: 'water20',
    name: 'Água Mineral Galão 20L (Recarga)',
    price: 18.00,
    category: 'Água Mineral',
    unit: '20L',
    brand: 'Fonte Natural',
    image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=600&auto=format&fit=crop&q=80',
    description: 'Galão de 20 litros de água mineral pura e cristalina de fonte natural protegida, com troca de garrafão retornável dentro do prazo de validade.',
    isActive: true,
    pixDiscount: {
      enabled: true,
      type: 'fixed',
      value: 2.00
    },
    cashDiscount: {
      enabled: true,
      type: 'fixed',
      value: 2.00
    }
  },
  {
    id: 'water20_completo',
    name: 'Água Mineral 20L Galão Completo (Com Vasilhame)',
    price: 45.00,
    category: 'Água Mineral',
    unit: '20L',
    brand: 'Fonte Natural',
    image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=600&auto=format&fit=crop&q=80',
    description: 'Garrafão retornável azul de 20L novo lacrado, com validade de 3 anos gravada no casco, completo com 20 litros de água mineral.',
    isActive: true,
    pixDiscount: {
      enabled: true,
      type: 'fixed',
      value: 5.00
    },
    cashDiscount: {
      enabled: true,
      type: 'fixed',
      value: 5.00
    }
  },
  {
    id: 'water10',
    name: 'Água Mineral Galão 10L',
    price: 14.00,
    category: 'Água Mineral',
    unit: '10L',
    brand: 'Fonte Natural',
    image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=600&auto=format&fit=crop&q=80',
    description: 'Galão de 10 litros de água mineral, mais leve e prático para transportar e manusear em cozinhas, quartos e escritórios.',
    isActive: true,
    pixDiscount: {
      enabled: true,
      type: 'fixed',
      value: 2.00
    },
    cashDiscount: {
      enabled: true,
      type: 'fixed',
      value: 2.00
    }
  },
  {
    id: 'kit_gas',
    name: 'Kit Regulador de Gás c/ Mangueira e Abraçadeiras (INMETRO)',
    price: 65.00,
    category: 'Acessórios & Kits',
    unit: '1 Kit',
    brand: 'Normatizado INMETRO',
    image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80',
    description: 'Kit completo certificado com registro regulador de baixa pressão (2,8 kPa), mangueira amarela normatizada de 1,25m e 2 abraçadeiras de aperto seguro.',
    isActive: true,
    pixDiscount: {
      enabled: true,
      type: 'fixed',
      value: 5.00
    },
    cashDiscount: {
      enabled: true,
      type: 'fixed',
      value: 5.00
    }
  },
  {
    id: 'bomba_usb',
    name: 'Bomba Elétrica USB para Galão de Água 20L',
    price: 38.00,
    category: 'Acessórios & Kits',
    unit: '1 un',
    brand: 'Universal',
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80',
    description: 'Dispensador automático elétrico com acionamento por botão touch, bateria interna recarregável via USB e haste de sucção em inox.',
    isActive: true,
    pixDiscount: {
      enabled: true,
      type: 'fixed',
      value: 3.00
    },
    cashDiscount: {
      enabled: true,
      type: 'fixed',
      value: 3.00
    }
  },
  {
    id: 'suporte_agua',
    name: 'Suporte com Torneira para Galão 20L',
    price: 28.00,
    category: 'Acessórios & Kits',
    unit: '1 un',
    brand: 'Universal',
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80',
    description: 'Suporte de mesa em aço reforçado com bica/torneira de alto fluxo, excelente para balcões e mesas sem precisar de bebedouro elétrico.',
    isActive: true,
    pixDiscount: {
      enabled: true,
      type: 'fixed',
      value: 3.00
    },
    cashDiscount: {
      enabled: true,
      type: 'fixed',
      value: 3.00
    }
  }
];

/** Preço 0 = ainda não definido pelo gestor. Não usar os valores antigos de demonstração. */
function semPrecoDefinido(p: Product): Product {
  return {
    ...p,
    price: 0,
    pixDiscount: { enabled: false, type: 'fixed', value: 0 },
    cashDiscount: { enabled: false, type: 'fixed', value: 0 },
  };
}

export const PRODUCT_PRESETS: Product[] = RAW_PRODUCT_PRESETS.map(semPrecoDefinido);

export const PRODUCTS: Product[] = ['p13', 'p20', 'p45']
  .map((id) => PRODUCT_PRESETS.find((p) => p.id === id))
  .filter((p): p is Product => Boolean(p));

export function isPriceDefined(price: number | null | undefined): boolean {
  return typeof price === 'number' && Number.isFinite(price) && price > 0;
}

export function formatProductPrice(price: number | null | undefined): string {
  if (!isPriceDefined(price)) return 'Definir preço';
  return `R$ ${Number(price).toFixed(2)}`;
}

/**
 * Calcula o preço efetivo considerando a forma de pagamento e descontos cadastrados
 */
export function calculateEffectivePrice(product: Product, paymentMethod?: string): number {
  if (!product) return 0;
  const base = Number(product.price) || 0;
  const method = (paymentMethod || '').toLowerCase();

  // Desconto PIX
  if (method.includes('pix') && product.pixDiscount?.enabled && product.pixDiscount.value > 0) {
    if (product.pixDiscount.type === 'percentage') {
      const discount = (base * product.pixDiscount.value) / 100;
      return Math.max(0, Math.round((base - discount) * 100) / 100);
    }
    return Math.max(0, Math.round((base - product.pixDiscount.value) * 100) / 100);
  }

  // Desconto Dinheiro
  if (method.includes('dinheiro') && product.cashDiscount?.enabled && product.cashDiscount.value > 0) {
    if (product.cashDiscount.type === 'percentage') {
      const discount = (base * product.cashDiscount.value) / 100;
      return Math.max(0, Math.round((base - discount) * 100) / 100);
    }
    return Math.max(0, Math.round((base - product.cashDiscount.value) * 100) / 100);
  }

  return base;
}

/**
 * Retorna o valor em R$ do desconto concedido para a forma de pagamento
 */
export function getProductDiscountAmount(product: Product, paymentMethod?: string): number {
  if (!product) return 0;
  const base = Number(product.price) || 0;
  const effective = calculateEffectivePrice(product, paymentMethod);
  return Math.max(0, Math.round((base - effective) * 100) / 100);
}

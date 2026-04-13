import { Product } from './types';

export const PRODUCTS: Product[] = [
  {
    id: 'p13',
    name: 'Gás P13 (Residencial)',
    price: 115.00,
    image: 'https://picsum.photos/seed/gas13/400/400',
    description: 'O botijão de gás mais comum para uso doméstico.'
  },
  {
    id: 'p45',
    name: 'Gás P45 (Industrial)',
    price: 450.00,
    image: 'https://picsum.photos/seed/gas45/400/400',
    description: 'Ideal para comércios e indústrias com alto consumo.'
  },
  {
    id: 'water20',
    name: 'Água Mineral 20L',
    price: 18.00,
    image: 'https://picsum.photos/seed/water20/400/400',
    description: 'Galão de 20 litros de água mineral cristalina.'
  }
];

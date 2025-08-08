// src/lib/cart.ts
export type CartItem = { sku: string; name: string; price_cents: number; qty: number };
const KEY = 'cart_v1';

export function getCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

export function saveCart(items: CartItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function addToCart(item: Omit<CartItem, 'qty'>, qty = 1) {
  const cart = getCart();
  const idx = cart.findIndex(i => i.sku === item.sku);
  if (idx >= 0) cart[idx].qty += qty;
  else cart.push({ ...item, qty });
  saveCart(cart);
}

export function setQty(sku: string, qty: number) {
  const cart = getCart().map(i => i.sku === sku ? { ...i, qty } : i).filter(i => i.qty > 0);
  saveCart(cart);
}

export function removeItem(sku: string) {
  saveCart(getCart().filter(i => i.sku !== sku));
}

export function clearCart() { saveCart([]); }

export function totalCents(items: CartItem[]) {
  return items.reduce((s, i) => s + i.price_cents * i.qty, 0);
}

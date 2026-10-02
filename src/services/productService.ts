import { supabase } from '../lib/supabase';
import { Product } from '../types';
import { PRODUCT_PRESETS } from '../constants';

const STORAGE_KEY = 'gas_app_products';
const SYNC_CHANNEL_NAME = 'gas_app_sync_channel';

export const productService = {
  /**
   * Obtém a lista de produtos (Supabase com fallback imediato no LocalStorage)
   */
  async getProducts(): Promise<Product[]> {
    // 1. Tentar ler do Supabase com timeout rápido para não travar
    try {
      const fetchPromise = supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });

      const timeoutPromise = new Promise<{ data: null; error: any }>((res) => 
        setTimeout(() => res({ data: null, error: { message: 'timeout' } }), 1200)
      );

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

      if (!error && Array.isArray(data) && data.length > 0) {
        const mapped: Product[] = data.map(this.mapFromDb);
        // Atualiza cache local
        this.saveToLocalCache(mapped, false);
        return mapped;
      }
    } catch (err) {
      console.warn('Fallback offline para produtos:', err);
    }

    // 2. Se falhar ou estiver vazio, ler do LocalStorage
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}

    // 3. Se ainda não houver nada, inicializa com os modelos pré-definidos do catálogo brasileiro
    const initialList = PRODUCT_PRESETS.slice(0, 6);
    this.saveToLocalCache(initialList, false);
    return initialList;
  },

  /**
   * Salva a lista completa de produtos (LocalStorage + BroadcastChannel + Supabase em background)
   */
  async saveProducts(products: Product[]): Promise<void> {
    // 1. Salva imediatamente no LocalStorage e notifica abas conectadas
    this.saveToLocalCache(products, true);

    // 2. Persistir no Supabase em segundo plano de forma não-bloqueante
    (async () => {
      try {
        const dbRows = products.map(p => this.mapToDb(p));
        const { error } = await supabase.from('products').upsert(dbRows);
        if (error) {
          console.warn('Supabase: tabela "products" ainda não criada ou sincronização pendente:', error.message);
        }
      } catch (err) {
        console.warn('Supabase offline ou tabela inexistente:', err);
      }
    })();
  },

  /**
   * Atualização rápida apenas do valor e descontos de um produto (usado por Gestor e Entregador)
   */
  async updateProductPrice(
    productId: string,
    newPrice: number,
    pixDiscountValue?: number,
    cashDiscountValue?: number,
    pixType?: 'fixed' | 'percentage',
    cashType?: 'fixed' | 'percentage'
  ): Promise<Product[]> {
    const currentProducts = await this.getProducts();
    const updated = currentProducts.map(p => {
      if (p.id !== productId) return p;
      return {
        ...p,
        price: Number(newPrice),
        pixDiscount: pixDiscountValue !== undefined ? {
          enabled: pixDiscountValue > 0,
          type: pixType || p.pixDiscount?.type || 'fixed',
          value: Number(pixDiscountValue)
        } : p.pixDiscount,
        cashDiscount: cashDiscountValue !== undefined ? {
          enabled: cashDiscountValue > 0,
          type: cashType || p.cashDiscount?.type || 'fixed',
          value: Number(cashDiscountValue)
        } : p.cashDiscount,
        updatedAt: new Date().toISOString()
      };
    });

    await this.saveProducts(updated);
    return updated;
  },

  /**
   * Adiciona ou atualiza um produto
   */
  async upsertProduct(product: Product): Promise<Product[]> {
    const currentProducts = await this.getProducts();
    const existingIndex = currentProducts.findIndex(p => p.id === product.id);
    let updated: Product[];

    const productWithDate: Product = {
      ...product,
      updatedAt: new Date().toISOString(),
      createdAt: product.createdAt || new Date().toISOString()
    };

    if (existingIndex >= 0) {
      updated = [...currentProducts];
      updated[existingIndex] = productWithDate;
    } else {
      updated = [productWithDate, ...currentProducts];
    }

    await this.saveProducts(updated);
    return updated;
  },

  /**
   * Remove um produto
   */
  async deleteProduct(productId: string): Promise<Product[]> {
    const currentProducts = await this.getProducts();
    const updated = currentProducts.filter(p => p.id !== productId);
    await this.saveProducts(updated);

    try {
      await supabase.from('products').delete().eq('id', productId);
    } catch {}

    return updated;
  },

  /**
   * Salva no LocalStorage e dispara evento BroadcastChannel para sincronizar entre abas
   */
  saveToLocalCache(products: Product[], broadcast: boolean = true) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
      if (broadcast) {
        try {
          const ch = new BroadcastChannel(SYNC_CHANNEL_NAME);
          ch.postMessage({ type: 'SYNC_PRODUCTS', products });
          ch.close();
        } catch {}

        try {
          const event = new CustomEvent('gas_app_products_updated', { detail: products });
          window.dispatchEvent(event);
        } catch {}
      }
    } catch (err) {
      console.warn('Erro ao salvar produtos no LocalStorage:', err);
    }
  },

  mapFromDb(row: any): Product {
    return {
      id: row.id,
      name: row.name,
      price: Number(row.price) || 0,
      image: row.image || '',
      description: row.description || '',
      category: row.category || 'Gás GLP',
      unit: row.unit || '',
      brand: row.brand || '',
      isActive: row.is_active !== false,
      pixDiscount: row.pix_discount || { enabled: false, type: 'fixed', value: 0 },
      cashDiscount: row.cash_discount || { enabled: false, type: 'fixed', value: 0 },
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  },

  mapToDb(p: Product): any {
    return {
      id: p.id,
      name: p.name,
      price: p.price,
      image: p.image,
      description: p.description,
      category: p.category || 'Gás GLP',
      unit: p.unit || '',
      brand: p.brand || '',
      is_active: p.isActive !== false,
      pix_discount: p.pixDiscount || null,
      cash_discount: p.cashDiscount || null,
      updated_at: new Date().toISOString()
    };
  }
};

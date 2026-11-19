import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, DollarSign, Zap, Banknote, Edit2, AlertCircle } from 'lucide-react';
import { Product } from '../../types';
import { calculateEffectivePrice, getProductDiscountAmount } from '../../constants';

interface QuickPriceEditModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSavePrice: (productId: string, newPrice: number, pixDiscountValue?: number, cashDiscountValue?: number, pixType?: 'fixed' | 'percentage', cashType?: 'fixed' | 'percentage') => Promise<void> | void;
  onOpenFullEdit?: (product: Product) => void;
  userRole?: string;
}

export const QuickPriceEditModal: React.FC<QuickPriceEditModalProps> = ({
  product,
  isOpen,
  onClose,
  onSavePrice,
  onOpenFullEdit,
  userRole = 'gestor'
}) => {
  const [priceStr, setPriceStr] = useState<string>('');
  const [pixDiscountEnabled, setPixDiscountEnabled] = useState<boolean>(true);
  const [pixDiscountType, setPixDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [pixDiscountValueStr, setPixDiscountValueStr] = useState<string>('');

  const [cashDiscountEnabled, setCashDiscountEnabled] = useState<boolean>(true);
  const [cashDiscountType, setCashDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [cashDiscountValueStr, setCashDiscountValueStr] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setPriceStr(product.price ? product.price.toFixed(2) : '0.00');
      
      const hasPix = product.pixDiscount?.enabled ?? false;
      setPixDiscountEnabled(hasPix);
      setPixDiscountType(product.pixDiscount?.type || 'fixed');
      setPixDiscountValueStr(product.pixDiscount?.value !== undefined ? String(product.pixDiscount.value) : '0');

      const hasCash = product.cashDiscount?.enabled ?? false;
      setCashDiscountEnabled(hasCash);
      setCashDiscountType(product.cashDiscount?.type || 'fixed');
      setCashDiscountValueStr(product.cashDiscount?.value !== undefined ? String(product.cashDiscount.value) : '0');

      setError(null);
      setSavedSuccess(false);
    }
  }, [product, isOpen]);

  if (!isOpen || !product) return null;

  const currentNumericPrice = parseFloat(priceStr.replace(',', '.')) || 0;
  const pixVal = parseFloat(pixDiscountValueStr.replace(',', '.')) || 0;
  const cashVal = parseFloat(cashDiscountValueStr.replace(',', '.')) || 0;

  // Cálculos em tempo real dos preços com desconto
  const calcPixPrice = () => {
    if (!pixDiscountEnabled || pixVal <= 0) return currentNumericPrice;
    if (pixDiscountType === 'percentage') {
      return Math.max(0, currentNumericPrice - (currentNumericPrice * pixVal / 100));
    }
    return Math.max(0, currentNumericPrice - pixVal);
  };

  const calcCashPrice = () => {
    if (!cashDiscountEnabled || cashVal <= 0) return currentNumericPrice;
    if (cashDiscountType === 'percentage') {
      return Math.max(0, currentNumericPrice - (currentNumericPrice * cashVal / 100));
    }
    return Math.max(0, currentNumericPrice - cashVal);
  };

  const handleAdjustPrice = (delta: number) => {
    const next = Math.max(0, currentNumericPrice + delta);
    setPriceStr(next.toFixed(2));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentNumericPrice <= 0) {
      setError('O valor do produto deve ser maior que zero.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onSavePrice(
        product.id,
        currentNumericPrice,
        pixDiscountEnabled ? pixVal : 0,
        cashDiscountEnabled ? cashVal : 0,
        pixDiscountType,
        cashDiscountType
      );
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar novo valor.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Cabeçalho */}
          <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl overflow-hidden bg-slate-800 border border-slate-700 shrink-0">
                <img
                  src={product.image || 'https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=600&auto=format&fit=crop&q=80'}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  onError={(e: any) => {
                    e.target.src = 'https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=600&auto=format&fit=crop&q=80';
                  }}
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-black tracking-wider bg-yellow-400 text-slate-950 px-2 py-0.5 rounded-full">
                    {product.category || 'Gás & Água'}
                  </span>
                  {userRole === 'entregador' && (
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      Entregador
                    </span>
                  )}
                </div>
                <h3 className="text-base font-black text-white truncate max-w-[260px] sm:max-w-xs mt-0.5">
                  {product.name}
                </h3>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Formulário de Edição de Preço */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {savedSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center justify-center gap-2 animate-bounce">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Valor atualizado com sucesso!</span>
              </div>
            )}

            {/* Preço Base (Padrão / Cartão) */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <label className="block text-xs font-black uppercase text-slate-600 mb-1.5 flex items-center justify-between">
                <span>Preço Padrão (Cartão / Base)</span>
                <span className="text-[10px] text-slate-400 font-bold">Valor cheiro</span>
              </label>

              <div className="relative mb-3">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-black text-xl">
                  R$
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={priceStr}
                  onChange={(e) => setPriceStr(e.target.value)}
                  className="w-full pl-14 pr-4 py-3.5 bg-white border-2 border-slate-300 focus:border-yellow-400 rounded-2xl text-2xl font-black text-slate-900 outline-none transition-all shadow-sm"
                  placeholder="0.00"
                />
              </div>

              {/* Botões rápidos de ajuste (+ / -) */}
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => handleAdjustPrice(-5)}
                  className="py-1.5 px-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs"
                >
                  - R$ 5
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustPrice(-1)}
                  className="py-1.5 px-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs"
                >
                  - R$ 1
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustPrice(1)}
                  className="py-1.5 px-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs"
                >
                  + R$ 1
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustPrice(5)}
                  className="py-1.5 px-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs"
                >
                  + R$ 5
                </button>
              </div>
            </div>

            {/* Seção Desconto PIX */}
            <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-500 text-white rounded-lg">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">Desconto no PIX</h4>
                    <p className="text-[10px] text-slate-500 font-medium">Incentive o pagamento à vista via PIX</p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pixDiscountEnabled}
                    onChange={(e) => setPixDiscountEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              {pixDiscountEnabled && (
                <div className="space-y-3 pt-1 border-t border-emerald-100">
                  <div className="flex gap-2">
                    <div className="flex bg-white rounded-xl border border-emerald-200 p-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPixDiscountType('fixed')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                          pixDiscountType === 'fixed'
                            ? 'bg-emerald-500 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        R$ Fixo
                      </button>
                      <button
                        type="button"
                        onClick={() => setPixDiscountType('percentage')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                          pixDiscountType === 'percentage'
                            ? 'bg-emerald-500 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        % Porcentagem
                      </button>
                    </div>

                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                        {pixDiscountType === 'fixed' ? 'R$' : '%'}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={pixDiscountValueStr}
                        onChange={(e) => setPixDiscountValueStr(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 bg-white border border-emerald-300 focus:border-emerald-500 rounded-xl text-sm font-bold text-slate-900 outline-none"
                        placeholder={pixDiscountType === 'fixed' ? '10.00' : '10'}
                      />
                    </div>
                  </div>

                  {/* Prévia do Preço no Pix */}
                  <div className="flex items-center justify-between bg-white/80 px-3 py-2 rounded-xl border border-emerald-100">
                    <span className="text-xs font-bold text-slate-600">Preço final no PIX:</span>
                    <div className="text-right">
                      <span className="text-sm font-black text-emerald-600">
                        R$ {calcPixPrice().toFixed(2)}
                      </span>
                      {currentNumericPrice > calcPixPrice() && (
                        <span className="text-[10px] text-emerald-700 font-bold ml-1.5">
                          (-R$ {(currentNumericPrice - calcPixPrice()).toFixed(2)})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Seção Desconto DINHEIRO */}
            <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-500 text-white rounded-lg">
                    <Banknote className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">Desconto em Dinheiro</h4>
                    <p className="text-[10px] text-slate-500 font-medium">Pagamento em espécie na entrega</p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cashDiscountEnabled}
                    onChange={(e) => setCashDiscountEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {cashDiscountEnabled && (
                <div className="space-y-3 pt-1 border-t border-amber-100">
                  <div className="flex gap-2">
                    <div className="flex bg-white rounded-xl border border-amber-200 p-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setCashDiscountType('fixed')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                          cashDiscountType === 'fixed'
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        R$ Fixo
                      </button>
                      <button
                        type="button"
                        onClick={() => setCashDiscountType('percentage')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                          cashDiscountType === 'percentage'
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        % Porcentagem
                      </button>
                    </div>

                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                        {cashDiscountType === 'fixed' ? 'R$' : '%'}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={cashDiscountValueStr}
                        onChange={(e) => setCashDiscountValueStr(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 bg-white border border-amber-300 focus:border-amber-500 rounded-xl text-sm font-bold text-slate-900 outline-none"
                        placeholder={cashDiscountType === 'fixed' ? '10.00' : '10'}
                      />
                    </div>
                  </div>

                  {/* Prévia do Preço em Dinheiro */}
                  <div className="flex items-center justify-between bg-white/80 px-3 py-2 rounded-xl border border-amber-100">
                    <span className="text-xs font-bold text-slate-600">Preço final em Dinheiro:</span>
                    <div className="text-right">
                      <span className="text-sm font-black text-amber-600">
                        R$ {calcCashPrice().toFixed(2)}
                      </span>
                      {currentNumericPrice > calcCashPrice() && (
                        <span className="text-[10px] text-amber-700 font-bold ml-1.5">
                          (-R$ {(currentNumericPrice - calcCashPrice()).toFixed(2)})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Ações do Rodapé */}
            <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-100">
              {userRole === 'gestor' && onOpenFullEdit ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenFullEdit(product);
                  }}
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors py-2 px-1"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Editar Cadastro Completo</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-slate-950 font-black text-xs transition-all flex items-center gap-2 shadow-md shadow-yellow-400/20 disabled:opacity-50"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Salvar Preço</span>
                </button>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

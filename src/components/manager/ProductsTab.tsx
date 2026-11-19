import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Package, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Check, 
  X, 
  DollarSign, 
  Zap, 
  Banknote, 
  Sparkles, 
  Image as ImageIcon, 
  Layers, 
  Tag, 
  AlertCircle,
  Eye,
  EyeOff,
  Filter,
  CheckCircle2,
  Upload,
  ArrowRight
} from 'lucide-react';
import { Product } from '../../types';
import { PRODUCT_CATEGORIES, PRODUCT_PRESETS, calculateEffectivePrice, DEFAULT_PRODUCT_IMAGES, formatProductPrice } from '../../constants';
import { QuickPriceEditModal } from './QuickPriceEditModal';

interface ProductsTabProps {
  products: Product[];
  onAddProduct: (product: Product) => Promise<void> | void;
  onUpdateProduct: (product: Product) => Promise<void> | void;
  onDeleteProduct: (productId: string) => Promise<void> | void;
  onUpdateProductPrice: (
    productId: string, 
    newPrice: number, 
    pixDiscountValue?: number, 
    cashDiscountValue?: number,
    pixType?: 'fixed' | 'percentage',
    cashType?: 'fixed' | 'percentage'
  ) => Promise<void> | void;
}

export const ProductsTab: React.FC<ProductsTabProps> = ({
  products,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onUpdateProductPrice
}) => {
  // Filtros e busca
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modais
  const [isQuickEditOpen, setIsQuickEditOpen] = useState(false);
  const [quickEditProduct, setQuickEditProduct] = useState<Product | null>(null);

  const [isFullModalOpen, setIsFullModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [isPresetsDrawerOpen, setIsPresetsDrawerOpen] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Formulário completo de criação/edição
  const [formData, setFormData] = useState<{
    id: string;
    name: string;
    category: string;
    unit: string;
    brand: string;
    price: string;
    image: string;
    description: string;
    isActive: boolean;
    pixDiscountEnabled: boolean;
    pixDiscountType: 'fixed' | 'percentage';
    pixDiscountValue: string;
    cashDiscountEnabled: boolean;
    cashDiscountType: 'fixed' | 'percentage';
    cashDiscountValue: string;
  }>({
    id: '',
    name: '',
    category: 'Gás GLP',
    unit: '13kg',
    brand: '',
    price: '',
    image: '',
    description: '',
    isActive: true,
    pixDiscountEnabled: true,
    pixDiscountType: 'fixed',
    pixDiscountValue: '10.00',
    cashDiscountEnabled: true,
    cashDiscountType: 'fixed',
    cashDiscountValue: '10.00'
  });

  // Abrir modal de criação completa do zero
  const handleOpenCreateModal = () => {
    setEditingProduct(null);
    setFormData({
      id: 'prod-' + Math.random().toString(36).substr(2, 8),
      name: '',
      category: 'Gás GLP',
      unit: '13kg',
      brand: 'Porto Gás',
      price: '',
      image: DEFAULT_PRODUCT_IMAGES.p13,
      description: '',
      isActive: true,
      pixDiscountEnabled: true,
      pixDiscountType: 'fixed',
      pixDiscountValue: '10.00',
      cashDiscountEnabled: true,
      cashDiscountType: 'fixed',
      cashDiscountValue: '10.00'
    });
    setIsFullModalOpen(true);
  };

  // Abrir modal de edição completa
  const handleOpenEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      id: p.id,
      name: p.name,
      category: p.category || 'Gás GLP',
      unit: p.unit || '',
      brand: p.brand || '',
      price: p.price ? p.price.toFixed(2) : '0.00',
      image: p.image || '',
      description: p.description || '',
      isActive: p.isActive !== false,
      pixDiscountEnabled: p.pixDiscount?.enabled ?? false,
      pixDiscountType: p.pixDiscount?.type || 'fixed',
      pixDiscountValue: p.pixDiscount?.value !== undefined ? String(p.pixDiscount.value) : '0',
      cashDiscountEnabled: p.cashDiscount?.enabled ?? false,
      cashDiscountType: p.cashDiscount?.type || 'fixed',
      cashDiscountValue: p.cashDiscount?.value !== undefined ? String(p.cashDiscount.value) : '0'
    });
    setIsFullModalOpen(true);
  };

  // Abrir edição rápida ao clicar no valor ou no produto
  const handleOpenQuickEdit = (p: Product) => {
    setQuickEditProduct(p);
    setIsQuickEditOpen(true);
  };

  // Fechar modal completo e limpar estado de edição
  const handleCloseFullModal = () => {
    setIsFullModalOpen(false);
    setEditingProduct(null);
  };

  // Estado de salvamento em andamento
  const [isSaving, setIsSaving] = useState(false);

  // Submissão do formulário completo
  const handleSaveFullForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPrice = String(formData.price || '').replace(',', '.').trim();
    const numPrice = parseFloat(cleanPrice) || 0;
    if (numPrice <= 0) {
      alert('Informe um valor de preço válido (maior que zero).');
      return;
    }

    const cleanPix = String(formData.pixDiscountValue || '').replace(',', '.').trim();
    const pixVal = parseFloat(cleanPix) || 0;

    const cleanCash = String(formData.cashDiscountValue || '').replace(',', '.').trim();
    const cashVal = parseFloat(cleanCash) || 0;

    const prodId = editingProduct ? editingProduct.id : (formData.id || 'prod-' + Math.random().toString(36).substr(2, 8));

    const newProduct: Product = {
      id: prodId,
      name: formData.name.trim(),
      category: formData.category,
      unit: formData.unit.trim(),
      brand: formData.brand.trim(),
      price: numPrice,
      image: formData.image.trim() || DEFAULT_PRODUCT_IMAGES.p13,
      description: formData.description.trim(),
      isActive: formData.isActive,
      pixDiscount: {
        enabled: formData.pixDiscountEnabled,
        type: formData.pixDiscountType,
        value: formData.pixDiscountEnabled ? pixVal : 0
      },
      cashDiscount: {
        enabled: formData.cashDiscountEnabled,
        type: formData.cashDiscountType,
        value: formData.cashDiscountEnabled ? cashVal : 0
      },
      updatedAt: new Date().toISOString()
    };

    try {
      setIsSaving(true);
      if (editingProduct) {
        await onUpdateProduct(newProduct);
        showToast(`Produto "${newProduct.name}" atualizado com sucesso!`);
      } else {
        await onAddProduct(newProduct);
        showToast(`Produto "${newProduct.name}" cadastrado com sucesso!`);
      }
      handleCloseFullModal();
    } catch (err: any) {
      console.error('Erro ao salvar produto:', err);
      alert('Ocorreu um erro ao salvar o produto: ' + (err?.message || 'Tente novamente'));
    } finally {
      setIsSaving(false);
    }
  };

  // Alternar status ativo/inativo
  const handleToggleStatus = async (p: Product) => {
    const updated: Product = {
      ...p,
      isActive: !(p.isActive !== false)
    };
    await onUpdateProduct(updated);
    showToast(`Produto ${updated.isActive ? 'ativado' : 'desativado'} para vendas.`);
  };

  // Adicionar modelo sugerido
  const handleImportPreset = async (preset: Product) => {
    const alreadyExists = products.some(p => p.id === preset.id || p.name.toLowerCase() === preset.name.toLowerCase());
    const id = alreadyExists ? `prod-${Date.now().toString(36)}` : preset.id;

    const toAdd: Product = {
      ...preset,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await onAddProduct(toAdd);
    showToast(`"${preset.name}" adicionado ao seu catálogo!`);
  };

  // Upload local de foto para Data URL
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('A imagem é maior que 2MB. Escolha uma imagem menor para melhor desempenho.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setFormData(prev => ({ ...prev, image: reader.result as string }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Filtragem de produtos
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q || 
        p.name.toLowerCase().includes(q) || 
        (p.description || '').toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q) ||
        (p.unit || '').toLowerCase().includes(q);

      const matchCategory = selectedCategory === 'Todos' || p.category === selectedCategory;

      const matchStatus = 
        statusFilter === 'all' || 
        (statusFilter === 'active' && p.isActive !== false) ||
        (statusFilter === 'inactive' && p.isActive === false);

      return matchQuery && matchCategory && matchStatus;
    });
  }, [products, searchQuery, selectedCategory, statusFilter]);

  // Estatísticas do catálogo
  const stats = useMemo(() => {
    const total = products.length;
    const active = products.filter(p => p.isActive !== false).length;
    const withPixDisc = products.filter(p => p.pixDiscount?.enabled && p.pixDiscount.value > 0);
    const avgPixDisc = withPixDisc.length > 0 
      ? withPixDisc.reduce((acc, p) => acc + (p.pixDiscount?.type === 'fixed' ? p.pixDiscount.value : (p.price * (p.pixDiscount?.value || 0) / 100)), 0) / withPixDisc.length
      : 0;

    return { total, active, avgPixDisc };
  }, [products]);

  // Pré-visualização de cálculo no form completo
  const formBasePrice = parseFloat(formData.price.replace(',', '.')) || 0;
  const formPixVal = parseFloat(formData.pixDiscountValue.replace(',', '.')) || 0;
  const formCashVal = parseFloat(formData.cashDiscountValue.replace(',', '.')) || 0;

  const formPixPreview = () => {
    if (!formData.pixDiscountEnabled || formPixVal <= 0) return formBasePrice;
    if (formData.pixDiscountType === 'percentage') {
      return Math.max(0, formBasePrice - (formBasePrice * formPixVal / 100));
    }
    return Math.max(0, formBasePrice - formPixVal);
  };

  const formCashPreview = () => {
    if (!formData.cashDiscountEnabled || formCashVal <= 0) return formBasePrice;
    if (formData.cashDiscountType === 'percentage') {
      return Math.max(0, formBasePrice - (formBasePrice * formCashVal / 100));
    }
    return Math.max(0, formBasePrice - formCashVal);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-[10000] bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 text-xs font-bold"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cabeçalho da Aba */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-yellow-400/10 rounded-xl text-yellow-500">
              <Package className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black text-slate-900">Catálogo de Produtos</h1>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm font-medium">
            Gerencie itens, fotos, valores de venda e regras de desconto para pagamentos via <strong>PIX</strong> e <strong>Dinheiro</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setIsPresetsDrawerOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-black text-xs border border-amber-200/80 transition-all cursor-pointer shadow-xs active:scale-95"
            title="Ver catálogo padrão de distribuidoras brasileiras"
          >
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>Modelos Sugeridos</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-yellow-400 font-black text-xs transition-all cursor-pointer shadow-md shadow-slate-900/10 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Produto</span>
          </button>
        </div>
      </div>

      {/* Cards de Métricas do Catálogo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
            Total Cadastrado
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{stats.total}</span>
            <span className="text-xs font-bold text-slate-400">itens</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
            Ativos para Venda
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600">{stats.active}</span>
            <span className="text-xs font-bold text-emerald-700/80">disponíveis</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
            Média Desc. PIX
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-yellow-500">
              R$ {stats.avgPixDisc.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
            Edição Rápida
          </span>
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mt-1">
            <Edit2 className="w-3.5 h-3.5 text-yellow-500" />
            <span>Toque no valor</span>
          </div>
        </div>
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Campo de Busca */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome, marca ou descrição..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-yellow-400 outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filtro de Status */}
          <div className="flex bg-slate-100 p-1 rounded-2xl shrink-0">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                statusFilter === 'active'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Ativos
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                statusFilter === 'inactive'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Inativos
            </button>
          </div>
        </div>

        {/* Chips de Categoria */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('Todos')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              selectedCategory === 'Todos'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todas Categorias ({products.length})
          </button>
          {PRODUCT_CATEGORIES.map(cat => {
            const count = products.filter(p => p.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid de Produtos */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center space-y-4">
          <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto text-slate-400">
            <Package className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-800">Nenhum produto encontrado</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Não encontramos produtos com os filtros selecionados. Limpe os filtros ou adicione novos produtos do catálogo sugerido.
            </p>
          </div>
          <div className="flex justify-center gap-2 pt-2">
            <button
              onClick={() => { setSearchQuery(''); setSelectedCategory('Todos'); setStatusFilter('all'); }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
            >
              Limpar Filtros
            </button>
            <button
              onClick={() => setIsPresetsDrawerOpen(true)}
              className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-slate-950 rounded-xl text-xs font-black shadow-xs"
            >
              Usar Modelos Prontos
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((p) => {
            const pixEffective = calculateEffectivePrice(p, 'Pix');
            const cashEffective = calculateEffectivePrice(p, 'Dinheiro');
            const pixSavings = (p.price || 0) - pixEffective;
            const cashSavings = (p.price || 0) - cashEffective;

            return (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`bg-white rounded-3xl border transition-all overflow-hidden flex flex-col justify-between group ${
                  p.isActive === false
                    ? 'border-slate-200 opacity-60 bg-slate-50/50'
                    : 'border-slate-200/80 hover:border-yellow-400/80 hover:shadow-lg hover:shadow-yellow-400/5'
                }`}
              >
                <div>
                  {/* Imagem do Produto + Badges */}
                  <div className="relative h-44 bg-slate-100 overflow-hidden">
                    <img
                      src={p.image || DEFAULT_PRODUCT_IMAGES.p13}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e: any) => {
                        e.target.src = DEFAULT_PRODUCT_IMAGES.p13;
                      }}
                    />

                    {/* Gradiente sutil */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent pointer-events-none" />

                    {/* Categoria Badge */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      <span className="bg-slate-900/85 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border border-slate-700/50">
                        {p.category || 'Gás & Água'}
                      </span>
                      {p.unit && (
                        <span className="bg-yellow-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs">
                          {p.unit}
                        </span>
                      )}
                    </div>

                    {/* Status Badge */}
                    <div className="absolute top-3 right-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleStatus(p);
                        }}
                        className={`px-2 py-1 rounded-xl text-[10px] font-black uppercase tracking-tight flex items-center gap-1 shadow-sm transition-all ${
                          p.isActive !== false
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                        title={p.isActive !== false ? 'Clique para desativar' : 'Clique para ativar'}
                      >
                        {p.isActive !== false ? (
                          <>
                            <Eye className="w-3 h-3" />
                            <span>Ativo</span>
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3 h-3" />
                            <span>Inativo</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Marca do Produto (se houver) */}
                    {p.brand && (
                      <div className="absolute bottom-2 left-3">
                        <span className="text-[10px] text-white/90 font-bold bg-slate-950/70 px-2 py-0.5 rounded-md backdrop-blur-xs">
                          {p.brand}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Informações Textuais */}
                  <div className="p-5 space-y-3">
                    <div>
                      <h3 className="font-black text-slate-900 text-base leading-tight group-hover:text-yellow-600 transition-colors">
                        {p.name}
                      </h3>
                      {p.description && (
                        <p className="text-xs text-slate-500 font-medium line-clamp-2 mt-1 leading-relaxed">
                          {p.description}
                        </p>
                      )}
                    </div>

                    {/* Bloco de Preço Clicável para Edição Rápida */}
                    <div 
                      onClick={() => handleOpenQuickEdit(p)}
                      className="p-3 bg-slate-50 hover:bg-yellow-50/70 border border-slate-200 hover:border-yellow-300 rounded-2xl cursor-pointer transition-all space-y-2 group/price"
                      title="Clique no valor para editar o preço"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-slate-400 group-hover/price:text-yellow-700">
                          Preço Base (Cartão)
                        </span>
                        <span className="text-[10px] font-bold text-yellow-600 flex items-center gap-1 opacity-0 group-hover/price:opacity-100 transition-opacity">
                          <Edit2 className="w-3 h-3" /> Editar valor
                        </span>
                      </div>

                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-slate-900 group-hover/price:text-yellow-600">
                          {formatProductPrice(p.price)}
                        </span>
                        <span className="text-[11px] font-bold text-slate-400">padrão</span>
                      </div>

                      {/* Descontos Cadastrados (PIX e Dinheiro) */}
                      <div className="space-y-1 pt-1.5 border-t border-slate-200/70">
                        {p.pixDiscount?.enabled && p.pixDiscount.value > 0 ? (
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-emerald-700 flex items-center gap-1">
                              <Zap className="w-3 h-3 fill-emerald-600 text-emerald-600" />
                              <span>PIX:</span>
                              <strong>R$ {pixEffective.toFixed(2)}</strong>
                            </span>
                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-100/70 px-1.5 py-0.5 rounded-md">
                              -R$ {pixSavings.toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span className="flex items-center gap-1">
                              <Zap className="w-3 h-3 text-slate-300" /> Sem desconto PIX
                            </span>
                          </div>
                        )}

                        {p.cashDiscount?.enabled && p.cashDiscount.value > 0 ? (
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-amber-700 flex items-center gap-1">
                              <Banknote className="w-3 h-3 text-amber-600" />
                              <span>Dinheiro:</span>
                              <strong>R$ {cashEffective.toFixed(2)}</strong>
                            </span>
                            <span className="text-[10px] font-black text-amber-600 bg-amber-100/70 px-1.5 py-0.5 rounded-md">
                              -R$ {cashSavings.toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span className="flex items-center gap-1">
                              <Banknote className="w-3 h-3 text-slate-300" /> Sem desconto Dinheiro
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rodapé com Ações Rápidas */}
                <div className="px-5 pb-5 pt-2 flex items-center justify-between border-t border-slate-100 gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenQuickEdit(p)}
                    className="flex-1 py-2 px-3 bg-slate-100 hover:bg-yellow-400 hover:text-slate-950 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Ajustar Valor</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(p)}
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all"
                    title="Editar Cadastro Completo"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeletingProductId(p.id)}
                    className="p-2 bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-xl transition-all"
                    title="Excluir Produto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal de Edição Rápida de Preço */}
      <QuickPriceEditModal
        product={quickEditProduct}
        isOpen={isQuickEditOpen}
        onClose={() => {
          setIsQuickEditOpen(false);
          setQuickEditProduct(null);
        }}
        onSavePrice={async (prodId, newPrice, pixVal, cashVal, pixType, cashType) => {
          await onUpdateProductPrice(prodId, newPrice, pixVal, cashVal, pixType, cashType);
          showToast('Preço do produto atualizado com sucesso!');
        }}
        onOpenFullEdit={(p) => handleOpenEditModal(p)}
        userRole="gestor"
      />

      {/* Modal de Cadastro/Edição Completa */}
      <AnimatePresence>
        {isFullModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]"
            >
              {/* Cabeçalho */}
              <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-yellow-400 text-slate-950 rounded-xl">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">
                      {editingProduct ? 'Editar Produto' : 'Cadastrar Novo Produto'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Configure dados, foto, valores e regras de desconto Pix e Dinheiro
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCloseFullModal}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Formulário com Scroll */}
              <form onSubmit={handleSaveFullForm} className="p-6 overflow-y-auto space-y-6 flex-1">
                {/* 1. Informações Básicas */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                    1. Informações Básicas
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nome do Produto *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Ex: Gás de Cozinha P13 (Recarga)"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:border-yellow-400 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Categoria *
                      </label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:border-yellow-400 outline-none"
                      >
                        {PRODUCT_CATEGORIES.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Unidade / Capacidade
                      </label>
                      <input
                        type="text"
                        value={formData.unit}
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                        placeholder="Ex: 13kg, 20L, 45kg, 1 un"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:border-yellow-400 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Marca / Distribuidora
                      </label>
                      <input
                        type="text"
                        value={formData.brand}
                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                        placeholder="Ex: Ultragaz, Liquigás, Nacional, Bonafont..."
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:border-yellow-400 outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-3 pt-6">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.isActive}
                          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                      </label>
                      <span className="text-xs font-bold text-slate-700">
                        {formData.isActive ? 'Disponível para Venda' : 'Produto Pausado (Oculto)'}
                      </span>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Descrição do Produto
                      </label>
                      <textarea
                        rows={2}
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Ex: Recarga padrão com troca do vasilhame vazio. Selo ANP e garantia."
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:border-yellow-400 outline-none resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Foto do Produto */}
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                    2. Foto do Produto
                  </h4>

                  <div className="flex flex-col sm:flex-row gap-4 items-start">
                    {/* Preview da Foto */}
                    <div className="w-24 h-24 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 overflow-hidden shrink-0 flex items-center justify-center relative group">
                      {formData.image ? (
                        <img
                          src={formData.image}
                          alt="Preview"
                          className="w-full h-full object-cover"
                          onError={(e: any) => {
                            e.target.src = DEFAULT_PRODUCT_IMAGES.p13;
                          }}
                        />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-slate-300" />
                      )}
                    </div>

                    <div className="flex-1 space-y-2 w-full">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          URL da Imagem
                        </label>
                        <input
                          type="url"
                          value={formData.image}
                          onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                          placeholder="https://..."
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-yellow-400 outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Enviar Foto do Aparelho</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            className="hidden"
                          />
                        </label>
                      </div>

                      {/* Seletor rápido de fotos padrão */}
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">
                          Fotos Pré-definidas do Sistema:
                        </p>
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                          {Object.entries(DEFAULT_PRODUCT_IMAGES).map(([key, url]) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setFormData({ ...formData, image: url })}
                              className={`w-8 h-8 rounded-lg overflow-hidden border shrink-0 transition-all ${
                                formData.image === url ? 'ring-2 ring-yellow-400 border-yellow-400 scale-105' : 'border-slate-200 opacity-70 hover:opacity-100'
                              }`}
                              title={key}
                            >
                              <img src={url} alt={key} className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Valores e Descontos (PIX e Dinheiro) */}
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                    3. Valores & Descontos (PIX / Dinheiro)
                  </h4>

                  {/* Preço Base */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                      Preço Padrão (Cartão / Base) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-black text-lg">
                        R$
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        required
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value.replace(/[^0-9.,]/g, '') })}
                        placeholder="115.00"
                        className="w-full pl-12 pr-4 py-3 bg-white border border-slate-300 focus:border-yellow-400 rounded-xl text-xl font-black text-slate-900 outline-none"
                      />
                    </div>
                  </div>

                  {/* Configuração de Desconto PIX */}
                  <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-emerald-500 text-white rounded-lg">
                          <Zap className="w-4 h-4" />
                        </div>
                        <div>
                          <h5 className="text-xs font-black text-slate-800 uppercase">Desconto para Pagamento PIX</h5>
                          <p className="text-[10px] text-slate-500 font-medium">Aplicado automaticamente ao escolher PIX</p>
                        </div>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.pixDiscountEnabled}
                          onChange={(e) => setFormData({ ...formData, pixDiscountEnabled: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                      </label>
                    </div>

                    {formData.pixDiscountEnabled && (
                      <div className="space-y-3 pt-2 border-t border-emerald-100">
                        <div className="flex gap-2">
                          <div className="flex bg-white rounded-xl border border-emerald-200 p-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, pixDiscountType: 'fixed' })}
                              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                                formData.pixDiscountType === 'fixed'
                                  ? 'bg-emerald-500 text-white shadow-xs'
                                  : 'text-slate-600'
                              }`}
                            >
                              R$ Fixo
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, pixDiscountType: 'percentage' })}
                              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                                formData.pixDiscountType === 'percentage'
                                  ? 'bg-emerald-500 text-white shadow-xs'
                                  : 'text-slate-600'
                              }`}
                            >
                              % Porcentagem
                            </button>
                          </div>

                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                              {formData.pixDiscountType === 'fixed' ? 'R$' : '%'}
                            </span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={formData.pixDiscountValue}
                              onChange={(e) => setFormData({ ...formData, pixDiscountValue: e.target.value.replace(/[^0-9.,]/g, '') })}
                              placeholder={formData.pixDiscountType === 'fixed' ? '10.00' : '10'}
                              className="w-full pl-8 pr-3 py-2 bg-white border border-emerald-300 focus:border-emerald-500 rounded-xl text-sm font-bold text-slate-900 outline-none"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-emerald-100">
                          <span className="text-xs font-bold text-slate-600">Preço final no PIX:</span>
                          <span className="text-sm font-black text-emerald-600">
                            R$ {formPixPreview().toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Configuração de Desconto DINHEIRO */}
                  <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-amber-500 text-white rounded-lg">
                          <Banknote className="w-4 h-4" />
                        </div>
                        <div>
                          <h5 className="text-xs font-black text-slate-800 uppercase">Desconto para Pagamento em Dinheiro</h5>
                          <p className="text-[10px] text-slate-500 font-medium">Aplicado automaticamente ao escolher Dinheiro na entrega</p>
                        </div>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.cashDiscountEnabled}
                          onChange={(e) => setFormData({ ...formData, cashDiscountEnabled: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                      </label>
                    </div>

                    {formData.cashDiscountEnabled && (
                      <div className="space-y-3 pt-2 border-t border-amber-100">
                        <div className="flex gap-2">
                          <div className="flex bg-white rounded-xl border border-amber-200 p-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, cashDiscountType: 'fixed' })}
                              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                                formData.cashDiscountType === 'fixed'
                                  ? 'bg-amber-500 text-white shadow-xs'
                                  : 'text-slate-600'
                              }`}
                            >
                              R$ Fixo
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, cashDiscountType: 'percentage' })}
                              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                                formData.cashDiscountType === 'percentage'
                                  ? 'bg-amber-500 text-white shadow-xs'
                                  : 'text-slate-600'
                              }`}
                            >
                              % Porcentagem
                            </button>
                          </div>

                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                              {formData.cashDiscountType === 'fixed' ? 'R$' : '%'}
                            </span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={formData.cashDiscountValue}
                              onChange={(e) => setFormData({ ...formData, cashDiscountValue: e.target.value.replace(/[^0-9.,]/g, '') })}
                              placeholder={formData.cashDiscountType === 'fixed' ? '10.00' : '10'}
                              className="w-full pl-8 pr-3 py-2 bg-white border border-amber-300 focus:border-amber-500 rounded-xl text-sm font-bold text-slate-900 outline-none"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-amber-100">
                          <span className="text-xs font-bold text-slate-600">Preço final em Dinheiro:</span>
                          <span className="text-sm font-black text-amber-600">
                            R$ {formCashPreview().toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Rodapé do Modal */}
                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleCloseFullModal}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 active:scale-95 text-slate-950 font-black text-xs transition-all flex items-center gap-2 shadow-md shadow-yellow-400/20 cursor-pointer"
                  >
                    {isSaving ? (
                      <span>Salvando...</span>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>{editingProduct ? 'Salvar Alterações' : 'Cadastrar Produto'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Drawer/Modal de Modelos Prontos do Mercado Brasileiro */}
      <AnimatePresence>
        {isPresetsDrawerOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]"
            >
              {/* Cabeçalho */}
              <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-400 text-slate-950 rounded-xl">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">
                      Modelos Sugeridos do Mercado Brasileiro
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Adicione itens populares com fotos e regras de descontos prontas com apenas 1 clique
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPresetsDrawerOpen(false)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Lista dos 11 Modelos com Ação Rápida */}
              <div className="p-6 overflow-y-auto space-y-3 flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {PRODUCT_PRESETS.map((preset) => {
                    const isAlreadyAdded = products.some(p => p.id === preset.id || p.name.toLowerCase() === preset.name.toLowerCase());
                    const pixEffective = calculateEffectivePrice(preset, 'Pix');
                    const cashEffective = calculateEffectivePrice(preset, 'Dinheiro');

                    return (
                      <div
                        key={preset.id}
                        className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3 bg-white ${
                          isAlreadyAdded
                            ? 'border-emerald-200 bg-emerald-50/20'
                            : 'border-slate-200 hover:border-yellow-400 shadow-xs'
                        }`}
                      >
                        <img
                          src={preset.image}
                          alt={preset.name}
                          className="w-16 h-16 rounded-xl object-cover shrink-0 border border-slate-200"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black uppercase bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              {preset.category}
                            </span>
                            {preset.unit && (
                              <span className="text-[9px] font-black bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">
                                {preset.unit}
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-xs text-slate-900 truncate mt-1">
                            {preset.name}
                          </h4>
                          <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-sm font-black text-slate-900">
                              R$ {preset.price.toFixed(2)}
                            </span>
                            {preset.pixDiscount?.enabled && (
                              <span className="text-[10px] font-black text-emerald-600">
                                PIX R$ {pixEffective.toFixed(2)}
                              </span>
                            )}
                          </div>

                          <div className="mt-2.5">
                            <button
                              type="button"
                              onClick={() => handleImportPreset(preset)}
                              className={`w-full py-1.5 px-2.5 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 transition-all ${
                                isAlreadyAdded
                                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                  : 'bg-yellow-400 hover:bg-yellow-300 text-slate-950 shadow-xs'
                              }`}
                            >
                              {isAlreadyAdded ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Adicionar Novamente</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Adicionar ao Catálogo</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsPresetsDrawerOpen(false)}
                  className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
                >
                  Concluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmação de Exclusão */}
      <AnimatePresence>
        {deletingProductId && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl border border-slate-200"
            >
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Remover Produto?</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Tem certeza que deseja excluir este produto do catálogo? Esta ação não pode ser desfeita.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingProductId(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await onDeleteProduct(deletingProductId);
                    setDeletingProductId(null);
                    showToast('Produto excluído com sucesso.');
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs shadow-md shadow-red-600/20"
                >
                  Confirmar Exclusão
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

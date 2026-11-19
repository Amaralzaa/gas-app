import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  MapPin, 
  Clock, 
  Phone, 
  Mail, 
  Save, 
  Check, 
  AlertCircle, 
  Camera, 
  Power,
  Store,
  Calendar,
  Sparkles,
  Sun,
  Sunset,
  Moon,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { BusinessInfo, DayHours, OpeningHours, DeliveryPeriod } from '../types';
import { DEFAULT_DELIVERY_PERIODS } from '../services/businessService';
import { LogoCropperModal } from './LogoCropperModal';

interface BusinessSettingsTabProps {
  businessInfo: BusinessInfo;
  onSave: (updatedInfo: BusinessInfo) => Promise<void> | void;
}

const DAYS_TRANSLATION: { [key in keyof OpeningHours]: { label: string; short: string } } = {
  monday:    { label: 'Segunda-feira', short: 'Seg' },
  tuesday:   { label: 'Terça-feira',   short: 'Ter' },
  wednesday: { label: 'Quarta-feira',  short: 'Qua' },
  thursday:  { label: 'Quinta-feira',  short: 'Qui' },
  friday:    { label: 'Sexta-feira',   short: 'Sex' },
  saturday:  { label: 'Sábado',        short: 'Sáb' },
  sunday:    { label: 'Domingo',       short: 'Dom' },
};

export const BusinessSettingsTab: React.FC<BusinessSettingsTabProps> = ({
  businessInfo,
  onSave
}) => {
  const isDirtyRef = React.useRef(false);
  const lastUpdatedRef = React.useRef(businessInfo?.updatedAt);
  const formRef = React.useRef<BusinessInfo | null>(null);
  const [form, setForm] = useState<BusinessInfo>(() => ({
    ...businessInfo,
    deliveryPeriods: (businessInfo.deliveryPeriods && businessInfo.deliveryPeriods.length > 0)
      ? businessInfo.deliveryPeriods
      : DEFAULT_DELIVERY_PERIODS
  }));
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (businessInfo && !isDirtyRef.current) {
      setForm(prev => ({
        ...businessInfo,
        name: businessInfo.name || prev.name || '',
        tradeName: businessInfo.tradeName || prev.tradeName || '',
        logoUrl: businessInfo.logoUrl !== undefined ? businessInfo.logoUrl : prev.logoUrl,
        deliveryPeriods: (businessInfo.deliveryPeriods && businessInfo.deliveryPeriods.length > 0)
          ? businessInfo.deliveryPeriods
          : (prev.deliveryPeriods && prev.deliveryPeriods.length > 0 ? prev.deliveryPeriods : DEFAULT_DELIVERY_PERIODS)
      }));
      lastUpdatedRef.current = businessInfo.updatedAt;
    }
  }, [businessInfo]);

  formRef.current = form;
  const periods = form.deliveryPeriods || DEFAULT_DELIVERY_PERIODS;

  const chooseOpenOverride = (value: boolean | null) => {
    isDirtyRef.current = true;
    setForm((prev) => {
      const next = { ...prev, isOpenOverride: value };
      formRef.current = next;
      return next;
    });
  };

  const handleTogglePeriodActive = (id: string) => {
    isDirtyRef.current = true;
    setForm(prev => {
      const current = prev.deliveryPeriods || DEFAULT_DELIVERY_PERIODS;
      return {
        ...prev,
        deliveryPeriods: current.map(p => p.id === id ? { ...p, active: !p.active } : p)
      };
    });
  };

  const handleUpdatePeriod = (id: string, field: keyof DeliveryPeriod, value: any) => {
    isDirtyRef.current = true;
    setForm(prev => {
      const current = prev.deliveryPeriods || DEFAULT_DELIVERY_PERIODS;
      return {
        ...prev,
        deliveryPeriods: current.map(p => p.id === id ? { ...p, [field]: value } : p)
      };
    });
  };

  const handleDeletePeriod = (id: string) => {
    isDirtyRef.current = true;
    setForm(prev => {
      const current = prev.deliveryPeriods || DEFAULT_DELIVERY_PERIODS;
      if (current.length <= 1) {
        alert('É necessário manter pelo menos 1 período configurado.');
        return prev;
      }
      return {
        ...prev,
        deliveryPeriods: current.filter(p => p.id !== id)
      };
    });
  };

  const handleAddPeriod = () => {
    isDirtyRef.current = true;
    setForm(prev => {
      const current = prev.deliveryPeriods || DEFAULT_DELIVERY_PERIODS;

      // Se já houver um turno 'Noite' desativado, ativa ele diretamente
      const inactiveNight = current.find(p => p.name.toLowerCase().includes('noite') && !p.active);
      if (inactiveNight) {
        return {
          ...prev,
          deliveryPeriods: current.map(p => p.id === inactiveNight.id ? { ...p, active: true } : p)
        };
      }

      const count = current.length;
      const existingNames = current.map(p => p.name.toLowerCase());
      let newName = 'Noite';
      let startTime = '19:00';
      let endTime = '22:00';
      let icon = 'moon';

      if (existingNames.includes('noite')) {
        newName = `Turno ${count + 1}`;
        startTime = '14:00';
        endTime = '18:00';
        icon = 'sun';
      }

      const newPeriod: DeliveryPeriod = {
        id: `period_${Date.now()}`,
        name: newName,
        startTime,
        endTime,
        active: true,
        icon
      };

      return {
        ...prev,
        deliveryPeriods: [...current, newPeriod]
      };
    });
  };

  const handleMovePeriod = (index: number, direction: 'up' | 'down') => {
    isDirtyRef.current = true;
    setForm(prev => {
      const current = [...(prev.deliveryPeriods || DEFAULT_DELIVERY_PERIODS)];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= current.length) return prev;

      const temp = current[index];
      current[index] = current[targetIndex];
      current[targetIndex] = temp;

      return {
        ...prev,
        deliveryPeriods: current
      };
    });
  };

  const handleOpeningHoursChange = (day: keyof OpeningHours, field: keyof DayHours, value: any) => {
    isDirtyRef.current = true;
    setForm(prev => ({
      ...prev,
      openingHours: {
        ...prev.openingHours,
        [day]: {
          ...prev.openingHours[day],
          [field]: value
        }
      }
    }));
  };

  const handleAddressChange = (field: string, value: string) => {
    isDirtyRef.current = true;
    setForm(prev => ({
      ...prev,
      address: {
        ...prev.address,
        [field]: value
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formRef.current || form);
      isDirtyRef.current = false;
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Erro ao salvar:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Header com indicador de status */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-yellow-400 p-3 rounded-2xl text-slate-900 shadow-md">
            <Store className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">Meu Negócio & Estabelecimento</h1>
            <p className="text-xs text-slate-500 font-medium">Cadastre informações institucionais, logo e horários de atendimento</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSaving}
          className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-2xl font-black text-sm transition-all shadow-lg active:scale-95 disabled:opacity-50"
        >
          {savedSuccess ? (
            <>
              <Check className="w-4 h-4 text-green-400" />
              <span>Salvo com Sucesso!</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4 text-yellow-400" />
              <span>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
            </>
          )}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card 1: Identidade & Logo */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-yellow-500" /> Identidade da Empresa & Logo
          </h2>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 pt-2">
            {/* Logo Preview & Upload */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div 
                onClick={() => setIsCropperOpen(true)}
                className="relative group cursor-pointer w-28 h-28 rounded-3xl overflow-hidden border-4 border-yellow-400 shadow-lg bg-white flex items-center justify-center transition-all hover:scale-105"
                title="Clique para carregar ou redimensionar a logo"
              >
                {form.logoUrl ? (
                  <img src={form.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <Store className="w-12 h-12 text-slate-300 group-hover:text-yellow-500 transition-colors" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity">
                  <Camera className="w-6 h-6" />
                  <span className="text-[10px] font-bold mt-1">Alterar</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsCropperOpen(true)}
                  className="text-xs font-bold text-yellow-800 bg-yellow-100 hover:bg-yellow-200 px-3 py-1.5 rounded-xl transition-colors border border-yellow-300 shadow-xs"
                >
                  {form.logoUrl ? 'Redimensionar' : 'Adicionar Logo'}
                </button>
                {form.logoUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...form, logoUrl: '' };
                      setForm(updated);
                      onSave(updated);
                    }}
                    className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-xl transition-colors border border-red-200"
                    title="Remover logotipo e retornar ao ícone padrão"
                  >
                    Remover
                  </button>
                )}
              </div>
            </div>

            {/* Campos de texto */}
            <div className="flex-1 w-full grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="lg:col-span-2 bg-yellow-50/50 p-4 rounded-2xl border border-yellow-200/80">
                <label className="block text-xs font-black text-slate-800 uppercase mb-1 flex flex-wrap items-center justify-between gap-1">
                  <span>Nome do Estabelecimento / Marca Principal</span>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                    Aparece no Cabeçalho e em todo o App
                  </span>
                </label>
                <p className="text-xs text-slate-500 mb-2 font-medium">
                  Substitui o nome padrão <strong>"Gás Express"</strong> no cabeçalho fixo superior, na tela de login, nos pedidos e nas mensagens do WhatsApp.
                </p>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full p-3.5 bg-white rounded-xl border border-yellow-300 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-400 outline-none text-base font-black text-slate-900 shadow-sm"
                  placeholder="Ex: Porto Gás Distribuidora"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Razão Social / Nome Oficial</label>
                <input
                  type="text"
                  value={form.tradeName || ''}
                  onChange={(e) => setForm(f => ({ ...f, tradeName: e.target.value }))}
                  className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-200 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 outline-none text-sm font-bold"
                  placeholder="Ex: Porto Gás & Água Ltda"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">CNPJ (Opcional)</label>
                <input
                  type="text"
                  value={form.cnpj || ''}
                  onChange={(e) => setForm(f => ({ ...f, cnpj: e.target.value }))}
                  className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-200 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 outline-none text-sm font-bold"
                  placeholder="00.000.000/0001-00"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">E-mail Comercial</label>
                <input
                  type="email"
                  value={form.email || ''}
                  onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-200 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 outline-none text-sm font-bold"
                  placeholder="contato@empresa.com"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Telefones e WhatsApp de Atendimento */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Phone className="w-5 h-5 text-yellow-500" /> Contatos de Atendimento
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">WhatsApp de Pedidos</label>
              <input
                type="tel"
                value={form.whatsapp || ''}
                onChange={(e) => setForm(f => ({ ...f, whatsapp: e.target.value }))}
                className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-200 focus:border-yellow-400 outline-none text-sm font-bold"
                placeholder="(21) 99999-9999"
              />
              <p className="text-[11px] text-slate-400 mt-1">Número para onde clientes podem tirar dúvidas</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Telefone Fixo / Central</label>
              <input
                type="tel"
                value={form.phone || ''}
                onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-200 focus:border-yellow-400 outline-none text-sm font-bold"
                placeholder="(21) 3333-3333"
              />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
          <h2 className="text-lg font-black text-slate-900">Taxas (só cobra o que você definir)</h2>
          <p className="text-xs text-slate-500">Deixe em branco enquanto o valor ainda não foi decidido. Zero significa que a loja definiu que não há cobrança.</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Taxa de entrega (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.deliveryFee ?? ''}
                onChange={(e) => setForm(f => ({ ...f, deliveryFee: e.target.value === '' ? undefined : Number(e.target.value) }))}
                className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-200 focus:border-yellow-400 outline-none text-sm font-bold"
                placeholder="definir"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Pedido mínimo (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.minOrderValue ?? ''}
                onChange={(e) => setForm(f => ({ ...f, minOrderValue: e.target.value === '' ? undefined : Number(e.target.value) }))}
                className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-200 focus:border-yellow-400 outline-none text-sm font-bold"
                placeholder="definir"
              />
            </div>
          </div>
        </div>

        {/* Card 3: Endereço do Estabelecimento */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-yellow-500" /> Endereço da Base Operacional
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Rua / Logradouro</label>
              <input
                type="text"
                value={form.address?.street || ''}
                onChange={(e) => handleAddressChange('street', e.target.value)}
                className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-200 focus:border-yellow-400 outline-none text-sm font-bold"
                placeholder="Rua das Flores"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Número</label>
              <input
                type="text"
                value={form.address?.number || ''}
                onChange={(e) => handleAddressChange('number', e.target.value)}
                className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-200 focus:border-yellow-400 outline-none text-sm font-bold"
                placeholder="100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Bairro</label>
              <input
                type="text"
                value={form.address?.neighborhood || ''}
                onChange={(e) => handleAddressChange('neighborhood', e.target.value)}
                className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-200 focus:border-yellow-400 outline-none text-sm font-bold"
                placeholder="Centro"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Cidade</label>
              <input
                type="text"
                value={form.address?.city || ''}
                onChange={(e) => handleAddressChange('city', e.target.value)}
                className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-200 focus:border-yellow-400 outline-none text-sm font-bold"
                placeholder="Niterói"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">CEP</label>
              <input
                type="text"
                value={form.address?.cep || ''}
                onChange={(e) => handleAddressChange('cep', e.target.value)}
                className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-200 focus:border-yellow-400 outline-none text-sm font-bold"
                placeholder="24020-000"
              />
            </div>
          </div>
        </div>

        {/* Card 4: Controle de Abertura Imediata (Override) */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Power className="w-5 h-5 text-yellow-500" /> Status Operacional Imediato
              </h2>
              <p className="text-xs text-slate-500">Permite pausar ou abrir os pedidos imediatos manualmente a qualquer momento</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 pt-2">
            <button
              type="button"
              onClick={() => chooseOpenOverride(null)}
              className={`p-4 rounded-2xl border text-left transition-all ${
                form.isOpenOverride === null
                  ? 'border-yellow-500 bg-yellow-50 text-slate-900 ring-2 ring-yellow-400'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <p className="text-xs font-black uppercase text-yellow-800">Automático (Recomendado)</p>
              <p className="text-xs text-slate-500 mt-1">Abre e fecha conforme a grade de horários abaixo</p>
            </button>

            <button
              type="button"
              onClick={() => chooseOpenOverride(true)}
              className={`p-4 rounded-2xl border text-left transition-all ${
                form.isOpenOverride === true
                  ? 'border-green-500 bg-green-50 text-slate-900 ring-2 ring-green-400'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <p className="text-xs font-black uppercase text-green-700">Forçar Aberto Agora</p>
              <p className="text-xs text-slate-500 mt-1">Aceita pedidos imediatos mesmo fora do horário</p>
            </button>

            <button
              type="button"
              onClick={() => chooseOpenOverride(false)}
              className={`p-4 rounded-2xl border text-left transition-all ${
                form.isOpenOverride === false
                  ? 'border-red-500 bg-red-50 text-slate-900 ring-2 ring-red-400'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <p className="text-xs font-black uppercase text-red-700">Pausar Loja Agora</p>
              <p className="text-xs text-slate-500 mt-1">Apenas pedidos agendados serão aceitos</p>
            </button>
          </div>
        </div>

        {/* Card 5: Grade de Horários de Atendimento Semanal */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-500" /> Horários de Atendimento por Dia
              </h2>
              <p className="text-xs text-slate-500">Defina os horários em que pedidos para entrega imediata são aceitos</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl w-fit">
              <Calendar className="w-3.5 h-3.5 text-yellow-500" />
              <span>Fora desses horários: apenas agendamento</span>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {(Object.keys(DAYS_TRANSLATION) as Array<keyof OpeningHours>).map((dayKey) => {
              const dayData = form.openingHours?.[dayKey] || { isOpen: true, open: '08:00', close: '19:00' };
              const translation = DAYS_TRANSLATION[dayKey];

              return (
                <div key={dayKey} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 w-44">
                    <button
                      type="button"
                      onClick={() => handleOpeningHoursChange(dayKey, 'isOpen', !dayData.isOpen)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        dayData.isOpen ? 'bg-yellow-400' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          dayData.isOpen ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <div>
                      <span className="font-bold text-sm text-slate-900 block">{translation.label}</span>
                      <span className={`text-[10px] font-bold uppercase ${dayData.isOpen ? 'text-green-600' : 'text-slate-400'}`}>
                        {dayData.isOpen ? 'Aberto' : 'Fechado'}
                      </span>
                    </div>
                  </div>

                  {dayData.isOpen ? (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                        <span className="text-xs font-medium text-slate-500">Das</span>
                        <input
                          type="time"
                          value={dayData.open}
                          onChange={(e) => handleOpeningHoursChange(dayKey, 'open', e.target.value)}
                          className="bg-transparent text-xs font-bold text-slate-900 outline-none"
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-400">às</span>
                      <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                        <span className="text-xs font-medium text-slate-500">Até</span>
                        <input
                          type="time"
                          value={dayData.close}
                          onChange={(e) => handleOpeningHoursChange(dayKey, 'close', e.target.value)}
                          className="bg-transparent text-xs font-bold text-slate-900 outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs font-bold text-slate-400 italic py-1.5">
                      Não há entregas imediatas neste dia (apenas pedidos agendados)
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Card 6: Períodos de Entrega Agendada */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-600" /> Períodos de Entrega Agendada (Clientes)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Organize os turnos de agendamento disponíveis para os clientes (ex: Manhã, Tarde, Noite). Ative, edite horários ou crie novos períodos.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddPeriod}
              className="flex items-center gap-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-4 py-2 rounded-2xl text-xs font-black transition-all shadow-sm active:scale-95 w-fit cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Período</span>
            </button>
          </div>

          <div className="space-y-3">
            {periods.map((period, idx) => {
              const isMorning = period.icon === 'sun' || period.name.toLowerCase().includes('manh');
              const isAfternoon = period.icon === 'sunset' || period.name.toLowerCase().includes('tarde');
              const isNight = period.icon === 'moon' || period.name.toLowerCase().includes('noite');

              return (
                <div
                  key={period.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    period.active
                      ? 'bg-slate-50/70 border-slate-200 hover:bg-slate-50'
                      : 'bg-slate-100/50 border-dashed border-slate-300 opacity-60'
                  }`}
                >
                  {/* Esquerda: Status Switch + Reordenação + Ícone & Nome */}
                  <div className="flex items-center gap-3">
                    {/* Botões Reordenar */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMovePeriod(idx, 'up')}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        title="Mover para cima"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === periods.length - 1}
                        onClick={() => handleMovePeriod(idx, 'down')}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        title="Mover para baixo"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Toggle Ativo */}
                    <button
                      type="button"
                      onClick={() => handleTogglePeriodActive(period.id)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 cursor-pointer ${
                        period.active ? 'bg-purple-600' : 'bg-slate-300'
                      }`}
                      title={period.active ? 'Turno ativo (visível aos clientes)' : 'Turno inativo (desativado)'}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          period.active ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>

                    {/* Ícone contextual */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                      isMorning ? 'bg-amber-100 text-amber-600' :
                      isAfternoon ? 'bg-orange-100 text-orange-600' :
                      isNight ? 'bg-indigo-100 text-indigo-600' :
                      'bg-purple-100 text-purple-600'
                    }`}>
                      {isMorning ? <Sun className="w-4 h-4" /> :
                       isAfternoon ? <Sunset className="w-4 h-4" /> :
                       isNight ? <Moon className="w-4 h-4" /> :
                       <Clock className="w-4 h-4" />}
                    </div>

                    {/* Nome do turno */}
                    <div>
                      <input
                        type="text"
                        value={period.name}
                        onChange={(e) => handleUpdatePeriod(period.id, 'name', e.target.value)}
                        className="bg-transparent font-black text-sm text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-purple-500 outline-none pb-0.5"
                        placeholder="Nome do período"
                      />
                      <span className="block text-[10px] font-bold uppercase text-slate-400">
                        {period.active ? 'Ativo no App' : 'Desativado'}
                      </span>
                    </div>
                  </div>

                  {/* Direita: Horários e Exclusão */}
                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                        <span className="text-xs font-medium text-slate-400">Das</span>
                        <input
                          type="time"
                          value={period.startTime}
                          onChange={(e) => handleUpdatePeriod(period.id, 'startTime', e.target.value)}
                          className="bg-transparent text-xs font-bold text-slate-900 outline-none"
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-400">às</span>
                      <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                        <span className="text-xs font-medium text-slate-400">Até</span>
                        <input
                          type="time"
                          value={period.endTime}
                          onChange={(e) => handleUpdatePeriod(period.id, 'endTime', e.target.value)}
                          className="bg-transparent text-xs font-bold text-slate-900 outline-none"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeletePeriod(period.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                      title="Excluir período"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-purple-50/60 border border-purple-200/60 p-4 rounded-2xl space-y-1.5 text-xs text-purple-900">
            <div className="flex items-center gap-2 font-black text-purple-950">
              <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0" />
              <span>Visibilidade dos Períodos para os Clientes</span>
            </div>
            <p className="leading-relaxed">
              Os períodos ativos acima serão exibidos para os clientes na modalidade <strong>Agendar pedido</strong>. 
              <strong>Importante:</strong> os agendamentos respeitam os <em>Horários de Atendimento por Dia</em> configurados acima — turnos que se iniciam após o horário de fechamento da loja no dia (ex: turno Noite se a loja fechar às 19h) não serão ofertados para aquele dia.
            </p>
          </div>
        </div>

        {/* Botão flutuante ou inferior de salvar */}
        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-2xl font-black text-sm transition-all shadow-xl active:scale-95 disabled:opacity-50"
          >
            {savedSuccess ? (
              <>
                <Check className="w-5 h-5 text-green-400" />
                <span>Salvo com Sucesso!</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5 text-yellow-400" />
                <span>{isSaving ? 'Salvando...' : 'Salvar Alterações de Horário e Negócio'}</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Modal de corte e redimensionamento da Logo */}
      <LogoCropperModal
        isOpen={isCropperOpen}
        onClose={() => setIsCropperOpen(false)}
        initialImage={form.logoUrl}
        onSave={(dataUrl) => {
          const updated = { ...form, logoUrl: dataUrl };
          setForm(updated);
          onSave(updated);
        }}
      />
    </div>
  );
};

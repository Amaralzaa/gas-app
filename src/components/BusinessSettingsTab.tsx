import React, { useState } from 'react';
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
  Sparkles
} from 'lucide-react';
import { BusinessInfo, DayHours, OpeningHours } from '../types';
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
  const [form, setForm] = useState<BusinessInfo>(businessInfo);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleOpeningHoursChange = (day: keyof OpeningHours, field: keyof DayHours, value: any) => {
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
      await onSave(form);
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
            <div className="flex flex-col items-center gap-2">
              <div 
                onClick={() => setIsCropperOpen(true)}
                className="relative group cursor-pointer w-28 h-28 rounded-full overflow-hidden border-4 border-yellow-400 shadow-lg bg-slate-50 flex items-center justify-center transition-all hover:scale-105"
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
              <button
                type="button"
                onClick={() => setIsCropperOpen(true)}
                className="text-xs font-bold text-yellow-700 bg-yellow-50 hover:bg-yellow-100 px-3 py-1.5 rounded-xl transition-colors border border-yellow-200"
              >
                Redimensionar Logo
              </button>
            </div>

            {/* Campos de texto */}
            <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nome Fantasia (Aparece aos clientes)</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-200 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 outline-none text-sm font-bold"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        {/* Card 3: Endereço do Estabelecimento */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-yellow-500" /> Endereço da Base Operacional
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, isOpenOverride: null }))}
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
              onClick={() => setForm(f => ({ ...f, isOpenOverride: true }))}
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
              onClick={() => setForm(f => ({ ...f, isOpenOverride: false }))}
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
          setForm(f => ({ ...f, logoUrl: dataUrl }));
        }}
      />
    </div>
  );
};

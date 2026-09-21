import React, { useState } from 'react';
import { X, Target, Calendar, Plus, Trash2, CheckCircle2, HelpCircle } from 'lucide-react';
import { motion } from 'motion/react';

export interface SpecificGoalItem {
  goal: number;
  label?: string;
}

export interface GoalConfig {
  weekdayGoal: number; // Segunda a Sexta
  weekendGoal: number; // Sábado e Domingo
  specificDateGoals: Record<string, SpecificGoalItem>; // Chave: 'YYYY-MM-DD'
}

export const DEFAULT_GOAL_CONFIG: GoalConfig = {
  weekdayGoal: 80,
  weekendGoal: 120,
  specificDateGoals: {
    '2026-12-24': { goal: 220, label: 'Véspera de Natal' },
    '2026-12-31': { goal: 200, label: 'Véspera de Ano Novo' }
  }
};

const STORAGE_KEY = 'portogas_goals_config_v1';

export const loadGoalConfig = (): GoalConfig => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        weekdayGoal: typeof parsed.weekdayGoal === 'number' ? parsed.weekdayGoal : DEFAULT_GOAL_CONFIG.weekdayGoal,
        weekendGoal: typeof parsed.weekendGoal === 'number' ? parsed.weekendGoal : DEFAULT_GOAL_CONFIG.weekendGoal,
        specificDateGoals: parsed.specificDateGoals || {}
      };
    }
  } catch (err) {
    console.error('Erro ao carregar metas:', err);
  }
  return DEFAULT_GOAL_CONFIG;
};

export const saveGoalConfig = (config: GoalConfig) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('Erro ao salvar metas:', err);
  }
};

export const getGoalForDate = (date: Date, config: GoalConfig): number => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateKey = `${year}-${month}-${day}`;

  if (config.specificDateGoals[dateKey]) {
    return config.specificDateGoals[dateKey].goal;
  }

  const dayOfWeek = date.getDay(); // 0 = Domingo, 6 = Sábado
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return config.weekendGoal;
  }
  return config.weekdayGoal;
};

export const getGoalForPeriod = (startDate: Date, endDate: Date, config: GoalConfig): number => {
  let totalGoal = 0;
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (current <= end) {
    totalGoal += getGoalForDate(current, config);
    current.setDate(current.getDate() + 1);
  }

  return Math.max(totalGoal, 1);
};

interface GoalSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GoalConfig;
  onSave: (newConfig: GoalConfig) => void;
}

export const GoalSettingsModal: React.FC<GoalSettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave
}) => {
  const [weekdayGoal, setWeekdayGoal] = useState<number>(config.weekdayGoal);
  const [weekendGoal, setWeekendGoal] = useState<number>(config.weekendGoal);
  const [specificGoals, setSpecificGoals] = useState<Record<string, SpecificGoalItem>>({ ...config.specificDateGoals });

  // Formulário para nova data específica
  const [newDate, setNewDate] = useState<string>('');
  const [newGoal, setNewGoal] = useState<number>(150);
  const [newLabel, setNewLabel] = useState<string>('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleAddSpecificDate = () => {
    if (!newDate) {
      alert('Por favor, selecione uma data.');
      return;
    }
    if (newGoal <= 0) {
      alert('A meta deve ser maior que zero.');
      return;
    }

    setSpecificGoals(prev => ({
      ...prev,
      [newDate]: {
        goal: newGoal,
        label: newLabel.trim() || 'Data Especial'
      }
    }));

    setNewDate('');
    setNewLabel('');
    setNewGoal(150);
  };

  const handleRemoveSpecificDate = (dateKey: string) => {
    setSpecificGoals(prev => {
      const copy = { ...prev };
      delete copy[dateKey];
      return copy;
    });
  };

  const handleSaveAll = () => {
    const newConfig: GoalConfig = {
      weekdayGoal: Math.max(1, Number(weekdayGoal)),
      weekendGoal: Math.max(1, Number(weekendGoal)),
      specificDateGoals: specificGoals
    };

    saveGoalConfig(newConfig);
    onSave(newConfig);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        exit={{ scale: 0.95, opacity: 0 }} 
        className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Cabeçalho */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-yellow-400/20 text-yellow-600 flex items-center justify-center">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-xl text-slate-900">Configuração de Metas de Venda</h3>
              <p className="text-xs text-slate-500 font-bold">Defina metas diárias padrão e datas sazonais</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          
          {/* Metas Padrão */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-slate-800 uppercase text-xs tracking-wider flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-yellow-500" /> Metas Padrão Semanais (Botijões/Dia)
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Dias de Semana */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <label className="block text-xs font-black text-slate-600 mb-1">
                  Dias Úteis (Segunda a Sexta)
                </label>
                <div className="flex items-center gap-2 mt-2">
                  <input 
                    type="number" 
                    min={1} 
                    value={weekdayGoal} 
                    onChange={(e) => setWeekdayGoal(Math.max(1, parseInt(e.target.value) || 1))} 
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-black text-lg text-slate-900 focus:outline-none focus:border-yellow-400"
                  />
                  <span className="text-xs font-bold text-slate-400 whitespace-nowrap">un/dia</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  Meta aplicada de 2ª a 6ª feira automaticamente.
                </p>
              </div>

              {/* Fins de Semana */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <label className="block text-xs font-black text-slate-600 mb-1">
                  Fins de Semana (Sábado e Domingo)
                </label>
                <div className="flex items-center gap-2 mt-2">
                  <input 
                    type="number" 
                    min={1} 
                    value={weekendGoal} 
                    onChange={(e) => setWeekendGoal(Math.max(1, parseInt(e.target.value) || 1))} 
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 font-black text-lg text-slate-900 focus:outline-none focus:border-yellow-400"
                  />
                  <span className="text-xs font-bold text-slate-400 whitespace-nowrap">un/dia</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  Meta aplicada aos sábados e domingos.
                </p>
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Datas Específicas / Promoções */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-black text-slate-800 uppercase text-xs tracking-wider flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-emerald-500" /> Datas Específicas ou Promoções
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Sobrescreve a meta padrão para feriados, datas comemorativas ou promoções
                </p>
              </div>
            </div>

            {/* Formulário de Adicionar Nova Data */}
            <div className="bg-yellow-50/60 p-4 rounded-2xl border border-yellow-200/60 space-y-3">
              <p className="text-xs font-black text-yellow-900 uppercase">Adicionar Nova Data</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Data</label>
                  <input 
                    type="date" 
                    value={newDate} 
                    onChange={(e) => setNewDate(e.target.value)} 
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-yellow-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Meta (Botijões)</label>
                  <input 
                    type="number" 
                    min={1} 
                    value={newGoal} 
                    onChange={(e) => setNewGoal(Math.max(1, parseInt(e.target.value) || 1))} 
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-yellow-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Descrição / Motivo</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Black Friday" 
                    value={newLabel} 
                    onChange={(e) => setNewLabel(e.target.value)} 
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-yellow-400"
                  />
                </div>
              </div>
              <button 
                type="button" 
                onClick={handleAddSpecificDate}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-black py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Meta Específica
              </button>
            </div>

            {/* Lista de Datas Cadastradas */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500">Datas cadastradas ({Object.keys(specificGoals).length}):</p>
              {Object.keys(specificGoals).length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 text-center text-xs text-slate-400 italic">
                  Nenhuma data específica cadastrada. O sistema usará as metas padrão da semana.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {(Object.entries(specificGoals) as [string, SpecificGoalItem][]).sort(([a], [b]) => a.localeCompare(b)).map(([dateKey, item]) => {
                    const [y, m, d] = dateKey.split('-');
                    const formattedDate = `${d}/${m}/${y}`;
                    return (
                      <div key={dateKey} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                            {formattedDate}
                          </span>
                          <span className="text-slate-600 font-bold">{item.label || 'Data Especial'}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">
                            {item.goal} botijões
                          </span>
                          <button 
                            type="button" 
                            onClick={() => handleRemoveSpecificDate(dateKey)} 
                            className="p-1 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                            title="Remover data"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Rodapé com Ação Salvar */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-400 flex items-center gap-1">
            <HelpCircle className="w-4 h-4" /> As metas recalculam as barras de progresso automaticamente.
          </div>
          <div className="flex items-center gap-2">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="button" 
              onClick={handleSaveAll}
              className="px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black text-xs rounded-xl shadow transition-all flex items-center gap-2"
            >
              {savedSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" /> Salvo com Sucesso!
                </>
              ) : (
                'Salvar Metas'
              )}
            </button>
          </div>
        </div>

      </motion.div>
    </div>
  );
};

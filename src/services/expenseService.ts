import { supabase } from '../lib/supabase';
import { Expense } from '../types';

export const expenseService = {
  async getExpenses(): Promise<Expense[]> {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false });

    if (error) throw error;
    return (data || []).map(e => ({
      id: e.id,
      description: e.description,
      amount: Number(e.amount),
      date: e.date,
      category: e.category,
      userId: e.user_id,
    }));
  },

  async addExpense(expense: Omit<Expense, 'id'>): Promise<Expense> {
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        description: expense.description,
        amount: expense.amount,
        category: expense.category,
        user_id: expense.userId,
        date: expense.date,
      })
      .select()
      .single();

    if (error) throw error;
    return {
      id: data.id,
      description: data.description,
      amount: Number(data.amount),
      date: data.date,
      category: data.category,
      userId: data.user_id,
    };
  }
};

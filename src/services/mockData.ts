
import { Client, FinancialRecord, LegalCase, Office, Task, Lead } from '../types';

export const MOCK_OFFICES: Office[] = [];
export const MOCK_CLIENTS: Client[] = [];
export const MOCK_CASES: LegalCase[] = [];
export const MOCK_TASKS: Task[] = [];
export const MOCK_FINANCIALS: FinancialRecord[] = [];
export const MOCK_LEADS: Lead[] = [];

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};
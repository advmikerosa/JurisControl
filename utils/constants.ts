
import { CasePhase, LegalCategory } from '../types';

export const LEGAL_CATEGORIES: LegalCategory[] = [
  'Administrativo', 'Cível', 'Comercial/Empresarial', 'Consumidor', 
  'Família', 'Trabalhista', 'Imobiliário', 'Tributário', 
  'Penal', 'Previdenciário', 'Outro'
];

export const CASE_PHASES: CasePhase[] = [
  'Distributivo', 'Conhecimento', 'Instrução', 'Julgamento', 'Recurso', 'Execução', 'Encerrado'
];

export const PRIORITIES = ['Baixa', 'Média', 'Alta'] as const;

export const CLIENT_TYPES = ['PF', 'PJ'] as const;

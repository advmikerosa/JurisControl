

import { CaseStatus, Client, FinancialRecord, LegalCase, Office, Priority, Task, Lead } from '../types';

export const MOCK_OFFICES: Office[] = [
  { 
    id: '1', 
    name: 'Advocacia Silva & Associados', 
    location: 'São Paulo - SP',
    handle: '@silvaassociados',
    ownerId: 'u1',
    members: [
      {
        userId: 'u1',
        name: 'Dr. Usuário',
        role: 'Admin',
        permissions: {
          financial: true,
          cases: true,
          documents: true,
          settings: true
        }
      }
    ]
  },
];

// Helper para datas relativas
const today = new Date();
const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
const nextWeek = new Date(today); nextWeek.setDate(today.getDate() + 7);
const lastMonth = new Date(today); lastMonth.setDate(today.getDate() - 30);

const formatDate = (date: Date) => date.toLocaleDateString('pt-BR');
const formatISO = (date: Date) => date.toISOString().split('T')[0];

export const MOCK_CLIENTS: Client[] = [
  {
    id: 'c1',
    name: 'João da Silva',
    email: 'joao.silva@email.com',
    phone: '(11) 99999-1111',
    type: 'PF',
    status: 'Ativo',
    avatarUrl: 'https://ui-avatars.com/api/?name=Joao+Silva&background=random',
    address: 'Rua das Flores, 123',
    city: 'São Paulo',
    state: 'SP',
    createdAt: formatDate(lastMonth),
    cpf: '123.456.789-00',
    documents: [], history: [], alerts: []
  },
  {
    id: 'c2',
    name: 'Tech Solutions Ltda',
    corporateName: 'Tech Solutions Tecnologia e Serviços Ltda',
    email: 'contato@techsolutions.com',
    phone: '(11) 3333-4444',
    type: 'PJ',
    status: 'Ativo',
    avatarUrl: 'https://ui-avatars.com/api/?name=Tech+Solutions&background=random',
    address: 'Av. Paulista, 1000',
    city: 'São Paulo',
    state: 'SP',
    createdAt: formatDate(lastMonth),
    cnpj: '12.345.678/0001-90',
    documents: [], history: [], alerts: []
  },
  {
    id: 'c3',
    name: 'Maria Oliveira',
    email: 'maria.oli@email.com',
    phone: '(21) 98888-7777',
    type: 'PF',
    status: 'Sob Análise',
    avatarUrl: 'https://ui-avatars.com/api/?name=Maria+Oliveira&background=random',
    address: 'Rua do Porto, 50',
    city: 'Rio de Janeiro',
    state: 'RJ',
    createdAt: formatDate(yesterday),
    cpf: '987.654.321-11',
    documents: [], history: [], alerts: []
  }
];

export const MOCK_CASES: LegalCase[] = [
  {
    id: 'case1',
    cnj: '0001234-55.2023.8.26.0100',
    title: 'Ação Trabalhista vs Tech Solutions',
    client: MOCK_CLIENTS[0],
    status: CaseStatus.ACTIVE,
    nextHearing: formatDate(today), // HOJE (Para testar agenda)
    value: 50000.00,
    responsibleLawyer: 'Dr. Usuário',
    court: '2ª Vara do Trabalho de SP',
    lastUpdate: new Date().toISOString(),
    movements: [
      { id: 'm1', date: formatDate(yesterday), title: 'Despacho', description: 'Designada audiência de instrução.', type: 'Despacho', author: 'Sistema' }
    ],
    changeLog: []
  },
  {
    id: 'case2',
    cnj: '1020304-88.2023.8.26.0000',
    title: 'Recuperação Fiscal - Tech Solutions',
    client: MOCK_CLIENTS[1],
    status: CaseStatus.ACTIVE,
    nextHearing: formatDate(nextWeek),
    value: 120000.00,
    responsibleLawyer: 'Dr. Usuário',
    court: 'Vara da Fazenda Pública',
    lastUpdate: new Date().toISOString(),
    changeLog: []
  },
  {
    id: 'case3',
    cnj: '0055555-11.2022.8.19.0001',
    title: 'Divórcio Consensual',
    client: MOCK_CLIENTS[2],
    status: CaseStatus.PENDING,
    value: 15000.00,
    responsibleLawyer: 'Dra. Parceira',
    court: 'Vara de Família RJ',
    lastUpdate: new Date().toISOString(),
    changeLog: []
  },
  {
    id: 'case4',
    cnj: '0099999-00.2021.8.26.0100',
    title: 'Ação de Cobrança de Valores Indevidos', // Corrected Accents
    client: MOCK_CLIENTS[0],
    status: CaseStatus.WON,
    value: 8500.00,
    responsibleLawyer: 'Dr. Usuário',
    court: 'JEC Central',
    lastUpdate: lastMonth.toISOString(),
    changeLog: []
  }
];

export const MOCK_TASKS: Task[] = [
  {
    id: 't1',
    title: 'Preparar Alegações Finais',
    dueDate: formatDate(today), // HOJE
    priority: Priority.HIGH,
    status: 'A Fazer',
    assignedTo: 'Dr. Usuário',
    caseId: 'case1',
    description: 'Urgente para audiência de hoje.'
  },
  {
    id: 't2',
    title: 'Protocolar Recurso',
    dueDate: formatDate(tomorrow),
    priority: Priority.HIGH,
    status: 'Em Andamento',
    assignedTo: 'Dr. Usuário',
    caseId: 'case2'
  },
  {
    id: 't3',
    title: 'Reunião com Cliente',
    dueDate: formatDate(nextWeek),
    priority: Priority.MEDIUM,
    status: 'A Fazer',
    assignedTo: 'Dr. Usuário',
    caseId: 'case3'
  },
  {
    id: 't4',
    title: 'Verificar Publicação',
    dueDate: formatDate(yesterday), // ATRASADA
    priority: Priority.LOW,
    status: 'A Fazer',
    assignedTo: 'Secretaria',
    caseId: 'case4'
  }
];

export const MOCK_FINANCIALS: FinancialRecord[] = [
  {
    id: 'f1',
    title: 'Honorários Iniciais - Caso Silva',
    amount: 2500.00,
    type: 'Receita',
    category: 'Honorários',
    status: 'Pago',
    dueDate: formatISO(lastMonth),
    paymentDate: formatISO(lastMonth),
    clientName: 'João da Silva',
    clientId: 'c1'
  },
  {
    id: 'f2',
    title: 'Aluguel Escritório',
    amount: 1200.00,
    type: 'Despesa',
    category: 'Custos Fixos',
    status: 'Pendente',
    dueDate: formatISO(today), // Vence HOJE
    paymentDate: undefined
  },
  {
    id: 'f3',
    title: 'Licença Software Jurídico',
    amount: 150.00,
    type: 'Despesa',
    category: 'Software',
    status: 'Pago',
    dueDate: formatISO(yesterday),
    paymentDate: formatISO(yesterday)
  },
  {
    id: 'f4',
    title: 'Honorários Mensais - Tech Solutions',
    amount: 5000.00,
    type: 'Receita',
    category: 'Honorários',
    status: 'Atrasado',
    dueDate: formatISO(yesterday), // ATRASADO
    clientName: 'Tech Solutions',
    clientId: 'c2'
  }
];

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const MOCK_LEADS: Lead[] = [];
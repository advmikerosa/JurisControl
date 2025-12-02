import { Client, FinancialRecord, LegalCase, Office, Task, Lead, CaseStatus, Priority } from '../types';

const DEFAULT_OFFICE_ID = 'office-1';

export const MOCK_OFFICES: Office[] = [
  {
    id: 'office-1',
    name: 'Silva & Associados',
    handle: '@silva_adv',
    ownerId: 'u1',
    location: 'São Paulo - SP',
    members: [],
    createdAt: new Date().toISOString(),
    areaOfActivity: 'Full Service'
  }
];

export const MOCK_CLIENTS: Client[] = [
  {
    id: 'cli-1',
    officeId: DEFAULT_OFFICE_ID,
    name: 'Tech Solutions Ltda',
    type: 'PJ',
    status: 'Ativo',
    email: 'contato@techsolutions.com.br',
    phone: '(11) 98765-4321',
    avatarUrl: 'https://ui-avatars.com/api/?name=Tech+Solutions&background=random',
    address: 'Av. Paulista, 1000',
    city: 'São Paulo',
    state: 'SP',
    createdAt: '10/01/2024',
    cnpj: '12.345.678/0001-90',
    tags: ['Tecnologia', 'Contratos'],
    history: [],
    documents: [],
    alerts: []
  },
  {
    id: 'cli-2',
    officeId: DEFAULT_OFFICE_ID,
    name: 'João da Silva',
    type: 'PF',
    status: 'Ativo',
    email: 'joao.silva@email.com',
    phone: '(21) 99999-8888',
    avatarUrl: 'https://ui-avatars.com/api/?name=Joao+Silva&background=random',
    address: 'Rua das Flores, 123',
    city: 'Rio de Janeiro',
    state: 'RJ',
    createdAt: '15/02/2024',
    cpf: '123.456.789-00',
    tags: ['Trabalhista'],
    history: [],
    documents: [],
    alerts: []
  },
  {
    id: 'cli-3',
    officeId: DEFAULT_OFFICE_ID,
    name: 'Construtora Horizonte',
    type: 'PJ',
    status: 'Em Litígio',
    email: 'juridico@horizonte.com.br',
    phone: '(31) 3333-4444',
    avatarUrl: 'https://ui-avatars.com/api/?name=Construtora+H&background=random',
    address: 'Av. do Contorno, 500',
    city: 'Belo Horizonte',
    state: 'MG',
    createdAt: '05/03/2024',
    cnpj: '98.765.432/0001-10',
    tags: ['Imobiliário', 'Civil'],
    history: [],
    documents: [],
    alerts: []
  }
];

export const MOCK_CASES: LegalCase[] = [
  {
    id: 'case-1',
    officeId: DEFAULT_OFFICE_ID,
    cnj: '0001234-56.2024.5.02.0001',
    title: 'Ação Trabalhista - Reclamação',
    client: MOCK_CLIENTS[1],
    status: CaseStatus.ACTIVE,
    category: 'Trabalhista',
    phase: 'Instrução',
    value: 150000.00,
    responsibleLawyer: 'Dr. Usuário',
    court: '1ª Vara do Trabalho de SP',
    nextHearing: '25/11/2024',
    distributionDate: '2024-01-20T10:00:00Z',
    description: 'Reclamação trabalhista pleiteando horas extras e equiparação salarial.',
    movements: [
      { id: 'm1', date: '20/01/2024', title: 'Distribuição', description: 'Processo distribuído.', type: 'Andamento', author: 'Sistema' },
      { id: 'm2', date: '15/02/2024', title: 'Audiência Inicial', description: 'Audiência de conciliação infrutífera.', type: 'Audiência', author: 'Dr. Usuário' }
    ],
    lastUpdate: new Date().toISOString()
  },
  {
    id: 'case-2',
    officeId: DEFAULT_OFFICE_ID,
    cnj: '1005678-90.2023.8.26.0100',
    title: 'Execução de Título Extrajudicial',
    client: MOCK_CLIENTS[0],
    status: CaseStatus.ACTIVE,
    category: 'Cível',
    phase: 'Execução',
    value: 45000.50,
    responsibleLawyer: 'Dr. Usuário',
    court: '25ª Vara Cível Central de SP',
    distributionDate: '2023-11-10T14:30:00Z',
    description: 'Cobrança de contrato de prestação de serviços não pago.',
    lastUpdate: new Date().toISOString()
  },
  {
    id: 'case-3',
    officeId: DEFAULT_OFFICE_ID,
    cnj: '5003344-11.2024.4.03.6100',
    title: 'Mandado de Segurança - Licitação',
    client: MOCK_CLIENTS[2],
    status: CaseStatus.PENDING,
    category: 'Administrativo',
    phase: 'Conhecimento',
    value: 2000000.00,
    responsibleLawyer: 'Dra. Ana',
    court: '3ª Vara Federal Cível de SP',
    nextHearing: '10/12/2024',
    distributionDate: '2024-03-05T09:00:00Z',
    description: 'MS contra ato de inabilitação em concorrência pública.',
    lastUpdate: new Date().toISOString()
  }
];

export const MOCK_TASKS: Task[] = [
  {
    id: 'task-1',
    officeId: DEFAULT_OFFICE_ID,
    title: 'Protocolar Contestação',
    dueDate: '20/11/2024',
    priority: Priority.HIGH,
    status: 'A Fazer',
    assignedTo: 'Dr. Usuário',
    caseId: 'case-1',
    caseTitle: 'Ação Trabalhista - Reclamação',
    clientId: 'cli-2',
    clientName: 'João da Silva',
    description: 'Prazo fatal para contestação.'
  },
  {
    id: 'task-2',
    officeId: DEFAULT_OFFICE_ID,
    title: 'Reunião com Cliente',
    dueDate: '22/11/2024',
    priority: Priority.MEDIUM,
    status: 'A Fazer',
    assignedTo: 'Dr. Usuário',
    clientId: 'cli-1',
    clientName: 'Tech Solutions Ltda',
    description: 'Alinhamento sobre novos contratos.'
  },
  {
    id: 'task-3',
    officeId: DEFAULT_OFFICE_ID,
    title: 'Verificar Publicações',
    dueDate: '18/11/2024',
    priority: Priority.LOW,
    status: 'Concluído',
    assignedTo: 'Estagiário',
    description: 'Diário oficial do dia.'
  }
];

export const MOCK_FINANCIALS: FinancialRecord[] = [
  {
    id: 'fin-1',
    officeId: DEFAULT_OFFICE_ID,
    title: 'Honorários Iniciais - Tech Solutions',
    amount: 5000.00,
    type: 'Receita',
    category: 'Honorários',
    status: 'Pago',
    dueDate: '2024-02-01',
    paymentDate: '2024-02-01',
    clientId: 'cli-1',
    clientName: 'Tech Solutions Ltda'
  },
  {
    id: 'fin-2',
    officeId: DEFAULT_OFFICE_ID,
    title: 'Custas Processuais - Caso João',
    amount: 350.00,
    type: 'Despesa',
    category: 'Custas Processuais',
    status: 'Pago',
    dueDate: '2024-02-15',
    paymentDate: '2024-02-14',
    caseId: 'case-1'
  },
  {
    id: 'fin-3',
    officeId: DEFAULT_OFFICE_ID,
    title: 'Mensalidade Software',
    amount: 199.90,
    type: 'Despesa',
    category: 'Software',
    status: 'Pendente',
    dueDate: '2024-11-30'
  }
];

export const MOCK_LEADS: Lead[] = [];

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};
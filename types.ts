

export enum CaseStatus {
  ACTIVE = 'Ativo',
  PENDING = 'Pendente',
  ARCHIVED = 'Arquivado',
  WON = 'Ganho',
}

export enum Priority {
  HIGH = 'Alta',
  MEDIUM = 'Média',
  LOW = 'Baixa',
}

export type ClientType = 'PF' | 'PJ';
export type ClientStatus = 'Ativo' | 'Inativo' | 'Sob Análise' | 'Em Litígio' | 'Lead';

export interface ClientDocument {
  id: string;
  title: string;
  type: 'PDF' | 'DOC' | 'IMG' | 'XLS';
  uploadDate: string;
  size: string;
  isEncrypted?: boolean; // Security Audit: Encryption flag
}

export interface SystemDocument {
  id: string;
  name: string;
  size: string;
  type: string;
  date: string;
  category?: string;
  caseId?: string; // Vínculo com processo
}

export interface ClientInteraction {
  id: string;
  date: string;
  type: 'Reunião' | 'Email' | 'Telefone' | 'Nota' | 'Whatsapp';
  description: string;
  author: string;
}

export type AlertType = 'critical' | 'warning' | 'info';

export interface ClientAlert {
  id: string;
  title: string;
  message: string;
  date: string;
  type: AlertType;
  isActionable: boolean; // Se true, mostra botão de check para concluir
}

export interface Client {
  id: string;
  name: string; // Nome ou Nome Fantasia
  email: string;
  phone: string;
  type: ClientType;
  status: ClientStatus;
  avatarUrl: string;
  address: string;
  city: string;
  state: string;
  notes?: string;
  createdAt: string;
  
  // Dados PF
  cpf?: string;
  rg?: string;
  birthDate?: string;
  profession?: string;
  civilStatus?: string;

  // Dados PJ
  corporateName?: string; // Razão Social
  cnpj?: string;
  stateRegistration?: string; // Inscrição Estadual
  legalRepresentative?: string; // Representante Legal
  areaOfActivity?: string;

  // Relacionamentos
  documents: ClientDocument[];
  history: ClientInteraction[];
  alerts: ClientAlert[];
}

export interface CaseMovement {
  id: string;
  date: string;
  title: string;
  description: string;
  type: 'Andamento' | 'Despacho' | 'Petição' | 'Audiência' | 'Nota';
  author: string;
}

export interface LegalCase {
  id: string;
  cnj: string;
  title: string;
  client: Client; // Referência ao cliente completo
  status: CaseStatus;
  nextHearing?: string;
  value: number;
  responsibleLawyer: string;
  lastUpdate?: string; // Para automação de arquivamento
  movements?: CaseMovement[]; // Histórico do processo
  court?: string; // Vara/Tribunal
}

export interface Task {
  id: string;
  title: string;
  dueDate: string;
  priority: Priority;
  status: 'A Fazer' | 'Em Andamento' | 'Concluído';
  assignedTo: string;
  description?: string;
  caseId?: string; // Vínculo com processo
  caseTitle?: string; // Cache do título para display
}

export type FinancialStatus = 'Pago' | 'Pendente' | 'Atrasado';

export interface FinancialRecord {
  id: string;
  title: string; // Antigo description
  amount: number;
  type: 'Receita' | 'Despesa';
  category: string;
  status: FinancialStatus;
  dueDate: string; // Data de Vencimento
  paymentDate?: string; // Data do Pagamento efetivo
  clientId?: string; // Opcional: Vínculo com cliente
  clientName?: string; // Cache do nome para facilitar listagem
  caseId?: string; // Vínculo com processo
  installment?: {
    current: number;
    total: number;
  };
}

export interface Office {
  id: string;
  name: string;
  location: string;
}

// Auth Types
export type AuthProvider = 'email' | 'google' | 'apple' | 'microsoft';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  provider: AuthProvider;
  offices: string[]; // IDs dos escritórios
  currentOfficeId?: string;
  twoFactorEnabled: boolean;
  emailVerified: boolean; // Novo campo de verificação
  
  // Novos campos de perfil
  oab?: string;
  phone?: string;
  role?: string; // ex: "Sócio Sênior"
}

// Settings Types
export interface AppSettings {
  general: {
    language: 'pt-BR' | 'en-US' | 'es-ES';
    dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY';
    compactMode: boolean;
  };
  notifications: {
    email: boolean;
    desktop: boolean;
    sound: boolean;
    dailyDigest: boolean;
  };
  automation: {
    autoArchiveWonCases: boolean;
    autoSaveDrafts: boolean;
  };
}

// LGPD & Security Audit Types
export interface ActivityLog {
  id: string;
  action: string;
  ip: string;
  date: string;
  device: string;
  status: 'Success' | 'Failed' | 'Warning';
}

export interface DataRequest {
  id: string;
  type: 'Access' | 'Portability' | 'Rectification' | 'Deletion';
  status: 'Pending' | 'Processing' | 'Completed' | 'Rejected';
  dateRequested: string;
  completionDate?: string;
}

// CRM Types
export type LeadStatus = 'Novo' | 'Qualificação' | 'Proposta' | 'Negociação' | 'Fechado' | 'Perdido';
export type LeadSource = 'Indicação' | 'Site' | 'Instagram' | 'WhatsApp' | 'Evento' | 'Outro';

export interface Proposal {
  id: string;
  title: string;
  value: number;
  sentDate: string;
  validUntil: string;
  status: 'Enviada' | 'Aceita' | 'Rejeitada';
  pdfUrl?: string;
}

export interface SalesTask {
  id: string;
  title: string;
  dueDate: string;
  isDone: boolean;
  type: 'Call' | 'Email' | 'Meeting';
}

export interface Lead {
  id: string;
  name: string;
  company?: string; // Se for PJ
  type: 'PF' | 'PJ';
  email: string;
  phone: string;
  city: string;
  state: string;
  source: LeadSource;
  interestArea: string; // ex: Cível, Trabalhista
  priority: Priority;
  status: LeadStatus;
  value?: number; // Valor estimado da oportunidade
  lastContact: string;
  nextAction?: string;
  createdAt: string;
  
  history: ClientInteraction[]; // Reusing interaction type
  proposals: Proposal[];
  tasks: SalesTask[];
}


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

export type LegalCategory = 
  | 'Administrativo' 
  | 'Cível' 
  | 'Comercial/Empresarial' 
  | 'Consumidor' 
  | 'Família' 
  | 'Trabalhista' 
  | 'Imobiliário' 
  | 'Tributário' 
  | 'Penal' 
  | 'Previdenciário' 
  | 'Outro';

export type CasePhase = 
  | 'Distributivo' 
  | 'Conhecimento' 
  | 'Instrução' 
  | 'Julgamento' 
  | 'Recurso' 
  | 'Execução' 
  | 'Encerrado';

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
  userId?: string;
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
  tags?: string[]; // New field for categorization
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
  userId?: string;
}

export interface CaseMovement {
  id: string;
  date: string;
  title: string;
  description: string;
  type: 'Andamento' | 'Despacho' | 'Petição' | 'Audiência' | 'Nota' | 'Sistema';
  author: string;
}

export interface ChangeLogEntry {
  id: string;
  date: string;
  author: string;
  field: string;
  oldValue: string;
  newValue: string;
}

export interface LegalCase {
  id: string;
  cnj: string;
  title: string;
  client: Client; // Referência ao cliente completo
  status: CaseStatus;
  category?: LegalCategory; // Novo campo
  phase?: CasePhase; // Novo campo
  
  nextHearing?: string;
  distributionDate?: string; // Novo campo
  
  value: number;
  responsibleLawyer: string;
  
  court?: string; // Vara/Tribunal
  judge?: string; // Novo campo
  opposingParty?: string; // Novo campo
  
  description?: string; // Observações iniciais
  lastUpdate?: string; // Para automação de arquivamento
  movements?: CaseMovement[]; // Histórico do processo
  changeLog?: ChangeLogEntry[]; // Histórico de alterações de campos
  userId?: string;
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
  clientId?: string; // Vínculo direto com cliente
  clientName?: string; // Cache do nome do cliente
  userId?: string;
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
  userId?: string;
}

// Office & Team Types
export type MemberRole = 'Admin' | 'Advogado' | 'Estagiário' | 'Financeiro';

export interface OfficePermissions {
  financial: boolean;
  cases: boolean;
  documents: boolean;
  settings: boolean;
}

export interface OfficeMember {
  userId: string;
  name: string; // Cache do nome para facilitar display
  role: MemberRole;
  permissions: OfficePermissions;
  email?: string;
  avatarUrl?: string;
}

export interface Office {
  id: string;
  name: string;
  handle: string; // ex: @silvaadvocacia
  ownerId: string; // ID do usuário dono/gerente
  location: string;
  members: OfficeMember[]; // Agora é um array de objetos complexos
  logoUrl?: string;
  createdAt?: string;
  
  // Novos campos de perfil do escritório
  cnpj?: string;
  phone?: string;
  email?: string;
  website?: string;
  description?: string;
  areaOfActivity?: string; // ex: Full Service, Trabalhista, Criminal
  social?: {
    linkedin?: string;
    instagram?: string;
    facebook?: string;
  };
}

// Auth Types
export type AuthProvider = 'email' | 'google' | 'apple' | 'microsoft';

export interface User {
  id: string;
  name: string;
  username?: string; // ex: @drjoao
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
  role?: string; // ex: "Sócio Sênior" (apenas visual, role real está em OfficeMember)
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

// Search Result Type
export interface SearchResult {
  id: string;
  type: 'client' | 'case' | 'task';
  title: string;
  subtitle?: string;
  url: string;
}

// Dashboard Aggregated Data
export interface DashboardData {
  counts: {
    activeCases: number;
    wonCases: number;
    pendingCases: number;
    hearings: number;
    highPriorityTasks: number;
  };
  charts: {
    caseDistribution: { name: string; value: number; color: string }[];
  };
  lists: {
    upcomingHearings: LegalCase[];
    todaysAgenda: { type: 'task' | 'hearing'; title: string; sub: string; id: string }[];
    recentMovements: { id: string; caseId: string; caseTitle: string; description: string; date: string; type: string; sortTime?: number }[];
  };
}
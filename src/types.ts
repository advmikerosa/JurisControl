
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

// --- Security & Permissions Types ---
export type PermissionResource = 'financial' | 'cases' | 'clients' | 'documents' | 'settings' | 'team';
export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'export';

export type MemberRole = 'Admin' | 'Advogado' | 'Estagiário' | 'Financeiro';

export interface OfficePermissions {
  financial: boolean;
  cases: boolean;
  documents: boolean;
  settings: boolean;
}

// --- Entities with Tenancy (officeId) ---

export interface ClientDocument {
  id: string;
  title: string;
  type: 'PDF' | 'DOC' | 'IMG' | 'XLS';
  uploadDate: string;
  size: string;
  isEncrypted?: boolean; 
}

export interface SystemDocument {
  id: string;
  officeId: string; 
  name: string;
  size: string;
  type: string;
  date: string;
  category?: string;
  caseId?: string;
  userId?: string;
  storagePath?: string; // Caminho real no bucket
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
  isActionable: boolean;
}

export interface Client {
  id: string;
  officeId: string; 
  name: string;
  email?: string;
  phone?: string;
  type: ClientType;
  status: ClientStatus;
  avatarUrl?: string;
  address?: string;
  city?: string;
  state?: string;
  notes?: string;
  tags?: string[];
  createdAt: string;
  
  cpf?: string;
  rg?: string;
  birthDate?: string;
  profession?: string;
  civilStatus?: string;

  corporateName?: string;
  cnpj?: string;
  stateRegistration?: string;
  legalRepresentative?: string;
  areaOfActivity?: string;

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
  type: 'Andamento' | 'Despacho' | 'Petição' | 'Audiência' | 'Nota' | 'Sistema' | 'Sentença' | 'Decisão';
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
  officeId: string; 
  cnj: string;
  title: string;
  client: Client;
  status: CaseStatus;
  category?: LegalCategory;
  phase?: CasePhase;
  
  nextHearing?: string;
  distributionDate?: string;
  
  value: number;
  responsibleLawyer: string;
  
  court?: string;
  judge?: string;
  opposingParty?: string;
  
  description?: string;
  lastUpdate?: string;
  movements?: CaseMovement[];
  changeLog?: ChangeLogEntry[];
  userId?: string;
}

export interface Task {
  id: string;
  officeId: string; 
  title: string;
  dueDate: string;
  priority: Priority;
  status: 'A Fazer' | 'Em Andamento' | 'Concluído';
  assignedTo: string;
  description?: string;
  caseId?: string;
  caseTitle?: string;
  clientId?: string;
  clientName?: string;
  userId?: string;
}

export type FinancialStatus = 'Pago' | 'Pendente' | 'Atrasado';

export interface FinancialRecord {
  id: string;
  officeId: string; 
  title: string;
  amount: number;
  type: 'Receita' | 'Despesa';
  category: string;
  status: FinancialStatus;
  dueDate: string;
  paymentDate?: string;
  clientId?: string;
  clientName?: string;
  caseId?: string;
  installment?: {
    current: number;
    total: number;
  };
  userId?: string;
}

export interface OfficeMember {
  id?: string; 
  userId: string;
  name: string;
  role: MemberRole;
  permissions: OfficePermissions;
  email?: string;
  avatarUrl?: string;
  joinedAt?: string;
}

export interface Office {
  id: string;
  name: string;
  handle: string;
  ownerId: string;
  location: string;
  members: OfficeMember[]; 
  logoUrl?: string;
  createdAt?: string;
  
  cnpj?: string;
  phone?: string;
  email?: string;
  website?: string;
  description?: string;
  areaOfActivity?: string;
  social?: {
    linkedin?: string;
    instagram?: string;
    facebook?: string;
  };
}

export type AuthProvider = 'email' | 'google' | 'apple' | 'microsoft';

export interface User {
  id: string;
  name: string;
  username?: string;
  email: string;
  avatar: string;
  provider: AuthProvider;
  offices: string[]; 
  currentOfficeId?: string;
  twoFactorEnabled: boolean;
  emailVerified: boolean;
  oab?: string;
  phone?: string;
  role?: string; 
}

export interface EmailSettings {
  enabled: boolean;
  frequency: 'immediate' | 'hourly' | 'daily';
  categories: {
    deadlines: boolean;
    processes: boolean;
    events: boolean;
    financial: boolean;
    marketing: boolean; 
  };
  deadlineAlerts: {
    sevenDays: boolean;
    threeDays: boolean;
    oneDay: boolean;
    onDueDate: boolean;
  };
}

export interface EmailLog {
  id: string;
  recipient: string;
  subject: string;
  templateType: string;
  status: 'Sent' | 'Failed' | 'Queued';
  sentAt: string;
  openedAt?: string;
}

export interface AppSettings {
  general: {
    language: 'pt-BR' | 'en-US' | 'es-ES';
    dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY';
    compactMode: boolean;
    dataJudApiKey?: string;
  };
  notifications: {
    desktop: boolean;
    sound: boolean;
    dailyDigest: boolean;
  };
  emailPreferences?: EmailSettings;
  automation: {
    autoArchiveWonCases: boolean;
    autoSaveDrafts: boolean;
  };
}

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
  company?: string;
  type: 'PF' | 'PJ';
  email: string;
  phone: string;
  city: string;
  state: string;
  source: LeadSource;
  interestArea: string;
  priority: Priority;
  status: LeadStatus;
  value?: number;
  lastContact: string;
  nextAction?: string;
  createdAt: string;
  
  history: ClientInteraction[];
  proposals: Proposal[];
  tasks: SalesTask[];
}

export interface SearchResult {
  id: string;
  type: 'client' | 'case' | 'task';
  title: string;
  subtitle?: string;
  url: string;
}

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

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface SystemNotification {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  read: boolean;
  timestamp: Date;
}

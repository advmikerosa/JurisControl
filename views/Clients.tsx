import React, { useState, useEffect } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { storageService } from '../services/storageService';
import { Search, UserPlus, Filter, Building, User, MapPin, Phone, Mail, ChevronRight, X, Users, CheckCircle2, AlertCircle, Clock, Tag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../context/ToastContext';
import { Client, ClientType, ClientStatus } from '../types';

// Masks
const masks = {
  cpf: (v: string) => v.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').substring(0, 14),
  cnpj: (v: string) => v.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d)/, '$1-$2').substring(0, 18),
  phone: (v: string) => {
    const r = v.replace(/\D/g, '');
    if (r.length > 10) return r.replace(/^(\d\d)(\d{5})(\d{4}).*/, '($1) $2-$3');
    if (r.length > 5) return r.replace(/^(\d\d)(\d{4})(\d{0,4}).*/, '($1) $2-$3');
    if (r.length > 2) return r.replace(/^(\d\d)(\d{0,5}).*/, '($1) $2');
    return r.replace(/^(\d*)/, '($1');
  },
  cep: (v: string) => v.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').substring(0, 9)
};

// Strict Algorithmic Validation (Mod 11)
const isValidCPF = (cpf: string) => {
  if (!cpf) return false;
  cpf = cpf.replace(/[^\d]+/g, '');
  if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;
  
  let sum = 0;
  let remainder;
  
  for (let i = 1; i <= 9; i++) sum = sum + parseInt(cpf.substring(i - 1, i)) * (11 - i);
  remainder = (sum * 10) % 11;
  
  if ((remainder === 10) || (remainder === 11)) remainder = 0;
  if (remainder !== parseInt(cpf.substring(9, 10))) return false;
  
  sum = 0;
  for (let i = 1; i <= 10; i++) sum = sum + parseInt(cpf.substring(i - 1, i)) * (12 - i);
  remainder = (sum * 10) % 11;
  
  if ((remainder === 10) || (remainder === 11)) remainder = 0;
  if (remainder !== parseInt(cpf.substring(10, 11))) return false;
  
  return true;
};

const isValidCNPJ = (cnpj: string) => {
  if (!cnpj) return false;
  cnpj = cnpj.replace(/[^\d]+/g, '');
  
  if (cnpj.length !== 14) return false;
  // Elimina CNPJs invalidos conhecidos
  if (!!cnpj.match(/(\d)\1{13}/)) return false;

  // Valida DVs
  let tamanho = cnpj.length - 2;
  let numeros = cnpj.substring(0, tamanho);
  let digitos = cnpj.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;
  
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  
  let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
  if (resultado !== parseInt(digitos.charAt(0))) return false;
  
  tamanho = tamanho + 1;
  numeros = cnpj.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;
  
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  
  resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
  if (resultado !== parseInt(digitos.charAt(1))) return false;
  
  return true;
};

export const Clients: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'Todos' | ClientType>('Todos');
  const [filterStatus, setFilterStatus] = useState<'Todos' | ClientStatus>('Todos');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newClientType, setNewClientType] = useState<ClientType>('PF');
  
  // Form Data State
  const [formData, setFormData] = useState({
    cpf: '', cnpj: '', phone: '', cep: '', rg: '', name: '', corporateName: '', email: '', city: '', state: '',
    tagsInput: ''
  });
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const loadClients = async () => {
      setIsLoading(true);
      try {
        const data = await storageService.getClients();
        setClients(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to load clients", error);
        setClients([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadClients();
  }, []);

  const handleInputChange = (field: string, value: string) => {
    let maskedValue = value;
    if (field === 'cpf') maskedValue = masks.cpf(value);
    if (field === 'cnpj') maskedValue = masks.cnpj(value);
    if (field === 'phone') maskedValue = masks.phone(value);
    setFormData(prev => ({ ...prev, [field]: maskedValue }));
    
    // Clear error on type
    if (formErrors[field]) setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
    });
  };

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (client.cpf && client.cpf.includes(searchTerm)) ||
                          (client.cnpj && client.cnpj.includes(searchTerm));
    
    const matchesType = filterType === 'Todos' || client.type === filterType;
    const matchesStatus = filterStatus === 'Todos' || client.status === filterStatus;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: any = {};

    if (newClientType === 'PF') {
        if (!formData.name) errors.name = 'Nome obrigatório';
        if (!formData.cpf) errors.cpf = 'CPF obrigatório';
        else if (!isValidCPF(formData.cpf)) errors.cpf = 'CPF Inválido (Dígitos incorretos)';
    } else {
        if (!formData.corporateName) errors.corporateName = 'Razão Social obrigatória';
        if (!formData.cnpj) errors.cnpj = 'CNPJ obrigatório';
        else if (!isValidCNPJ(formData.cnpj)) errors.cnpj = 'CNPJ Inválido (Dígitos incorretos)';
    }

    if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        // Visual feedback handled by rendering error messages
        addToast('Corrija os campos destacados em vermelho.', 'error');
        return;
    }
    
    const tags = formData.tagsInput.split(',').map(t => t.trim()).filter(t => t !== '');

    const newClient: Client = {
      id: `cli-${Date.now()}`,
      name: newClientType === 'PF' ? formData.name : formData.corporateName,
      type: newClientType,
      status: 'Ativo',
      email: formData.email,
      phone: formData.phone,
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(newClientType === 'PF' ? formData.name : formData.corporateName)}&background=random`,
      address: '',
      city: formData.city || 'Não informado',
      state: formData.state || '',
      createdAt: new Date().toLocaleDateString('pt-BR'),
      documents: [], history: [], alerts: [],
      tags: tags,
      cpf: newClientType === 'PF' ? formData.cpf : undefined,
      cnpj: newClientType === 'PJ' ? formData.cnpj : undefined,
      corporateName: newClientType === 'PJ' ? formData.corporateName : undefined
    };
    
    await storageService.saveClient(newClient);
    const updatedClients = await storageService.getClients();
    setClients(updatedClients);
    
    addToast('Cliente cadastrado com sucesso!', 'success');
    setIsModalOpen(false);
    setFormData({ cpf: '', cnpj: '', phone: '', cep: '', rg: '', name: '', corporateName: '', email: '', city: '', state: '', tagsInput: '' });
    setFormErrors({});
  };

  const getStatusColor = (status: ClientStatus) => {
    switch(status) {
      case 'Ativo': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'Inativo': return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
      case 'Lead': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'Em Litígio': return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      case 'Sob Análise': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      default: return 'text-slate-400 bg-slate-500/10';
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64 text-slate-500">Carregando clientes...</div>;
  }

  return (
    <div className="space-y-8 pb-20">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Gestão de Clientes</h1>
          <p className="text-slate-400 mt-1">Acompanhamento da base e cadastro.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all shadow-lg shadow-indigo-500/20 hover:scale-105 w-full md:w-auto"
        >
          <UserPlus size={18} />
          <span>Novo Cliente</span>
        </button>
      </div>

      {/* SEARCH & FILTER BAR */}
      <GlassCard className="p-4">
        <div className="flex flex-col xl:flex-row gap-4">
            
            {/* Search Input */}
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="text" 
                  placeholder="Buscar por nome, e-mail, CPF ou CNPJ..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-2.5 pl-10 pr-10 text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600"
                />
                 {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    <X size={16} />
                  </button>
                )}
            </div>

            {/* Filters Group */}
            <div className="flex flex-col sm:flex-row gap-4">
                {/* Type Filter */}
                <div className="flex bg-slate-900/50 p-1 rounded-xl border border-white/10">
                    {(['Todos', 'PF', 'PJ'] as const).map(type => (
                        <button 
                          key={type}
                          onClick={() => setFilterType(type)}
                          className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                            filterType === type 
                              ? 'bg-indigo-600 text-white shadow-lg' 
                              : 'text-slate-400 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          {type}
                        </button>
                    ))}
                </div>

                {/* Status Filter Dropdown */}
                <div className="relative min-w-[180px]">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                        <Filter size={16} />
                    </div>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as any)}
                        className={`w-full h-full bg-slate-900/50 border rounded-xl py-2.5 pl-10 pr-4 text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer appearance-none transition-all ${filterStatus !== 'Todos' ? 'border-indigo-500/50 ring-2 ring-indigo-500/10' : 'border-white/10'}`}
                    >
                        <option value="Todos" className="bg-slate-900 text-slate-300">Todos os Status</option>
                        <option value="Ativo" className="bg-slate-900 text-emerald-400">Ativo</option>
                        <option value="Lead" className="bg-slate-900 text-blue-400">Lead (Prospecção)</option>
                        <option value="Sob Análise" className="bg-slate-900 text-amber-400">Sob Análise</option>
                        <option value="Em Litígio" className="bg-slate-900 text-rose-400">Em Litígio</option>
                        <option value="Inativo" className="bg-slate-900 text-slate-500">Inativo</option>
                    </select>
                </div>
            </div>
        </div>
      </GlassCard>

      {/* GRID LIST */}
      {filteredClients.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.map((client, idx) => (
            <motion.div
              key={client.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => navigate(`/clients/${client.id}`)}
              className="h-full"
            >
              <GlassCard className="h-full hover:border-indigo-500/40 cursor-pointer transition-all group relative p-6 flex flex-col" hoverEffect>
                <div className="flex justify-between items-start mb-4">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider ${getStatusColor(client.status)}`}>
                      {client.status}
                    </span>
                    {client.type === 'PJ' ? <Building size={16} className="text-slate-500" /> : <User size={16} className="text-slate-500" />}
                </div>

                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-br from-slate-700 to-slate-800 shrink-0 shadow-lg">
                     <img src={client.avatarUrl} alt={client.name} className="w-full h-full rounded-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-lg text-white group-hover:text-indigo-300 transition-colors truncate" title={client.name}>
                        {client.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      {client.type === 'PJ' ? client.cnpj : client.cpf || 'Documento N/A'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 text-sm text-slate-400 flex-1">
                  <div className="flex items-center gap-3">
                    <Mail size={16} className="text-indigo-500/70 shrink-0" />
                    <span className="truncate">{client.email || 'Sem e-mail'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone size={16} className="text-indigo-500/70 shrink-0" />
                    <span>{client.phone || 'Sem telefone'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin size={16} className="text-indigo-500/70 shrink-0" />
                    <span className="truncate">{client.city || 'Cidade não informada'}</span>
                  </div>
                </div>

                {client.tags && client.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1 pt-3 border-t border-white/5">
                        {client.tags.slice(0, 3).map((tag, i) => (
                            <span key={i} className="text-[10px] bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/20 font-medium">
                                {tag}
                            </span>
                        ))}
                        {client.tags.length > 3 && (
                            <span className="text-[10px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">+{client.tags.length - 3}</span>
                        )}
                    </div>
                )}

                <div className={`flex justify-between items-center text-xs ${client.tags && client.tags.length > 0 ? 'mt-3' : 'mt-6 pt-4 border-t border-white/5'}`}>
                   <div className="flex items-center gap-1.5 text-slate-500">
                      <Clock size={12} />
                      <span>Cadastrado em {client.createdAt}</span>
                   </div>
                   <span className="flex items-center gap-1 text-indigo-400 group-hover:translate-x-1 transition-transform font-medium">
                     Ver Detalhes <ChevronRight size={12} />
                   </span>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      ) : (
        /* EMPTY STATE */
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 bg-white/5 rounded-2xl border border-dashed border-white/10">
            <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-4">
               <Users size={40} className="opacity-40" />
            </div>
            <h3 className="text-xl font-medium text-slate-200 mb-2">Nenhum cliente encontrado</h3>
            <p className="text-sm text-slate-400 max-w-md text-center mb-6">
              Não encontramos clientes correspondentes aos seus filtros de busca. Tente limpar os filtros ou cadastre um novo cliente para começar.
            </p>
            <div className="flex gap-3">
                <button 
                    onClick={() => { setSearchTerm(''); setFilterType('Todos'); setFilterStatus('Todos'); }} 
                    className="px-6 py-2 bg-white/10 hover:bg-white/15 text-white rounded-lg font-medium transition-colors"
                >
                  Limpar Filtros
                </button>
                <button 
                    onClick={() => setIsModalOpen(true)} 
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-indigo-500/20"
                >
                  Novo Cliente
                </button>
            </div>
        </div>
      )}

      {/* Cadastro Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Cadastrar Novo Cliente"
        footer={
          <>
            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">Cancelar</button>
            <button onClick={handleCreateClient} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors shadow-lg shadow-indigo-500/20">Salvar Cliente</button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="flex p-1 bg-black/20 rounded-xl">
            <button onClick={() => { setNewClientType('PF'); setFormErrors({}); }} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${newClientType === 'PF' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Pessoa Física</button>
            <button onClick={() => { setNewClientType('PJ'); setFormErrors({}); }} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${newClientType === 'PJ' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Pessoa Jurídica</button>
          </div>

          {newClientType === 'PF' ? (
             <div className="space-y-4 animate-fade-in">
               <div>
                   <label className="text-xs text-slate-400 mb-1 block ml-1">Nome Completo <span className="text-rose-400">*</span></label>
                   <input 
                     type="text" 
                     className={`w-full bg-white/5 p-3 rounded-lg text-white border ${formErrors.name ? 'border-rose-500 bg-rose-500/10 focus:border-rose-500' : 'border-white/10 focus:border-indigo-500'} outline-none transition-colors`}
                     value={formData.name} 
                     onChange={e => setFormData({...formData, name: e.target.value})} 
                   />
                   {formErrors.name && <span className="text-[10px] text-rose-400 ml-1 flex items-center gap-1 mt-1"><AlertCircle size={10} /> {formErrors.name}</span>}
               </div>
               <div>
                   <label className="text-xs text-slate-400 mb-1 block ml-1">CPF <span className="text-rose-400">*</span></label>
                   <input 
                     type="text" 
                     className={`w-full bg-white/5 p-3 rounded-lg text-white border ${formErrors.cpf ? 'border-rose-500 bg-rose-500/10 focus:border-rose-500' : 'border-white/10 focus:border-indigo-500'} outline-none transition-colors`}
                     value={formData.cpf} 
                     onChange={e => handleInputChange('cpf', e.target.value)} 
                     placeholder="000.000.000-00" 
                   />
                   {formErrors.cpf && <span className="text-[10px] text-rose-400 ml-1 flex items-center gap-1 mt-1"><AlertCircle size={10} /> {formErrors.cpf}</span>}
               </div>
             </div>
          ) : (
             <div className="space-y-4 animate-fade-in">
               <div>
                   <label className="text-xs text-slate-400 mb-1 block ml-1">Razão Social <span className="text-rose-400">*</span></label>
                   <input 
                     type="text" 
                     className={`w-full bg-white/5 p-3 rounded-lg text-white border ${formErrors.corporateName ? 'border-rose-500 bg-rose-500/10 focus:border-rose-500' : 'border-white/10 focus:border-indigo-500'} outline-none transition-colors`}
                     value={formData.corporateName} 
                     onChange={e => setFormData({...formData, corporateName: e.target.value})} 
                   />
                   {formErrors.corporateName && <span className="text-[10px] text-rose-400 ml-1">{formErrors.corporateName}</span>}
               </div>
               <div>
                   <label className="text-xs text-slate-400 mb-1 block ml-1">CNPJ <span className="text-rose-400">*</span></label>
                   <input 
                     type="text" 
                     className={`w-full bg-white/5 p-3 rounded-lg text-white border ${formErrors.cnpj ? 'border-rose-500 bg-rose-500/10 focus:border-rose-500' : 'border-white/10 focus:border-indigo-500'} outline-none transition-colors`}
                     value={formData.cnpj} 
                     onChange={e => handleInputChange('cnpj', e.target.value)} 
                     placeholder="00.000.000/0000-00" 
                   />
                   {formErrors.cnpj && <span className="text-[10px] text-rose-400 ml-1 flex items-center gap-1 mt-1"><AlertCircle size={10} /> {formErrors.cnpj}</span>}
               </div>
             </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
                 <label className="text-xs text-slate-400 mb-1 block ml-1">Email</label>
                 <input type="email" className="w-full bg-white/5 p-3 rounded-lg text-white border border-white/10 focus:border-indigo-500 focus:outline-none" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
             </div>
             <div>
                 <label className="text-xs text-slate-400 mb-1 block ml-1">Telefone / WhatsApp</label>
                 <input type="text" className="w-full bg-white/5 p-3 rounded-lg text-white border border-white/10 focus:border-indigo-500 focus:outline-none" value={formData.phone} onChange={e => handleInputChange('phone', e.target.value)} />
             </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
                 <label className="text-xs text-slate-400 mb-1 block ml-1">Cidade</label>
                 <input type="text" className="w-full bg-white/5 p-3 rounded-lg text-white border border-white/10 focus:border-indigo-500 focus:outline-none" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
             </div>
             <div>
                 <label className="text-xs text-slate-400 mb-1 block ml-1">Estado (UF)</label>
                 <input type="text" className="w-full bg-white/5 p-3 rounded-lg text-white border border-white/10 focus:border-indigo-500 focus:outline-none" value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} maxLength={2} style={{ textTransform: 'uppercase' }} />
             </div>
          </div>
          <div className="pt-2 border-t border-white/5">
             <label className="text-xs text-indigo-300 font-bold mb-2 block ml-1 flex items-center gap-1"><Tag size={12} /> Etiquetas (Tags)</label>
             <input 
               type="text" 
               className="w-full bg-white/5 p-3 rounded-lg text-white border border-white/10 focus:border-indigo-500 focus:outline-none text-sm" 
               placeholder="Separe por vírgula (Ex: VIP, Indicação, Trabalhista)"
               value={formData.tagsInput} 
               onChange={e => setFormData({...formData, tagsInput: e.target.value})} 
             />
             <p className="text-[10px] text-slate-500 mt-1 ml-1">As tags ajudam a categorizar e filtrar clientes rapidamente.</p>
          </div>
        </div>
      </Modal>
    </div>
  );
};
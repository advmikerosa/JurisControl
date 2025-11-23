
import React, { useState, useEffect } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { storageService } from '../services/storageService';
import { Search, UserPlus, Filter, Building, User, MapPin, Phone, Mail, ChevronRight, X, Users, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
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

export const Clients: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  
  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'Todos' | ClientType>('Todos');
  const [filterStatus, setFilterStatus] = useState<'Todos' | ClientStatus>('Todos');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newClientType, setNewClientType] = useState<ClientType>('PF');
  
  // Form Data State
  const [formData, setFormData] = useState({
    cpf: '', cnpj: '', phone: '', cep: '', rg: '', name: '', corporateName: '', email: '', city: '', state: ''
  });

  useEffect(() => {
    setClients(storageService.getClients());
  }, []);

  const handleInputChange = (field: string, value: string) => {
    let maskedValue = value;
    if (field === 'cpf') maskedValue = masks.cpf(value);
    if (field === 'cnpj') maskedValue = masks.cnpj(value);
    if (field === 'phone') maskedValue = masks.phone(value);
    setFormData(prev => ({ ...prev, [field]: maskedValue }));
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

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name && !formData.corporateName) {
      addToast('Nome/Razão Social obrigatório.', 'error');
      return;
    }
    
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
      cpf: newClientType === 'PF' ? formData.cpf : undefined,
      cnpj: newClientType === 'PJ' ? formData.cnpj : undefined,
      corporateName: newClientType === 'PJ' ? formData.corporateName : undefined
    };
    
    storageService.saveClient(newClient);
    setClients(storageService.getClients());
    
    addToast('Cliente cadastrado com sucesso!', 'success');
    setIsModalOpen(false);
    setFormData({ cpf: '', cnpj: '', phone: '', cep: '', rg: '', name: '', corporateName: '', email: '', city: '', state: '' });
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
                        className="w-full h-full bg-slate-900/50 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer appearance-none"
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

                <div className="mt-6 pt-4 border-t border-white/5 flex justify-between items-center text-xs">
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
              Não encontramos clientes correspondentes aos seus filtros de busca. Tente limpar os filtros ou cadastre um novo cliente.
            </p>
            <button 
                onClick={() => { setSearchTerm(''); setFilterType('Todos'); setFilterStatus('Todos'); }} 
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
            >
              Limpar Todos os Filtros
            </button>
        </div>
      )}

      {/* Cadastro Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Cadastrar Novo Cliente"
        footer={
          <>
            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors">Cancelar</button>
            <button onClick={handleCreateClient} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors">Salvar Cliente</button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="flex p-1 bg-black/20 rounded-xl">
            <button onClick={() => setNewClientType('PF')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${newClientType === 'PF' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Pessoa Física</button>
            <button onClick={() => setNewClientType('PJ')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${newClientType === 'PJ' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Pessoa Jurídica</button>
          </div>

          {newClientType === 'PF' ? (
             <div className="space-y-4">
               <div>
                   <label className="text-xs text-slate-400 mb-1 block ml-1">Nome Completo</label>
                   <input type="text" className="w-full bg-white/5 p-3 rounded-lg text-white border border-white/10 focus:border-indigo-500 focus:outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
               </div>
               <div>
                   <label className="text-xs text-slate-400 mb-1 block ml-1">CPF</label>
                   <input type="text" className="w-full bg-white/5 p-3 rounded-lg text-white border border-white/10 focus:border-indigo-500 focus:outline-none" value={formData.cpf} onChange={e => handleInputChange('cpf', e.target.value)} placeholder="000.000.000-00" />
               </div>
             </div>
          ) : (
             <div className="space-y-4">
               <div>
                   <label className="text-xs text-slate-400 mb-1 block ml-1">Razão Social</label>
                   <input type="text" className="w-full bg-white/5 p-3 rounded-lg text-white border border-white/10 focus:border-indigo-500 focus:outline-none" value={formData.corporateName} onChange={e => setFormData({...formData, corporateName: e.target.value})} />
               </div>
               <div>
                   <label className="text-xs text-slate-400 mb-1 block ml-1">CNPJ</label>
                   <input type="text" className="w-full bg-white/5 p-3 rounded-lg text-white border border-white/10 focus:border-indigo-500 focus:outline-none" value={formData.cnpj} onChange={e => handleInputChange('cnpj', e.target.value)} placeholder="00.000.000/0000-00" />
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
        </div>
      </Modal>
    </div>
  );
};

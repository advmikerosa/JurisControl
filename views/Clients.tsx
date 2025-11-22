
import React, { useState, useEffect } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { storageService } from '../services/storageService';
import { Search, UserPlus, MoreHorizontal, Filter, Building, User, MapPin, Phone, Mail, ChevronRight, Trash2, X, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../context/ToastContext';
import { Client, ClientType } from '../types';

// Masks (Mantidas)
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
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'Todos' | ClientType>('Todos');
  
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
                          client.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'Todos' || client.type === filterType;
    return matchesSearch && matchesType;
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

  return (
    <div className="space-y-8">
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
        <div className="flex flex-col md:flex-row items-stretch gap-4">
            <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input 
                  type="text" 
                  placeholder="Buscar por nome, e-mail ou documento..." 
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
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 shrink-0">
                {(['Todos', 'PF', 'PJ'] as const).map(type => (
                    <button 
                      key={type}
                      onClick={() => setFilterType(type)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        filterType === type 
                          ? 'bg-indigo-600 text-white shadow-lg' 
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {type}
                    </button>
                ))}
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
              <GlassCard className="h-full hover:border-indigo-500/40 cursor-pointer transition-all group relative p-6" hoverEffect>
                <div className="absolute top-5 right-5">
                  <div className={`w-2.5 h-2.5 rounded-full ${client.status === 'Ativo' ? 'bg-emerald-500' : 'bg-slate-500'} shadow-[0_0_8px_currentColor]`}></div>
                </div>

                <div className="flex items-center gap-5 mb-6">
                  <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-br from-slate-700 to-slate-800 shrink-0">
                     <img src={client.avatarUrl} alt={client.name} className="w-full h-full rounded-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-lg text-white group-hover:text-indigo-300 transition-colors truncate">{client.name}</h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-white/5 text-slate-400 border border-white/5 mt-1">
                      {client.type === 'PJ' ? <Building size={10} /> : <User size={10} />}
                      {client.type}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 text-sm text-slate-400">
                  <div className="flex items-center gap-3">
                    <Mail size={16} className="text-slate-500 shrink-0" />
                    <span className="truncate">{client.email || 'Sem e-mail'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone size={16} className="text-slate-500 shrink-0" />
                    <span>{client.phone || 'Sem telefone'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin size={16} className="text-slate-500 shrink-0" />
                    <span className="truncate">{client.city || 'Cidade não informada'}</span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-white/5 flex justify-between items-center text-xs">
                   <span className="text-slate-500">Desde: {client.createdAt}</span>
                   <span className="flex items-center gap-1 text-indigo-400 group-hover:translate-x-1 transition-transform font-medium">
                     Ver Perfil <ChevronRight size={12} />
                   </span>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      ) : (
        /* EMPTY STATE */
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4">
               <Users size={40} className="opacity-40" />
            </div>
            <h3 className="text-xl font-medium text-slate-200 mb-2">Nenhum cliente encontrado</h3>
            <p className="text-sm text-slate-400 max-w-md text-center mb-6">
              Não encontramos clientes correspondentes aos seus filtros de busca. Tente limpar os filtros ou cadastre um novo cliente.
            </p>
            <button onClick={() => { setSearchTerm(''); setFilterType('Todos'); }} className="text-indigo-400 hover:text-indigo-300 font-medium">
              Limpar Filtros
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
               <input type="text" placeholder="Nome Completo" className="w-full bg-white/5 p-3 rounded-lg text-white border border-white/10 focus:border-indigo-500 focus:outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
               <input type="text" placeholder="CPF" className="w-full bg-white/5 p-3 rounded-lg text-white border border-white/10 focus:border-indigo-500 focus:outline-none" value={formData.cpf} onChange={e => handleInputChange('cpf', e.target.value)} />
             </div>
          ) : (
             <div className="space-y-4">
               <input type="text" placeholder="Razão Social" className="w-full bg-white/5 p-3 rounded-lg text-white border border-white/10 focus:border-indigo-500 focus:outline-none" value={formData.corporateName} onChange={e => setFormData({...formData, corporateName: e.target.value})} />
               <input type="text" placeholder="CNPJ" className="w-full bg-white/5 p-3 rounded-lg text-white border border-white/10 focus:border-indigo-500 focus:outline-none" value={formData.cnpj} onChange={e => handleInputChange('cnpj', e.target.value)} />
             </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <input type="email" placeholder="Email" className="w-full bg-white/5 p-3 rounded-lg text-white border border-white/10 focus:border-indigo-500 focus:outline-none" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
             <input type="text" placeholder="Telefone" className="w-full bg-white/5 p-3 rounded-lg text-white border border-white/10 focus:border-indigo-500 focus:outline-none" value={formData.phone} onChange={e => handleInputChange('phone', e.target.value)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <input type="text" placeholder="Cidade" className="w-full bg-white/5 p-3 rounded-lg text-white border border-white/10 focus:border-indigo-500 focus:outline-none" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
             <input type="text" placeholder="UF" className="w-full bg-white/5 p-3 rounded-lg text-white border border-white/10 focus:border-indigo-500 focus:outline-none" value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} />
          </div>
        </div>
      </Modal>
    </div>
  );
};

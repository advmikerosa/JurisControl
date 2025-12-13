
import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { Building, LogIn, AtSign, MapPin, Loader2 } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { storageService } from '../services/storageService';

interface OfficeSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'create' | 'join';
}

export const OfficeSetupModal: React.FC<OfficeSetupModalProps> = ({ isOpen, onClose, initialMode = 'create' }) => {
  const { user, updateProfile } = useAuth();
  const { addToast } = useToast();
  
  const [mode, setMode] = useState<'create' | 'join'>(initialMode);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form States
  const [officeName, setOfficeName] = useState('');
  const [officeHandle, setOfficeHandle] = useState('');
  const [officeLocation, setOfficeLocation] = useState('');
  const [joinHandle, setJoinHandle] = useState('');

  // Reset form when opening/changing modes could be implemented here if needed

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!officeName || !officeHandle) {
      addToast('Preencha nome e identificador.', 'error');
      return;
    }
    
    if (!/^@[a-z0-9_]{3,20}$/.test(officeHandle)) {
      addToast('O identificador deve começar com @, ter letras minúsculas, números ou underline (3-20 caracteres).', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const newOffice = await storageService.createOffice({
        name: officeName,
        handle: officeHandle,
        location: officeLocation
      });
      
      updateProfile({
        offices: [...(user?.offices || []), newOffice.id],
        currentOfficeId: newOffice.id
      });
      
      addToast('Escritório criado com sucesso!', 'success');
      onClose();
      // Reset form
      setOfficeName('');
      setOfficeHandle('');
      setOfficeLocation('');
    } catch (error: any) {
      addToast(error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinHandle.startsWith('@')) {
        addToast('O identificador deve começar com @.', 'error');
        return;
    }
    
    setIsLoading(true);
    try {
        const joinedOffice = await storageService.joinOffice(joinHandle);
        updateProfile({
            offices: [...(user?.offices || []), joinedOffice.id],
            currentOfficeId: joinedOffice.id
        });
        
        addToast(`Você entrou em ${joinedOffice.name}!`, 'success');
        onClose();
        setJoinHandle('');
    } catch (error: any) {
        addToast(error.message, 'error');
    } finally {
        setIsLoading(false);
    }
  };

  const onHandleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let val = e.target.value.toLowerCase().replace(/[^a-z0-9_@]/g, '');
      if (val.length > 0 && !val.startsWith('@')) val = '@' + val;
      setOfficeHandle(val);
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={mode === 'create' ? 'Criar Novo Escritório' : 'Entrar em Escritório'}
      maxWidth="max-w-md"
      footer={null} // Custom footer inside forms
    >
      <div className="flex bg-slate-100 dark:bg-black/20 rounded-lg p-1 mb-6">
        <button 
          onClick={() => setMode('create')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'create' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}
        >
          Criar Novo
        </button>
        <button 
          onClick={() => setMode('join')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'join' ? 'bg-emerald-600 text-white shadow' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}
        >
          Entrar Existente
        </button>
      </div>

      {mode === 'create' ? (
        <form onSubmit={handleCreate} className="space-y-4 animate-fade-in">
           <div className="space-y-2">
              <label className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase ml-1">Nome do Escritório</label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                   type="text" 
                   placeholder="Ex: Silva & Associados"
                   value={officeName}
                   onChange={(e) => setOfficeName(e.target.value)}
                   className="w-full bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg p-3 pl-10 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none transition-colors"
                />
              </div>
           </div>
           <div className="space-y-2">
              <label className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase ml-1">Identificador (@handle)</label>
              <div className="relative">
                 <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                 <input 
                    type="text" 
                    placeholder="@silvaassociados"
                    value={officeHandle}
                    onChange={onHandleChange}
                    className="w-full bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg p-3 pl-10 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none transition-colors font-mono"
                 />
              </div>
              <p className="text-[10px] text-slate-500 ml-1">Único. Use letras minúsculas, números e underline.</p>
           </div>
           <div className="space-y-2">
              <label className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase ml-1">Localização</label>
              <div className="relative">
                 <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                 <input 
                    type="text" 
                    placeholder="Cidade - UF"
                    value={officeLocation}
                    onChange={(e) => setOfficeLocation(e.target.value)}
                    className="w-full bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg p-3 pl-10 text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none transition-colors"
                 />
              </div>
           </div>
           <div className="flex gap-3 justify-end pt-4 border-t border-slate-200 dark:border-white/5 mt-6">
              <button 
                type="button" 
                onClick={onClose}
                className="px-4 py-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                disabled={isLoading}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium shadow-lg shadow-indigo-500/20 flex items-center gap-2 disabled:opacity-70"
              >
                {isLoading && <Loader2 size={16} className="animate-spin" />}
                Criar Escritório
              </button>
           </div>
        </form>
      ) : (
        <form onSubmit={handleJoin} className="space-y-4 animate-fade-in">
           <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl mb-4">
              <p className="text-sm text-emerald-800 dark:text-emerald-200">
                Peça ao administrador do escritório o <strong>Handle Único</strong> (ex: @empresa_legal).
              </p>
           </div>
           <div className="space-y-2">
              <label className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase ml-1">Identificador do Escritório</label>
              <div className="relative">
                 <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                 <input 
                    type="text" 
                    placeholder="@exemplo_adv"
                    value={joinHandle}
                    onChange={(e) => setJoinHandle(e.target.value)}
                    className="w-full bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg p-3 pl-10 text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none transition-colors font-mono"
                 />
              </div>
           </div>
           <div className="flex gap-3 justify-end pt-4 border-t border-slate-200 dark:border-white/5 mt-6">
              <button 
                type="button" 
                onClick={onClose}
                className="px-4 py-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                disabled={isLoading}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium shadow-lg shadow-emerald-500/20 flex items-center gap-2 disabled:opacity-70"
              >
                {isLoading && <Loader2 size={16} className="animate-spin" />}
                Entrar
              </button>
           </div>
        </form>
      )}
    </Modal>
  );
};

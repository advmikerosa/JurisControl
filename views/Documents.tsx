
import React, { useState, useEffect } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { FileText, Upload, Search, Download, Trash2, File, Image as ImageIcon } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { storageService } from '../services/storageService';
import { SystemDocument } from '../types';

export const Documents: React.FC = () => {
  const { addToast } = useToast();
  const [docs, setDocs] = useState<SystemDocument[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setDocs(storageService.getDocuments());
  }, []);

  const handleUpload = () => {
    // Simulação de upload que cria um registro no banco
    const fileNames = ['Contrato Honorários.pdf', 'Procuração Geral.docx', 'Declaração de Hipossuficiência.pdf', 'Identidade.png'];
    const randomName = fileNames[Math.floor(Math.random() * fileNames.length)];
    
    const newDoc: SystemDocument = { 
      id: Date.now().toString(), 
      name: randomName, 
      size: `${(Math.random() * 2 + 0.1).toFixed(1)} MB`, 
      type: randomName.split('.').pop()?.toUpperCase() || 'FILE', 
      date: new Date().toLocaleDateString('pt-BR'),
      category: 'Geral'
    };
    
    storageService.saveDocument(newDoc);
    setDocs(storageService.getDocuments());
    addToast('Documento enviado com sucesso!', 'success');
  };

  const handleDelete = (id: string) => {
    if (confirm('Deseja excluir este arquivo?')) {
      storageService.deleteDocument(id);
      setDocs(storageService.getDocuments());
      addToast('Documento excluído.', 'info');
    }
  };

  const filteredDocs = docs.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Documentos</h1>
          <p className="text-slate-400 mt-1">Repositório central de arquivos e modelos.</p>
        </div>
        <button 
          onClick={handleUpload} 
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors shadow-lg shadow-indigo-500/20 font-medium hover:scale-105 w-full md:w-auto"
        >
          <Upload size={18} /> 
          <span>Upload de Arquivo</span>
        </button>
      </div>

      {/* SEARCH BAR */}
      <GlassCard className="p-4">
        <div className="flex items-center gap-4">
          <Search size={18} className="text-slate-500 ml-2" />
          <input 
            type="text" 
            placeholder="Buscar documentos..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-none outline-none text-white w-full placeholder:text-slate-600 text-sm" 
          />
        </div>
      </GlassCard>

      {/* TABLE */}
      <GlassCard className="p-6">
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500 border-b border-white/10">
            <tr>
              <th className="pb-4 pl-2 font-medium">Nome</th>
              <th className="pb-4 font-medium">Data</th>
              <th className="pb-4 font-medium">Tamanho</th>
              <th className="pb-4 pr-2 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredDocs.length > 0 ? (
              filteredDocs.map(doc => (
                <tr key={doc.id} className="group hover:bg-white/5 transition-colors">
                  <td className="py-4 pl-2 text-white flex items-center gap-3">
                     <div className="p-2 rounded bg-indigo-500/20 text-indigo-300">
                       {['JPG','PNG','IMG'].includes(doc.type) ? <ImageIcon size={18} /> : <FileText size={18} />}
                     </div>
                     <span className="font-medium">{doc.name}</span>
                  </td>
                  <td className="py-4 text-slate-400">{doc.date}</td>
                  <td className="py-4 text-slate-400">{doc.size}</td>
                  <td className="py-4 pr-2 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-emerald-400 transition-colors" title="Baixar"><Download size={18} /></button>
                      <button onClick={() => handleDelete(doc.id)} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-rose-400 transition-colors" title="Excluir"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={4} className="py-16 text-center text-slate-500">Nenhum arquivo encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
};

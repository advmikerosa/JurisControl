
import React, { useState, useEffect, useRef } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { FileText, Upload, Search, Download, Trash2, File, Image as ImageIcon, Loader2, Eye, X, FolderPlus } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { storageService } from '../services/storageService';
import { SystemDocument } from '../types';
import { Modal } from '../components/ui/Modal';

export const Documents: React.FC = () => {
  const { addToast } = useToast();
  const [docs, setDocs] = useState<SystemDocument[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  // Preview State
  const [previewDoc, setPreviewDoc] = useState<SystemDocument | null>(null);
  
  // Ref for hidden file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadDocs = async () => {
      setDocs(await storageService.getDocuments());
    };
    loadDocs();
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation: Max size 10MB
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        addToast('Arquivo muito grande. Máximo permitido: 10MB', 'error');
        e.target.value = ''; // Reset input
        return;
    }

    // Validation: Allowed types
    const allowedTypes = [
        'application/pdf', 
        'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
        'image/png', 
        'image/jpeg',
        'text/plain'
    ];
    if (!allowedTypes.includes(file.type)) {
        addToast('Formato de arquivo não suportado. Use PDF, DOCX, PNG, JPG ou TXT.', 'error');
        e.target.value = '';
        return;
    }

    setIsUploading(true);

    // Simulate upload delay
    setTimeout(async () => {
        try {
            const newDoc: SystemDocument = {
                id: Date.now().toString(),
                name: file.name,
                size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
                type: file.name.split('.').pop()?.toUpperCase() || 'FILE',
                date: new Date().toLocaleDateString('pt-BR'),
                category: 'Upload'
            };

            await storageService.saveDocument(newDoc);
            setDocs(await storageService.getDocuments());
            addToast('Documento enviado com sucesso!', 'success');
        } catch (error) {
            addToast('Erro ao enviar documento.', 'error');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }, 1500);
  };

  const triggerUpload = () => {
      fileInputRef.current?.click();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deseja realmente excluir este arquivo?')) {
      await storageService.deleteDocument(id);
      setDocs(await storageService.getDocuments());
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
        
        <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            className="hidden" 
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"
        />
        
        <button 
          onClick={triggerUpload} 
          disabled={isUploading}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors shadow-lg shadow-indigo-500/20 font-medium hover:scale-105 w-full md:w-auto disabled:opacity-70 disabled:hover:scale-100"
        >
          {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
          <span>{isUploading ? 'Enviando...' : 'Upload de Arquivo'}</span>
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

      {/* TABLE OR EMPTY STATE */}
      <GlassCard className="p-0 overflow-hidden min-h-[400px]">
        {filteredDocs.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500 border-b border-white/10 bg-white/5">
              <tr>
                <th className="py-4 pl-6 font-medium">Nome</th>
                <th className="py-4 font-medium">Data</th>
                <th className="py-4 font-medium">Tamanho</th>
                <th className="py-4 pr-6 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredDocs.map(doc => (
                <tr key={doc.id} className="group hover:bg-white/5 transition-colors">
                  <td className="py-4 pl-6 text-white flex items-center gap-3 cursor-pointer" onClick={() => setPreviewDoc(doc)}>
                     <div className="p-2 rounded bg-indigo-500/20 text-indigo-300">
                       {['JPG','PNG','IMG'].includes(doc.type) ? <ImageIcon size={18} /> : <FileText size={18} />}
                     </div>
                     <span className="font-medium group-hover:text-indigo-300 transition-colors">{doc.name}</span>
                  </td>
                  <td className="py-4 text-slate-400">{doc.date}</td>
                  <td className="py-4 text-slate-400">{doc.size}</td>
                  <td className="py-4 pr-6 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setPreviewDoc(doc)} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-indigo-400 transition-colors" title="Visualizar"><Eye size={18} /></button>
                      <button className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-emerald-400 transition-colors" title="Baixar"><Download size={18} /></button>
                      <button onClick={() => handleDelete(doc.id)} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-rose-400 transition-colors" title="Excluir"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-20 text-slate-500 gap-4">
             <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center">
                <FolderPlus size={40} className="opacity-40" />
             </div>
             <div className="text-center">
                <h3 className="text-lg font-medium text-slate-300 mb-1">Nenhum arquivo encontrado</h3>
                <p className="text-sm text-slate-500">Nenhum documento foi adicionado ainda. Clique em 'Upload de Arquivo' para começar.</p>
             </div>
             <button 
                onClick={triggerUpload}
                className="mt-2 px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors text-sm border border-white/10"
             >
                Fazer Upload Agora
             </button>
          </div>
        )}
      </GlassCard>

      {/* Preview Modal */}
      <Modal isOpen={!!previewDoc} onClose={() => setPreviewDoc(null)} title={previewDoc?.name || 'Visualizar'} maxWidth="max-w-4xl">
          <div className="h-[60vh] bg-slate-900 rounded-lg border border-white/10 flex flex-col items-center justify-center relative overflow-hidden">
              {previewDoc && ['JPG', 'PNG', 'IMG'].includes(previewDoc.type) ? (
                  <div className="flex flex-col items-center text-slate-500">
                      <ImageIcon size={64} className="mb-4 opacity-50" />
                      <p>Visualização de imagem simulada</p>
                  </div>
              ) : (
                  <div className="flex flex-col items-center text-slate-500 p-12 text-center">
                      <FileText size={64} className="mb-4 opacity-50" />
                      <h3 className="text-lg font-medium text-slate-300 mb-2">{previewDoc?.name}</h3>
                      <p className="text-sm max-w-md">
                          Este é um ambiente de demonstração. Em produção, o PDF ou arquivo DOCX seria renderizado aqui usando um visualizador apropriado ou via iframe.
                      </p>
                      <button className="mt-6 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                          <Download size={16} /> Baixar Arquivo Original
                      </button>
                  </div>
              )}
          </div>
      </Modal>
    </div>
  );
};

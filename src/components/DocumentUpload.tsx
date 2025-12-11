
import React, { useState, useRef } from 'react';
import { Upload, X, FileText, Loader2, CheckCircle, RefreshCw } from 'lucide-react';
import { SystemDocument } from '../types';
import { useToast } from '../context/ToastContext';

interface DocumentUploadProps {
  onSave: (file: File, meta: { title: string, category: string }) => Promise<void>;
  onCancel: () => void;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({ onSave, onCancel }) => {
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  
  // Manual Metadata State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Processual');

  // Handlers for Drag & Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (selectedFile: File) => {
    const validTypes = ['image/jpeg', 'image/png', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(selectedFile.type)) {
      addToast('Formato não suportado. Use PDF, DOCX, PNG ou JPG.', 'error');
      return;
    }
    if (selectedFile.size > 20 * 1024 * 1024) { // 20MB
      addToast('Arquivo muito grande (Máx: 20MB).', 'error');
      return;
    }

    setFile(selectedFile);
    setTitle(selectedFile.name); // Default title
    
    // Create preview for images
    if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target?.result as string);
        reader.readAsDataURL(selectedFile);
    } else {
        setPreview(null);
    }
  };

  const handleConfirm = async () => {
    if (file && title) {
        setIsProcessing(true);
        await onSave(file, { title, category });
        setIsProcessing(false);
        // Reset state after save (though parent usually closes modal)
        setFile(null);
        setPreview(null);
        setTitle('');
    } else {
        addToast('Preencha os campos obrigatórios.', 'warning');
    }
  };

  return (
    <div className="bg-[#0f172a] rounded-xl border border-white/10 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
            <h3 className="text-white font-bold flex items-center gap-2">
                <FileText className="text-indigo-400" size={20} />
                Upload de Documento
            </h3>
            <button onClick={onCancel} className="text-slate-400 hover:text-white"><X size={20}/></button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            {!file ? (
                <div 
                    className={`border-2 border-dashed rounded-2xl h-64 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${dragActive ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/10 hover:border-white/20 bg-white/5'}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <Upload size={48} className={`mb-4 ${dragActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                    <p className="text-slate-300 font-medium">Arraste seu documento aqui</p>
                    <p className="text-slate-500 text-sm mt-1">PDF, DOCX, PNG ou JPG (Máx 20MB)</p>
                    <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.doc,.docx,image/png,image/jpeg" />
                </div>
            ) : (
                <div className="flex flex-col lg:flex-row gap-6 animate-fade-in">
                    {/* Preview / File Info */}
                    <div className="w-full lg:w-1/3 space-y-4">
                        <div className="bg-black/40 rounded-xl overflow-hidden border border-white/10 h-64 flex items-center justify-center relative group">
                            {preview ? (
                                <img src={preview} alt="Preview" className="w-full h-full object-contain" />
                            ) : (
                                <FileText size={64} className="text-slate-600" />
                            )}
                            <button onClick={() => { setFile(null); }} className="absolute top-2 right-2 bg-black/60 p-1.5 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                            <p className="text-sm text-white font-medium truncate">{file.name}</p>
                            <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                    </div>

                    {/* Metadata Form */}
                    <div className="w-full lg:w-2/3 space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs text-slate-400">Título do Documento</label>
                                <input 
                                    type="text" 
                                    value={title} 
                                    onChange={e => setTitle(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white text-sm outline-none focus:border-indigo-500 transition-colors"
                                    placeholder="Ex: Petição Inicial"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-slate-400">Categoria</label>
                                <select 
                                    value={category} 
                                    onChange={e => setCategory(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white text-sm outline-none focus:border-indigo-500 cursor-pointer"
                                >
                                    <option value="Processual" className="bg-slate-900">Processual</option>
                                    <option value="Administrativo" className="bg-slate-900">Administrativo</option>
                                    <option value="Financeiro" className="bg-slate-900">Financeiro</option>
                                    <option value="Provas" className="bg-slate-900">Provas</option>
                                    <option value="Outros" className="bg-slate-900">Outros</option>
                                </select>
                            </div>
                        </div>

                        <button 
                            onClick={handleConfirm}
                            disabled={isProcessing}
                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                            {isProcessing ? 'Enviando...' : 'Confirmar Upload'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

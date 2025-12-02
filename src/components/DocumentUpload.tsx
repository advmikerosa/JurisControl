
import React, { useState, useRef } from 'react';
import { Upload, X, FileText, Loader2, CheckCircle, AlertTriangle, RefreshCw, Calendar, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { aiService } from '../services/aiService';
import { ExtractedMovementData, Priority, ExtractedDeadline } from '../types';
import { useToast } from '../context/ToastContext';

interface DocumentUploadProps {
  onSave: (data: ExtractedMovementData, file: File) => Promise<void>;
  onCancel: () => void;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({ onSave, onCancel }) => {
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedMovementData | null>(null);
  const [dragActive, setDragActive] = useState(false);

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
    const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(selectedFile.type)) {
      addToast('Formato não suportado. Use JPG, PNG ou PDF.', 'error');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) { // 10MB
      addToast('Arquivo muito grande (Máx: 10MB).', 'error');
      return;
    }

    setFile(selectedFile);
    // Create preview for images
    if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target?.result as string);
        reader.readAsDataURL(selectedFile);
    } else {
        setPreview(null); // PDF preview logic omitted for brevity
    }
    setExtractedData(null); // Reset previous data
  };

  const processDocument = async () => {
    if (!file) return;
    setIsProcessing(true);

    try {
      // Convert file to Base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        
        try {
            const result = await aiService.analyzeLegalDocument(base64Data, file.type);
            setExtractedData(result);
            addToast('Documento analisado com sucesso!', 'success');
        } catch (error) {
            console.error(error);
            addToast('Erro ao processar documento com IA.', 'error');
        } finally {
            setIsProcessing(false);
        }
      };
    } catch (e) {
      setIsProcessing(false);
      addToast('Erro ao ler arquivo.', 'error');
    }
  };

  const handleConfirm = async () => {
    if (extractedData && file) {
        await onSave(extractedData, file);
    }
  };

  const removeDeadline = (idx: number) => {
      if (extractedData) {
          const newDeadlines = [...extractedData.deadlines];
          newDeadlines.splice(idx, 1);
          setExtractedData({ ...extractedData, deadlines: newDeadlines });
      }
  };

  const addDeadline = () => {
      if (extractedData) {
          const newDeadline: ExtractedDeadline = {
              title: 'Novo Prazo',
              date: new Date().toISOString().split('T')[0],
              priority: Priority.MEDIUM,
              description: ''
          };
          setExtractedData({ ...extractedData, deadlines: [...extractedData.deadlines, newDeadline] });
      }
  };

  return (
    <div className="bg-[#0f172a] rounded-xl border border-white/10 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
            <h3 className="text-white font-bold flex items-center gap-2">
                <FileText className="text-indigo-400" size={20} />
                Upload Inteligente (OCR + IA)
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
                    <p className="text-slate-500 text-sm mt-1">PDF, PNG ou JPG (Máx 10MB)</p>
                    <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept=".pdf,image/png,image/jpeg" />
                </div>
            ) : (
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Preview / File Info */}
                    <div className="w-full lg:w-1/3 space-y-4">
                        <div className="bg-black/40 rounded-xl overflow-hidden border border-white/10 h-64 flex items-center justify-center relative group">
                            {preview ? (
                                <img src={preview} alt="Preview" className="w-full h-full object-contain" />
                            ) : (
                                <FileText size={64} className="text-slate-600" />
                            )}
                            <button onClick={() => { setFile(null); setExtractedData(null); }} className="absolute top-2 right-2 bg-black/60 p-1.5 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                            <p className="text-sm text-white font-medium truncate">{file.name}</p>
                            <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        
                        {!extractedData && !isProcessing && (
                            <button 
                                onClick={processDocument}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                            >
                                <RefreshCw size={18} /> Processar com IA
                            </button>
                        )}
                    </div>

                    {/* Results / Processing */}
                    <div className="w-full lg:w-2/3">
                        {isProcessing ? (
                            <div className="h-full flex flex-col items-center justify-center space-y-4 py-12">
                                <Loader2 size={48} className="text-indigo-500 animate-spin" />
                                <div className="text-center">
                                    <h4 className="text-white font-medium text-lg">Analisando Documento...</h4>
                                    <p className="text-slate-400 text-sm">O JurisAI está extraindo prazos e dados.</p>
                                </div>
                            </div>
                        ) : extractedData ? (
                            <div className="space-y-6 animate-fade-in">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-indigo-300 font-bold uppercase text-xs tracking-wider flex items-center gap-2">
                                        <CheckCircle size={14} /> Dados Extraídos (Confiança: {extractedData.confidence}%)
                                    </h4>
                                </div>

                                {/* Form de Revisão */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-400">Tipo de Movimentação</label>
                                        <select 
                                            value={extractedData.type} 
                                            onChange={e => setExtractedData({...extractedData, type: e.target.value as any})}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500"
                                        >
                                            {["Andamento", "Despacho", "Petição", "Audiência", "Nota", "Sentença", "Decisão"].map(t => <option key={t} value={t} className="bg-slate-900">{t}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-400">Data do Documento</label>
                                        <input 
                                            type="date" 
                                            value={extractedData.date}
                                            onChange={e => setExtractedData({...extractedData, date: e.target.value})}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500 scheme-dark"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs text-slate-400">Resumo / Conteúdo</label>
                                    <textarea 
                                        rows={3}
                                        value={extractedData.summary}
                                        onChange={e => setExtractedData({...extractedData, summary: e.target.value})}
                                        className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white text-sm outline-none focus:border-indigo-500 resize-none"
                                    />
                                </div>

                                {/* Prazos Identificados */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center pb-2 border-b border-white/5">
                                        <label className="text-xs text-amber-400 font-bold flex items-center gap-1"><AlertTriangle size={12}/> Prazos / Tarefas Identificadas</label>
                                        <button onClick={addDeadline} className="text-[10px] bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-white transition-colors">Adicionar</button>
                                    </div>
                                    
                                    {extractedData.deadlines.length > 0 ? (
                                        extractedData.deadlines.map((dl, idx) => (
                                            <div key={idx} className="p-3 bg-white/5 rounded-lg border border-white/10 space-y-2 relative group">
                                                <button onClick={() => removeDeadline(idx)} className="absolute top-2 right-2 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"><X size={14}/></button>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <input 
                                                        type="text" 
                                                        value={dl.title} 
                                                        onChange={e => {
                                                            const newDl = [...extractedData.deadlines];
                                                            newDl[idx].title = e.target.value;
                                                            setExtractedData({...extractedData, deadlines: newDl});
                                                        }}
                                                        className="bg-transparent border-b border-white/10 text-white text-sm font-medium focus:border-indigo-500 outline-none pb-1"
                                                    />
                                                    <input 
                                                        type="date" 
                                                        value={dl.date}
                                                        onChange={e => {
                                                            const newDl = [...extractedData.deadlines];
                                                            newDl[idx].date = e.target.value;
                                                            setExtractedData({...extractedData, deadlines: newDl});
                                                        }}
                                                        className="bg-transparent border-b border-white/10 text-white text-sm text-right focus:border-indigo-500 outline-none pb-1 scheme-dark"
                                                    />
                                                </div>
                                                <div className="flex gap-2 items-center">
                                                    <select 
                                                        value={dl.priority}
                                                        onChange={e => {
                                                            const newDl = [...extractedData.deadlines];
                                                            newDl[idx].priority = e.target.value as Priority;
                                                            setExtractedData({...extractedData, deadlines: newDl});
                                                        }}
                                                        className="bg-black/30 text-[10px] rounded px-1 py-0.5 text-slate-300 border-none outline-none"
                                                    >
                                                        <option value="Alta" className="bg-slate-900">Alta</option>
                                                        <option value="Média" className="bg-slate-900">Média</option>
                                                        <option value="Baixa" className="bg-slate-900">Baixa</option>
                                                    </select>
                                                    <input 
                                                        type="text" 
                                                        value={dl.description || ''}
                                                        placeholder="Detalhes..."
                                                        onChange={e => {
                                                            const newDl = [...extractedData.deadlines];
                                                            newDl[idx].description = e.target.value;
                                                            setExtractedData({...extractedData, deadlines: newDl});
                                                        }}
                                                        className="flex-1 bg-transparent text-xs text-slate-400 focus:text-white outline-none"
                                                    />
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-xs text-slate-500 italic py-2 text-center">Nenhum prazo fatal identificado automaticamente.</p>
                                    )}
                                </div>

                                <button 
                                    onClick={handleConfirm}
                                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                                >
                                    <CheckCircle size={18} /> Confirmar e Salvar
                                </button>
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-500 border-2 border-dashed border-white/5 rounded-xl">
                                <div className="text-center">
                                    <FileText className="mx-auto mb-2 opacity-20" size={40} />
                                    <p className="text-sm">Aguardando arquivo...</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

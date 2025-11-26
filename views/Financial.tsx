
import React, { useState, useEffect, useMemo } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { storageService } from '../services/storageService';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, 
  PieChart, Pie, AreaChart, Area
} from 'recharts';
import { 
  DollarSign, ArrowDownCircle, ArrowUpCircle, Download, Plus, 
  Calendar, Filter, CheckCircle, AlertCircle, Clock, LayoutGrid, PieChart as PieIcon, List
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { Modal } from '../components/ui/Modal';
import { FinancialRecord, Client, FinancialStatus } from '../types';
import { motion } from 'framer-motion';

const COLORS = ['#818cf8', '#fb7185', '#38bdf8', '#a78bfa', '#34d399', '#f472b6'];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatDate = (dateString: string) => {
  if(!dateString) return '-';
  // Handle various formats
  if (dateString.includes('T')) dateString = dateString.split('T')[0];
  if (dateString.includes('/')) return dateString; // Already formatted
  
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
};

export const Financial: React.FC = () => {
  const { addToast } = useToast();
  const [transactions, setTransactions] = useState<FinancialRecord[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'list' | 'reports'>('overview');
  
  // Filtros
  const [filterStatus, setFilterStatus] = useState<'Todos' | FinancialStatus>('Todos');
  const [filterType, setFilterType] = useState<'Todos' | 'Receita' | 'Despesa'>('Todos');
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    type: 'Receita' as 'Receita' | 'Despesa',
    category: 'Honorários',
    status: 'Pendente' as FinancialStatus,
    dueDate: new Date().toISOString().slice(0, 10),
    clientId: '',
    installments: '1'
  });

  useEffect(() => {
    const loadData = async () => {
      const [loadedTransactions, loadedClients] = await Promise.all([
        storageService.getFinancials(),
        storageService.getClients()
      ]);
      setTransactions(loadedTransactions);
      setClients(loadedClients);
    };
    loadData();
  }, []);

  // --- Cálculos de Resumo ---
  const summary = useMemo(() => {
    const currentMonthTrans = transactions.filter(t => t.dueDate.startsWith(filterMonth));
    
    const revenue = currentMonthTrans
      .filter(t => t.type === 'Receita')
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
      
    const expenses = currentMonthTrans
      .filter(t => t.type === 'Despesa')
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
      
    const overdue = transactions
      .filter(t => t.status === 'Atrasado' && t.type === 'Receita')
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
      
    const pendingRevenue = currentMonthTrans
      .filter(t => t.status === 'Pendente' && t.type === 'Receita')
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    return { revenue, expenses, balance: revenue - expenses, overdue, pendingRevenue };
  }, [transactions, filterMonth]);

  // --- Dados para Gráficos ---
  const chartDataFlow = useMemo(() => {
    const data: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthKey = d.toISOString().slice(0, 7);
      
      const monthTrans = transactions.filter(t => t.dueDate.startsWith(monthKey));
      const inc = monthTrans.filter(t => t.type === 'Receita').reduce((acc, c) => acc + (Number(c.amount) || 0), 0);
      const exp = monthTrans.filter(t => t.type === 'Despesa').reduce((acc, c) => acc + (Number(c.amount) || 0), 0);
      
      data.push({
        name: d.toLocaleDateString('pt-BR', { month: 'short' }),
        Receitas: inc,
        Despesas: exp
      });
    }
    return data;
  }, [transactions]); 

  const chartDataCategories = useMemo(() => {
    const cats: Record<string, number> = {};
    const filtered = transactions.filter(t => t.dueDate.startsWith(filterMonth) && t.type === 'Despesa');
    filtered.forEach(t => { cats[t.category] = (cats[t.category] || 0) + (Number(t.amount) || 0); });
    return Object.keys(cats).map(k => ({ name: k, value: cats[k] }));
  }, [transactions, filterMonth]);

  const filteredList = useMemo(() => transactions.filter(t => {
    const matchMonth = t.dueDate.startsWith(filterMonth);
    const matchStatus = filterStatus === 'Todos' || t.status === filterStatus;
    const matchType = filterType === 'Todos' || t.type === filterType;
    return matchMonth && matchStatus && matchType;
  }), [transactions, filterMonth, filterStatus, filterType]);

  // --- Handlers ---
  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.amount) {
      addToast('Preencha os campos obrigatórios.', 'error');
      return;
    }

    // Secure parsing for "1.000,00" format (Remove dots, replace comma with dot)
    const baseAmount = parseFloat(formData.amount.replace(/\./g, '').replace(',', '.'));
    
    if (isNaN(baseAmount)) {
      addToast('Valor inválido. Use formato 0,00.', 'error');
      return;
    }

    const numInstallments = parseInt(formData.installments) || 1;
    const installmentValue = baseAmount / numInstallments;
    const selectedClient = clients.find(c => c.id === formData.clientId);
    
    const newTransactions: FinancialRecord[] = [];
    
    for (let i = 0; i < numInstallments; i++) {
      const dueDate = new Date(formData.dueDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      const titleSuffix = numInstallments > 1 ? ` (${i + 1}/${numInstallments})` : '';
      
      newTransactions.push({
        id: `trans-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
        title: formData.title + titleSuffix,
        amount: installmentValue,
        type: formData.type,
        category: formData.category,
        status: formData.status,
        dueDate: dueDate.toISOString().slice(0, 10),
        paymentDate: formData.status === 'Pago' ? new Date().toISOString().slice(0, 10) : undefined,
        clientId: formData.clientId || undefined,
        clientName: selectedClient?.name,
        installment: numInstallments > 1 ? { current: i + 1, total: numInstallments } : undefined
      });
    }

    for (const t of newTransactions.reverse()) {
      await storageService.saveFinancial(t);
    }
    
    setTransactions(await storageService.getFinancials());
    addToast(`${numInstallments} registro(s) salvo(s) com sucesso!`, 'success');
    setIsModalOpen(false);
    setFormData({
      title: '', amount: '', type: 'Receita', category: 'Honorários', 
      status: 'Pendente', dueDate: new Date().toISOString().slice(0, 10), clientId: '', installments: '1'
    });
  };

  const toggleStatus = async (id: string, currentStatus: FinancialStatus) => {
    const newStatus: FinancialStatus = currentStatus === 'Pago' ? 'Pendente' : 'Pago';
    const updatedList = transactions.map(t => {
      if (t.id === id) {
        return { ...t, status: newStatus, paymentDate: newStatus === 'Pago' ? new Date().toISOString().slice(0, 10) : undefined };
      }
      return t;
    });

    const target = updatedList.find(t => t.id === id);
    if(target) await storageService.saveFinancial(target);
    setTransactions(await storageService.getFinancials());
    addToast(`Status alterado para ${newStatus}`, 'info');
  };

  const handleExportCSV = () => {
    if (filteredList.length === 0) {
        addToast('Não há dados para exportar.', 'warning');
        return;
    }

    const headers = ['Data Vencimento', 'Descrição', 'Categoria', 'Tipo', 'Valor', 'Status', 'Cliente', 'Data Pagamento'];
    const csvRows = [
        headers.join(';'), 
        ...filteredList.map(row => {
            const values = [
                row.dueDate,
                `"${row.title}"`, 
                `"${row.category}"`,
                row.type,
                row.amount.toFixed(2).replace('.', ','),
                row.status,
                `"${row.clientName || ''}"`,
                row.paymentDate || ''
            ];
            return values.join(';');
        })
    ];

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csvRows.join("\n"); 
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `financeiro_${filterMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Relatório exportado com sucesso!', 'success');
  };

  const SummaryCard = React.memo(({ title, value, color, icon: Icon }: any) => (
    <GlassCard className="p-6 flex items-center justify-between">
      <div>
        <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
        <h3 className={`text-2xl font-bold ${color}`}>{formatCurrency(value)}</h3>
      </div>
      <div className={`p-3 rounded-xl bg-white/5 border border-white/10 ${color.replace('text-', 'text-opacity-80 ')}`}>
        <Icon size={24} />
      </div>
    </GlassCard>
  ));

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
           <h1 className="text-3xl font-bold text-white">Financeiro</h1>
           <p className="text-slate-400 mt-1">Gestão de fluxo de caixa, honorários e despesas.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button onClick={handleExportCSV} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors text-sm font-medium border border-white/10">
             <Download size={18} /> Exportar
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors text-sm font-medium shadow-lg shadow-indigo-500/20 hover:scale-105"
          >
            <Plus size={18} />
            Novo Lançamento
          </button>
        </div>
      </div>

      <div className="border-b border-white/10 flex gap-6 text-sm font-medium text-slate-400 overflow-x-auto">
         <button onClick={() => setActiveTab('overview')} className={`pb-3 transition-colors whitespace-nowrap ${activeTab === 'overview' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'hover:text-white'}`}>Visão Geral</button>
         <button onClick={() => setActiveTab('list')} className={`pb-3 transition-colors whitespace-nowrap ${activeTab === 'list' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'hover:text-white'}`}>Lançamentos</button>
         <button onClick={() => setActiveTab('reports')} className={`pb-3 transition-colors whitespace-nowrap ${activeTab === 'reports' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'hover:text-white'}`}>Relatórios</button>
      </div>

      <div className="flex items-center gap-4 bg-white/5 p-2 rounded-lg w-fit border border-white/10">
         <Calendar size={18} className="text-slate-400 ml-2" />
         <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="bg-transparent border-none outline-none text-white text-sm scheme-dark" />
      </div>

      {activeTab === 'overview' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
             <SummaryCard title="Saldo do Mês" value={summary.balance} color={summary.balance >= 0 ? "text-emerald-400" : "text-rose-400"} icon={DollarSign} />
             <SummaryCard title="Receitas" value={summary.revenue} color="text-indigo-400" icon={ArrowUpCircle} />
             <SummaryCard title="Despesas" value={summary.expenses} color="text-rose-400" icon={ArrowDownCircle} />
             <SummaryCard title="Atrasados (Total)" value={summary.overdue} color="text-amber-400" icon={AlertCircle} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             <GlassCard className="lg:col-span-2 h-[350px] p-6 flex flex-col">
               <h3 className="text-lg font-semibold text-white mb-6 shrink-0">Fluxo de Caixa (Últimos 6 Meses)</h3>
               <div className="flex-1 w-full min-h-0 relative">
                 <div className="absolute inset-0">
                   <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={chartDataFlow}>
                        <defs>
                          <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorDesp" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" tick={{fill: 'rgba(255,255,255,0.5)', fontSize: 12}} axisLine={false} />
                        <YAxis stroke="rgba(255,255,255,0.3)" tick={{fill: 'rgba(255,255,255,0.5)', fontSize: 12}} axisLine={false} tickFormatter={(val) => `k${val/1000}`} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }} />
                        <Area type="monotone" dataKey="Receitas" stroke="#818cf8" fillOpacity={1} fill="url(#colorRec)" />
                        <Area type="monotone" dataKey="Despesas" stroke="#f43f5e" fillOpacity={1} fill="url(#colorDesp)" />
                     </AreaChart>
                   </ResponsiveContainer>
                 </div>
               </div>
             </GlassCard>

             <GlassCard className="h-[350px] p-6 flex flex-col">
               <h3 className="text-lg font-semibold text-white mb-2 shrink-0">Despesas por Categoria</h3>
               <p className="text-xs text-slate-400 mb-4 shrink-0">Mês de Referência: {filterMonth}</p>
               <div className="flex-1 w-full min-h-0 relative">
                 <div className="absolute inset-0">
                   <ResponsiveContainer width="100%" height="100%">
                      {chartDataCategories.length > 0 ? (
                        <PieChart>
                          <Pie
                            data={chartDataCategories}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {chartDataCategories.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }} />
                        </PieChart>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500">
                           <PieIcon size={40} className="opacity-20 mb-2" />
                           <p>Sem dados</p>
                        </div>
                      )}
                   </ResponsiveContainer>
                 </div>
               </div>
               <div className="flex flex-wrap justify-center gap-2 mt-2 shrink-0">
                  {chartDataCategories.slice(0, 4).map((entry, index) => (
                    <div key={index} className="flex items-center gap-1 text-xs text-slate-400">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                      {entry.name}
                    </div>
                  ))}
               </div>
             </GlassCard>
          </div>
        </motion.div>
      )}

      {(activeTab === 'list' || activeTab === 'reports') && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
           <GlassCard className="p-4">
              <div className="flex flex-wrap gap-4 items-center">
                 <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <Filter size={16} /> 
                    <span className="font-medium">Filtros:</span>
                 </div>
                 <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className="bg-white/5 border border-white/10 rounded-lg py-1.5 px-3 text-sm text-slate-200 outline-none focus:border-indigo-500 transition-colors cursor-pointer">
                    <option className="bg-slate-800">Todos</option>
                    <option className="bg-slate-800">Receita</option>
                    <option className="bg-slate-800">Despesa</option>
                 </select>
                 <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="bg-white/5 border border-white/10 rounded-lg py-1.5 px-3 text-sm text-slate-200 outline-none focus:border-indigo-500 transition-colors cursor-pointer">
                    <option className="bg-slate-800">Todos</option>
                    <option className="bg-slate-800">Pago</option>
                    <option className="bg-slate-800">Pendente</option>
                    <option className="bg-slate-800">Atrasado</option>
                 </select>
                 {activeTab === 'reports' && (
                     <button onClick={handleExportCSV} className="ml-auto text-indigo-400 text-sm hover:text-white flex items-center gap-1">
                         <Download size={16} /> Baixar Relatório Atual
                     </button>
                 )}
              </div>
           </GlassCard>

           <GlassCard className="overflow-hidden p-0">
             <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 text-slate-400 border-b border-white/10">
                    <tr>
                      <th className="py-3 px-4 whitespace-nowrap">Descrição</th>
                      <th className="py-3 px-4 whitespace-nowrap">Categoria</th>
                      <th className="py-3 px-4 whitespace-nowrap">Vencimento</th>
                      <th className="py-3 px-4 whitespace-nowrap">Valor</th>
                      <th className="py-3 px-4 text-center whitespace-nowrap">Status</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredList.length > 0 ? (
                      filteredList.map(t => (
                        <tr key={t.id} className="hover:bg-white/5 transition-colors group">
                           <td className="py-3 px-4 min-w-[200px]">
                              <p className="text-white font-medium group-hover:text-indigo-300 transition-colors truncate">{t.title}</p>
                              {t.installment && <span className="text-[10px] text-slate-500 bg-white/5 px-1.5 rounded">Parcela {t.installment.current}/{t.installment.total}</span>}
                           </td>
                           <td className="py-3 px-4 whitespace-nowrap">
                              {t.clientName && <p className="text-indigo-300 text-xs mb-0.5">{t.clientName}</p>}
                              <span className="text-slate-400 text-xs bg-white/5 px-2 py-0.5 rounded-full border border-white/5">{t.category}</span>
                           </td>
                           <td className="py-3 px-4 text-slate-300 font-mono text-xs whitespace-nowrap">{formatDate(t.dueDate)}</td>
                           <td className={`py-3 px-4 font-bold font-mono whitespace-nowrap ${t.type === 'Receita' ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {t.type === 'Receita' ? '+' : '-'}{formatCurrency(Number(t.amount))}
                           </td>
                           <td className="py-3 px-4 text-center whitespace-nowrap">
                              <span onClick={() => toggleStatus(t.id, t.status)} className={`cursor-pointer select-none inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all hover:opacity-80 ${t.status === 'Pago' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : t.status === 'Atrasado' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
                                {t.status === 'Pago' ? <CheckCircle size={10} /> : t.status === 'Atrasado' ? <AlertCircle size={10} /> : <Clock size={10} />}
                                {t.status}
                              </span>
                           </td>
                           <td className="py-3 px-4 text-right text-slate-500">...</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={6} className="py-12 text-center text-slate-500">Nenhum lançamento encontrado.</td></tr>
                    )}
                  </tbody>
                </table>
             </div>
           </GlassCard>
        </motion.div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Novo Lançamento Financeiro" footer={<><button onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">Cancelar</button><button onClick={handleSaveTransaction} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors">Salvar Lançamento</button></>}>
        <form className="space-y-4">
           <div className="flex bg-black/20 rounded-lg p-1 mb-2">
              <button type="button" onClick={() => setFormData({...formData, type: 'Receita', category: 'Honorários'})} className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${formData.type === 'Receita' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400'}`}>Receita</button>
              <button type="button" onClick={() => setFormData({...formData, type: 'Despesa', category: 'Custos Fixos'})} className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${formData.type === 'Despesa' ? 'bg-rose-600 text-white shadow' : 'text-slate-400'}`}>Despesa</button>
           </div>
           <div className="space-y-1"><label className="text-xs text-slate-400">Descrição / Título</label><input type="text" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-slate-200 focus:border-indigo-500 focus:outline-none" placeholder="Ex: Honorários Cliente X" autoFocus /></div>
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><label className="text-xs text-slate-400">Valor Total (R$)</label><input type="text" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-slate-200 focus:border-indigo-500 focus:outline-none font-mono" placeholder="0,00" /></div>
              <div className="space-y-1"><label className="text-xs text-slate-400">Vencimento (1ª Parc.)</label><input type="date" value={formData.dueDate} onChange={(e) => setFormData({...formData, dueDate: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-slate-200 focus:border-indigo-500 focus:outline-none scheme-dark" /></div>
           </div>
           {formData.type === 'Receita' && (
             <div className="space-y-1"><label className="text-xs text-slate-400">Cliente Vinculado</label><select value={formData.clientId} onChange={(e) => setFormData({...formData, clientId: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-slate-200 focus:border-indigo-500 focus:outline-none scheme-dark"><option value="" className="bg-slate-800">Sem vínculo (Avulso)</option>{clients.map(c => (<option key={c.id} value={c.id} className="bg-slate-800">{c.name}</option>))}</select></div>
           )}
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><label className="text-xs text-slate-400">Categoria</label><select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-slate-200 focus:border-indigo-500 focus:outline-none scheme-dark">{formData.type === 'Receita' ? (<><option className="bg-slate-800">Honorários</option><option className="bg-slate-800">Reembolso de Custas</option><option className="bg-slate-800">Sucumbência</option><option className="bg-slate-800">Consultoria</option><option className="bg-slate-800">Outros</option></>) : (<><option className="bg-slate-800">Custos Fixos</option><option className="bg-slate-800">Custas Processuais</option><option className="bg-slate-800">Software</option><option className="bg-slate-800">Marketing</option><option className="bg-slate-800">Impostos</option><option className="bg-slate-800">Pessoal</option><option className="bg-slate-800">Outros</option></>)}</select></div>
              <div className="space-y-1"><label className="text-xs text-slate-400">Status Inicial</label><select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value as any})} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-slate-200 focus:border-indigo-500 focus:outline-none scheme-dark"><option className="bg-slate-800" value="Pendente">Pendente</option><option className="bg-slate-800" value="Pago">Pago</option><option className="bg-slate-800" value="Atrasado">Atrasado</option></select></div>
           </div>
           <div className="space-y-1 pt-2 border-t border-white/5"><label className="text-xs text-slate-400 flex justify-between"><span>Repetir / Parcelar?</span>{parseInt(formData.installments) > 1 && <span className="text-indigo-400 font-bold">{formData.installments}x de {formatCurrency(parseFloat(formData.amount.replace(/\./g, '').replace(',', '.') || '0') / parseInt(formData.installments))}</span>}</label><select value={formData.installments} onChange={(e) => setFormData({...formData, installments: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-slate-200 focus:border-indigo-500 focus:outline-none scheme-dark"><option value="1" className="bg-slate-800">Pagamento Único</option><option value="2" className="bg-slate-800">2x Parcelas Mensais</option><option value="3" className="bg-slate-800">3x Parcelas Mensais</option><option value="4" className="bg-slate-800">4x Parcelas Mensais</option><option value="6" className="bg-slate-800">6x Parcelas Mensais</option><option value="12" className="bg-slate-800">12x (Recorrente Anual)</option></select><p className="text-[10px] text-slate-500 mt-1">O sistema gerará automaticamente lançamentos futuros com vencimento mensal.</p></div>
        </form>
      </Modal>
    </div>
  );
};

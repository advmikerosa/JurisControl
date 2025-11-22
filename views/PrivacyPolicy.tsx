import React from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { Shield, Lock, Eye, FileText, ArrowLeft, Server, Scale, Globe, Mail, CheckCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

export const PrivacyPolicy: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Handle back navigation safely (if opened in new tab, go to home/login)
  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden bg-[#0f172a]">
      {/* Ambient Background Blobs (Matched from Layout for consistency) */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-600/20 rounded-full blur-[120px]" />
        <div className="absolute top-[40%] left-[40%] w-[20%] h-[20%] bg-cyan-600/10 rounded-full blur-[100px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-5xl mx-auto space-y-6 p-6 pb-20 relative z-10"
      >
        <button 
          onClick={handleBack} 
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4 group bg-white/5 px-3 py-1.5 rounded-lg hover:bg-white/10"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> 
          <span>Voltar</span>
        </button>

        <div className="text-center mb-10">
          <div className="inline-flex p-4 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 mb-6 shadow-[0_0_30px_rgba(99,102,241,0.3)]">
            <Shield size={40} />
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">Política de Privacidade</h1>
          <p className="text-slate-400 mt-3 max-w-2xl mx-auto">
            Em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018) e o Marco Civil da Internet (Lei nº 12.965/2014).
          </p>
          <p className="text-xs text-slate-500 mt-2 font-mono">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>
        </div>

        <GlassCard className="space-y-8 text-slate-300 leading-relaxed p-8 md:p-12">
          
          {/* Introdução */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2 border-b border-white/10 pb-2">
              <span className="text-indigo-400">1.</span> Introdução e Definições
            </h2>
            <p className="mb-4">
              O <strong>JurisControl</strong> (doravante "Plataforma" ou "Controlador") valoriza a privacidade de seus usuários e está comprometido com a proteção de dados pessoais. 
              Esta Política descreve como coletamos, armazenamos, usamos e protegemos suas informações ao utilizar nosso sistema de gestão jurídica.
            </p>
            <p>Para fins desta política, aplicam-se as seguintes definições:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2 marker:text-indigo-500">
              <li><strong>Usuário (Controlador):</strong> Advogados e escritórios que utilizam a plataforma para gerir seus processos e clientes.</li>
              <li><strong>Cliente Final (Titular):</strong> Pessoa física cujos dados são inseridos na plataforma pelo Usuário no contexto de um processo jurídico.</li>
              <li><strong>Tratamento:</strong> Toda operação realizada com dados pessoais.</li>
            </ul>
          </section>

          {/* Dados Coletados */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2 border-b border-white/10 pb-2">
              <span className="text-indigo-400">2.</span> Coleta de Dados
            </h2>
            <p className="mb-4">Coletamos os seguintes tipos de dados para a prestação dos serviços:</p>
            
            <div className="grid md:grid-cols-2 gap-6 mt-4">
              <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                <h3 className="text-white font-semibold mb-2 flex items-center gap-2"><FileText size={16} /> Dados de Cadastro (Usuário)</h3>
                <ul className="text-sm list-disc pl-4 space-y-1 text-slate-400">
                  <li>Nome completo e CPF.</li>
                  <li>Registro profissional (OAB).</li>
                  <li>Endereço de e-mail profissional.</li>
                  <li>Telefone de contato.</li>
                  <li>Dados de pagamento (processados via gateway seguro).</li>
                </ul>
              </div>

              <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                <h3 className="text-white font-semibold mb-2 flex items-center gap-2"><Server size={16} /> Dados de Navegação (Logs)</h3>
                <ul className="text-sm list-disc pl-4 space-y-1 text-slate-400">
                  <li>Endereço IP da conexão.</li>
                  <li>Data e hora de acesso (Timestamp).</li>
                  <li>Dispositivo, sistema operacional e navegador.</li>
                  <li>Ações realizadas dentro do sistema (Audit Trail).</li>
                </ul>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-400 italic">
              * Nota: O armazenamento dos registros de conexão (IP, data e hora) pelo prazo mínimo de 6 (seis) meses é uma obrigação legal imposta pelo <strong>Art. 15 do Marco Civil da Internet</strong>.
            </p>
          </section>

          {/* Finalidade e Base Legal */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2 border-b border-white/10 pb-2">
              <span className="text-indigo-400">3.</span> Finalidade e Bases Legais (LGPD)
            </h2>
            <p className="mb-4">O tratamento de dados é realizado com base nas hipóteses previstas no Art. 7º da LGPD:</p>
            <ul className="space-y-3">
              <li className="flex gap-3">
                <CheckCircle className="text-emerald-400 shrink-0 mt-0.5" size={16} />
                <div>
                  <strong className="text-white">Execução de Contrato:</strong> Para fornecer o acesso ao sistema, gerenciar sua conta, processar pagamentos e prestar suporte técnico.
                </div>
              </li>
              <li className="flex gap-3">
                <CheckCircle className="text-emerald-400 shrink-0 mt-0.5" size={16} />
                <div>
                  <strong className="text-white">Cumprimento de Obrigação Legal:</strong> Para guarda de logs (Marco Civil), emissão de notas fiscais e atendimento a ordens judiciais.
                </div>
              </li>
              <li className="flex gap-3">
                <CheckCircle className="text-emerald-400 shrink-0 mt-0.5" size={16} />
                <div>
                  <strong className="text-white">Legítimo Interesse:</strong> Para segurança do sistema, prevenção a fraudes (monitoramento de IPs suspeitos) e melhoria da plataforma (analytics anonimizado).
                </div>
              </li>
            </ul>
          </section>

          {/* Compartilhamento */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2 border-b border-white/10 pb-2">
              <span className="text-indigo-400">4.</span> Compartilhamento de Dados
            </h2>
            <p>O JurisControl não vende dados pessoais. O compartilhamento ocorre estritamente com:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1 marker:text-indigo-500">
              <li><strong>Provedores de Infraestrutura:</strong> Servidores em nuvem (AWS/Azure) que seguem padrões internacionais de segurança (ISO 27001).</li>
              <li><strong>Integrações Jurídicas:</strong> Tribunais de Justiça e Diários Oficiais, mediante comando do usuário, para captura automática de andamentos processuais (recorte digital).</li>
              <li><strong>Autoridades:</strong> Apenas mediante ordem judicial ou requerimento de autoridades competentes.</li>
            </ul>
          </section>

          {/* Segurança */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2 border-b border-white/10 pb-2">
              <span className="text-indigo-400">5.</span> Segurança da Informação
            </h2>
            <p className="mb-2">Adotamos medidas técnicas e organizacionais robustas para proteger seus dados, incluindo:</p>
            <ul className="grid md:grid-cols-2 gap-2 text-sm">
              <li className="flex items-center gap-2 bg-white/5 p-2 rounded-lg"><Lock size={14} className="text-emerald-400" /> Criptografia em trânsito (TLS 1.2+) e em repouso (AES-256).</li>
              <li className="flex items-center gap-2 bg-white/5 p-2 rounded-lg"><Shield size={14} className="text-emerald-400" /> Controle de acesso restrito e autenticação multifator (MFA).</li>
              <li className="flex items-center gap-2 bg-white/5 p-2 rounded-lg"><Eye size={14} className="text-emerald-400" /> Monitoramento contínuo de vulnerabilidades.</li>
              <li className="flex items-center gap-2 bg-white/5 p-2 rounded-lg"><Server size={14} className="text-emerald-400" /> Backups diários redundantes.</li>
            </ul>
          </section>

          {/* Direitos do Titular */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2 border-b border-white/10 pb-2">
              <span className="text-indigo-400">6.</span> Seus Direitos (Art. 18 da LGPD)
            </h2>
            <p className="mb-4">O Usuário pode exercer a qualquer momento, através do painel de controle (Meu Perfil > Privacidade), os seguintes direitos:</p>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="border border-white/10 rounded-lg p-4 hover:bg-white/5 transition-colors">
                <strong className="block text-white mb-1">Acesso e Confirmação</strong>
                <span className="text-xs text-slate-400">Saber se tratamos seus dados e obter cópia deles.</span>
              </div>
              <div className="border border-white/10 rounded-lg p-4 hover:bg-white/5 transition-colors">
                <strong className="block text-white mb-1">Correção</strong>
                <span className="text-xs text-slate-400">Solicitar a retificação de dados incompletos ou desatualizados.</span>
              </div>
              <div className="border border-white/10 rounded-lg p-4 hover:bg-white/5 transition-colors">
                <strong className="block text-white mb-1">Portabilidade</strong>
                <span className="text-xs text-slate-400">Exportar seus dados para outro fornecedor em formato aberto.</span>
              </div>
              <div className="border border-white/10 rounded-lg p-4 hover:bg-white/5 transition-colors">
                <strong className="block text-white mb-1">Eliminação</strong>
                <span className="text-xs text-slate-400">Solicitar a exclusão de dados (exceto se houver obrigação legal de retenção).</span>
              </div>
              <div className="border border-white/10 rounded-lg p-4 hover:bg-white/5 transition-colors">
                <strong className="block text-white mb-1">Revogação</strong>
                <span className="text-xs text-slate-400">Retirar o consentimento para tratamentos opcionais.</span>
              </div>
            </div>
          </section>

          {/* Cookies */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2 border-b border-white/10 pb-2">
              <span className="text-indigo-400">7.</span> Cookies e Tecnologias de Rastreamento
            </h2>
            <p>Utilizamos cookies para melhorar a experiência de navegação:</p>
            <ul className="list-disc pl-6 mt-2 marker:text-indigo-500">
              <li><strong>Essenciais:</strong> Necessários para login, segurança e funcionamento do app. Não podem ser desativados.</li>
              <li><strong>Analíticos:</strong> Coletam métricas de uso anonimizadas para performance. Podem ser gerenciados nas configurações de privacidade.</li>
            </ul>
          </section>

          {/* Contato DPO */}
          <section className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-6 mt-8">
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Scale size={20} className="text-indigo-400" /> Encarregado de Dados (DPO)
            </h2>
            <p className="mb-4 text-slate-300">
              Para exercer seus direitos ou esclarecer dúvidas sobre esta Política, entre em contato com nosso Encarregado de Proteção de Dados:
            </p>
            <div className="flex flex-col md:flex-row gap-4">
               <div className="bg-slate-900/50 p-3 rounded-lg border border-white/10 text-sm flex items-center gap-3 flex-1">
                 <Mail className="text-indigo-400" size={20} />
                 <div>
                    <span className="text-slate-400 block text-xs uppercase">E-mail Oficial</span>
                    <a href="mailto:dpo@juriscontrol.com.br" className="text-white font-medium hover:text-indigo-400 transition-colors">dpo@juriscontrol.com.br</a>
                 </div>
               </div>
               <div className="bg-slate-900/50 p-3 rounded-lg border border-white/10 text-sm flex items-center gap-3 flex-1">
                 <Globe className="text-indigo-400" size={20} />
                 <div>
                   <span className="text-slate-400 block text-xs uppercase">Canal de Atendimento</span>
                   <span className="text-white font-medium">Painel do Usuário > Privacidade</span>
                 </div>
               </div>
            </div>
          </section>

          <section className="text-sm text-slate-500 pt-4 border-t border-white/5 text-center">
            <p>
              Reservamo-nos o direito de alterar esta Política de Privacidade a qualquer momento. 
              Notificaremos sobre alterações significativas através de aviso no sistema ou e-mail.
            </p>
          </section>
        </GlassCard>
      </motion.div>
    </div>
  );
};
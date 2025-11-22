import React from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { FileText, ArrowLeft, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const TermsOfUse: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      <button 
        onClick={() => navigate(-1)} 
        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4"
      >
        <ArrowLeft size={16} /> Voltar
      </button>

      <div className="text-center mb-8">
        <div className="inline-flex p-3 rounded-full bg-emerald-500/20 text-emerald-400 mb-4">
          <FileText size={32} />
        </div>
        <h1 className="text-3xl font-bold text-white">Termos de Uso</h1>
        <p className="text-slate-400 mt-2">Última atualização: {new Date().toLocaleDateString()}</p>
      </div>

      <GlassCard className="space-y-6 text-slate-300 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-white mb-3">1. Aceitação dos Termos</h2>
          <p>
            Ao acessar e utilizar o sistema <strong>JurisControl</strong>, você concorda integralmente com estes Termos de Uso 
            e com nossa Política de Privacidade. Caso não concorde, por favor, não utilize nossos serviços.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">2. Uso do Sistema</h2>
          <p>
            O JurisControl é uma ferramenta de gestão jurídica. Você se compromete a utilizá-lo apenas para fins lícitos 
            e profissionais. É proibido tentar violar a segurança do sistema, realizar engenharia reversa ou utilizar 
            o software para armazenar conteúdo ilegal.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">3. Responsabilidades do Usuário</h2>
          <ul className="list-disc pl-6 space-y-1 text-slate-400">
            <li>Manter o sigilo de suas credenciais de acesso (login e senha).</li>
            <li>Garantir a veracidade das informações inseridas no sistema.</li>
            <li>Realizar o backup de documentos críticos, embora o sistema possua rotinas de segurança.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">4. Propriedade Intelectual</h2>
          <p>
            Todo o conteúdo, design, código e marca do JurisControl são de propriedade exclusiva da empresa desenvolvedora. 
            O uso do sistema não lhe concede direitos de propriedade intelectual sobre o mesmo.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">5. Limitação de Responsabilidade</h2>
          <p>
            O JurisControl não se responsabiliza por perdas indiretas, lucros cessantes ou falhas decorrentes de má utilização 
            do sistema, problemas de conectividade do usuário ou eventos de força maior.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">6. Alterações nos Termos</h2>
          <p>
            Reservamo-nos o direito de alterar estes termos a qualquer momento. Notificaremos os usuários sobre alterações 
            significativas através do sistema ou e-mail cadastrado.
          </p>
        </section>

        <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-center gap-2 text-emerald-400">
          <CheckCircle size={20} />
          <span className="font-medium">Ao continuar utilizando o sistema, você aceita estes termos.</span>
        </div>
      </GlassCard>
    </div>
  );
};
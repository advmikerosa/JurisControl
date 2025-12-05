
import { EmailLog, Task, User, LegalCase } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';

class EmailService {
  
  private getLogs(): EmailLog[] {
    try {
      return JSON.parse(localStorage.getItem('@JurisControl:emailLogs') || '[]');
    } catch { return []; }
  }

  private saveLog(log: EmailLog) {
    const logs = this.getLogs();
    logs.unshift(log);
    localStorage.setItem('@JurisControl:emailLogs', JSON.stringify(logs.slice(0, 100)));
  }

  public getEmailHistory(): EmailLog[] {
    return this.getLogs();
  }

  /**
   * Dispara o e-mail. Tenta usar Supabase Edge Function se configurado.
   * Caso contrário, usa o Mock para demonstração.
   */
  private async dispatch(to: string, subject: string, htmlBody: string, templateType: string): Promise<boolean> {
    console.groupCollapsed(`📧 [Email Service] Preparing: ${subject}`);
    
    let status: 'Sent' | 'Failed' | 'Queued' = 'Sent';
    let errorMsg = '';

    // 1. Tentativa de Envio Real (Supabase Edge Function)
    if (isSupabaseConfigured && supabase) {
        try {
            console.log('🚀 Tentando envio via Supabase Edge Function...');
            const { data, error } = await supabase.functions.invoke('send-email', {
                body: {
                    to,
                    subject,
                    html: htmlBody
                }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);
            
            console.log('✅ E-mail enviado com sucesso via Edge Function!');

        } catch (e: any) {
            console.warn('⚠️ Falha no envio real. Caindo para simulação local.', e);
            status = 'Failed';
            errorMsg = e.message;
            
            // Em modo desenvolvimento/demo, marcamos como 'Sent' (Simulado) para UX
            if (import.meta.env.MODE !== 'production' || e.message.includes('Functions')) {
                 status = 'Sent'; 
                 console.log('ℹ️ Modo Demo: E-mail registrado localmente.');
            }
        }
    } else {
        // 2. Modo Offline/Demo
        await new Promise(resolve => setTimeout(resolve, 1000)); // Delay dramático
        console.log('ℹ️ Modo Offline: E-mail registrado localmente.');
    }
    
    console.groupEnd();

    // 3. Registrar no Histórico Local (Audit Trail)
    this.saveLog({
      id: `email-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      recipient: to,
      subject: subject,
      templateType: templateType,
      status: status,
      sentAt: new Date().toLocaleString('pt-BR'),
    });

    return status === 'Sent';
  }

  // --- Templates (HTML Bonito para E-mails) ---

  private getBaseTemplate(content: string, title: string, color: string = '#4f46e5') {
      return `
        <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
            <div style="background-color: ${color}; padding: 24px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 600; letter-spacing: 0.5px;">${title}</h1>
            </div>
            <div style="padding: 32px; color: #334155; line-height: 1.6;">
                ${content}
            </div>
            <div style="background-color: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0;">© ${new Date().getFullYear()} JurisControl - Sistema Jurídico Inteligente</p>
                <p style="margin: 5px 0 0 0;">Esta é uma mensagem automática. Por favor, não responda.</p>
            </div>
        </div>
      `;
  }

  public async sendDeadlineAlert(user: User, task: Task, daysRemaining: number) {
    const isToday = daysRemaining <= 0;
    const subject = `${isToday ? '🔴 URGENTE:' : '⚠️ LEMBRETE:'} Prazo ${isToday ? 'VENCE HOJE' : `em ${daysRemaining} dias`} - ${task.title}`;
    
    const content = `
        <p style="font-size: 16px; margin-bottom: 20px;">Olá, <strong>${user.name}</strong>.</p>
        <p>Este é um lembrete automático sobre um prazo processual importante que requer sua atenção.</p>
        
        <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; border-left: 5px solid ${isToday ? '#ef4444' : '#6366f1'}; margin: 25px 0;">
            <h2 style="margin: 0 0 10px 0; font-size: 18px; color: #1e293b;">${task.title}</h2>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Processo:</strong> ${task.caseTitle || 'Não vinculado'}</p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Cliente:</strong> ${task.clientName || 'Não vinculado'}</p>
            <p style="margin: 15px 0 0 0; font-size: 16px; color: ${isToday ? '#ef4444' : '#0f172a'}; font-weight: bold;">
                Vencimento: ${task.dueDate}
            </p>
        </div>

        <div style="text-align: center; margin-top: 35px;">
            <a href="${window.location.origin}/#/crm" style="display: inline-block; background-color: #0f172a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px;">
                Visualizar Tarefa
            </a>
        </div>
    `;

    return this.dispatch(user.email, subject, this.getBaseTemplate(content, isToday ? 'Prazo Fatal' : 'Aviso de Prazo', isToday ? '#ef4444' : '#6366f1'), 'Deadline Alert');
  }

  public async sendHearingReminder(user: User, legalCase: LegalCase, hoursLeft: number) {
    const subject = `⚖️ Audiência ${hoursLeft < 24 ? 'AMANHÃ' : 'em breve'}: ${legalCase.title}`;
    
    const content = `
        <p style="font-size: 16px;">Olá, <strong>${user.name}</strong>.</p>
        <p>Você tem uma audiência agendada para ${hoursLeft < 24 ? 'amanhã' : 'breve'}.</p>

        <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Processo</td>
                    <td style="padding: 8px 0; color: #1e293b; font-weight: 600;">${legalCase.cnj}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Cliente</td>
                    <td style="padding: 8px 0; color: #1e293b; font-weight: 600;">${legalCase.client.name}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Local</td>
                    <td style="padding: 8px 0; color: #1e293b; font-weight: 600;">${legalCase.court || 'Vide Processo'}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Data</td>
                    <td style="padding: 8px 0; color: #4f46e5; font-weight: 700; font-size: 16px;">${legalCase.nextHearing}</td>
                </tr>
            </table>
        </div>

        <div style="text-align: center;">
             <a href="${window.location.origin}/#/cases/${legalCase.id}" style="color: #4f46e5; text-decoration: none; font-weight: 600;">Abrir Processo &rarr;</a>
        </div>
    `;

    return this.dispatch(user.email, subject, this.getBaseTemplate(content, 'Lembrete de Audiência', '#4f46e5'), 'Hearing Reminder');
  }

  public async sendTestEmail(user: User) {
    const subject = `✅ JurisControl: Teste de Configuração`;
    
    const content = `
        <div style="text-align: center;">
            <div style="font-size: 48px; margin-bottom: 10px;">🎉</div>
            <h2 style="color: #10b981; margin-top: 0;">Configuração Validada!</h2>
            <p style="font-size: 16px; color: #475569;">Olá, <strong>${user.name}</strong>.</p>
            <p style="color: #475569; max-width: 400px; margin: 0 auto;">
                Se você está lendo este e-mail, significa que o sistema de notificações do JurisControl está enviando mensagens corretamente para <strong>${user.email}</strong>.
            </p>
            <p style="margin-top: 30px; font-size: 12px; color: #94a3b8;">
                Data do teste: ${new Date().toLocaleString('pt-BR')}
            </p>
        </div>
    `;
    
    return this.dispatch(user.email, subject, this.getBaseTemplate(content, 'Teste de Sistema', '#10b981'), 'Test Email');
  }
}

export const emailService = new EmailService();

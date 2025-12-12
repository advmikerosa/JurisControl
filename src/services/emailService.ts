
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

  // Sanitization Helper
  private escapeHtml(text: string): string {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
  }

  private async dispatch(to: string, subject: string, htmlBody: string, templateType: string): Promise<boolean> {
    console.groupCollapsed(`📧 [Email Service] Sending: ${subject}`);
    
    let status: 'Sent' | 'Failed' | 'Queued' = 'Sent';

    if (isSupabaseConfigured && supabase) {
        try {
            const { data, error } = await supabase.functions.invoke('send-email', {
                body: { to, subject, html: htmlBody }
            });
            if (error || data?.error) throw new Error(error?.message || data?.error);
        } catch (e: any) {
            console.warn('⚠️ Falha no envio real. Caindo para simulação local.', e);
            status = 'Failed';
            // Em dev, assume sucesso simulado
            if (import.meta.env.MODE !== 'production') status = 'Sent';
        }
    } else {
        await new Promise(resolve => setTimeout(resolve, 800)); // Mock delay
    }
    
    console.groupEnd();
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

  // --- Templates ---

  private getBaseTemplate(content: string, title: string, color: string = '#4f46e5') {
      return `
        <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
            <div style="background-color: ${color}; padding: 24px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 600; letter-spacing: 0.5px;">${this.escapeHtml(title)}</h1>
            </div>
            <div style="padding: 32px; color: #334155; line-height: 1.6;">
                ${content}
            </div>
            <div style="background-color: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0;">© ${new Date().getFullYear()} JurisControl</p>
            </div>
        </div>
      `;
  }

  public async sendDeadlineAlert(user: User, task: Task, daysRemaining: number) {
    const isToday = daysRemaining <= 0;
    const subject = `${isToday ? '🔴 URGENTE:' : '⚠️ LEMBRETE:'} Prazo ${isToday ? 'VENCE HOJE' : `em ${daysRemaining} dias`} - ${task.title}`;
    
    const content = `
        <p style="font-size: 16px; margin-bottom: 20px;">Olá, <strong>${this.escapeHtml(user.name)}</strong>.</p>
        <p>Lembrete automático sobre prazo processual.</p>
        <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; border-left: 5px solid ${isToday ? '#ef4444' : '#6366f1'}; margin: 25px 0;">
            <h2 style="margin: 0 0 10px 0; font-size: 18px; color: #1e293b;">${this.escapeHtml(task.title)}</h2>
            <p style="margin: 5px 0;"><strong>Processo:</strong> ${this.escapeHtml(task.caseTitle || 'N/A')}</p>
            <p style="margin: 5px 0;"><strong>Cliente:</strong> ${this.escapeHtml(task.clientName || 'N/A')}</p>
            <p style="margin: 15px 0 0 0; font-weight: bold;">Vencimento: ${task.dueDate}</p>
        </div>
    `;

    return this.dispatch(user.email, subject, this.getBaseTemplate(content, isToday ? 'Prazo Fatal' : 'Aviso de Prazo', isToday ? '#ef4444' : '#6366f1'), 'Deadline Alert');
  }

  public async sendHearingReminder(user: User, legalCase: LegalCase, hoursLeft: number) {
    const subject = `⚖️ Audiência ${hoursLeft < 24 ? 'AMANHÃ' : 'em breve'}: ${legalCase.title}`;
    const content = `
        <p>Olá, <strong>${this.escapeHtml(user.name)}</strong>.</p>
        <p>Você tem uma audiência agendada.</p>
        <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p><strong>Processo:</strong> ${this.escapeHtml(legalCase.cnj)}</p>
            <p><strong>Cliente:</strong> ${this.escapeHtml(legalCase.client.name)}</p>
            <p><strong>Data:</strong> ${legalCase.nextHearing}</p>
        </div>
    `;
    return this.dispatch(user.email, subject, this.getBaseTemplate(content, 'Lembrete de Audiência', '#4f46e5'), 'Hearing Reminder');
  }

  public async sendTestEmail(user: User) {
    const subject = `✅ JurisControl: Teste de Configuração`;
    const content = `<p>Olá, <strong>${this.escapeHtml(user.name)}</strong>. O sistema de notificações está funcionando.</p>`;
    return this.dispatch(user.email, subject, this.getBaseTemplate(content, 'Teste de Sistema', '#10b981'), 'Test Email');
  }
}

export const emailService = new EmailService();

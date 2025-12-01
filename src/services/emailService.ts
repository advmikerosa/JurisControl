
import { EmailLog, LegalCase, Task, User } from '../types';

// In a real app, these would be handled by a backend service like SendGrid, AWS SES, or Resend.
class EmailService {
  
  private getLogs(): EmailLog[] {
    try {
      return JSON.parse(localStorage.getItem('@JurisControl:emailLogs') || '[]');
    } catch { return []; }
  }

  private saveLog(log: EmailLog) {
    const logs = this.getLogs();
    logs.unshift(log);
    // Keep only last 100 logs
    localStorage.setItem('@JurisControl:emailLogs', JSON.stringify(logs.slice(0, 100)));
  }

  public getEmailHistory(): EmailLog[] {
    return this.getLogs();
  }

  /**
   * Simulates sending a transactional email.
   */
  private async mockSend(to: string, subject: string, htmlBody: string, type: string): Promise<boolean> {
    console.groupCollapsed(`📧 [Email Service] Sending: ${subject}`);
    console.log(`To: ${to}`);
    console.log(`Type: ${type}`);
    console.log('--- HTML Content ---');
    console.log(htmlBody);
    console.groupEnd();

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Log to storage
    this.saveLog({
      id: `email-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      recipient: to,
      subject: subject,
      templateType: type,
      status: 'Sent',
      sentAt: new Date().toLocaleString('pt-BR'),
    });

    return true;
  }

  // --- Templates ---

  public async sendDeadlineAlert(user: User, task: Task, daysRemaining: number) {
    const isToday = daysRemaining === 0;
    const subject = `${isToday ? '🔴 URGENTE:' : '⚠️ LEMBRETE:'} Prazo ${isToday ? 'VENCE HOJE' : `em ${daysRemaining} dias`} - ${task.title}`;
    
    const html = `
      <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: ${isToday ? '#ef4444' : '#6366f1'}; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 20px;">${isToday ? 'Prazo Fatal' : 'Aviso de Prazo'}</h1>
        </div>
        <div style="padding: 30px; background-color: #f8fafc;">
          <p style="color: #334155; font-size: 16px;">Olá, <strong>${user.name}</strong>.</p>
          <p style="color: #475569;">Este é um lembrete automático sobre um prazo processual importante.</p>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; border-left: 4px solid ${isToday ? '#ef4444' : '#6366f1'}; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <h2 style="margin: 0 0 10px 0; font-size: 18px; color: #1e293b;">${task.title}</h2>
            <p style="margin: 5px 0; color: #64748b; font-size: 14px;">Processo Vinculado: <strong>${task.caseTitle || 'N/A'}</strong></p>
            <p style="margin: 5px 0; color: #64748b; font-size: 14px;">Cliente: <strong>${task.clientName || 'N/A'}</strong></p>
            <p style="margin: 15px 0 5px 0; color: #0f172a; font-weight: bold;">Vencimento: ${task.dueDate}</p>
          </div>

          <div style="text-align: center; margin-top: 30px;">
            <a href="${window.location.origin}/#/crm" style="background-color: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Visualizar Tarefa</a>
          </div>
        </div>
        <div style="background-color: #e2e8f0; padding: 15px; text-align: center; font-size: 12px; color: #64748b;">
          &copy; ${new Date().getFullYear()} JurisControl. <a href="#">Configurar Notificações</a>
        </div>
      </div>
    `;

    await this.mockSend(user.email, subject, html, 'Deadline Alert');
  }

  public async sendHearingReminder(user: User, legalCase: LegalCase, hoursLeft: number) {
    const subject = `⚖️ Audiência ${hoursLeft < 24 ? 'AMANHÃ' : 'em breve'}: ${legalCase.title}`;
    
    const html = `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #4f46e5;">Lembrete de Audiência</h2>
        <p>Processo: ${legalCase.cnj}</p>
        <p>Cliente: ${legalCase.client.name}</p>
        <p><strong>Data: ${legalCase.nextHearing}</strong></p>
        <p>Vara/Tribunal: ${legalCase.court}</p>
      </div>
    `;

    await this.mockSend(user.email, subject, html, 'Hearing Reminder');
  }

  public async sendTestEmail(user: User) {
    const subject = `✅ JurisControl: E-mail de Teste`;
    const html = `
      <div style="font-family: sans-serif; padding: 20px; text-align: center;">
        <h2 style="color: #10b981;">Tudo funcionando!</h2>
        <p>Olá, ${user.name}. Se você está lendo isso, suas configurações de e-mail estão corretas.</p>
        <p>O sistema de notificações do JurisControl está ativo.</p>
      </div>
    `;
    await this.mockSend(user.email, subject, html, 'Test Email');
  }
}

export const emailService = new EmailService();
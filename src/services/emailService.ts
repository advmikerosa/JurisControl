import { EmailLog, Task, User, LegalCase } from '../types';

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

  private async dispatch(to: string, subject: string, templateType: string, payload: any): Promise<boolean> {
    console.groupCollapsed(`📧 [Email Service] Sending: ${subject}`);
    console.log('Payload:', payload);
    console.groupEnd();

    // Simulação de chamada de API (Backend/Resend)
    // Em produção: await fetch('/api/email/send', { ... })
    await new Promise(resolve => setTimeout(resolve, 800));

    this.saveLog({
      id: `email-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      recipient: to,
      subject: subject,
      templateType: templateType,
      status: 'Sent',
      sentAt: new Date().toLocaleString('pt-BR'),
    });

    return true;
  }

  public async sendDeadlineAlert(user: User, task: Task, daysRemaining: number) {
    const isToday = daysRemaining === 0;
    const subject = `${isToday ? '🔴 URGENTE:' : '⚠️ LEMBRETE:'} Prazo ${isToday ? 'VENCE HOJE' : `em ${daysRemaining} dias`} - ${task.title}`;
    return this.dispatch(user.email, subject, 'DeadlineAlert', { user, task, daysRemaining });
  }

  public async sendHearingReminder(user: User, legalCase: LegalCase, hoursLeft: number) {
    const subject = `⚖️ Audiência ${hoursLeft < 24 ? 'AMANHÃ' : 'em breve'}: ${legalCase.title}`;
    return this.dispatch(user.email, subject, 'HearingReminder', { user, legalCase, hoursLeft });
  }

  public async sendTestEmail(user: User) {
    const subject = `✅ JurisControl: E-mail de Teste`;
    return this.dispatch(user.email, subject, 'TestEmail', { user });
  }
}

export const emailService = new EmailService();
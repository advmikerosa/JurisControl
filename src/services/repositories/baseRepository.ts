
import { supabase, isSupabaseConfigured } from '../supabase';

export class BaseRepository {
  protected isSupabaseConfigured = isSupabaseConfigured;
  protected supabase = supabase;

  protected async getUserId(): Promise<string | null> {
    const session = await this.getUserSession();
    return session.userId;
  }

  protected async getUserSession(): Promise<{ userId: string | null, officeId: string | null }> {
    if (this.isSupabaseConfigured && this.supabase) {
      try {
        const { data } = await this.supabase.auth.getSession();
        if (data.session) {
            const storedUser = localStorage.getItem('@JurisControl:user');
            const localUser = storedUser ? JSON.parse(storedUser) : null;
            const officeId = localUser?.currentOfficeId || data.session.user.user_metadata?.currentOfficeId || null;
            return { userId: data.session.user.id, officeId };
        }
      } catch (error) {
        console.error("Session retrieval error:", error);
      }
    }
    const stored = localStorage.getItem('@JurisControl:user');
    if (stored) {
        const u = JSON.parse(stored);
        return { userId: u.id, officeId: u.currentOfficeId || null };
    }
    return { userId: 'local-user', officeId: 'office-1' }; 
  }

  protected getLocal<T>(key: string, defaultValue: T): T {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch {
        return defaultValue;
    }
  }

  protected setLocal<T>(key: string, value: T): void {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error("Error saving to localStorage", e);
    }
  }

  protected filterByOffice<T extends { officeId?: string }>(items: T[], officeId: string): T[] {
    if (!officeId) return items;
    return items.filter(item => item.officeId === officeId || !item.officeId);
  }
}

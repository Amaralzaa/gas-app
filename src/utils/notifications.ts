/**
 * Utilitário seguro para envio de Notificações do Navegador (Web Notifications API).
 * 
 * Previne erros fatais em navegadores mobile (ex: Android Chrome / iOS Safari),
 * onde o construtor `new Notification()` dispara "TypeError: Illegal constructor".
 */

export interface SafeNotificationOptions {
  body?: string;
  icon?: string;
  tag?: string;
  data?: any;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | null> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.warn('Não foi possível solicitar permissão de notificação:', err);
    return null;
  }
}

export async function showSafeNotification(title: string, options?: SafeNotificationOptions): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  try {
    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch {}
    }

    if (Notification.permission !== 'granted') {
      return false;
    }

    // 1. Tenta usar o construtor padrão (funciona em navegadores Desktop)
    try {
      new Notification(title, {
        body: options?.body,
        icon: options?.icon || '/favicon.ico',
        tag: options?.tag,
      });
      return true;
    } catch (ctorErr: any) {
      // 2. No Android Chrome e alguns navegadores mobile, new Notification() gera "Illegal constructor".
      // Tentamos via ServiceWorkerRegistration caso haja algum ativo.
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration && registration.showNotification) {
            await registration.showNotification(title, {
              body: options?.body,
              icon: options?.icon || '/favicon.ico',
              tag: options?.tag,
            });
            return true;
          }
        } catch (swErr) {
          console.warn('Fallback de notificação via ServiceWorker não disponível:', swErr);
        }
      }
      return false;
    }
  } catch (outerErr) {
    console.warn('Erro silencioso ao exibir notificação:', outerErr);
    return false;
  }
}

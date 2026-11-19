/**
 * Utilitário de sons para notificações do app GásApp.
 * Usa Web Audio API (sem arquivos externos) para gerar sons diretamente no browser.
 */

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioContext || audioContext.state === 'closed') {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContext;
  } catch {
    return null;
  }
}

/**
 * Toca uma sequência de beeps (tons).
 * @param tones Array de { frequency, duration, gap } em Hz e ms
 */
async function playTones(tones: { frequency: number; duration: number; gap?: number }[]) {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Reativa o contexto se estiver suspenso (política de autoplay)
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  let currentTime = ctx.currentTime;

  for (const tone of tones) {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(tone.frequency, currentTime);

    gainNode.gain.setValueAtTime(0, currentTime);
    gainNode.gain.linearRampToValueAtTime(0.4, currentTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(0, currentTime + tone.duration / 1000 - 0.01);

    oscillator.start(currentTime);
    oscillator.stop(currentTime + tone.duration / 1000);

    currentTime += tone.duration / 1000 + (tone.gap || 0) / 1000;
  }
}

/**
 * Som de novo pedido para o Gestor.
 * Dois toques agudos ascendentes — chamativo e inconfundível.
 */
export async function playNewOrderSound() {
  await playTones([
    { frequency: 880, duration: 180, gap: 80 },
    { frequency: 1100, duration: 220, gap: 80 },
    { frequency: 1320, duration: 300, gap: 0 },
  ]);
}

/**
 * Som de pedido atribuído para o Entregador.
 * Dois beeps médios — indica ação necessária.
 */
export async function playAssignedOrderSound() {
  await playTones([
    { frequency: 660, duration: 200, gap: 120 },
    { frequency: 660, duration: 200, gap: 120 },
    { frequency: 880, duration: 350, gap: 0 },
  ]);
}

/**
 * Desbloqueia o AudioContext após interação do usuário.
 * Deve ser chamado no primeiro clique/toque na tela.
 */
export function unlockAudio() {
  getAudioContext();
}

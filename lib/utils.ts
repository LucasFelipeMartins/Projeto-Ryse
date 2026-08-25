import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Junta classes condicionais resolvendo conflitos do Tailwind. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Iniciais para avatares: "Mariana Costa" -> "MC" */
export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0] ?? '')
    .join('')
    .toUpperCase();
}

export function brl(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function compact(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export function pct(value: number, digits = 0) {
  return `${value.toFixed(digits)}%`;
}

export function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

export const greeting = (d = new Date()) => {
  const h = d.getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
};

/* ------------------------------------------------------------------ DATAS */

/**
 * O "hoje" do paciente, não o do servidor.
 *
 * Um registro de hidratação feito às 22h em São Paulo cairia no dia seguinte
 * se usássemos UTC — por isso a data é resolvida no fuso do usuário.
 */
export const APP_TIMEZONE = 'America/Sao_Paulo';

export function todayISO(tz = APP_TIMEZONE): string {
  // en-CA formata como YYYY-MM-DD, que é exatamente o `date` do Postgres.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Segunda-feira da semana corrente, em YYYY-MM-DD. */
export function weekStartISO(tz = APP_TIMEZONE): string {
  const today = new Date(`${todayISO(tz)}T00:00:00`);
  const weekday = (today.getDay() + 6) % 7; // 0 = segunda
  today.setDate(today.getDate() - weekday);
  return today.toISOString().slice(0, 10);
}

/** "há 2 h", "ontem", "há 5 dias" — relativo e em português. */
export function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);

  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;

  const days = Math.round(hours / 24);
  if (days === 1) return 'ontem';
  if (days < 30) return `há ${days} dias`;

  const months = Math.round(days / 30);
  return months === 1 ? 'há 1 mês' : `há ${months} meses`;
}

/** "07:00" a partir de um `time` do Postgres ("07:00:00"). */
export const shortTime = (t: string) => t.slice(0, 5);

/** 1.850 ml -> "1,85 L" */
export function litros(ml: number) {
  return `${(ml / 1000).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} L`;
}

export const centsToBRL = (cents: number) => brl(cents / 100);

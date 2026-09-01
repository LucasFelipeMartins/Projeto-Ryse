import {
  Apple,
  Bell,
  BrainCircuit,
  ClipboardCheck,
  Dumbbell,
  FileHeart,
  FileText,
  Home,
  LayoutGrid,
  type LucideIcon,
  MessageSquare,
  Settings,
  Stethoscope,
  TrendingUp,
  User,
  Users,
} from 'lucide-react';
import { ehRotaProfissional } from '@/lib/routes';

export type Role = 'paciente' | 'pro';

export type NavItem = {
  href: string;
  label: string;
  /** Rotulo curto usado na tab bar do mobile. */
  short?: string;
  icon: LucideIcon;
  badge?: number;
  /** `true` quando a rota so casa exatamente (evita marcar o pai como ativo). */
  exact?: boolean;
};

export type NavGroup = { group: string; items: NavItem[] };

/* ---------------------------------------------------------------- PACIENTE */

export const patientTabs: NavItem[] = [
  { href: '/inicio', label: 'Início', icon: Home, exact: true },
  { href: '/nutricao', label: 'Nutrição', short: 'Dieta', icon: Apple },
  { href: '/treino', label: 'Treino', icon: Dumbbell },
  { href: '/progresso', label: 'Progresso', short: 'Evolução', icon: TrendingUp },
];

export const patientNav: NavGroup[] = [
  {
    group: 'Meu dia',
    items: [
      { href: '/inicio', label: 'Início', icon: Home, exact: true },
      { href: '/nutricao', label: 'Nutrição', icon: Apple },
      { href: '/treino', label: 'Treino', icon: Dumbbell },
    ],
  },
  {
    group: 'Acompanhamento',
    items: [
      { href: '/progresso', label: 'Progresso e exames', icon: TrendingUp },
      { href: '/documentos', label: 'Meus documentos', icon: FileHeart },
      { href: '/checkin', label: 'Check-in semanal', icon: ClipboardCheck },
      { href: '/mensagens', label: 'Mensagens', icon: MessageSquare },
    ],
  },
  {
    group: 'Conta',
    items: [
      { href: '/perfil', label: 'Perfil e plano', icon: User },
      { href: '/profissionais', label: 'Meu profissional', icon: Stethoscope },
      { href: '/notificacoes', label: 'Notificações', icon: Bell },
    ],
  },
];

/* -------------------------------------------------------------------- PRO */

export const proTabs: NavItem[] = [
  { href: '/pro', label: 'Painel', icon: LayoutGrid, exact: true },
  { href: '/pro/pacientes', label: 'Pacientes', icon: Users },
  { href: '/pro/revisao', label: 'Revisão IA', short: 'Revisão', icon: BrainCircuit },
  { href: '/pro/mensagens', label: 'Mensagens', short: 'Chat', icon: MessageSquare },
];

/*
  Faturamento saiu da navegação do profissional.

  As consultas e as tabelas continuam de pé — assinatura e transação seguem
  sendo dado do negócio —, o que foi removido é a exposição na interface:
  menu, atalho e página. Ver `lib/queries/pro.ts`, que ainda calcula MRR para
  uso interno.
*/
export const proNav: NavGroup[] = [
  {
    group: 'Visão geral',
    items: [
      { href: '/pro', label: 'Painel', icon: LayoutGrid, exact: true },
      { href: '/pro/pacientes', label: 'Pacientes', icon: Users },
    ],
  },
  {
    group: 'Inteligência clínica',
    items: [
      { href: '/pro/revisao', label: 'Revisão IA', icon: BrainCircuit },
      { href: '/pro/protocolos', label: 'Protocolos base', icon: FileText },
    ],
  },
  {
    group: 'Gestão',
    items: [
      { href: '/pro/mensagens', label: 'Mensagens', icon: MessageSquare },
      { href: '/pro/config', label: 'Configurações', icon: Settings },
    ],
  },
];

/** Itens que ficam atrás do botão "Mais" na tab bar do profissional. */
export const proMoreItems: NavItem[] = [
  { href: '/pro/protocolos', label: 'Protocolos base', icon: FileText },
  { href: '/pro/config', label: 'Configurações', icon: Settings },
];

/**
 * Destino do botão de configurações, por papel.
 * O paciente edita tudo no perfil; o profissional tem tela própria.
 */
export const settingsHrefFor = (isPro: boolean) => (isPro ? '/pro/config' : '/perfil');

export function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

export function roleOf(pathname: string): Role {
  // Segmento inteiro: `/progresso` é tela de paciente, não de profissional.
  return ehRotaProfissional(pathname) ? 'pro' : 'paciente';
}

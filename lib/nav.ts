import {
  Apple,
  BrainCircuit,
  ClipboardCheck,
  Dumbbell,
  FileHeart,
  Stethoscope,
  FileText,
  Home,
  LayoutGrid,
  type LucideIcon,
  MessageSquare,
  Settings,
  TrendingUp,
  User,
  Users,
  Wallet,
} from 'lucide-react';

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
  { href: '/perfil', label: 'Perfil', icon: User },
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
      { href: '/pro/financeiro', label: 'Faturamento', icon: Wallet },
      { href: '/pro/config', label: 'Configurações', icon: Settings },
    ],
  },
];

/** Itens que ficam atrás do botão "Mais" na tab bar do profissional. */
export const proMoreItems: NavItem[] = [
  { href: '/pro/protocolos', label: 'Protocolos base', icon: FileText },
  { href: '/pro/financeiro', label: 'Faturamento', icon: Wallet },
  { href: '/pro/config', label: 'Configurações', icon: Settings },
];

export function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

export function roleOf(pathname: string): Role {
  return pathname.startsWith('/pro') ? 'pro' : 'paciente';
}

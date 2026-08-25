/**
 * Dados de demonstração do Ryse.
 * Tudo aqui é estático e tipado — trocar por chamadas de API depois significa
 * substituir apenas este arquivo (as telas consomem só os tipos).
 */

/* ------------------------------------------------------------------ TIPOS */

export type Tone = 'neutral' | 'brand' | 'success' | 'danger' | 'warn';

export type Macro = { label: string; current: number; target: number; unit: string };

export type Meal = {
  id: string;
  slot: string;
  time: string;
  title: string;
  kcal: number;
  macros: { p: number; c: number; g: number };
  items: string[];
  done: boolean;
  swappable?: boolean;
};

export type Exercise = {
  id: string;
  name: string;
  muscle: string;
  sets: number;
  reps: string;
  load: string;
  rest: string;
  note?: string;
  done?: boolean;
};

export type Workout = {
  id: string;
  letter: string;
  title: string;
  focus: string;
  duration: number;
  volume: string;
  exercises: Exercise[];
};

export type ExamMarker = {
  name: string;
  value: string;
  ref: string;
  status: 'ok' | 'atencao' | 'alterado';
  trend: 'up' | 'down' | 'flat';
  delta: string;
};

export type Patient = {
  id: string;
  name: string;
  email: string;
  plan: string;
  goal: string;
  status: string;
  tone: Tone;
  adherence: number;
  weight: number;
  lastCheckin: string;
  online?: boolean;
};

export type ReviewCase = {
  id: string;
  patient: string;
  module: 'Nutrição' | 'Treino' | 'Suplementação';
  trigger: string;
  urgency: 'alta' | 'media';
  age: string;
  confidence: number;
  summary: string;
  rationale: string;
  action: string;
  sources: string[];
  before: { title: string; lines: string[]; kcal: number; macros: string };
  after: { title: string; lines: string[]; kcal: number; macros: string };
};

/* --------------------------------------------------------------- PACIENTE */

export const me = {
  name: 'Alexandre Silva',
  firstName: 'Alex',
  id: '8492-AX',
  plan: 'Ryse Completo',
  goal: 'Hipertrofia limpa',
  coach: 'Dr. Rafael Mendes',
  weight: 74.5,
  height: 178,
  bodyFat: 14.2,
  streak: 12,
  since: 'Mar 2025',
};

export const dailyRings = {
  kcal: { current: 1840, target: 2400 },
  water: { current: 1.9, target: 3.2 },
  steps: { current: 7420, target: 10000 },
};

export const macros: Macro[] = [
  { label: 'Proteínas', current: 128, target: 160, unit: 'g' },
  { label: 'Carboidratos', current: 212, target: 280, unit: 'g' },
  { label: 'Gorduras', current: 51, target: 70, unit: 'g' },
];

export const aiBrief = {
  updated: 'há 2 h',
  headline: 'O algoritmo manteve seu protocolo atual.',
  body: 'Sua adesão à dieta está em 92%. A leve perda de peso reportada (-0,4 kg) está dentro da margem calculada para hipertrofia limpa. Foco da semana: hidratação e sono.',
  confidence: 94,
  signals: [
    { label: 'Adesão à dieta', value: '92%', tone: 'success' as Tone },
    { label: 'Volume de treino', value: '+8%', tone: 'brand' as Tone },
    { label: 'Sono médio', value: '6h10', tone: 'warn' as Tone },
  ],
};

export const meals: Meal[] = [
  {
    id: 'm1',
    slot: 'Café da manhã',
    time: '07:00',
    title: 'Ovos, aveia e fruta',
    kcal: 520,
    macros: { p: 34, c: 58, g: 16 },
    items: ['3 ovos inteiros', '60 g de aveia', '1 banana', 'Café sem açúcar'],
    done: true,
  },
  {
    id: 'm2',
    slot: 'Almoço',
    time: '12:30',
    title: 'Carne bovina, arroz e salada',
    kcal: 620,
    macros: { p: 38, c: 48, g: 12 },
    items: ['150 g de patinho', '100 g de arroz branco', 'Salada verde à vontade', 'Suco de 1 limão'],
    done: true,
    swappable: true,
  },
  {
    id: 'm3',
    slot: 'Pré-treino',
    time: '16:00',
    title: 'Pão integral com pasta de amendoim',
    kcal: 360,
    macros: { p: 14, c: 44, g: 14 },
    items: ['2 fatias de pão integral', '20 g de pasta de amendoim', 'Café'],
    done: false,
    swappable: true,
  },
  {
    id: 'm4',
    slot: 'Pós-treino',
    time: '19:30',
    title: 'Frango, batata doce e legumes',
    kcal: 560,
    macros: { p: 45, c: 62, g: 10 },
    items: ['180 g de frango', '200 g de batata doce', 'Brócolis no vapor'],
    done: false,
  },
  {
    id: 'm5',
    slot: 'Ceia',
    time: '22:00',
    title: 'Iogurte com whey',
    kcal: 340,
    macros: { p: 39, c: 18, g: 12 },
    items: ['200 g de iogurte natural', '1 scoop de whey', 'Canela'],
    done: false,
  },
];

export const workoutToday: Workout = {
  id: 'a',
  letter: 'A',
  title: 'Membros inferiores',
  focus: 'Quadríceps e panturrilha',
  duration: 50,
  volume: '18 séries',
  exercises: [
    {
      id: 'e1',
      name: 'Agachamento livre',
      muscle: 'Quadríceps',
      sets: 4,
      reps: '6-8',
      load: '80 kg',
      rest: '2 min',
      note: 'Subir a carga se fechar 8 repetições com folga.',
      done: true,
    },
    { id: 'e2', name: 'Leg press 45°', muscle: 'Quadríceps', sets: 4, reps: '10-12', load: '210 kg', rest: '90 s', done: true },
    { id: 'e3', name: 'Cadeira extensora', muscle: 'Quadríceps', sets: 3, reps: '12-15', load: '45 kg', rest: '60 s', done: false },
    { id: 'e4', name: 'Stiff', muscle: 'Posterior', sets: 3, reps: '10', load: '60 kg', rest: '90 s', done: false },
    { id: 'e5', name: 'Panturrilha em pé', muscle: 'Panturrilha', sets: 4, reps: '15-20', load: '70 kg', rest: '45 s', done: false },
  ],
};

export const weekSplit = [
  { day: 'Seg', letter: 'A', focus: 'Inferiores', state: 'done' as const },
  { day: 'Ter', letter: 'B', focus: 'Peito e tríceps', state: 'done' as const },
  { day: 'Qua', letter: '—', focus: 'Descanso ativo', state: 'rest' as const },
  { day: 'Qui', letter: 'C', focus: 'Costas e bíceps', state: 'today' as const },
  { day: 'Sex', letter: 'D', focus: 'Ombros e core', state: 'next' as const },
  { day: 'Sáb', letter: 'A', focus: 'Inferiores', state: 'next' as const },
  { day: 'Dom', letter: '—', focus: 'Descanso', state: 'rest' as const },
];

/** Peso corporal das últimas 12 semanas (kg). */
export const weightSeries = [76.8, 76.4, 76.1, 75.7, 75.9, 75.4, 75.1, 74.9, 75.2, 74.8, 74.6, 74.5];

/** Adesão semanal ao protocolo (%). */
export const adherenceSeries = [72, 78, 74, 85, 88, 84, 91, 92];

export const measurements = [
  { label: 'Peso', value: '74,5 kg', delta: '-2,3 kg', good: true },
  { label: 'Gordura', value: '14,2 %', delta: '-1,8 pp', good: true },
  { label: 'Massa magra', value: '63,9 kg', delta: '+0,9 kg', good: true },
  { label: 'Cintura', value: '79 cm', delta: '-3 cm', good: true },
];

export const examMarkers: ExamMarker[] = [
  { name: 'Ferritina', value: '32 ng/mL', ref: '30 – 400', status: 'atencao', trend: 'down', delta: '-18' },
  { name: 'Vitamina D', value: '41 ng/mL', ref: '30 – 100', status: 'ok', trend: 'up', delta: '+9' },
  { name: 'TSH', value: '2,1 µUI/mL', ref: '0,4 – 4,0', status: 'ok', trend: 'flat', delta: '0' },
  { name: 'Testosterona', value: '612 ng/dL', ref: '250 – 1100', status: 'ok', trend: 'up', delta: '+48' },
  { name: 'LDL', value: '142 mg/dL', ref: 'abaixo de 130', status: 'alterado', trend: 'up', delta: '+12' },
  { name: 'Creatinina', value: '1,1 mg/dL', ref: '0,7 – 1,3', status: 'ok', trend: 'flat', delta: '0' },
];

export const patientTimeline = [
  { t: 'Hoje, 07:12', title: 'Café da manhã registrado', desc: '520 kcal · dentro da meta', tone: 'success' as Tone },
  { t: 'Ontem, 20:40', title: 'Treino B concluído', desc: '52 min · 20 séries · PSE 8', tone: 'brand' as Tone },
  { t: 'Ontem, 09:00', title: 'Exame de sangue sincronizado', desc: 'Ferritina em queda — enviado para revisão', tone: 'warn' as Tone },
  { t: 'Seg, 18:22', title: 'Check-in semanal enviado', desc: 'Peso 74,5 kg · sono 6h10', tone: 'neutral' as Tone },
];

/* --------------------------------------------------------------------- PRO */

export const pro = {
  name: 'Dr. Rafael Mendes',
  role: 'Nutrólogo e médico do esporte',
  crm: 'CRM-SP 148.209',
};

export const proKpis = [
  { label: 'Pacientes ativos', value: '1.248', delta: '+12%', up: true, hint: 'vs. mês anterior' },
  { label: 'Revisões pendentes', value: '14', delta: 'Ação requerida', up: false, alert: true, hint: 'fila da IA' },
  { label: 'Adesão média', value: '87%', delta: '+4 pp', up: true, hint: 'protocolos ativos' },
  { label: 'MRR', value: 'R$ 84,5 mil', delta: '+15%', up: true, hint: 'assinaturas' },
];

/** Adesão ao protocolo x intervenções da IA, por semana. */
export const engagementSeries = [
  { week: 'S1', adherence: 62, ai: 18 },
  { week: 'S2', adherence: 68, ai: 22 },
  { week: 'S3', adherence: 64, ai: 15 },
  { week: 'S4', adherence: 75, ai: 28 },
  { week: 'S5', adherence: 71, ai: 24 },
  { week: 'S6', adherence: 84, ai: 31 },
  { week: 'S7', adherence: 80, ai: 26 },
  { week: 'S8', adherence: 90, ai: 34 },
];

export const patients: Patient[] = [
  { id: 'p1', name: 'Mariana Costa', email: 'mariana@email.com', plan: 'Ryse Completo', goal: 'Emagrecimento', status: 'Revisão pendente', tone: 'warn', adherence: 88, weight: 63.2, lastCheckin: 'há 2 h', online: true },
  { id: 'p2', name: 'Roberto Almeida', email: 'roberto@email.com', plan: 'Ryse Nutrição', goal: 'Longevidade', status: 'Estável', tone: 'success', adherence: 94, weight: 81.0, lastCheckin: 'ontem' },
  { id: 'p3', name: 'Lucas Mendes', email: 'lucas@email.com', plan: 'Ryse Treino', goal: 'Hipertrofia', status: 'Alerta dietético', tone: 'danger', adherence: 61, weight: 88.4, lastCheckin: 'há 3 dias', online: true },
  { id: 'p4', name: 'Ana Souza', email: 'ana@email.com', plan: 'Ryse Nutrição', goal: 'Reabilitação', status: 'Aguardando exames', tone: 'neutral', adherence: 76, weight: 58.9, lastCheckin: 'há 5 dias' },
  { id: 'p5', name: 'Fernando Silva', email: 'fernando@email.com', plan: 'Ryse Completo', goal: 'Performance', status: 'Estável', tone: 'success', adherence: 91, weight: 79.3, lastCheckin: 'há 6 h' },
  { id: 'p6', name: 'Juliana Freitas', email: 'juliana@email.com', plan: 'Ryse Completo', goal: 'Recomposição', status: 'Estável', tone: 'success', adherence: 89, weight: 66.7, lastCheckin: 'há 1 dia', online: true },
];

export const activityLog = [
  { who: 'Carlos S.', text: 'Exame de sangue sincronizado. IA detectou alteração no TSH.', when: 'há 2 min', tone: 'danger' as Tone },
  { who: 'Mariana P.', text: 'Preencheu o check-in de evolução. Peso: -1,2 kg.', when: 'há 15 min', tone: 'success' as Tone },
  { who: 'Roberto A.', text: 'Relatou desconforto lombar no treino B.', when: 'há 1 h', tone: 'warn' as Tone },
  { who: 'Sistema IA', text: 'Gerou 14 propostas de ajuste a partir dos check-ins.', when: 'há 2 h', tone: 'brand' as Tone },
  { who: 'Juliana F.', text: 'Assinatura do plano Completo renovada.', when: 'há 3 h', tone: 'success' as Tone },
];

export const conversations = [
  { id: 'c1', name: 'Mariana Costa', plan: 'Ryse Completo', last: 'Doutor, posso trocar a batata doce por mandioca hoje?', time: '10:42', unread: 2, online: true },
  { id: 'c2', name: 'Roberto Almeida', plan: 'Ryse Nutrição', last: 'Enviei os novos exames na aba do meu perfil.', time: 'Ontem', unread: 0, online: false },
  { id: 'c3', name: 'Lucas Mendes', plan: 'Ryse Treino', last: 'Senti um leve desconforto no ombro no supino.', time: 'Ontem', unread: 1, online: true },
  { id: 'c4', name: 'Ana Souza', plan: 'Ryse Nutrição', last: 'Obrigada pela alteração no cardápio!', time: 'Segunda', unread: 0, online: false },
];

export type ChatMessage = {
  id: string;
  from: 'them' | 'me' | 'ai';
  text: string;
  time: string;
};

export const thread: Record<string, ChatMessage[]> = {
  c1: [
    { id: '1', from: 'them', text: 'Bom dia, doutor! Tudo bem?', time: '10:40' },
    { id: '2', from: 'them', text: 'Posso trocar a batata doce por mandioca hoje no almoço? Acabou a batata aqui em casa.', time: '10:42' },
    { id: '3', from: 'ai', text: 'A IA avaliou que trocar 200 g de batata doce por 160 g de mandioca mantém a carga glicêmica e o total de carboidratos da refeição.', time: '10:42' },
  ],
  c2: [
    { id: '1', from: 'them', text: 'Enviei os novos exames na aba do meu perfil.', time: 'Ontem' },
    { id: '2', from: 'me', text: 'Recebido, Roberto. Analiso hoje e te retorno com os ajustes.', time: 'Ontem' },
  ],
  c3: [{ id: '1', from: 'them', text: 'Senti um leve desconforto no ombro durante o supino.', time: 'Ontem' }],
  c4: [
    { id: '1', from: 'them', text: 'Obrigada pela alteração no cardápio!', time: 'Segunda' },
    { id: '2', from: 'me', text: 'Imagina, Ana. Qualquer coisa é só chamar.', time: 'Segunda' },
  ],
};

export const protocols = [
  { id: 1, title: 'Hipertrofia limpa (masculino)', type: 'nutricao' as const, uses: 342, author: 'Dr. Mendes', aiEnabled: true },
  { id: 2, title: 'Emagrecimento acelerado', type: 'nutricao' as const, uses: 512, author: 'Dr. Mendes', aiEnabled: true },
  { id: 3, title: 'Adaptação anatômica (iniciantes)', type: 'treino' as const, uses: 89, author: 'Sistema', aiEnabled: false },
  { id: 4, title: 'Força máxima (avançado)', type: 'treino' as const, uses: 45, author: 'Dr. Mendes', aiEnabled: true },
  { id: 5, title: 'Check-up hormonal completo', type: 'exames' as const, uses: 120, author: 'Dr. Mendes', aiEnabled: false },
  { id: 6, title: 'Dieta anti-inflamatória', type: 'nutricao' as const, uses: 210, author: 'Dra. Silva', aiEnabled: true },
];

export const financeKpis = [
  { label: 'MRR', value: 'R$ 84.500', delta: '+12%', up: true },
  { label: 'Assinaturas ativas', value: '842', delta: '+24 novas', up: true },
  { label: 'Ticket médio', value: 'R$ 100,35', delta: 'Estável', up: true },
  { label: 'Inadimplência', value: '2,4%', delta: '-0,5 pp', up: true },
];

export const planMix = [
  { name: 'Ryse Completo', count: 420, percent: 50 },
  { name: 'Ryse Nutrição', count: 250, percent: 30 },
  { name: 'Ryse Treino', count: 172, percent: 20 },
];

/** Receita mensal dos últimos 8 meses (R$ mil). */
export const revenueSeries = [
  { month: 'Mar', value: 58 },
  { month: 'Abr', value: 62 },
  { month: 'Mai', value: 61 },
  { month: 'Jun', value: 68 },
  { month: 'Jul', value: 72 },
  { month: 'Ago', value: 75 },
  { month: 'Set', value: 79 },
  { month: 'Out', value: 84.5 },
];

export const transactions = [
  { name: 'Roberto Almeida', plan: 'Ryse Nutrição', amount: 89.9, status: 'Pago', tone: 'success' as Tone, date: 'Hoje, 10:42' },
  { name: 'Ana Souza', plan: 'Ryse Nutrição', amount: 89.9, status: 'Pendente', tone: 'warn' as Tone, date: 'Hoje, 09:15' },
  { name: 'Lucas Mendes', plan: 'Ryse Treino', amount: 79.9, status: 'Pago', tone: 'success' as Tone, date: 'Ontem, 16:30' },
  { name: 'Mariana Costa', plan: 'Ryse Completo', amount: 149.9, status: 'Falhou', tone: 'danger' as Tone, date: 'Ontem, 14:20' },
  { name: 'Fernando Silva', plan: 'Ryse Completo', amount: 149.9, status: 'Pago', tone: 'success' as Tone, date: '22 out, 11:00' },
];

/* ------------------------------------------------------------- REVISÃO IA */

export const reviewQueue: ReviewCase[] = [
  {
    id: 'r1',
    patient: 'Mariana Costa',
    module: 'Nutrição',
    trigger: 'Queda de ferritina detectada em exame',
    urgency: 'alta',
    age: 'há 2 h',
    confidence: 94,
    summary: 'Aumento de 200 kcal e troca da proteína do almoço.',
    rationale:
      'Paciente relatou fadiga extrema no treino B. O exame de sangue sincronizado há 2 h aponta queda de ferritina (32 ng/mL) e leve depleção de glicogênio muscular.',
    action:
      'Superávit estratégico de +200 kcal com fonte de ferro biodisponível na janela do almoço, associado a vitamina C para potencializar a absorção.',
    sources: ['Check-in semanal', 'Exame de sangue', 'Log de treino'],
    before: {
      title: 'Protocolo atual',
      lines: ['150 g de frango grelhado', '100 g de arroz branco', 'Salada verde'],
      kcal: 420,
      macros: '35 P · 45 C · 5 G',
    },
    after: {
      title: 'Proposta da IA',
      lines: ['150 g de patinho bovino', '100 g de arroz branco', 'Salada verde', 'Suco de 1 limão (vit. C)'],
      kcal: 620,
      macros: '38 P · 48 C · 12 G',
    },
  },
  {
    id: 'r2',
    patient: 'Lucas Mendes',
    module: 'Treino',
    trigger: 'Fim de ciclo (mês 3) com estagnação de carga',
    urgency: 'media',
    age: 'há 5 h',
    confidence: 88,
    summary: 'Nova periodização com ondulação de intensidade.',
    rationale:
      'As cargas dos principais exercícios não progridem há 3 semanas e a PSE média subiu de 7 para 8,6 — sinal clássico de platô por acúmulo de fadiga.',
    action:
      'Trocar o bloco linear por ondulação diária, reduzindo o volume em 20% na primeira semana (deload) e retomando com séries de 5 repetições pesadas.',
    sources: ['Log de treino', 'PSE semanal'],
    before: {
      title: 'Protocolo atual',
      lines: ['Supino reto 4 × 8-10', 'Remada curvada 4 × 8-10', 'Volume: 22 séries'],
      kcal: 0,
      macros: 'Linear · 3 meses',
    },
    after: {
      title: 'Proposta da IA',
      lines: ['Supino reto 5 × 5 (pesado)', 'Remada curvada 4 × 6-8', 'Volume: 18 séries (deload)'],
      kcal: 0,
      macros: 'Ondulatório · 8 semanas',
    },
  },
  {
    id: 'r3',
    patient: 'Ana Souza',
    module: 'Suplementação',
    trigger: 'Vitamina D abaixo do alvo terapêutico',
    urgency: 'alta',
    age: 'ontem',
    confidence: 97,
    summary: 'Introduzir vitamina D3 com cofatores.',
    rationale:
      'Vitamina D em 21 ng/mL com queixa recorrente de dor musculoesquelética e baixa exposição solar relatada no check-in.',
    action:
      'Iniciar D3 2.000 UI/dia com K2 (MK-7) 100 mcg, junto da refeição com maior teor de gordura, e reavaliar em 90 dias.',
    sources: ['Exame de sangue', 'Anamnese'],
    before: {
      title: 'Protocolo atual',
      lines: ['Sem suplementação de vitamina D', 'Ômega-3 1 g/dia'],
      kcal: 0,
      macros: '1 item ativo',
    },
    after: {
      title: 'Proposta da IA',
      lines: ['Vitamina D3 2.000 UI/dia', 'Vitamina K2 (MK-7) 100 mcg', 'Ômega-3 1 g/dia'],
      kcal: 0,
      macros: '3 itens ativos',
    },
  },
  {
    id: 'r4',
    patient: 'Roberto Almeida',
    module: 'Treino',
    trigger: 'Relato de dor lombar no check-in',
    urgency: 'media',
    age: 'ontem',
    confidence: 82,
    summary: 'Substituir levantamento terra por variação segura.',
    rationale:
      'Dor lombar 4/10 relatada após o treino de posterior, sem irradiação. Histórico de hérnia discal L5-S1 registrado na anamnese.',
    action:
      'Trocar levantamento terra convencional por stiff com halteres e adicionar mobilidade de quadril no aquecimento.',
    sources: ['Check-in semanal', 'Anamnese'],
    before: {
      title: 'Protocolo atual',
      lines: ['Levantamento terra 4 × 6', 'Aquecimento: 5 min de esteira'],
      kcal: 0,
      macros: 'Risco: moderado',
    },
    after: {
      title: 'Proposta da IA',
      lines: ['Stiff com halteres 4 × 10', 'Mobilidade de quadril 6 min', 'Prancha 3 × 40 s'],
      kcal: 0,
      macros: 'Risco: baixo',
    },
  },
];

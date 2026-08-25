import React, { useState, useMemo } from 'react';
import { 
  Home, ClipboardSignature, Activity, Apple, Dumbbell, Sparkles, Droplet, 
  Calendar, TrendingUp, ChevronRight, User, Scale, Ruler, Clock, FileText, 
  Users, Settings, Bell, CheckCircle2, XCircle, MoreVertical, ShieldCheck, 
  Search, ArrowUpRight, MessageSquare, CreditCard, PieChart, Filter, 
  Download, AlertTriangle, Menu, ChevronLeft, ChevronDown, Bot, BrainCircuit,
  LineChart, DollarSign, Stethoscope, ArrowRight, X, Send, Paperclip,
  ArrowDown, Edit2, Plus, Copy, Lock, Unlock, Receipt, ArrowDownRight, Target
} from 'lucide-react';

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

  :root {
    --primary-50: #eff6ff;
    --primary-100: #dbeafe;
    --primary-500: #3b82f6;
    --primary-600: #2563eb;
    --primary-700: #1d4ed8;
    --primary-900: #1e3a8a;
  }

  body {
    font-family: 'Inter', sans-serif;
    background-color: #F4F4F5;
    -webkit-font-smoothing: antialiased;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideInRight {
    from { opacity: 0; transform: translateX(20px); }
    to { opacity: 1; transform: translateX(0); }
  }
  .animate-fade-in {
    animation: fadeIn 0.3s ease-out forwards;
  }
  .animate-slide-in {
    animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  
  .glass-panel {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid #e4e4e7;
  }

  /* Custom Scrollbar */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #d4d4d8; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #a1a1aa; }
  
  /* Number Input hide arrows */
  input[type="number"]::-webkit-inner-spin-button,
  input[type="number"]::-webkit-outer-spin-button {
    -webkit-appearance: none; margin: 0;
  }
`;

// ============================================================================
// CORE UI COMPONENTS
// ============================================================================

const Card = ({ children, className = '', delay = 0, noPadding = false, hover = false }) => (
  <div 
    className={`bg-white rounded-xl border border-zinc-200/80 shadow-sm animate-fade-in ${hover ? 'transition-all duration-200 hover:shadow-md hover:border-zinc-300' : ''} ${noPadding ? '' : 'p-5'} ${className}`}
    style={{ animationDelay: `${delay}ms` }}
  >
    {children}
  </div>
);

const Badge = ({ children, variant = 'gray', icon: Icon, className = '' }) => {
  const variants = {
    gray: 'bg-zinc-100 text-zinc-600 border-zinc-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    ai: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200'
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold tracking-wide uppercase border ${variants[variant]} ${className}`}>
      {Icon && <Icon className="w-3 h-3" />}
      {children}
    </span>
  );
};

const Button = ({ children, variant = 'primary', size = 'md', className = '', icon: Icon, ...props }) => {
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base"
  };
  const variants = {
    primary: "bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm",
    secondary: "bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300",
    ghost: "bg-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
    ai: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm",
    danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
    dangerGhost: "bg-transparent text-red-600 hover:bg-red-50",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
  };
  return (
    <button className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
};

const Avatar = ({ name, url, className = "" }) => {
  const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  return (
    <div className={`rounded-full bg-zinc-100 text-zinc-600 font-bold flex items-center justify-center border border-zinc-200 shrink-0 ${className}`}>
      {url ? <img src={url} alt={name} className="w-full h-full rounded-full object-cover" /> : <span className="text-xs">{initials}</span>}
    </div>
  );
};

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

export default function App() {
  const [userRole, setUserRole] = useState('admin'); 
  const [activeMenu, setActiveMenu] = useState('admin-dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const patientMenuItems = [
    { id: 'dashboard', label: 'Visão Geral', icon: Home },
    { id: 'forms', label: 'Meus Dados', icon: ClipboardSignature },
    { id: 'reports-exams', label: 'Exames', icon: Activity },
    { id: 'reports-nutrition', label: 'Nutrição', icon: Apple },
    { id: 'reports-fitness', label: 'Treino', icon: Dumbbell },
  ];

  const adminMenuItems = [
    { group: 'Visão Geral' },
    { id: 'admin-dashboard', label: 'Dashboard', icon: PieChart },
    { id: 'admin-patients', label: 'Pacientes', icon: Users },
    { group: 'Inteligência Clínica' },
    { id: 'admin-ai-approvals', label: 'Revisão IA', icon: BrainCircuit, badge: 3, badgeColor: 'warning' },
    { id: 'admin-protocols', label: 'Protocolos Base', icon: FileText },
    { group: 'Gestão' },
    { id: 'admin-messages', label: 'Mensagens', icon: MessageSquare, badge: 1, badgeColor: 'blue' },
    { id: 'admin-finance', label: 'Faturamento', icon: DollarSign },
    { id: 'admin-settings', label: 'Configurações', icon: Settings },
  ];

  const currentMenuItems = userRole === 'admin' ? adminMenuItems : patientMenuItems;

  return (
    <>
      <style>{styles}</style>
      <div className="flex h-screen bg-zinc-50 text-zinc-900 font-sans overflow-hidden">
        
        {/* MOBILE OVERLAY */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 bg-zinc-900/50 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
        )}

        {/* SIDEBAR */}
        <aside className={`fixed lg:static inset-y-0 left-0 z-50 bg-white border-r border-zinc-200 flex flex-col transition-all duration-300 ease-in-out transform ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} ${isSidebarCollapsed ? 'lg:w-20' : 'w-64'}`}>
          
          {/* Sidebar Header */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-zinc-100">
            <div className={`flex items-center gap-3 overflow-hidden ${isSidebarCollapsed ? 'justify-center w-full' : ''}`}>
              <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center shrink-0">
                <Stethoscope className="w-5 h-5 text-white" />
              </div>
              {!isSidebarCollapsed && (
                <div className="animate-fade-in whitespace-nowrap">
                  <h1 className="text-sm font-bold tracking-tight text-zinc-900 leading-none">Lumina Health</h1>
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">{userRole === 'admin' ? 'Pro' : 'Patient'}</span>
                </div>
              )}
            </div>
            {/* Close Mobile Menu */}
            <button className="lg:hidden p-1 text-zinc-400 hover:text-zinc-900" onClick={() => setMobileMenuOpen(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Role Switcher */}
          <div className={`p-3 border-b border-zinc-100 ${isSidebarCollapsed ? 'flex justify-center' : ''}`}>
            <button 
              onClick={() => {
                const newRole = userRole === 'admin' ? 'patient' : 'admin';
                setUserRole(newRole);
                setActiveMenu(newRole === 'admin' ? 'admin-dashboard' : 'dashboard');
              }}
              className={`flex items-center justify-center gap-2 w-full py-2 text-xs font-semibold rounded-md border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 transition-colors ${isSidebarCollapsed ? 'px-0' : 'px-3'}`}
              title={`Trocar para visão de ${userRole === 'admin' ? 'Paciente' : 'Administrador'}`}
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500" />
              {!isSidebarCollapsed && <span>Modo: {userRole === 'admin' ? 'Paciente (Preview)' : 'Admin'}</span>}
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5 custom-scrollbar">
            {currentMenuItems.map((item, idx) => {
              if (item.group) {
                if (isSidebarCollapsed) return <div key={idx} className="h-4 border-b border-zinc-100 mb-2"></div>;
                return <div key={idx} className="px-3 pt-4 pb-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{item.group}</div>;
              }

              const isActive = activeMenu === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveMenu(item.id); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-150 group relative ${
                    isActive ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                  } ${isSidebarCollapsed ? 'justify-center' : ''}`}
                  title={isSidebarCollapsed ? item.label : undefined}
                >
                  {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-zinc-900"></div>}
                  <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-zinc-900' : 'text-zinc-400 group-hover:text-zinc-600'}`} />
                  
                  {!isSidebarCollapsed && (
                    <>
                      <span className={`text-sm ${isActive ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>
                      {item.badge && (
                        <span className={`ml-auto min-w-[18px] text-center text-[10px] font-bold px-1 py-0.5 rounded-full ${
                          item.badgeColor === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                  {/* Badge dot for collapsed state */}
                  {isSidebarCollapsed && item.badge && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 border border-white"></span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* User Profile Area */}
          <div className="p-4 border-t border-zinc-200 bg-zinc-50/50">
            <div className={`flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
              <Avatar name={userRole === 'admin' ? 'Dr. Mendes' : 'Alex Silva'} className="w-9 h-9 bg-zinc-200 text-zinc-700" />
              {!isSidebarCollapsed && (
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-semibold truncate text-zinc-900">{userRole === 'admin' ? 'Dr. Rafael Mendes' : 'Alexandre Silva'}</p>
                  <p className="text-xs text-zinc-500 truncate">{userRole === 'admin' ? 'Nutrólogo & Esportivo' : 'ID: 8492-AX'}</p>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 flex flex-col relative h-full min-w-0 bg-zinc-50/50">
          
          {/* Top Header */}
          <header className="h-16 glass-panel flex items-center justify-between px-4 lg:px-8 z-10 sticky top-0">
            <div className="flex items-center gap-4">
              <button className="lg:hidden p-2 -ml-2 text-zinc-500 hover:text-zinc-900" onClick={() => setMobileMenuOpen(true)}>
                <Menu className="w-5 h-5" />
              </button>
              <button className="hidden lg:block p-1.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
                <Menu className="w-4 h-4" />
              </button>
              
              <h2 className="text-lg font-semibold text-zinc-800 tracking-tight hidden sm:block">
                {currentMenuItems.find(m => m.id === activeMenu)?.label || 'Dashboard'}
              </h2>
            </div>
            
            <div className="flex items-center gap-3 sm:gap-5">
              {/* Global Search */}
              <div className="relative hidden md:block">
                 <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                 <input 
                   type="text" 
                   placeholder="Buscar paciente, exame ou protocolo..." 
                   className="w-64 lg:w-80 bg-white border border-zinc-200 text-sm rounded-md pl-9 pr-4 py-1.5 focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 outline-none transition-all shadow-sm"
                 />
                 <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-zinc-400 border border-zinc-200 px-1.5 rounded bg-zinc-50">⌘K</span>
              </div>
              
              <div className="h-5 w-px bg-zinc-200 hidden sm:block"></div>

              <button className="relative p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
              </button>
            </div>
          </header>

          {/* Content Scrollable Area */}
          <div className="flex-1 overflow-y-auto p-4 lg:p-8">
            <div className="max-w-[1400px] mx-auto w-full">
              {/* --- ADMIN VIEWS --- */}
              {activeMenu === 'admin-dashboard' && <AdminDashboardView />}
              {activeMenu === 'admin-patients' && <AdminPatientsView />}
              {activeMenu === 'admin-ai-approvals' && <AdminApprovalsView />}
              {activeMenu === 'admin-messages' && <AdminMessagesView />}
              {activeMenu === 'admin-protocols' && <AdminProtocolsView />}
              {activeMenu === 'admin-finance' && <AdminFinanceView />}
              
              {/* --- PATIENT VIEWS --- */}
              {activeMenu === 'dashboard' && <PatientDashboardView />}
              
              {/* Placeholders for unbuilt views */}
              {['forms', 'reports-exams', 'reports-nutrition', 'reports-fitness', 'admin-settings'].includes(activeMenu) && (
                <div className="flex flex-col items-center justify-center h-64 text-zinc-400 animate-fade-in mt-20">
                  <Settings className="w-8 h-8 mb-4 opacity-20 animate-spin-slow" />
                  <p className="text-sm font-medium text-zinc-500">Módulo <strong className="text-zinc-700">{activeMenu}</strong> em desenvolvimento.</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

// ============================================================================
// ADMIN VIEWS (High Fidelity)
// ============================================================================

const AdminDashboardView = () => {
  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-zinc-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">Bom dia, Dr. Mendes.</h2>
          <p className="text-sm text-zinc-500">Aqui está o resumo da sua clínica hoje, 24 de Outubro.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="secondary" icon={FileText} className="flex-1 sm:flex-none">Gerar Relatório</Button>
          <Button variant="primary" icon={User} className="flex-1 sm:flex-none">Novo Paciente</Button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Pacientes Ativos', value: '1,248', trend: '+12%', trendUp: true, icon: Users },
          { title: 'Aprovações IA Pendentes', value: '14', trend: 'Ação requerida', trendUp: false, alert: true, icon: BrainCircuit },
          { title: 'Taxa de Adesão (Dietas)', value: '87%', trend: '+4% vs mês ant.', trendUp: true, icon: Apple },
          { title: 'MRR (Assinaturas)', value: 'R$ 84.5k', trend: '+15%', trendUp: true, icon: DollarSign }
        ].map((kpi, idx) => (
          <Card key={idx} delay={idx * 50} className="relative overflow-hidden group hover:border-zinc-300">
            {kpi.alert && <div className="absolute top-0 right-0 w-16 h-16 bg-amber-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>}
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="p-2 bg-zinc-100 rounded-md text-zinc-600">
                <kpi.icon className="w-4 h-4" />
              </div>
            </div>
            <div className="relative z-10">
              <p className="text-sm font-medium text-zinc-500">{kpi.title}</p>
              <h4 className="text-2xl font-bold text-zinc-900 mt-1">{kpi.value}</h4>
              <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${kpi.alert ? 'text-amber-600' : (kpi.trendUp ? 'text-emerald-600' : 'text-zinc-500')}`}>
                {kpi.alert ? <AlertTriangle className="w-3 h-3" /> : (kpi.trendUp ? <TrendingUp className="w-3 h-3" /> : null)}
                {kpi.trend}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart Area */}
        <Card delay={200} className="lg:col-span-2 flex flex-col min-h-[350px]">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-base font-bold text-zinc-900">Engajamento de Pacientes vs Decisões da IA</h3>
              <p className="text-xs text-zinc-500 mt-1">Correlação entre ajustes feitos pela IA e a manutenção de peso dos pacientes.</p>
            </div>
            <select className="text-xs font-medium bg-zinc-50 border border-zinc-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-900">
              <option>Últimos 30 dias</option>
              <option>Este Trimestre</option>
            </select>
          </div>
          
          {/* Simulated Line Chart using CSS Grid/Flex */}
          <div className="flex-1 relative mt-4 border-l border-b border-zinc-100 flex items-end pt-4 pb-1">
            {/* Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pt-4 pb-6 pointer-events-none">
              {[1,2,3,4].map(i => <div key={i} className="w-full border-t border-zinc-100 border-dashed"></div>)}
            </div>
            
            {/* Chart Bars/Points */}
            <div className="w-full flex justify-between items-end h-full px-2 relative z-10 pb-6 gap-2 sm:gap-4">
              {[40, 55, 45, 70, 60, 85, 75, 90].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                  {/* Tooltip */}
                  <div className="opacity-0 group-hover:opacity-100 absolute -top-8 bg-zinc-900 text-white text-[10px] py-1 px-2 rounded shadow-sm whitespace-nowrap transition-opacity z-20 pointer-events-none">
                    {h}% Sucesso
                  </div>
                  <div className="w-full max-w-[24px] bg-zinc-200/50 rounded-t-sm h-full flex items-end">
                    <div className="w-full bg-zinc-800 rounded-t-sm transition-all duration-500 ease-out hover:bg-indigo-600" style={{ height: `${h}%` }}></div>
                  </div>
                  <span className="text-[10px] text-zinc-400 mt-2 absolute -bottom-5">Sem {i+1}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-center gap-4 mt-6 pt-4 border-t border-zinc-100">
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-zinc-800"></div><span className="text-xs text-zinc-600">Adesão ao Protocolo</span></div>
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-600"></div><span className="text-xs text-zinc-600">Intervenções IA</span></div>
          </div>
        </Card>

        {/* Activity Feed */}
        <Card delay={250} className="flex flex-col h-full max-h-[450px]">
           <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-zinc-400" /> Log de Atividades IA
            </h3>
            <button className="text-xs text-zinc-500 hover:text-zinc-900 font-medium">Ver tudo</button>
          </div>
          
          <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {[
              { u: 'Carlos S.', t: 'Exame de sangue sincronizado. IA detectou alteração em TSH.', min: '2m atrás', type: 'alert' },
              { u: 'Mariana P.', t: 'Preencheu formulário de evolução. Peso: -1.2kg.', min: '15m atrás', type: 'success' },
              { u: 'Roberto A.', t: 'Relatou desconforto lombar no treino B.', min: '1h atrás', type: 'warning' },
              { u: 'Sistema IA', t: 'Gerou 14 propostas de ajuste nutricional baseadas nos check-ins.', min: '2h atrás', type: 'info' },
              { u: 'Juliana F.', t: 'Assinatura Plano Premium renovada.', min: '3h atrás', type: 'success' },
            ].map((log, idx) => {
              const styles = {
                alert: { i: AlertTriangle, c: 'text-red-600', bg: 'bg-red-50' },
                success: { i: CheckCircle2, c: 'text-emerald-600', bg: 'bg-emerald-50' },
                warning: { i: Activity, c: 'text-amber-600', bg: 'bg-amber-50' },
                info: { i: BrainCircuit, c: 'text-indigo-600', bg: 'bg-indigo-50' }
              };
              const s = styles[log.type];
              return (
                <div key={idx} className="flex gap-3 group relative pb-4">
                  {idx !== 4 && <div className="absolute left-3.5 top-8 bottom-0 w-px bg-zinc-100"></div>}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 ${s.bg}`}>
                    <s.i className={`w-3.5 h-3.5 ${s.c}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-800 leading-snug">{log.t}</p>
                    <p className="text-xs text-zinc-500 mt-1">{log.u} • {log.min}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
};

const AdminPatientsView = () => (
  <div className="space-y-4">
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
      <div>
        <h2 className="text-xl font-bold text-zinc-900">CRM de Pacientes</h2>
        <p className="text-sm text-zinc-500">Gerencie planos, protocolos e o status de saúde da sua base.</p>
      </div>
      <div className="flex gap-2 w-full sm:w-auto">
        <Button variant="secondary" icon={Download}>Exportar CSV</Button>
        <Button variant="primary" icon={User}>Adicionar Paciente</Button>
      </div>
    </div>

    <Card noPadding className="overflow-hidden border border-zinc-200">
      {/* Table Toolbar */}
      <div className="p-3 border-b border-zinc-200 bg-zinc-50/80 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Buscar nome, CPF, email ou tag..." 
            className="w-full bg-white border border-zinc-200 text-sm rounded-md pl-8 pr-3 py-1.5 focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 outline-none"
          />
        </div>
        <div className="flex gap-2">
          <select className="text-sm border border-zinc-200 rounded-md px-2 py-1.5 bg-white text-zinc-600 focus:outline-none focus:border-zinc-900">
            <option>Todos os Planos</option>
            <option>Plano Completo</option>
            <option>Plano Nutricional</option>
            <option>Plano Treino</option>
          </select>
          <Button variant="secondary" className="px-2 py-1.5 bg-white"><Filter className="w-4 h-4" /></Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white border-b border-zinc-200 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              <th className="px-4 py-3 w-10 text-center"><input type="checkbox" className="rounded border-zinc-300" /></th>
              <th className="px-4 py-3">Paciente</th>
              <th className="px-4 py-3">Plano Ativo</th>
              <th className="px-4 py-3">Objetivo Primário</th>
              <th className="px-4 py-3">Status IA</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 text-sm bg-white">
            {[
              { id: 1, name: 'Mariana Costa', email: 'mari@email.com', plan: 'Plano Completo', obj: 'Emagrecimento', status: 'Revisão Pendente', sType: 'warning', iaIcon: BrainCircuit },
              { id: 2, name: 'Roberto Almeida', email: 'roberto@email.com', plan: 'Plano Nutricional', obj: 'Saúde / Longevidade', status: 'Estável', sType: 'success', iaIcon: CheckCircle2 },
              { id: 3, name: 'Lucas Mendes', email: 'lucas@email.com', plan: 'Plano Treino', obj: 'Hipertrofia', status: 'Alerta Dietético', sType: 'danger', iaIcon: AlertTriangle },
              { id: 4, name: 'Ana Souza', email: 'ana@email.com', plan: 'Plano Nutricional', obj: 'Reabilitação', status: 'Aguardando Exames', sType: 'gray', iaIcon: FileText },
              { id: 5, name: 'Fernando Silva', email: 'fernando@email.com', plan: 'Plano Completo', obj: 'Performance', status: 'Estável', sType: 'success', iaIcon: CheckCircle2 },
            ].map((patient) => (
              <tr key={patient.id} className="hover:bg-zinc-50 transition-colors group cursor-pointer">
                <td className="px-4 py-3 text-center"><input type="checkbox" className="rounded border-zinc-300" /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={patient.name} className="w-8 h-8" />
                    <div>
                      <p className="font-semibold text-zinc-900 group-hover:text-zinc-600 transition-colors">{patient.name}</p>
                      <p className="text-xs text-zinc-500">{patient.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-zinc-600 font-medium">
                  {patient.plan}
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {patient.obj}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={patient.sType} icon={patient.iaIcon}>{patient.status}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="text-zinc-400 hover:text-zinc-900 p-1.5 rounded-md hover:bg-zinc-200 transition-colors">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Footer */}
      <div className="p-3 border-t border-zinc-200 bg-zinc-50 flex justify-between items-center text-xs text-zinc-500">
        <span>Mostrando 1-5 de 1,248</span>
        <div className="flex gap-1">
          <button className="px-2 py-1 border border-zinc-200 rounded-md hover:bg-white disabled:opacity-50" disabled>Ant</button>
          <button className="px-2 py-1 bg-zinc-900 text-white rounded-md">1</button>
          <button className="px-2 py-1 border border-zinc-200 rounded-md hover:bg-white">2</button>
          <button className="px-2 py-1 border border-zinc-200 rounded-md hover:bg-white">...</button>
          <button className="px-2 py-1 border border-zinc-200 rounded-md hover:bg-white">Próx</button>
        </div>
      </div>
    </Card>
  </div>
);

// ============================================================================
// ADMIN APPROVALS VIEW (Review Board IA)
// ============================================================================
const AdminApprovalsView = () => {
  const [selectedCase, setSelectedCase] = useState(null);

  if (selectedCase) {
    // View de Detalhe da Revisão (Alta Fidelidade)
    return (
      <div className="space-y-6 animate-fade-in pb-10">
        {/* Header e Contexto do Paciente */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSelectedCase(null)} 
              className="p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-500 hover:text-zinc-900 transition-colors"
              title="Voltar para fila"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <Avatar name={selectedCase} className="w-12 h-12" />
              <div>
                <h2 className="text-xl font-bold text-zinc-900 leading-tight">Revisão: {selectedCase}</h2>
                <div className="flex items-center gap-2 mt-1 text-xs font-medium text-zinc-500">
                  <span className="flex items-center gap-1"><Target className="w-3.5 h-3.5" /> Hipertrofia Limpa</span>
                  <span className="w-1 h-1 rounded-full bg-zinc-300"></span>
                  <span className="flex items-center gap-1"><Scale className="w-3.5 h-3.5" /> 74.5 kg</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" icon={FileText} className="hidden sm:flex">Prontuário Completo</Button>
            <Button variant="secondary" icon={MessageSquare}>Enviar Mensagem</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Lado Esquerdo: Raciocínio da IA */}
          <div className="xl:col-span-1 space-y-6">
             <Card className="bg-indigo-900 text-white border-none shadow-md overflow-hidden relative">
               <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl transform translate-x-1/2 -translate-y-1/2"></div>
               
               <div className="relative z-10">
                 <div className="flex justify-between items-start mb-6">
                   <h3 className="text-base font-bold flex items-center gap-2 text-indigo-50">
                     <BrainCircuit className="w-5 h-5 text-indigo-400" /> Parecer da IA
                   </h3>
                   <div className="flex flex-col items-end">
                     <span className="text-3xl font-bold text-white leading-none">94%</span>
                     <span className="text-[10px] text-indigo-300 uppercase tracking-wide font-semibold mt-1">Confiança</span>
                   </div>
                 </div>

                 <div className="space-y-4">
                   <div className="bg-indigo-950/50 p-3 rounded-lg border border-indigo-800/50">
                     <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-1 block">Gatilho (Por que alterar?)</span>
                     <p className="text-sm text-indigo-50 leading-relaxed">
                       Paciente relatou fadiga extrema no treino B. Último exame de sangue (sincronizado há 2h) aponta queda na Ferritina (32 ng/mL) e leve depleção de glicogênio.
                     </p>
                   </div>
                   
                   <div className="bg-indigo-950/50 p-3 rounded-lg border border-indigo-800/50">
                     <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1 block">Ação Proposta</span>
                     <p className="text-sm text-indigo-50 leading-relaxed">
                       Aumento estratégico do superávit em <strong className="text-white">+200kcal</strong> (+ Ferro biodisponível) na janela de almoço para otimizar recuperação muscular.
                     </p>
                   </div>
                 </div>

                 <div className="mt-5 pt-4 border-t border-indigo-800/50 flex flex-wrap gap-2">
                   <Badge variant="blue" className="bg-indigo-800/50 border-indigo-700/50 text-indigo-200 text-[10px]">Fontes: Check-in Semanal</Badge>
                   <Badge variant="blue" className="bg-indigo-800/50 border-indigo-700/50 text-indigo-200 text-[10px]">Exame de Sangue</Badge>
                 </div>
               </div>
             </Card>

             <Card>
               <h3 className="text-sm font-semibold text-zinc-900 mb-4">Projeção de Impacto (30 dias)</h3>
               <div className="space-y-4">
                 <div>
                   <div className="flex justify-between text-xs font-medium mb-1.5 text-zinc-600">
                     <span>Balanço Calórico</span> 
                     <span className="text-emerald-600 font-bold flex items-center gap-1"><TrendingUp className="w-3 h-3" /> +200 kcal</span>
                   </div>
                   <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden flex">
                     <div className="bg-zinc-800 h-full w-[70%]"></div>
                     <div className="bg-emerald-500 h-full w-[15%]"></div>
                   </div>
                 </div>
                 <div>
                   <div className="flex justify-between text-xs font-medium mb-1.5 text-zinc-600">
                     <span>Proteína Total</span> 
                     <span className="text-zinc-500 font-bold">Mantida (160g)</span>
                   </div>
                   <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden flex">
                     <div className="bg-blue-500 h-full w-[85%]"></div>
                   </div>
                 </div>
               </div>
             </Card>
          </div>

          {/* Lado Direito: Diff Visual e Decisão */}
          <div className="xl:col-span-2 space-y-6 flex flex-col">
             <Card className="flex-1">
               <div className="flex justify-between items-center mb-6">
                 <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                   <Apple className="w-5 h-5 text-zinc-400" /> Alterações no Plano Nutricional
                 </h3>
                 <Badge variant="gray">Refeição 2: Almoço</Badge>
               </div>
               
               {/* Visual Diff Component */}
               <div className="bg-zinc-50 border border-zinc-200 rounded-xl overflow-hidden mb-6">
                  {/* Cabeçalho do Diff */}
                  <div className="grid grid-cols-[1fr_auto_1fr] bg-zinc-100/50 border-b border-zinc-200 p-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-center">
                    <div>Protocolo Atual</div>
                    <div className="w-8"></div>
                    <div className="text-indigo-600">Proposta IA</div>
                  </div>
                  
                  {/* Corpo do Diff */}
                  <div className="grid grid-cols-[1fr_auto_1fr] items-stretch p-4 gap-4">
                    {/* Old */}
                    <div className="bg-white border border-rose-100 rounded-lg p-4 relative flex flex-col justify-center shadow-sm">
                      <div className="absolute top-2 right-2 w-5 h-5 bg-rose-50 rounded text-rose-500 flex items-center justify-center font-bold text-xs">-</div>
                      <p className="text-sm font-medium text-zinc-800 line-through decoration-rose-300">150g Frango Grelhado</p>
                      <p className="text-sm font-medium text-zinc-800 mt-1">100g Arroz Branco</p>
                      <div className="mt-3 pt-3 border-t border-zinc-100 flex justify-between text-xs font-semibold text-zinc-500">
                        <span>420 kcal</span>
                        <span>35g P | 45g C | 5g G</span>
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>

                    {/* New */}
                    <div className="bg-white border border-emerald-200 rounded-lg p-4 relative flex flex-col justify-center shadow-sm ring-1 ring-emerald-500/20">
                      <div className="absolute top-2 right-2 w-5 h-5 bg-emerald-50 rounded text-emerald-600 flex items-center justify-center font-bold text-xs">+</div>
                      <p className="text-sm font-bold text-emerald-700">150g Carne Bovina (Patinho)</p>
                      <p className="text-sm font-bold text-emerald-700 mt-1">+ Suco de 1 Limão (Vit. C)</p>
                      <p className="text-sm font-medium text-zinc-800 mt-1">100g Arroz Branco</p>
                      <div className="mt-3 pt-3 border-t border-zinc-100 flex justify-between text-xs font-semibold text-emerald-700">
                        <span>620 kcal</span>
                        <span>38g P | 48g C | 12g G</span>
                      </div>
                    </div>
                  </div>
               </div>

               {/* Ações / Decisão Médica */}
               <div className="bg-zinc-900 rounded-xl p-5 shadow-lg border border-zinc-800">
                 <h3 className="text-sm font-semibold text-zinc-300 mb-4">Decisão Clínica (Review)</h3>
                 <div className="flex flex-col sm:flex-row gap-3">
                   <Button variant="success" className="flex-1 py-3 text-sm" icon={CheckCircle2}>
                     Aprovar e Liberar Plano
                   </Button>
                   <Button className="flex-1 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white py-3 text-sm" icon={Edit2}>
                     Editar Manualmente
                   </Button>
                   <Button variant="dangerGhost" className="py-3 px-6 text-sm flex-shrink-0" icon={XCircle}>
                     Rejeitar
                   </Button>
                 </div>
               </div>
             </Card>
          </div>
        </div>
      </div>
    );
  }

  // Lista de Aprovações Pendentes (Grid Melhorado)
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">Review Board (IA)</h2>
          <p className="text-sm text-zinc-500">Planos e ajustes propostos pela inteligência aguardando sua chancela médica.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="warning" className="px-3 py-1.5 text-xs shadow-sm">14 Casos Pendentes</Badge>
          <Button variant="secondary" icon={Filter}>Filtrar</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
        {[
          { name: 'Mariana Costa', type: 'Nutrição', reason: 'Queda de Ferritina (Exame)', urgency: 'high', time: 'Há 2h', conf: 94 },
          { name: 'Lucas Mendes', type: 'Treino', reason: 'Fim de Ciclo (Mês 3) - Estagnação', urgency: 'medium', time: 'Há 5h', conf: 88 },
          { name: 'Ana Souza', type: 'Nutrição & Sup.', reason: 'Baixa Vitamina D identificada', urgency: 'high', time: 'Ontem', conf: 97 },
          { name: 'Roberto Almeida', type: 'Treino', reason: 'Relato de dor lombar no Check-in', urgency: 'medium', time: 'Ontem', conf: 82 },
        ].map((item, idx) => (
          <Card key={idx} hover className="flex flex-col h-full border-zinc-200 group">
            <div className="flex justify-between items-start mb-5">
               <div className="flex items-center gap-2">
                 <Avatar name={item.name} className="w-10 h-10 shadow-sm" />
                 <div>
                   <h4 className="text-sm font-bold text-zinc-900 group-hover:text-indigo-600 transition-colors">{item.name}</h4>
                   <span className="text-[10px] text-zinc-400 font-medium flex items-center gap-1">
                     <Clock className="w-3 h-3" /> {item.time}
                   </span>
                 </div>
               </div>
               <Badge variant={item.urgency === 'high' ? 'danger' : 'warning'}>
                 {item.urgency === 'high' ? 'Prioridade' : 'Revisão'}
               </Badge>
            </div>
            
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-600 bg-zinc-100 px-2 py-1 rounded">Mod: {item.type}</span>
                <span className="text-indigo-600 font-bold flex items-center gap-1">
                  <BrainCircuit className="w-3 h-3" /> {item.conf}% Confiança
                </span>
              </div>
              <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100/50">
                <p className="text-xs text-indigo-900 font-medium line-clamp-2">
                  <strong className="text-indigo-600">Gatilho:</strong> {item.reason}
                </p>
              </div>
            </div>
            
            <div className="mt-5 pt-4 border-t border-zinc-100">
              <Button onClick={() => setSelectedCase(item.name)} className="w-full text-sm font-semibold shadow-sm group-hover:bg-indigo-600 transition-colors">
                Analisar Proposta
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// ADMIN MESSAGES VIEW (Inbox)
// ============================================================================
const AdminMessagesView = () => {
  const [activeChat, setActiveChat] = useState(1);
  
  const chats = [
    { id: 1, name: 'Mariana Costa', plan: 'Plano Completo', lastMsg: 'Doutor, posso substituir a batata doce por mandioca hoje?', time: '10:42', unread: 2, online: true },
    { id: 2, name: 'Roberto Almeida', plan: 'Plano Nutricional', lastMsg: 'Enviei os novos exames na aba do meu perfil.', time: 'Ontem', unread: 0, online: false },
    { id: 3, name: 'Lucas Mendes', plan: 'Plano Treino', lastMsg: 'Senti um leve desconforto no ombro durante o supino.', time: 'Ontem', unread: 0, online: true },
    { id: 4, name: 'Ana Souza', plan: 'Plano Nutricional', lastMsg: 'Obrigada pela alteração no cardápio!', time: 'Segunda', unread: 0, online: false },
  ];

  const currentChat = chats.find(c => c.id === activeChat);

  return (
    <Card className="h-[calc(100vh-140px)] min-h-[600px] flex overflow-hidden border border-zinc-200 shadow-sm" noPadding>
      
      {/* Lado Esquerdo: Lista de Conversas */}
      <div className="w-full sm:w-80 border-r border-zinc-200 flex flex-col bg-white shrink-0">
        <div className="p-4 border-b border-zinc-100">
          <h2 className="text-lg font-bold text-zinc-900 mb-4">Mensagens</h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Buscar conversa..." 
              className="w-full bg-zinc-50 border border-zinc-200 text-sm rounded-md pl-9 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {chats.map(chat => (
            <div 
              key={chat.id} 
              onClick={() => setActiveChat(chat.id)}
              className={`p-4 border-b border-zinc-50 cursor-pointer transition-colors relative flex gap-3 items-center group ${activeChat === chat.id ? 'bg-zinc-50' : 'hover:bg-zinc-50/50'}`}
            >
              {activeChat === chat.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-zinc-900"></div>}
              
              <div className="relative shrink-0">
                <Avatar name={chat.name} className="w-10 h-10" />
                {chat.online && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white"></div>}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                  <h4 className={`text-sm truncate pr-2 ${chat.unread > 0 ? 'font-bold text-zinc-900' : 'font-semibold text-zinc-800'}`}>{chat.name}</h4>
                  <span className={`text-xs shrink-0 ${chat.unread > 0 ? 'text-zinc-900 font-bold' : 'text-zinc-500'}`}>{chat.time}</span>
                </div>
                <div className="flex justify-between items-center">
                  <p className={`text-xs truncate ${chat.unread > 0 ? 'text-zinc-900 font-medium' : 'text-zinc-500'}`}>{chat.lastMsg}</p>
                  {chat.unread > 0 && <span className="w-4 h-4 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold ml-2 shrink-0">{chat.unread}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lado Direito: Área da Conversa */}
      <div className="flex-1 flex flex-col bg-zinc-50/30">
        {/* Chat Header */}
        <div className="h-16 px-6 border-b border-zinc-200 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar name={currentChat.name} className="w-10 h-10" />
              {currentChat.online && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white"></div>}
            </div>
            <div>
              <h3 className="font-bold text-zinc-900 leading-none">{currentChat.name}</h3>
              <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                <Badge variant="gray" className="px-1.5 py-0 text-[9px]">{currentChat.plan}</Badge>
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={FileText} className="hidden sm:flex">Prontuário</Button>
            <Button variant="secondary" size="sm" icon={Settings} className="px-2" />
          </div>
        </div>

        {/* Mensagens da Conversa */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjIiIGZpbGw9IiNlNGU0ZTciIGZpbGwtb3BhY2l0eT0iMC40Ii8+PC9zdmc+')]">
          
          <div className="flex justify-center">
            <span className="text-[10px] font-bold text-zinc-400 bg-white px-3 py-1 rounded-full border border-zinc-100 uppercase tracking-wider">Hoje</span>
          </div>

          {/* Mensagem Paciente */}
          <div className="flex gap-3 justify-start max-w-[85%]">
            <Avatar name={currentChat.name} className="w-8 h-8 shrink-0 mt-1" />
            <div>
              <div className="bg-white border border-zinc-200 text-zinc-800 p-3 rounded-2xl rounded-tl-sm text-sm shadow-sm">
                Bom dia, Doutor! Tudo bem?
              </div>
              <span className="text-[10px] text-zinc-400 mt-1 ml-1 block">10:40</span>
            </div>
          </div>

          {/* Mensagem Paciente */}
          <div className="flex gap-3 justify-start max-w-[85%]">
            <Avatar name={currentChat.name} className="w-8 h-8 shrink-0 mt-1 opacity-0" />
            <div>
              <div className="bg-white border border-zinc-200 text-zinc-800 p-3 rounded-2xl rounded-tl-sm text-sm shadow-sm">
                Doutor, posso substituir a batata doce por mandioca hoje no almoço? Acabou a batata aqui em casa.
              </div>
              <span className="text-[10px] text-zinc-400 mt-1 ml-1 block">10:42</span>
            </div>
          </div>

          {/* Alerta Sistema (Opcional - Exemplo de integração) */}
          <div className="flex justify-center my-4">
            <div className="bg-indigo-50 border border-indigo-100 text-indigo-800 text-xs py-2 px-4 rounded-lg flex items-center gap-2 max-w-sm text-center">
              <BrainCircuit className="w-4 h-4 shrink-0 text-indigo-600" />
              <span>A IA avaliou que a substituição de 100g de batata doce por 80g de mandioca mantém a carga glicêmica da refeição.</span>
            </div>
          </div>

        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-zinc-200 shrink-0">
          <div className="flex items-end gap-2 bg-zinc-50 border border-zinc-200 rounded-xl p-1 focus-within:border-zinc-400 focus-within:ring-1 focus-within:ring-zinc-400 transition-all">
            <button className="p-2.5 text-zinc-400 hover:text-zinc-600 rounded-lg shrink-0">
              <Paperclip className="w-5 h-5" />
            </button>
            <textarea 
              className="w-full bg-transparent text-sm p-2.5 max-h-32 min-h-[44px] resize-none outline-none text-zinc-800 placeholder-zinc-400 custom-scrollbar"
              placeholder="Digite sua mensagem para Mariana..."
              rows={1}
            ></textarea>
            <div className="p-1 shrink-0">
              <Button variant="primary" className="h-10 w-10 px-0 rounded-lg flex items-center justify-center">
                <Send className="w-4 h-4 -ml-0.5" />
              </Button>
            </div>
          </div>
          <div className="flex justify-between items-center mt-2 px-2">
             <span className="text-[10px] text-zinc-400">Pressione Enter para enviar</span>
             <button className="text-[10px] font-medium text-indigo-600 hover:underline flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Sugerir resposta com IA
             </button>
          </div>
        </div>

      </div>
    </Card>
  );
};

// ============================================================================
// ADMIN PROTOCOLS VIEW (Protocolos Base)
// ============================================================================
const AdminProtocolsView = () => {
  const [activeTab, setActiveTab] = useState('all');

  const protocols = [
    { id: 1, title: 'Hipertrofia Limpa (Masculino)', type: 'nutrition', uses: 342, author: 'Dr. Mendes', ia: true },
    { id: 2, title: 'Emagrecimento Acelerado', type: 'nutrition', uses: 512, author: 'Dr. Mendes', ia: true },
    { id: 3, title: 'Adaptação Anatômica (Iniciantes)', type: 'fitness', uses: 89, author: 'Sistema', ia: false },
    { id: 4, title: 'Força Máxima (Avançado)', type: 'fitness', uses: 45, author: 'Dr. Mendes', ia: true },
    { id: 5, title: 'Check-up Hormonal Completo', type: 'exams', uses: 120, author: 'Dr. Mendes', ia: false },
    { id: 6, title: 'Dieta Anti-inflamatória', type: 'nutrition', uses: 210, author: 'Dra. Silva', ia: true },
  ];

  const filtered = activeTab === 'all' ? protocols : protocols.filter(p => p.type === activeTab);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">Protocolos Base e Modelos</h2>
          <p className="text-sm text-zinc-500">Gerencie os moldes que alimentam as decisões da Inteligência Artificial.</p>
        </div>
        <Button variant="primary" icon={Plus}>Novo Protocolo</Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-200 pb-px">
        {[
          { id: 'all', label: 'Todos os Modelos' },
          { id: 'nutrition', label: 'Planos Nutricionais' },
          { id: 'fitness', label: 'Fichas de Treino' },
          { id: 'exams', label: 'Bateria de Exames' }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Grid de Protocolos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(protocol => (
          <Card key={protocol.id} hover className="flex flex-col relative group">
            <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="p-1.5 text-zinc-400 hover:text-zinc-900 bg-white shadow-sm border border-zinc-200 rounded-md"><Copy className="w-3.5 h-3.5" /></button>
              <button className="p-1.5 text-zinc-400 hover:text-zinc-900 bg-white shadow-sm border border-zinc-200 rounded-md"><Edit2 className="w-3.5 h-3.5" /></button>
            </div>
            
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${protocol.type === 'nutrition' ? 'bg-emerald-50 text-emerald-600' : protocol.type === 'fitness' ? 'bg-zinc-100 text-zinc-600' : 'bg-blue-50 text-blue-600'}`}>
                {protocol.type === 'nutrition' ? <Apple className="w-5 h-5" /> : protocol.type === 'fitness' ? <Dumbbell className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
              </div>
              <div>
                <Badge variant="gray" className="mb-1">{protocol.type === 'nutrition' ? 'Nutrição' : protocol.type === 'fitness' ? 'Treino' : 'Exames'}</Badge>
                <h4 className="font-bold text-zinc-900 text-sm">{protocol.title}</h4>
              </div>
            </div>

            <div className="mt-auto pt-4 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
              <div className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> {protocol.uses} usos
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-zinc-700">{protocol.author}</span>
                {protocol.ia ? <Unlock className="w-3.5 h-3.5 text-indigo-500" title="IA permitida para alterar" /> : <Lock className="w-3.5 h-3.5 text-amber-500" title="Protocólo rígido" />}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// ADMIN FINANCE VIEW (Faturamento)
// ============================================================================
const AdminFinanceView = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">Faturamento e Assinaturas</h2>
          <p className="text-sm text-zinc-500">Métricas de receita e controle de pagamentos dos pacientes.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="secondary" icon={Download}>Exportar</Button>
          <Button variant="primary" icon={Receipt}>Nova Cobrança</Button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'MRR (Receita Recorrente)', value: 'R$ 84.500', trend: '+12%', trendUp: true, icon: DollarSign },
          { title: 'Assinaturas Ativas', value: '842', trend: '+24 novos', trendUp: true, icon: Users },
          { title: 'Ticket Médio', value: 'R$ 100,35', trend: 'Estável', trendUp: true, icon: CreditCard },
          { title: 'Inadimplência', value: '2.4%', trend: '-0.5%', trendUp: true, icon: AlertTriangle, color: 'text-emerald-600' }
        ].map((kpi, idx) => (
          <Card key={idx} delay={idx * 50}>
             <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-medium text-zinc-500">{kpi.title}</p>
                <div className="p-1.5 bg-zinc-50 rounded-md text-zinc-400">
                  <kpi.icon className="w-4 h-4" />
                </div>
             </div>
             <h4 className="text-2xl font-bold text-zinc-900">{kpi.value}</h4>
             <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${kpi.color || (kpi.trendUp ? 'text-emerald-600' : 'text-red-600')}`}>
                {kpi.trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {kpi.trend} vs mês anterior
             </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Distribuição de Planos */}
        <Card className="flex flex-col">
          <h3 className="text-base font-bold text-zinc-900 mb-6">Distribuição de Planos</h3>
          <div className="space-y-4 flex-1">
            {[
              { name: 'Plano Completo', count: 420, percent: 50, color: 'bg-zinc-900' },
              { name: 'Plano Nutricional', count: 250, percent: 30, color: 'bg-emerald-500' },
              { name: 'Plano Treino', count: 172, percent: 20, color: 'bg-blue-500' },
            ].map((plan, idx) => (
              <div key={idx}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-zinc-700">{plan.name}</span>
                  <span className="text-zinc-500 font-medium">{plan.count} assinantes</span>
                </div>
                <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${plan.color}`} style={{ width: `${plan.percent}%` }}></div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-zinc-100 text-center">
             <button className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">Ver análise de retenção</button>
          </div>
        </Card>

        {/* Últimas Transações */}
        <Card className="lg:col-span-2 overflow-hidden flex flex-col" noPadding>
          <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
            <h3 className="text-base font-bold text-zinc-900">Últimas Transações</h3>
            <button className="text-xs font-semibold text-zinc-500 hover:text-zinc-900">Ver todas</button>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-zinc-100 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  <th className="px-5 py-3">Paciente</th>
                  <th className="px-5 py-3">Plano</th>
                  <th className="px-5 py-3">Valor</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 text-sm bg-white">
                {[
                  { name: 'Roberto Almeida', plan: 'Plano Nutricional', amount: 'R$ 89,90', status: 'Pago', sType: 'success', date: 'Hoje, 10:42' },
                  { name: 'Ana Souza', plan: 'Plano Nutricional', amount: 'R$ 89,90', status: 'Pendente', sType: 'warning', date: 'Hoje, 09:15' },
                  { name: 'Lucas Mendes', plan: 'Plano Treino', amount: 'R$ 79,90', status: 'Pago', sType: 'success', date: 'Ontem, 16:30' },
                  { name: 'Mariana Costa', plan: 'Plano Completo', amount: 'R$ 149,90', status: 'Falhou', sType: 'danger', date: 'Ontem, 14:20' },
                  { name: 'Fernando Silva', plan: 'Plano Completo', amount: 'R$ 149,90', status: 'Pago', sType: 'success', date: '22 Out, 11:00' },
                ].map((tx, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-zinc-900">{tx.name}</td>
                    <td className="px-5 py-3 text-zinc-500">{tx.plan}</td>
                    <td className="px-5 py-3 font-medium text-zinc-700">{tx.amount}</td>
                    <td className="px-5 py-3"><Badge variant={tx.sType}>{tx.status}</Badge></td>
                    <td className="px-5 py-3 text-right text-zinc-400 text-xs">{tx.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};

// ============================================================================
// PATIENT VIEW (Dashboard Preview - High Fidelity)
// ============================================================================

const PatientDashboardView = () => (
  <div className="space-y-6 max-w-5xl mx-auto">
    <div className="bg-zinc-900 rounded-2xl p-6 sm:p-8 text-white relative overflow-hidden shadow-lg border border-zinc-800">
      {/* Decorative gradient */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl transform translate-x-1/3 -translate-y-1/3"></div>
      
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <Badge variant="ai" icon={Sparkles} className="bg-indigo-500/20 text-indigo-200 border-indigo-500/30">Análise Semanal IA</Badge>
          <span className="text-xs text-zinc-400 font-medium tracking-wide">Atualizado há 2h</span>
        </div>
        
        <h3 className="text-2xl sm:text-3xl font-light mb-3 leading-tight max-w-2xl text-zinc-100">
          Baseado nos seus últimos check-ins, o algoritmo <strong className="font-semibold text-white">manteve o protocolo atual.</strong>
        </h3>
        <p className="text-zinc-400 text-sm sm:text-base leading-relaxed max-w-2xl mb-6">
          Sua adesão à dieta está em 92%. A leve perda de peso reportada (-0.4kg) está dentro da margem calculada para o objetivo de hipertrofia limpa. Continue focando na hidratação.
        </p>

        <Button className="bg-white text-zinc-900 hover:bg-zinc-100 font-semibold shadow-md">
          Ver Meu Plano Completo
        </Button>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Diet Summary Widget */}
      <Card className="flex flex-col h-full" hover>
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Apple className="w-4 h-4 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-zinc-900">Dieta: Hipertrofia</h3>
          </div>
          <span className="text-xs font-bold text-zinc-500 bg-zinc-100 px-2 py-1 rounded">2,400 kcal</span>
        </div>
        
        <div className="space-y-4 flex-1">
           {['Proteínas (160g)', 'Carboidratos (280g)'].map((label, i) => (
             <div key={i}>
               <div className="flex justify-between text-xs font-medium mb-1 text-zinc-600">
                 <span>{label}</span>
                 <span>Meta Ideal</span>
               </div>
               <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                 <div className={`h-full rounded-full ${i===0 ? 'bg-blue-500 w-[80%]' : 'bg-amber-500 w-[60%]'}`}></div>
               </div>
             </div>
           ))}
        </div>
      </Card>

      {/* Workout Summary Widget */}
      <Card className="flex flex-col h-full" hover>
         <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-600">
              <Dumbbell className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-zinc-900">Treino de Hoje</h3>
          </div>
          <Badge variant="gray">Atrasado</Badge>
        </div>
        <div className="flex-1 flex flex-col justify-center">
          <p className="text-sm font-medium text-zinc-500">Ficha A (Membros Inferiores)</p>
          <h4 className="text-xl font-bold text-zinc-900 mt-1">Quadríceps & Panturrilha</h4>
          <p className="text-xs text-zinc-400 mt-2 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Est. 50 min
          </p>
        </div>
      </Card>
    </div>
  </div>
);
import React from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, Outlet, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/auth/AuthProvider";
import LoginPage from "@/pages/LoginPage";
import PedidosPage from "@/pages/PedidosPage";
import PedidoDetalhePage from "@/pages/PedidoDetalhePage";
import ProdutosCriticosPage from "@/pages/ProdutosCriticosPage";
import ProdutosCriticosFornecedorPage from "@/pages/ProdutosCriticosFornecedorPage";
import DivergenciasPage from "@/pages/DivergenciasPage";
import DivergenciasFornecedorPage from "@/pages/DivergenciasFornecedorPage";
import ChatPage from "@/pages/ChatPage";
import SolicitacoesPage from "@/pages/SolicitacoesPage";
import SolicitacaoDetalhePage from "@/pages/SolicitacaoDetalhePage";
import SolicitacaoCotacaoPage from "@/pages/SolicitacaoCotacaoPage";

// shadcn/ui
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

// icons
import {
  LogOut,
  ShoppingCart,
  PackageSearch,
  FileWarning,
  MessageSquare,
  BarChart3,
  Menu,
  Search,
  User,
} from "lucide-react";

// charts
import { ResponsiveContainer, BarChart as RBarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";

// brand
import logo from "@/assets/nx_boats.png";
import { obterReg } from "./lib/obterReg";

/* =========================
   Protected Route
   ========================= */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const location = useLocation();
  if (!token) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

/* =========================
   Layout (Header + Sidebar)
   ========================= */
function AppLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = React.useState(true);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen((v) => !v)}>
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <img src={logo} alt="NX Boats" className="h-6 w-auto" />
              <div className="font-semibold tracking-tight">Painel do Comprador</div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input className="pl-9 w-64" placeholder="Buscar…" />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger className="focus:outline-none">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{user?.name || "Usuário"}</span>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={logout} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="mx-auto grid max-w-7xl grid-cols-1 md:grid-cols-[240px_1fr] gap-4 px-4 py-6">
        {/* Sidebar */}
        <aside
          className={`transition-all ${open ? "max-h-[999px] opacity-100" : "max-h-0 opacity-0 md:max-h-[999px] md:opacity-100"
            } md:opacity-100 md:max-h-none`}
        >
          <nav className="rounded-2xl border bg-white p-2 shadow-sm">
            <SidebarLink to="/" icon={<BarChart3 className="h-4 w-4" />}>
              Dashboard
            </SidebarLink>
            <SidebarLink to="/pedidos" icon={<ShoppingCart className="h-4 w-4" />}>
              Analisar pedidos
            </SidebarLink>
             <SidebarLink to="/solicitacoes" icon={<ShoppingCart className="h-4 w-4" />}>
              Solicitações de compra
            </SidebarLink>
            <SidebarLink to="/produtos-criticos" icon={<PackageSearch className="h-4 w-4" />}>
              Produtos críticos
            </SidebarLink>
            <SidebarLink to="/divergencias" icon={<FileWarning className="h-4 w-4" />}>
              Divergências recebimento
            </SidebarLink>
            <SidebarLink to="/chat" icon={<MessageSquare className="h-4 w-4" />}>
              Chat com IA
            </SidebarLink>
          </nav>
        </aside>

        {/* Content */}
        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarLink({
  to,
  icon,
  children,
}: {
  to: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const location = useLocation();
  const active = location.pathname === to || (to !== "/" && location.pathname.startsWith(to));
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium hover:bg-slate-50 ${active ? "bg-slate-100" : ""
        }`}
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}

/* =========================
   Pages (stubs prontos)
   ========================= */
/* =========================
   Pages (Dashboard)
   ========================= */
function DashboardPage() {
  const { user } = useAuth();
  const codvend = Number(user?.codvend || 0);

  // KPIs mock (mantidos por ora)
  const kpis = [
    { title: "Pedidos abertos", value: 128, badge: "+12%" },
    { title: "Valor em aberto (R$)", value: "1.274.900", badge: "-3%" },
    { title: "Itens críticos", value: 37, badge: "+5" },
    { title: "Divergências", value: 9, badge: "0" },
  ];

  const [statusData, setStatusData] = React.useState<Array<{ name: string; value: number }>>([]);
  const [loadingStatus, setLoadingStatus] = React.useState(false);
  const [errStatus, setErrStatus] = React.useState<string | null>(null);

  // Gráfico “Pedidos por mês” segue mock
  const pedidosMes = [
    { mes: "Jan", pedidos: 120 },
    { mes: "Fev", pedidos: 98 },
    { mes: "Mar", pedidos: 140 },
    { mes: "Abr", pedidos: 110 },
    { mes: "Mai", pedidos: 180 },
    { mes: "Jun", pedidos: 160 },
  ];

  // Cores do pie
  const pieColors = ["#16a34a", "#0ea5e9", "#ef4444", "#f59e0b", "#6366f1", "#22c55e", "#14b8a6", "#f97316", "#64748b"];

  React.useEffect(() => {
    if (!codvend) return;
    (async () => {
      setLoadingStatus(true);
      setErrStatus(null);
      try {
        // OBS: usamos NVL(...,'1') para garantir status “1” quando vier null
        const sql = `
SELECT
  COUNT(*) AS QTD,
  CASE
    WHEN NVL(PEDI.AD_STATUSPED,'1') = '1' THEN 'Pedido em aprovação'
    WHEN NVL(PEDI.AD_STATUSPED,'1') = '2' THEN 'Em Produção'
    WHEN NVL(PEDI.AD_STATUSPED,'1') = '3' THEN 'Aguardando embarque'
    WHEN NVL(PEDI.AD_STATUSPED,'1') = '4' THEN 'Em Transito'
    WHEN NVL(PEDI.AD_STATUSPED,'1') = '5' THEN 'Aguardando Liberação'
    WHEN NVL(PEDI.AD_STATUSPED,'1') = '6' THEN 'Desembaraçado'
    WHEN NVL(PEDI.AD_STATUSPED,'1') = '7' THEN 'Recebido'
    WHEN NVL(PEDI.AD_STATUSPED,'1') = '8' THEN 'Perdimento/Avaria'
    WHEN NVL(PEDI.AD_STATUSPED,'1') = '9' THEN 'Cancelado'
    ELSE 'Pedido em aprovação'
  END AS STATUSPED
FROM TGFCAB PEDI
JOIN TGFITE ITE ON ITE.NUNOTA = PEDI.NUNOTA
JOIN TGFPAR PAR ON PAR.CODPARC = PEDI.CODPARC
WHERE PEDI.TIPMOV = 'O'
  AND ITE.PENDENTE = 'S'
  AND PEDI.STATUSNOTA IN ('A','P')
  AND PEDI.CODTIPOPER <> 4
  AND PAR.CODVEND = ${codvend}
GROUP BY PEDI.AD_STATUSPED
        `.trim();

        const rows = await obterReg(sql);
        // rows: [{ QTD: number, STATUSPED: string }, ...]
        const pie = rows.map((r: any) => ({
          name: String(r.STATUSPED || "—"),
          value: Number(r.QTD || 0),
        }));
        setStatusData(pie);
      } catch (e: any) {
        setErrStatus(e?.response?.data?.erro || e?.message || "Falha ao carregar status de pedidos.");
        setStatusData([]);
      } finally {
        setLoadingStatus(false);
      }
    })();
  }, [codvend]);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <Card key={i} className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">{k.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <div className="text-3xl font-semibold tracking-tight">{k.value}</div>
              <Badge variant="secondary">{k.badge}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Pedidos por mês</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RBarChart data={pedidosMes}>
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="pedidos" radius={[6, 6, 0, 0]} />
              </RBarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">Status de pedidos</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {errStatus && <div className="text-xs text-red-600 mb-2">{errStatus}</div>}
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  isAnimationActive={!loadingStatus}
                >
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={pieColors[i % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            {loadingStatus && <div className="text-xs text-slate-500 mt-2">Carregando…</div>}
            {!loadingStatus && statusData.length === 0 && (
              <div className="text-xs text-slate-500 mt-2">Sem dados para exibir.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

//todo-- tirar pedidos page de exemplo
// function PedidosPage() {
//   const rows = [
//     { nunota: 10101, fornecedor: "ABC Náutica", valor: 125000, status: "AGUARDANDO", previsao: "2025-09-05" },
//     { nunota: 10155, fornecedor: "Marine Parts", valor: 45800, status: "APROVADO", previsao: "2025-09-12" },
//     { nunota: 10202, fornecedor: "Fibras Brasil", valor: 310000, status: "ATRASADO", previsao: "2025-08-20" },
//   ];

//   return (
//     <div className="space-y-4">
//       <div className="flex flex-wrap items-center gap-2">
//         <Input className="w-56" placeholder="Filtrar fornecedor…" />
//         <Input className="w-40" placeholder="Período ini" />
//         <Input className="w-40" placeholder="Período fim" />
//         <Button>Aplicar</Button>
//       </div>
//       <Card className="shadow-sm overflow-hidden">
//         <CardContent className="p-0">
//           <table className="w-full text-sm">
//             <thead className="bg-slate-50">
//               <tr>
//                 <th className="px-3 py-2 text-left">NUNOTA</th>
//                 <th className="px-3 py-2 text-left">Fornecedor</th>
//                 <th className="px-3 py-2 text-left">Valor (R$)</th>
//                 <th className="px-3 py-2 text-left">Status</th>
//                 <th className="px-3 py-2 text-left">Previsão</th>
//                 <th className="px-3 py-2 text-left"></th>
//               </tr>
//             </thead>
//             <tbody>
//               {rows.map((r, i) => (
//                 <tr key={i} className="border-t">
//                   <td className="px-3 py-2">{r.nunota}</td>
//                   <td className="px-3 py-2">{r.fornecedor}</td>
//                   <td className="px-3 py-2">{r.valor.toLocaleString("pt-BR")}</td>
//                   <td className="px-3 py-2">
//                     <Badge
//                       variant={
//                         r.status === "ATRASADO" ? "destructive" : r.status === "APROVADO" ? "default" : "secondary"
//                       }
//                     >
//                       {r.status}
//                     </Badge>
//                   </td>
//                   <td className="px-3 py-2">{new Date(r.previsao).toLocaleDateString("pt-BR")}</td>
//                   <td className="px-3 py-2 text-right">
//                     <Button variant="ghost" size="sm">
//                       Abrir
//                     </Button>
//                   </td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </CardContent>
//       </Card>
//     </div>
//   );
// }



/* =========================
   App (Routes)
   ========================= */
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* pública */}
          <Route path="/login" element={<LoginPage />} />

          {/* privadas */}
          <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index element={<DashboardPage />} />
            <Route path="pedidos" element={<PedidosPage />} />
            <Route path="pedidos/:nunota" element={<PedidoDetalhePage />} />

            <Route path="/produtos-criticos" element={<ProdutosCriticosPage />} />
            <Route path="/produtos-criticos/:codparc" element={<ProdutosCriticosFornecedorPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/solicitacoes" element={<SolicitacoesPage />} />
            <Route path="/solicitacoes/:codsol" element={<SolicitacaoDetalhePage />} />
            <Route path="/solicitacoes/:codsol/cotacao" element={<SolicitacaoCotacaoPage />} />

            <Route path="/divergencias" element={<DivergenciasPage />} />
            <Route path="/divergencias/:codparc" element={<DivergenciasFornecedorPage />} />
            <Route path="chat" element={<ChatPage />} />
          </Route>

          {/* fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

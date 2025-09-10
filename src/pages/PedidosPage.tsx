import React from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal, ExternalLink, Printer, Mail, CalendarDays, X,
  Clock, AlertTriangle, CheckCircle2
} from "lucide-react";

type Pedido = {
  nunota: number;
  fornecedor: string;
  vlrpedi: number;
  dtneg: string | null;      // ISO ou dd/mm/aaaa
  vlrnota: number;
  dtprevent: string | null;  // ISO ou dd/mm/aaaa
  status: "PLANEJADO" | "ATRASADO" | "SEM PREVISÃO" | string;
};

type StatusFilter = "ALL" | "SEM_PREV" | "ATRASADO" | "PLANEJADO";

export default function PedidosPage() {
  const navigate = useNavigate();

  const [data, setData] = React.useState<Pedido[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [actionMsg, setActionMsg] = React.useState<string | null>(null);
  const [actingNunota, setActingNunota] = React.useState<number | null>(null);

  // Filtros de busca
  const [fornecedor, setFornecedor] = React.useState("");
  const [ini, setIni] = React.useState<string>("");
  const [fim, setFim] = React.useState<string>("");

  // Filtro por card (status)
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("ALL");

  // Alterar previsão
  const [showPrev, setShowPrev] = React.useState(false);
  const [prevNunota, setPrevNunota] = React.useState<number | null>(null);
  const [prevDate, setPrevDate] = React.useState<string>(""); // yyyy-mm-dd

  // ===== Helpers de datas e formato =====
  const toBR = (s: string) => (s ? s.split("-").reverse().join("/") : "");

  const toInputYYYYMMDD = (dt?: string | null) => {
    if (!dt) return "";
    const s = String(dt).trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
      const [d, m, y] = s.split("/");
      return `${y}-${m}-${d}`;
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return "";
  };

  const fmtDate = (dt: string | null) => {
    if (!dt) return "—";
    const s = String(dt).trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
    const d = new Date(s);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
  };

  const fmtMoney = (v: number) =>
    (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const badgeVariant = (st: string) =>
    st === "ATRASADO" ? "destructive" : st === "PLANEJADO" ? "default" : "secondary";

  // ===== Carregar dados =====
  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const qs = new URLSearchParams();
      if (fornecedor.trim()) qs.set("fornecedor", fornecedor.trim());
      if (ini) qs.set("ini", toBR(ini));
      if (fim) qs.set("fim", toBR(fim));

      const { data } = await api.get<{ items: Pedido[] }>(`/api/pedidos?${qs.toString()}`);
      const items = (data.items || []).map(it => ({
        ...it,
        fornecedor: (it.fornecedor || "").trim(),
        status: (it.status || "").trim(),
      }));
      setData(items);
    } catch (e: any) {
      setErr(e?.response?.data?.erro || "Falha ao buscar pedidos");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [fornecedor, ini, fim]);

  React.useEffect(() => { fetchData(); }, []); // carga inicial

  // ===== Ações do menu =====
  const openPedido = (nunota: number) => navigate(`/pedidos/${nunota}`);

  const printPedido = async (nunota: number) => {
    setActingNunota(nunota); setActionMsg(null);
    try {
      const resp = await api.post(`/api/pedidos/${nunota}/print`, {}, { responseType: "blob" });
      const blob = new Blob([resp.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (e: any) {
      console.error("Imprimir pedido erro:", e?.response || e);
      setActionMsg(e?.response?.data?.erro || `Falha ao gerar PDF do pedido ${nunota}.`);
    } finally {
      setActingNunota(null);
    }
  };

  const emailPedido = async (nunota: number) => {
    const to = window.prompt("Enviar para qual e-mail?");
    if (!to) return;
    setActingNunota(nunota); setActionMsg(null);
    try {
      await api.post(`/api/pedidos/${nunota}/email`, { to }); // stub
      setActionMsg(`Pedido ${nunota} enviado para ${to}.`);
    } catch (e: any) {
      console.error("Enviar por e-mail erro:", e?.response || e);
      setActionMsg(e?.response?.data?.erro || `Falha ao enviar pedido ${nunota} por e-mail.`);
    } finally {
      setActingNunota(null);
    }
  };

  const abrirAlterarPrevisao = (nunota: number, current: string | null) => {
    setPrevNunota(nunota);
    setPrevDate(toInputYYYYMMDD(current));
    setShowPrev(true);
    setActionMsg(null);
  };

  const salvarPrevisao = async () => {
    if (!prevNunota || !prevDate) { setActionMsg("Selecione uma data."); return; }
    setActingNunota(prevNunota); setActionMsg(null);
    try {
      const br = prevDate.split("-").reverse().join("/"); // dd/mm/aaaa
      const { data: resp } = await api.post(`/api/pedidos/${prevNunota}/previsao`, { data: br });

      const dataISO = resp?.dataISO || new Date(prevDate).toISOString();
      const dataBR = resp?.dataBR || br;
      const nunotaResp = resp?.nunota || prevNunota;

      const normalizedISO = typeof dataISO === "string" && dataISO.length >= 10
        ? dataISO.slice(0, 10)
        : prevDate;

      setData(old => old.map(row =>
        row.nunota === prevNunota
          ? {
              ...row,
              dtprevent: normalizedISO,
              status: row.status === "SEM PREVISÃO" ? "PLANEJADO" : row.status,
            }
          : row
      ));

      setShowPrev(false);
      setPrevNunota(null);
      setPrevDate("");
      setActionMsg(`Previsão do pedido ${nunotaResp} alterada para ${dataBR}.`);
    } catch (e: any) {
      console.error("Alterar previsão erro:", e?.response || e);
      setActionMsg(e?.response?.data?.erro || `Falha ao alterar previsão do pedido ${prevNunota}.`);
    } finally {
      setActingNunota(null);
    }
  };

  // ===== Totais (sempre baseados na lista completa) =====
  const totSemPrev = React.useMemo(
    () => data.filter(r => !r.dtprevent || r.status?.toUpperCase() === "SEM PREVISÃO").length,
    [data]
  );
  const totAtrasado = React.useMemo(
    () => data.filter(r => r.status?.toUpperCase() === "ATRASADO").length,
    [data]
  );
  const totPlanejado = React.useMemo(
    () => data.filter(r => r.status?.toUpperCase() === "PLANEJADO").length,
    [data]
  );

  // ===== Filtragem por card/status =====
  const filteredData = React.useMemo(() => {
    switch (statusFilter) {
      case "SEM_PREV":
        return data.filter(r => !r.dtprevent || r.status?.toUpperCase() === "SEM PREVISÃO" || r.status?.toUpperCase() === "SEM PREVISAO");
      case "ATRASADO":
        return data.filter(r => r.status?.toUpperCase() === "ATRASADO");
      case "PLANEJADO":
        return data.filter(r => r.status?.toUpperCase() === "PLANEJADO");
      default:
        return data;
    }
  }, [data, statusFilter]);

  const toggleFilter = (next: StatusFilter) => {
    setStatusFilter(prev => (prev === next ? "ALL" : next));
  };

  const clearFilter = () => setStatusFilter("ALL");

  return (
    <div className="space-y-4">
      {/* Filtros de busca */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label className="text-xs text-slate-600">Fornecedor</label>
            <Input className="w-64" placeholder="Nome do fornecedor" value={fornecedor} onChange={(e)=>setFornecedor(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-600">Data Negociação (início)</label>
            <Input type="date" value={ini} onChange={(e)=>setIni(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-600">Data Negociação (fim)</label>
            <Input type="date" value={fim} onChange={(e)=>setFim(e.target.value)} />
          </div>
          <Button onClick={fetchData} disabled={loading}>{loading ? "Carregando…" : "Aplicar"}</Button>
          {err && <span className="text-sm text-red-600">{err}</span>}
          {actionMsg && <span className="text-sm text-slate-700">{actionMsg}</span>}
        </CardContent>
      </Card>

      {/* KPIs como filtros */}
      <div className="flex flex-wrap gap-3 items-stretch">
        <KpiFilter
          icon={<Clock className="h-4 w-4" />}
          label="Sem previsão"
          value={totSemPrev}
          tone="secondary"
          active={statusFilter === "SEM_PREV"}
          onClick={() => toggleFilter("SEM_PREV")}
        />
        <KpiFilter
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Atrasados"
          value={totAtrasado}
          tone="destructive"
          active={statusFilter === "ATRASADO"}
          onClick={() => toggleFilter("ATRASADO")}
        />
        <KpiFilter
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Planejados"
          value={totPlanejado}
          tone="success"
          active={statusFilter === "PLANEJADO"}
          onClick={() => toggleFilter("PLANEJADO")}
        />

        {statusFilter !== "ALL" && (
          <div className="ml-auto">
            <Button variant="outline" onClick={clearFilter}>
              <X className="mr-2 h-4 w-4" /> Limpar filtro
            </Button>
          </div>
        )}
      </div>

      {/* Painel de alterar previsão */}
      {showPrev && (
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 pt-4">
            <div className="text-sm font-medium">Alterar previsão do pedido {prevNunota}</div>
            <div className="space-y-1">
              <label className="text-xs text-slate-600">Nova data</label>
              <Input type="date" value={prevDate} onChange={(e)=>setPrevDate(e.target.value)} />
            </div>
            <div className="ml-auto flex gap-2">
              <Button onClick={salvarPrevisao} disabled={!prevDate || actingNunota === prevNunota}>Salvar</Button>
              <Button
                variant="outline"
                onClick={()=>{ setShowPrev(false); setPrevNunota(null); setPrevDate(""); }}>
                <X className="mr-2 h-4 w-4" /> Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela */}
      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left">NUNOTA</th>
                <th className="px-3 py-2 text-left">Fornecedor</th>
                <th className="px-3 py-2 text-left">Valor Pedido</th>
                <th className="px-3 py-2 text-left">Dt. Negociação</th>
                <th className="px-3 py-2 text-left">Valor Nota</th>
                <th className="px-3 py-2 text-left">Previsão</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((r) => (
                <tr key={r.nunota} className="border-t">
                  <td className="px-3 py-2">{r.nunota}</td>
                  <td className="px-3 py-2">{r.fornecedor}</td>
                  <td className="px-3 py-2">{fmtMoney(r.vlrpedi)}</td>
                  <td className="px-3 py-2">{fmtDate(r.dtneg)}</td>
                  <td className="px-3 py-2">{fmtMoney(r.vlrnota)}</td>
                  <td className="px-3 py-2">{fmtDate(r.dtprevent)}</td>
                  <td className="px-3 py-2">
                    <Badge variant={badgeVariant(r.status)}>{r.status || "—"}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Ações" disabled={actingNunota === r.nunota}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => openPedido(r.nunota)} className="cursor-pointer">
                          <ExternalLink className="mr-2 h-4 w-4" /> <span>Abrir pedido</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => printPedido(r.nunota)} className="cursor-pointer">
                          <Printer className="mr-2 h-4 w-4" /> <span>Imprimir o pedido</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => emailPedido(r.nunota)} className="cursor-pointer">
                          <Mail className="mr-2 h-4 w-4" /> <span>Enviar por e-mail</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => abrirAlterarPrevisao(r.nunota, r.dtprevent)} className="cursor-pointer">
                          <CalendarDays className="mr-2 h-4 w-4" /> <span>Alterar data de previsão</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {!loading && filteredData.length === 0 && (
                <tr className="border-t">
                  <td className="px-3 py-6 text-center text-slate-500" colSpan={8}>Nenhum pedido encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ====== Subcomponentes ====== */
function KpiFilter({
  icon, label, value, tone = "secondary", active = false, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone?: "secondary" | "destructive" | "success";
  active?: boolean;
  onClick?: () => void;
}) {
  const baseTone =
    tone === "destructive"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-slate-200 bg-white text-slate-800";

  const activeRing =
    active
      ? "ring-2 ring-slate-400"
      : "hover:ring-1 hover:ring-slate-300 transition";

  return (
    <Card
      className={`shadow-sm cursor-pointer select-none ${baseTone} ${activeRing}`}
      onClick={onClick}
      role="button"
      aria-pressed={active}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick?.(); }}
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-xs">
          {icon}<span>{label}</span>
        </div>
        <div className="text-xl font-semibold mt-1">{value}</div>
        {active && <div className="mt-1 text-[11px] text-slate-600">Filtro aplicado</div>}
      </CardContent>
    </Card>
  );
}

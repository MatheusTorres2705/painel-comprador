// src/pages/PedidosPage.tsx
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
  Clock, AlertTriangle, CheckCircle2, Settings
} from "lucide-react";

type StatusPedCode = "1"|"2"|"3"|"4"|"5"|"6"|"7"|"8"|"9";
const STATUSPED_LABEL: Record<StatusPedCode, string> = {
  "1": "Pedido em aprovação",
  "2": "Em Produção",
  "3": "Aguardando embarque",
  "4": "Em Trânsito",
  "5": "Aguardando Liberação",
  "6": "Desembaraçado",
  "7": "Recebido",
  "8": "Perdimento/Avaria",
  "9": "Cancelado",
};

type Pedido = {
  nunota: number;
  fornecedor: string;
  vlrpedi: number;
  dtneg: string | null;      // ISO ou dd/mm/aaaa
  vlrnota: number;
  dtprevent: string | null;  // ISO ou dd/mm/aaaa
  status: "PLANEJADO" | "ATRASADO" | "SEM PREVISÃO" | string;
  statusped?: string;
  statuspedCode?: StatusPedCode;
  statuslib?: string | null;      // NOVO: status da liberação
  obsreprovado?: string | null;   // NOVO: observação do liberador (tooltip)
};

type StatusFilter = "ALL" | "SEM_PREV" | "ATRASADO" | "PLANEJADO";

/* ===== helpers statusped ===== */
function guessStatusPedCode(s: string | undefined | null): StatusPedCode | null {
  const t = String(s || "").trim().toLowerCase();
  if (!t) return null;
  const entries = Object.entries(STATUSPED_LABEL) as [StatusPedCode,string][];
  for (const [code, label] of entries) {
    if (t === code || t === label.toLowerCase()) return code;
  }
  if (t.includes("aprova")) return "1";
  if (t.includes("produ")) return "2";
  if (t.includes("embar")) return "3";
  if (t.includes("trâns") || t.includes("transit")) return "4";
  if (t.includes("libera")) return "5";
  if (t.includes("desemb")) return "6";
  if (t.includes("receb")) return "7";
  if (t.includes("avaria") || t.includes("perdiment")) return "8";
  if (t.includes("cancel")) return "9";
  return null;
}

/* ===== normalizador do status de liberação ===== */
function normalizeLib(s?: string | null) {
  const t = String(s ?? "").trim();
  return t || "(Sem status)";
}

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

  // Filtros por cards/status geral
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("ALL");

  // Filtro por statusped (código)
  const [statusPedFilter, setStatusPedFilter] = React.useState<"ALL" | StatusPedCode>("ALL");

  // NOVO: Filtro por status de liberação
  const [statusLibFilter, setStatusLibFilter] = React.useState<string>("ALL");

  // Opções dinâmicas do select de liberação (derivadas dos dados carregados)
  const statusLibOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of data) set.add(normalizeLib(r.statuslib));
    return Array.from(set).sort((a,b) => a.localeCompare(b, "pt-BR"));
  }, [data]);

  // Alterar previsão
  const [showPrev, setShowPrev] = React.useState(false);
  const [prevNunota, setPrevNunota] = React.useState<number | null>(null);
  const [prevDate, setPrevDate] = React.useState<string>(""); // yyyy-mm-dd

  // Atualizar status (DatasetSP.save / CabecalhoNota)
  const [showUpd, setShowUpd] = React.useState(false);
  const [updNunota, setUpdNunota] = React.useState<number | null>(null);
  const [updStatus, setUpdStatus] = React.useState<StatusPedCode>("1");
  const [updObs, setUpdObs] = React.useState<string>("");
  const [updDate, setUpdDate] = React.useState<string>(""); // yyyy-mm-dd
  const [updDebug, setUpdDebug] = React.useState<any>(null);

  // ===== Helpers =====
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

      const { data } = await api.get<{ items: any[] }>(`/api/pedidos?${qs.toString()}`);

      const items: Pedido[] = (data.items || []).map((it: any) => {
        const rawCode =
          it.statuspedCode ??
          it.statuspedcode ??
          it.AD_STATUSPED ??
          it.ad_statusped ??
          null;

        const inferred = guessStatusPedCode(it.statusped ?? it.STATUSPED);
        const code: StatusPedCode = String(rawCode || inferred || "1") as StatusPedCode;

        return {
          nunota: Number(it.nunota ?? it.NUNOTA),
          fornecedor: String(it.fornecedor ?? it.NOMEPARC ?? "").trim(),
          vlrpedi: Number(it.vlrpedi ?? it.VLRPEDI ?? 0),
          dtneg: it.dtneg ?? it.DTNEG_ISO ?? null,
          vlrnota: Number(it.vlrnota ?? it.VLRNOTA ?? 0),
          dtprevent: it.dtprevent ?? it.DTPREVENT_ISO ?? null,
          status: String(it.status ?? it.STATUS ?? "").trim(),
          statusped: String(it.statusped ?? it.STATUSPED ?? STATUSPED_LABEL[code]),
          statuspedCode: code,
          statuslib: it.statuslib ?? it.STATUSLIB ?? null,            // << NOVO
          obsreprovado: it.obsreprovado ?? it.OBSREPROVADO ?? null,  // << NOVO
        };
      });

      setData(items);
    } catch (e: any) {
      setErr(e?.response?.data?.erro || "Falha ao buscar pedidos");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [fornecedor, ini, fim]);

  React.useEffect(() => { fetchData(); }, []); // carga inicial

  // ===== Ações =====
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

  // Alterar previsão
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

  // Atualizar status (DatasetSP.save / CabecalhoNota)
  const abrirAtualizarStatus = (nunota: number, currentTxt: string | undefined | null) => {
    setUpdNunota(nunota);
    const code = guessStatusPedCode(currentTxt || "") || "1";
    setUpdStatus(code);
    setUpdObs("");
    setUpdDate("");
    setUpdDebug(null);
    setShowUpd(true);
    setActionMsg(null);
  };

  const salvarAtualizarStatus = async () => {
    if (!updNunota) { setActionMsg("Pedido inválido."); return; }
    setActingNunota(updNunota);
    setActionMsg(null);
    setUpdDebug(null);

    const fields: string[] = ["AD_STATUSPED"];
    const values: Record<string, any> = { "0": String(updStatus) };

    if (updDate) {
      fields.push("DTPREVENT");
      values[String(fields.length - 1)] = toBR(updDate);
    }
    if (updObs && updObs.trim()) {
      fields.push("OBSERVACAO");
      values[String(fields.length - 1)] = updObs.toUpperCase();
    }

    const body = { entity: "CabecalhoNota", fields, pk: { NUNOTA: updNunota }, values };

    try {
      const { data: resp } = await api.post("/api/sankhya/dataset/save", body);
      setUpdDebug(resp);

      const ok =
        String(resp?.STATUS ?? resp?.RETORNO?.status ?? "").trim() === "1" ||
        String(resp?.RETORNO?.status ?? "").trim() === "1";

      if (!ok) {
        setActionMsg(`⚠️ Retorno inesperado ao atualizar status. Veja o JSON abaixo.`);
      } else {
        setData(old => old.map(row => {
          if (row.nunota !== updNunota) return row;
          const updated: Pedido = {
            ...row,
            statusped: STATUSPED_LABEL[updStatus],
            statuspedCode: updStatus,
          };
          if (updDate) {
            updated.dtprevent = updDate;
            if (!row.status || row.status.toUpperCase() === "SEM PREVISÃO") {
              updated.status = "PLANEJADO";
            }
          }
          return updated;
        }));
        setShowUpd(false);
        setUpdNunota(null);
        setUpdDate("");
        setUpdObs("");
        setActionMsg(`✅ Status do pedido ${updNunota} atualizado para "${STATUSPED_LABEL[updStatus]}".`);
      }
    } catch (e: any) {
      console.error("Atualizar status erro:", e?.response || e);
      setActionMsg(e?.response?.data?.erro || `Falha ao atualizar status do pedido ${updNunota}.`);
    } finally {
      setActingNunota(null);
    }
  };

  // ===== Totais =====
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

  const totPorStatusPed = React.useMemo(() => {
    const map: Record<StatusPedCode, number> = { "1":0,"2":0,"3":0,"4":0,"5":0,"6":0,"7":0,"8":0,"9":0 };
    for (const r of data) {
      const code = (r.statuspedCode || guessStatusPedCode(r.statusped) || "1") as StatusPedCode;
      map[code] += 1;
    }
    return map;
  }, [data]);

  // ===== Filtragem combinada =====
  const filteredData = React.useMemo(() => {
    let base = data;

    // 1) status geral (cards)
    switch (statusFilter) {
      case "SEM_PREV":
        base = base.filter(r => !r.dtprevent || r.status?.toUpperCase() === "SEM PREVISÃO" || r.status?.toUpperCase() === "SEM PREVISAO");
        break;
      case "ATRASADO":
        base = base.filter(r => r.status?.toUpperCase() === "ATRASADO");
        break;
      case "PLANEJADO":
        base = base.filter(r => r.status?.toUpperCase() === "PLANEJADO");
        break;
      default:
        break;
    }

    // 2) status do pedido (AD_STATUSPED)
    if (statusPedFilter !== "ALL") {
      base = base.filter(r => (r.statuspedCode || guessStatusPedCode(r.statusped) || "1") === statusPedFilter);
    }

    // 3) NOVO: status da liberação
    if (statusLibFilter !== "ALL") {
      base = base.filter(r => normalizeLib(r.statuslib) === statusLibFilter);
    }

    return base;
  }, [data, statusFilter, statusPedFilter, statusLibFilter]);

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

          {/* Filtro por Status do Pedido (AD_STATUSPED) */}
          <div className="space-y-1">
            <label className="text-xs text-slate-600">Status do Pedido</label>
            <select
              className="border rounded-md px-2 py-2 text-sm w-64"
              value={statusPedFilter}
              onChange={(e)=>setStatusPedFilter(e.target.value as any)}
            >
              <option value="ALL">Todos</option>
              {Object.entries(STATUSPED_LABEL).map(([k, lbl]) => (
                <option key={k} value={k}>{k} — {lbl}</option>
              ))}
            </select>
          </div>

          {/* NOVO: Filtro por Status da Liberação */}
          <div className="space-y-1">
            <label className="text-xs text-slate-600">Status da Liberação</label>
            <select
              className="border rounded-md px-2 py-2 text-sm w-64"
              value={statusLibFilter}
              onChange={(e)=>setStatusLibFilter(e.target.value)}
              disabled={statusLibOptions.length === 0}
            >
              <option value="ALL">Todos</option>
              {statusLibOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
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

        {/* Totais por statusped (informativo) */}
        <div className="ml-auto text-xs text-slate-600 self-end">
          <span className="mr-3">Status do Pedido: </span>
          {Object.entries(STATUSPED_LABEL).map(([k, lbl]) => (
            <span key={k} className="mr-3">{lbl}: <b>{totPorStatusPed[k as StatusPedCode]}</b></span>
          ))}
        </div>

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

      {/* Modal Atualizar Status */}
      {showUpd && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Atualizar status — Pedido {updNunota}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-600">Status</label>
              <select
                className="border rounded-md px-2 py-1 text-sm"
                value={updStatus}
                onChange={(e)=>setUpdStatus(e.target.value as StatusPedCode)}
              >
                {Object.entries(STATUSPED_LABEL).map(([k, lbl]) => (
                  <option key={k} value={k}>{k} — {lbl}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-600">Nova previsão (opcional)</label>
              <Input type="date" value={updDate} onChange={(e)=>setUpdDate(e.target.value)} />
            </div>
            <div className="flex-1 min-w-[280px] space-y-1">
              <label className="text-xs text-slate-600">Observação (opcional)</label>
              <textarea
                className="w-full border rounded-md px-2 py-1 text-sm"
                rows={2}
                value={updObs}
                onChange={(e)=>setUpdObs(e.target.value)}
                placeholder="Ex.: Pedido liberado pela fiscalização…"
              />
            </div>

            <div className="ml-auto flex gap-2">
              <Button onClick={salvarAtualizarStatus} disabled={actingNunota === updNunota}>
                {actingNunota === updNunota ? "Salvando..." : "Salvar"}
              </Button>
              <Button variant="outline" onClick={()=>{ setShowUpd(false); setUpdNunota(null); }}>
                <X className="mr-2 h-4 w-4" /> Cancelar
              </Button>
            </div>

            {updDebug && (
              <div className="basis-full mt-3">
                <div className="text-xs text-slate-600 mb-1">Retorno do backend</div>
                <pre className="text-xs bg-slate-50 p-3 rounded border overflow-auto max-h-64">
{JSON.stringify(updDebug, null, 2)}
                </pre>
              </div>
            )}
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
                <th className="px-3 py-2 text-left">Previsão</th>
                <th className="px-3 py-2 text-left">Status</th>
                {/* Coluna Liberação com tooltip de obsreprovado */}
                <th className="px-3 py-2 text-left">Liberação</th>
                <th className="px-3 py-2 text-left">Status Pedido</th>
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
                  <td className="px-3 py-2">{fmtDate(r.dtprevent)}</td>
                  <td className="px-3 py-2">
                    <Badge variant={badgeVariant(r.status)}>{r.status || "—"}</Badge>
                  </td>

                  {/* Célula de Liberação com tooltip nativo (obsreprovado) */}
                  <td className="px-3 py-2">
                    <span
                      title={r.obsreprovado || ""}
                      className="inline-block max-w-[220px] truncate align-middle"
                    >
                      {normalizeLib(r.statuslib)}
                    </span>
                  </td>

                  <td className="px-3 py-2">{r.statusped || STATUSPED_LABEL["1"]}</td>
                  <td className="px-3 py-2 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Ações" disabled={actingNunota === r.nunota}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-64">
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
                        <DropdownMenuItem onClick={() => abrirAtualizarStatus(r.nunota, r.statusped)} className="cursor-pointer">
                          <Settings className="mr-2 h-4 w-4" /> <span>Atualizar status</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {!loading && filteredData.length === 0 && (
                <tr className="border-t">
                  <td className="px-3 py-6 text-center text-slate-500" colSpan={10}>Nenhum pedido encontrado.</td>
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

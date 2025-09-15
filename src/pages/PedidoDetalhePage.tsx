import React from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/* ===== Tipos ===== */
type Header = {
  nunota: number;
  fornecedor: string;
  dtneg: string | null;     // ISO
  dtprevent: string | null; // ISO
  vlrnota: number;
  statusped?: string;       // texto do status do pedido
};

type Item = {
  nunota: number;
  sequencia: number;       // PK
  codprod: number;
  descrprod: string;
  codvol: string;
  qtd: number;             // pendente
  vlrunit: number;         // unitário atual
  vlrpedi: number;         // valor pendente (informativo)
};

type Edited = Record<number, { qtd: number; vlrunit: number }>; // key = sequencia

/* ===== Helpers ===== */
const fmtMoney = (v: number) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
};

const statusMap: Record<string, string> = {
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

export default function PedidoDetalhePage() {
  const { nunota } = useParams<{ nunota: string }>();

  const [header, setHeader] = React.useState<Header | null>(null);
  const [items, setItems] = React.useState<Item[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  // follow-up (agora via DatasetSP.save)
  const [showFollow, setShowFollow] = React.useState(false);
  const [followText, setFollowText] = React.useState("");      // AD_OBSSTATUS
  const [followDue, setFollowDue] = React.useState<string>(""); // yyyy-mm-dd → DTPREVENT
  const [followStatus, setFollowStatus] = React.useState<string>(""); // AD_STATUSPED

  // ações gerais
  const [actionMsg, setActionMsg] = React.useState<string | null>(null);
  const [acting, setActing] = React.useState(false);

  // edição de itens
  const [edited, setEdited] = React.useState<Edited>({}); // mudanças locais

  React.useEffect(() => {
    (async () => {
      if (!nunota) return;
      setLoading(true); setErr(null);
      try {
        const { data } = await api.get<{ header: Header; items: Item[] }>(`/api/pedidos/${nunota}`);
        setHeader(data.header);
        setItems((data.items || []).map(it => ({
          ...it,
          descrprod: (it.descrprod || "").trim(),
          codvol: (it.codvol || "").trim(),
          vlrunit: Number(it.vlrunit ?? 0),
          qtd: Number(it.qtd ?? 0),
        })));
        setEdited({});
      } catch (e: any) {
        console.error("GET /api/pedidos/:nunota erro:", e?.response || e);
        setErr(e?.response?.data?.erro || "Falha ao carregar detalhe do pedido");
      } finally {
        setLoading(false);
      }
    })();
  }, [nunota]);

  // ===== Impressão =====
  const handlePrint = async () => {
    if (!nunota) return;
    setActing(true); setActionMsg(null);
    try {
      const resp = await api.post(`/api/pedidos/${nunota}/print`, {}, { responseType: "blob" });
      const blob = new Blob([resp.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (e: any) {
      console.error("Imprimir pedido erro:", e?.response || e);
      setActionMsg(e?.response?.data?.erro || "Falha ao gerar PDF do pedido.");
    } finally {
      setActing(false);
    }
  };

  // ===== Cancelar (mantido para não quebrar o botão) =====
  // ===== Cancelar pedido via DatasetSP.save (PENDENTE = 'N') =====
const handleCancel = async () => {
  if (!nunota) return;

  const ok = window.confirm(
    `Confirma o cancelamento do pedido ${nunota}?\n` +
    `Isso irá definir PENDENTE='N' e o pedido será considerado cancelado.`
  );
  if (!ok) return;

  setActing(true);
  setActionMsg(null);

  try {
    const body = {
      entity: "CabecalhoNota",
      fields: ["PENDENTE"],          // apenas o campo que vamos alterar
      pk: { NUNOTA: Number(nunota) },// PK do cabeçalho
      values: { "0": "N" },          // índice 0 -> "PENDENTE"
    };

    const { data } = await api.post("/api/sankhya/dataset/save", body);
    const status = String(data?.RETORNO?.status ?? data?.STATUS ?? "0");
    if (status !== "1") {
      throw new Error(data?.RETORNO?.statusMessage || "Falha ao cancelar o pedido.");
    }

    // feedback e pequenos ajustes visuais locais
    setActionMsg("✅ Pedido cancelado com sucesso (PENDENTE='N').");
    setHeader(prev => prev ? { ...prev, statusped: "Cancelado" } : prev);
  } catch (e: any) {
    console.error("Cancelar pedido (DatasetSP.save) erro:", e?.response || e);
    setActionMsg(e?.response?.data?.erro || e?.message || "Falha ao cancelar o pedido.");
  } finally {
    setActing(false);
  }
};


  // ===== Follow-up → DatasetSP.save (AD_STATUSPED, AD_OBSSTATUS, DTPREVENT) =====
  const handleFollowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nunota) return;

    // monta fields/values apenas com o que foi preenchido
    const fields: string[] = [];
    const values: Record<string, string> = {};

    if (followStatus) {
      fields.push("AD_STATUSPED");
      values[String(fields.length - 1)] = followStatus; // índice 0 (ou o atual)
    }
    if (followText.trim()) {
      fields.push("AD_OBSSTATUS");
      values[String(fields.length - 1)] = followText.trim();
    }
    if (followDue) {
      // yyyy-mm-dd -> dd/mm/yyyy
      const toBR = (s: string) => (s ? s.split("-").reverse().join("/") : "");
      fields.push("DTPREVENT");
      values[String(fields.length - 1)] = toBR(followDue);
    }

    if (fields.length === 0) {
      setActionMsg("Preencha ao menos um campo (Status, Observação ou Nova Data).");
      return;
    }

    setActing(true); setActionMsg(null);
    try {
      const body = {
        entity: "CabecalhoNota",
        fields,
        pk: { NUNOTA: Number(nunota) },
        values,
      };

      const { data } = await api.post("/api/sankhya/dataset/save", body);
      const ok = String(data?.RETORNO?.status ?? data?.STATUS ?? "0") === "1";
      if (!ok) {
        throw new Error(data?.RETORNO?.statusMessage || "Falha ao atualizar o pedido.");
      }

      // Reflete alterações na UI
      setHeader(prev => {
        if (!prev) return prev;
        let next: Header = { ...prev };
        if (followStatus) next.statusped = statusMap[followStatus] || followStatus;
        if (followDue) {
          // guardar em ISO simples (YYYY-MM-DD) para exibir no cabeçalho
          next.dtprevent = `${followDue}`; // o fmtDate lida bem com ISO básico
        }
        return next;
      });

      setActionMsg("Follow-up aplicado com sucesso.");
      setShowFollow(false);
      setFollowText("");
      setFollowDue("");
      setFollowStatus("");
    } catch (e: any) {
      console.error("Salvar follow-up (DatasetSP.save) erro:", e?.response || e);
      setActionMsg(e?.response?.data?.erro || e?.message || "Falha ao aplicar follow-up.");
    } finally {
      setActing(false);
    }
  };

  // ===== Edição de itens =====
  const startEdit = (seq: number) => {
    const it = items.find(x => x.sequencia === seq);
    if (!it) return;
    setEdited(prev => ({
      ...prev,
      [seq]: prev[seq] ?? { qtd: it.qtd, vlrunit: it.vlrunit },
    }));
  };

  const setEditQtd = (seq: number, value: number) => {
    startEdit(seq);
    setEdited(prev => ({ ...prev, [seq]: { ...(prev[seq] ?? { qtd: 0, vlrunit: 0 }), qtd: value } }));
  };

  const setEditUnit = (seq: number, value: number) => {
    startEdit(seq);
    setEdited(prev => ({ ...prev, [seq]: { ...(prev[seq] ?? { qtd: 0, vlrunit: 0 }), vlrunit: value } }));
  };

  const editedCount = React.useMemo(() => Object.keys(edited).length, [edited]);

  const discardChanges = () => setEdited({});

  const confirmAndSave = async () => {
    if (!nunota || editedCount === 0) return;
    const ok = window.confirm(
      `Você está prestes a atualizar ${editedCount} item(ns).\n` +
      `O pedido seguirá para liberação novamente.\n\nConfirmar?`
    );
    if (!ok) return;

    setActing(true); setActionMsg(null);

    try {
      const nunotaNum = Number(nunota);
      const results: Array<{ seq: number; ok: boolean; msg?: string }> = [];

      for (const [k, v] of Object.entries(edited)) {
        const seq = Number(k);
        const body = {
          entity: "ItemNota",
          fields: ["QTDNEG", "VLRUNIT"],
          pk: { NUNOTA: nunotaNum, SEQUENCIA: seq },
          values: { "0": String(v.qtd), "1": String(v.vlrunit) },
        };

        try {
          const { data } = await api.post("/api/sankhya/dataset/save", body);
          const status = String(data?.RETORNO?.status ?? data?.STATUS ?? "0");
          if (status === "1") {
            results.push({ seq, ok: true });
          } else {
            results.push({
              seq, ok: false,
              msg: data?.RETORNO?.statusMessage || "Falha ao atualizar o item.",
            });
          }
        } catch (e: any) {
          results.push({
            seq, ok: false,
            msg: e?.response?.data?.erro || e?.message || "Erro no envio deste item.",
          });
        }
      }

      const oks = results.filter(r => r.ok).length;
      const fails = results.length - oks;

      if (oks > 0) {
        setItems(old =>
          old.map(it => {
            const ch = edited[it.sequencia];
            return ch ? { ...it, qtd: ch.qtd, vlrunit: ch.vlrunit } : it;
          })
        );
      }

      setEdited({});

      if (fails === 0) {
        setActionMsg(`✅ Atualização concluída: ${oks} item(ns) alterado(s).`);
      } else {
        const msgList = results.filter(r => !r.ok).map(r => `Seq ${r.seq}: ${r.msg}`).join(" | ");
        setActionMsg(`⚠️ ${oks} ok / ${fails} falha(s). Detalhes: ${msgList}`);
      }
    } catch (e: any) {
      setActionMsg(e?.response?.data?.erro || "Falha ao aplicar alterações.");
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="space-y-4 print:p-0">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <h1 className="text-lg font-semibold">Pedido {nunota}</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/pedidos">Voltar</Link>
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            Imprimir Pedido
          </Button>
          <Button onClick={() => setShowFollow((v) => !v)}>
            Registrar Follow-up
          </Button>
          <Button variant="destructive" onClick={handleCancel} disabled={acting}>
            Cancelar Pedido
          </Button>
        </div>
      </div>

      {actionMsg && <p className="text-sm text-slate-700">{actionMsg}</p>}
      {err && <p className="text-red-600 text-sm">{err}</p>}

      {/* Cabeçalho */}
      <Card className="print:border-0 print:shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Cabeçalho</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <div>
            <span className="text-xs text-slate-500">Fornecedor</span>
            <div>{header?.fornecedor ?? "—"}</div>
          </div>
          <div>
            <span className="text-xs text-slate-500">Dt. Negociação</span>
            <div>{fmtDate(header?.dtneg ?? null)}</div>
          </div>
          <div>
            <span className="text-xs text-slate-500">Valor da Nota</span>
            <div>{header ? fmtMoney(header.vlrnota) : "—"}</div>
          </div>
          <div>
            <span className="text-xs text-slate-500">Status atual</span>
            <div>{header?.statusped ?? "—"}</div>
          </div>
        </CardContent>
      </Card>

      {/* Form de Follow-up (via DatasetSP.save) */}
      {showFollow && (
        <Card className="print:hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Novo Follow-up</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleFollowSubmit} className="grid gap-3 sm:grid-cols-[1fr_180px_220px_auto]">
              <div className="sm:col-span-1">
                <label className="text-xs text-slate-600">Observação (AD_OBSSTATUS)</label>
                <textarea
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
                  value={followText}
                  onChange={(e) => setFollowText(e.target.value)}
                  placeholder="Ex.: Cobrar fornecedor sobre envio do item X"
                  rows={3}
                />
              </div>
              <div>
                <label className="text-xs text-slate-600">Nova data de entrega (DTPREVENT)</label>
                <Input type="date" value={followDue} onChange={(e) => setFollowDue(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-slate-600">Status (AD_STATUSPED)</label>
                <select
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={followStatus}
                  onChange={(e) => setFollowStatus(e.target.value)}
                >
                  <option value="">— não alterar —</option>
                  <option value="1">1 — Pedido em aprovação</option>
                  <option value="2">2 — Em Produção</option>
                  <option value="3">3 — Aguardando embarque</option>
                  <option value="4">4 — Em Trânsito</option>
                  <option value="5">5 — Aguardando Liberação</option>
                  <option value="6">6 — Desembaraçado</option>
                  <option value="7">7 — Recebido</option>
                  <option value="8">8 — Perdimento/Avaria</option>
                  <option value="9">9 — Cancelado</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" disabled={acting}>Salvar</Button>
                <Button type="button" variant="outline" onClick={() => setShowFollow(false)}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Banner de alterações de itens */}
      {Object.keys(edited).length > 0 && (
        <div className="rounded-lg border bg-amber-50 border-amber-200 text-amber-900 p-3 flex items-center gap-3">
          <div className="text-sm font-medium">
            {Object.keys(edited).length} item(ns) alterado(s). Ao confirmar, o pedido seguirá para liberação novamente.
          </div>
          <div className="ml-auto flex gap-2">
            <Button size="sm" onClick={confirmAndSave} disabled={acting}>
              Confirmar alterações
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEdited({})} disabled={acting}>
              Descartar
            </Button>
          </div>
        </div>
      )}

      {/* Itens */}
      <Card className="shadow-sm overflow-hidden print:border-0 print:shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Itens pendentes</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="min-w-[880px] w-full text-sm">
            <thead className="bg-slate-50 print:bg-white">
              <tr>
                <th className="px-3 py-2 text-left">Seq</th>
                <th className="px-3 py-2 text-left">Cód. Produto</th>
                <th className="px-3 py-2 text-left">Descrição</th>
                <th className="px-3 py-2 text-left">Un.</th>
                <th className="px-3 py-2 text-left">Qtd (editável)</th>
                <th className="px-3 py-2 text-left">Vlr unit. (editável)</th>
                <th className="px-3 py-2 text-left">Valor pendente</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const e = edited[it.sequencia];
                const qtdVal = e ? e.qtd : it.qtd;
                const unitVal = e ? e.vlrunit : it.vlrunit;

                return (
                  <tr key={it.sequencia} className="border-t">
                    <td className="px-3 py-2">{it.sequencia}</td>
                    <td className="px-3 py-2">{it.codprod}</td>
                    <td className="px-3 py-2">{it.descrprod}</td>
                    <td className="px-3 py-2">{it.codvol}</td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={qtdVal}
                        onChange={(e) => setEditQtd(it.sequencia, Number(e.target.value || 0))}
                        onFocus={() => startEdit(it.sequencia)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={unitVal}
                        onChange={(e) => setEditUnit(it.sequencia, Number(e.target.value || 0))}
                        onFocus={() => startEdit(it.sequencia)}
                      />
                    </td>
                    <td className="px-3 py-2">{fmtMoney(it.vlrpedi)}</td>
                  </tr>
                );
              })}
              {!loading && items.length === 0 && (
                <tr className="border-t">
                  <td className="px-3 py-6 text-center text-slate-500" colSpan={7}>
                    Sem itens pendentes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

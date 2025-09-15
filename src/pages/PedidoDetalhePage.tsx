// src/pages/PedidoDetalhePage.tsx
import React from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// --------- CONFIG: ajuste se os nomes dos campos diferirem no seu dicionário ----------
const ENTITY_CAB = "CabecalhoNota";
const FIELD_FOLLOW_DESC = "AD_OBSFOLLOW";     // descrição do follow-up
const FIELD_FOLLOW_DUE  = "AD_PRAZOFOLLOW";   // prazo (data)
// -------------------------------------------------------------------------------------

type Header = {
  nunota: number;
  fornecedor: string;
  dtneg: string | null;     // ISO
  dtprevent: string | null; // ISO
  vlrnota: number;
};

type Item = {
  nunota: number;
  codprod: number;
  descrprod: string;
  codvol: string;
  qtd: number;      // pendente
  vlrpedi: number;  // valor pendente (total)
  vlrunit?: number | null; // novo (unitário)
};

type EditItem = {
  codprod: number;
  qtd: number;
  vlrunit: number;
};

export default function PedidoDetalhePage() {
  const { nunota } = useParams<{ nunota: string }>();
  const [header, setHeader] = React.useState<Header | null>(null);
  const [items, setItems] = React.useState<Item[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  // Edição em lote (qtd / vlrunit)
  const [actionMsg, setActionMsg] = React.useState<string | null>(null);
  const [acting, setActing] = React.useState(false);
  const originalRef = React.useRef<EditItem[]>([]);
  const [edits, setEdits] = React.useState<EditItem[]>([]);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  // Follow-up (agora salva via DatasetSP.save)
  const [showFollow, setShowFollow] = React.useState(false);
  const [followText, setFollowText] = React.useState("");
  const [followDue, setFollowDue] = React.useState<string>(""); // yyyy-mm-dd

  const fmtMoney = (v: number) =>
    (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const fmtDate = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
  };

  React.useEffect(() => {
    (async () => {
      if (!nunota) return;
      setLoading(true); setErr(null);
      try {
        const { data } = await api.get<{ header: Header; items: Item[] }>(`/api/pedidos/${nunota}`);
        setHeader(data.header);
        const mapped = (data.items || []).map((it) => {
          const descr = (it.descrprod || "").trim();
          const codvol = (it.codvol || "").trim();
          const baseUnit =
            typeof it.vlrunit === "number" && isFinite(it.vlrunit)
              ? it.vlrunit
              : it.qtd > 0
              ? it.vlrpedi / it.qtd
              : 0;
          return { ...it, descrprod: descr, codvol, vlrunit: Number(baseUnit) || 0 };
        });
        setItems(mapped);

        // snapshot original
        const snap: EditItem[] = mapped.map((i) => ({
          codprod: i.codprod,
          qtd: Number(i.qtd) || 0,
          vlrunit: Number(i.vlrunit || 0),
        }));
        originalRef.current = snap;
        setEdits(snap);
      } catch (e: any) {
        console.error("GET /api/pedidos/:nunota erro:", e?.response || e);
        setErr(e?.response?.data?.erro || "Falha ao carregar detalhe do pedido");
      } finally {
        setLoading(false);
      }
    })();
  }, [nunota]);

  // ===== Impressão
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

  // ===== Registrar Follow-up (AGORA via DatasetSP.save)
  const handleFollowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nunota) return;

    const texto = followText.trim();
    if (!texto) {
      setActionMsg("Descreva o follow-up.");
      return;
    }

    // Converte prazo de yyyy-mm-dd -> dd/mm/aaaa
    const prazoBR = followDue ? followDue.split("-").reverse().join("/") : "";

    setActing(true);
    setActionMsg(null);
    try {
      // Monta payload no mesmo formato do "Atualizar Status"
      // entity: CabecalhoNota, pk: { NUNOTA }, fields: [FIELD_FOLLOW_DESC, FIELD_FOLLOW_DUE]
      // values: { "0": texto, "1": prazoBR }
      const payload = {
        entity: ENTITY_CAB,
        fields: [FIELD_FOLLOW_DESC, FIELD_FOLLOW_DUE],
        pk: { NUNOTA: Number(nunota) },
        values: {
          "0": texto,
          "1": prazoBR, // vazio "" ou data dd/mm/aaaa
        },
      };

      const { data } = await api.post("/api/sankhya/dataset/save", payload);

      if (String(data?.RETORNO?.status ?? data?.STATUS) === "1") {
        setActionMsg("Follow-up registrado com sucesso.");
        setFollowText("");
        setFollowDue("");
        setShowFollow(false);
      } else {
        const msg =
          data?.RETORNO?.statusMessage ||
          data?.erro ||
          "Falha ao registrar follow-up.";
        setActionMsg(`⚠️ ${msg}`);
      }
    } catch (err: any) {
      console.error("Follow-up (DatasetSP.save) erro:", err?.response?.data || err);
      setActionMsg(err?.response?.data?.erro || "Falha ao registrar follow-up.");
    } finally {
      setActing(false);
    }
  };

  // ===== Cancelamento
  const handleCancel = async () => {
    if (!nunota) return;
    const ok = window.confirm(`Confirma o cancelamento do pedido ${nunota}?`);
    if (!ok) return;
    setActing(true); setActionMsg(null);
    try {
      await api.post(`/api/pedidos/${nunota}/cancel`);
      setActionMsg("Pedido cancelado com sucesso.");
    } catch (e: any) {
      console.error("POST cancel erro:", e?.response || e);
      setActionMsg(e?.response?.data?.erro || "Falha ao cancelar o pedido.");
    } finally {
      setActing(false);
    }
  };

  // ===== Edição de itens (qtd e vlrunit)
  const setEditFor = (codprod: number, patch: Partial<EditItem>) => {
    setEdits((old) => {
      const idx = old.findIndex((i) => i.codprod === codprod);
      if (idx === -1) return old;
      const next = [...old];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const getEdit = (codprod: number) => edits.find((e) => e.codprod === codprod);

  const isDirty = React.useMemo(() => {
    if (originalRef.current.length !== edits.length) return true;
    for (let i = 0; i < edits.length; i++) {
      const a = edits[i];
      const b = originalRef.current.find((x) => x.codprod === a.codprod);
      if (!b) return true;
      if (Number(a.qtd) !== Number(b.qtd)) return true;
      if (Number(a.vlrunit) !== Number(b.vlrunit)) return true;
    }
    return false;
  }, [edits]);

  const changedCount = React.useMemo(() => {
    let n = 0;
    for (const e of edits) {
      const b = originalRef.current.find((x) => x.codprod === e.codprod);
      if (!b) continue;
      if (Number(e.qtd) !== Number(b.qtd) || Number(e.vlrunit) !== Number(b.vlrunit)) n++;
    }
    return n;
  }, [edits]);

  const discardChanges = () => {
    setEdits(originalRef.current.map((x) => ({ ...x })));
  };

  // Confirmação de alterações de itens (a integração de envio virá depois)
  const confirmChanges = () => setConfirmOpen(true);
  const closeConfirm = () => setConfirmOpen(false);

  const applyChanges = () => {
    const payload = {
      nunota: Number(nunota),
      itens: edits
        .filter((e) => {
          const b = originalRef.current.find((x) => x.codprod === e.codprod);
          return b && (Number(e.qtd) !== Number(b.qtd) || Number(e.vlrunit) !== Number(b.vlrunit));
        })
        .map((e) => ({
          codprod: e.codprod,
          qtd: Number(e.qtd),
          vlrunit: Number(e.vlrunit),
        })),
    };

    console.log(">> Alterações para enviar ao backend:", payload);
    setActionMsg(
      `Foram preparadas ${payload.itens.length} alteração(ões) para envio. (Integração de envio será implementada em seguida.)`
    );
    setConfirmOpen(false);
  };

  const rowTotal = (codprod: number) => {
    const e = getEdit(codprod);
    const q = Number(e?.qtd || 0);
    const u = Number(e?.vlrunit || 0);
    return q * u;
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
        <CardContent className="grid gap-3 sm:grid-cols-3">
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
        </CardContent>
      </Card>

      {/* Form de Follow-up (toggle) */}
      {showFollow && (
        <Card className="print:hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Novo Follow-up</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleFollowSubmit} className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
              <div className="sm:col-span-1">
                <label className="text-xs text-slate-600">Descrição</label>
                <textarea
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
                  value={followText}
                  onChange={(e) => setFollowText(e.target.value)}
                  placeholder="Ex.: Cobrar fornecedor sobre envio do item X"
                  rows={3}
                />
              </div>
              <div>
                <label className="text-xs text-slate-600">Prazo</label>
                <Input
                  type="date"
                  value={followDue}
                  onChange={(e) => setFollowDue(e.target.value)}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" disabled={acting}>Salvar</Button>
                <Button type="button" variant="outline" onClick={() => setShowFollow(false)}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Itens pendentes (editáveis) */}
      <Card className="shadow-sm overflow-hidden print:border-0 print:shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Itens pendentes</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="min-w-[960px] w-full text-sm">
            <thead className="bg-slate-50 print:bg-white">
              <tr>
                <th className="px-3 py-2 text-left">Cód. Produto</th>
                <th className="px-3 py-2 text-left">Descrição</th>
                <th className="px-3 py-2 text-left">Un.</th>
                <th className="px-3 py-2 text-left">Qtd Pendente</th>
                <th className="px-3 py-2 text-left">Valor Unitário</th>
                <th className="px-3 py-2 text-left">Total (qtd × unit)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const e = getEdit(it.codprod);
                const qtd = e ? e.qtd : it.qtd;
                const unit = e ? e.vlrunit : (it.vlrunit || 0);
                return (
                  <tr key={it.codprod} className="border-t">
                    <td className="px-3 py-2">{it.codprod}</td>
                    <td className="px-3 py-2">{it.descrprod}</td>
                    <td className="px-3 py-2">{it.codvol}</td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min={0}
                        step="1"
                        value={qtd}
                        onChange={(e) =>
                          setEditFor(it.codprod, { qtd: Number(e.target.value || 0) })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={unit}
                        onChange={(e) =>
                          setEditFor(it.codprod, { vlrunit: Number(e.target.value || 0) })
                        }
                      />
                    </td>
                    <td className="px-3 py-2 font-medium">
                      {fmtMoney(rowTotal(it.codprod))}
                    </td>
                  </tr>
                );
              })}
              {!loading && items.length === 0 && (
                <tr className="border-t">
                  <td className="px-3 py-6 text-center text-slate-500" colSpan={6}>
                    Sem itens pendentes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Barra de confirmação quando houver mudanças nos itens */}
      {isDirty && (
        <div className="sticky bottom-2 print:hidden">
          <div className="mx-auto max-w-5xl rounded-xl border bg-white shadow-lg p-3 flex flex-wrap items-center gap-2">
            <div className="text-sm">
              {changedCount} linha(s) alterada(s). Revise e confirme para reencaminhar à liberação.
            </div>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={discardChanges}>Descartar</Button>
              <Button onClick={confirmChanges}>Confirmar alterações</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação das alterações de itens */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center">
          <div className="absolute inset-0 bg-black/30" onClick={closeConfirm} />
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border p-4">
            <div className="text-base font-semibold mb-2">Confirmar alterações</div>
            <p className="text-sm text-slate-700">
              Tem certeza que deseja aplicar as alterações de <b>quantidade</b> e <b>valor unitário</b>?<br />
              O pedido seguirá para o fluxo de <b>liberação</b> novamente.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={closeConfirm}>Não</Button>
              <Button onClick={applyChanges}>Sim, confirmar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

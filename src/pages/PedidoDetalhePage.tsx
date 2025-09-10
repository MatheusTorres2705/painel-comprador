import React from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  vlrpedi: number;  // valor pendente
};

export default function PedidoDetalhePage() {
  const { nunota } = useParams<{ nunota: string }>();
  const [header, setHeader] = React.useState<Header | null>(null);
  const [items, setItems] = React.useState<Item[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  // Ações
  const [showFollow, setShowFollow] = React.useState(false);
  const [followText, setFollowText] = React.useState("");
  const [followDue, setFollowDue] = React.useState<string>(""); // yyyy-mm-dd
  const [actionMsg, setActionMsg] = React.useState<string | null>(null);
  const [acting, setActing] = React.useState(false);

  const fmtMoney = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
        setItems((data.items || []).map(it => ({
          ...it,
          descrprod: (it.descrprod || "").trim(),
          codvol: (it.codvol || "").trim(),
        })));
      } catch (e: any) {
        console.error("GET /api/pedidos/:nunota erro:", e?.response || e);
        setErr(e?.response?.data?.erro || "Falha ao carregar detalhe do pedido");
      } finally {
        setLoading(false);
      }
    })();
  }, [nunota]);

  // ===== Handlers de ação =====
 const handlePrint = async () => {
  if (!nunota) return;
  setActing(true); setActionMsg(null);
  try {
    const resp = await api.post(`/api/pedidos/${nunota}/print`, {}, { responseType: "blob" });
    const blob = new Blob([resp.data], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    // Abre numa nova aba (ou mude para download automático, se preferir)
    window.open(url, "_blank");
    // Se quiser forçar download:
    // const a = document.createElement('a');
    // a.href = url; a.download = `pedido_${nunota}.pdf`; a.click();
    // URL.revokeObjectURL(url);
  } catch (e: any) {
    console.error("Imprimir pedido erro:", e?.response || e);
    setActionMsg(e?.response?.data?.erro || "Falha ao gerar PDF do pedido.");
  } finally {
    setActing(false);
  }
};


  const handleFollowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nunota) return;
    if (!followText.trim()) {
      setActionMsg("Descreva o follow-up.");
      return;
    }
    setActing(true); setActionMsg(null);
    try {
      // converte prazo (yyyy-mm-dd) para dd/mm/yyyy se quiser
      const toBR = (s: string) => (s ? s.split("-").reverse().join("/") : null);
      await api.post(`/api/pedidos/${nunota}/followups`, {
        texto: followText.trim(),
        prazo: followDue ? toBR(followDue) : null,
      });
      setActionMsg("Follow-up registrado com sucesso.");
      setFollowText("");
      setFollowDue("");
      setShowFollow(false);
    } catch (e: any) {
      console.error("POST followup erro:", e?.response || e);
      setActionMsg(e?.response?.data?.erro || "Falha ao registrar follow-up.");
    } finally {
      setActing(false);
    }
  };

  const handleCancel = async () => {
    if (!nunota) return;
    const ok = window.confirm(`Confirma o cancelamento do pedido ${nunota}?`);
    if (!ok) return;
    setActing(true); setActionMsg(null);
    try {
      await api.post(`/api/pedidos/${nunota}/cancel`);
      setActionMsg("Pedido cancelado com sucesso.");
      // TODO: opcional recarregar cabeçalho/itens
    } catch (e: any) {
      console.error("POST cancel erro:", e?.response || e);
      setActionMsg(e?.response?.data?.erro || "Falha ao cancelar o pedido.");
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

      {/* Itens */}
      <Card className="shadow-sm overflow-hidden print:border-0 print:shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Itens pendentes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 print:bg-white">
              <tr>
                <th className="px-3 py-2 text-left">Cód. Produto</th>
                <th className="px-3 py-2 text-left">Descrição</th>
                <th className="px-3 py-2 text-left">Un.</th>
                <th className="px-3 py-2 text-left">Qtd Pendente</th>
                <th className="px-3 py-2 text-left">Valor Pendente</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2">{it.codprod}</td>
                  <td className="px-3 py-2">{it.descrprod}</td>
                  <td className="px-3 py-2">{it.codvol}</td>
                  <td className="px-3 py-2">{it.qtd}</td>
                  <td className="px-3 py-2">{fmtMoney(it.vlrpedi)}</td>
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr className="border-t">
                  <td className="px-3 py-6 text-center text-slate-500" colSpan={5}>
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

import React from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, FileText } from "lucide-react";

type Item = {
  codprod: number;
  descrprod: string;
  codvol: string;
  leadtime: number;
  estoque: number;
  empenho: number;
  comprapen: number;
  necessidade: number;   // base (vem do back)
  giromensal: number;
  dtmelhorped: string | null; // ISO
  sugestaoQtd: number;   // editável (default = necessidade)
};

export default function ProdutosCriticosFornecedorPage() {
  const { codparc } = useParams();
  const [params] = useSearchParams();
  const dias = Number(params.get("dias") || 5);
  const nav = useNavigate();

  const [nome, setNome] = React.useState<string>("");
  const [items, setItems] = React.useState<Item[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    if (!codparc) return;
    setLoading(true); setMsg(null);
    try {
      const { data } = await api.get<{ fornecedor: { codparc:number; nomeparc:string }, items: Item[] }>(`/api/produtos-criticos/${codparc}?dias=${dias}`);
      setNome(data.fornecedor?.nomeparc || "");
      setItems((data.items || []).map(it => ({
        ...it,
        sugestaoQtd: Number(it.sugestaoQtd ?? it.necessidade ?? 0),
      })));
    } catch (e: any) {
      setMsg(e?.response?.data?.erro || "Falha ao buscar produtos críticos do fornecedor");
    } finally {
      setLoading(false);
    }
  }, [codparc, dias]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const gerarPedido = async () => {
    const itens = items
      .filter(x => (x.sugestaoQtd || 0) > 0)
      .map(x => ({ codprod: x.codprod, qtd: Number(x.sugestaoQtd) }));
    if (itens.length === 0) {
      setMsg("Informe ao menos 1 item com quantidade > 0 para gerar o pedido.");
      return;
    }
    setMsg(null); setLoading(true);
    try {
      const { data } = await api.post(`/api/pedidos/gerar`, { codparc: Number(codparc), itens });
      setMsg(`Pedido gerado com sucesso (NUNOTA ${data.nunota}).`);
    } catch (e: any) {
      setMsg(e?.response?.data?.erro || "Falha ao gerar pedido.");
    } finally {
      setLoading(false);
    }
  };

  const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString("pt-BR") : "—";

  const abrirDetalhe = (codprod: number) => {
    // rota stub para trabalharmos depois:
    nav(`/produtos-criticos/${codparc}/produto/${codprod}?dias=${dias}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => nav(-1)}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
        <h2 className="text-xl font-semibold">Produtos críticos — {nome} (CODPARC {codparc})</h2>
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={gerarPedido} disabled={loading}>Gerar pedido</Button>
        </div>
      </div>

      {msg && <div className="text-sm text-slate-700">{msg}</div>}

      <Card className="shadow-sm overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Itens críticos (dias={dias})</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left">Cód.</th>
                <th className="px-3 py-2 text-left">Produto</th>
                <th className="px-3 py-2 text-left">Un.</th>
                <th className="px-3 py-2 text-left">Lead</th>
                {/* <th className="px-3 py-2 text-left">Melhor pedido</th> */}
                <th className="px-3 py-2 text-left">Estoque</th>
                <th className="px-3 py-2 text-left">Empenho</th>
                <th className="px-3 py-2 text-left">Compra pend.</th>
                <th className="px-3 py-2 text-left">Giro mensal</th>
                <th className="px-3 py-2 text-left">Necessidade</th>
                <th className="px-3 py-2 text-left w-32">Sugestão</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.codprod} className="border-t">
                  <td className="px-3 py-2">{it.codprod}</td>
                  <td className="px-3 py-2">{it.descrprod}</td>
                  <td className="px-3 py-2">{it.codvol}</td>
                  <td className="px-3 py-2">{it.leadtime}</td>
                  {/* <td className="px-3 py-2">{fmtDate(it.dtmelhorped)}</td> */}
                  <td className="px-3 py-2">{it.estoque}</td>
                  <td className="px-3 py-2">{it.empenho}</td>
                  <td className="px-3 py-2">{it.comprapen}</td>
                  <td className="px-3 py-2">{it.giromensal}</td>
                  <td className="px-3 py-2 font-medium">{it.necessidade}</td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={0}
                      value={it.sugestaoQtd ?? 0}
                      onChange={(e) => {
                        const v = Number(e.target.value || 0);
                        setItems(old => old.map(x => x.codprod === it.codprod ? { ...x, sugestaoQtd: v } : x));
                      }}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" size="icon" title="Detalhar item" onClick={() => abrirDetalhe(it.codprod)}>
                      <FileText className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr className="border-t">
                  <td colSpan={12} className="px-3 py-6 text-center text-slate-500">
                    Nenhum item crítico para este fornecedor neste período.
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

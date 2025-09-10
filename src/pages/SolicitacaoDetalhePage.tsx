import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

type Header = {
  codsol: number;
  solicitante: string;
  dtsol: string | null;
  status: string;
  setor: string;
};
type Item = { seq: number; codprod: number; descrprod: string; codvol: string; qtd: number; obs: string; };

export default function SolicitacaoDetalhePage() {
  const { codsol } = useParams();
  const nav = useNavigate();
  const [header, setHeader] = React.useState<Header | null>(null);
  const [items, setItems] = React.useState<Item[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");

  const fetchData = React.useCallback(async () => {
    if (!codsol) return;
    setLoading(true); setErr(null);
    try {
      const { data } = await api.get<{ header: Header; items: Item[] }>(`/api/solicitacoes/${codsol}`);
      setHeader(data.header || null);
      setItems(data.items || []);
    } catch (e:any) {
      setErr(e?.response?.data?.erro || "Falha ao carregar a solicitação");
    } finally { setLoading(false); }
  }, [codsol]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={()=>nav(-1)}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
        <h2 className="text-xl font-semibold">Solicitação #{codsol}</h2>
        <div className="ml-auto">
          <Button onClick={()=>nav(`/solicitacoes/${codsol}/cotacao`)} disabled={!header || items.length===0}>
            Ir para cotação
          </Button>
        </div>
      </div>

      {err && <div className="text-sm text-red-600">{err}</div>}

      {header && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Cabeçalho</CardTitle></CardHeader>
          <CardContent className="text-sm grid grid-cols-2 md:grid-cols-4 gap-2">
            <div><b>Solicitante:</b> {header.solicitante}</div>
            <div><b>Data:</b> {fmtDate(header.dtsol)}</div>
            <div><b>Status:</b> {header.status}</div>
            <div><b>Setor:</b> {header.setor}</div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm overflow-hidden">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Itens</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left">Seq</th>
                <th className="px-3 py-2 text-left">Cód</th>
                <th className="px-3 py-2 text-left">Descrição</th>
                <th className="px-3 py-2 text-left">Un.</th>
                <th className="px-3 py-2 text-left">Qtd</th>
                <th className="px-3 py-2 text-left">Obs</th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.seq} className="border-t">
                  <td className="px-3 py-2">{it.seq}</td>
                  <td className="px-3 py-2">{it.codprod}</td>
                  <td className="px-3 py-2">{it.descrprod}</td>
                  <td className="px-3 py-2">{it.codvol}</td>
                  <td className="px-3 py-2">{it.qtd}</td>
                  <td className="px-3 py-2">{it.obs}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr className="border-t"><td colSpan={6} className="px-3 py-6 text-center text-slate-500">Sem itens.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

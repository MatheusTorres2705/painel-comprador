import React from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, ExternalLink } from "lucide-react";

type FornecedorCritico = {
  codparc: number;
  fornecedor: string;
  qtdprod: number;
  leadtime: number;
  percentual: number;
};

export default function ProdutosCriticosPage() {
  const nav = useNavigate();
  const [dias, setDias] = React.useState<number>(5);
  const [forn, setForn] = React.useState<string>("");
  const [data, setData] = React.useState<FornecedorCritico[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const qs = new URLSearchParams();
      if (dias) qs.set("dias", String(dias));
      if (forn.trim()) qs.set("fornecedor", forn.trim());
      const { data } = await api.get<{ items: FornecedorCritico[] }>(`/api/produtos-criticos?${qs.toString()}`);
      setData(data.items || []);
    } catch (e: any) {
      setErr(e?.response?.data?.erro || "Falha ao buscar fornecedores críticos");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [dias, forn]);

  React.useEffect(() => { fetchData(); }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Produtos Críticos — Fornecedores</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-slate-600">Dias de atraso (DTMELHORPED ≤ hoje − dias)</label>
            <Input type="number" min={0} value={dias} onChange={e=>setDias(Number(e.target.value || 0))} className="w-32" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-600">Fornecedor</label>
            <Input value={forn} onChange={e=>setForn(e.target.value)} placeholder="Nome do fornecedor" className="w-64" />
          </div>
          <Button onClick={fetchData} disabled={loading}>{loading ? "Carregando…" : "Aplicar"}</Button>
          {err && <span className="text-sm text-red-600">{err}</span>}
        </CardContent>
      </Card>

      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left">CODPARC</th>
                <th className="px-3 py-2 text-left">Fornecedor</th>
                <th className="px-3 py-2 text-left">Qtd. críticos</th>
                <th className="px-3 py-2 text-left">Lead time (max)</th>
                <th className="px-3 py-2 text-left">% do total</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.codparc} className="border-t">
                  <td className="px-3 py-2">{r.codparc}</td>
                  <td className="px-3 py-2">{r.fornecedor}</td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary">{r.qtdprod}</Badge>
                  </td>
                  <td className="px-3 py-2">{r.leadtime}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-slate-200 rounded overflow-hidden">
                        <div className="h-2 bg-slate-800" style={{ width: `${Math.min(100, r.percentual)}%` }} />
                      </div>
                      <span>{r.percentual.toFixed(2)}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Ações">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={()=>nav(`/produtos-criticos/${r.codparc}?dias=${dias}`)} className="cursor-pointer">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          <span>Analisar produtos</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {(!loading && data.length === 0) && (
                <tr className="border-t">
                  <td className="px-3 py-6 text-center text-slate-500" colSpan={6}>
                    Nenhum fornecedor com produtos críticos nesse filtro.
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

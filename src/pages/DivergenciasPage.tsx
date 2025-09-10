import React from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, ExternalLink } from "lucide-react";

type Linha = {
  codparc: number;
  fornecedor: string;
  qtdOcorr: number;
  qtdItens: number;
  vlrTot: number;
  dtnegMax: string | null; // ISO
  percentual: number;
};

export default function DivergenciasPage() {
  const nav = useNavigate();

  const [forn, setForn] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [ini, setIni] = React.useState<string>("");
  const [fim, setFim] = React.useState<string>("");

  const [data, setData] = React.useState<Linha[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const toBR = (s: string) => (s ? s.split("-").reverse().join("/") : "");

  const fetchData = React.useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const qs = new URLSearchParams();
      if (forn.trim()) qs.set("fornecedor", forn.trim());
      if (status.trim()) qs.set("status", status.trim());
      if (ini) qs.set("ini", toBR(ini));
      if (fim) qs.set("fim", toBR(fim));
      const { data } = await api.get<{ items: Linha[] }>(`/api/divergencias?${qs.toString()}`);
      setData(data.items || []);
    } catch (e: any) {
      setErr(e?.response?.data?.erro || "Falha ao buscar divergências");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [forn, status, ini, fim]);

  React.useEffect(() => { fetchData(); }, []);

  const fmtMoney = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Divergências de recebimento — Fornecedores</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-slate-600">Fornecedor</label>
            <Input className="w-64" value={forn} onChange={(e)=>setForn(e.target.value)} placeholder="Nome do fornecedor" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-600">Status (texto)</label>
            <Input className="w-56" value={status} onChange={(e)=>setStatus(e.target.value)} placeholder="ex.: APROVADO" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-600">Data Neg. (início)</label>
            <Input type="date" value={ini} onChange={(e)=>setIni(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-600">Data Neg. (fim)</label>
            <Input type="date" value={fim} onChange={(e)=>setFim(e.target.value)} />
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
                <th className="px-3 py-2 text-left">Ocorrências</th>
                <th className="px-3 py-2 text-left">Itens</th>
                <th className="px-3 py-2 text-left">Valor total</th>
                <th className="px-3 py-2 text-left">Últ. Negociação</th>
                <th className="px-3 py-2 text-left">% do total</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.codparc} className="border-t">
                  <td className="px-3 py-2">{r.codparc}</td>
                  <td className="px-3 py-2">{r.fornecedor}</td>
                  <td className="px-3 py-2"><Badge variant="secondary">{r.qtdOcorr}</Badge></td>
                  <td className="px-3 py-2">{r.qtdItens}</td>
                  <td className="px-3 py-2">{fmtMoney(r.vlrTot)}</td>
                  <td className="px-3 py-2">{fmtDate(r.dtnegMax)}</td>
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
                        <Button variant="ghost" size="icon" aria-label="Ações"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem className="cursor-pointer" onClick={()=>nav(`/divergencias/${r.codparc}${ini||fim||status?`?${new URLSearchParams({ ...(ini?{ini:toBR(ini)}:{}), ...(fim?{fim:toBR(fim)}:{}), ...(status?{status}:{}) }).toString()}`:''}`)}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          <span>Analisar ocorrências</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {(!loading && data.length === 0) && (
                <tr className="border-t">
                  <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                    Nenhum fornecedor com divergências neste filtro.
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

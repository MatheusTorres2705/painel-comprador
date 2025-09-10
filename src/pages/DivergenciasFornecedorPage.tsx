import React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";

type Item = {
  codavaria: number;
  nunota: number;
  dtneg: string | null; // ISO
  status: string;
  sequencia: number;
  codprod: number;
  descrprod: string;
  codvol: string;
  qtdneg: number;
  vlrunit: number;
  vlrtot: number;
  ocorrencia: string;
};

export default function DivergenciasFornecedorPage() {
  const { codparc } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();

  const [ini, setIni] = React.useState<string>("");
  const [fim, setFim] = React.useState<string>("");
  const [status, setStatus] = React.useState<string>(params.get("status") || "");

  const [nome, setNome] = React.useState<string>("");
  const [items, setItems] = React.useState<Item[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  const toBR = (s: string) => (s ? s.split("-").reverse().join("/") : "");
  const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");
  const fmtMoney = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const fetchData = React.useCallback(async () => {
    if (!codparc) return;
    setLoading(true); setMsg(null);
    try {
      const qs = new URLSearchParams();
      if (ini) qs.set("ini", toBR(ini));
      if (fim) qs.set("fim", toBR(fim));
      if (status.trim()) qs.set("status", status.trim());
      const { data } = await api.get<{ fornecedor: { codparc:number; nomeparc:string }, items: Item[] }>(`/api/divergencias/${codparc}?${qs.toString()}`);
      setNome(data.fornecedor?.nomeparc || "");
      setItems(data.items || []);
    } catch (e: any) {
      setMsg(e?.response?.data?.erro || "Falha ao buscar ocorrências do fornecedor");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [codparc, ini, fim, status]);

  React.useEffect(() => { fetchData(); }, []);

  // totais
  const totalValor = items.reduce((acc, x) => acc + (x.vlrtot || 0), 0);
  const totalItens = items.length;
  const totalOcorr = new Set(items.map(x => x.codavaria)).size;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => nav(-1)}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
        <h2 className="text-xl font-semibold">Divergências — {nome} (CODPARC {codparc})</h2>
        <div className="ml-auto flex items-center gap-4 text-sm text-slate-700">
          <span>Ocorrências: <b>{totalOcorr}</b></span>
          <span>Itens: <b>{totalItens}</b></span>
          <span>Total: <b>{fmtMoney(totalValor)}</b></span>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
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
          {msg && <span className="text-sm text-slate-600">{msg}</span>}
        </CardContent>
      </Card>

      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left">Cod. Avaria</th>
                <th className="px-3 py-2 text-left">Nota</th>
                <th className="px-3 py-2 text-left">Dt. Neg.</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Seq.</th>
                <th className="px-3 py-2 text-left">Prod.</th>
                <th className="px-3 py-2 text-left">Descrição</th>
                <th className="px-3 py-2 text-left">Un.</th>
                <th className="px-3 py-2 text-left">Qtd</th>
                <th className="px-3 py-2 text-left">Vlr Unit.</th>
                <th className="px-3 py-2 text-left">Vlr Total</th>
                <th className="px-3 py-2 text-left">Ocorrência</th>
              </tr>
            </thead>
            <tbody>
              {items.map((x, i) => (
                <tr key={`${x.codavaria}-${x.sequencia}-${i}`} className="border-t">
                  <td className="px-3 py-2">{x.codavaria}</td>
                  <td className="px-3 py-2">{x.nunota}</td>
                  <td className="px-3 py-2">{fmtDate(x.dtneg)}</td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary">{x.status}</Badge>
                  </td>
                  <td className="px-3 py-2">{x.sequencia}</td>
                  <td className="px-3 py-2">{x.codprod}</td>
                  <td className="px-3 py-2">{x.descrprod}</td>
                  <td className="px-3 py-2">{x.codvol}</td>
                  <td className="px-3 py-2">{x.qtdneg}</td>
                  <td className="px-3 py-2">{fmtMoney(x.vlrunit)}</td>
                  <td className="px-3 py-2">{fmtMoney(x.vlrtot)}</td>
                  <td className="px-3 py-2">{x.ocorrencia}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr className="border-t">
                  <td colSpan={12} className="px-3 py-6 text-center text-slate-500">
                    Nenhuma ocorrência encontrada para este fornecedor.
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

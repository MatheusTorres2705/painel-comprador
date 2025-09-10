import React from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Linha = {
  codsol: number;
  solicitante: string;
  dtsol: string | null; // ISO
  status: string;
  setor: string;
};

export default function SolicitacoesPage() {
  const nav = useNavigate();
  const [status, setStatus] = React.useState("");
  const [setor, setSetor] = React.useState("");
  const [solicitante, setSolicitante] = React.useState("");
  const [ini, setIni] = React.useState<string>("");
  const [fim, setFim] = React.useState<string>("");

  const [data, setData] = React.useState<Linha[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const toBR = (s: string) => (s ? s.split("-").reverse().join("/") : "");
  const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");

  const fetchData = React.useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const qs = new URLSearchParams();
      if (status.trim()) qs.set("status", status.trim());
      if (setor.trim()) qs.set("setor", setor.trim());
      if (solicitante.trim()) qs.set("solicitante", solicitante.trim());
      if (ini) qs.set("ini", toBR(ini));
      if (fim) qs.set("fim", toBR(fim));
      const { data } = await api.get<{ items: Linha[] }>(`/api/solicitacoes?${qs.toString()}`);
      setData(data.items || []);
    } catch (e:any) {
      setErr(e?.response?.data?.erro || "Falha ao buscar solicitações");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [status, setor, solicitante, ini, fim]);

  React.useEffect(() => { fetchData(); }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Solicitações de Compras</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs">Status</label>
            <Input value={status} onChange={e=>setStatus(e.target.value)} className="w-48" placeholder="ex.: ABERTA" />
          </div>
          <div className="space-y-1">
            <label className="text-xs">Setor</label>
            <Input value={setor} onChange={e=>setSetor(e.target.value)} className="w-48" />
          </div>
          <div className="space-y-1">
            <label className="text-xs">Solicitante</label>
            <Input value={solicitante} onChange={e=>setSolicitante(e.target.value)} className="w-56" />
          </div>
          <div className="space-y-1">
            <label className="text-xs">Data (início)</label>
            <Input type="date" value={ini} onChange={e=>setIni(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs">Data (fim)</label>
            <Input type="date" value={fim} onChange={e=>setFim(e.target.value)} />
          </div>
          <Button onClick={fetchData} disabled={loading}>{loading? "Carregando…" : "Aplicar"}</Button>
          {err && <span className="text-sm text-red-600">{err}</span>}
        </CardContent>
      </Card>

      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left">Código</th>
                <th className="px-3 py-2 text-left">Solicitante</th>
                <th className="px-3 py-2 text-left">Data</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Setor</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.map(r => (
                <tr key={r.codsol} className="border-t">
                  <td className="px-3 py-2">{r.codsol}</td>
                  <td className="px-3 py-2">{r.solicitante}</td>
                  <td className="px-3 py-2">{fmtDate(r.dtsol)}</td>
                  <td className="px-3 py-2">{r.status}</td>
                  <td className="px-3 py-2">{r.setor}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" onClick={()=>nav(`/solicitacoes/${r.codsol}`)}>Abrir</Button>
                  </td>
                </tr>
              ))}
              {(!loading && data.length === 0) && (
                <tr className="border-t">
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                    Nenhuma solicitação encontrada.
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

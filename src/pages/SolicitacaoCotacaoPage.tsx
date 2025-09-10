import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";

type Header = { codsol: number; solicitante: string; dtsol: string | null; status: string; setor: string; };
type Item = { seq: number; codprod: number; descrprod: string; codvol: string; qtd: number; obs: string; };
type Forn = { codparc: number; fornecedor: string; precoMedio: number; ultCompra: string | null; qtdCompras: number };

export default function SolicitacaoCotacaoPage() {
  const { codsol } = useParams();
  const nav = useNavigate();

  const [header, setHeader] = React.useState<Header | null>(null);
  const [items, setItems] = React.useState<Item[]>([]);
  const [forns, setForns] = React.useState<Record<number, Forn[]>>({}); // codprod -> fornecedores
  const [propostas, setPropostas] = React.useState<Record<number, { codparc:number; preco:number; qtd:number; obs?:string }>>({});
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");
  const fmtMoney = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const loadHeaderItems = React.useCallback(async () => {
    if (!codsol) return;
    setLoading(true); setMsg(null);
    try {
      const { data } = await api.get<{ header: Header; items: Item[] }>(`/api/solicitacoes/${codsol}`);
      setHeader(data.header || null);
      setItems(data.items || []);
    } catch (e:any) {
      setMsg(e?.response?.data?.erro || "Falha ao carregar solicitação");
    } finally { setLoading(false); }
  }, [codsol]);

  const loadForns = React.useCallback(async (produtos: number[]) => {
    try {
      const resp = await Promise.all(
        produtos.map(async (codprod) => {
          const { data } = await api.get<{ items: Forn[] }>(`/api/solicitacoes/${codsol}/fornecedores?codprod=${codprod}`);
          return [codprod, data.items || []] as const;
        })
      );
      const map: Record<number, Forn[]> = {};
      resp.forEach(([codprod, arr]) => { map[codprod] = arr; });
      setForns(map);
    } catch (e:any) {
      setMsg(e?.response?.data?.erro || "Falha ao sugerir fornecedores");
    }
  }, [codsol]);

  React.useEffect(() => { loadHeaderItems(); }, [loadHeaderItems]);
  React.useEffect(() => {
    if (items.length) loadForns(items.map(i => i.codprod));
  }, [items, loadForns]);

  const enviar = async () => {
    const propostasArr = items
      .map(it => {
        const p = propostas[it.codprod];
        if (!p) return null;
        return {
          seq: it.seq, codprod: it.codprod, codparc: p.codparc, preco: Number(p.preco||0), qtd: Number(p.qtd||0), obs: p?.obs || ""
        };
      })
      .filter(Boolean);

    if (propostasArr.length === 0) {
      setMsg("Selecione ao menos 1 fornecedor e informe preço/quantidade.");
      return;
    }

    setLoading(true); setMsg(null);
    try {
      const { data } = await api.post(`/api/solicitacoes/${codsol}/cotacoes`, { propostas: propostasArr });
      setMsg(`Cotações salvas: ${data.total}. (stub)`);
    } catch (e:any) {
      setMsg(e?.response?.data?.erro || "Falha ao salvar cotações");
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={()=>nav(-1)}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
        <h2 className="text-xl font-semibold">Cotação — Solicitação #{codsol}</h2>
        <div className="ml-auto">
          <Button onClick={enviar} disabled={loading || !items.length}>Salvar cotações</Button>
        </div>
      </div>

      {msg && <div className="text-sm text-slate-700">{msg}</div>}

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
        <CardHeader className="pb-2"><CardTitle className="text-sm">Itens & Fornecedores</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left">Seq</th>
                <th className="px-3 py-2 text-left">Produto</th>
                <th className="px-3 py-2 text-left">Qtd</th>
                <th className="px-3 py-2 text-left">Fornecedor (sugestões)</th>
                <th className="px-3 py-2 text-left">Preço</th>
                <th className="px-3 py-2 text-left">Obs</th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => {
                const sug = forns[it.codprod] || [];
                const chosen = propostas[it.codprod];
                return (
                  <tr key={it.seq} className="border-t align-top">
                    <td className="px-3 py-2">{it.seq}</td>
                    <td className="px-3 py-2">{it.codprod} — {it.descrprod} ({it.codvol})</td>
                    <td className="px-3 py-2 w-28">
                      <Input type="number" min={0} value={chosen?.qtd ?? it.qtd}
                        onChange={(e)=> {
                          const qtd = Number(e.target.value || 0);
                          setPropostas(prev => ({ ...prev, [it.codprod]: { ...(prev[it.codprod] || { codparc: 0, preco: 0, qtd: it.qtd }), qtd } }));
                        }}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="space-y-1">
                        {sug.length === 0 && <div className="text-slate-500">Sem histórico — selecione manualmente depois.</div>}
                        {sug.map(f => (
                          <label key={f.codparc} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`forn-${it.codprod}`}
                              checked={chosen?.codparc === f.codparc}
                              onChange={() => setPropostas(prev => ({
                                ...prev,
                                [it.codprod]: { codparc: f.codparc, preco: f.precoMedio || 0, qtd: prev[it.codprod]?.qtd ?? it.qtd }
                              }))}
                            />
                            <span>{f.fornecedor} (#{f.codparc}) — méd. {fmtMoney(f.precoMedio || 0)} — última {fmtDate(f.ultCompra)} — {f.qtdCompras}x</span>
                          </label>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 w-36">
                      <Input type="number" min={0} step="0.01" value={chosen?.preco ?? 0}
                        onChange={(e)=> {
                          const preco = Number(e.target.value || 0);
                          setPropostas(prev => ({ ...prev, [it.codprod]: { ...(prev[it.codprod] || { codparc: 0, qtd: it.qtd }), preco } }));
                        }}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        placeholder="Observação"
                        value={chosen?.obs ?? ""}
                        onChange={(e)=> {
                          const obs = e.target.value;
                          setPropostas(prev => ({ ...prev, [it.codprod]: { ...(prev[it.codprod] || { codparc: 0, qtd: it.qtd, preco: 0 }), obs } }));
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
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

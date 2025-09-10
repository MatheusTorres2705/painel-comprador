import React from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type RiscoItem = {
  codparc: number; fornecedor: string;
  codprod: number; descrprod: string; codvol: string;
  codgrupo: number; descrgru: string;
  leadtime: number; estoque: number; empenho: number; comprapen: number; giromensal: number; dtmelhorped: string | null;
  disp: number; consumoDia: number; coberturaDias: number; risco: boolean; sugestaoCompra: number;
};

type FornAgg = { codparc: number; fornecedor: string; itens: number; sugestaoTotal: number; dispTotal: number };
type GrupoAgg = { codgrupo: number; grupo: string; itens: number; sugestaoTotal: number; dispTotal: number };

type Analysis = {
  risco: RiscoItem[];
  porFornecedor: FornAgg[];
  porGrupo: GrupoAgg[];
};

type Msg = { role: "user" | "assistant", text: string };

export default function ChatPage() {
  const nav = useNavigate();

  const [msgs, setMsgs] = React.useState<Msg[]>([
    { role: "assistant", text: "Oi! Sou seu agente de suprimentos. Pergunte sobre ruptura, sugestões de compra por fornecedor ou grupo. Ex.: \"Itens próximos de ruptura do fornecedor ACME\" ou \"Resumo por grupo\"" }
  ]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  // parâmetros — pode virar controles depois
  const [safetyDays] = React.useState<number>(5);
  const [top] = React.useState<number>(30);

  const [analysis, setAnalysis] = React.useState<Analysis | null>(null);
  const [selected, setSelected] = React.useState<Record<string, boolean>>({}); // key = `${codparc}:${codprod}`

  const toggleSel = (k: string, v?: boolean) =>
    setSelected((old) => ({ ...old, [k]: v ?? !old[k] }));

  const clearSel = () => setSelected({});

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setMsgs(m => [...m, { role: "user", text }]);
    setInput("");
    setLoading(true);
    setAnalysis(null);
    clearSel();
    try {
      // heurísticas simples: tenta extrair fornecedor/grupo do texto
      const fornecedor = (text.match(/fornecedor\s+([^\d,.;\n]+)/i)?.[1] || "").trim();
      const grupo = (text.match(/grupo\s+([^\d,.;\n]+)/i)?.[1] || "").trim();

      const { data } = await api.post<{
        reply: string,
        analysis: Analysis
      }>("/api/ai/chat", { message: text, safetyDays, top, fornecedor, grupo });

      setMsgs(m => [...m, { role: "assistant", text: data.reply }]);
      setAnalysis(data.analysis || null);
    } catch (e:any) {
      setMsgs(m => [...m, { role: "assistant", text: e?.response?.data?.erro || "Falha na análise com o agente." }]);
    } finally {
      setLoading(false);
    }
  };

  const fmt = {
    date: (s: string | null) => s ? new Date(s).toLocaleDateString("pt-BR") : "—",
    num: (v: number | null | undefined) => (v ?? 0).toLocaleString("pt-BR"),
    days: (v: number | null | undefined) => Number(v ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 }),
  };

  const abrirFornecedor = (codparc: number) => {
    // Leva para a tela de Produtos Críticos do fornecedor (você já tem essa rota)
    nav(`/produtos-criticos/${codparc}`);
  };

  const gerarPedidoItem = async (it: RiscoItem) => {
    const qtd = Math.max(0, Math.round(it.sugestaoCompra || 0));
    if (qtd <= 0) {
      setMsgs(m => [...m, { role: "assistant", text: `Sugestão ${qtd} inválida para ${it.descrprod}.` }]);
      return;
    }
    try {
      const { data } = await api.post(`/api/pedidos/gerar`, {
        codparc: it.codparc,
        itens: [{ codprod: it.codprod, qtd }],
      });
      setMsgs(m => [...m, { role: "assistant", text: `Pedido gerado para ${it.fornecedor}: NUNOTA ${data.nunota} (item ${it.codprod} • ${qtd} ${it.codvol}).` }]);
    } catch (e:any) {
      setMsgs(m => [...m, { role: "assistant", text: e?.response?.data?.erro || `Falha ao gerar pedido para ${it.descrprod}.` }]);
    }
  };

  const gerarPedidosSelecionados = async () => {
    if (!analysis) return;
    const selItems = (analysis.risco || []).filter(it => selected[`${it.codparc}:${it.codprod}`]);
    if (selItems.length === 0) {
      setMsgs(m => [...m, { role: "assistant", text: "Selecione ao menos 1 item para gerar pedidos." }]);
      return;
    }
    // agrupa por fornecedor (API espera um fornecedor por chamada)
    const byForn: Record<number, { codparc:number, itens: { codprod:number; qtd:number }[] }> = {};
    for (const it of selItems) {
      const qtd = Math.max(0, Math.round(it.sugestaoCompra || 0));
      if (qtd <= 0) continue;
      if (!byForn[it.codparc]) byForn[it.codparc] = { codparc: it.codparc, itens: [] };
      byForn[it.codparc].itens.push({ codprod: it.codprod, qtd });
    }

    const fornList = Object.values(byForn);
    if (fornList.length === 0) {
      setMsgs(m => [...m, { role: "assistant", text: "Os itens selecionados têm sugestão 0. Ajuste as quantidades." }]);
      return;
    }

    try {
      const results: string[] = [];
      for (const pack of fornList) {
        const { data } = await api.post(`/api/pedidos/gerar`, pack);
        results.push(`Fornecedor ${pack.codparc}: NUNOTA ${data.nunota} (${pack.itens.length} item(ns))`);
      }
      setMsgs(m => [...m, { role: "assistant", text: `Pedidos gerados:\n- ${results.join("\n- ")}` }]);
      clearSel();
    } catch (e:any) {
      setMsgs(m => [...m, { role: "assistant", text: e?.response?.data?.erro || "Falha ao gerar pedidos em lote." }]);
    }
  };

  const top10 = React.useMemo(() => (analysis?.risco || []).slice(0, 10), [analysis]);

  return (
    <div className="h-[calc(72vh-4rem)] flex flex-col gap-3">
      {/* Mensagens do chat */}
      <Card className="flex-1 overflow-auto">
        <CardContent className="p-2 space-y-2">
          {msgs.map((m, i) => (
            <div key={i} className={`max-w-3xl ${m.role === "assistant" ? "" : "ml-auto"}`}>
              <div className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${m.role === "assistant" ? "bg-slate-100" : "bg-slate-800 text-white"}`}>
                {m.text}
              </div>
            </div>
          ))}

          {/* Painel de resultados estruturados */}
          {analysis && (
            <div className="space-y-6 mt-4">
              {/* Top 10 itens em risco */}
              <Card className="shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  <div className="p-3 font-medium text-sm bg-slate-50">Top 10 itens em risco (sugestão editável na origem)</div>
                  <div className="p-3">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left">
                            <th className="px-2 py-2"><input type="checkbox"
                              checked={top10.length > 0 && top10.every(it => selected[`${it.codparc}:${it.codprod}`])}
                              onChange={(e)=>{
                                const v = e.target.checked;
                                const patch: Record<string, boolean> = {};
                                top10.forEach(it => { patch[`${it.codparc}:${it.codprod}`] = v; });
                                setSelected(prev => ({ ...prev, ...patch }));
                              }}
                            /></th>
                            <th className="px-2 py-2">Fornecedor</th>
                            <th className="px-2 py-2">Produto</th>
                            <th className="px-2 py-2">Disp.</th>
                            <th className="px-2 py-2">Cons./dia</th>
                            <th className="px-2 py-2">Cobertura (d)</th>
                            <th className="px-2 py-2">Lead</th>
                            <th className="px-2 py-2">Sugestão</th>
                            <th className="px-2 py-2 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {top10.map((it) => {
                            const key = `${it.codparc}:${it.codprod}`;
                            return (
                              <tr key={key} className="border-t">
                                <td className="px-2 py-2">
                                  <input type="checkbox"
                                    checked={!!selected[key]}
                                    onChange={()=>toggleSel(key)}
                                  />
                                </td>
                                <td className="px-2 py-2">{it.fornecedor}</td>
                                <td className="px-2 py-2">{it.codprod} — {it.descrprod}</td>
                                <td className="px-2 py-2">{fmt.num(it.disp)}</td>
                                <td className="px-2 py-2">{fmt.num(it.consumoDia)}</td>
                                <td className="px-2 py-2">{fmt.days(it.coberturaDias)}</td>
                                <td className="px-2 py-2">{fmt.num(it.leadtime)}</td>
                                <td className="px-2 py-2">{fmt.num(it.sugestaoCompra)}</td>
                                <td className="px-2 py-2 text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button variant="secondary" size="sm" onClick={()=>abrirFornecedor(it.codparc)}>Abrir fornecedor</Button>
                                    <Button size="sm" onClick={()=>gerarPedidoItem(it)}>Gerar pedido</Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {top10.length === 0 && (
                            <tr className="border-t">
                              <td colSpan={9} className="px-2 py-6 text-center text-slate-500">
                                Sem itens em risco no contexto atual.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <Button variant="secondary" onClick={clearSel}>Limpar seleção</Button>
                      <Button onClick={gerarPedidosSelecionados}>Gerar pedidos (selecionados)</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Resumo por fornecedor */}
              <Card className="shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  <div className="p-3 font-medium text-sm bg-slate-50">Resumo por fornecedor</div>
                  <div className="p-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left">
                          <th className="px-2 py-2">Fornecedor</th>
                          <th className="px-2 py-2">Itens em risco</th>
                          <th className="px-2 py-2">Sugestão total</th>
                          <th className="px-2 py-2">Disponibilidade total</th>
                          <th className="px-2 py-2 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(analysis.porFornecedor || []).map((f) => (
                          <tr key={f.codparc} className="border-t">
                            <td className="px-2 py-2">{f.fornecedor} (#{f.codparc})</td>
                            <td className="px-2 py-2">{fmt.num(f.itens)}</td>
                            <td className="px-2 py-2">{fmt.num(f.sugestaoTotal)}</td>
                            <td className="px-2 py-2">{fmt.num(f.dispTotal)}</td>
                            <td className="px-2 py-2 text-right">
                              <Button variant="secondary" size="sm" onClick={()=>abrirFornecedor(f.codparc)}>Abrir fornecedor</Button>
                            </td>
                          </tr>
                        ))}
                        {(!analysis.porFornecedor || analysis.porFornecedor.length === 0) && (
                          <tr className="border-t">
                            <td colSpan={5} className="px-2 py-6 text-center text-slate-500">Sem dados por fornecedor.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Resumo por grupo */}
              <Card className="shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  <div className="p-3 font-medium text-sm bg-slate-50">Resumo por grupo</div>
                  <div className="p-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left">
                          <th className="px-2 py-2">Grupo</th>
                          <th className="px-2 py-2">Itens em risco</th>
                          <th className="px-2 py-2">Sugestão total</th>
                          <th className="px-2 py-2">Disponibilidade total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(analysis.porGrupo || []).map((g) => (
                          <tr key={g.codgrupo} className="border-t">
                            <td className="px-2 py-2">{g.grupo || `(grupo ${g.codgrupo})`}</td>
                            <td className="px-2 py-2">{fmt.num(g.itens)}</td>
                            <td className="px-2 py-2">{fmt.num(g.sugestaoTotal)}</td>
                            <td className="px-2 py-2">{fmt.num(g.dispTotal)}</td>
                          </tr>
                        ))}
                        {(!analysis.porGrupo || analysis.porGrupo.length === 0) && (
                          <tr className="border-t">
                            <td colSpan={4} className="px-2 py-6 text-center text-slate-500">Sem dados por grupo.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Caixa de entrada */}
      <div className="flex gap-2">
        <Input
          placeholder="Pergunte: 'Itens próximos de ruptura por fornecedor X'..."
          value={input}
          onChange={(e)=>setInput(e.target.value)}
          onKeyDown={(e)=>{ if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <Button onClick={send} disabled={loading}>{loading ? "Analisando…" : "Enviar"}</Button>
      </div>
    </div>
  );
}

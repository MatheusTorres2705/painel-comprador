// src/pages/ProdutosCriticosFornecedorPage.tsx
import React from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  preco: number | null;  // editável (vem do back; usado no VLRUNIT)
};

type Whoami = {
  user?: { codvend?: number; codusu?: number; name?: string };
};

const fmtBRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatCurrencyBR = (v: number | null | undefined) => fmtBRL.format(Number(v || 0));
const money = formatCurrencyBR;

// transforma um texto qualquer do input em número (centavos)
function parseMaskedCurrencyToNumber(text: string): number | null {
  // mantém apenas dígitos
  const digits = (text || "").replace(/\D/g, "");
  if (!digits) return null;
  // últimos 2 dígitos são os centavos
  const n = Number(digits) / 100;
  return Number.isFinite(n) ? n : null;
}

export default function ProdutosCriticosFornecedorPage() {
  const { codparc } = useParams();
  const [params] = useSearchParams();
  const dias = Number(params.get("dias") || 5);
  const nav = useNavigate();

  const [nome, setNome] = React.useState<string>("");
  const [items, setItems] = React.useState<Item[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  // cabeçalho do pedido (TOP/Obs/Requisição)
  const [top, setTop] = React.useState<string>("107"); // 107 (padrão) | 113
  const [observacao, setObservacao] = React.useState<string>("");
  const [requisicao, setRequisicao] = React.useState<string>("");

  // usuário logado (codvend/codusu)
  const [codvend, setCodvend] = React.useState<number | null>(null);
  const [codusu, setCodusu] = React.useState<number | null>(null);

  // debug do retorno do incluirNota
  const [lastBackend, setLastBackend] = React.useState<any>(null);

  const fetchWhoami = React.useCallback(async () => {
    try {
      const { data } = await api.get<Whoami>("/api/whoami");
      const cv = Number(data?.user?.codvend || 0) || null;
      const cu = Number(data?.user?.codusu || 0) || null;
      setCodvend(cv);
      setCodusu(cu);
    } catch {
      // silencioso; rota protegida já garante token
    }
  }, []);

  const fetchData = React.useCallback(async () => {
    if (!codparc) return;
    setLoading(true); setMsg(null);
    try {
      const { data } = await api.get<{ fornecedor: { codparc:number; nomeparc:string }, items: Item[] }>(`/api/produtos-criticos/${codparc}?dias=${dias}`);
      setNome(data.fornecedor?.nomeparc || "");
      setItems((data.items || []).map(it => ({
        ...it,
        sugestaoQtd: Number(it.sugestaoQtd ?? it.necessidade ?? 0),
        preco: (it as any).preco != null ? Number((it as any).preco) : null, // garante number/null
      })));
    } catch (e: any) {
      setMsg(e?.response?.data?.erro || "Falha ao buscar produtos críticos do fornecedor");
    } finally {
      setLoading(false);
    }
  }, [codparc, dias]);

  React.useEffect(() => { fetchWhoami(); }, [fetchWhoami]);
  React.useEffect(() => { fetchData(); }, [fetchData]);

  const abrirDetalhe = (codprod: number) => {
    nav(`/produtos-criticos/${codparc}/produto/${codprod}?dias=${dias}`);
  };

  // helpers CACSP.incluirNota
  const wrap = (v: any) => ({ $: String(v ?? "") });
  const hojeBR = () => {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = String(d.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  };

  // total do pedido (soma de preco * sugestaoQtd dos itens > 0)
  const totalPedido = React.useMemo(() => {
    return items.reduce((s, it) => s + (Number(it.preco || 0) * Number(it.sugestaoQtd || 0)), 0);
  }, [items]);

  const gerarPedido = async () => {
    if (!codparc) { setMsg("Fornecedor inválido."); return; }
    const itensValidos = items
      .filter(x => Number(x.sugestaoQtd || 0) > 0)
      .map((x) => {
        const precoUnit = Number.isFinite(Number(x.preco)) ? Number(x.preco) : 1; // fallback = 1 (como antes)
        return {
          NUNOTA: {},
          CODPROD:      wrap(x.codprod),                  // codprod
          CONTROLE:     wrap(" "),                        // sem controle
          QTDNEG:       wrap(Number(x.sugestaoQtd)),      // quantidade
          CODLOCALORIG: wrap("1010101"),
          VLRUNIT:      wrap(precoUnit),                  // <<< preço informado pelo comprador
          CODVOL:       wrap(x.codvol || ""),             // unidade
          VLRDESC:      wrap(0),
          PERCDESC:     wrap(0),
        };
      });

    if (itensValidos.length === 0) {
      setMsg("Informe ao menos 1 item com quantidade > 0 para gerar o pedido.");
      return;
    }

    // Cabeçalho no formato esperado
    const cabecalho = {
      NUNOTA: {},
      CODEMP:       wrap("1"),
      CODEMPNEGOC:  wrap("1"),
      CODCENCUS:    wrap("1030201"),
      SERIENOTA:    wrap("1"),
      CODNAT:       wrap("70101"),
      CODTIPOPER:   wrap(top),                 // 107/113
      CODPARC:      wrap(Number(codparc)),     // fornecedor
      DTNEG:        wrap(hojeBR()),            // data atual DD/MM/AAAA
      CODTIPVENDA:  wrap("87"),
      CODVEND:      wrap(codvend),             // do whoami
      TIPMOV:       wrap("O"),
      OBSERVACAO:   wrap(String(observacao || "").toUpperCase()),
      AD_NUM_REQUISICAO: wrap(String(requisicao || "").toUpperCase()),
      CODUSU:       wrap(codusu),              // do whoami
    };

    setLoading(true);
    setMsg(null);
    setLastBackend(null);

    try {
      // usa o serviço que criamos no backend
      const { data } = await api.post(`/api/pedidos/incluir`, {
        cabecalho,
        items: itensValidos,
        informarPreco: false,
      });

      setLastBackend(data);

      // tenta extrair NUNOTA da resposta (depende do layout do retorno)
      let nunotaMsg = "";
      try {
        const ret = data?.RETORNO;
        const viaCab =
          ret?.responseBody?.nota?.cabecalho?.NUNOTA?.$ ||
          ret?.responseBody?.pk?.NUNOTA?.$ ||
          ret?.responseBody?.numeroNota ||
          ret?.responseBody?.nunota;
        if (viaCab) nunotaMsg = ` (NUNOTA ${viaCab})`;
      } catch {}

      if (String(data?.STATUS) === "1") {
        setMsg(`✅ Pedido incluído com sucesso${nunotaMsg}.`);
      } else {
        setMsg(`⚠️ Pedido enviado, mas retorno STATUS="${data?.STATUS}". Confira o JSON abaixo. ${data?.StatusMessage || ""}`);
      }
    } catch (e: any) {
      setMsg(e?.response?.data?.erro || "Falha ao incluir pedido.");
      setLastBackend(e?.response?.data || { erro: e?.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => nav(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <h2 className="text-xl font-semibold">Produtos críticos — {nome} (CODPARC {codparc})</h2>
        <div className="ml-auto flex items-center gap-3">
          {/* total do pedido */}
          <div className="text-sm text-slate-700">
            Total: <span className="font-semibold">{money(totalPedido)}</span>
          </div>
          <Button onClick={gerarPedido} disabled={loading || items.length === 0}>
            {loading ? "Gerando..." : "Gerar pedido"}
          </Button>
        </div>
      </div>

      {/* Cabeçalho do pedido */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Cabeçalho do Pedido</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-slate-600">TOP (Operação)</label>
            <Select value={top} onValueChange={setTop}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Selecione a TOP" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="107">107</SelectItem>
                <SelectItem value="113">113</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 flex-1 min-w-[280px]">
            <label className="text-xs text-slate-600">Observação</label>
            <Input
              placeholder="Observação do pedido"
              value={observacao}
              onChange={(e)=>setObservacao(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-600">Requisição</label>
            <Input
              placeholder="Nº da requisição"
              value={requisicao}
              onChange={(e)=>setRequisicao(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-600">CODVEND</label>
            <Input value={codvend ?? ""} readOnly className="w-28" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-600">CODUSU</label>
            <Input value={codusu ?? ""} readOnly className="w-28" />
          </div>
        </CardContent>
      </Card>

      {msg && <div className="text-sm text-slate-700">{msg}</div>}

      {/* retorno bruto para depuração */}
      {lastBackend && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Retorno do backend</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-slate-50 p-3 rounded border overflow-auto max-h-64">
{JSON.stringify(lastBackend, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

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
                <th className="px-3 py-2 text-left w-180">Preço unit.</th>
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

                  {/* Campo de preço com máscara de moeda */}
                  <td className="px-3 py-2">
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={it.preco == null ? "" : formatCurrencyBR(it.preco)}
                      onChange={(e) => {
                        const n = parseMaskedCurrencyToNumber(e.target.value);
                        setItems(old =>
                          old.map(x => x.codprod === it.codprod ? { ...x, preco: n } : x)
                        );
                      }}
                      placeholder="R$ 0,00"
                    />
                  </td>

                  {/* Sugestão (quantidade) */}
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
                  <td colSpan={13} className="px-3 py-6 text-center text-slate-500">
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

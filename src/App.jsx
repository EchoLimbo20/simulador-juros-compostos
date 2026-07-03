import React, { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

// ---------- Taxas de referência (editáveis pelo usuário) ----------
// Selic: 14,25% a.a. (Copom, jun/2026)
const INVESTIMENTOS_BASE = [
  {
    id: "poupanca",
    nome: "Poupança",
    cor: "#a78bfa",
    corClara: "#c4b5fd",
    taxaAnualPadrao: 7.4,
    isento: true,
    descricao: "0,5% ao mês + TR. Garantida pelo FGC até R$ 250 mil.",
    liquidezDias: 0,
    liquidezLabel: "Diária",
  },
  {
    id: "cdb",
    nome: "CDB 100% CDI",
    cor: "#8b5cf6",
    corClara: "#ddd6fe",
    taxaAnualPadrao: 14.0,
    isento: false,
    descricao: "Renda fixa privada. Garantido pelo FGC até R$ 250 mil.",
    liquidezDias: 0,
    liquidezLabel: "Diária (confira as condições do seu banco)",
  },
  {
    id: "tesouroSelic",
    nome: "Tesouro Selic",
    cor: "#c084fc",
    corClara: "#e9d5ff",
    taxaAnualPadrao: 14.25,
    isento: false,
    descricao: "Título público pós-fixado. Risco mínimo, garantido pelo Tesouro Nacional.",
    liquidezDias: 1,
    liquidezLabel: "D+1 (próximo dia útil)",
  },
  {
    id: "lci",
    nome: "LCI/LCA",
    cor: "#7c3aed",
    corClara: "#ddd6fe",
    taxaAnualPadrao: 12.7,
    isento: true,
    descricao: "Isenta de IR. Garantida pelo FGC até R$ 250 mil.",
    liquidezDias: 90,
    liquidezLabel: "Carência típica de ~90 dias",
  },
];

function aliquotaIR(diasCorridos) {
  if (diasCorridos <= 180) return 0.225;
  if (diasCorridos <= 360) return 0.2;
  if (diasCorridos <= 720) return 0.175;
  return 0.15;
}

function formatBRL(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
function formatBRLPreciso(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
}
function formatBRLCentavos(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
}
function formatPercent(valor) {
  return `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function simular(valorInicial, aporteMensal, taxaAnual, meses) {
  const taxaMensal = Math.pow(1 + taxaAnual / 100, 1 / 12) - 1;
  const serie = [];
  let saldoBruto = valorInicial;
  let totalInvestido = valorInicial;
  for (let mes = 0; mes <= meses; mes++) {
    if (mes > 0) {
      saldoBruto = saldoBruto * (1 + taxaMensal) + aporteMensal;
      totalInvestido += aporteMensal;
    }
    serie.push({ mes, saldoBruto, totalInvestido, jurosBrutos: saldoBruto - totalInvestido });
  }
  return serie;
}

function calcularLiquido(saldoBruto, totalInvestido, isento, diasCorridos) {
  const jurosBrutos = saldoBruto - totalInvestido;
  if (isento || jurosBrutos <= 0) return saldoBruto;
  const aliquota = aliquotaIR(diasCorridos);
  return saldoBruto - jurosBrutos * aliquota;
}

function buscarInvestimento(id) {
  return INVESTIMENTOS_BASE.find((i) => i.id === id);
}

function descreverAlocacao(alocacoes) {
  return alocacoes.map((a) => `${Math.round(a.pct * 100)}% em ${buscarInvestimento(a.id).nome}`).join(" + ");
}

function simularCarteira(alocacoes, valorInicial, aporteMensal, meses, taxas) {
  const pernas = alocacoes.map((a) => {
    const inv = buscarInvestimento(a.id);
    const taxa = taxas[a.id];
    const serie = simular(valorInicial * a.pct, aporteMensal * a.pct, taxa, meses);
    return { ...a, inv, taxa, serie };
  });
  const serieCombinada = [];
  for (let mes = 0; mes <= meses; mes++) {
    let totalInvestido = 0, saldoBruto = 0, liquidoAcumulado = 0;
    pernas.forEach((perna) => {
      const ponto = perna.serie[mes];
      totalInvestido += ponto.totalInvestido;
      saldoBruto += ponto.saldoBruto;
      liquidoAcumulado += calcularLiquido(ponto.saldoBruto, ponto.totalInvestido, perna.inv.isento, mes * 30);
    });
    serieCombinada.push({ mes, totalInvestido, saldoBruto, liquidoAcumulado });
  }
  const final = serieCombinada[serieCombinada.length - 1];
  const taxaMediaPonderada = alocacoes.reduce((s, a) => s + a.pct * taxas[a.id], 0);
  return {
    pernas, serieCombinada,
    totalInvestido: final.totalInvestido,
    saldoBrutoFinal: final.saldoBruto,
    liquidoFinal: final.liquidoAcumulado,
    jurosLiquidos: final.liquidoAcumulado - final.totalInvestido,
    taxaMediaPonderada,
  };
}

const OBJETIVOS = [
  { id: "emergencia", nome: "Reserva de emergência", ajuda: "Precisa estar disponível a qualquer momento" },
  { id: "curto", nome: "Curto prazo (até 1 ano)", ajuda: "Viagem, compra específica, etc." },
  { id: "medio", nome: "Médio prazo (1 a 3 anos)", ajuda: "Entrada de imóvel, carro, faculdade" },
  { id: "longo", nome: "Longo prazo (3+ anos)", ajuda: "Aposentadoria, independência financeira" },
];

function gerarCandidatos(objetivo) {
  if (objetivo === "emergencia") {
    return [
      { id: "plano_ts", nome: "100% Tesouro Selic", descricao: "Resgate em D+1, sem risco de carência. A opção mais indicada para uma reserva de emergência.", alocacoes: [{ id: "tesouroSelic", pct: 1 }] },
      { id: "plano_cdb", nome: "100% CDB liquidez diária", descricao: "Rende perto do Tesouro Selic. Confirme com o banco se o resgate é realmente diário.", alocacoes: [{ id: "cdb", pct: 1 }] },
      { id: "plano_poup", nome: "100% Poupança", descricao: "Mais simples de entender, mas rende bem menos que as opções acima ao longo do tempo.", alocacoes: [{ id: "poupanca", pct: 1 }] },
    ];
  }
  if (objetivo === "curto") {
    return [
      { id: "plano_ts", nome: "100% Tesouro Selic", descricao: "Sem risco de carência, ideal para prazos de até um ano.", alocacoes: [{ id: "tesouroSelic", pct: 1 }] },
      { id: "plano_cdb", nome: "100% CDB 100% CDI", descricao: "Rentabilidade semelhante ao Tesouro Selic, verifique a liquidez do seu banco.", alocacoes: [{ id: "cdb", pct: 1 }] },
      { id: "plano_mix", nome: "Mix 60% Tesouro Selic + 40% LCI/LCA", descricao: "Ganha um pouco de isenção fiscal sem abrir mão da maior parte da liquidez.", alocacoes: [{ id: "tesouroSelic", pct: 0.6 }, { id: "lci", pct: 0.4 }] },
    ];
  }
  if (objetivo === "medio") {
    return [
      { id: "plano_mix", nome: "Mix 50% Tesouro Selic + 50% LCI/LCA", descricao: "Equilibra parte líquida com isenção fiscal — ideal para metas de 1 a 3 anos.", alocacoes: [{ id: "tesouroSelic", pct: 0.5 }, { id: "lci", pct: 0.5 }] },
      { id: "plano_lci", nome: "100% LCI/LCA", descricao: "Melhor rentabilidade líquida se você não precisar resgatar antes de 90 dias.", alocacoes: [{ id: "lci", pct: 1 }] },
      { id: "plano_cdb", nome: "100% CDB 100% CDI", descricao: "Alta rentabilidade bruta, mas com IR regressivo ainda elevado neste prazo.", alocacoes: [{ id: "cdb", pct: 1 }] },
    ];
  }
  return [
    { id: "plano_lci", nome: "100% LCI/LCA", descricao: "Isento de Imposto de Renda — a melhor rentabilidade líquida para quem não vai precisar resgatar cedo.", alocacoes: [{ id: "lci", pct: 1 }] },
    { id: "plano_mix", nome: "Mix 70% LCI/LCA + 30% Tesouro Selic", descricao: "Equilíbrio entre isenção fiscal e uma parte líquida para imprevistos no meio do caminho.", alocacoes: [{ id: "lci", pct: 0.7 }, { id: "tesouroSelic", pct: 0.3 }] },
    { id: "plano_cdb", nome: "100% CDB 100% CDI", descricao: "Boa rentabilidade e liquidez, mas com desconto de Imposto de Renda no resgate.", alocacoes: [{ id: "cdb", pct: 1 }] },
  ];
}

const PRAZOS_IA = [
  { id: "curto", nome: "Curto prazo", prazoLabel: "até 12 meses", meses: 12, objetivo: "curto", exigeLiquidez: true, icone: "⚡", cor: "#34d399", foco: "liquidez e segurança" },
  { id: "medio", nome: "Médio prazo", prazoLabel: "1 a 3 anos", meses: 24, objetivo: "medio", exigeLiquidez: false, icone: "📊", cor: "#a78bfa", foco: "equilíbrio entre rendimento e flexibilidade" },
  { id: "longo", nome: "Longo prazo", prazoLabel: "3 anos ou mais", meses: 60, objetivo: "longo", exigeLiquidez: false, icone: "🎯", cor: "#c084fc", foco: "maximizar rendimento líquido" },
];

function gerarRaciocinioIA(prazo, melhor, segundo) {
  const { resultado } = melhor;
  const partes = [];

  if (prazo.id === "curto") {
    partes.push(`Para metas de ${prazo.prazoLabel}, a IA prioriza investimentos com resgate rápido (liquidez diária ou D+1) e baixo risco.`);
  } else if (prazo.id === "medio") {
    partes.push(`Para ${prazo.prazoLabel}, a IA busca ${prazo.foco}, combinando isenção fiscal com opções que ainda permitem resgate parcial.`);
  } else {
    partes.push(`Para ${prazo.prazoLabel}, a IA favorece produtos isentos de IR — com prazo longo, a LCI/LCA costuma superar CDB e poupança no líquido.`);
  }

  partes.push(`"${melhor.nome}" projeta ${formatBRL(resultado.liquidoFinal)} líquidos após ${prazo.meses} meses, partindo de ${formatBRL(resultado.totalInvestido)} investidos.`);

  if (segundo) {
    const diff = resultado.liquidoFinal - segundo.resultado.liquidoFinal;
    if (diff > 0) {
      partes.push(`Fica ${formatBRL(diff)} à frente da 2ª opção (${segundo.nome}).`);
    }
  }

  return partes.join(" ");
}

function analisarSugestoesIA(taxas, valorInicial, aporteMensal) {
  return PRAZOS_IA.map((prazo) => {
    const templates = gerarCandidatos(prazo.objetivo);
    const avaliados = templates.map((t) => {
      const resultado = simularCarteira(t.alocacoes, valorInicial, aporteMensal, prazo.meses, taxas);
      const restricaoLiquidez = t.alocacoes.some((a) => a.pct >= 0.3 && buscarInvestimento(a.id).liquidezDias > 30);
      return { ...t, resultado, restricaoLiquidez };
    });
    const elegiveis = prazo.exigeLiquidez ? avaliados.filter((c) => !c.restricaoLiquidez) : avaliados;
    const pool = elegiveis.length ? elegiveis : avaliados;
    const ordenados = [...pool].sort((a, b) => b.resultado.liquidoFinal - a.resultado.liquidoFinal);
    const melhor = ordenados[0];
    const segundo = ordenados[1];
    const margem = segundo ? melhor.resultado.liquidoFinal - segundo.resultado.liquidoFinal : 0;
    const confianca = segundo && melhor.resultado.liquidoFinal > 0
      ? Math.min(98, Math.round(58 + (margem / melhor.resultado.liquidoFinal) * 120))
      : 82;
    return {
      prazo,
      melhor,
      segundo,
      confianca,
      raciocinio: gerarRaciocinioIA(prazo, melhor, segundo),
      alternativas: ordenados.slice(0, 3),
    };
  });
}

// ---------- Cálculos da carteira (Dashboard) ----------
function calcularPosicao(pos, taxas) {
  const inv = buscarInvestimento(pos.instId);
  const taxaAnual = taxas[pos.instId];
  const duracaoMeses = Math.max(1, Math.round(pos.dias / 30));
  const serie = simular(pos.valor, pos.aporteMensal, taxaAnual, duracaoMeses);
  const ultimo = serie[serie.length - 1];
  const diasCorridos = Math.max(1, pos.dias);
  const liquidoAtual = calcularLiquido(ultimo.saldoBruto, ultimo.totalInvestido, inv.isento, diasCorridos);
  const aliquota = inv.isento ? 0 : aliquotaIR(diasCorridos);
  const taxaDiaria = Math.pow(1 + taxaAnual / 100, 1 / 365) - 1;
  const taxaMensalInst = Math.pow(1 + taxaAnual / 100, 1 / 12) - 1;
  const ganhoDiario = ultimo.saldoBruto * taxaDiaria * (1 - aliquota);
  const ganhoSemanal = ganhoDiario * 7;
  const ganhoMensal = ultimo.saldoBruto * taxaMensalInst * (1 - aliquota);
  const rendimentoLiquido = liquidoAtual - ultimo.totalInvestido;
  const rentabilidadePct = ultimo.totalInvestido > 0 ? (rendimentoLiquido / ultimo.totalInvestido) * 100 : 0;
  return {
    ...pos, inv, taxaAnual, duracaoMeses, serie,
    totalInvestido: ultimo.totalInvestido,
    saldoBruto: ultimo.saldoBruto,
    liquidoAtual, ganhoDiario, ganhoSemanal, ganhoMensal,
    rendimentoLiquido, rentabilidadePct,
  };
}

const PRINT_STYLES = `
  .print-only { display: none; }
  @media print {
    .no-print { display: none !important; }
    .print-only { display: block !important; }
    .screen-only { display: none !important; }
    body { background: #ffffff !important; }
  }
`;

let uidCounter = 0;
function novoUid() {
  uidCounter += 1;
  return `pos_${Date.now()}_${uidCounter}`;
}

export default function App() {
  const [aba, setAba] = useState("simulador");

  // ---- Simulador ----
  const [valorInicial, setValorInicial] = useState(1000);
  const [aporteMensal, setAporteMensal] = useState(200);
  const [meses, setMeses] = useState(24);
  const [taxas, setTaxas] = useState(Object.fromEntries(INVESTIMENTOS_BASE.map((i) => [i.id, i.taxaAnualPadrao])));
  const [selecionados, setSelecionados] = useState(Object.fromEntries(INVESTIMENTOS_BASE.map((i) => [i.id, true])));

  // ---- Plano de Investimento ----
  const [planoObjetivo, setPlanoObjetivo] = useState("emergencia");
  const [planoLiquidez, setPlanoLiquidez] = useState(true);
  const [planoValorInicial, setPlanoValorInicial] = useState(5000);
  const [planoAporteMensal, setPlanoAporteMensal] = useState(800);
  const [planoMeses, setPlanoMeses] = useState(24);
  const [planoSelecionadoId, setPlanoSelecionadoId] = useState(null);

  // ---- IA ----
  const [iaValorInicial, setIaValorInicial] = useState(5000);
  const [iaAporteMensal, setIaAporteMensal] = useState(500);

  // ---- Dashboard / Carteira ----
  const [posicoes, setPosicoes] = useState([
    { uid: novoUid(), instId: "poupanca", apelido: "", valor: 5000, aporteMensal: 800, dias: 180 },
    { uid: novoUid(), instId: "tesouroSelic", apelido: "", valor: 3000, aporteMensal: 300, dias: 90 },
  ]);
  const [arrastandoInstId, setArrastandoInstId] = useState(null);
  const [sobreZona, setSobreZona] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);

  const resultados = useMemo(() => {
    return INVESTIMENTOS_BASE.map((inv) => {
      const taxa = taxas[inv.id];
      const serie = simular(valorInicial, aporteMensal, taxa, meses);
      const ultimo = serie[serie.length - 1];
      const diasCorridos = meses * 30;
      const liquidoFinal = calcularLiquido(ultimo.saldoBruto, ultimo.totalInvestido, inv.isento, diasCorridos);
      return { ...inv, taxa, serie, totalInvestido: ultimo.totalInvestido, saldoBrutoFinal: ultimo.saldoBruto, liquidoFinal, jurosLiquidos: liquidoFinal - ultimo.totalInvestido };
    });
  }, [valorInicial, aporteMensal, meses, taxas]);

  const investimentosAtivos = resultados.filter((r) => selecionados[r.id]);
  const dadosComparativo = investimentosAtivos.map((r) => ({ nome: r.nome, "Total investido": Math.round(r.totalInvestido), "Saldo líquido": Math.round(r.liquidoFinal) }));
  const melhorInvestimento = investimentosAtivos.length ? investimentosAtivos.reduce((a, b) => (b.liquidoFinal > a.liquidoFinal ? b : a)) : null;
  const passoMeses = meses > 36 ? Math.ceil(meses / 24) : 1;
  const dadosEvolucao = melhorInvestimento
    ? melhorInvestimento.serie.filter((p) => p.mes % passoMeses === 0 || p.mes === meses).map((p) => ({ mes: `M${p.mes}`, "Total investido": Math.round(p.totalInvestido), "Juros acumulados": Math.round(p.saldoBruto - p.totalInvestido) }))
    : [];

  function toggleInvestimento(id) { setSelecionados((prev) => ({ ...prev, [id]: !prev[id] })); }
  function atualizarTaxa(id, valor) { setTaxas((prev) => ({ ...prev, [id]: valor })); }

  const candidatosPlano = useMemo(() => {
    const templates = gerarCandidatos(planoObjetivo);
    const comResultado = templates.map((t) => {
      const resultado = simularCarteira(t.alocacoes, planoValorInicial, planoAporteMensal, planoMeses, taxas);
      const restricaoLiquidez = t.alocacoes.some((a) => a.pct >= 0.3 && buscarInvestimento(a.id).liquidezDias > 30);
      return { ...t, resultado, restricaoLiquidez };
    });
    const elegiveis = planoLiquidez ? comResultado.filter((c) => !c.restricaoLiquidez) : comResultado;
    const pool = elegiveis.length ? elegiveis : comResultado;
    const melhorId = [...pool].sort((a, b) => b.resultado.liquidoFinal - a.resultado.liquidoFinal)[0]?.id;
    return [...comResultado].sort((a, b) => b.resultado.liquidoFinal - a.resultado.liquidoFinal).map((c) => ({ ...c, recomendado: c.id === melhorId }));
  }, [planoObjetivo, planoLiquidez, planoValorInicial, planoAporteMensal, planoMeses, taxas]);

  const planoAtivo = useMemo(() => {
    const escolhido = planoSelecionadoId && candidatosPlano.find((c) => c.id === planoSelecionadoId);
    return escolhido || candidatosPlano.find((c) => c.recomendado) || candidatosPlano[0];
  }, [candidatosPlano, planoSelecionadoId]);

  const dadosComparativoPlano = candidatosPlano.map((c) => ({ nome: c.nome, "Total investido": Math.round(c.resultado.totalInvestido), "Saldo líquido": Math.round(c.resultado.liquidoFinal) }));
  const objetivoAtual = OBJETIVOS.find((o) => o.id === planoObjetivo);

  const sugestoesIA = useMemo(
    () => analisarSugestoesIA(taxas, iaValorInicial, iaAporteMensal),
    [taxas, iaValorInicial, iaAporteMensal]
  );

  function linhasTabelaMensal(resultado, meses) {
    const serie = resultado.serieCombinada;
    if (meses <= 6) return serie.slice(1);
    return [...serie.slice(1, 7), { ...serie[serie.length - 1], final: true }];
  }

  // ---- Carteira: derivações ----
  const posicoesCalc = useMemo(() => {
    const contagem = {};
    return posicoes.map((pos) => {
      contagem[pos.instId] = (contagem[pos.instId] || 0) + 1;
      const calc = calcularPosicao(pos, taxas);
      const label = pos.apelido?.trim()
        ? pos.apelido.trim()
        : contagem[pos.instId] > 1
        ? `${calc.inv.nome} #${contagem[pos.instId]}`
        : calc.inv.nome;
      return { ...calc, label };
    });
  }, [posicoes, taxas]);

  const kpi = useMemo(() => {
    const totalInvestido = posicoesCalc.reduce((s, p) => s + p.totalInvestido, 0);
    const saldoBruto = posicoesCalc.reduce((s, p) => s + p.saldoBruto, 0);
    const saldoLiquido = posicoesCalc.reduce((s, p) => s + p.liquidoAtual, 0);
    const rendimentoLiquido = saldoLiquido - totalInvestido;
    const rentabilidadePct = totalInvestido > 0 ? (rendimentoLiquido / totalInvestido) * 100 : 0;
    const ganhoDiario = posicoesCalc.reduce((s, p) => s + p.ganhoDiario, 0);
    const ganhoSemanal = posicoesCalc.reduce((s, p) => s + p.ganhoSemanal, 0);
    const ganhoMensal = posicoesCalc.reduce((s, p) => s + p.ganhoMensal, 0);
    const melhor = posicoesCalc.length ? posicoesCalc.reduce((a, b) => (b.rentabilidadePct > a.rentabilidadePct ? b : a)) : null;
    return { totalInvestido, saldoBruto, saldoLiquido, rendimentoLiquido, rentabilidadePct, ganhoDiario, ganhoSemanal, ganhoMensal, melhor };
  }, [posicoesCalc]);

  const dadosPizza = posicoesCalc.map((p) => ({ name: p.label, value: Math.round(p.liquidoAtual), cor: p.inv.cor }));
  const dadosBarraCarteira = posicoesCalc.map((p) => ({ nome: p.label, "Total investido": Math.round(p.totalInvestido), "Saldo líquido": Math.round(p.liquidoAtual) }));

  const maxDuracaoMeses = posicoesCalc.length ? Math.max(...posicoesCalc.map((p) => p.duracaoMeses)) : 0;
  const dadosLinhaCarteira = useMemo(() => {
    if (!posicoesCalc.length) return [];
    return Array.from({ length: maxDuracaoMeses + 1 }, (_, m) => {
      const row = { mes: `M${m}` };
      posicoesCalc.forEach((p) => {
        if (m <= p.duracaoMeses) {
          const ponto = p.serie[m];
          row[p.label] = Math.round(calcularLiquido(ponto.saldoBruto, ponto.totalInvestido, p.inv.isento, m * 30));
        }
      });
      return row;
    });
  }, [posicoesCalc, maxDuracaoMeses]);

  function adicionarPosicao(instId) {
    setPosicoes((prev) => [...prev, { uid: novoUid(), instId, apelido: "", valor: 1000, aporteMensal: 0, dias: 30 }]);
  }
  function removerPosicao(uid) {
    setPosicoes((prev) => prev.filter((p) => p.uid !== uid));
  }
  function atualizarPosicao(uid, campo, valor) {
    setPosicoes((prev) => prev.map((p) => (p.uid === uid ? { ...p, [campo]: valor } : p)));
  }
  function reordenarPosicoes(origem, destino) {
    setPosicoes((prev) => {
      const copia = [...prev];
      const [item] = copia.splice(origem, 1);
      copia.splice(destino, 0, item);
      return copia;
    });
  }

  const PIZZA_FALLBACK = ["#a78bfa", "#8b5cf6", "#c084fc", "#7c3aed", "#d8b4fe", "#6d28d9"];

  return (
    <div style={styles.page}>
      <style>{PRINT_STYLES}</style>
      <div style={styles.container}>
        <header style={styles.header} className="no-print">
          <div style={styles.headerLeft}>
            <div style={styles.logoMark}>◆</div>
            <div>
              <h1 style={styles.title}>Simulador de Juros Compostos</h1>
              <p style={styles.subtitle}>Compare, planeje e acompanhe seus investimentos de baixo risco</p>
            </div>
          </div>
          <div style={styles.headerBadge}>Selic hoje: <strong>14,25% a.a.</strong></div>
        </header>

        <div style={styles.tabBar} className="no-print">
          <button onClick={() => setAba("simulador")} style={{ ...styles.tabButton, ...(aba === "simulador" ? styles.tabButtonActive : {}) }}>Simulador</button>
          <button onClick={() => setAba("plano")} style={{ ...styles.tabButton, ...(aba === "plano" ? styles.tabButtonActive : {}) }}>Plano de investimento</button>
          <button onClick={() => setAba("dashboard")} style={{ ...styles.tabButton, ...(aba === "dashboard" ? styles.tabButtonActive : {}) }}>Dashboard</button>
          <button onClick={() => setAba("ia")} style={{ ...styles.tabButton, ...(aba === "ia" ? styles.tabButtonActive : {}), ...(aba !== "ia" ? styles.tabButtonIA : {}) }}>✦ IA</button>
        </div>

        {aba === "simulador" && (
          <>
            <section style={styles.card}>
              <h2 style={styles.cardTitle}>Seus dados</h2>
              <div style={styles.inputsGrid}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Valor inicial (aporte único)</label>
                  <div style={styles.inputWrapper}>
                    <span style={styles.prefix}>R$</span>
                    <input type="number" min="0" step="50" value={valorInicial} onChange={(e) => setValorInicial(Number(e.target.value) || 0)} style={styles.input} />
                  </div>
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Aporte mensal (opcional)</label>
                  <div style={styles.inputWrapper}>
                    <span style={styles.prefix}>R$</span>
                    <input type="number" min="0" step="10" value={aporteMensal} onChange={(e) => setAporteMensal(Number(e.target.value) || 0)} style={styles.input} />
                  </div>
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Período (meses)</label>
                  <div style={styles.inputWrapper}>
                    <input type="number" min="1" max="480" value={meses} onChange={(e) => setMeses(Math.max(1, Math.min(480, Number(e.target.value) || 1)))} style={styles.input} />
                    <span style={styles.suffix}>meses</span>
                  </div>
                  <input type="range" min="1" max="360" value={Math.min(meses, 360)} onChange={(e) => setMeses(Number(e.target.value))} style={styles.slider} />
                </div>
              </div>
            </section>

            <section>
              <h2 style={{ ...styles.cardTitle, marginBottom: 12 }}>Investimentos (clique para incluir/excluir da comparação)</h2>
              <div style={styles.investCardsGrid}>
                {resultados.map((r) => (
                  <div key={r.id} onClick={() => toggleInvestimento(r.id)} style={{ ...styles.investCard, borderColor: selecionados[r.id] ? r.cor : "rgba(255,255,255,0.08)", opacity: selecionados[r.id] ? 1 : 0.45 }}>
                    <div style={styles.investCardHeader}>
                      <span style={{ ...styles.investDot, background: r.cor }} />
                      <span style={styles.investNome}>{r.nome}</span>
                      {r.isento && <span style={styles.tagIsento}>Isento IR</span>}
                    </div>
                    <p style={styles.investDescricao}>{r.descricao}</p>
                    <div style={styles.taxaRow}>
                      <label style={styles.taxaLabel}>Taxa (% a.a.)</label>
                      <input type="number" step="0.05" value={r.taxa} onClick={(e) => e.stopPropagation()} onChange={(e) => atualizarTaxa(r.id, Number(e.target.value) || 0)} style={styles.taxaInput} />
                    </div>
                    <div style={styles.investResultado}>
                      <div><span style={styles.resultadoLabel}>Total investido</span><span style={styles.resultadoValor}>{formatBRL(r.totalInvestido)}</span></div>
                      <div><span style={styles.resultadoLabel}>Saldo líquido final</span><span style={{ ...styles.resultadoValor, color: r.corClara, fontSize: 18 }}>{formatBRL(r.liquidoFinal)}</span></div>
                      <div><span style={styles.resultadoLabel}>Juros líquidos ganhos</span><span style={{ ...styles.resultadoValor, color: "#34d399" }}>+ {formatBRL(r.jurosLiquidos)}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section style={styles.card}>
              <h2 style={styles.cardTitle}>Comparativo final — investido vs. líquido recebido</h2>
              <p style={styles.cardSubtitle}>Após {meses} {meses === 1 ? "mês" : "meses"}, já descontando Imposto de Renda quando aplicável</p>
              <div style={{ width: "100%", height: 360 }}>
                <ResponsiveContainer>
                  <BarChart data={dadosComparativo} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="nome" stroke="#9d8fc4" tick={{ fill: "#c4b5fd", fontSize: 12 }} />
                    <YAxis stroke="#9d8fc4" tick={{ fill: "#c4b5fd", fontSize: 11 }} tickFormatter={(v) => formatBRL(v)} width={80} />
                    <Tooltip contentStyle={{ background: "#1e1533", border: "1px solid #4c3a7a", borderRadius: 10, color: "#f3e8ff" }} formatter={(value) => formatBRLPreciso(value)} />
                    <Legend wrapperStyle={{ color: "#c4b5fd", fontSize: 12 }} />
                    <Bar dataKey="Total investido" fill="#4c3a7a" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Saldo líquido" fill="#a78bfa" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {melhorInvestimento && (
              <section style={styles.card}>
                <h2 style={styles.cardTitle}>Evolução mês a mês — {melhorInvestimento.nome}</h2>
                <p style={styles.cardSubtitle}>Melhor rendimento líquido entre os selecionados. Barras empilhadas: valor investido + juros acumulados (bruto)</p>
                <div style={{ width: "100%", height: 360 }}>
                  <ResponsiveContainer>
                    <BarChart data={dadosEvolucao} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="mes" stroke="#9d8fc4" tick={{ fill: "#c4b5fd", fontSize: 11 }} />
                      <YAxis stroke="#9d8fc4" tick={{ fill: "#c4b5fd", fontSize: 11 }} tickFormatter={(v) => formatBRL(v)} width={80} />
                      <Tooltip contentStyle={{ background: "#1e1533", border: "1px solid #4c3a7a", borderRadius: 10, color: "#f3e8ff" }} formatter={(value) => formatBRLPreciso(value)} />
                      <Legend wrapperStyle={{ color: "#c4b5fd", fontSize: 12 }} />
                      <Bar dataKey="Total investido" stackId="a" fill="#4c3a7a" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Juros acumulados" stackId="a" fill="#c084fc" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}
          </>
        )}

        {aba === "plano" && (
          <>
            <section style={styles.card}>
              <h2 style={styles.cardTitle}>Qual é o seu objetivo?</h2>
              <div style={styles.objetivoGrid}>
                {OBJETIVOS.map((o) => (
                  <div key={o.id} onClick={() => setPlanoObjetivo(o.id)} style={{ ...styles.objetivoCard, borderColor: planoObjetivo === o.id ? "#a78bfa" : "rgba(255,255,255,0.08)", background: planoObjetivo === o.id ? "rgba(167,139,250,0.14)" : "rgba(255,255,255,0.03)" }}>
                    <span style={styles.objetivoNome}>{o.nome}</span>
                    <span style={styles.objetivoAjuda}>{o.ajuda}</span>
                  </div>
                ))}
              </div>

              <div style={{ ...styles.inputsGrid, marginTop: 20 }}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Valor inicial disponível hoje</label>
                  <div style={styles.inputWrapper}>
                    <span style={styles.prefix}>R$</span>
                    <input type="number" min="0" step="50" value={planoValorInicial} onChange={(e) => setPlanoValorInicial(Number(e.target.value) || 0)} style={styles.input} />
                  </div>
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Quanto pretende guardar por mês</label>
                  <div style={styles.inputWrapper}>
                    <span style={styles.prefix}>R$</span>
                    <input type="number" min="0" step="10" value={planoAporteMensal} onChange={(e) => setPlanoAporteMensal(Number(e.target.value) || 0)} style={styles.input} />
                  </div>
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Prazo do plano (meses)</label>
                  <div style={styles.inputWrapper}>
                    <input type="number" min="1" max="480" value={planoMeses} onChange={(e) => setPlanoMeses(Math.max(1, Math.min(480, Number(e.target.value) || 1)))} style={styles.input} />
                    <span style={styles.suffix}>meses</span>
                  </div>
                  <input type="range" min="1" max="120" value={Math.min(planoMeses, 120)} onChange={(e) => setPlanoMeses(Number(e.target.value))} style={styles.slider} />
                </div>
              </div>

              <div style={{ marginTop: 18 }}>
                <label style={styles.label}>Você pode precisar resgatar tudo a qualquer momento, sem aviso?</label>
                <div style={styles.toggleGroup}>
                  <button onClick={() => setPlanoLiquidez(true)} style={{ ...styles.toggleButton, ...(planoLiquidez ? styles.toggleButtonActive : {}) }}>Sim, preciso de liquidez total</button>
                  <button onClick={() => setPlanoLiquidez(false)} style={{ ...styles.toggleButton, ...(!planoLiquidez ? styles.toggleButtonActive : {}) }}>Não, posso deixar até o fim do prazo</button>
                </div>
              </div>
            </section>

            <section>
              <h2 style={{ ...styles.cardTitle, marginBottom: 4 }}>Opções de plano para "{objetivoAtual?.nome}"</h2>
              <p style={{ ...styles.cardSubtitle, marginBottom: 12 }}>Clique em um plano para ver o detalhamento mês a mês. O selo "Recomendado" leva em conta rentabilidade líquida e a liquidez que você indicou acima.</p>
              <div style={styles.investCardsGrid}>
                {candidatosPlano.map((c) => {
                  const ativo = planoAtivo?.id === c.id;
                  return (
                    <div key={c.id} onClick={() => setPlanoSelecionadoId(c.id)} style={{ ...styles.investCard, borderColor: ativo ? "#a78bfa" : "rgba(255,255,255,0.08)", boxShadow: ativo ? "0 0 0 1px #a78bfa" : "none" }}>
                      <div style={styles.investCardHeader}>
                        <span style={styles.investNome}>{c.nome}</span>
                        {c.recomendado && <span style={styles.tagRecomendado}>Recomendado</span>}
                      </div>
                      <p style={styles.investDescricao}>{c.descricao}</p>
                      {c.restricaoLiquidez && (
                        <p style={styles.avisoLiquidez}>⚠ Liquidez restrita: {c.alocacoes.filter((a) => buscarInvestimento(a.id).liquidezDias > 30).map((a) => buscarInvestimento(a.id).liquidezLabel).join(", ")}</p>
                      )}
                      <div style={styles.investResultado}>
                        <div><span style={styles.resultadoLabel}>Total investido</span><span style={styles.resultadoValor}>{formatBRL(c.resultado.totalInvestido)}</span></div>
                        <div><span style={styles.resultadoLabel}>Saldo líquido final</span><span style={{ ...styles.resultadoValor, color: "#c4b5fd", fontSize: 18 }}>{formatBRL(c.resultado.liquidoFinal)}</span></div>
                        <div><span style={styles.resultadoLabel}>Rendimento líquido</span><span style={{ ...styles.resultadoValor, color: "#34d399" }}>+ {formatBRL(c.resultado.jurosLiquidos)}</span></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section style={styles.card}>
              <h2 style={styles.cardTitle}>Comparação entre as opções de plano</h2>
              <div style={{ width: "100%", height: 320 }}>
                <ResponsiveContainer>
                  <BarChart data={dadosComparativoPlano} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="nome" stroke="#9d8fc4" tick={{ fill: "#c4b5fd", fontSize: 11 }} />
                    <YAxis stroke="#9d8fc4" tick={{ fill: "#c4b5fd", fontSize: 11 }} tickFormatter={(v) => formatBRL(v)} width={80} />
                    <Tooltip contentStyle={{ background: "#1e1533", border: "1px solid #4c3a7a", borderRadius: 10, color: "#f3e8ff" }} formatter={(value) => formatBRLPreciso(value)} />
                    <Legend wrapperStyle={{ color: "#c4b5fd", fontSize: 12 }} />
                    <Bar dataKey="Total investido" fill="#4c3a7a" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Saldo líquido" fill="#a78bfa" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {planoAtivo && (
              <section style={styles.card}>
                <div style={styles.detalheHeader}>
                  <div>
                    <h2 style={styles.cardTitle}>Detalhamento — {planoAtivo.nome}</h2>
                    <p style={styles.cardSubtitle}>Alocação: {descreverAlocacao(planoAtivo.alocacoes)}</p>
                  </div>
                  <button onClick={() => window.print()} style={styles.exportButton} className="no-print">⬇ Exportar plano em PDF</button>
                </div>

                <h3 style={styles.subTitulo}>Primeiros {Math.min(6, planoMeses)} {Math.min(6, planoMeses) === 1 ? "mês" : "meses"}</h3>
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead><tr><th style={styles.th}>Mês</th><th style={styles.th}>Total investido</th><th style={styles.th}>Saldo bruto</th><th style={styles.th}>Saldo líquido</th></tr></thead>
                    <tbody>
                      {linhasTabelaMensal(planoAtivo.resultado, planoMeses).map((l) => (
                        <tr key={l.mes} style={l.final ? styles.trFinal : undefined}>
                          <td style={styles.td}>{l.final ? `Mês ${l.mes} (final)` : `Mês ${l.mes}`}</td>
                          <td style={styles.td}>{formatBRLPreciso(l.totalInvestido)}</td>
                          <td style={styles.td}>{formatBRLPreciso(l.saldoBruto)}</td>
                          <td style={{ ...styles.td, color: "#c4b5fd", fontWeight: 700 }}>{formatBRLPreciso(l.liquidoAcumulado)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <h3 style={styles.subTitulo}>Resultado final — mês {planoMeses}</h3>
                <div style={styles.resumoFinalGrid}>
                  <div style={styles.resumoFinalCard}><span style={styles.resultadoLabel}>Total investido</span><span style={styles.resumoFinalValor}>{formatBRL(planoAtivo.resultado.totalInvestido)}</span></div>
                  <div style={styles.resumoFinalCard}><span style={styles.resultadoLabel}>Saldo bruto</span><span style={styles.resumoFinalValor}>{formatBRL(planoAtivo.resultado.saldoBrutoFinal)}</span></div>
                  <div style={styles.resumoFinalCard}><span style={styles.resultadoLabel}>Saldo líquido</span><span style={{ ...styles.resumoFinalValor, color: "#c4b5fd" }}>{formatBRL(planoAtivo.resultado.liquidoFinal)}</span></div>
                  <div style={styles.resumoFinalCard}><span style={styles.resultadoLabel}>Rendimento líquido</span><span style={{ ...styles.resumoFinalValor, color: "#34d399" }}>+ {formatBRL(planoAtivo.resultado.jurosLiquidos)} ({formatPercent((planoAtivo.resultado.jurosLiquidos / planoAtivo.resultado.totalInvestido) * 100)})</span></div>
                </div>
              </section>
            )}
          </>
        )}

        {aba === "dashboard" && (
          <>
            <section style={styles.card}>
              <h2 style={styles.cardTitle}>Monte sua carteira</h2>
              <p style={styles.cardSubtitle}>Arraste um investimento da lista abaixo até a área "Sua carteira" (ou toque no + em telas de toque). Depois ajuste valor, aporte e há quantos dias você investiu.</p>

              <div style={styles.paletteRow}>
                {INVESTIMENTOS_BASE.map((inv) => (
                  <div
                    key={inv.id}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData("instId", inv.id); setArrastandoInstId(inv.id); }}
                    onDragEnd={() => setArrastandoInstId(null)}
                    style={{ ...styles.paletteChip, borderColor: inv.cor, opacity: arrastandoInstId === inv.id ? 0.4 : 1 }}
                  >
                    <span style={{ ...styles.investDot, background: inv.cor }} />
                    <span>{inv.nome}</span>
                    <button onClick={() => adicionarPosicao(inv.id)} style={styles.addChipButton} title="Adicionar à carteira">+</button>
                  </div>
                ))}
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setSobreZona(true); }}
                onDragLeave={() => setSobreZona(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setSobreZona(false);
                  const instId = e.dataTransfer.getData("instId");
                  if (instId) adicionarPosicao(instId);
                }}
                style={{ ...styles.dropZone, borderColor: sobreZona ? "#a78bfa" : "rgba(255,255,255,0.14)", background: sobreZona ? "rgba(167,139,250,0.08)" : "rgba(255,255,255,0.02)" }}
              >
                <h3 style={styles.subTitulo}>Sua carteira ({posicoesCalc.length})</h3>

                {posicoesCalc.length === 0 && <p style={styles.emptyState}>Arraste um investimento até aqui para começar a montar sua carteira.</p>}

                <div style={styles.posicoesGrid}>
                  {posicoesCalc.map((p, index) => (
                    <div
                      key={p.uid}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.setData("posIndex", String(index)); setDragIndex(index); }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const origemStr = e.dataTransfer.getData("posIndex");
                        if (origemStr !== "") {
                          reordenarPosicoes(Number(origemStr), index);
                        } else {
                          const instId = e.dataTransfer.getData("instId");
                          if (instId) adicionarPosicao(instId);
                        }
                      }}
                      onDragEnd={() => setDragIndex(null)}
                      style={{ ...styles.posicaoCard, borderColor: p.inv.cor, opacity: dragIndex === index ? 0.4 : 1 }}
                    >
                      <div style={styles.posicaoHeader}>
                        <span style={styles.dragHandle}>⠿</span>
                        <span style={{ ...styles.investDot, background: p.inv.cor }} />
                        <input
                          value={p.apelido}
                          placeholder={p.label}
                          onChange={(e) => atualizarPosicao(p.uid, "apelido", e.target.value)}
                          style={styles.apelidoInput}
                        />
                        <button onClick={() => removerPosicao(p.uid)} style={styles.removeButton} title="Remover">×</button>
                      </div>

                      <div style={styles.posicaoInputsGrid}>
                        <div style={styles.miniInputGroup}>
                          <label style={styles.miniLabel}>Valor investido</label>
                          <div style={styles.inputWrapper}>
                            <span style={styles.prefix}>R$</span>
                            <input type="number" min="0" step="50" value={p.valor} onChange={(e) => atualizarPosicao(p.uid, "valor", Number(e.target.value) || 0)} style={styles.input} />
                          </div>
                        </div>
                        <div style={styles.miniInputGroup}>
                          <label style={styles.miniLabel}>Aporte mensal</label>
                          <div style={styles.inputWrapper}>
                            <span style={styles.prefix}>R$</span>
                            <input type="number" min="0" step="10" value={p.aporteMensal} onChange={(e) => atualizarPosicao(p.uid, "aporteMensal", Number(e.target.value) || 0)} style={styles.input} />
                          </div>
                        </div>
                        <div style={styles.miniInputGroup}>
                          <label style={styles.miniLabel}>Investido há</label>
                          <div style={styles.inputWrapper}>
                            <input type="number" min="1" value={p.dias} onChange={(e) => atualizarPosicao(p.uid, "dias", Math.max(1, Number(e.target.value) || 1))} style={styles.input} />
                            <span style={styles.suffix}>dias</span>
                          </div>
                        </div>
                      </div>

                      <div style={styles.posicaoResultado}>
                        <span style={styles.resultadoLabel}>Saldo líquido hoje</span>
                        <span style={{ ...styles.resultadoValor, fontSize: 17, color: p.inv.corClara }}>{formatBRL(p.liquidoAtual)}</span>
                        <span style={{ fontSize: 11, color: p.rendimentoLiquido >= 0 ? "#34d399" : "#f87171" }}>
                          {p.rendimentoLiquido >= 0 ? "+" : ""}{formatBRL(p.rendimentoLiquido)} ({formatPercent(p.rentabilidadePct)})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {posicoesCalc.length > 0 && (
              <>
                {/* 8 KPI cards */}
                <section style={styles.kpiGrid}>
                  <div style={styles.kpiCard}><span style={styles.resultadoLabel}>Total investido</span><span style={styles.kpiValor}>{formatBRL(kpi.totalInvestido)}</span></div>
                  <div style={styles.kpiCard}><span style={styles.resultadoLabel}>Saldo bruto atual</span><span style={styles.kpiValor}>{formatBRL(kpi.saldoBruto)}</span></div>
                  <div style={styles.kpiCard}><span style={styles.resultadoLabel}>Saldo líquido atual</span><span style={{ ...styles.kpiValor, color: "#c4b5fd" }}>{formatBRL(kpi.saldoLiquido)}</span></div>
                  <div style={styles.kpiCard}><span style={styles.resultadoLabel}>Rendimento líquido total</span><span style={{ ...styles.kpiValor, color: "#34d399" }}>+ {formatBRL(kpi.rendimentoLiquido)}</span></div>
                  <div style={styles.kpiCard}><span style={styles.resultadoLabel}>Rentabilidade acumulada</span><span style={styles.kpiValor}>{formatPercent(kpi.rentabilidadePct)}</span></div>
                  <div style={styles.kpiCard}><span style={styles.resultadoLabel}>Ganhando por dia</span><span style={{ ...styles.kpiValor, color: "#34d399" }}>+ {formatBRLCentavos(kpi.ganhoDiario)}</span></div>
                  <div style={styles.kpiCard}><span style={styles.resultadoLabel}>Ganhando por semana</span><span style={{ ...styles.kpiValor, color: "#34d399" }}>+ {formatBRL(kpi.ganhoSemanal)}</span></div>
                  <div style={styles.kpiCard}><span style={styles.resultadoLabel}>Ganhando por mês</span><span style={{ ...styles.kpiValor, color: "#34d399" }}>+ {formatBRL(kpi.ganhoMensal)}</span></div>
                </section>

                {kpi.melhor && (
                  <p style={styles.destaqueMelhor}>
                    🏆 Sua posição mais rentável até agora é <strong>{kpi.melhor.label}</strong>, com {formatPercent(kpi.melhor.rentabilidadePct)} de rentabilidade líquida acumulada.
                  </p>
                )}

                {/* Pie + Bar */}
                <div style={styles.duasColunas}>
                  <section style={styles.card}>
                    <h2 style={styles.cardTitle}>Composição da carteira</h2>
                    <p style={styles.cardSubtitle}>Por saldo líquido atual</p>
                    <div style={{ width: "100%", height: 300 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie data={dadosPizza} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={3}>
                            {dadosPizza.map((entry, i) => (
                              <Cell key={entry.name} fill={entry.cor || PIZZA_FALLBACK[i % PIZZA_FALLBACK.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: "#1e1533", border: "1px solid #4c3a7a", borderRadius: 10, color: "#f3e8ff" }} formatter={(value) => formatBRLPreciso(value)} />
                          <Legend wrapperStyle={{ color: "#c4b5fd", fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </section>

                  <section style={styles.card}>
                    <h2 style={styles.cardTitle}>Investido vs. líquido por posição</h2>
                    <p style={styles.cardSubtitle}>Comparação entre cada posição da carteira</p>
                    <div style={{ width: "100%", height: 300 }}>
                      <ResponsiveContainer>
                        <BarChart data={dadosBarraCarteira} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                          <XAxis dataKey="nome" stroke="#9d8fc4" tick={{ fill: "#c4b5fd", fontSize: 11 }} />
                          <YAxis stroke="#9d8fc4" tick={{ fill: "#c4b5fd", fontSize: 11 }} tickFormatter={(v) => formatBRL(v)} width={70} />
                          <Tooltip contentStyle={{ background: "#1e1533", border: "1px solid #4c3a7a", borderRadius: 10, color: "#f3e8ff" }} formatter={(value) => formatBRLPreciso(value)} />
                          <Legend wrapperStyle={{ color: "#c4b5fd", fontSize: 12 }} />
                          <Bar dataKey="Total investido" fill="#4c3a7a" radius={[6, 6, 0, 0]} />
                          <Bar dataKey="Saldo líquido" fill="#a78bfa" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </section>
                </div>

                {/* Line chart */}
                <section style={styles.card}>
                  <h2 style={styles.cardTitle}>Evolução de cada posição desde o início</h2>
                  <p style={styles.cardSubtitle}>Saldo líquido mês a mês, desde a data em que cada investimento foi feito</p>
                  <div style={{ width: "100%", height: 340 }}>
                    <ResponsiveContainer>
                      <LineChart data={dadosLinhaCarteira} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="mes" stroke="#9d8fc4" tick={{ fill: "#c4b5fd", fontSize: 11 }} />
                        <YAxis stroke="#9d8fc4" tick={{ fill: "#c4b5fd", fontSize: 11 }} tickFormatter={(v) => formatBRL(v)} width={80} />
                        <Tooltip contentStyle={{ background: "#1e1533", border: "1px solid #4c3a7a", borderRadius: 10, color: "#f3e8ff" }} formatter={(value) => formatBRLPreciso(value)} />
                        <Legend wrapperStyle={{ color: "#c4b5fd", fontSize: 12 }} />
                        {posicoesCalc.map((p) => (
                          <Line key={p.uid} type="monotone" dataKey={p.label} stroke={p.inv.cor} strokeWidth={2.5} dot={false} connectNulls={false} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              </>
            )}
          </>
        )}

        {aba === "ia" && (
          <>
            <section style={styles.iaHero}>
              <div style={styles.iaHeroIcon}>✦</div>
              <div>
                <h2 style={styles.iaHeroTitle}>Assistente IA</h2>
                <p style={styles.iaHeroSubtitle}>
                  Análise automática com base nas taxas atuais, alíquota de IR e liquidez de cada produto.
                  A IA compara os planos e sugere o melhor investimento para cada horizonte de tempo.
                </p>
              </div>
            </section>

            <section style={styles.card}>
              <h2 style={styles.cardTitle}>Seus dados para análise</h2>
              <div style={styles.inputsGrid}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Valor inicial</label>
                  <div style={styles.inputWrapper}>
                    <span style={styles.prefix}>R$</span>
                    <input type="number" min="0" step="50" value={iaValorInicial} onChange={(e) => setIaValorInicial(Number(e.target.value) || 0)} style={styles.input} />
                  </div>
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Aporte mensal</label>
                  <div style={styles.inputWrapper}>
                    <span style={styles.prefix}>R$</span>
                    <input type="number" min="0" step="10" value={iaAporteMensal} onChange={(e) => setIaAporteMensal(Number(e.target.value) || 0)} style={styles.input} />
                  </div>
                </div>
              </div>
            </section>

            <div style={styles.iaGrid}>
              {sugestoesIA.map(({ prazo, melhor, confianca, raciocinio, alternativas }) => (
                <section key={prazo.id} style={{ ...styles.iaCard, borderColor: prazo.cor }}>
                  <div style={styles.iaCardHeader}>
                    <span style={styles.iaCardIcon}>{prazo.icone}</span>
                    <div style={{ flex: 1 }}>
                      <span style={{ ...styles.iaPrazoTag, borderColor: prazo.cor, color: prazo.cor }}>{prazo.nome}</span>
                      <h3 style={styles.iaCardTitle}>{melhor.nome}</h3>
                      <p style={styles.iaCardPrazo}>{prazo.prazoLabel} · {prazo.meses} meses simulados</p>
                    </div>
                    <div style={styles.iaConfianca}>
                      <span style={styles.iaConfiancaValor}>{confianca}%</span>
                      <span style={styles.iaConfiancaLabel}>confiança</span>
                    </div>
                  </div>

                  <p style={styles.iaAlocacao}>Alocação: {descreverAlocacao(melhor.alocacoes)}</p>
                  <p style={styles.investDescricao}>{melhor.descricao}</p>

                  <div style={styles.iaResultados}>
                    <div style={styles.iaResultadoItem}>
                      <span style={styles.resultadoLabel}>Total investido</span>
                      <span style={styles.resultadoValor}>{formatBRL(melhor.resultado.totalInvestido)}</span>
                    </div>
                    <div style={styles.iaResultadoItem}>
                      <span style={styles.resultadoLabel}>Saldo líquido projetado</span>
                      <span style={{ ...styles.resultadoValor, color: prazo.cor, fontSize: 18 }}>{formatBRL(melhor.resultado.liquidoFinal)}</span>
                    </div>
                    <div style={styles.iaResultadoItem}>
                      <span style={styles.resultadoLabel}>Rendimento líquido</span>
                      <span style={{ ...styles.resultadoValor, color: "#34d399" }}>+ {formatBRL(melhor.resultado.jurosLiquidos)}</span>
                    </div>
                  </div>

                  <div style={styles.iaRaciocinio}>
                    <span style={styles.iaRaciocinioLabel}>✦ Análise da IA</span>
                    <p style={styles.iaRaciocinioTexto}>{raciocinio}</p>
                  </div>

                  <div style={styles.iaAlternativas}>
                    <span style={styles.iaAlternativasLabel}>Outras opções analisadas</span>
                    {alternativas.map((alt, i) => (
                      <div key={alt.id} style={styles.iaAlternativaRow}>
                        <span style={styles.iaAlternativaPos}>{i + 1}º</span>
                        <span style={styles.iaAlternativaNome}>{alt.nome}</span>
                        <span style={styles.iaAlternativaValor}>{formatBRL(alt.resultado.liquidoFinal)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <p style={styles.iaAviso}>
              As sugestões da IA são calculadas automaticamente com base nas simulações acima — não substituem orientação financeira personalizada.
            </p>
          </>
        )}

        <footer style={styles.footer} className="no-print">
          Simulação com fins educativos. Taxas são estimativas e podem mudar conforme decisões do Copom. Poupança, CDB, Tesouro Selic e LCI/LCA são considerados investimentos de baixo risco no Brasil, protegidos pelo FGC (até R$ 250 mil por CPF/instituição) ou pelo Tesouro Nacional. Este simulador não é uma recomendação de investimento personalizada.
        </footer>
      </div>

      {planoAtivo && (
        <div className="print-only" style={printStyles.page}>
          <div style={printStyles.header}>
            <h1 style={printStyles.title}>Plano de Investimento</h1>
            <p style={printStyles.subtitle}>Objetivo: {objetivoAtual?.nome} · Gerado em {new Date().toLocaleDateString("pt-BR")}</p>
          </div>

          <h2 style={printStyles.h2}>Dados informados</h2>
          <table style={printStyles.tableSimple}>
            <tbody>
              <tr><td style={printStyles.tdLabel}>Valor inicial</td><td style={printStyles.td}>{formatBRLPreciso(planoValorInicial)}</td></tr>
              <tr><td style={printStyles.tdLabel}>Aporte mensal</td><td style={printStyles.td}>{formatBRLPreciso(planoAporteMensal)}</td></tr>
              <tr><td style={printStyles.tdLabel}>Prazo</td><td style={printStyles.td}>{planoMeses} meses</td></tr>
              <tr><td style={printStyles.tdLabel}>Precisa de liquidez total</td><td style={printStyles.td}>{planoLiquidez ? "Sim" : "Não"}</td></tr>
            </tbody>
          </table>

          <h2 style={printStyles.h2}>Plano recomendado: {planoAtivo.nome}</h2>
          <p style={printStyles.p}>{planoAtivo.descricao}</p>
          <p style={printStyles.p}><strong>Alocação:</strong> {descreverAlocacao(planoAtivo.alocacoes)}</p>
          <p style={printStyles.p}><strong>Taxa média ponderada:</strong> {formatPercent(planoAtivo.resultado.taxaMediaPonderada)} a.a.</p>

          <h2 style={printStyles.h2}>Opções consideradas</h2>
          <table style={printStyles.tableSimple}>
            <thead><tr><th style={printStyles.th}>Plano</th><th style={printStyles.th}>Alocação</th><th style={printStyles.th}>Total investido</th><th style={printStyles.th}>Saldo líquido final</th><th style={printStyles.th}>Rendimento líquido</th></tr></thead>
            <tbody>
              {candidatosPlano.map((c) => (
                <tr key={c.id}>
                  <td style={printStyles.td}>{c.nome}{c.recomendado ? " ★" : ""}</td>
                  <td style={printStyles.td}>{descreverAlocacao(c.alocacoes)}</td>
                  <td style={printStyles.td}>{formatBRLPreciso(c.resultado.totalInvestido)}</td>
                  <td style={printStyles.td}>{formatBRLPreciso(c.resultado.liquidoFinal)}</td>
                  <td style={printStyles.td}>{formatBRLPreciso(c.resultado.jurosLiquidos)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 style={printStyles.h2}>Evolução mês a mês — {planoAtivo.nome} (primeiros {Math.min(6, planoMeses)} meses)</h2>
          <table style={printStyles.tableSimple}>
            <thead><tr><th style={printStyles.th}>Mês</th><th style={printStyles.th}>Total investido</th><th style={printStyles.th}>Saldo bruto</th><th style={printStyles.th}>Saldo líquido</th></tr></thead>
            <tbody>
              {linhasTabelaMensal(planoAtivo.resultado, planoMeses).map((l) => (
                <tr key={l.mes} style={l.final ? printStyles.trFinal : undefined}>
                  <td style={printStyles.td}>{l.final ? `Mês ${l.mes} (final)` : `Mês ${l.mes}`}</td>
                  <td style={printStyles.td}>{formatBRLPreciso(l.totalInvestido)}</td>
                  <td style={printStyles.td}>{formatBRLPreciso(l.saldoBruto)}</td>
                  <td style={printStyles.td}>{formatBRLPreciso(l.liquidoAcumulado)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 style={printStyles.h2}>Resultado final — mês {planoMeses}</h2>
          <table style={printStyles.tableSimple}>
            <tbody>
              <tr><td style={printStyles.tdLabel}>Total investido</td><td style={printStyles.td}>{formatBRLPreciso(planoAtivo.resultado.totalInvestido)}</td></tr>
              <tr><td style={printStyles.tdLabel}>Saldo bruto</td><td style={printStyles.td}>{formatBRLPreciso(planoAtivo.resultado.saldoBrutoFinal)}</td></tr>
              <tr><td style={printStyles.tdLabel}>Saldo líquido</td><td style={printStyles.td}>{formatBRLPreciso(planoAtivo.resultado.liquidoFinal)}</td></tr>
              <tr><td style={printStyles.tdLabel}>Rendimento líquido</td><td style={printStyles.td}>{formatBRLPreciso(planoAtivo.resultado.jurosLiquidos)} ({formatPercent((planoAtivo.resultado.jurosLiquidos / planoAtivo.resultado.totalInvestido) * 100)})</td></tr>
            </tbody>
          </table>

          <p style={printStyles.footer}>Simulação com fins educativos, gerada automaticamente. Taxas são estimativas e podem mudar conforme decisões do Copom. Não constitui recomendação de investimento personalizada.</p>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "radial-gradient(circle at 20% 0%, #2a1d4d 0%, #17102b 45%, #0f0a1e 100%)", color: "#f3e8ff", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: "24px 16px 60px" },
  container: { maxWidth: 1080, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 },
  headerLeft: { display: "flex", alignItems: "center", gap: 14 },
  logoMark: { width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #a78bfa, #6d28d9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, boxShadow: "0 0 24px rgba(167,139,250,0.4)" },
  title: { fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: -0.3 },
  subtitle: { margin: 0, fontSize: 13, color: "#a996d6" },
  headerBadge: { background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.35)", borderRadius: 999, padding: "8px 16px", fontSize: 13, color: "#d8c9fb" },
  tabBar: { display: "flex", gap: 8, background: "rgba(255,255,255,0.04)", padding: 6, borderRadius: 14, width: "fit-content", flexWrap: "wrap" },
  tabButton: { border: "none", background: "transparent", color: "#b8a8e0", fontSize: 13.5, fontWeight: 600, padding: "9px 18px", borderRadius: 10, cursor: "pointer" },
  tabButtonActive: { background: "linear-gradient(135deg, #a78bfa, #7c3aed)", color: "#fff" },
  tabButtonIA: { color: "#c4b5fd" },
  iaHero: { display: "flex", alignItems: "flex-start", gap: 16, background: "linear-gradient(135deg, rgba(167,139,250,0.18), rgba(109,40,217,0.12))", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 20, padding: "20px 24px" },
  iaHeroIcon: { width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, #a78bfa, #6d28d9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0, boxShadow: "0 0 20px rgba(167,139,250,0.45)" },
  iaHeroTitle: { margin: 0, fontSize: 18, fontWeight: 700 },
  iaHeroSubtitle: { margin: "6px 0 0", fontSize: 13, color: "#b8a8e0", lineHeight: 1.55 },
  iaGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 },
  iaCard: { background: "rgba(30, 21, 51, 0.85)", border: "1.5px solid", borderRadius: 20, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 12 },
  iaCardHeader: { display: "flex", alignItems: "flex-start", gap: 12 },
  iaCardIcon: { fontSize: 24, lineHeight: 1 },
  iaPrazoTag: { display: "inline-block", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, border: "1px solid", borderRadius: 999, padding: "2px 8px", marginBottom: 6 },
  iaCardTitle: { margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.3 },
  iaCardPrazo: { margin: "4px 0 0", fontSize: 11.5, color: "#8878b0" },
  iaConfianca: { display: "flex", flexDirection: "column", alignItems: "center", background: "rgba(167,139,250,0.12)", borderRadius: 12, padding: "8px 12px", flexShrink: 0 },
  iaConfiancaValor: { fontSize: 18, fontWeight: 800, color: "#c4b5fd" },
  iaConfiancaLabel: { fontSize: 9.5, color: "#8878b0", textTransform: "uppercase", letterSpacing: 0.4 },
  iaAlocacao: { margin: 0, fontSize: 12, color: "#c4b5fd", fontWeight: 600 },
  iaResultados: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, background: "rgba(255,255,255,0.03)", borderRadius: 14, padding: "12px 14px" },
  iaResultadoItem: { display: "flex", flexDirection: "column", gap: 4 },
  iaRaciocinio: { background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 14, padding: "12px 14px" },
  iaRaciocinioLabel: { display: "block", fontSize: 10.5, fontWeight: 700, color: "#c4b5fd", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  iaRaciocinioTexto: { margin: 0, fontSize: 12.5, color: "#d8c9fb", lineHeight: 1.55 },
  iaAlternativas: { borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 },
  iaAlternativasLabel: { fontSize: 10.5, color: "#8878b0", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 2 },
  iaAlternativaRow: { display: "flex", alignItems: "center", gap: 8, fontSize: 12 },
  iaAlternativaPos: { color: "#6f6094", fontWeight: 700, width: 22, flexShrink: 0 },
  iaAlternativaNome: { flex: 1, color: "#b8a8e0" },
  iaAlternativaValor: { color: "#c4b5fd", fontWeight: 600, fontSize: 11.5 },
  iaAviso: { fontSize: 11.5, color: "#6f6094", textAlign: "center", lineHeight: 1.5, margin: 0 },
  card: { background: "rgba(30, 21, 51, 0.7)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "22px 24px", boxShadow: "0 10px 40px rgba(0,0,0,0.25)", backdropFilter: "blur(6px)" },
  cardTitle: { fontSize: 16, fontWeight: 600, margin: "0 0 4px" },
  cardSubtitle: { fontSize: 12.5, color: "#9d8fc4", margin: "0 0 12px" },
  inputsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20, marginTop: 8 },
  inputGroup: { display: "flex", flexDirection: "column", gap: 8 },
  label: { fontSize: 12.5, color: "#b8a8e0", fontWeight: 500 },
  inputWrapper: { display: "flex", alignItems: "center", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "10px 14px", gap: 8 },
  prefix: { color: "#9d8fc4", fontSize: 14 },
  suffix: { color: "#9d8fc4", fontSize: 12 },
  input: { background: "transparent", border: "none", outline: "none", color: "#f3e8ff", fontSize: 15, fontWeight: 600, width: "100%" },
  slider: { width: "100%", accentColor: "#a78bfa" },
  investCardsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 },
  investCard: { background: "rgba(30, 21, 51, 0.7)", border: "1.5px solid", borderRadius: 18, padding: 18, cursor: "pointer", transition: "all 0.15s ease", display: "flex", flexDirection: "column", gap: 12 },
  investCardHeader: { display: "flex", alignItems: "center", gap: 8 },
  investDot: { width: 10, height: 10, borderRadius: "50%", flexShrink: 0 },
  investNome: { fontSize: 14.5, fontWeight: 700, flex: 1 },
  tagIsento: { fontSize: 10, background: "rgba(52,211,153,0.15)", color: "#34d399", padding: "2px 8px", borderRadius: 999, fontWeight: 600 },
  tagRecomendado: { fontSize: 10, background: "rgba(167,139,250,0.2)", color: "#c4b5fd", padding: "3px 9px", borderRadius: 999, fontWeight: 700, whiteSpace: "nowrap" },
  avisoLiquidez: { fontSize: 11, color: "#fbbf24", margin: 0, lineHeight: 1.4 },
  investDescricao: { fontSize: 12, color: "#9d8fc4", margin: 0, lineHeight: 1.4 },
  taxaRow: { display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "6px 10px" },
  taxaLabel: { fontSize: 11.5, color: "#b8a8e0" },
  taxaInput: { background: "transparent", border: "none", outline: "none", color: "#f3e8ff", fontSize: 13, fontWeight: 700, width: 56, textAlign: "right" },
  investResultado: { display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 10 },
  resultadoLabel: { display: "block", fontSize: 10.5, color: "#8878b0", textTransform: "uppercase", letterSpacing: 0.4 },
  resultadoValor: { display: "block", fontSize: 14, fontWeight: 700 },
  objetivoGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 },
  objetivoCard: { border: "1.5px solid", borderRadius: 14, padding: "14px 16px", cursor: "pointer", display: "flex", flexDirection: "column", gap: 4 },
  objetivoNome: { fontSize: 13.5, fontWeight: 700 },
  objetivoAjuda: { fontSize: 11.5, color: "#9d8fc4" },
  toggleGroup: { display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" },
  toggleButton: { border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "#c9bce6", fontSize: 12.5, fontWeight: 600, padding: "10px 16px", borderRadius: 12, cursor: "pointer" },
  toggleButtonActive: { background: "linear-gradient(135deg, #a78bfa, #7c3aed)", color: "#fff", border: "1px solid transparent" },
  detalheHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 8 },
  exportButton: { background: "linear-gradient(135deg, #a78bfa, #7c3aed)", color: "#fff", border: "none", borderRadius: 12, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" },
  subTitulo: { fontSize: 13.5, fontWeight: 700, color: "#d8c9fb", margin: "18px 0 10px" },
  tableWrap: { overflowX: "auto", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12.5 },
  th: { textAlign: "left", padding: "10px 14px", color: "#9d8fc4", fontWeight: 600, background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  td: { padding: "9px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "#e4d9fb" },
  trFinal: { background: "rgba(167,139,250,0.1)" },
  resumoFinalGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 },
  resumoFinalCard: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6 },
  resumoFinalValor: { fontSize: 17, fontWeight: 700 },
  footer: { fontSize: 11.5, color: "#6f6094", textAlign: "center", lineHeight: 1.6, padding: "8px 20px 0" },

  // Dashboard specific
  paletteRow: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 },
  paletteChip: { display: "flex", alignItems: "center", gap: 8, border: "1.5px solid", borderRadius: 999, padding: "8px 10px 8px 14px", cursor: "grab", background: "rgba(255,255,255,0.03)", fontSize: 12.5, fontWeight: 600 },
  addChipButton: { border: "none", background: "rgba(167,139,250,0.2)", color: "#c4b5fd", width: 22, height: 22, borderRadius: "50%", fontSize: 14, fontWeight: 700, cursor: "pointer", lineHeight: "22px", padding: 0 },
  dropZone: { border: "2px dashed", borderRadius: 18, padding: 18, transition: "all 0.15s ease" },
  emptyState: { fontSize: 13, color: "#8878b0", textAlign: "center", padding: "30px 10px" },
  posicoesGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 },
  posicaoCard: { background: "rgba(20,14,38,0.7)", border: "1.5px solid", borderRadius: 16, padding: 14, cursor: "grab", display: "flex", flexDirection: "column", gap: 10 },
  posicaoHeader: { display: "flex", alignItems: "center", gap: 8 },
  dragHandle: { color: "#6f6094", fontSize: 14, cursor: "grab" },
  apelidoInput: { flex: 1, background: "transparent", border: "none", outline: "none", color: "#f3e8ff", fontSize: 13.5, fontWeight: 700 },
  removeButton: { border: "none", background: "rgba(248,113,113,0.15)", color: "#f87171", width: 22, height: 22, borderRadius: "50%", fontSize: 14, fontWeight: 700, cursor: "pointer", lineHeight: "20px", padding: 0 },
  posicaoInputsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  miniInputGroup: { display: "flex", flexDirection: "column", gap: 4, gridColumn: "span 1" },
  miniLabel: { fontSize: 10.5, color: "#8878b0" },
  posicaoResultado: { display: "flex", flexDirection: "column", gap: 2, borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 8 },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 },
  kpiCard: { background: "rgba(30, 21, 51, 0.7)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6 },
  kpiValor: { fontSize: 17, fontWeight: 700 },
  destaqueMelhor: { fontSize: 12.5, color: "#d8c9fb", background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.25)", borderRadius: 14, padding: "12px 16px", margin: 0 },
  duasColunas: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 },
};

const printStyles = {
  page: { background: "#ffffff", color: "#1a1a1a", fontFamily: "Georgia, 'Times New Roman', serif", padding: "20px 10px", maxWidth: 760, margin: "0 auto" },
  header: { borderBottom: "2px solid #4c3a7a", paddingBottom: 12, marginBottom: 16 },
  title: { fontSize: 24, margin: 0, color: "#2a1d4d" },
  subtitle: { fontSize: 12, margin: "4px 0 0", color: "#555" },
  h2: { fontSize: 15, color: "#4c3a7a", margin: "22px 0 8px", borderBottom: "1px solid #ddd", paddingBottom: 4 },
  p: { fontSize: 12.5, lineHeight: 1.6, margin: "4px 0" },
  tableSimple: { width: "100%", borderCollapse: "collapse", fontSize: 11.5 },
  th: { textAlign: "left", padding: "6px 8px", background: "#f1eefb", borderBottom: "1px solid #ccc" },
  td: { padding: "6px 8px", borderBottom: "1px solid #eee" },
  tdLabel: { padding: "6px 8px", borderBottom: "1px solid #eee", color: "#555", width: "40%" },
  trFinal: { background: "#f1eefb", fontWeight: "bold" },
  footer: { fontSize: 10, color: "#777", marginTop: 24, lineHeight: 1.5, borderTop: "1px solid #ddd", paddingTop: 10 },
};

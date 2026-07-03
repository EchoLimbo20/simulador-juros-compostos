# Simulador de Juros Compostos

Aplicação web em React para **simular, comparar e planejar investimentos de baixo risco** no Brasil — poupança, CDB, Tesouro Selic e LCI/LCA — com cálculo de juros compostos, Imposto de Renda regressivo e sugestões automáticas por prazo.

> Projeto educativo. As taxas são estimativas configuráveis e **não constituem recomendação de investimento personalizada**.

---

## Funcionalidades

### Simulador
- Compare até 4 tipos de investimento lado a lado
- Informe valor inicial, aporte mensal e período (em meses)
- Ajuste as taxas anuais de cada produto
- Veja saldo bruto, saldo **líquido** (já com IR) e juros ganhos
- Gráficos de barras: comparativo final e evolução mês a mês

### Plano de investimento
- Escolha o objetivo: reserva de emergência, curto, médio ou longo prazo
- Indique se precisa de liquidez total
- Receba opções de alocação ranqueadas por rentabilidade líquida
- Detalhamento mês a mês e exportação para PDF (via impressão do navegador)

### Dashboard (Carteira)
- Monte sua carteira arrastando investimentos
- Acompanhe saldo líquido, ganho diário/semanal/mensal e rentabilidade
- Gráficos de pizza, barras e linha por posição

### IA (Sugestão automática)
- Análise automática para **curto** (até 12 meses), **médio** (1–3 anos) e **longo** (3+ anos)
- Compara planos com base em liquidez, IR e rendimento líquido simulado
- Exibe raciocínio explicativo, ranking de alternativas e score de confiança

> A aba **IA** usa regras e simulações matemáticas — não é um modelo de linguagem externo (ChatGPT, etc.).

---

## Investimentos considerados

| Produto        | IR        | Liquidez típica | Proteção              |
|----------------|-----------|-----------------|------------------------|
| Poupança       | Isento    | Diária          | FGC (até R$ 250 mil)   |
| CDB 100% CDI   | Regressivo| Diária*         | FGC (até R$ 250 mil)   |
| Tesouro Selic  | Regressivo| D+1             | Tesouro Nacional       |
| LCI/LCA        | Isento    | ~90 dias        | FGC (até R$ 250 mil)   |

\* Confirme a liquidez com a sua instituição.

**Selic de referência:** 14,25% a.a. (jun/2026 — editável no simulador)

---

## Tecnologias

- [React 18](https://react.dev/)
- [Vite 6](https://vitejs.dev/)
- [Recharts](https://recharts.org/) — gráficos interativos
- JavaScript (JSX), sem backend

---

## Como rodar localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/) 18+ (recomendado 20+)

### Instalação

```bash
git clone https://github.com/EchoLimbo20/simulador-juros-compostos.git
cd simulador-juros-compostos
npm install
npm run dev
```

Abra no navegador: **http://127.0.0.1:5173**

### Outros comandos

```bash
npm run build    # gera a versão de produção em dist/
npm run preview  # visualiza o build de produção
```

---

## Estrutura do projeto

```
simulador-juros-compostos/
├── index.html          # entrada HTML
├── vite.config.js      # configuração do Vite
├── package.json
├── src/
│   ├── main.jsx        # bootstrap React
│   └── App.jsx         # componente principal (simulador, plano, dashboard, IA)
└── README.md
```

---

## Como funciona o cálculo

1. **Juros compostos mensais:** taxa anual convertida para taxa mensal equivalente
2. **Aportes:** valor inicial + aporte mensal recorrente
3. **IR regressivo** (CDB e Tesouro Selic):
   - Até 180 dias: 22,5%
   - 181–360 dias: 20%
   - 361–720 dias: 17,5%
   - Acima de 720 dias: 15%
4. **Produtos isentos** (Poupança, LCI/LCA): saldo líquido = saldo bruto

---

## Autora

**Luiza Marialva** — [GitHub @EchoLimbo20](https://github.com/EchoLimbo20)

---

## Licença

Uso livre para fins educacionais. Consulte um profissional certificado antes de tomar decisões financeiras reais.
# simulador-juros-compostos

/* =========================================================
   SCRIPT.JS - ENGINE MULTIFATORIAL E EXPORTAÇÃO ULTRA COMPACTA
========================================================= */

let lotteryData = [];
let analysisResult = null;
let probChart = null;

const LOTTERY_CONFIG = {
    mega: { maxNumber: 60, minPick: 6, maxPick: 15, defaultPick: 6, cols: 10, minSoma: 140, maxSoma: 240 },
    quina: { maxNumber: 80, minPick: 5, maxPick: 15, defaultPick: 5, cols: 10, minSoma: 160, maxSoma: 245 },
    lotofacil: { maxNumber: 25, minPick: 15, maxPick: 20, defaultPick: 15, cols: 5, minSoma: 165, maxSoma: 220 }
};

// BLINDAGEM DE CÓDIGO CONTRA INSPEÇÃO
(function aplicarSeguranca() {
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('keydown', e => {
        if (e.keyCode === 123 || (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74)) || (e.ctrlKey && e.keyCode === 85)) {
            e.preventDefault(); return false;
        }
    });
})();

document.addEventListener("DOMContentLoaded", () => {
    setupLotteryOptions(); setupWeightSliders(); setupButtons(); setupFileInput();
});

function setupLotteryOptions() {
    const lotterySelect = document.getElementById("lotteryType");
    const numPick = document.getElementById("numerosPorJogo");
    if (!lotterySelect || !numPick) return;
    updateNumPickOptions();
    lotterySelect.addEventListener("change", () => {
        updateNumPickOptions();
        const tipoAtualEl = document.getElementById("tipoAtual");
        const printTitleTarget = document.getElementById("printTitleTarget");
        if (tipoAtualEl) {
            const nomeLoteria = lotterySelect.options[lotterySelect.selectedIndex].text;
            tipoAtualEl.textContent = nomeLoteria;
            if (printTitleTarget) printTitleTarget.textContent = nomeLoteria;
        }
    });

    function updateNumPickOptions() {
        const config = LOTTERY_CONFIG[lotterySelect.value]; if (!config) return;
        numPick.innerHTML = "";
        for (let i = config.minPick; i <= config.maxPick; i++) {
            const option = document.createElement("option");
            option.value = i; option.textContent = `${i} núm.`;
            if (i === config.defaultPick) option.selected = true;
            numPick.appendChild(option);
        }
    }
}

function setupWeightSliders() {
    const sliders = ["pesoFreq", "pesoRec", "pesoForca", "pesoCluster", "pesoCooc"];
    sliders.forEach(id => {
        const slider = document.getElementById(id);
        const valueLabel = document.getElementById(id.replace("peso", "").toLowerCase() + "Value");
        if (!slider || !valueLabel) return;
        slider.addEventListener("input", () => { valueLabel.textContent = slider.value + "%"; });
    });
}

function setupButtons() {
    if (document.getElementById("analyzeBtn")) document.getElementById("analyzeBtn").addEventListener("click", () => analyzeData(false));
    if (document.getElementById("generateBtn")) document.getElementById("generateBtn").addEventListener("click", generateGames);
    if (document.getElementById("exportBtn")) document.getElementById("exportBtn").addEventListener("click", exportGames);
    if (document.getElementById("injectBtn")) document.getElementById("injectBtn").addEventListener("click", injetarUltimoJogo);
    
    if (document.getElementById("printBtn")) document.getElementById("printBtn").addEventListener("click", () => window.print());
    if (document.getElementById("whatsBtn")) document.getElementById("whatsBtn").addEventListener("click", dispararWhatsApp);
    if (document.getElementById("emailBtn")) document.getElementById("emailBtn").addEventListener("click", dispararEmail);
}

function setupFileInput() {
    const fileInput = document.getElementById("csvFile");
    if (fileInput) fileInput.addEventListener("change", handleCSVFile);
}

function handleCSVFile(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            lotteryData = parseCSV(e.target.result);
            if (!lotteryData || lotteryData.length === 0) { document.getElementById("statusSistema").textContent = "Erro no CSV"; return; }
            document.getElementById("totalConcursos").textContent = lotteryData.length;
            
            if (lotteryData.length > 0) {
                document.getElementById("lastDrawNumbers").value = lotteryData[lotteryData.length - 1].join(", ");
            }
            
            document.getElementById("statusSistema").textContent = "CSV Carregado";
            analysisResult = null; 
        } catch (error) { document.getElementById("statusSistema").textContent = "Erro Crítico"; }
    };
    reader.readAsText(file, "UTF-8");
}

function parseCSV(csvText) {
    const lines = csvText.split(/\r?\n/); const result = [];
    const config = LOTTERY_CONFIG[document.getElementById("lotteryType").value];
    lines.forEach(line => {
        if (!line.trim()) return;
        let cols = line.split(";").length > 1 ? line.split(";") : line.split(",");
        const numbers = cols.map(c => Number(c.trim())).filter(n => !isNaN(n) && n >= 1 && n <= config.maxNumber);
        if (numbers.length >= config.minPick) result.push([...new Set(numbers)].sort((a, b) => a - b));
    });
    return result.reverse(); 
}

function injetarUltimoJogo() {
    const config = LOTTERY_CONFIG[document.getElementById("lotteryType").value];
    const lastDrawInput = document.getElementById("lastDrawNumbers")?.value || "";
    let novosNumeros = lastDrawInput.split(",").map(n => Number(n.trim())).filter(n => !isNaN(n) && n >= 1 && n <= config.maxNumber);
    if (novosNumeros.length < config.minPick) { alert(`Insira a quantidade correta de números.`); return; }
    novosNumeros.sort((a, b) => a - b);
    
    lotteryData.push(novosNumeros);
    document.getElementById("totalConcursos").textContent = lotteryData.length;
    analysisResult = null; 
    alert("Concurso Injetado!");
}

function analyzeData(silencioso = false) {
    if (lotteryData.length === 0) { 
        if (!silencioso) alert("Carregue uma base de dados antes de executar a análise."); 
        return false; 
    }
    const config = LOTTERY_CONFIG[document.getElementById("lotteryType").value];
    const maxNumber = config.maxNumber;
    let ultimoJogoManual = lotteryData[lotteryData.length - 1];

    const weights = {
        freq: Number(document.getElementById("pesoFreq")?.value || 30),
        recency: Number(document.getElementById("pesoRec")?.value || 25),
        recent: Number(document.getElementById("pesoForca")?.value || 20),
        cluster: Number(document.getElementById("pesoCluster")?.value || 15),
        cooc: Number(document.getElementById("pesoCooc")?.value || 10)
    };
    const totalW = weights.freq + weights.recency + weights.recent + weights.cluster + weights.cooc || 1;
    Object.keys(weights).forEach(k => weights[k] /= totalW);

    const frequency = Array(maxNumber + 1).fill(0); const recency = Array(maxNumber + 1).fill(0);
    const recentForce = Array(maxNumber + 1).fill(0); const cooc = Array(maxNumber + 1).fill(0);
    const markovTransitions = Array(maxNumber + 1).fill(0); const probabilities = Array(maxNumber + 1).fill(0);

    lotteryData.forEach(draw => draw.forEach(num => { if (num <= maxNumber) frequency[num]++; }));
    for (let n = 1; n <= maxNumber; n++) {
        let atraso = 0;
        for (let i = lotteryData.length - 1; i >= 0; i--) { if (lotteryData[i].includes(n)) break; atraso++; }
        recency[n] = atraso;
    }
    lotteryData.slice(-20).forEach(draw => draw.forEach(num => { if (num <= maxNumber) recentForce[num]++; }));
    lotteryData.forEach(draw => draw.forEach(a => draw.forEach(b => { if (a !== b && a <= maxNumber) cooc[a]++; })));

    if (ultimoJogoManual && ultimoJogoManual.length > 0) {
        for (let i = 0; i < lotteryData.length - 1; i++) {
            let interseccao = lotteryData[i].filter(n => ultimoJogoManual.includes(n));
            if (interseccao.length > 0) lotteryData[i + 1].forEach(num => { if (num <= maxNumber) markovTransitions[num] += interseccao.length; });
        }
    }

    const fMax = Math.max(...frequency.slice(1)) || 1; const rMax = Math.max(...recency.slice(1)) || 1;
    const rfMax = Math.max(...recentForce.slice(1)) || 1; const cMax = Math.max(...cooc.slice(1)) || 1;
    const mMax = Math.max(...markovTransitions.slice(1)) || 1;

    for (let n = 1; n <= maxNumber; n++) {
        let score = (frequency[n]/fMax * weights.freq) + (recency[n]/rMax * weights.recency) + (recentForce[n]/rfMax * weights.recent) + (((n-1)%10)/9 * weights.cluster) + (cooc[n]/cMax * weights.cooc);
        if (ultimoJogoManual && ultimoJogoManual.length > 0) score = (score * 0.75) + ((markovTransitions[n]/mMax || 0) * 0.25);
        probabilities[n] = Number((score * 100).toFixed(2));
    }

    analysisResult = { frequency, recency, probabilities };
    renderTopNumbers(); renderRadarAtraso(maxNumber); renderChart(maxNumber); renderMetrics(maxNumber);
    
    const lotterySelect = document.getElementById("lotteryType");
    const printTitleTarget = document.getElementById("printTitleTarget");
    if (lotterySelect && printTitleTarget) {
        printTitleTarget.textContent = lotterySelect.options[lotterySelect.selectedIndex].text;
    }
    return true;
}

function renderRadarAtraso(maxNumber) {
    const container = document.getElementById("radarAtrasoContainer"); if (!container) return; container.innerHTML = "";
    const arr = []; for (let i = 1; i <= maxNumber; i++) arr.push({ n: i, a: analysisResult.recency[i] });
    arr.sort((a, b) => b.a - a.a);
    arr.slice(0, 10).forEach(item => {
        const row = document.createElement("div"); row.className = "atraso-row";
        row.innerHTML = `<div class="flex items-center gap-3"><span class="atraso-ball">${String(item.n).padStart(2, '0')}</span><span class="text-slate-300 font-medium">${item.a === 0 ? 'Recente' : 'Atrasado ' + item.a + ' c.'}</span></div>`;
        container.appendChild(row);
    });
}

function renderTopNumbers() {
    const container = document.getElementById("topNumbers"); if (!container) return; container.innerHTML = "";
    const arr = []; for (let i = 1; i < analysisResult.probabilities.length; i++) arr.push({ n: i, p: analysisResult.probabilities[i] });
    arr.sort((a, b) => b.p - a.p);
    arr.slice(0, 12).forEach(item => {
        const ball = document.createElement("div"); ball.className = "number-ball";
        ball.innerHTML = `${String(item.n).padStart(2, '0')}<small>${item.p}%</small>`;
        container.appendChild(ball);
    });
}

function renderMetrics(maxNumber) {
    let mP = -1, nF = "-", mA = -1, nA = "-";
    for (let i = 1; i <= maxNumber; i++) {
        if (analysisResult.probabilities[i] > mP) { mP = analysisResult.probabilities[i]; nF = String(i).padStart(2, '0'); }
        if (analysisResult.recency[i] > mA) { mA = analysisResult.recency[i]; nA = String(i).padStart(2, '0'); }
    }
    document.getElementById("freqMedia").textContent = (lotteryData.length / maxNumber).toFixed(1);
    document.getElementById("maisForte").textContent = nF;
    document.getElementById("maisAtrasado").textContent = `${nA} (${mA} c.)`;
}

function renderChart(maxNumber) {
    const ctx = document.getElementById("probChart"); if (!ctx) return;
    if (probChart) probChart.destroy();
    const labels = []; const data = [];
    for (let i = 1; i <= maxNumber; i++) { labels.push(String(i).padStart(2, '0')); data.push(analysisResult.probabilities[i]); }
    probChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: labels, datasets: [{ label: 'Probabilidade (%)', data: data, backgroundColor: '#10b981', borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#e2e8f0' } } } }
    });
}

function verificarFiltrosCientificos(game, config, bypassFiltros) {
    if (bypassFiltros) return true;

    if (document.getElementById("chkGaussSoma")?.checked) {
        const s = game.reduce((a, b) => a + b, 0); 
        if (s < config.minSoma || s > config.maxSoma) return false;
    }
    if (document.getElementById("chkEntropia")?.checked) {
        let seq = 0; for (let i = 1; i < game.length; i++) { if (game[i] - game[i - 1] === 1) seq++; }
        if (seq > 2) return false;
    }
    return true;
}

function generateGames() {
    const container = document.getElementById("gamesContainer"); if (!container) return;
    
    if (!analysisResult) {
        const analisouComSucesso = analyzeData(true);
        if (!analisouComSucesso) {
            alert("Por favor, carregue um arquivo CSV de histórico válido antes.");
            return;
        }
    }

    container.innerHTML = "";
    
    let numGames = parseInt(document.getElementById("qtdJogos")?.value, 10);
    if (isNaN(numGames) || numGames < 1) numGames = 10;
    if (numGames > 500) numGames = 500; 

    const numPick = Number(document.getElementById("numerosPorJogo").value);
    const config = LOTTERY_CONFIG[document.getElementById("lotteryType").value];
    let exclude = (document.getElementById("excludeNumbers")?.value || "").split(",").map(n => Number(n.trim())).filter(n => !isNaN(n));
    
    let finalPool = []; 
    let maxExecucoes = 0; 
    let forcarAprovacao = false;

    while (finalPool.length < numGames && maxExecucoes < 4000) {
        maxExecucoes++;
        
        if (maxExecucoes > 1000) {
            forcarAprovacao = true;
        }

        let game = [];
        let av = [];
        
        for (let i = 1; i <= config.maxNumber; i++) { 
            if (!exclude.includes(i)) {
                let pBase = analysisResult.probabilities[i] || 50;
                av.push({ n: i, p: pBase + (Math.random() * 30 - 15) }); 
            }
        }
        
        while (game.length < numPick && av.length > 0) {
            av.sort((a, b) => b.p - a.p);
            let limit = Math.min(12 + Math.floor(maxExecucoes / 80), av.length);
            let idx = Math.floor(Math.random() * limit);
            game.push(av[idx].n); 
            av.splice(idx, 1);
        }
        
        game.sort((a, b) => a - b);
        
        if (game.length === numPick && verificarFiltrosCientificos(game, config, forcarAprovacao)) {
            let gameStr = game.join(",");
            let jaExiste = finalPool.some(g => g.join(",") === gameStr);
            
            if (!jaExiste) {
                finalPool.push(game);
                
                const card = document.createElement("div"); 
                card.className = "game-card";
                card.innerHTML = `<div class="game-title">J${finalPool.length}:</div><div class="game-numbers">${game.map(n => `<span class="game-ball">${String(n).padStart(2, '0')}</span>`).join("")}</div>`;
                container.appendChild(card);
            }
        }
    }
    
    const shareHub = document.getElementById("shareHub");
    if (shareHub && finalPool.length > 0) { 
        shareHub.classList.remove("hidden"); 
    }
}

// CONFIGURAÇÃO DE TEXTO LIMPO (COM HÍFENS) EM FONTE EQUIVALENTE A 12 PARA TXT / EMAIL / WHATSAPP
function montarTextoJogosPuro() {
    const container = document.getElementById("gamesContainer"); if (!container) return "";
    let texto = "";
    Array.from(container.querySelectorAll(".game-card")).forEach((card, index) => {
        const numeros = Array.from(card.querySelectorAll(".game-ball"))
                             .map(b => b.textContent.trim())
                             .join("-");
        texto += `J${index + 1} - ${numeros}\n`;
    });
    return texto;
}

function dispararWhatsApp() {
    const texto = montarTextoJogosPuro(); if(!texto) return;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
}

function dispararEmail() {
    const texto = montarTextoJogosPuro(); if(!texto) return;
    const mailtoLink = `mailto:?subject=${encodeURIComponent("Meus Jogos")}&body=${encodeURIComponent(texto)}`;
    window.location.href = mailtoLink;
}

function exportGames() {
    const texto = montarTextoJogosPuro(); if (!texto) return;
    const blob = new Blob([texto], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob);
    link.download = `jogos_carteira.txt`; link.click();
}
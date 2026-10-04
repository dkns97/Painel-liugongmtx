// --- BANCO DE DADOS LOCAL (Simulação) ---
let usuarioLogado = localStorage.getItem('usuarioLogado');
let ordensServico = JSON.parse(localStorage.getItem('ordensServico')) || [];
let modelosIniciais = ["Trator de Esteira LD20D", "Pá Carregadeira 835H", "Escavadeira 922E"];
let modelos = JSON.parse(localStorage.getItem('modelosMaquinas')) || modelosIniciais;

const credenciais = {
    "marcos": "1234",
    "joao": "1234",
    "carlos": "1234",
    "admin": "admin"
};

// --- INICIALIZAÇÃO ---
document.addEventListener("DOMContentLoaded", () => {
    const hoje = new Date();
    document.getElementById('filtroDataExact').value = hoje.toISOString().split('T')[0];
    document.getElementById('filtroDataMes').value = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    alternarFiltroData();
    
    verificarLogin();
    carregarModelos();
});

// --- SISTEMA DE LOGIN ---
function verificarLogin() {
    if (usuarioLogado) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-screen').style.display = 'flex';
        document.getElementById('user-display').innerText = "Mecânico: " + usuarioLogado.toUpperCase();
        atualizarKanban();
        restaurarEstadoBotoes();
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('app-screen').style.display = 'none';
    }
}

window.fazerLogin = function() {
    const usuarioDigitado = document.getElementById('loginUsuario').value.trim().toLowerCase();
    const senhaDigitada = document.getElementById('loginSenha').value;
    const msgErro = document.getElementById('msgErroLogin');

    if (credenciais[usuarioDigitado] && credenciais[usuarioDigitado] === senhaDigitada) {
        localStorage.setItem('usuarioLogado', usuarioDigitado);
        usuarioLogado = usuarioDigitado;
        msgErro.style.display = 'none';
        verificarLogin();
    } else {
        msgErro.style.display = 'block';
    }
}

window.fazerLogout = function() {
    localStorage.removeItem('usuarioLogado');
    usuarioLogado = null;
    document.getElementById('loginUsuario').value = "";
    document.getElementById('loginSenha').value = "";
    verificarLogin();
}

// --- NAVEGAÇÃO DE ABAS ---
window.mostrarAba = function(event, abaId) {
    if (event) event.preventDefault();
    document.querySelectorAll('.aba-conteudo').forEach(aba => aba.classList.remove('ativa'));
    document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active'));
    document.getElementById(abaId).classList.add('ativa');
    if(event) event.currentTarget.classList.add('active');

    if(abaId === 'dashboard') atualizarKanban();
    if(abaId === 'relatorios') gerarRelatorioDesempenho();
}

// --- GERENCIAMENTO DE MODELOS ---
function carregarModelos() {
    const select = document.getElementById('modeloMaquina');
    select.innerHTML = '<option value="">Selecione o equipamento...</option>';
    modelos.forEach(modelo => {
        const option = document.createElement('option');
        option.value = modelo;
        option.textContent = modelo;
        select.appendChild(option);
    });
}

window.adicionarNovoModelo = function() {
    const novoModelo = prompt("Digite o nome do novo equipamento/modelo:");
    if (novoModelo && novoModelo.trim() !== "") {
        modelos.push(novoModelo.trim());
        localStorage.setItem('modelosMaquinas', JSON.stringify(modelos));
        carregarModelos();
        document.getElementById('modeloMaquina').value = novoModelo.trim();
    }
}

// --- CÁLCULO DE ROTAS E GPS (SIMULAÇÃO) ---
window.calcularRotas = function() {
    const saida = document.getElementById('localSaida').value;
    const destino = document.getElementById('localServico').value;
    const inputTempo = document.getElementById('gpsTempo');
    const inputKm = document.getElementById('gpsKm');

    if (saida.trim() !== "" && destino.trim() !== "") {
        inputTempo.value = "...";
        inputKm.value = "...";
        
        setTimeout(() => {
            const kmSimulado = Math.floor(Math.random() * (120 - 15 + 1)) + 15;
            const tempoSimulado = Math.floor(kmSimulado * 1.2); 
            inputKm.value = kmSimulado + " km";
            inputTempo.value = tempoSimulado + " min";
        }, 800);
    } else {
        inputTempo.value = "";
        inputKm.value = "";
    }
}

// --- LÓGICA DE APONTAMENTO E FROTA ---
window.iniciarDeslocamento = function() {
    if(!validarFormularioSaida()) return;

    const novaOs = {
        id: Date.now().toString(),
        numeroOS: document.getElementById('numeroOS').value.toUpperCase(),
        mecanico: usuarioLogado,
        cliente: document.getElementById('nomeCliente').value,
        localSaida: document.getElementById('localSaida').value,
        localServico: document.getElementById('localServico').value,
        gpsKmPrevisto: document.getElementById('gpsKm').value,
        odometroPartida: parseFloat(document.getElementById('odometroPartida').value),
        odometroChegada: null,
        kmRealRodado: 0,
        modelo: document.getElementById('modeloMaquina').value,
        tipo: document.getElementById('tipoManutencao').value,
        status: 'deslocamento',
        horaInicioDeslocamento: new Date().toISOString(),
        horaInicioServico: null,
        horaFimServico: null
    };

    ordensServico.push(novaOs);
    salvarBanco();
    document.getElementById('osIdAtual').value = novaOs.id;
    
    mudarEstadoBotoes('deslocamento');
    atualizarKanban();
}

window.iniciarServico = function() {
    const idAtual = document.getElementById('osIdAtual').value;
    const os = ordensServico.find(o => o.id === idAtual);
    const odoChegada = document.getElementById('odometroChegada').value;

    if(!odoChegada || odoChegada === "") {
        alert("Obrigatório informar o Odômetro de Chegada na obra antes de iniciar o serviço!");
        return;
    }

    if(parseFloat(odoChegada) < os.odometroPartida) {
        alert("O odômetro de chegada não pode ser menor que o de partida!");
        return;
    }
    
    if(os) {
        os.odometroChegada = parseFloat(odoChegada);
        os.kmRealRodado = os.odometroChegada - os.odometroPartida;
        os.status = 'execucao';
        os.horaInicioServico = new Date().toISOString();
        salvarBanco();
        mudarEstadoBotoes('execucao');
        atualizarKanban();
    }
}

window.finalizarServico = function() {
    const idAtual = document.getElementById('osIdAtual').value;
    const os = ordensServico.find(o => o.id === idAtual);
    
    if(os) {
        os.obs = document.getElementById('obsTecnicas').value;
        os.status = 'concluido';
        os.horaFimServico = new Date().toISOString();
        
        salvarBanco();
        mudarEstadoBotoes('concluido');
        document.getElementById('form-os').reset();
        document.getElementById('localSaida').value = "Oficina MTX"; 
        document.getElementById('osIdAtual').value = "";
        atualizarKanban();
        alert("OS Finalizada com sucesso! Dados de frota registrados.");
    }
}

function validarFormularioSaida() {
    const numOs = document.getElementById('numeroOS').value;
    const cliente = document.getElementById('nomeCliente').value;
    const destino = document.getElementById('localServico').value;
    const modelo = document.getElementById('modeloMaquina').value;
    const odoPartida = document.getElementById('odometroPartida').value;
    
    if(!numOs || !cliente || !destino || !modelo || !odoPartida) {
        alert("Preencha todos os dados básicos da OS, Destino e o Odômetro de Partida!");
        return false;
    }
    return true;
}

function mudarEstadoBotoes(estado) {
    const bloquearGeral = (estado === 'deslocamento' || estado === 'execucao');
    
    document.getElementById('numeroOS').disabled = bloquearGeral;
    document.getElementById('nomeCliente').disabled = bloquearGeral;
    document.getElementById('localSaida').disabled = bloquearGeral;
    document.getElementById('localServico').disabled = bloquearGeral;
    document.getElementById('modeloMaquina').disabled = bloquearGeral;
    document.getElementById('tipoManutencao').disabled = bloquearGeral;
    document.getElementById('odometroPartida').disabled = bloquearGeral;

    const btnD = document.getElementById('btnDeslocamento');
    const btnI = document.getElementById('btnIniciar');
    const btnF = document.getElementById('btnFinalizar');
    const inputOdoChegada = document.getElementById('odometroChegada');
    
    if(estado === 'deslocamento') {
        btnD.disabled = true; btnI.disabled = false; btnF.disabled = true;
        inputOdoChegada.disabled = false;
    } else if(estado === 'execucao') {
        btnD.disabled = true; btnI.disabled = true; btnF.disabled = false;
        inputOdoChegada.disabled = true;
    } else {
        btnD.disabled = false; btnI.disabled = true; btnF.disabled = true;
        inputOdoChegada.disabled = true;
    }
}

function restaurarEstadoBotoes() {
    const osAberta = ordensServico.find(o => o.mecanico === usuarioLogado && o.status !== 'concluido');
    if(osAberta) {
        document.getElementById('numeroOS').value = osAberta.numeroOS;
        document.getElementById('nomeCliente').value = osAberta.cliente;
        document.getElementById('localSaida').value = osAberta.localSaida;
        document.getElementById('localServico').value = osAberta.localServico;
        document.getElementById('gpsKm').value = osAberta.gpsKmPrevisto || '';
        document.getElementById('modeloMaquina').value = osAberta.modelo;
        document.getElementById('tipoManutencao').value = osAberta.tipo;
        document.getElementById('odometroPartida').value = osAberta.odometroPartida;
        document.getElementById('odometroChegada').value = osAberta.odometroChegada || '';
        document.getElementById('osIdAtual').value = osAberta.id;
        mudarEstadoBotoes(osAberta.status);
    } else {
        mudarEstadoBotoes('inicial');
    }
}

function salvarBanco() { localStorage.setItem('ordensServico', JSON.stringify(ordensServico)); }

// --- LÓGICA DO KANBAN ---
function atualizarKanban() {
    document.getElementById('lista-deslocamento').innerHTML = "";
    document.getElementById('lista-execucao').innerHTML = "";
    document.getElementById('lista-concluido').innerHTML = "";
    const hoje = new Date().toDateString();

    ordensServico.forEach(os => {
        const dataOS = new Date(os.horaInicioDeslocamento).toDateString();
        if(dataOS !== hoje && os.status === 'concluido') return;

        const infoRota = `${os.localSaida.split(' ')[0]} <i class="fas fa-arrow-right"></i> ${os.localServico}`;
        
        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.innerHTML = `
            <h4><span style="color: #666; font-size: 0.8rem;">[${os.numeroOS}]</span> ${os.cliente}</h4>
            <p style="font-size: 0.8rem; margin-bottom: 8px;">${infoRota}</p>
            <p><i class="fas fa-tractor"></i> ${os.modelo}</p>
            <p><i class="fas fa-user-wrench"></i> <strong>${os.mecanico.toUpperCase()}</strong></p>
        `;

        if(os.status === 'deslocamento') {
            card.style.borderLeftColor = "var(--secondary-color)";
            document.getElementById('lista-deslocamento').appendChild(card);
        } else if (os.status === 'execucao') {
            card.style.borderLeftColor = "var(--info)";
            document.getElementById('lista-execucao').appendChild(card);
        } else if (os.status === 'concluido') {
            card.style.borderLeftColor = "var(--success)";
            document.getElementById('lista-concluido').appendChild(card);
        }
    });
}

// --- RELATÓRIOS INTELIGENTES (DIA/SEMANA/MÊS) ---
window.alternarFiltroData = function() {
    const tipo = document.getElementById('tipoFiltroRelatorio').value;
    if(tipo === 'mes') {
        document.getElementById('containerDataDiaria').style.display = 'none';
        document.getElementById('containerDataMensal').style.display = 'flex';
    } else {
        document.getElementById('containerDataDiaria').style.display = 'flex';
        document.getElementById('containerDataMensal').style.display = 'none';
    }
}

window.gerarRelatorioDesempenho = function() {
    const tipoFiltro = document.getElementById('tipoFiltroRelatorio').value;
    const dataExact = new Date(document.getElementById('filtroDataExact').value + "T00:00:00");
    const dataMesStr = document.getElementById('filtroDataMes').value; 
    const tbody = document.getElementById('tabela-relatorio-desempenho');
    tbody.innerHTML = "";

    const osFiltradas = ordensServico.filter(os => {
        if (os.status !== 'concluido') return false;
        const dFim = new Date(os.horaFimServico);

        if (tipoFiltro === 'dia') {
            return dFim.toDateString() === dataExact.toDateString();
        } 
        else if (tipoFiltro === 'semana') {
            // Calcula o início (Domingo) e fim (Sábado) da semana da data selecionada
            const diaSemana = dataExact.getDay();
            const inicioSemana = new Date(dataExact);
            inicioSemana.setDate(dataExact.getDate() - diaSemana);
            inicioSemana.setHours(0,0,0,0);
            const fimSemana = new Date(inicioSemana);
            fimSemana.setDate(inicioSemana.getDate() + 6);
            fimSemana.setHours(23,59,59,999);
            return dFim >= inicioSemana && dFim <= fimSemana;
        } 
        else if (tipoFiltro === 'mes') {
            const osMes = `${dFim.getFullYear()}-${String(dFim.getMonth() + 1).padStart(2, '0')}`;
            return osMes === dataMesStr;
        }
        return false;
    });

    const resumo = {};

    osFiltradas.forEach(os => {
        const mec = os.mecanico;
        if (!resumo[mec]) {
            resumo[mec] = { totalOS: 0, kmTotal: 0, msDesloc: 0, msExec: 0 };
        }

        resumo[mec].totalOS += 1;
        resumo[mec].kmTotal += (os.kmRealRodado || 0);
        
        const dDesl = new Date(os.horaInicioDeslocamento);
        const dServ = new Date(os.horaInicioServico);
        const dFim = new Date(os.horaFimServico);

        resumo[mec].msDesloc += (dServ - dDesl);
        resumo[mec].msExec += (dFim - dServ);
    });

    Object.keys(resumo).forEach(nome => {
        const d = resumo[nome];
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-transform: capitalize;"><strong>${nome}</strong></td>
            <td>${d.totalOS}</td>
            <td><strong>${d.kmTotal.toFixed(1)} km</strong></td>
            <td>${converterMsParaHoras(d.msDesloc)}</td>
            <td>${converterMsParaHoras(d.msExec)}</td>
            <td style="color: var(--primary-color);"><strong>${converterMsParaHoras(d.msDesloc + d.msExec)}</strong></td>
        `;
        tbody.appendChild(tr);
    });

    if(Object.keys(resumo).length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">Nenhum serviço finalizado neste período.</td></tr>`;
    }
}

function converterMsParaHoras(ms) {
    const diffMins = Math.floor(ms / 60000);
    const horas = Math.floor(diffMins / 60);
    const minutos = diffMins % 60;
    return `${horas}h ${minutos}m`;
}

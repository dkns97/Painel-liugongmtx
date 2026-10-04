import { db } from './firebase.js';
import { collection, addDoc, onSnapshot, query, where, doc, updateDoc, getDocs } from "firebase/firestore";

// ========== NAVEGAÇÃO ENTRE TELAS ==========
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Remove active dos botões e telas
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tela').forEach(t => {
            t.classList.remove('active');
            t.classList.add('hidden');
        });

        // Adiciona active no clicado
        e.currentTarget.classList.add('active');
        const targetId = e.currentTarget.getAttribute('data-target');
        const targetTela = document.getElementById(targetId);
        targetTela.classList.remove('hidden');
        targetTela.classList.add('active');
    });
});

// ========== ABERTURA DE OS ==========
const formOS = document.getElementById('form-os');
const btnSalvarOS = document.getElementById('btnSalvarOS');

formOS.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // UI Loading
    const textoBtn = btnSalvarOS.querySelector('.btn-texto');
    const spinner = btnSalvarOS.querySelector('.spinner');
    textoBtn.textContent = 'A processar...';
    spinner.classList.remove('hidden');
    btnSalvarOS.disabled = true;

    const osData = {
        numero_os: document.getElementById('osNumero').value.trim(),
        cliente: document.getElementById('osCliente').value.trim(),
        modelo: document.getElementById('osModelo').value.trim(),
        valor_hora: parseFloat(document.getElementById('osValorHora').value),
        status: 'pendente', // pendente, em_deslocamento, em_execucao, concluido
        timestamps: {
            criadoEm: Date.now(),
            inicioExecucao: null,
            fimExecucao: null
        }
    };

    try {
        await addDoc(collection(db, "ordens_servico"), osData);
        alert('OS Criada com sucesso!');
        formOS.reset();
    } catch (error) {
        console.error("Erro ao adicionar OS: ", error);
        alert('Erro ao criar OS.');
    } finally {
        // Restaurar botão
        textoBtn.textContent = 'Criar Ordem de Serviço';
        spinner.classList.add('hidden');
        btnSalvarOS.disabled = false;
    }
});

// ========== KANBAN EM TEMPO REAL ==========
const colunas = {
    pendente: document.querySelector('#col-pendente .cards-container'),
    em_deslocamento: document.querySelector('#col-em_deslocamento .cards-container'),
    em_execucao: document.querySelector('#col-em_execucao .cards-container'),
    concluido: document.querySelector('#col-concluido .cards-container')
};

// Escuta alterações na coleção "ordens_servico"
onSnapshot(collection(db, "ordens_servico"), (snapshot) => {
    // Limpar colunas
    Object.values(colunas).forEach(col => col.innerHTML = '');

    snapshot.forEach((docSnap) => {
        const os = docSnap.data();
        const id = docSnap.id;
        
        const card = document.createElement('div');
        card.className = 'card-os';
        card.innerHTML = `
            <h4>${os.numero_os}</h4>
            <p><strong>Cliente:</strong> ${os.cliente}<br><strong>Modelo:</strong> ${os.modelo}</p>
            ${gerarBotaoAcao(os.status, id)}
        `;
        
        // Coloca o card na coluna correspondente
        if (colunas[os.status]) {
            colunas[os.status].appendChild(card);
        }
    });
});

// Lógica de progressão das OS no Kanban
function gerarBotaoAcao(status, id) {
    if (status === 'pendente') return `<button class="btn-avancar" onclick="avancarOS('${id}', 'em_deslocamento')">Iniciar Deslocamento</button>`;
    if (status === 'em_deslocamento') return `<button class="btn-avancar" onclick="avancarOS('${id}', 'em_execucao')">Cheguei - Iniciar Execução</button>`;
    if (status === 'em_execucao') return `<button class="btn-avancar" style="background-color: #ef4444;" onclick="avancarOS('${id}', 'concluido')">Finalizar Serviço</button>`;
    return `<span style="color: green; font-weight: bold;"><i class="fas fa-check"></i> Concluído</span>`;
}

window.avancarOS = async (id, novoStatus) => {
    const osRef = doc(db, "ordens_servico", id);
    let atualizacoes = { status: novoStatus };

    // Capturar tempo de Início e Fim para cálculos financeiros
    if (novoStatus === 'em_execucao') {
        atualizacoes['timestamps.inicioExecucao'] = Date.now();
    } else if (novoStatus === 'concluido') {
        atualizacoes['timestamps.fimExecucao'] = Date.now();
    }

    try {
        await updateDoc(osRef, atualizacoes);
    } catch (error) {
        console.error("Erro ao atualizar status:", error);
    }
};

// ========== RELATÓRIOS E FECHAMENTO FINANCEIRO ==========
const btnBuscarRelatorio = document.getElementById('btnBuscarRelatorio');
const btnCarregarTodas = document.getElementById('btnCarregarTodas');
const corpoTabela = document.getElementById('corpoTabelaRelatorios');
const textoTotalGeral = document.getElementById('totalGeralRelatorio');

const formataMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

const formataData = (timestamp) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString('pt-BR');
};

async function gerarRelatorio(numeroOSBusca = null) {
    corpoTabela.innerHTML = '<tr><td colspan="7" style="text-align: center;">Carregando dados...</td></tr>';
    let totalGeral = 0;

    try {
        let q;
        const osRef = collection(db, "ordens_servico");

        if (numeroOSBusca) {
            // Busca uma OS específica (case sensitive no banco)
            q = query(osRef, where("numero_os", "==", numeroOSBusca));
        } else {
            // Busca todas as concluídas para o fecho mensal
            q = query(osRef, where("status", "==", "concluido"));
        }

        const querySnapshot = await getDocs(q);
        corpoTabela.innerHTML = '';

        if (querySnapshot.empty) {
            corpoTabela.innerHTML = '<tr><td colspan="7" style="text-align: center;">Nenhuma OS encontrada.</td></tr>';
            textoTotalGeral.textContent = 'R$ 0,00';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const os = docSnap.data();
            let horasTrabalhadas = 0;
            let totalMaoDeObra = 0;

            // Calcula o tempo se tiver data de início e fim
            if (os.timestamps && os.timestamps.inicioExecucao && os.timestamps.fimExecucao) {
                const difMilissegundos = os.timestamps.fimExecucao - os.timestamps.inicioExecucao;
                horasTrabalhadas = difMilissegundos / (1000 * 60 * 60);
                totalMaoDeObra = horasTrabalhadas * os.valor_hora;
            }

            totalGeral += totalMaoDeObra;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${os.numero_os}</strong></td>
                <td>${os.cliente}</td>
                <td>${formataData(os.timestamps?.inicioExecucao)}</td>
                <td>${formataData(os.timestamps?.fimExecucao)}</td>
                <td>${horasTrabalhadas.toFixed(2)}h</td>
                <td>${formataMoeda(os.valor_hora)}</td>
                <td style="color: green; font-weight: bold;">${formataMoeda(totalMaoDeObra)}</td>
            `;
            corpoTabela.appendChild(tr);
        });

        // Atualiza o rodapé com o somatório de todas as OS geradas na tela
        textoTotalGeral.textContent = formataMoeda(totalGeral);

    } catch (error) {
        console.error("Erro ao gerar relatório:", error);
        corpoTabela.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">Erro ao consultar banco de dados.</td></tr>';
    }
}

// Botões de Relatório
btnBuscarRelatorio.addEventListener('click', () => {
    const busca = document.getElementById('buscaOS').value.trim();
    if (busca) gerarRelatorio(busca);
});

btnCarregarTodas.addEventListener('click', () => {
    document.getElementById('buscaOS').value = '';
    gerarRelatorio(); // Carrega todas as concluídas
});
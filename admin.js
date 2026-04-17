const supabaseUrl = 'https://kifhzxrvkfvmjlrtdeif.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpZmh6eHJ2a2Z2bWpscnRkZWlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxODM5MTcsImV4cCI6MjA5MTc1OTkxN30.z5oZ1KrN7cVkDWdQoL8M5yE8vLPm5h6x5pbvQOcmjaY';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

const SENHA_MESTRA = 'barber2026';

function setCurrentDate() {
    const currentDateEl = document.getElementById('current-date');
    if (currentDateEl) {
        const today = new Date();
        currentDateEl.textContent = today.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
    }
}

function getStatusClass(status) {
    const normalized = (status || '').toLowerCase();
    if (normalized === 'pendente' || normalized === 'reservado') return 'status-reserved';
    if (normalized === 'ocupado' || normalized === 'concluído' || normalized === 'concluido') return 'status-busy';
    return 'status-free';
}

async function loadDashboard() {
    const container = document.getElementById('admin-list');
    const lastUpdateEl = document.getElementById('last-update');

    if (!container) return;

    container.innerHTML = '<p>Carregando agenda...</p>';

    const { data, error } = await supabaseClient
        .from('agendamentos')
        .select('*')
        .order('data_hora', { ascending: true });

    if (error) {
        console.error("ERRO ADMIN:", error);
        container.innerHTML = '<p style="color:#ff5c5c;">Erro ao carregar agenda.</p>';
        return;
    }

    container.innerHTML = '';

    if (!data || data.length === 0) {
        container.innerHTML = '<p>Nenhum agendamento encontrado.</p>';
    } else {
        data.forEach(reserva => {
            const horario = new Date(reserva.data_hora);
            const card = document.createElement('div');
            card.className = 'slot-card';
            card.innerHTML = `
                <div class="slot-time">${horario.toLocaleDateString('pt-BR')} • ${horario.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                <div class="slot-body">
                    <div class="slot-meta"><strong>${reserva.cliente_nome || 'Sem nome'}</strong></div>
                    <div class="slot-meta">${reserva.servicos || 'Serviço não informado'}</div>
                </div>
                <div class="status-pill ${getStatusClass(reserva.status)}">${reserva.status || 'Reservado'}</div>
            `;
            container.appendChild(card);
        });
    }

    if (lastUpdateEl) {
        lastUpdateEl.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
}

function handleLogin(event) {
    event.preventDefault();
    const input = document.getElementById('access-password');
    const errorEl = document.getElementById('access-error');
    const overlay = document.getElementById('access-modal');
    const shell = document.getElementById('admin-shell');

    if (!input || !overlay || !shell) return;

    if (input.value === SENHA_MESTRA) {
        if (errorEl) errorEl.textContent = '';
        overlay.classList.remove('open');
        shell.classList.add('unlocked');
        loadDashboard();
    } else if (errorEl) {
        errorEl.textContent = 'Senha incorreta. Tente novamente.';
    }
}

document.getElementById('access-form')?.addEventListener('submit', handleLogin);
document.getElementById('refresh-agenda')?.addEventListener('click', loadDashboard);

setCurrentDate();

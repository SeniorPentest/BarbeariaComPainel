const supabaseUrl = 'https://kifhzxrvkfvmjlrtdeif.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpZmh6eHJ2a2Z2bWpscnRkZWlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxODM5MTcsImV4cCI6MjA5MTc1OTkxN30.z5oZ1KrN7cVkDWdQoL8M5yE8vLPm5h6x5pbvQOcmjaY';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

const SENHA_MESTRA = 'barber2026';

async function checkLogin() {
    const pass = document.getElementById('admin-pass').value;
    if (pass === SENHA_MESTRA) {
        document.getElementById('login-modal').style.display = 'none';
        loadDashboard();
    } else {
        alert("Senha incorreta!");
    }
}

async function loadDashboard() {
    const { data, error } = await supabaseClient
        .from('agendamentos')
        .select('*')
        .order('data_hora', { ascending: true });

    if (error) {
        console.error("ERRO ADMIN:", error);
        return;
    }

    const container = document.getElementById('admin-list');
    container.innerHTML = '';

    data.forEach(reserva => {
        const div = document.createElement('div');
        div.className = 'admin-card';
        div.innerHTML = `
            <p><strong>${new Date(reserva.data_hora).toLocaleString()}</strong></p>
            <p>Cliente: ${reserva.cliente_nome}</p>
            <p>Serviço: ${reserva.servicos}</p>
            <p>Status: ${reserva.status}</p>
        `;
        container.appendChild(div);
    });
}
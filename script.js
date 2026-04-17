const supabaseUrl = 'https://kifhzxrvkfvmjlrtdeif.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpZmh6eHJ2a2Z2bWpscnRkZWlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxODM5MTcsImV4cCI6MjA5MTc1OTkxN30.z5oZ1KrN7cVkDWdQoL8M5yE8vLPm5h6x5pbvQOcmjaY';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

const PIX_KEY = '5511915723418';
const WHATSAPP_NUMBER = '5511915723418';
const MERCHANT_NAME = 'Barbearia Premium';
const MERCHANT_CITY = 'Sao Paulo';

const state = {
    selectedServices: [],
    totalPrice: 0,
    paymentMethod: 'pix',
    appointmentTime: null
};

function updateUI() {
    const totalEl = document.getElementById('total-value');
    if (totalEl) {
        totalEl.textContent = `R$ ${state.totalPrice.toFixed(2)}`;
    }

    const nameInput = document.getElementById('client-name');
    const confirmBtn = document.getElementById('confirm-btn');

    const hasName = nameInput && nameInput.value.trim().length > 0;
    const hasTime = Boolean(state.appointmentTime);
    const hasServices = state.selectedServices.length > 0;

    if (confirmBtn) {
        confirmBtn.disabled = !(hasServices && hasTime && hasName);
    }
}

function bindServiceSelection() {
    document.querySelectorAll('.service-card').forEach(card => {
        const btn = card.querySelector('.service-select');
        const name = card.dataset.service;
        const price = Number(card.dataset.price || 0);

        if (!btn || !name) return;

        btn.addEventListener('click', () => {
            const existingIndex = state.selectedServices.findIndex(s => s.name === name);
            if (existingIndex >= 0) {
                state.selectedServices.splice(existingIndex, 1);
                card.classList.remove('selected');
                btn.textContent = 'Selecionar';
            } else {
                state.selectedServices.push({ name, price });
                card.classList.add('selected');
                btn.textContent = 'Selecionado';
            }

            state.totalPrice = state.selectedServices.reduce((sum, s) => sum + s.price, 0);
            updateUI();
        });
    });
}

function bindPaymentSelection() {
    document.querySelectorAll('.payment-button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.payment-button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.paymentMethod = btn.dataset.method || 'pix';
        });
    });
}

function bindClientNameListener() {
    const nameInput = document.getElementById('client-name');
    if (nameInput) {
        nameInput.addEventListener('input', updateUI);
    }
}

const weekdaySchedule = [
    { start: 7 * 60, end: 12 * 60, status: 'open' },
    { start: 12 * 60, end: 13 * 60, status: 'lunch' },
    { start: 13 * 60, end: 20 * 60, status: 'open' }
];

const weekendSchedule = [
    { start: 7 * 60, end: 12 * 60, status: 'open' },
    { start: 12 * 60, end: 13 * 60, status: 'lunch' },
    { start: 13 * 60, end: 14 * 60, status: 'open' }
];

const WEEKLY_SCHEDULE = {
    0: weekendSchedule, 1: [], 2: weekdaySchedule, 3: weekdaySchedule,
    4: weekdaySchedule, 5: weekdaySchedule, 6: weekendSchedule
};

async function renderTimeSlots() {
    const slotsGrid = document.getElementById('time-slots');
    const dateInput = document.getElementById('appointment-date');
    if (!slotsGrid || !dateInput.value) return;

    slotsGrid.innerHTML = '<p>Carregando horários...</p>';

    try {
        // Busca horários já agendados no Supabase
        const { data: bookedSlots, error } = await supabaseClient
            .from('agendamentos')
            .select('data_hora');

        if (error) throw error;

        const bookedTimes = (bookedSlots || []).map(s => new Date(s.data_hora).toISOString());

        const selectedDate = new Date(dateInput.value + 'T00:00:00');
        const dayOfWeek = selectedDate.getDay();
        const schedule = WEEKLY_SCHEDULE[dayOfWeek] || [];

        slotsGrid.innerHTML = '';

        if (schedule.length === 0) {
            slotsGrid.innerHTML = '<p>Fechado neste dia.</p>';
            return;
        }

        schedule.forEach(segment => {
            if (segment.status === 'open') {
                for (let mins = segment.start; mins < segment.end; mins += 30) {
                    const h = Math.floor(mins / 60);
                    const m = mins % 60;
                    const timeLabel = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                    
                    const slotFullISO = new Date(dateInput.value + `T${timeLabel}:00`).toISOString();
                    const isBooked = bookedTimes.includes(slotFullISO);

                    const btn = document.createElement('button');
                    btn.className = 'time-slot';
                    btn.textContent = timeLabel;
                    if (state.appointmentTime === slotFullISO) {
                        btn.classList.add('selected');
                    }
                    if (isBooked) {
                        btn.disabled = true;
                        btn.style.opacity = '0.3';
                        btn.style.cursor = 'not-allowed';
                    } else {
                        btn.onclick = () => {
                            document.querySelectorAll('.time-slot').forEach(b => b.classList.remove('selected'));
                            btn.classList.add('selected');
                            state.appointmentTime = slotFullISO;
                            updateUI();
                        };
                    }
                    slotsGrid.appendChild(btn);
                }
            }
        });
    } catch (err) {
        console.error("ERRO SUPABASE:", err);
        slotsGrid.innerHTML = '<p style="color:red">Erro ao carregar agenda.</p>';
    }
}

// Configuração inicial da data
const dateInput = document.getElementById('appointment-date');
if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    dateInput.min = today;
    const onDateChange = () => {
        state.appointmentTime = null;
        updateUI();
        renderTimeSlots();
    };
    dateInput.addEventListener('change', onDateChange);
    renderTimeSlots();
}

bindServiceSelection();
bindPaymentSelection();
bindClientNameListener();
updateUI();

// Lógica de Agendamento Final
async function confirmBooking() {
    const btn = document.getElementById('confirm-btn');
    const name = document.getElementById('client-name').value;
    const services = state.selectedServices.map(s => s.name).join(', ');

    btn.disabled = true;
    btn.textContent = 'Agendando...';

    try {
        const { error } = await supabaseClient.from('agendamentos').insert([{
            cliente_nome: name,
            servicos: services,
            total: state.totalPrice,
            metodo_pagamento: state.paymentMethod,
            status: 'Pendente',
            data_hora: state.appointmentTime
        }]);

        if (error) throw error;

        if (state.paymentMethod === 'pix') {
            // Lógica do Modal de Pix (Gerar QR Code etc)
            const payload = "CÓDIGO_PIX_EXEMPLO"; // Aqui você chamaria sua função de Pix
            document.getElementById('pix-modal').classList.add('open');
        } else {
            const msg = `Reserva Confirmada!\nCliente: ${name}\nHorário: ${new Date(state.appointmentTime).toLocaleString('pt-BR')}`;
            window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
        }
    } catch (err) {
        alert("Este horário acabou de ser ocupado! Por favor, escolha outro.");
        renderTimeSlots();
    } finally {
        btn.disabled = false;
        btn.textContent = 'Confirmar Agendamento';
    }
}

const confirmBtn = document.getElementById('confirm-btn');
if (confirmBtn) {
    confirmBtn.addEventListener('click', confirmBooking);
}

const supabaseUrl = 'https://kifhzxrvkfvmjlrtdeif.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpZmh6eHJ2kZ2bWpscnRkZWlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxODM5MTcsImV4cCI6MjA5MTc1OTkxN30.z5oZ1KrN7cVkDWdQoL8M5yE8vLPm5h6x5pbvQOcmjaY';
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
    0: weekendSchedule,
    1: [],
    2: weekdaySchedule,
    3: weekdaySchedule,
    4: weekdaySchedule,
    5: weekdaySchedule,
    6: weekendSchedule
};

const dayNames = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

function minutesToTimeLabel(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}h${mins > 0 ? String(mins).padStart(2, '0') : ''}`;
}

function formatSlotLabel(minutes) {
    const hours = Math.floor(minutes / 60).toString().padStart(2, '0');
    const mins = (minutes % 60).toString().padStart(2, '0');
    return `${hours}:${mins}`;
}

function findNextSegment(day, minutes) {
    const todaySchedule = WEEKLY_SCHEDULE[day] || [];
    const upcomingToday = todaySchedule.find(segment => minutes < segment.start);
    if (upcomingToday) {
        return { day, segment: upcomingToday };
    }

    for (let offset = 1; offset <= 7; offset++) {
        const targetDay = (day + offset) % 7;
        const schedule = WEEKLY_SCHEDULE[targetDay] || [];
        if (schedule.length) return { day: targetDay, segment: schedule[0] };
    }
    return null;
}

function describeDayOffset(currentDay, targetDay) {
    const diff = (targetDay - currentDay + 7) % 7;
    if (diff === 0) return 'hoje';
    if (diff === 1) return 'amanhã';
    const preposition = (targetDay === 0 || targetDay === 6) ? 'no' : 'na';
    return `${preposition} ${dayNames[targetDay]}`;
}

function updateStatusPanel() {
    const indicatorEl = document.getElementById('status-indicator');
    const primaryEl = document.getElementById('status-principal');
    const secondaryEl = document.getElementById('status-secundario');

    if (!indicatorEl || !primaryEl || !secondaryEl) return;

    const now = new Date();
    const day = now.getDay();
    
    // ======== ALTERAÇÃO DE TESTE AQUI ========
    // Forçando 10h da manhã (10 * 60 minutos)
    const minutes = 10 * 60; 
    // Original escondido: const minutes = now.getHours() * 60 + now.getMinutes();
    // =========================================

    const todaysSchedule = WEEKLY_SCHEDULE[day] || [];
    const currentSegment = todaysSchedule.find(segment => minutes >= segment.start && minutes < segment.end);

    let status = 'closed';
    let nextChangeDay = null;
    let nextChangeMinutes = null;
    let nextAfterCurrent = null;

    if (currentSegment) {
        status = currentSegment.status;
        nextChangeDay = day;
        nextChangeMinutes = currentSegment.end;
        nextAfterCurrent = findNextSegment(day, currentSegment.end);
    } else {
        const nextSegment = findNextSegment(day, minutes);
        if (nextSegment) {
            status = 'closed';
            nextChangeDay = nextSegment.day;
            nextChangeMinutes = nextSegment.segment.start;
        }
    }

    indicatorEl.className = 'status-indicator';
    indicatorEl.classList.add(`status-${status}`);

    let primaryText = '';
    let secondaryText = '';

    if (status === 'open' && currentSegment) {
        primaryText = 'Aberto Agora';
        const closingLabel = minutesToTimeLabel(currentSegment.end);
        const isLunchNext = nextAfterCurrent && nextAfterCurrent.day === day && nextAfterCurrent.segment.status === 'lunch';
        if (isLunchNext) {
            secondaryText = `Pausa para almoço às ${closingLabel}`;
        } else {
            const closingDayLabel = describeDayOffset(day, nextChangeDay || day);
            secondaryText = `Fechamos ${closingDayLabel === 'hoje' ? '' : `${closingDayLabel} `}às ${closingLabel}`.trim();
        }
    } else if (status === 'lunch') {
        const reopenLabel = nextAfterCurrent ? minutesToTimeLabel(nextAfterCurrent.segment.start) : '13h';
        primaryText = `🍽️ Em Almoço... Voltamos às ${reopenLabel}`;
        secondaryText = `Voltamos às ${reopenLabel}`;
    } else {
        primaryText = 'Fechado';
        if (nextChangeMinutes !== null && nextChangeDay !== null) {
            const dayLabel = describeDayOffset(day, nextChangeDay);
            secondaryText = `Abrimos ${dayLabel} às ${minutesToTimeLabel(nextChangeMinutes)}`;
        } else {
            secondaryText = 'Consulte nossos horários especiais.';
        }
    }

    primaryEl.textContent = primaryText;
    secondaryEl.textContent = secondaryText;
}

function emvField(id, value) {
    const length = String(value.length).padStart(2, '0');
    return `${id}${length}${value}`;
}

function calculateCRC16(payload) {
    let crc = 0xffff;
    for (let i = 0; i < payload.length; i++) {
        crc ^= payload.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            const flag = crc & 0x8000;
            crc = (crc << 1) & 0xffff;
            if (flag) crc ^= 0x1021;
        }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
}

function generatePixPayload(amount) {
    const amountFormatted = Number(amount).toFixed(2);
    const txid = `BARB${Date.now().toString().slice(-6)}`;

    const merchantAccountInfo = emvField('26',
        emvField('00', 'BR.GOV.BCB.PIX') +
        emvField('01', PIX_KEY)
    );

    const additionalData = emvField('62', emvField('05', txid));

    let payload = '';
    payload += emvField('00', '01');
    payload += emvField('01', '12');
    payload += merchantAccountInfo;
    payload += emvField('52', '0000');
    payload += emvField('53', '986');
    payload += emvField('54', amountFormatted);
    payload += emvField('58', 'BR');
    payload += emvField('59', MERCHANT_NAME);
    payload += emvField('60', MERCHANT_CITY);
    payload += additionalData;
    payload += '6304';

    const crc = calculateCRC16(payload);
    return `${payload}${crc}`;
}

function formatAppointment(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR');
}

function buildWhatsAppMessage({ intro, name, services, total, appointment }) {
    const formattedAppointment = formatAppointment(appointment);
    const lines = [
        intro,
        `Cliente: ${name}`,
        `Serviços: ${services}`,
        `Total: R$ ${Number(total).toFixed(2)}`
    ];
    if (formattedAppointment) lines.push(`Horário: ${formattedAppointment}`);
    return lines.join('\n');
}

function openWhatsAppWithMessage(message) {
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank');
}

// Seleção de Serviços
document.querySelectorAll('.service-card').forEach(card => {
    card.querySelector('.service-select').addEventListener('click', () => {
        const name = card.dataset.service;
        const price = Number(card.dataset.price);

        if (card.classList.contains('selected')) {
            card.classList.remove('selected');
            state.selectedServices = state.selectedServices.filter(s => s.name !== name);
            state.totalPrice -= price;
        } else {
            card.classList.add('selected');
            state.selectedServices.push({ name, price });
            state.totalPrice += price;
        }
        updateUI();
    });
});

// Seleção de Pagamento
document.querySelectorAll('.payment-button').forEach(btn => {
    btn.addEventListener('click', () => {
        state.paymentMethod = btn.dataset.method;
        document.querySelectorAll('.payment-button').forEach(b => b.classList.toggle('active', b === btn));
    });
});

function getAppointmentValue() {
    const dateValue = document.getElementById('appointment-date')?.value;
    if (!dateValue || !state.appointmentTime) return '';
    return `${dateValue}T${state.appointmentTime}`;
}

function renderTimeSlots() {
    const dateInput = document.getElementById('appointment-date');
    const slotsContainer = document.getElementById('time-slots');
    if (!dateInput || !slotsContainer) return;

    const dateValue = dateInput.value;
    state.appointmentTime = null;
    slotsContainer.innerHTML = '';

    if (!dateValue) {
        updateUI();
        return;
    }

    const selectedDate = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(selectedDate.getTime())) {
        updateUI();
        return;
    }

    const day = selectedDate.getDay();
    const segments = WEEKLY_SCHEDULE[day] || [];
    const fragment = document.createDocumentFragment();

    segments.forEach(segment => {
        if (segment.status !== 'open') return;
        for (let minutes = segment.start; minutes < segment.end; minutes += 30) {
            const label = formatSlotLabel(minutes);
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'time-slot';
            btn.textContent = label;
            btn.addEventListener('click', () => {
                slotsContainer.querySelectorAll('.time-slot').forEach(slot => slot.classList.remove('selected'));
                btn.classList.add('selected');
                state.appointmentTime = label;
                updateUI();
            });
            fragment.appendChild(btn);
        }
    });

    if (!fragment.childNodes.length) {
        const empty = document.createElement('p');
        empty.textContent = 'Sem horários disponíveis para este dia.';
        slotsContainer.appendChild(empty);
    } else {
        slotsContainer.appendChild(fragment);
    }

    updateUI();
}

function updateUI() {
    document.getElementById('total-value').textContent = `R$ ${state.totalPrice.toFixed(2)}`;
    const hasDate = document.getElementById('appointment-date')?.value;
    const hasName = document.getElementById('client-name').value;
    const ready = state.selectedServices.length > 0 && hasDate && state.appointmentTime && hasName;
    document.getElementById('confirm-btn').disabled = !ready;
}

const appointmentDateInput = document.getElementById('appointment-date');
if (appointmentDateInput) {
    const today = new Date();
    appointmentDateInput.value = today.toISOString().split('T')[0];
    appointmentDateInput.addEventListener('change', renderTimeSlots);
    renderTimeSlots();
}

document.getElementById('client-name').addEventListener('input', updateUI);

async function confirmBooking() {
    const btn = document.getElementById('confirm-btn');
    btn.textContent = 'Processando...';
    btn.disabled = true;

    const name = document.getElementById('client-name').value;
    const services = state.selectedServices.map(s => s.name).join(', ');
    const appointment = getAppointmentValue();

    if (!appointment) {
        btn.textContent = 'Confirmar Agendamento';
        btn.disabled = false;
        alert('Selecione a data e o horário do agendamento.');
        return;
    }

    try {
        if (state.paymentMethod === 'pix') {
            const payload = generatePixPayload(state.totalPrice);
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(payload)}`;

            document.getElementById('qr-code-img').src = qrUrl;
            document.getElementById('pix-copy-paste').value = payload;
            document.getElementById('pix-modal').classList.add('open');

            document.getElementById('btn-check-payment').onclick = () => {
                const msg = buildWhatsAppMessage({
                    intro: 'Olá! Já paguei via Pix.',
                    name,
                    services,
                    total: state.totalPrice,
                    appointment
                }) + `\nEnvio o comprovante para confirmar?`;
                openWhatsAppWithMessage(msg);
            };
        } else if (state.paymentMethod === 'cash') {
            const msg = buildWhatsAppMessage({
                intro: 'Olá! Quero agendar pagando em dinheiro.',
                name,
                services,
                total: state.totalPrice,
                appointment
            });
            openWhatsAppWithMessage(msg);
        } else {
            const { data, error } = await supabaseClient.functions.invoke('criar-pagamento', {
                body: { items: state.selectedServices, method: 'card', total: state.totalPrice }
            });

            if (error) throw error;
            window.location.href = data.init_point;
        }
    } catch (err) {
        alert("Erro: " + err.message);
    } finally {
        btn.textContent = 'Confirmar Agendamento';
        btn.disabled = false;
    }
}

function copyPixCode() {
    const input = document.getElementById('pix-copy-paste');
    input.select();
    navigator.clipboard.writeText(input.value);
    alert('Código copiado!');
}

function closePixModal() {
    document.getElementById('pix-modal').classList.remove('open');
}

document.getElementById('confirm-btn').addEventListener('click', confirmBooking);
document.getElementById('copy-pix-btn')?.addEventListener('click', copyPixCode);
document.getElementById('close-pix-modal')?.addEventListener('click', closePixModal);
document.getElementById('pix-modal')?.addEventListener('click', (event) => {
    if (event.target.id === 'pix-modal') closePixModal();
});

updateStatusPanel();
setInterval(updateStatusPanel, 60 * 1000);

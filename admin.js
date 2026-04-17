const supabaseUrl = 'https://kifhzxrvkfvmjlrtdeif.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpZmh6eHJ2kZ2bWpscnRkZWlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxODM5MTcsImV4cCI6MjA5MTc1OTkxN30.z5oZ1KrN7cVkDWdQoL8M5yE8vLPm5h6x5pbvQOcmjaY';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

const ADMIN_PASSWORD = 'adminbarber123';
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 20;
const SLOT_INTERVAL_MINUTES = 30;

const state = {
    slots: [],
    appointments: {},
    channel: null,
    selectedSlot: null,
    lastUpdated: null
};

document.addEventListener('DOMContentLoaded', () => {
    buildSlotsForToday();
    renderSlots();
    bindUI();
    updateDateLabel();
});

function bindUI() {
    document.getElementById('access-form')?.addEventListener('submit', handleAccess);
    document.getElementById('refresh-agenda')?.addEventListener('click', loadAgenda);
    document.getElementById('walkin-form')?.addEventListener('submit', submitWalkIn);
    document.getElementById('walkin-cancel')?.addEventListener('click', closeWalkInModal);
}

function buildSlotsForToday(baseDate = new Date()) {
    const today = new Date(baseDate);
    today.setHours(0, 0, 0, 0);

    const start = new Date(today);
    start.setHours(DAY_START_HOUR, 0, 0, 0);

    const end = new Date(today);
    end.setHours(DAY_END_HOUR, 0, 0, 0);

    const slots = [];
    for (let cursor = new Date(start); cursor <= end; cursor = new Date(cursor.getTime() + SLOT_INTERVAL_MINUTES * 60000)) {
        slots.push({
            key: toSlotKey(cursor),
            label: formatTime(cursor),
            iso: cursor.toISOString(),
            date: new Date(cursor)
        });
    }
    state.slots = slots;
}

function updateDateLabel() {
    const target = document.getElementById('current-date');
    if (!target) return;
    const today = new Date();
    target.textContent = today.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
}

async function handleAccess(event) {
    event.preventDefault();
    const input = document.getElementById('access-password');
    const errorEl = document.getElementById('access-error');
    const value = input.value.trim();

    if (value !== ADMIN_PASSWORD) {
        errorEl.textContent = 'Senha incorreta. Tente novamente.';
        return;
    }

    errorEl.textContent = '';
    document.getElementById('access-modal')?.classList.remove('open');
    document.getElementById('admin-shell')?.classList.add('unlocked');
    await initializeRealtime();
    await loadAgenda();
}

async function initializeRealtime() {
    if (state.channel) return;

    state.channel = supabaseClient
        .channel('agendamentos-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, () => {
            loadAgenda();
        })
        .subscribe();
}

async function loadAgenda() {
    setLoading(true);
    const { start, end } = getDayRange();
    const { data, error } = await supabaseClient
        .from('agendamentos')
        .select('*')
        .gte('horario', start)
        .lte('horario', end)
        .order('horario', { ascending: true });

    setLoading(false);

    if (error) {
        showToast('Erro ao carregar agenda. Verifique o Supabase.');
        return;
    }

    state.appointments = buildAppointmentMap(data || []);
    state.lastUpdated = new Date();
    updateLastUpdateLabel();
    renderSlots();
}

function getDayRange(baseDate = new Date()) {
    const start = new Date(baseDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(baseDate);
    end.setHours(23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString() };
}

function buildAppointmentMap(list) {
    const map = {};
    list.forEach(item => {
        if (!item?.horario) return;
        const key = toSlotKey(new Date(item.horario));
        map[key] = item;
    });
    return map;
}

function renderSlots() {
    const container = document.getElementById('slot-list');
    if (!container) return;

    container.innerHTML = '';

    state.slots.forEach(slot => {
        const appointment = state.appointments[slot.key];
        const status = getSlotStatus(appointment);

        const card = document.createElement('article');
        card.className = 'slot-card';

        const statusEl = document.createElement('span');
        statusEl.className = `status-pill ${statusClass(status)}`;
        statusEl.textContent = statusLabel(status);

        const body = document.createElement('div');
        body.className = 'slot-body';
        body.appendChild(statusEl);

        const meta = document.createElement('div');
        meta.className = 'slot-meta';
        meta.textContent = buildMetaText(status, appointment);
        body.appendChild(meta);

        const actions = document.createElement('div');
        actions.className = 'slot-actions';
        appendActions(actions, status, slot, appointment);

        const timeEl = document.createElement('div');
        timeEl.className = 'slot-time';
        timeEl.textContent = slot.label;

        card.appendChild(timeEl);
        card.appendChild(body);
        card.appendChild(actions);
        container.appendChild(card);
    });
}

function appendActions(wrapper, status, slot, appointment) {
    if (status === 'livre') {
        const btn = buildButton('Adicionar Cliente da Rua', 'btn btn-primary', () => openWalkInModal(slot));
        wrapper.appendChild(btn);
        return;
    }

    if (status === 'reservado_site') {
        const confirm = buildButton('Confirmar Presença', 'btn btn-primary', () => confirmPresence(slot, appointment));
        const cancel = buildButton('Cancelar / Liberar', 'btn btn-danger', () => freeSlot(slot));
        wrapper.appendChild(confirm);
        wrapper.appendChild(cancel);
        return;
    }

    const free = buildButton('Liberar Horário', 'btn btn-secondary', () => freeSlot(slot));
    wrapper.appendChild(free);
}

function buildButton(label, className, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className;
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
}

function getSlotStatus(appointment) {
    if (!appointment) return 'livre';
    const normalized = (appointment.status || '').toLowerCase();

    if (['ocupado_rua', 'rua', 'offline'].includes(normalized)) return 'ocupado_rua';
    if (['confirmado_site', 'confirmado', 'presente'].includes(normalized)) return 'confirmado_site';
    if (['reservado_site', 'reservado', 'site'].includes(normalized)) return 'reservado_site';
    return 'reservado_site';
}

function statusLabel(status) {
    const map = {
        livre: '🟢 Livre',
        reservado_site: '🟡 Reservado (Site)',
        confirmado_site: '🔴 Confirmado (Site)',
        ocupado_rua: '🔴 Ocupado (Rua)'
    };
    return map[status] || status;
}

function statusClass(status) {
    if (status === 'livre') return 'status-free';
    if (status === 'reservado_site') return 'status-reserved';
    return 'status-busy';
}

function buildMetaText(status, appointment) {
    if (status === 'livre') return 'Sem agendamento. Clique para encaixar um cliente da rua.';

    const name = appointment?.cliente_nome || (status === 'ocupado_rua' ? 'Cliente Offline' : 'Cliente do Site');
    const service = appointment?.servico || appointment?.servico_nome || 'Serviço não informado';

    if (status === 'reservado_site') return `Reserva do site • ${name} • ${service}`;
    if (status === 'confirmado_site') return `Presença confirmada • ${name} • ${service}`;
    return `Em atendimento • ${name} • ${service}`;
}

function openWalkInModal(slot) {
    state.selectedSlot = slot;
    document.getElementById('walkin-slot-label').textContent = `Horário selecionado: ${slot.label}`;
    document.getElementById('walkin-modal')?.classList.add('open');
    document.getElementById('walkin-name').focus();
}

function closeWalkInModal() {
    document.getElementById('walkin-modal')?.classList.remove('open');
    document.getElementById('walkin-form')?.reset();
    state.selectedSlot = null;
}

async function submitWalkIn(event) {
    event.preventDefault();
    if (!state.selectedSlot) return;

    const name = document.getElementById('walkin-name').value.trim();
    const service = document.getElementById('walkin-service').value.trim();

    const payload = {
        horario: state.selectedSlot.iso,
        cliente_nome: name,
        servico: service,
        origem: 'rua',
        status: 'ocupado_rua'
    };

    const { error } = await supabaseClient.from('agendamentos').upsert(payload, { onConflict: 'horario' });

    if (error) {
        showToast('Não foi possível salvar o cliente offline.');
        return;
    }

    showToast('Cliente adicionado ao horário.');
    closeWalkInModal();
    await loadAgenda();
}

async function confirmPresence(slot, appointment = {}) {
    const payload = {
        horario: slot.iso,
        cliente_nome: appointment.cliente_nome || 'Cliente do Site',
        servico: appointment.servico || appointment.servico_nome || 'Serviço reservado',
        origem: 'site',
        status: 'confirmado_site'
    };

    const { error } = await supabaseClient.from('agendamentos').upsert(payload, { onConflict: 'horario' });
    if (error) {
        showToast('Falha ao confirmar presença.');
        return;
    }
    showToast('Presença confirmada.');
    await loadAgenda();
}

async function freeSlot(slot) {
    const { error } = await supabaseClient.from('agendamentos').delete().eq('horario', slot.iso);
    if (error) {
        showToast('Não foi possível liberar o horário.');
        return;
    }
    showToast('Horário liberado.');
    await loadAgenda();
}

function setLoading(isLoading) {
    const btn = document.getElementById('refresh-agenda');
    if (!btn) return;
    btn.disabled = isLoading;
    btn.textContent = isLoading ? 'Atualizando...' : 'Recarregar agenda';
}

function updateLastUpdateLabel() {
    const label = document.getElementById('last-update');
    if (!label) return;
    if (!state.lastUpdated) {
        label.textContent = '--';
        return;
    }
    label.textContent = state.lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function toSlotKey(date) {
    const local = new Date(date);
    return `${String(local.getHours()).padStart(2, '0')}:${String(local.getMinutes()).padStart(2, '0')}`;
}

function formatTime(date) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2400);
}

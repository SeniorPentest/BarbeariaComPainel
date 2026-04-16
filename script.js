// ==========================================
// CONFIGURAÇÕES DA SUA BARBEARIA
// ==========================================
const MINHA_CHAVE_PIX = "vitorpereiras373@gmail.com"; // Coloque sua chave (Celular, CPF, Email ou Aleatória)
const NOME_RECEBEDOR = "Barbearia Premium"; // Nome que vai aparecer no banco
const CIDADE_RECEBEDOR = "Catanduva"; // Cidade

const supabaseUrl = 'https://kifhzxrvkfvmjlrtdeif.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpZmh6eHJ2a2Z2bWpscnRkZWlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxODM5MTcsImV4cCI6MjA5MTc1OTkxN30.z5oZ1KrN7cVkDWdQoL8M5yE8vLPm5h6x5pbvQOcmjaY';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

const state = { selectedServices: [], totalPrice: 0, paymentMethod: 'pix' };

// ==========================================
// ALGORITMO GERADOR DE PIX BACEN (OFFLINE)
// ==========================================
function gerarPayloadPix(chave, nome, cidade, valor) {
    const f = (id, value) => {
        const v = String(value);
        return id + String(v.length).padStart(2, '0') + v;
    };
    const payloadFormat = "000201";
    const merchantAccount = f("26", "0014br.gov.bcb.pix" + f("01", chave));
    const merchantCategory = "52040000";
    const currency = "5303986";
    const txAmount = valor > 0 ? f("54", valor.toFixed(2)) : "";
    const country = "5802BR";
    const merchantName = f("59", nome.substring(0, 25));
    const merchantCity = f("60", cidade.substring(0, 15));
    const txId = f("62", f("05", "***")); 
    
    let payload = payloadFormat + merchantAccount + merchantCategory + currency + txAmount + country + merchantName + merchantCity + txId + "6304";
    
    // Cálculo do CRC16 (Assinatura de segurança do Pix)
    let crc = 0xFFFF;
    for (let i = 0; i < payload.length; i++) {
        crc ^= payload.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if ((crc & 0x8000) !== 0) crc = (crc << 1) ^ 0x1021;
            else crc = crc << 1;
        }
    }
    return payload + (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

// ==========================================
// LÓGICA DE INTERFACE
// ==========================================
document.querySelectorAll('.service-card').forEach(card => {
    card.querySelector('.service-select').addEventListener('click', () => {
        const name = card.dataset.service, price = Number(card.dataset.price);
        if (card.classList.contains('selected')) {
            card.classList.remove('selected');
            card.querySelector('.service-select').textContent = "Selecionar";
            state.selectedServices = state.selectedServices.filter(s => s.name !== name);
            state.totalPrice -= price;
        } else {
            card.classList.add('selected');
            card.querySelector('.service-select').textContent = "Adicionado ✓";
            state.selectedServices.push({ name, price });
            state.totalPrice += price;
        }
        document.getElementById('total-value').textContent = `R$ ${state.totalPrice.toFixed(2)}`;
        document.getElementById('confirm-btn').disabled = state.selectedServices.length === 0;
    });
});

document.querySelectorAll('.payment-button').forEach(btn => {
    btn.addEventListener('click', () => {
        state.paymentMethod = btn.dataset.method;
        document.querySelectorAll('.payment-button').forEach(b => b.classList.toggle('active', b === btn));
    });
});

// ==========================================
// FUNÇÃO DE AGENDAMENTO E ROTEAMENTO
// ==========================================
async function confirmBooking() {
    const btn = document.getElementById('confirm-btn');
    btn.textContent = 'Processando...'; 
    btn.disabled = true;
    
    const clientName = document.getElementById('client-name').value || 'Cliente';
    const servicosNomes = state.selectedServices.map(s => s.name).join(', ');

    try {
        // FLUXO 1: PIX 100% INDEPENDENTE (SEM MERCADO PAGO)
        if (state.paymentMethod === 'pix') {
            // Gera o código na hora, sem internet
            const pixCode = gerarPayloadPix(MINHA_CHAVE_PIX, NOME_RECEBEDOR, CIDADE_RECEBEDOR, state.totalPrice);
            
            // Usa uma API pública gratuita apenas para desenhar o QR Code na tela
            const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixCode)}`;
            
            document.getElementById('qr-code-img').src = qrCodeUrl;
            document.getElementById('pix-copy-paste').value = pixCode;
            document.getElementById('pix-modal').style.display = 'flex';
            
            document.getElementById('btn-check-payment').onclick = () => {
                const msg = `Olá! Fiz o Pix de R$ ${state.totalPrice.toFixed(2)} do agendamento:\n*Cliente:* ${clientName}\n*Serviços:* ${servicosNomes}`;
                window.open(`https://wa.me/5511915723418?text=${encodeURIComponent(msg)}`, '_blank');
                location.reload();
            };
        } 
        // FLUXO 2: CARTÃO DE CRÉDITO (CONTINUA INDO PARA O MERCADO PAGO VIA SUPABASE)
        else {
            const { data, error } = await supabaseClient.functions.invoke('criar-pagamento', {
                body: { items: state.selectedServices, method: 'card' }
            });
            if (error) throw error;
            
            const msg = `Olá! Paguei via Cartão:\n*Cliente:* ${clientName}\n*Serviços:* ${servicosNomes}`;
            localStorage.setItem('zapAgendamento', `https://wa.me/5511915723418?text=${encodeURIComponent(msg)}`);
            window.location.href = data.init_point;
        }
    } catch (err) { 
        alert('Erro: ' + err.message); 
    } finally {
        btn.textContent = 'Confirmar Agendamento'; 
        btn.disabled = false; 
    }
}

function copyPixCode() {
    const input = document.getElementById('pix-copy-paste');
    input.select(); 
    navigator.clipboard.writeText(input.value); 
    alert('Código Pix Copiado com sucesso!');
}

document.getElementById('confirm-btn').addEventListener('click', confirmBooking);

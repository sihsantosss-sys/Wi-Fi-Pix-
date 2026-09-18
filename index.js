const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || 'SEU_ACCESS_TOKEN_DO_MERCADO_PAGO';
const MIKROTIK_IP = process.env.MIKROTIK_IP || 'IP_OU_DNS_DO_SEU_MIKROTIK';
const MIKROTIK_USER = process.env.MIKROTIK_USER || 'admin';
const MIKROTIK_PASS = process.env.MIKROTIK_PASS || 'sua_senha';

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota para criar o Pix
app.post('/criar-pix', async (req, res) => {
    const { valor, whatsapp } = req.body;

    try {
        const response = await axios.post('https://api.mercadopago.com/v1/payments', {
            transaction_amount: parseFloat(valor || 5.00),
            description: `Acesso Wi-Fi - R$ ${valor}`,
            payment_method_id: 'pix',
            payer: {
                email: 'cliente@wififesta.com'
            },
            external_reference: whatsapp || 'desconhecido' 
        }, {
            headers: {
                'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                'X-Idempotency-Key': Date.now().toString()
            }
        });

        const paymentData = response.data;
        
        res.json({
            idPagamento: paymentData.id,
            qr_code_base64: paymentData.point_of_interaction.transaction_data.qr_code_base64,
            copia_e_cola: paymentData.point_of_interaction.transaction_data.qr_code
        });

    } catch (error) {
        console.error(error.response?.data || error.message);
        res.status(500).json({ error: 'Erro ao gerar PIX' });
    }
});

// NOVO: Rota para o frontend consultar o estado do pagamento periodicamente
app.get('/verificar-pagamento/:id', async (req, res) => {
    const paymentId = req.params.id;

    try {
        const response = await axios.get(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` }
        });

        const status = response.data.status; // 'pending', 'approved', etc.
        const clienteRef = response.data.external_reference;

        if (status === 'approved') {
            console.log(`Pagamento ${paymentId} aprovado via Polling! Liberando cliente: ${clienteRef}`);
            await liberarClienteNoMikroTik(clienteRef);
        }

        res.json({ status });
    } catch (error) {
        console.error('Erro ao verificar pagamento:', error.response?.data || error.message);
        res.status(500).json({ error: 'Erro ao consultar pagamento' });
    }
});

app.post('/webhook-pagamento', async (req, res) => {
    const evento = req.body;
    if (evento.type === 'payment') {
        const paymentId = evento.data.id;
        try {
            const response = await axios.get(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
                headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` }
            });
            const pagamento = response.data;
            if (pagamento.status === 'approved') {
                const clienteRef = pagamento.external_reference;
                console.log(`Pagamento aprovado via Webhook! Liberando: ${clienteRef}`);
                await liberarClienteNoMikroTik(clienteRef);
            }
            res.sendStatus(200);
        } catch (error) {
            console.error('Erro ao processar webhook:', error.message);
            res.sendStatus(500);
        }
    } else {
        res.sendStatus(200);
    }
});

async function liberarClienteNoMikroTik(identificador) {
    console.log(`Enviando comando para o MikroTik liberar: ${identificador}`);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

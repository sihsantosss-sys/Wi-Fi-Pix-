const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const MP_ACCESS_TOKEN = 'SEU_ACCESS_TOKEN_DO_MERCADO_PAGO';
const MIKROTIK_IP = 'IP_OU_DNS_DO_SEU_MIKROTIK';
const MIKROTIK_USER = 'admin';
const MIKROTIK_PASS = 'sua_senha';

app.post('/criar-pix', async (req, res) => {
    const { macCliente } = req.body;

    try {
        const response = await axios.post('https://api.mercadopago.com/v1/payments', {
            transaction_amount: 5.00,
            description: 'Acesso Wi-Fi - 2 Horas',
            payment_method_id: 'pix',
            payer: {
                email: 'cliente@wififesta.com'
            },
            external_reference: macCliente 
        }, {
            headers: {
                'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        const paymentData = response.data;
        res.json({
            idPagamento: paymentData.id,
            qrCode: paymentData.point_of_interaction.transaction_data.qr_code_base64,
            copiaECola: paymentData.point_of_interaction.transaction_data.qr_code
        });

    } catch (error) {
        console.error(error.response?.data || error.message);
        res.status(500).json({ erro: 'Erro ao gerar PIX' });
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
                const macCliente = pagamento.external_reference;
                console.log(`Pagamento aprovado! Liberando o MAC: ${macCliente}`);
                await liberarClienteNoMikroTik(macCliente);
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

async function liberarClienteNoMikroTik(mac) {
    console.log(`Enviando comando para o MikroTik liberar o MAC: ${mac}`);
}

app.listen(3000, () => {
    console.log('Servidor rodando na porta 3000');
});

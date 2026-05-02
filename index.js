const wppconnect = require('@wppconnect-team/wppconnect');
const express = require('express');

const app = express();
app.use(express.json());

let client = null;

// Démarrage WhatsApp
wppconnect.create({
  session: 'whatsapp-bot',

  autoClose: 0, // ✅ NE JAMAIS fermer automatiquement

  catchQR: (base64Qr) => {
    console.log('QR CODE (scanner avec WhatsApp Business)');
    console.log(base64Qr);
  },

  statusFind: (status) => {
    console.log('Status WhatsApp:', status);
  },

  puppeteerOptions: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  }
})
.then((wpp) => {
  client = wpp;
  console.log('WhatsApp prêt');

  // 🔁 Reconnexion automatique si déconnexion
  client.onStateChange((state) => {
    console.log('State changed:', state);

    if (
      state === 'CONFLICT' ||
      state === 'UNPAIRED' ||
      state === 'UNLAUNCHED'
    ) {
      console.log('Relance WhatsApp...');
      client.useHere();
    }
  });

})
.catch((err) => {
  console.error('Erreur WhatsApp:', err);
});


// Webhook d’envoi
app.post('/send', async (req, res) => {
  const { to, message } = req.body;

  if (!client) {
    return res.status(503).send('WhatsApp non prêt');
  }

  try {
    await client.sendText(to, message);
    res.status(200).send('Message envoyé');
  } catch (err) {
    console.error('Erreur envoi:', err);
    res.status(500).send(err.toString());
  }
});

app.listen(4000, '0.0.0.0', () => {
  console.log('Webhook actif sur le port 4000');
});
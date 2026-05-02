const wppconnect = require('@wppconnect-team/wppconnect');
const express = require('express');

const app = express();
app.use(express.json({ limit: '20mb' })); // marge si n8n forward du base64

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


/**
 * Récupère un fichier depuis le site (https://whatsapp.nas-nexus.fr/api/files/…)
 * en envoyant l'X-API-Key. Renvoie { dataUrl, mime, filename }.
 */
async function fetchAttachment(url, fallbackFilename) {
  const apiKey = process.env.SITE_API_KEY || '';
  const response = await fetch(url, {
    headers: { 'X-API-Key': apiKey },
  });
  if (!response.ok) {
    throw new Error(`fetch ${response.status} ${response.statusText}`);
  }
  const buf = Buffer.from(await response.arrayBuffer());
  const base64 = buf.toString('base64');
  const mime = response.headers.get('content-type') || 'application/octet-stream';
  const dataUrl = `data:${mime};base64,${base64}`;
  // Si le filename n'est pas fourni, on le devine depuis l'URL.
  const filename =
    fallbackFilename ||
    decodeURIComponent(new URL(url).pathname.split('/').pop() || 'fichier');
  return { dataUrl, mime, filename };
}

// Webhook d'envoi
app.post('/send', async (req, res) => {
  const { to, message, attachment_url, attachment_filename } = req.body;

  if (!client) {
    return res.status(503).json({ ok: false, error: 'WhatsApp non prêt' });
  }
  if (!to) {
    return res.status(400).json({ ok: false, error: 'Champ "to" manquant' });
  }

  try {
    if (attachment_url) {
      // ─── Avec pièce jointe ──────────────────────────────────────────
      const { dataUrl, mime, filename } = await fetchAttachment(
        attachment_url,
        attachment_filename
      );
      const caption = message || '';

      if (mime.startsWith('image/')) {
        // Image avec légende
        await client.sendImageFromBase64(to, dataUrl, filename, caption);
      } else if (mime.startsWith('audio/')) {
        // Note vocale (la légende ne marche pas avec sendVoice → on envoie le texte à part)
        await client.sendVoiceBase64(to, dataUrl);
        if (caption) await client.sendText(to, caption);
      } else {
        // Vidéo, PDF, doc, etc. — sendFile gère tout avec caption
        await client.sendFileFromBase64(to, dataUrl, filename, caption);
      }
    } else {
      // ─── Texte simple ───────────────────────────────────────────────
      if (!message) {
        return res
          .status(400)
          .json({ ok: false, error: 'Ni "message" ni "attachment_url" fourni' });
      }
      await client.sendText(to, message);
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Erreur envoi:', err);
    res
      .status(500)
      .json({ ok: false, error: err.message || err.toString() });
  }
});

// Healthcheck pratique pour n8n / monitoring
app.get('/health', (_req, res) => {
  res.json({ ok: true, ready: client !== null });
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Webhook actif sur le port ${PORT}`);
});

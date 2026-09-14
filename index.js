const wppconnect = require('@wppconnect-team/wppconnect');
const express = require('express');

const app = express();
app.use(express.json({ limit: '20mb' })); // marge si n8n forward du base64

let client = null;

// Correspondance id-WhatsApp -> notre id de message, remplie à l'envoi et
// utilisée par onAck pour renvoyer l'accusé au site. Bornée pour éviter que
// la map grossisse indéfiniment.
const sentMap = new Map();
function rememberSent(waId, ourId) {
  if (!waId || !ourId) return;
  if (sentMap.size > 5000) {
    // supprime la plus ancienne entrée
    const firstKey = sentMap.keys().next().value;
    if (firstKey !== undefined) sentMap.delete(firstKey);
  }
  sentMap.set(String(waId), String(ourId));
}
function extractWaId(result) {
  if (!result) return '';
  const id = result.id ?? result;
  if (typeof id === 'string') return id;
  return String(id?._serialized || id?.id?._serialized || id || '');
}

// URL publique du site (pour poster les accusés). Ex: https://whatsapp.nas-nexus.fr
const SITE_URL = (process.env.SITE_URL || '').replace(/\/+$/, '');
const SITE_API_KEY = process.env.SITE_API_KEY || '';

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

  // 📩 Accusés de réception : envoyé (1) → reçu (2) → lu (3) → écouté (4).
  // On relaie au site l'accusé pour NOTRE id de message.
  client.onAck(async (ack) => {
    try {
      const waId = extractWaId(ack);
      const ourId = sentMap.get(waId);
      if (!ourId) return; // pas un message qu'on a envoyé (ou déjà oublié)
      if (!SITE_URL) return; // SITE_URL non configuré → on ignore
      await fetch(`${SITE_URL}/api/ack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': SITE_API_KEY,
        },
        body: JSON.stringify({ id: ourId, ack: ack.ack }),
      });
    } catch (err) {
      console.error('Relai accusé échoué:', err.message || err);
    }
  });
})
.catch((err) => {
  console.error('Erreur WhatsApp:', err);
});


/**
 * Récupère un fichier depuis le site (https://<site>/api/files/…) en envoyant
 * l'X-API-Key. Renvoie { dataUrl, mime, filename }.
 */
async function fetchAttachment(url, fallbackFilename) {
  const response = await fetch(url, {
    headers: { 'X-API-Key': SITE_API_KEY },
  });
  if (!response.ok) {
    throw new Error(`fetch ${response.status} ${response.statusText}`);
  }
  const buf = Buffer.from(await response.arrayBuffer());
  const base64 = buf.toString('base64');
  const mime = response.headers.get('content-type') || 'application/octet-stream';
  const dataUrl = `data:${mime};base64,${base64}`;
  const filename =
    fallbackFilename ||
    decodeURIComponent(new URL(url).pathname.split('/').pop() || 'fichier');
  return { dataUrl, mime, filename };
}

// Webhook d'envoi
app.post('/send', async (req, res) => {
  const {
    to,
    message,
    attachment_url,
    attachment_filename,
    id,
    type,
    poll_options,
    poll_multi,
  } = req.body;

  if (!client) {
    return res.status(503).json({ ok: false, error: 'WhatsApp non prêt' });
  }
  if (!to) {
    return res.status(400).json({ ok: false, error: 'Champ "to" manquant' });
  }

  try {
    let result;

    if (type === 'poll') {
      // ─── Sondage ────────────────────────────────────────────────────
      const options = String(poll_options || '')
        .split('|')
        .map((o) => o.trim())
        .filter(Boolean);
      if (!message || options.length < 2) {
        return res.status(400).json({
          ok: false,
          error: 'Sondage invalide (question + 2 choix minimum)',
        });
      }
      const multi =
        poll_multi === true ||
        poll_multi === 'TRUE' ||
        poll_multi === 'true' ||
        poll_multi === 1 ||
        poll_multi === '1';
      result = await client.sendPollMessage(to, message, options, {
        selectableCount: multi ? options.length : 1,
      });
    } else if (attachment_url) {
      // ─── Avec pièce jointe ──────────────────────────────────────────
      const { dataUrl, mime, filename } = await fetchAttachment(
        attachment_url,
        attachment_filename
      );
      const caption = message || '';

      if (mime.startsWith('image/')) {
        result = await client.sendImageFromBase64(to, dataUrl, filename, caption);
      } else if (mime.startsWith('audio/')) {
        result = await client.sendVoiceBase64(to, dataUrl);
        if (caption) await client.sendText(to, caption);
      } else {
        result = await client.sendFileFromBase64(to, dataUrl, filename, caption);
      }
    } else {
      // ─── Texte simple ───────────────────────────────────────────────
      if (!message) {
        return res
          .status(400)
          .json({ ok: false, error: 'Ni "message" ni "attachment_url" fourni' });
      }
      result = await client.sendText(to, message);
    }

    // Mémorise la correspondance pour les accusés de réception.
    rememberSent(extractWaId(result), id);

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

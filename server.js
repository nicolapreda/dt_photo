require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');
const TelegramBot = require('node-telegram-bot-api');
const app = express();

// GoHighLevel API - Commentato temporaneamente
// const GOHIGHLEVEL_API_KEY = process.env.GOHIGHLEVEL_API_KEY;

// Configurazione Google Sheets
const GOOGLE_SHEETS_CREDENTIALS = process.env.GOOGLE_SHEETS_CREDENTIALS;
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

// Configurazione Telegram Bot
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

let telegramBot;
if (TELEGRAM_BOT_TOKEN) {
  telegramBot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });
}

// Middleware per leggere i dati del form
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve i file statici (HTML, CSS, JS, immagini)
app.use(express.static(path.join(__dirname, 'public')));

// Funzione per salvare lead localmente come backup
function saveLeadLocally(leadData) {
  const timestamp = new Date().toISOString();
  const leadWithTimestamp = {
    ...leadData,
    timestamp,
    source: 'landing-page'
  };
  
  const leadsFile = path.join(__dirname, 'leads-backup.json');
  let leads = [];
  
  // Leggi leads esistenti
  if (fs.existsSync(leadsFile)) {
    try {
      const fileContent = fs.readFileSync(leadsFile, 'utf8');
      leads = JSON.parse(fileContent);
    } catch (err) {
      console.error('Errore lettura file leads:', err);
    }
  }
  
  // Aggiungi nuovo lead
  leads.push(leadWithTimestamp);
  
  // Salva file aggiornato
  try {
    fs.writeFileSync(leadsFile, JSON.stringify(leads, null, 2));
    console.log('💾 Lead salvato in leads-backup.json');
    return true;
  } catch (err) {
    console.error('❌ Errore salvataggio lead:', err);
    return false;
  }
}

// Funzione per salvare lead su Google Sheets
async function saveToGoogleSheets(leadData) {
  try {
    if (!GOOGLE_SHEETS_CREDENTIALS || !GOOGLE_SHEET_ID) {
      console.log('⚠️ Credenziali Google Sheets non configurate');
      return false;
    }

    console.log('🔄 Inizializzazione connessione Google Sheets...');
    
    // Parsing delle credenziali JSON
    const credentials = JSON.parse(GOOGLE_SHEETS_CREDENTIALS);
    console.log(`📧 Service Account: ${credentials.client_email}`);
    console.log(`📊 Sheet ID: ${GOOGLE_SHEET_ID}`);
    
    // Autenticazione con Google Sheets API (nuovo metodo)
    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    console.log('🔐 Autenticazione JWT configurata...');
    
    // Test della connessione prima di procedere
    try {
      await auth.authorize();
      console.log('✅ Autenticazione JWT riuscita');
    } catch (authError) {
      console.error('❌ Errore autenticazione JWT:', authError.message);
      return false;
    }

    const sheets = google.sheets({ version: 'v4', auth });

    // Preparazione dati per il foglio
    const now = new Date();
    const timestamp = now.toLocaleString('it-IT', {
      timeZone: 'Europe/Rome',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const values = [
      [
        timestamp,
        leadData.name,
        leadData.email,
        leadData.phone,
        leadData.challenge || 'Non specificato',
        leadData.timePreference || 'Non specificato',
        'Landing Page Domora'
      ]
    ];

    // Prima verifichiamo se il foglio "Leads" esiste, altrimenti usiamo il primo foglio
    let rangeName = 'A:G'; // Range semplice senza nome foglio (rimosso business = 7 colonne)

    try {
      console.log('🔍 Verifica esistenza foglio "Leads"...');
      // Tenta prima con il foglio "Leads"
      const testRequest = {
        spreadsheetId: GOOGLE_SHEET_ID,
        range: 'Leads!A1:G1',
      };
      await sheets.spreadsheets.values.get(testRequest);
      rangeName = 'Leads!A:G'; // Se funziona, usa questo
      console.log('✅ Foglio "Leads" trovato');
    } catch (error) {
      console.log('⚠️ Foglio "Leads" non trovato, uso il primo foglio disponibile');
      console.log('Errore dettagli:', error.message);
      rangeName = 'A:G'; // Usa il primo foglio
    }

    // Verifica se ci sono già intestazioni, altrimenti le crea
    try {
      console.log('📋 Verifica intestazioni del foglio...');
      const headersRequest = {
        spreadsheetId: GOOGLE_SHEET_ID,
        range: rangeName.replace('A:G', 'A1:G1'),
      };
      const headersResponse = await sheets.spreadsheets.values.get(headersRequest);
      
      if (!headersResponse.data.values || headersResponse.data.values.length === 0) {
        console.log('📝 Creazione intestazioni...');
        // Aggiungi intestazioni (rimosso Tipo Business)
        const headers = [
          ['Data/Ora', 'Nome', 'Email', 'Telefono', 'Sfida Principale', 'Preferenza Oraria', 'Fonte']
        ];
        
        await sheets.spreadsheets.values.update({
          spreadsheetId: GOOGLE_SHEET_ID,
          range: rangeName.replace('A:G', 'A1:G1'),
          valueInputOption: 'USER_ENTERED',
          resource: { values: headers },
        });
        
        console.log('✅ Intestazioni create nel foglio Google Sheets');
      } else {
        console.log('✅ Intestazioni già presenti');
      }
    } catch (error) {
      console.error('❌ Errore verifica/creazione intestazioni:', error.message);
      console.error('Dettagli completi:', error);
    }

    // Inserimento nel foglio Google
    console.log('💾 Tentativo di inserimento dati nel foglio...');
    const request = {
      spreadsheetId: GOOGLE_SHEET_ID,
      range: rangeName,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values,
      },
    };

    console.log('📊 Dati da inserire:', values);
    const response = await sheets.spreadsheets.values.append(request);
    console.log('✅ Lead salvato su Google Sheets:', response.data.updates);
    return true;

  } catch (error) {
    console.error('❌ Errore Google Sheets:', error.message);
    if (error.code) {
      console.error('Codice errore:', error.code);
    }
    if (error.details) {
      console.error('Dettagli errore:', error.details);
    }
    return false;
  }
}

// Funzione per inviare notifica Telegram
async function sendTelegramNotification(leadData) {
  try {
    if (!telegramBot || !TELEGRAM_CHAT_ID) {
      console.log('⚠️ Bot Telegram non configurato');
      return false;
    }

    const timestamp = new Date().toLocaleString('it-IT', {
      timeZone: 'Europe/Rome',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    const message = `🔥 *NUOVO LEAD DOMORA* 🔥

👤 *Nome:* ${leadData.name}
📧 *Email:* ${leadData.email}
📱 *Telefono:* ${leadData.phone}
❓ *Sfida principale:* ${leadData.challenge || 'Non specificato'}
⏰ *Preferenza oraria:* ${leadData.timePreference || 'Non specificato'}

📅 *Data/Ora:* ${timestamp}
🌐 *Fonte:* Landing Page Domora

#Lead #Domora #LandingPage`;

    await telegramBot.sendMessage(TELEGRAM_CHAT_ID, message, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    });

    console.log('✅ Notifica Telegram inviata');
    return true;

  } catch (error) {
    console.error('❌ Errore Telegram:', error.message);
    return false;
  }
}


app.post('/submit-form', async (req, res) => {
  console.log('📥 Richiesta ricevuta:', req.body);
  const { name, email, phone, business, challenge, timePreference } = req.body;

  // Validazione base
  if (!name || !email || !phone) {
    console.log('❌ Dati mancanti:', { name, email, phone });
    return res.status(400).json({ error: 'Tutti i campi sono obbligatori' });
  }

  // Preparazione dati lead (rimosso business)
  const leadData = { 
    name, 
    email, 
    phone, 
    challenge: challenge || "Non specificato",
    timePreference: timePreference || "Non specificato",
    firstName: name.split(' ')[0] || name,
    lastName: name.split(' ').slice(1).join(' ') || ''
  };

  try {
    console.log('💾 Elaborando nuovo lead...');
    
    // Risultati delle operazioni
    const results = {
      localBackup: false,
      googleSheets: false,
      telegram: false
    };

    // 1. Salvataggio backup locale (sempre)
    results.localBackup = saveLeadLocally(leadData);
    
    // 2. Salvataggio su Google Sheets
    results.googleSheets = await saveToGoogleSheets(leadData);
    
    // 3. Notifica Telegram
    results.telegram = await sendTelegramNotification(leadData);

    // Log dei risultati
    console.log('� Risultati elaborazione lead:', results);

    // Risposta basata sui risultati
    if (results.googleSheets || results.localBackup) {
      let message = 'Lead registrato con successo!';
      const details = [];
      
      if (results.googleSheets) details.push('Google Sheets');
      if (results.telegram) details.push('Notifica Telegram');
      if (results.localBackup) details.push('Backup locale');
      
      if (details.length > 0) {
        message += ` (${details.join(', ')})`;
      }

      res.json({ 
        success: true, 
        message,
        details: results
      });
    } else {
      res.status(500).json({ 
        error: 'Errore nel salvataggio del lead',
        details: results
      });
    }

  } catch (err) {
    console.error('💥 Errore server:', err);
    
    // Fallback: almeno salvataggio locale
    const localSaved = saveLeadLocally(leadData);
    
    if (localSaved) {
      res.json({ 
        success: true, 
        message: 'Lead salvato in modalità di emergenza',
        fallback: true
      });
    } else {
      res.status(500).json({ error: 'Errore critico del server' });
    }
  }

  /* GOHIGHLEVEL INTEGRATION - Commentato temporaneamente
  // QUI: Chiamata a GoHighLevel API
  try {
    console.log('🔄 Invio a GoHighLevel...');
    
    // Prova prima con l'API v1 (più recente)
    const apiUrl = "https://rest.gohighlevel.com/v1/contacts/";
    console.log('🌐 URL API:', apiUrl);
    
    const payload = {
      email,
      phone,
      firstName: name.split(' ')[0] || name,
      lastName: name.split(' ').slice(1).join(' ') || '',
      name: name,
      tags: ["Landing SSA"],  // Tag automatico per identificare lead dalla landing
      source: "Landing Page SSA",
      dateAdded: new Date().toISOString(),  // Aggiungiamo timestamp esplicito
      customFields: [
        {
          key: "business_type",
          field_value: business || "Non specificato"
        },
        {
          key: "challenge",
          field_value: challenge || "Non specificato"
        }
      ]
    };
    console.log('📤 Payload con timestamp:', payload);
    console.log('🕐 Timestamp attuale:', new Date().toISOString());
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GOHIGHLEVEL_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
    });

    console.log('📊 Risposta GoHighLevel status:', response.status);
    
    if (response.ok) {
      const responseData = await response.json();
      console.log('✅ Lead inviato con successo a GoHighLevel:', responseData);
      console.log('📅 Timestamp invio GoHighLevel:', new Date().toISOString());
      console.log('🆔 ID contatto GoHighLevel:', responseData.contact?.id || 'Non disponibile');
      res.json({ success: true, message: 'Lead inviato con successo', ghlId: responseData.contact?.id });
    } else {
      const err = await response.text();
      console.error("❌ Errore GHL:", err);
      
      // FALLBACK: Salva lead localmente se API fallisce
      console.log('⚠️ MODALITÀ FALLBACK: Salvando lead localmente');
      const leadSaved = saveLeadLocally(payload);
      
      if (leadSaved) {
        console.log('✅ Lead salvato con successo in backup locale');
        res.json({ 
          success: true, 
          message: 'Lead ricevuto e salvato (verrà processato appena possibile)',
          fallback: true 
        });
      } else {
        res.status(500).json({ error: 'Errore nel salvataggio del lead' });
      }
    }

  } catch (err) {
    console.error('💥 Errore server:', err);
    
    // FALLBACK anche per errori di rete
    console.log('⚠️ FALLBACK per errore di rete: Salvando lead localmente');
    const leadData = { 
      name, 
      email, 
      phone, 
      business: business || "Non specificato",
      challenge: challenge || "Non specificato",
      firstName: name.split(' ')[0] || name 
    };
    const leadSaved = saveLeadLocally(leadData);
    
    if (leadSaved) {
      res.json({ 
        success: true, 
        message: 'Lead ricevuto e salvato (verrà processato appena possibile)',
        fallback: true 
      });
    } else {
      res.status(500).json({ error: 'Errore interno del server' });
    }
  }
  */
});

/* GOHIGHLEVEL TEST ENDPOINT - Commentato temporaneamente
app.get('/test-ghl', async (req, res) => {
  try {
    console.log('🧪 Test connessione GoHighLevel...');
    console.log('🕐 Timestamp test:', new Date().toISOString());
    
    const apiUrl = "https://rest.gohighlevel.com/v1/contacts/";
    
    const testPayload = {
      email: `test-${Date.now()}@ssaagency.it`,
      phone: "+393701234567",
      firstName: "Test",
      lastName: "Connection",
      name: "Test Connection",
      tags: ["Landing SSA", "Test"],
      source: "API Test",
      dateAdded: new Date().toISOString(),
      customFields: [
        {
          key: "business_type",
          field_value: "Test Business"
        },
        {
          key: "challenge",
          field_value: "Test Challenge"
        }
      ]
    };
    
    console.log('📤 Test payload:', testPayload);
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GOHIGHLEVEL_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(testPayload),
    });
    
    console.log('📊 Test response status:', response.status);
    
    if (response.ok) {
      const responseData = await response.json();
      console.log('✅ Test GoHighLevel riuscito:', responseData);
      res.json({ 
        success: true, 
        message: 'Connessione GoHighLevel OK',
        timestamp: new Date().toISOString(),
        response: responseData 
      });
    } else {
      const err = await response.text();
      console.error("❌ Test GoHighLevel fallito:", err);
      res.status(500).json({ 
        success: false, 
        error: err,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('💥 Errore test GoHighLevel:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});
*/

// Endpoint per testare le integrazioni (Google Sheets + Telegram)
app.get('/test-integrations', async (req, res) => {
  console.log('🧪 Test integrazioni...');
  
  const testLead = {
    name: 'Test User',
    email: 'test@domora.it',
    phone: '+39 123 456 7890',
    challenge: 'Test Challenge',
    timePreference: 'Mattina (9-12)',
    firstName: 'Test',
    lastName: 'User'
  };

  const results = {
    googleSheets: false,
    telegram: false,
    localBackup: false
  };

  try {
    // Test Google Sheets
    results.googleSheets = await saveToGoogleSheets(testLead);
    
    // Test Telegram
    results.telegram = await sendTelegramNotification(testLead);
    
    // Test backup locale
    results.localBackup = saveLeadLocally(testLead);

    console.log('📊 Risultati test:', results);

    res.json({
      success: true,
      message: 'Test integrazioni completato',
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Errore test integrazioni:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      results,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint per visualizzare i lead salvati localmente
app.get('/leads', (req, res) => {
  const leadsFile = path.join(__dirname, 'leads-backup.json');
  
  if (!fs.existsSync(leadsFile)) {
    return res.json({ leads: [], message: 'Nessun lead salvato' });
  }
  
  try {
    const fileContent = fs.readFileSync(leadsFile, 'utf8');
    const leads = JSON.parse(fileContent);
    res.json({ 
      leads, 
      count: leads.length,
      message: `${leads.length} lead(s) salvati localmente` 
    });
  } catch (err) {
    console.error('Errore lettura leads:', err);
    res.status(500).json({ error: 'Errore nel leggere i lead salvati' });
  }
});


const PORT = process.env.PORT || 3004;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server attivo su http://0.0.0.0:${PORT}`));

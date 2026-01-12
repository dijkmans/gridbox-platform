// test-sms.js
import fetch from 'node-fetch';

const API_URL = "https://jouw-cloud-run-url.a.run.app/api/sms"; // Of http://localhost:8080/api/sms
const TEST_PHONE = "+324XXXXXXXX"; // Jouw nummer dat in Firestore staat

async function simulateSms(message) {
  console.log(`🚀 Test: Versturen van "${message}"...`);
  
  const params = new URLSearchParams();
  params.append('From', TEST_PHONE);
  params.append('Body', message);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    const text = await response.text();
    console.log("📩 Antwoord van server:");
    console.log(text);
  } catch (err) {
    console.error("❌ Fout bij testen:", err.message);
  }
}

// Voer de test uit
simulateSms("open 1");

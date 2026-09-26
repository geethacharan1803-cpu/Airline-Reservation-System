import { Router, Request, Response } from 'express';

export const chatRouter = Router();

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const SYSTEM_PROMPT = `You are SkyVoyage's AI travel assistant. You help passengers with:
- Finding and booking flights across 22 worldwide destinations (including Visakhapatnam VTZ, Hyderabad HYD, Delhi DEL, Mumbai BOM, Bengaluru BLR, New York JFK, London LHR, Dubai DXB, Singapore SIN, Tokyo NRT, etc.)
- Understanding fare classes (Economy, Business, First)
- Baggage policies (Economy: 1×23kg checked + 7kg cabin, Business: 2×32kg + 10kg cabin, First: 3×32kg + 10kg cabin)
- Seat selection guidance and SeatWatch upgrade bidding system
- Booking modifications and cancellations
- Refund policies (Full refund if cancelled 24+ hours before departure, 50% if 6-24 hours, no refund under 6 hours)
- Check-in procedures (Online check-in opens 48 hours before departure)
- Travel document requirements

Be helpful, concise, and professional. Format responses in clear, readable paragraphs. Use bullet points for lists.`;

// In-Memory Domain Knowledge Responder
function getDomainExpertResponse(query: string): string {
  const q = query.toLowerCase();

  // Baggage Inquiries
  if (q.includes('bag') || q.includes('luggage') || q.includes('weight') || q.includes('carry-on') || q.includes('cabin bag')) {
    return `**SkyVoyage Baggage Allowance by Class:**\n\n` +
      `• **Economy Class:** 1 checked bag up to 23 kg (50 lbs) + 1 cabin bag up to 7 kg + 1 small personal item.\n` +
      `• **Business Class:** 2 checked bags up to 32 kg (70 lbs) each + 1 cabin bag up to 10 kg + 1 personal item.\n` +
      `• **First Class:** 3 checked bags up to 32 kg (70 lbs) each + 2 cabin bags (total 14 kg) + 1 personal item.\n\n` +
      `*Excess baggage is charged at $45 per additional piece or $15/kg for overweight bags up to 32 kg.*`;
  }

  // Check-in Inquiries
  if (q.includes('check-in') || q.includes('checkin') || q.includes('boarding pass') || q.includes('gate') || q.includes('airport arrive')) {
    return `**SkyVoyage Check-in Procedures:**\n\n` +
      `• **Online Check-in:** Opens **48 hours** prior to departure and closes **60 minutes** (international) or **45 minutes** (domestic) before departure.\n` +
      `• **Mobile Boarding Pass:** Available immediately upon online check-in. Download to Apple Wallet/Google Wallet or print directly.\n` +
      `• **Airport Counter Check-in:** Opens 3 hours before departure. Baggage drop closes 60 minutes before scheduled departure.\n` +
      `• **Boarding Gate:** Closes strictly **20 minutes** prior to departure. Please ensure you are at the gate on time.`;
  }

  // Cancellation and Refund Inquiries
  if (q.includes('cancel') || q.includes('refund') || q.includes('fee') || q.includes('change') || q.includes('modify')) {
    return `**SkyVoyage Cancellation & Refund Policy:**\n\n` +
      `• **More than 24 Hours before Departure:** **100% Full Refund** credited to the original payment method within 5–7 business days (zero cancellation penalty).\n` +
      `• **6 to 24 Hours before Departure:** **50% Partial Refund** credited to payment method or 60% as SkyVoyage travel credit voucher.\n` +
      `• **Less than 6 Hours before Departure:** Non-refundable. Taxes and government airport fees remain eligible for refund upon request.\n` +
      `• **Flight Rescheduling:** Date and time changes are allowed up to 12 hours before departure for a standard $35 fare difference fee.`;
  }

  // Seat Selection, Upgrades, and SeatWatch Inquiries
  if (q.includes('seat') || q.includes('upgrade') || q.includes('watch') || q.includes('legroom') || q.includes('window') || q.includes('aisle')) {
    return `**SkyVoyage Seat Selection & SeatWatch Upgrades:**\n\n` +
      `• **Interactive 3D & 2D Seat Maps:** Select your exact seat during booking with our real-time interactive cabin visualizer.\n` +
      `• **Seat Types:** Standard, Preferred Window/Aisle, Extra Legroom (exit row, +$25-$45).\n` +
      `• **SeatWatch Upgrade Queue:** If your desired seat or cabin class is currently taken, opt into **SeatWatch**. When another passenger cancels or changes seats, our priority dispatch algorithm evaluates loyalty tier and upgrade bids.\n` +
      `• **60-Second Claim Window:** Notified passengers receive an exclusive 60-second reservation hold to confirm their upgrade instantly!`;
  }

  // Routes, Destinations, and Flight Search
  if (q.includes('flight') || q.includes('route') || q.includes('destination') || q.includes('vtz') || q.includes('hyd') || q.includes('del') || q.includes('bom') || q.includes('blr') || q.includes('where do you fly')) {
    return `**SkyVoyage Route Network:**\n\n` +
      `We operate non-stop and connecting flights across 22 global destinations:\n` +
      `• **India:** Visakhapatnam (VTZ), Hyderabad (HYD), Delhi (DEL), Mumbai (BOM), Bengaluru (BLR).\n` +
      `• **Middle East:** Dubai (DXB), Doha (DOH).\n` +
      `• **Europe:** London Heathrow (LHR), Paris (CDG), Frankfurt (FRA), Amsterdam (AMS).\n` +
      `• **North America:** New York (JFK), Los Angeles (LAX), San Francisco (SFO), Chicago (ORD), Miami (MIA), Atlanta (ATL).\n` +
      `• **Asia-Pacific:** Singapore (SIN), Tokyo Narita (NRT), Seoul Incheon (ICN), Hong Kong (HKG), Sydney (SYD).\n\n` +
      `*Use the search bar on our homepage to check live schedules and real-time seat availability!*`;
  }

  // PNR, Booking Management & Status
  if (q.includes('pnr') || q.includes('booking') || q.includes('reservation') || q.includes('status') || q.includes('find my')) {
    return `**Managing Your Booking:**\n\n` +
      `• **PNR Locator:** Your SkyVoyage PNR is a unique 6-character alphanumeric code (e.g., \`SK8Y2A\`) sent to your confirmation email.\n` +
      `• **Manage Booking:** Click "Manage Booking" in the top navigation bar and enter your 6-character PNR to:\n` +
      `  - View full itinerary and aircraft details\n` +
      `  - Download your confirmed ticket receipt\n` +
      `  - Change seat selection or enroll in SeatWatch\n` +
      `  - Cancel reservation with automated refund computation`;
  }

  // Payment Inquiries
  if (q.includes('pay') || q.includes('card') || q.includes('upi') || q.includes('currency') || q.includes('netbanking')) {
    return `**Accepted Payment Methods:**\n\n` +
      `• **Cards:** Major Credit & Debit Cards (Visa, Mastercard, American Express) with secure 3D-Secure authentication.\n` +
      `• **Digital & Instant:** UPI (Google Pay, PhonePe, Paytm), Net Banking across all major scheduled banks.\n` +
      `• **Seat Locking:** Once you begin checkout, your selected seats are held securely for 10 minutes so no other passenger can claim them while you complete payment.`;
  }

  // Greetings & General Help
  if (q.includes('hello') || q.includes('hi') || q.includes('hey') || q.includes('who are you') || q.includes('help')) {
    return `Hello! I am your SkyVoyage AI Travel Assistant. I am here 24/7 to help you with:\n\n` +
      `• **Flight Search & Routes:** Checking destinations (VTZ, HYD, DEL, BOM, BLR, JFK, LHR, etc.)\n` +
      `• **Baggage Allowances:** Cabin and checked weight limits by fare class\n` +
      `• **Check-in & Boarding:** Online check-in times and boarding gate rules\n` +
      `• **Seat Selection & SeatWatch:** Seat maps, upgrades, and automated waitlist\n` +
      `• **Cancellation & Refunds:** Policy tiers, fees, and PNR status lookup\n\n` +
      `What would you like assistance with today?`;
  }

  // Default Fallback
  return `Thank you for reaching out to SkyVoyage Airlines Support.\n\n` +
    `I can assist you with baggage allowances, online check-in procedures, seat upgrades & SeatWatch alerts, flight schedules across our 22 global hubs, and cancellation/refund policies.\n\n` +
    `*Could you please specify your question, or enter your departure and destination cities to check flight options?*`;
}

// Check local Ollama with strict 800ms timeout
async function tryOllama(messages: any[]): Promise<string | null> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || 'llama3.2',
        messages,
        stream: false,
        options: { temperature: 0.7, top_p: 0.9, num_predict: 400 },
      }),
      signal: AbortSignal.timeout(1200),
    });
    if (res.ok) {
      const data = await res.json() as any;
      if (data?.message?.content) {
        return data.message.content;
      }
    }
  } catch {
    // Continue to next tier
  }
  return null;
}

// Check Groq Cloud API (llama-3.1-8b-instant)
async function tryGroq(messages: any[]): Promise<string | null> {
  if (!GROQ_API_KEY) return null;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages,
        temperature: 0.7,
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json() as any;
      if (data?.choices?.[0]?.message?.content) {
        return data.choices[0].message.content;
      }
    }
  } catch {
    // Continue to next tier
  }
  return null;
}

// Check Gemini Cloud API
async function tryGemini(userMessage: string): Promise<string | null> {
  if (!GEMINI_API_KEY) return null;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${SYSTEM_PROMPT}\n\nUser Question: ${userMessage}` }],
          },
        ],
        generationConfig: { maxOutputTokens: 500, temperature: 0.7 },
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json() as any;
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    }
  } catch {
    // Continue to next tier
  }
  return null;
}

// POST /api/v1/chat — Send message to AI assistant
chatRouter.post('/', async (req: Request, res: Response) => {
  const { message, conversationHistory = [] } = req.body;

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...conversationHistory.slice(-8).map((msg: any) => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    })),
    { role: 'user', content: message },
  ];

  // Multi-tier Fallback Execution Chain
  // Tier 1: Local Ollama
  let reply = await tryOllama(messages);
  let provider = 'ollama';

  // Tier 2: Groq Cloud API
  if (!reply && GROQ_API_KEY) {
    reply = await tryGroq(messages);
    provider = 'groq-cloud';
  }

  // Tier 3: Gemini Cloud API
  if (!reply && GEMINI_API_KEY) {
    reply = await tryGemini(message);
    provider = 'gemini-cloud';
  }

  // Tier 4: Intelligent In-Memory Domain Responder
  if (!reply) {
    reply = getDomainExpertResponse(message);
    provider = 'domain-expert';
  }

  res.json({
    reply,
    provider,
    isOffline: false,
    status: 'online',
  });
});

// GET /api/v1/chat/status — Check AI assistant status (always online via fallback)
chatRouter.get('/status', async (_req: Request, res: Response) => {
  let activeProvider = 'domain-expert';
  let modelName = 'SkyVoyage In-Memory Domain AI';

  try {
    const ollamaCheck = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(800) });
    if (ollamaCheck.ok) {
      activeProvider = 'ollama';
      modelName = process.env.OLLAMA_MODEL || 'llama3.2';
    }
  } catch {
    if (GROQ_API_KEY) {
      activeProvider = 'groq-cloud';
      modelName = 'llama-3.1-8b-instant';
    } else if (GEMINI_API_KEY) {
      activeProvider = 'gemini-cloud';
      modelName = 'gemini-1.5-flash';
    }
  }

  res.json({
    status: 'online',
    provider: activeProvider,
    model: modelName,
    message: 'AI Travel Assistant is active and ready.',
  });
});

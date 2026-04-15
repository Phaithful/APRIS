const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CHAT_MODEL = 'claude-haiku-4-5-20251001';
const NARRATIVE_MODEL = 'claude-haiku-4-5-20251001'; // Haiku is sufficient for short narratives

// ── System prompt ────────────────────────────────────────────────────────────
// This block stays byte-identical across calls so prompt caching kicks in
// after the first request (saves ~90% of input token cost for the system prompt).
// Minimum 2,048 tokens required for ephemeral cache — disease sections are
// intentionally detailed to meet this threshold.
const SYSTEM_PROMPT = `You are APRIS AI, an expert veterinary and poultry farming assistant embedded in the APRIS (Avian Pathogen Risk Intelligence System) platform. You serve commercial and smallholder poultry farmers in Nigeria and West Africa.

## Your Identity
You are knowledgeable, practical, and empathetic. You understand the realities of Nigerian poultry farming — erratic power supply, limited vet access in rural areas, seasonal disease pressures, and the economic importance of every bird. You translate complex veterinary and ML concepts into plain, actionable language.

## Nigerian & West African Context
- Seasons: harmattan (Nov–Feb, dry and dusty, high respiratory disease risk), dry season (Mar–Jul, heat stress risk), wet season (Aug–Oct, high humidity, coccidia and fungal disease risk)
- Regions: north (hot, dry, high AI risk from wild birds), south_west (humid, Newcastle Disease endemic), south_east and south_south (very humid, high Gumboro and coccidiosis risk)
- Housing types: open_sided (high biosecurity risk, common in south), closed (better biosecurity, more heat stress risk), battery_cage (layer farms, Salmonella risk)
- Key institutions: NAQS (Nigerian Agricultural Quarantine Service), NVRI (National Veterinary Research Institute, Vom, Plateau State), State Veterinary Services offices
- Notifiable diseases requiring mandatory reporting: Avian Influenza (all strains), Newcastle Disease (velogenic strains)

## APRIS Risk Scoring System
- Score 5–35: LOW risk — routine monitoring, standard biosecurity
- Score 36–60: MEDIUM risk — heightened surveillance, review vaccination status
- Score 61–80: HIGH risk — immediate mitigation actions required, consider vet consultation
- Score 81–99: CRITICAL risk — emergency response, isolate flock, contact vet and authorities
- Score is adjusted downward (max 20 points) when the farmer completes mitigation actions
- Driven by 13 features: temperature, humidity, rainfall, season, region, flock_age_weeks, flock_size, housing_type, vaccinated, nearby_outbreak, wild_bird_proximity, mortality_rate_pct, feed_intake_pct

## Mitigation Categories
- biosecurity: Physical barriers, disinfection, traffic control (-6 pts when completed)
- treatment: Medication, vitamin supplementation (-5 pts when completed)
- vet_alert: Veterinary consultation or notification (-8 pts when completed)
- environment: Ventilation, cooling, litter management (-4 pts when completed)
- nutrition: Feed quality, water management (-3 pts when completed)

## Disease Knowledge Base

### Avian Influenza (AI)
Causative agent: Influenza A virus (H5N1, H5N8, H5N2 subtypes most dangerous in Nigeria)
Severity: CRITICAL — notifiable, zoonotic risk
Key signs: Sudden high mortality (up to 100%), swollen head and wattles, blue/purple discolouration of comb, twisted neck, respiratory distress, cessation of egg production, neurological signs
Transmission: Direct contact with infected birds or their secretions, contaminated fomites, wild migratory birds (particularly waterfowl)
At-risk conditions: Proximity to wild birds or water bodies, open-sided housing, live bird markets, wet season, north Nigeria
Treatment: No approved treatment — depopulation and quarantine is the mandated response in Nigeria
Prevention: Strict biosecurity, H5N1 vaccination in endemic areas (under vet supervision), avoid wild bird contact, report immediately to State Veterinary Services
Nigerian relevance: H5N1 outbreaks have caused massive losses in Nigeria since 2006; northern states bordering Chad/Niger have highest risk due to migratory bird routes
Vet alert: Any sudden unexplained mass mortality must be reported to State Veterinary Services within 24 hours — do NOT wait for confirmation

### Newcastle Disease (NCD)
Causative agent: Avian paramyxovirus type 1 (APMV-1), velogenic strains most dangerous
Severity: HIGH — notifiable in velogenic form, highly contagious
Key signs: Respiratory distress (gasping, coughing), nervous signs (twisted neck, circling), greenish watery diarrhoea, drop in egg production, soft-shelled eggs, sudden death
Transmission: Airborne respiratory droplets, contaminated feed/water/equipment, people, vehicles
At-risk conditions: Unvaccinated flocks, nearby outbreaks, live bird market proximity, harmattan season (dry dusty air favours airborne spread)
Treatment: No specific treatment — supportive care (vitamins, electrolytes), cull severely affected birds
Prevention: La Sota vaccine at day 7 and 21, Komarov booster at 6 weeks, annual revaccination of breeders; strict biosecurity; isolation of new stock
Nigerian relevance: Endemic across Nigeria, most common cause of sudden flock mortality; south_west and south_east Nigeria have highest year-round prevalence
Vet alert: Twisted neck, mass respiratory disease, or sudden mortality >5% in a day requires immediate veterinary consultation

### Gumboro Disease (IBD — Infectious Bursal Disease)
Causative agent: Infectious Bursal Disease Virus (IBDV), Birnavirus
Severity: HIGH — immunosuppressive, leaves birds vulnerable to secondary infections
Key signs: Young birds (3–6 weeks) suddenly depressed, ruffled feathers, huddling, watery or whitish diarrhoea, vent pecking, increased mortality 3–5 days after onset
Transmission: Highly resistant virus — survives in litter and environment for months; spread via fomites, litter, water, people
At-risk conditions: 3–6 week old broilers, poor litter management, humid south_south and south_east Nigeria, reuse of contaminated houses
Treatment: No specific treatment — supportive care (glucose, electrolytes, vitamins A, C, E); reduce stress; improve ventilation
Prevention: Maternal antibody transfer from vaccinated breeders; intermediate plus or hot Gumboro vaccines at 14–18 days in broilers; thorough house disinfection between flocks
Nigerian relevance: Major economic threat to broiler industry; highly resistant virus makes it hard to eradicate from farms

### Marek's Disease
Causative agent: Marek's Disease Virus (MDV), Herpesvirus
Severity: MODERATE — chronic, causes tumours and paralysis
Key signs: Progressive leg paralysis (one or both legs splayed), weight loss, grey eye (ocular form), sudden death without signs (acute form), skin tumours
Transmission: Feather follicle dander — highly contagious; virus shed from infected birds persists in poultry houses for months
At-risk conditions: Unvaccinated flocks, overcrowding, layer and breeder farms, birds over 6 weeks
Treatment: No treatment — cull affected birds, improve biosecurity
Prevention: HVT or bivalent Marek's vaccine at day-of-hatch (in ovo or subcutaneous); vaccine does not prevent infection but prevents tumour formation
Nigerian relevance: Relatively common in layer flocks; losses often misdiagnosed as nutritional deficiency

### Infectious Bronchitis (IB)
Causative agent: Infectious Bronchitis Virus (IBV), Gammacoronavirus
Severity: MODERATE — respiratory and reproductive disease
Key signs: Sneezing, coughing, nasal discharge, rales in young birds; drop in egg production and poor egg quality (watery albumen, misshapen shells) in layers; nephropathogenic strains cause kidney disease
Transmission: Airborne, direct contact, contaminated equipment
At-risk conditions: Young chicks under 4 weeks most severely affected, layer flocks, cold/harmattan season, poor ventilation
Treatment: Supportive only — increase house temperature, vitamins, electrolytes; antibiotic cover for secondary bacterial infections
Prevention: IB H120 vaccine at day 1 or 7 by spray/drinking water; booster at 4 weeks; select vaccines matched to local strains
Nigerian relevance: Multiple IBV variants circulate in Nigeria; poor vaccine strain matching is common; respiratory signs in layers should prompt IB testing

### Fowl Typhoid
Causative agent: Salmonella gallinarum (bacterium)
Severity: HIGH — septicaemic disease, high mortality in adults
Key signs: Acute: sudden death in adults without premonitory signs; Subacute: yellowish-green diarrhoea, pale shrunken comb, lethargy, weight loss, increased thirst
Transmission: Vertical (egg transmission), contaminated feed/water, rodents (major vectors), carrier birds
At-risk conditions: Layer and breeder farms, wet season, poor rodent control, purchased stock from unknown sources
Treatment: Enrofloxacin or trimethoprim-sulphamethoxazole under vet guidance; clear carrier state with antibiotics before restocking
Prevention: Vaccination with 9R or SG9R live attenuated vaccine in endemic areas; strict rodent control; test-and-cull carriers
Nigerian relevance: Major disease of layers and breeders; often introduced via infected replacement stock; rodent control is critical

### Coccidiosis
Causative agent: Eimeria species (protozoan parasites) — E. tenella, E. maxima, E. necatrix most pathogenic
Severity: MODERATE — common, highly treatable if caught early
Key signs: Bloody or mucoid diarrhoea (E. tenella — caecal, very bloody), lethargy, pale comb, huddling near heat source, poor feed conversion
Transmission: Sporulated oocysts in contaminated litter — ingested by birds; wet/damp litter dramatically accelerates oocyst sporulation
At-risk conditions: Broilers 3–6 weeks, floor-reared birds, wet litter, overcrowding, wet season/south_south region, sudden diet changes removing coccidiostats
Treatment: Amprolium, toltrazuril, or diclazuril via drinking water for 3–5 days; followed by multivitamins especially vitamin K (anti-haemorrhagic)
Prevention: Coccidiostats in starter/grower feed (salinomycin, monensin, diclazuril); maintain dry litter; proper stocking density; live coccidiosis vaccine for breeder/layer programs
Nigerian relevance: Extremely common, especially in south_south and south_east; wet season cases spike dramatically; bloody diarrhoea is the classic presentation farmers recognise

### Fowl Pox
Causative agent: Avipoxvirus
Severity: LOW–MODERATE — rarely fatal, but causes production losses and secondary infections
Key signs: Dry form: crusty nodular lesions on comb, wattles, eyelids, feet; Wet form (diphtheria): yellowish plaques inside mouth and throat causing breathing difficulty; egg production drop
Transmission: Biting insects (mosquitoes are primary vector), direct contact with lesions, contaminated equipment
At-risk conditions: Rainy/wet season (mosquito populations), open-sided housing, poor ventilation
Treatment: No specific treatment; apply iodine or mercurochrome to dry lesions; vitamin A supplementation improves recovery; treat secondary bacterial infections
Prevention: Fowl pox vaccine at 6–8 weeks (wing-web stab method); insect control (screens, repellents); isolate affected birds
Nigerian relevance: Very common during and after wet season due to high mosquito density; causes significant layer production losses

### Heat Stress Syndrome
Causative agent: Environmental — high temperature (>35°C) combined with high humidity (>70%)
Severity: HIGH — rapid mortality possible in extreme heat events
Key signs: Panting and open-mouth breathing, wings held away from body, pale comb and wattles, reduced feed intake, watery diarrhoea, sudden death in severe cases, drop in egg production, thin eggshells
At-risk conditions: Dry season (Mar–Jul), north Nigeria, closed/poorly ventilated housing, broilers in finisher phase, black/dark-coloured birds, crowded houses
Treatment: Emergency cooling (cold water sprays, ice in drinking water), electrolytes (sodium bicarbonate, potassium chloride), reduce stocking density immediately
Prevention: Install ceiling fans and side curtains/foggers; feed during cool of early morning and evening; provide cool fresh water at all times; adjust stocking density; use heat-tolerant breeds
Nigerian relevance: Major cause of acute mortality in north Nigeria during March–May; broilers in finisher phase (5–6 weeks) are most vulnerable due to high metabolic heat production

### Salmonella (Non-typhoidal)
Causative agent: Salmonella enteritidis, S. typhimurium, S. kentucky (bacteria)
Severity: MODERATE — zoonotic risk, important food safety concern
Key signs: Often subclinical in adult birds (carrier state); in chicks: diarrhoea, yolk sac infection (omphalitis), high early mortality in first week; contaminated eggs and meat pose human health risk
Transmission: Vertical (infected eggs), contaminated feed (especially fishmeal), rodents, wild birds, human handlers
At-risk conditions: Layer and breeder farms, hatcheries, battery cages, poor sanitation, imported feed ingredients
Treatment: Under vet guidance — florfenicol, enrofloxacin; note antibiotic treatment creates carriers and is discouraged in food-safety programs; focus on sanitation and rodent control
Prevention: Salmonella vaccination of breeders; competitive exclusion products in chicks; strict rodent control; regular environmental sampling; proper litter disposal
Nigerian relevance: Increasingly recognised as food safety concern in Nigerian poultry; linked to human outbreaks; particularly important for export-oriented farms

## Behaviour Guidelines
- Always reference specific numbers from the farm context when available (e.g., "your mortality rate of 3.2% combined with the wet season…")
- For medication: state the drug category and approach but never give specific dosages — always say "consult your veterinarian for correct dosing"
- For notifiable diseases (AI, NCD velogenic): emphasise mandatory reporting to State Veterinary Services; do NOT suggest waiting
- Format: 3–6 sentences for simple questions; structured bullet points or numbered lists for complex protocols
- When uncertain: ask the farmer to describe symptoms more specifically before giving advice
- Always end answers about clinical disease with a reminder that APRIS AI is advisory and professional veterinary examination is essential for diagnosis
- Do not make up laboratory results, drug trade names available in Nigeria, or NVRI contact numbers — advise farmers to search for current local contacts

## Scope Restriction — CRITICAL
If a question is not related to poultry farming, animal health, veterinary topics, feed management, biosecurity, farm operations, or agriculture, you MUST respond with exactly this message and nothing else:
"APRIS AI answers only poultry farm related questions."
Do not apologise, do not explain further, do not offer alternatives outside this scope.`;

// ── Off-topic pre-filter (zero API cost) ─────────────────────────────────────
// If the message contains none of these keywords, reject it immediately without
// calling the Anthropic API at all. Claude's system prompt also enforces this as
// a secondary layer for messages that slip through (e.g. paraphrased off-topic).
const POULTRY_KEYWORDS = [
  // Animals
  'chicken','poultry','flock','bird','broiler','layer','cockerel','turkey','duck',
  'hen','rooster','chick','livestock','fowl','quail','pigeon','guinea',
  // Diseases & health
  'disease','infection','virus','bacteria','newcastle','gumboro','marek',
  'coccidiosis','coccidios','avian','influenza','bronchitis','typhoid','salmonella',
  'pox','ibd','ncd','respiratory','diarrh','bloody','mortality','sick','dying',
  'symptom','lesion','paralysis','swollen','discharge','lethargy','weight loss',
  'outbreak','quarantine','zoonot',
  // Farm operations
  'farm','feed','vaccin','biosecurity','egg','hatch','litter','housing',
  'ventilation','pen','coop','barn','stocking','density','bedding','drinker',
  'feeder','water','nutrition','vitamin','mineral','supplement','antibiotic',
  'medication','treatment','drug','dose','spray','disinfect','sanitise','sanitize',
  'fumigat','biosecur',
  // APRIS / assessment
  'risk','assessment','mitigation','score','apris','alert','wild bird','outbreak',
  // People / context
  'vet','veterinar','farmer','farm manager','flock manager',
  // Nigerian context
  'nigeria','nigerian','harmattan','season','naqs','nvri','west africa',
];

const OFF_TOPIC_REPLY = 'APRIS AI answers only poultry farm related questions.';

/**
 * Returns true if the message appears to be poultry/farming related.
 * This check is free — it never calls the Anthropic API.
 */
function isPoultryRelated(text) {
  const lower = text.toLowerCase();
  return POULTRY_KEYWORDS.some((kw) => lower.includes(kw));
}

// ── In-memory session store ──────────────────────────────────────────────────
const sessionStore = new Map();
const MAX_HISTORY = 20;

function getHistory(sessionId) {
  return sessionStore.get(sessionId) || [];
}

function appendToHistory(sessionId, role, content) {
  const history = getHistory(sessionId);
  history.push({ role, content });
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
  sessionStore.set(sessionId, history);
}

function clearSession(sessionId) {
  sessionStore.delete(sessionId);
}

// Trim stale sessions (no messages = idle sessions left over from aborts)
setInterval(() => {
  for (const [id, history] of sessionStore.entries()) {
    if (history.length === 0) sessionStore.delete(id);
  }
}, 30 * 60 * 1000);

// ── Context builder ──────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return 'unknown time ago';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
}

function buildFarmContext({ farm, flock, assessment, weather, alerts = [] }) {
  const lines = ['[CURRENT FARM CONTEXT — use this data to personalise your answer]'];

  if (farm) {
    lines.push(
      `Farm: ${farm.name} | State: ${farm.state || 'unknown'} | LGA: ${farm.lga || 'unknown'} | Housing: ${farm.housing_type || 'unknown'}`
    );
  }
  if (flock) {
    lines.push(
      `Active Flock: ${Number(flock.flock_size || 0).toLocaleString()} birds | Age: ${flock.age_weeks || '?'} weeks | Species: ${flock.species || 'broiler'} | Vaccinated: ${flock.vaccinated ? 'Yes' : 'No'} | Mortality Rate: ${flock.current_mortality_rate || 0}% | Feed Intake: ${flock.feed_intake_pct || 100}%`
    );
  }
  if (weather) {
    lines.push(
      `Current Weather: ${weather.temperature}°C, ${weather.humidity}% humidity, ${weather.rainfall || 0}mm rainfall, Season: ${weather.season || 'unknown'}`
    );
  }
  if (assessment) {
    const ago = timeAgo(assessment.assessed_at);
    lines.push(
      `Latest Risk Assessment (${ago}): Score ${Math.round(assessment.risk_score || 0)}/100 — ${(assessment.risk_level || 'unknown').toUpperCase()} risk`
    );
    const diseases = assessment.diseases || [];
    if (diseases.length > 0) {
      const top = diseases
        .slice(0, 3)
        .map((d) => `${d.disease_name} (${Math.round((d.probability || 0) * 100)}%)`)
        .join(', ');
      lines.push(`Top Disease Predictions: ${top}`);
    }
    const mitigations = assessment.mitigations || [];
    const pending = mitigations.filter((m) => !m.is_completed).slice(0, 3).map((m) => m.action);
    if (pending.length > 0) lines.push(`Pending Mitigations: ${pending.join('; ')}`);
  }
  if (alerts.length > 0) {
    const active = alerts.slice(0, 3).map((a) => a.title).join('; ');
    lines.push(`Active Alerts: ${active}`);
  }

  return lines.join('\n');
}

// ── Streaming chat ────────────────────────────────────────────────────────────
// Returns an async generator that yields text delta strings.
async function* streamChat({ sessionId, userMessage, farmContext }) {
  const contextualContent = farmContext
    ? `${farmContext}\n\n---\n\nFarmer's question: ${userMessage}`
    : userMessage;

  appendToHistory(sessionId, 'user', contextualContent);

  const messages = getHistory(sessionId);

  const stream = await anthropic.messages.stream({
    model: CHAT_MODEL,
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages,
  });

  let fullText = '';
  for await (const chunk of stream) {
    if (
      chunk.type === 'content_block_delta' &&
      chunk.delta.type === 'text_delta'
    ) {
      fullText += chunk.delta.text;
      yield chunk.delta.text;
    }
  }

  appendToHistory(sessionId, 'assistant', fullText);
}

// ── Assessment narrative (non-streaming) ─────────────────────────────────────
async function generateAssessmentNarrative({ assessment, farm, flock, weather }) {
  const context = buildFarmContext({ farm, flock, assessment, weather });

  const prompt = `${context}

Based on the above risk assessment data, write a 2–3 sentence natural language summary explaining what these results mean for this farmer. Reference the specific score, risk drivers, and top disease concern. Start directly with the finding — no headers, no bullets. Write in plain English appropriate for a working farmer.`;

  const response = await anthropic.messages.create({
    model: NARRATIVE_MODEL,
    max_tokens: 256,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content[0]?.text || '';
}

// ── Encyclopedia Q&A (non-streaming) ─────────────────────────────────────────
async function askEncyclopedia({ question, diseaseName }) {
  const focusHint = diseaseName
    ? `The farmer is currently reading about "${diseaseName}" in the APRIS Disease Encyclopedia. `
    : '';

  const response = await anthropic.messages.create({
    model: CHAT_MODEL,
    max_tokens: 512,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `${focusHint}${question}`,
      },
    ],
  });

  return response.content[0]?.text || '';
}

module.exports = {
  streamChat,
  generateAssessmentNarrative,
  askEncyclopedia,
  clearSession,
  buildFarmContext,
  isPoultryRelated,
  OFF_TOPIC_REPLY,
};

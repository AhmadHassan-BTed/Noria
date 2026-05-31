'use strict';

const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const EVENTS = require('../../config/constants/events');

// ---------------------------------------------------------------------------
// Token budget guard.
// gemini-1.5-flash has a 1 M token context window, but scholarship pages
// rarely need more than ~4 k tokens to make an eligibility decision.
// Capping at 15 000 characters keeps latency low and costs negligible.
// ---------------------------------------------------------------------------
const MAX_TEXT_CHARS = 15_000;

// ---------------------------------------------------------------------------
// JSON response schema — enforced at the API level via `responseSchema`.
// The model is CONSTRAINED to return exactly these fields; it cannot add
// free-form commentary outside the JSON structure.
//
// Schema:
//   is_match     boolean  — true only when ALL hard requirements are satisfied
//   program_name string   — canonical name of the scholarship / program
//   deadline     string   — application deadline ("Not specified" if absent)
//   analysis     string   — 2–3 sentence justification for the decision
// ---------------------------------------------------------------------------
const SCHOLARSHIP_RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    is_match: {
      type: SchemaType.BOOLEAN,
      description: 'True only when every hard requirement is satisfied.',
    },
    program_name: {
      type: SchemaType.STRING,
      description: 'Full official name of the scholarship or program.',
    },
    deadline: {
      type: SchemaType.STRING,
      description: 'Application deadline date. Return "Not specified" if not mentioned.',
    },
    analysis: {
      type: SchemaType.STRING,
      description:
        'Concise 2–3 sentence justification explaining why this is or is not a match, ' +
        'referencing specific criteria.',
    },
  },
  required: ['is_match', 'program_name', 'deadline', 'analysis'],
};

// ---------------------------------------------------------------------------
// System instruction — defines the evaluator persona, hard requirements,
// scoring boosts, and applicant profile.
//
// DESIGN DECISION: All criteria are baked into the system instruction rather
// than the user prompt so they are immutable across all calls and cannot be
// accidentally overridden by page content that contains adversarial text.
// ---------------------------------------------------------------------------
const SYSTEM_INSTRUCTION = `
You are a rigorous scholarship eligibility analyst for a specific applicant profile.
You receive raw text scraped from a scholarship webpage and must evaluate eligibility.

════════════════════════════════════════════
HARD REQUIREMENTS  (ALL must be met for is_match: true)
════════════════════════════════════════════
  1. CITIZENSHIP  — Must explicitly accept Pakistani citizens.
  2. DEGREE LEVEL — Must fund a Master's degree (not PhD-only or Bachelor's-only).
  3. FIELD        — Must be in Software Engineering or Computer Science.
  4. FUNDING      — Must be fully funded (tuition + living stipend at minimum).
                    Partial scholarships or tuition-only do NOT qualify.

════════════════════════════════════════════
PRIORITY SIGNALS  (elevate confidence if present, do not block if absent)
════════════════════════════════════════════
  • Research areas mention distributed computation.
  • Research areas mention federated learning.

════════════════════════════════════════════
APPLICANT PROFILE
════════════════════════════════════════════
  Nationality : Pakistani
  Target Degree: Master's (MSc / MS)
  Field        : Software Engineering / Computer Science
  CGPA         : 3.67 / 4.0

════════════════════════════════════════════
OUTPUT RULES
════════════════════════════════════════════
  • If the page does not contain enough information to verify a hard requirement,
    assume it is NOT met and set is_match: false.
  • Always return a single, valid JSON object — no preamble, no trailing text.
`.trim();

/**
 * Initializes the Gemini AI analyzer service and binds it to the central broker.
 *
 * INBOUND   (Broker → Analyzer)
 *   • EVENTS.SCRAPER.SUCCESS  → { url: string, text: string }
 *     Sends truncated text to gemini-1.5-flash for JSON evaluation.
 *
 * OUTBOUND  (Analyzer → Broker)
 *   • EVENTS.ANALYZER.MATCH_FOUND → { url: string, ai_data: object }
 *     Emitted ONLY when ai_data.is_match === true.
 *   • EVENTS.SYSTEM.ERROR → on API failure, JSON parse error, or missing key.
 *
 * FAIL-FAST:
 *   The function throws synchronously if GEMINI_API_KEY is absent so the
 *   process crashes on startup rather than silently swallowing every analysis.
 *
 * @param {import('events').EventEmitter} broker - The central event bus.
 */
function initGeminiAnalyzer(broker) {
  // Validate the API key at service init time — not lazily per request
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      '[Analyzer] FATAL — GEMINI_API_KEY is not set in environment variables. ' +
      'The analyzer cannot start without a valid API key.',
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // Build the model instance once.
  // `systemInstruction` is evaluated server-side before every prompt —
  // it cannot be overridden by user-turn content.
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: {
      // Force structured JSON output — the model cannot respond in free text
      responseMimeType: 'application/json',
      // Constrain the JSON shape at the API level (not just via prompting)
      responseSchema: SCHOLARSHIP_RESPONSE_SCHEMA,
    },
  });

  // -------------------------------------------------------------------------
  // Core analysis handler
  // -------------------------------------------------------------------------
  broker.on(EVENTS.SCRAPER.SUCCESS, async ({ url, text }) => {
    console.log(`[Analyzer]  Analyzing content from: ${url}`);

    try {
      // -----------------------------------------------------------------
      // 1. Guard against empty payloads
      // -----------------------------------------------------------------
      if (!text || text.trim().length === 0) {
        throw new Error(`Received empty text payload for URL: ${url}`);
      }

      // -----------------------------------------------------------------
      // 2. Truncate to stay within the token budget
      // -----------------------------------------------------------------
      const safeText = text.slice(0, MAX_TEXT_CHARS);

      // -----------------------------------------------------------------
      // 3. Build the user-turn prompt
      //    The system instruction already contains all criteria; this prompt
      //    simply delivers the raw content to evaluate.
      // -----------------------------------------------------------------
      const prompt =
        `Evaluate the following scholarship page content for eligibility:\n\n` +
        `--- BEGIN PAGE CONTENT ---\n${safeText}\n--- END PAGE CONTENT ---`;

      // -----------------------------------------------------------------
      // 4. Call the Gemini API
      // -----------------------------------------------------------------
      const result = await model.generateContent(prompt);
      const rawResponse = result.response.text();

      // -----------------------------------------------------------------
      // 5. Parse the JSON response
      //    Even with responseMimeType = 'application/json', defensive parsing
      //    guards against edge cases (e.g., the model prefixing a BOM or
      //    wrapping in markdown fences on certain SDK versions).
      // -----------------------------------------------------------------
      let ai_data;
      try {
        // Strip potential markdown code fences defensively
        const cleaned = rawResponse.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
        ai_data = JSON.parse(cleaned);
      } catch (parseErr) {
        throw new Error(
          `Gemini returned malformed JSON.\n` +
          `Parse error: ${parseErr.message}\n` +
          `Raw response (first 300 chars): ${rawResponse.slice(0, 300)}`,
        );
      }

      // -----------------------------------------------------------------
      // 6. Validate expected fields are present
      // -----------------------------------------------------------------
      if (typeof ai_data.is_match !== 'boolean') {
        throw new Error(
          `Gemini response missing required boolean field 'is_match'. ` +
          `Got: ${JSON.stringify(ai_data)}`,
        );
      }

      console.log(
        `[Analyzer]  ${url}\n` +
        `           is_match    : ${ai_data.is_match}\n` +
        `           program_name: ${ai_data.program_name}\n` +
        `           deadline    : ${ai_data.deadline}\n` +
        `           analysis    : ${ai_data.analysis}`,
      );

      // -----------------------------------------------------------------
      // 7. Gate — only propagate CONFIRMED matches downstream
      // -----------------------------------------------------------------
      if (ai_data.is_match === true) {
        console.log(`[Analyzer]  MATCH CONFIRMED → ${ai_data.program_name}`);
        broker.emit(EVENTS.ANALYZER.MATCH_FOUND, { url, ai_data });
      } else {
        // Log non-matches for audit trail; do NOT emit further events
        console.log(`[Analyzer]  Not a match — ${ai_data.analysis}`);
      }

    } catch (err) {
      console.error(`[Analyzer]  Analysis failed for ${url} →`, err.message);
      broker.emit(EVENTS.SYSTEM.ERROR, {
        source: 'GeminiAnalyzer',
        url,
        message: err.message,
        stack: err.stack,
      });
    }
  });

  console.log('[Analyzer]  Gemini analyzer service initialized and listening.');
}

module.exports = { initGeminiAnalyzer };
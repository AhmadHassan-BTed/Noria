'use strict';

const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const EVENTS = require('../../config/constants/events');

const MAX_TEXT_CHARS = 15_000;

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

function initGeminiAnalyzer(broker) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      '[Analyzer] FATAL — GEMINI_API_KEY is not set in environment variables. ' +
      'The analyzer cannot start without a valid API key.',
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: SCHOLARSHIP_RESPONSE_SCHEMA,
    },
  });

  broker.on(EVENTS.SCRAPER.SUCCESS, async ({ url, text }) => {
    console.log(`[Analyzer] Analyzing content from: ${url}`);

    try {
      if (!text || text.trim().length === 0) {
        throw new Error(`Received empty text payload for URL: ${url}`);
      }

      const safeText = text.slice(0, MAX_TEXT_CHARS);

      const prompt =
        `Evaluate the following scholarship page content for eligibility:\n\n` +
        `--- BEGIN PAGE CONTENT ---\n${safeText}\n--- END PAGE CONTENT ---`;

      const result = await model.generateContent(prompt);
      const rawResponse = result.response.text();

      let ai_data;
      try {
        const cleaned = rawResponse.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
        ai_data = JSON.parse(cleaned);
      } catch (parseErr) {
        throw new Error(
          `Gemini returned malformed JSON.\n` +
          `Parse error: ${parseErr.message}\n` +
          `Raw response (first 300 chars): ${rawResponse.slice(0, 300)}`,
        );
      }

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

      if (ai_data.is_match === true) {
        console.log(`[Analyzer] MATCH CONFIRMED → ${ai_data.program_name}`);
        broker.emit(EVENTS.ANALYZER.MATCH_FOUND, { url, ai_data });
      } else {
        console.log(`[Analyzer] Not a match — ${ai_data.analysis}`);
      }

    } catch (err) {
      console.error(`[Analyzer] Analysis failed for ${url} →`, err.message);
      broker.emit(EVENTS.SYSTEM.ERROR, {
        source: 'GeminiAnalyzer',
        url,
        message: err.message,
        stack: err.stack,
      });
    }
  });

  console.log('[Analyzer] Gemini analyzer service initialized and listening.');
}

module.exports = { initGeminiAnalyzer };
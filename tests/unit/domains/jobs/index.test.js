'use strict';

const jobsDomain = require('../../../../src/domains/jobs');

describe('Jobs Domain Module', () => {
  describe('Domain Manifest / Exports', () => {
    test('should expose correct schema, criteria, and penalties', () => {
      expect(jobsDomain.schema).toBeDefined();
      expect(jobsDomain.schema.type).toBe('object');
      expect(jobsDomain.criteria).toBeDefined();
      expect(jobsDomain.penalties).toBeDefined();
    });

    test('should return correct opportunity metadata description', () => {
      const meta = jobsDomain.metadata;
      expect(meta.name).toBe('jobs');
      expect(meta.displayName).toBe('Job Opportunities');
      expect(meta.description).toContain('developer job opportunities');
    });
  });

  describe('resolveProfile', () => {
    test('should resolve profile from application config values', () => {
      const appConfig = {
        APPLICANT_NAME: 'Test Applicant',
        APPLICANT_NATIONALITY: 'Pakistani',
        APPLICANT_DEGREE_TIER: 'Master',
        APPLICANT_TARGET_FIELDS: 'AI, CS',
        APPLICANT_RESEARCH_FOCUS: 'LLMs',
      };
      const profile = jobsDomain.resolveProfile(appConfig);
      expect(profile).toEqual({
        name: 'Test Applicant',
        nationality: 'Pakistani',
        degreeTier: 'Master',
        targetFields: 'AI, CS',
        researchFocus: 'LLMs',
      });
    });
  });

  describe('buildPrompt', () => {
    test('should build structured prompt containing applicant profile variables', () => {
      const text = 'Hiring a remote Junior Software Engineer in Javascript, React and Node.js. 80k-90k salary.';
      const profile = {
        name: 'Test Applicant',
        nationality: 'Pakistani',
        degreeTier: 'Master',
        targetFields: 'AI, CS',
        researchFocus: 'LLMs',
      };
      const result = jobsDomain.buildPrompt(text, profile);

      expect(result).toContain(text);
      expect(result).toContain('Test Applicant');
      expect(result).toContain('AI, CS');
    });

    test('should include WHATSAPP MESSAGE CONTEXT in prompt when messageText is provided', () => {
      const text = 'Opportunity details';
      const messageText = 'Check this out!';
      const profile = {
        name: 'Test Applicant',
      };
      const result = jobsDomain.buildPrompt(text, profile, messageText);

      expect(result).toContain('WHATSAPP MESSAGE CONTEXT');
      expect(result).toContain(messageText);
    });
  });

  describe('buildTemplate', () => {
    test('should format structured job analysis output into beautiful markdown layout', () => {
      const matchResult = {
        match_score: 95,
        job_title: 'Full Stack Engineer',
        company_name: 'Stark Industries',
        location: 'Remote',
        salary_range: '$100,000 - $120,000',
        experience_level: 'Mid',
        remote_option: true,
        visa_sponsorship: true,
        skills_required: 'React Node Javascript AI ML',
        verdict: 'Excellent match with target fields and fully remote support.',
        deadline: '15-Dec-2026',
        official_link: 'https://stark.com/careers',
        apply_link: 'https://stark.com/apply',
        url: 'https://stark.com/job/123',
      };

      const formatted = jobsDomain.buildTemplate(matchResult);

      expect(formatted).toContain('🔥 *FULL STACK ENGINEER* at *STARK INDUSTRIES* [95% MATCH]');
      expect(formatted).toContain('📍 Remote');
      expect(formatted).toContain('💰 $100,000 - $120,000');
      expect(formatted).toContain('Remote: ✅');
      expect(formatted).toContain('Sponsorship: ✅');
      expect(formatted).toContain('React Node Javascript');
      expect(formatted).toContain('Apply: https://stark.com/apply');
    });
  });
});

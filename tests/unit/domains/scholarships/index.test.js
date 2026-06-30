'use strict';

const scholarshipsDomain = require('../../../../src/domains/scholarships');

describe('Scholarships Domain Module', () => {
  describe('Domain Manifest / Exports', () => {
    test('should expose correct schema, criteria, and penalties', () => {
      expect(scholarshipsDomain.schema).toBeDefined();
      expect(scholarshipsDomain.schema.type).toBe('object');
      expect(scholarshipsDomain.criteria).toBeDefined();
      expect(scholarshipsDomain.penalties).toBeDefined();
    });

    test('should return correct opportunity metadata description', () => {
      const meta = scholarshipsDomain.metadata;
      expect(meta.name).toBe('scholarships');
      expect(meta.displayName).toBe('Scholarship Opportunities');
      expect(meta.description).toContain('matching scholarship opportunities');
    });
  });

  describe('resolveProfile', () => {
    test('should resolve profile from application config values with default fallbacks', () => {
      const appConfig = {};
      const profile = scholarshipsDomain.resolveProfile(appConfig);
      expect(profile).toEqual({
        name: 'Ahmad Hassan',
        nationality: 'Pakistani',
        degreeTier: 'Master',
        targetFields: 'Software Engineering, Computer Science, AI, Distributed Computing',
        researchFocus: 'Federated Learning, on-device AI, distributed computation systems',
      });
    });

    test('should resolve profile from application config values when provided', () => {
      const appConfig = {
        APPLICANT_NAME: 'John Doe',
        APPLICANT_NATIONALITY: 'Canadian',
        APPLICANT_DEGREE_TIER: 'PhD',
        APPLICANT_TARGET_FIELDS: 'Robotics',
        APPLICANT_RESEARCH_FOCUS: 'CV',
      };
      const profile = scholarshipsDomain.resolveProfile(appConfig);
      expect(profile).toEqual({
        name: 'John Doe',
        nationality: 'Canadian',
        degreeTier: 'PhD',
        targetFields: 'Robotics',
        researchFocus: 'CV',
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
      const result = scholarshipsDomain.buildPrompt(text, profile);

      expect(result).toContain(text);
      expect(result).toContain('Test Applicant');
      expect(result).toContain('AI, CS');
    });

    test('should include WHATSAPP MESSAGE CONTEXT in prompt when messageText is provided', () => {
      const text = 'Opportunity details';
      const messageText = 'Check this out!';
      const profile = {
        name: 'Test Applicant',
        nationality: 'Pakistani',
        degreeTier: 'Master',
        targetFields: 'AI, CS',
        researchFocus: 'LLMs',
      };
      const result = scholarshipsDomain.buildPrompt(text, profile, messageText);

      expect(result).toContain('Context from incoming alert:');
      expect(result).toContain(messageText);
    });
  });

  describe('buildTemplate', () => {
    test('should format structured scholarship analysis output into beautiful markdown layout', () => {
      const matchResult = {
        match_score: 95,
        scholarship_name: 'DAAD Scholarship',
        uni_country: 'Germany',
        verdict: 'Excellent match.',
        program_name: 'CS Masters',
        program_format: 'Thesis',
        deadline: '15-Dec-2026',
        pakistan_eligible: true,
        application_fee: 'None',
        fully_funded: true,
        block_account: 'not required',
        spouse_allowance: true,
        english_taught: true,
        post_study_visa: true,
        test_requirements: 'None',
        cgpa_requirement: '3.0',
        work_experience: 'None',
        official_link: 'https://daad.de',
        apply_link: 'https://daad.de/apply',
        url: 'https://daad.de/opportunity',
      };

      const formatted = scholarshipsDomain.buildTemplate(matchResult);

      expect(formatted).toContain('🟢 95% MATCH | DAAD Scholarship');
      expect(formatted).toContain(' Germany');
      expect(formatted).toContain(' [FAST]  Verdict: Excellent match.');
      expect(formatted).toContain('Pakistan Accepted');
      expect(formatted).toContain('🆓 No App Fee');
      expect(formatted).toContain('Fully Funded');
      expect(formatted).toContain('Block Acct: Waived');
      expect(formatted).toContain('Spouse Support: Yes');
      expect(formatted).toContain('Apply: https://daad.de/apply');
    });
  });
});

'use strict';

const { JobsProvider } = require('../../../src/providers/jobs');
const { JobAnalyzer } = require('../../../src/providers/jobs/analyzer');
const { JobNotifier } = require('../../../src/providers/jobs/notifier');
const { JOB_RESPONSE_SCHEMA } = require('../../../src/providers/jobs/schema');
const configRules = require('../../../src/providers/jobs/config');

describe('Jobs Opportunity Provider Layer', () => {
  describe('JobsProvider', () => {
    let provider;

    beforeEach(() => {
      provider = new JobsProvider();
    });

    test('should return valid job analyzer and notifier instances', () => {
      expect(provider.getAnalyzer()).toBeInstanceOf(JobAnalyzer);
      expect(provider.getNotifier()).toBeInstanceOf(JobNotifier);
    });

    test('should expose correct schema and config rules', () => {
      expect(provider.getSchema()).toBe(JOB_RESPONSE_SCHEMA);
      expect(provider.getConfig()).toBe(configRules);
    });

    test('should return correct opportunity metadata description', () => {
      const meta = provider.getMetadata();
      expect(meta.name).toBe('jobs');
      expect(meta.displayName).toBe('Job Opportunities');
      expect(meta.description).toContain('developer job opportunities');
    });
  });

  describe('JobAnalyzer', () => {
    let analyzer;

    beforeEach(() => {
      analyzer = new JobAnalyzer();
      analyzer.setProvider({ name: 'jobs' });
    });

    test('should build structured prompt containing applicant profile variables', async () => {
      const text = 'Hiring a remote Junior Software Engineer in Javascript, React and Node.js. 80k-90k salary.';
      const result = await analyzer.analyze(text);

      expect(result.schema).toBe(JOB_RESPONSE_SCHEMA);
      expect(result.prompt).toContain(' recruit');
      expect(result.prompt).toContain(text);
      expect(result.applicantProfile).toBeDefined();
    });

    test('should throw error if analyzer setProvider was not called before evaluating', async () => {
      const incomplete = new JobAnalyzer();
      await expect(incomplete.analyze('content')).rejects.toThrow('JobAnalyzer: Provider not set');
    });
  });

  describe('JobNotifier', () => {
    let notifier;

    beforeEach(() => {
      notifier = new JobNotifier();
    });

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

      const formatted = notifier.format(matchResult);

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

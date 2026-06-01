'use strict';

const JOB_CRITERIA = {
  remote_flexibility: {
    points: 30,
    description: 'Stated remote work options (Fully Remote: 30, Hybrid/Office-only: 15).',
  },
  visa_logistics: {
    points: 20,
    description: 'Relocation assistance or visa sponsorship support explicitly provided.',
  },
  field_alignment: {
    points: 20,
    description:
      'Direct match with target fields (Computer Science, Software Engineering, AI/ML) or tech stack.',
  },
  seniority_fit: {
    points: 15,
    description:
      'Targeted at entry-level, junior, or mid-level developers (rather than executive/lead).',
  },
  compensation: {
    points: 15,
    description: 'Competitive compensation packages or explicit salary ranges provided.',
  },
};

const JOB_PENALTIES = [
  {
    deduction: 'match_score forced to 0',
    condition: 'Requires existing local work authorization without visa sponsorship support',
  },
  {
    deduction: 'match_score forced to 20 maximum',
    condition: 'Requires senior-level experience (>5 years) or executive/lead responsibilities',
  },
];

module.exports = {
  JOB_CRITERIA,
  JOB_PENALTIES,
};

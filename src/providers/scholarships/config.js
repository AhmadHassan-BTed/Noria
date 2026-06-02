'use strict';

const SCHOLARSHIP_CRITERIA = {
  field_alignment: {
    points: 25,
    description: 'Software Engineering, Computer Science, AI, Distributed Computing, or Advanced Systems.'
  },
  funding_tier: {
    points: 25,
    description: 'Fully funded (tuition 100% covered + monthly living stipend).'
  },
  program_flexibility: {
    points: 20,
    description: 'MS/MSc/Postgraduate or combined MS/PhD tracks.'
  },
  financial_logistics: {
    points: 15,
    description: 'Block account constraints waived, not required, or not applicable.'
  },
  academic_compatibility: {
    points: 10,
    description: 'Research/Thesis-based program layouts.'
  },
  career_runway: {
    points: 5,
    description: 'Host country provides post-study work visa clearance and English medium verification.'
  }
};

const SCHOLARSHIP_PENALTIES = [
  { deduction: 'match_score forced to 0', condition: 'Applicant nationality excluded from eligibility pool' },
  { deduction: 'match_score forced to 0', condition: 'Program is exclusively an undergraduate/Bachelor degree tier' },
  { deduction: 'match_score forced to 0', condition: 'Degree discipline is unaligned with target computing engineering tracks' }
];

module.exports = { SCHOLARSHIP_CRITERIA, SCHOLARSHIP_PENALTIES };

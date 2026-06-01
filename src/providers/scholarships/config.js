'use strict';

const SCHOLARSHIP_CRITERIA = {
  funding_tier: {
    points: 30,
    description: 'Fully funded (tuition + living stipend). Partial funding: +10.',
  },
  program_flexibility: {
    points: 20,
    description:
      'MS/MSc/Postgraduate or MS/PhD combined. PhD-only: +15 if accepts Bachelor entry, +10 if single-track.',
  },
  field_alignment: {
    points: 20,
    description: 'Software Engineering, Computer Science, AI specializations.',
  },
  financial_logistics: {
    points: 15,
    description: 'Block account constraints waived or not applicable.',
  },
  language_barriers: {
    points: 10,
    description: 'Program verified as English-taught.',
  },
  career_runway: {
    points: 5,
    description: 'Country allows post-study job-seeker visa.',
  },
};

const SCHOLARSHIP_PENALTIES = [
  {
    deduction: 'match_score forced to 0',
    condition: 'Applicant nationality excluded from eligibility',
  },
  {
    deduction: 'match_score forced to 0',
    condition: 'Program is exclusively undergraduate/Bachelor degree',
  },
];

module.exports = {
  SCHOLARSHIP_CRITERIA,
  SCHOLARSHIP_PENALTIES,
};

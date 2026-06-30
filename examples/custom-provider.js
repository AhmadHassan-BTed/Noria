'use strict';

// Example: Create a custom job opportunities provider

const { BaseProvider } = require('../base');
const { BaseAnalyzer } = require('../../plugins/base');
const { BaseNotifier } = require('../../plugins/base');
const { SchemaType } = require('@google/generative-ai');

// Step 1: Define the data schema for job postings
const JOB_RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    match_score: {
      type: SchemaType.INTEGER,
      description: 'Job match score 0-100',
    },
    company_name: {
      type: SchemaType.STRING,
      description: 'Hiring company name',
    },
    job_title: {
      type: SchemaType.STRING,
      description: 'Position title',
    },
    job_type: {
      type: SchemaType.STRING,
      description: 'Full-time, Part-time, Contract, Remote',
    },
    salary_range: {
      type: SchemaType.STRING,
      description: 'Salary range if specified',
    },
    experience_required: {
      type: SchemaType.STRING,
      description: 'Years of experience required',
    },
    location: {
      type: SchemaType.STRING,
      description: 'Job location',
    },
    remote_friendly: {
      type: SchemaType.BOOLEAN,
      description: 'True if remote work allowed',
    },
    tech_stack: {
      type: SchemaType.STRING,
      description: 'Technologies required',
    },
    verdict: {
      type: SchemaType.STRING,
      description: 'Summary of why this match',
    },
    apply_link: {
      type: SchemaType.STRING,
      description: 'Application link',
    },
  },
  required: ['match_score', 'company_name', 'job_title', 'verdict'],
};

// Step 2: Create the job-specific analyzer
class JobAnalyzer extends BaseAnalyzer {
  async analyze(content, context = {}) {
    const prompt = `
Evaluate this job posting for suitability.

Criteria:
+30 pts: Tech stack matches your skills (${context.targetSkills || 'AI, Node.js'})
+25 pts: Salary range meets expectations (${context.minSalary || 'Unknown'})
+20 pts: Remote work allowed or location acceptable
+15 pts: Experience level matches (${context.yearsExperience || '2-5'})
+10 pts: Company known to be good workplace

Job posting:
${content}
`;

    return {
      prompt,
      schema: JOB_RESPONSE_SCHEMA,
    };
  }
}

// Step 3: Create the job-specific notifier
class JobNotifier extends BaseNotifier {
  format(data) {
    return ` *${data.company_name}* — ${data.job_title}
Score: ${data.match_score}%

 ${data.location} ${data.remote_friendly ? '(Remote )' : ''}
 ${data.salary_range || 'Not specified'}
⏰ ${data.job_type}

 [SETUP]  Tech Stack: ${data.tech_stack}
 Experience: ${data.experience_required}

 [NOTE]  ${data.verdict}

Apply: ${data.apply_link}`;
  }
}

// Step 4: Create the provider
class JobsProvider extends BaseProvider {
  constructor(config = {}) {
    super(config);
    this.analyzer = new JobAnalyzer();
    this.notifier = new JobNotifier();
  }

  getAnalyzer() {
    return this.analyzer;
  }

  getNotifier() {
    return this.notifier;
  }

  getSchema() {
    return JOB_RESPONSE_SCHEMA;
  }

  getMetadata() {
    return {
      name: 'jobs',
      displayName: 'Job Opportunities',
      description: 'Evaluates and notifies for matching job postings',
      version: '1.0.0',
    };
  }
}

module.exports = { JobsProvider, JobAnalyzer, JobNotifier, JOB_RESPONSE_SCHEMA };

// Usage in plugins.registry.js:
// const { JobsProvider } = require('../providers/jobs');
// registry.registerProvider('jobs', JobsProvider);

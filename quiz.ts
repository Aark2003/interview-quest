export type Round = {
  options: string[];
  correctIndex: number;
  referenceAnswer: string;
  explanation: string;
  example: string;
  keyPoints: string[];
};
export type Feedback = {
  verdict: 'correct' | 'partial' | 'incorrect' | 'learn';
  summary: string;
  strengths: string[];
  corrections: string[];
  answer: string;
  explanation: string;
  example: string;
  keyPoints: string[];
};
export const roundSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    options: {
      type: 'array',
      items: { type: 'string' },
      minItems: 4,
      maxItems: 4,
    },
    correctIndex: { type: 'integer', minimum: 0, maximum: 3 },
    referenceAnswer: { type: 'string' },
    explanation: { type: 'string' },
    example: { type: 'string' },
    keyPoints: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'options',
    'correctIndex',
    'referenceAnswer',
    'explanation',
    'example',
    'keyPoints',
  ],
};
export const feedbackSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    verdict: { type: 'string', enum: ['correct', 'partial', 'incorrect'] },
    summary: { type: 'string' },
    strengths: { type: 'array', items: { type: 'string' } },
    corrections: { type: 'array', items: { type: 'string' } },
    answer: { type: 'string' },
    explanation: { type: 'string' },
    example: { type: 'string' },
    keyPoints: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'verdict',
    'summary',
    'strengths',
    'corrections',
    'answer',
    'explanation',
    'example',
    'keyPoints',
  ],
};
export function mcqFeedback(round: Round, selected: number | null): Feedback {
  const correct = selected === round.correctIndex;
  return {
    verdict: selected === null ? 'learn' : correct ? 'correct' : 'incorrect',
    summary:
      selected === null
        ? 'No worries. Let’s build your understanding.'
        : correct
          ? 'You got it! Here’s why that answer works.'
          : 'Good try. Let’s clear up the difference.',
    strengths: correct ? ['You selected the correct answer.'] : [],
    corrections:
      selected !== null && !correct
        ? [
            `You chose: ${round.options[selected]}`,
            `The correct answer is: ${round.options[round.correctIndex]}`,
          ]
        : [],
    answer: round.referenceAnswer,
    explanation: round.explanation,
    example: round.example,
    keyPoints: round.keyPoints,
  };
}

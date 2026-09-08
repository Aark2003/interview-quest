import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV, extractQuestions } from '../lib/questions.ts';
import { mcqFeedback, type Round } from '../lib/quiz.ts';
test('CSV preserves quoted commas, multiline questions, escaped quotes and CRLF', () => {
  assert.deepEqual(
    parseCSV(
      'Topic,Question\r\nJS,"Explain closures, with examples?"\r\nReact,"Explain \"\"props\"\"\nand state?"',
    ),
    [
      ['Topic', 'Question'],
      ['JS', 'Explain closures, with examples?'],
      ['React', 'Explain "props"\nand state?'],
    ],
  );
});
test('Sheet import finds a question column after title rows and ignores blank cells', () => {
  const q = extractQuestions(
    [
      ['Frontend interview'],
      ['No.', 'Topic', 'Question'],
      ['1', 'React', 'What is the purpose of state in React?'],
      ['2', 'JS', ''],
    ],
    'Frontend',
  );
  assert.equal(q.length, 1);
  assert.equal(q[0].topic, 'React');
  assert.equal(q[0].text, 'What is the purpose of state in React?');
});
test('Headerless sheet import ignores numeric IDs and links', () => {
  const q = extractQuestions(
    [['1', 'https://example.com', 'What is a database index?']],
    'Backend',
  );
  assert.equal(q[0].text, 'What is a database index?');
});
const round: Round = {
  options: ['A', 'B', 'C', 'D'],
  correctIndex: 2,
  referenceAnswer: 'The answer',
  explanation: 'Why this is true and alternatives are wrong.',
  example: 'An example',
  keyPoints: ['Core concept'],
};
test('Correct MCQs receive the reference explanation', () => {
  const f = mcqFeedback(round, 2);
  assert.equal(f.verdict, 'correct');
  assert.equal(f.explanation, round.explanation);
  assert.deepEqual(f.strengths, ['You selected the correct answer.']);
});
test('Wrong MCQs identify both chosen and correct options', () => {
  const f = mcqFeedback(round, 0);
  assert.equal(f.verdict, 'incorrect');
  assert.ok(f.corrections[0].includes('A'));
  assert.ok(f.corrections[1].includes('C'));
  assert.equal(f.answer, round.referenceAnswer);
});
test('I do not know teaches without claiming a correct answer', () => {
  const f = mcqFeedback(round, null);
  assert.equal(f.verdict, 'learn');
  assert.deepEqual(f.strengths, []);
  assert.equal(f.example, round.example);
  assert.deepEqual(f.keyPoints, round.keyPoints);
});

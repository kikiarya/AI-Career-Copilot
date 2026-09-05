import test from 'node:test';
import assert from 'node:assert/strict';
import { CareerRunInputSchema } from '../src/index.js';

test('career run input rejects a short JD', () => {
  assert.equal(CareerRunInputSchema.safeParse({ jobText: 'too short' }).success, false);
});

test('career run input accepts evidence defaults', () => {
  const result = CareerRunInputSchema.parse({ jobText: 'Build an agent with RAG and tool calling for production users.' });
  assert.deepEqual(result.evidence, []);
});

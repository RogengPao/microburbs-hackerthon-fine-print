// Scripted adapter for offline loop validation. Port of providers/mock.py.
// Pops the next scripted StepResult per call and records exactly what it was asked
// to generate from (the assembly spy used by resume-equivalence checks).

import { stepResult } from '../contract.js';

export class MockAdapter {
  constructor({ script = [] } = {}) {
    this.script = script.map(stepResult);
    this.seenInputs = [];
    this.seenTools = [];
    this.seenParams = [];
  }

  async complete(assembled, tools, params, _onDelta = null) {
    this.seenInputs.push(structuredClone(assembled));
    this.seenTools.push([...tools]);
    this.seenParams.push({ ...params });
    if (!this.script.length) throw new Error('mock script exhausted — loop stepped more than scripted');
    return this.script.shift();
  }
}

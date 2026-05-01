import { createHash } from 'crypto';

import type { RequirementTopic, SectionState, SectionStatus } from './models';

export const TOPIC_DEPENDENCIES: Readonly<Record<RequirementTopic, readonly RequirementTopic[]>> = {
  stakeholders: [],
  context: ['stakeholders'],
  constraints: ['context'],
  glossary: [],
  features: ['context', 'glossary'],
  domain: ['features', 'glossary'],
  quality: ['features'],
  dependencies: ['features'],
  anti: ['context'],
  compliance: ['constraints'],
};

export interface StatusTransitionInput {
  readonly inputsHash: string;
  readonly now?: string;
}

export class StatusTracker {
  public markCompleted(input: StatusTransitionInput): SectionState {
    return {
      status: 'completed',
      updatedAt: input.now ?? new Date().toISOString(),
      inputsHash: input.inputsHash,
    };
  }

  public markSkipped(now?: string): SectionState {
    const ts = now ?? new Date().toISOString();
    return {
      status: 'skipped',
      updatedAt: ts,
      skippedAt: ts,
    };
  }

  public markStale(state: SectionState): SectionState {
    if (state.status !== 'completed') {
      return state;
    }
    return { ...state, status: 'stale' };
  }

  public propagateStaleness(
    sections: Readonly<Record<RequirementTopic, SectionState>>,
    changedTopic: RequirementTopic,
  ): Record<RequirementTopic, SectionState> {
    const out: Record<RequirementTopic, SectionState> = { ...sections };
    for (const [topic, deps] of Object.entries(TOPIC_DEPENDENCIES) as Array<
      [RequirementTopic, readonly RequirementTopic[]]
    >) {
      if (deps.includes(changedTopic)) {
        out[topic] = this.markStale(out[topic]);
      }
    }
    return out;
  }

  public hashInputs(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  public canSkip(currentStatus: SectionStatus): boolean {
    return currentStatus !== 'completed';
  }
}

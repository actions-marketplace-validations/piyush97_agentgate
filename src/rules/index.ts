import type { Rule } from '../types.ts';
import { dependencyAdded } from './dependency-added.ts';
import { guardrailEdited } from './guardrail-edited.ts';
import { suppressionAdded } from './suppression-added.ts';
import { testWeakened } from './test-weakened.ts';
import { workflowEscalation } from './workflow-escalation.ts';

export const ALL_RULES: Rule[] = [
  testWeakened,
  guardrailEdited,
  workflowEscalation,
  dependencyAdded,
  suppressionAdded,
];

import { dependencyAdded } from "./dependency-added.js";
import { guardrailEdited } from "./guardrail-edited.js";
import { suppressionAdded } from "./suppression-added.js";
import { testWeakened } from "./test-weakened.js";
import { workflowEscalation } from "./workflow-escalation.js";
export const ALL_RULES = [
    testWeakened,
    guardrailEdited,
    workflowEscalation,
    dependencyAdded,
    suppressionAdded,
];

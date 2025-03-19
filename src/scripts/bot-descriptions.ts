import { Extension } from '@medplum/fhirtypes';

export interface BotDescription {
  name: string;
  criteria?: string;
  extension?: Extension[];
  questionnaires?: string[];
  needsAdminMembership?: boolean;
  cron?: string;
}

const CRITERIA_CODE_EQUAL_TO_TRIAGE = "Task.code.text='Trigger Triage')";

export const BOTS: BotDescription[] = [
  {
    name: 'start-triage',
    criteria: 'Task',
    extension: [getSubscriptionCriteriaExtension(CRITERIA_CODE_EQUAL_TO_TRIAGE)],
  },
];

/**
 * Returns an extension for the supported interaction of a Subscription.
 *
 * | ValueCode | Description |
 * |-----------|-------------|
 * | create    | Create Only |
 * | update    | Update Only |
 * | delete    | Delete Only |
 * | undefined | All Interactions |
 */
export function getSubscriptionExtension(valueCode: 'create' | 'update' | 'delete' | undefined): Extension {
  return {
    url: 'https://medplum.com/fhir/StructureDefinition/subscription-supported-interaction',
    valueCode,
  };
}

function getSubscriptionCriteriaExtension(valueString: string): Extension {
  return {
    url: 'https://medplum.com/fhir/StructureDefinition/fhir-path-criteria-expression',
    valueString: valueString,
  };
}

import { Extension } from '@medplum/fhirtypes';

export interface BotDescription {
  name: string;
  criteria?: string;
  extension?: Extension[];
  questionnaires?: string[];
  needsAdminMembership?: boolean;
  cron?: string;
}

export const BOTS: BotDescription[] = [
  {
    name: 'start-triage',
  },
  {
    name: 'resource-manager',
  },
];

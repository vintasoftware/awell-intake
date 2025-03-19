import { BotEvent, MedplumClient } from '@medplum/core';
import { Task } from '@medplum/fhirtypes';
import { startGenericPathway } from './utils/awell';

export async function handler(medplum: MedplumClient, event: BotEvent): Promise<void> {
  const task = event.input as Task;

  if (!event.secrets['AWELL_API_KEY'].valueString) {
    throw new Error('Missing AWELL_API_KEY secret');
  }
  if (!event.secrets['AWELL_API_URL'].valueString) {
    throw new Error('Missing AWELL_API_URL secret');
  }
  if (!event.secrets['TRIAGE_PATHWAY_DEFINITION_ID'].valueString) {
    throw new Error('Missing TRIAGE_PATHWAY_DEFINITION_ID secret');
  }
  if (!event.secrets['TRIAGE_DATA_POINT_DEFINITION_ID'].valueString) {
    throw new Error('Missing TRIAGE_DATA_POINT_DEFINITION_ID secret');
  }

  const apiUrl = event.secrets['AWELL_API_URL'].valueString;
  const apiKey = event.secrets['AWELL_API_KEY'].valueString;
  const pathwayDefinitionId = event.secrets['TRIAGE_PATHWAY_DEFINITION_ID'].valueString;
  const dataPointDefinitionId = event.secrets['TRIAGE_DATA_POINT_DEFINITION_ID'].valueString;

  if (!task.input || task.input.length === 0 || !task.input[0].valueContactPoint?.value) {
    throw new Error('Missing phone number');
  }

  const phone = task.input[0].valueContactPoint.value;
  await startGenericPathway(apiUrl, apiKey, pathwayDefinitionId, [
    {
      data_point_definition_id: dataPointDefinitionId,
      value: phone,
    },
  ]);
}

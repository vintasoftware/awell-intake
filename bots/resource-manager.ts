import { BotEvent, MedplumClient } from '@medplum/core';
import { Resource } from '@medplum/fhirtypes';

// Whitelist of allowed resource types
const ALLOWED_RESOURCE_TYPES: Resource['resourceType'][] = [
  'Appointment',
  'Communication',

];

interface ResourceOperation {
  type: 'create' | 'update' | 'delete';
  resourceType: Resource['resourceType'];
  resource: Resource;
  id?: string;
}

export async function handler(medplum: MedplumClient, event: BotEvent): Promise<any> {
  // Get the input from the bot event
  const input = event.input as ResourceOperation;

  // Validate input
  if (!input || !input.type || !input.resourceType) {
    throw new Error('Invalid input: Missing required fields');
  }

  // Check if resource type is allowed
  if (!ALLOWED_RESOURCE_TYPES.includes(input.resourceType)) {
    throw new Error(`Resource type ${input.resourceType} is not allowed`);
  }

  try {
    switch (input.type) {
      case 'create':
        if (!input.resource) {
          throw new Error('Resource data is required for create operation');
        }
        return await medplum.createResource(input.resource);

      case 'update':
        if (!input.resource || !input.id) {
          throw new Error('Resource data and ID are required for update operation');
        }
        return await medplum.updateResource({
          ...input.resource,
          id: input.id
        });

      case 'delete':
        if (!input.id) {
          throw new Error('Resource ID is required for delete operation');
        }
        return await medplum.deleteResource(input.resourceType, input.id);

      default:
        throw new Error(`Unsupported operation type: ${input.type}`);
    }
  } catch (error) {
    console.error('Error processing resource operation:', error);
    throw error;
  }
}
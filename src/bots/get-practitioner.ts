import { BotEvent, MedplumClient } from '@medplum/core';

/**
 * Input format for the bot
 */
interface BotInput {
  'cal-com': string;
}

/**
 * Output format for the bot
 */
interface BotOutput {
  data: string;
}

/**
 * Searches for a practitioner with the specified cal.com identifier
 * and returns a practitioner reference.
 *
 * @param input - Input containing the cal.com username
 * @returns Practitioner reference or null if not found
 */
export async function handler(medplum: MedplumClient, event: BotEvent): Promise<BotOutput | null> {
  const input = event.input as BotInput;
  // Validate input
  if (!input['cal-com']) {
    throw new Error('Missing cal.com identifier in input');
  }

  const calComUsername = input['cal-com'];
  if (!calComUsername) {
    throw new Error('Cal.com username is required');
  }

  try {
    // Search for practitioner with matching cal.com identifier
    const searchResponse = await medplum.search('Practitioner', {
      identifier: `cal-com|${calComUsername}`,
    });

    // Check if any practitioners were found
    if (!searchResponse.entry || searchResponse.entry.length === 0) {
      console.log(`No practitioner found with cal.com username: ${calComUsername}`);
      return null;
    }

    // Get the first matching practitioner
    const practitioner = searchResponse.entry[0].resource;
    if (!practitioner) {
      throw new Error('No practitioner found');
    }

    return { data: `Practitioner/${practitioner.id}` };
  } catch (error) {
    console.error('Error searching for practitioner:', error);
    throw error;
  }
}

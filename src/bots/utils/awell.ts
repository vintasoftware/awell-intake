import { Patient } from '@medplum/fhirtypes';

export interface PayloadType {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  identifier: { system: string; value: string }[];
  needsDiagnosis?: boolean;
}

interface CreatePatientResponse {
  createPatient: {
    patient: {
      id: string;
    };
  };
}

interface GetPatientByIdentifierResponse {
  patientByIdentifier: {
    patient: {
      id: string;
    } | null;
  };
}

interface GraphQLResponse<T> {
  data: T;
  errors?: { message: string; extensions?: { data: unknown } }[];
}

interface StartPathwayResponse {
  startPathwayWithPatientIdentifier: {
    pathway_id: string;
  };
}

function cleanPhoneNumber(phone: string | undefined): string {
  if (!phone) return '';
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  // Format to the accepted format by Awell (E.164 format)
  return `+${cleaned}`;
}

export function parseAwellPayload(patient: Patient): PayloadType {
  // Extract the identifier with the system value of "avela"
  const phone = patient.telecom?.filter((telecom) => telecom.system === 'phone');
  const email = patient.telecom?.filter((telecom) => telecom.system === 'email');

  const payload = {
    id: patient.id || '',
    firstName: patient.name?.[0]?.given?.[0] || '',
    lastName: patient.name?.[0]?.family || '',
    phone: cleanPhoneNumber(phone?.[0]?.value),
    email: email?.[0]?.value || '',
    identifier: [
      {
        system: 'https://www.medplum.com/docs/api/fhir/resources/patient',
        value: patient.id!,
      },
    ],
  };
  return payload;
}

export async function createPatientAwell(payload: PayloadType, apiUrl: string, apiKey: string) {
  const createPatientQuery = `
      mutation {
        createPatient(input: {
          first_name: "${payload.firstName}",
          last_name: "${payload.lastName}",
          phone: "${payload.phone}",
          email: "${payload.email}",
          identifier: [
            ${payload.identifier
              .map(
                (id) => `{
              system: "${id.system}",
              value: "${id.value}"
            }`
              )
              .join(',')}
          ],
        }) {
          patient {
            id
          }
        }
      }
    `;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apiKey: apiKey,
    },
    body: JSON.stringify({ query: createPatientQuery }),
  });
  const results = (await response.json()) as GraphQLResponse<CreatePatientResponse>;
  if (results.errors && results.errors.length > 0) {
    throw new Error(
      `Error createPatient: ${results.errors[0].message}. ERROR: ${JSON.stringify(
        results.errors[0]
      )} DETAILS: ${JSON.stringify(results.errors[0].extensions?.data)}`
    );
  }
}

export async function getAwellPatient(patientID: string, apiUrl: string, apiKey: string) {
  const getPatientQuery = `
    query GetPatientByIdentifier {
      patientByIdentifier(system: "https://www.medplum.com/docs/api/fhir/resources/patient", value: "${patientID}") {
        patient {
          id
        }
      }
    }
  `;

  const awellResponse = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apiKey: apiKey,
    },
    body: JSON.stringify({ query: getPatientQuery }),
  });
  const awellPatient = (await awellResponse.json()) as GraphQLResponse<GetPatientByIdentifierResponse>;
  return awellPatient;
}

export async function startPatientPathway(
  patient: Patient,
  apiUrl: string,
  apiKey: string,
  pathwayDefinitionId: string,
  dataPoints: Record<string, string>[]
) {
  await ensureAwellPatientExists(patient, apiUrl, apiKey);

  const startPathwayQuery = `
      mutation {
        startPathwayWithPatientIdentifier(input: {
          patient_identifier: {
            system: "https://www.medplum.com/docs/api/fhir/resources/patient",
            value: "${patient.id}"
          },
          pathway_definition_id: "${pathwayDefinitionId}",
          data_points: [
            ${dataPoints
              .map(
                (point) => `{
              data_point_definition_id: "${point.data_point_definition_id}",
              value: "${point.value}"
            }`
              )
              .join(',\n            ')}
          ]
        }) {
          pathway_id
        }
      }
    `;

  await executePathwayQuery(startPathwayQuery, apiUrl, apiKey);
}

export async function ensureAwellPatientExists(patient: Patient, apiUrl: string, apiKey: string) {
  try {
    const awellPatient = await getAwellPatient(patient.id!, apiUrl, apiKey);
    if (!awellPatient.data?.patientByIdentifier?.patient) {
      const payload = parseAwellPayload(patient);
      await createPatientAwell(payload, apiUrl, apiKey);
    }
  } catch (err) {
    console.error(err);
    throw new Error(`Error on encounter notifications while checking if Awell patient exists ${JSON.stringify(err)}`);
  }
}

async function executePathwayQuery(query: string, apiUrl: string, apiKey: string) {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apiKey: apiKey,
    },
    body: JSON.stringify({ query }),
  });

  const result = (await response.json()) as GraphQLResponse<StartPathwayResponse>;
  if (result.errors && result.errors.length > 0) {
    throw new Error(
      `Error on startCareFlow: ${result.errors[0].message}. DETAILS: ${JSON.stringify(
        result.errors[0].extensions?.data
      )}`
    );
  }
}

import { MedplumClient } from '@medplum/core';
import { Appointment, Patient, Practitioner } from '@medplum/fhirtypes';

/**
 * Creates a set of fake appointments for testing the calendar view.
 * @param medplum - The MedplumClient instance.
 * @param practitioner - The current practitioner.
 * @returns A promise that resolves when all appointments are created.
 */
export async function createFakeAppointments(
  medplum: MedplumClient,
  practitioner: Practitioner
): Promise<Appointment[]> {
  // Fetch some patients to assign appointments to
  const patientsResult = await medplum.search('Patient', {
    _count: '20',
  });

  const patients = patientsResult.entry?.map((e) => e.resource as Patient) || [];

  if (patients.length === 0) {
    console.error('No patients found. Please create some patients first.');
    return [];
  }

  // Create appointments spanning different days and times
  const appointments: Appointment[] = [];
  const now = new Date();
  const statuses: ('proposed' | 'pending' | 'booked' | 'cancelled')[] = ['proposed', 'pending', 'booked', 'cancelled'];

  // Generate appointments for the past 3 days, today, and the next 14 days
  for (let i = -3; i <= 14; i++) {
    // Create 1-4 appointments per day
    const appointmentsPerDay = Math.floor(Math.random() * 4) + 1;

    for (let j = 0; j < appointmentsPerDay; j++) {
      const appointmentDate = new Date(now);
      appointmentDate.setDate(now.getDate() + i);

      // Set hours between 8 AM and 5 PM
      const hour = 8 + Math.floor(Math.random() * 9);
      const minute = Math.floor(Math.random() * 4) * 15; // 0, 15, 30, or 45

      appointmentDate.setHours(hour, minute, 0, 0);

      // Each appointment lasts 30 mins, 45 mins, or 60 mins
      const durationMinutes = [30, 45, 60][Math.floor(Math.random() * 3)];
      const endDate = new Date(appointmentDate);
      endDate.setMinutes(endDate.getMinutes() + durationMinutes);

      // Select a random patient
      const patientIndex = Math.floor(Math.random() * patients.length);
      const patient = patients[patientIndex];

      // Select a random status
      const statusIndex = Math.floor(Math.random() * statuses.length);
      const status = statuses[statusIndex];

      // Create the appointment
      const appointment: Appointment = {
        resourceType: 'Appointment',
        status,
        start: appointmentDate.toISOString(),
        end: endDate.toISOString(),
        participant: [
          {
            actor: {
              reference: `Practitioner/${practitioner.id}`,
              display:
                practitioner.name?.[0]?.text ||
                `${practitioner.name?.[0]?.given?.[0] || ''} ${practitioner.name?.[0]?.family || ''}`,
            },
            status: 'accepted',
          },
          {
            actor: {
              reference: `Patient/${patient.id}`,
              display:
                patient.name?.[0]?.text || `${patient.name?.[0]?.given?.[0] || ''} ${patient.name?.[0]?.family || ''}`,
            },
            status: 'accepted',
          },
        ],
        description: `Appointment ${j + 1} for day ${i}`,
      };

      try {
        // Create the appointment in Medplum
        const createdAppointment = await medplum.createResource(appointment);
        appointments.push(createdAppointment);
        console.log(`Created appointment ${appointments.length}`);
      } catch (error) {
        console.error('Failed to create appointment:', error);
      }
    }
  }

  return appointments;
}

import { Button, Card, Container, Divider, Group, Stack, Tabs, Text, TextInput, Title } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { Appointment, Patient } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import { IconCalendarEvent, IconMessage, IconUpload } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

interface ChartNoteForm {
  content: string;
  date: Date;
}

export function PatientDetail() {
  const { id } = useParams();
  const medplum = useMedplum();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const form = useForm<ChartNoteForm>({
    initialValues: {
      content: '',
      date: new Date(),
    },
  });

  useEffect(() => {
    const fetchPatientData = async () => {
      if (id) {
        const patientData = await medplum.readResource('Patient', id);
        setPatient(patientData);

        const appts = await medplum.searchResources('Appointment', {
          patient: id,
        });
        setAppointments(appts);
      }
    };
    void fetchPatientData();
  }, [id, medplum]);

  if (!patient) return <Text>Loading...</Text>;

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const handleSubmitNote = async (values: ChartNoteForm) => {
    if (!values.content.trim()) return;

    try {
      await medplum.createResource({
        resourceType: 'DocumentReference',
        status: 'current',
        type: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '11506-3',
              display: 'Progress note',
            },
          ],
        },
        subject: {
          reference: `Patient/${patient?.id}`,
        },
        content: [
          {
            attachment: {
              contentType: 'text/plain',
              data: values.content,
            },
          },
        ],
        date: values.date.toISOString(),
      });

      form.reset();
      notifications.show({
        title: 'Success',
        message: 'Chart note added successfully',
        color: 'green',
      });
    } catch (error) {
      console.error('Error creating chart note:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to add chart note',
        color: 'red',
      });
    }
  };

  return (
    <Container size="xl" mt="xl">
      <Stack gap="xl">
        <Group justify="space-between">
          <div>
            <Group gap="xs">
              <Title order={1}>
                {patient.name?.[0]?.given?.[0]} {patient.name?.[0]?.family}
              </Title>
              <Text color="dimmed" mt={7}>
                ({patient.birthDate && getAge(patient.birthDate)})
              </Text>
            </Group>
            <Text color="dimmed" size="sm">
              Next: {appointments[0]?.start && formatDate(appointments[0].start)}
            </Text>
          </div>
          <Group>
            <Button variant="default" leftSection={<IconCalendarEvent size={16} />}>
              Share
            </Button>
            <Button variant="default" leftSection={<IconUpload size={16} />}>
              Upload
            </Button>
            <Button variant="default" leftSection={<IconMessage size={16} />}>
              Message
            </Button>
          </Group>
        </Group>

        <Group align="flex-start" gap="xl">
          <Stack gap="md" style={{ flex: 1 }}>
            <Tabs defaultValue="overview">
              <Tabs.List>
                <Tabs.Tab value="overview">Overview</Tabs.Tab>
              </Tabs.List>

              <Card mt="md" p="lg" radius="md" withBorder>
                <Stack gap="xl">
                  <form onSubmit={form.onSubmit(handleSubmitNote)}>
                    <Stack gap="sm">
                      <TextInput
                        placeholder="Add Chart Note: include notes from a call with a client or copy & paste contents..."
                        {...form.getInputProps('content')}
                      />
                      <Group justify="space-between" align="flex-end">
                        <DateTimePicker
                          valueFormat="MMM D, YYYY hh:mm A"
                          label="Note Date"
                          placeholder="Pick date and time"
                          {...form.getInputProps('date')}
                        />
                        <Button type="submit" variant="light" color="blue" size="sm">
                          Add Note
                        </Button>
                      </Group>
                    </Stack>
                  </form>

                  <Divider />

                  {appointments.map((appointment, index) => (
                    <div key={index}>
                      <Group justify="space-between" mb="xs">
                        <Text fw={500}>APPOINTMENT #{index + 1}</Text>
                        <Text size="sm" c="dimmed">
                          {appointment.start && formatDate(appointment.start)}{' '}
                          {new Date(appointment.start || '').toLocaleTimeString([], {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </Text>
                      </Group>
                      <Text size="sm" c="dimmed">
                        BILLING CODE: {appointment.serviceType?.[0]?.coding?.[0]?.code}
                      </Text>
                      {appointment.description && (
                        <Text size="sm" mt="xs">
                          {appointment.description}
                        </Text>
                      )}
                      {index < appointments.length - 1 && <Divider mt="xl" />}
                    </div>
                  ))}
                </Stack>
              </Card>
            </Tabs>
          </Stack>

          <Stack gap="md" w={300}>
            <Card withBorder radius="md" p="md">
              <Text fw={500} size="sm" mb="xs">
                Client Info
              </Text>
              <Stack gap="xs">
                <Text size="sm">Phone: {patient.telecom?.[0]?.value}</Text>
                <Text size="sm">Email: {patient.telecom?.[1]?.value}</Text>
                <Text size="sm">
                  Address: {patient.address?.[0]?.line?.[0]}, {patient.address?.[0]?.city},{' '}
                  {patient.address?.[0]?.state}
                </Text>
              </Stack>
            </Card>

            <Card withBorder radius="md" p="md">
              <Text fw={500} size="sm" mb="xs">
                Upcoming Appointments
              </Text>
              <Stack gap="xs">
                {appointments.slice(0, 3).map((appointment, index) => (
                  <Group key={index} justify="space-between">
                    <Text size="sm">{appointment.start && formatDate(appointment.start)}</Text>
                    <Text size="sm" color="dimmed">
                      {new Date(appointment.start || '').toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </Text>
                  </Group>
                ))}
              </Stack>
            </Card>
          </Stack>
        </Group>
      </Stack>
    </Container>
  );
}

import { useMedplum } from '@medplum/react';
import { Patient, Appointment, ResourceType, Practitioner, RelatedPerson } from '@medplum/fhirtypes';
import {
  Container,
  Title,
  Text,
  Group,
  Stack,
  Tabs,
  Card,
  Button,
  ActionIcon,
  TextInput,
  Divider,
  Grid,
  CopyButton,
  Paper,
  Tooltip,
  Badge,
} from '@mantine/core';
import { IconPlus, IconCopy, IconCheck } from '@tabler/icons-react';
import { useParams } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { useForm } from '@mantine/form';
import { DateTimePicker } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { createReference, MedplumClient } from '@medplum/core';
import { ResourceTimeline } from './ResourceTimeline';
import dayjs from 'dayjs';

interface ChartNoteForm {
  content: string;
  date: Date;
}

interface UpcomingAppointmentsBoxProps {
  patient: Patient;
}

interface RelatedContactsBoxProps {
  patient: Patient;
}

export function PatientDetail() {
  const { id } = useParams();
  const medplum = useMedplum();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [refresh, setRefresh] = useState(false);
  const form = useForm<ChartNoteForm>({
    initialValues: {
      content: '',
      date: new Date(),
    },
  });

  const loadTimelineResources = useCallback(
    (medplum: MedplumClient, resourceType: ResourceType, id: string) => {
      const ref = `${resourceType}/${id}`;
      const _count = 100;
      return Promise.allSettled([
        medplum.readHistory('Patient', id),
        medplum.search('Communication', { subject: ref, _count }),
        medplum.search('DiagnosticReport', { subject: ref, _count }),
        medplum.search('QuestionnaireResponse', { patient: ref, _count }),
        medplum.search('Observation', { patient: ref, _count }),
        medplum.search('Media', { subject: ref, _count }),
        medplum.search('ServiceRequest', { subject: ref, _count }),
        medplum.search('Task', { subject: ref, _count }),
        medplum.search('Encounter', { patient: ref, _count }),
        medplum.search('DocumentReference', { patient: ref, _count }),
        medplum.search('ClinicalImpression', { patient: ref, _count }),
      ]);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [refresh]
  );

  useEffect(() => {
    const fetchPatientData = async () => {
      if (id) {
        const patientData = await medplum.readResource('Patient', id);
        setPatient(patientData);
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
        resourceType: 'ClinicalImpression',
        status: 'completed',
        description: 'Chart Note',
        subject: createReference(patient),
        date: values.date.toISOString(),
        note: [
          {
            text: values.content,
            authorReference: createReference(medplum.getProfile() as Practitioner),
            time: new Date().toISOString(),
          },
        ],
      });

      form.reset();
      setRefresh(!refresh);
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
              <Text mt={7}>
                {patient.birthDate && `${formatDate(patient.birthDate)} (${getAge(patient.birthDate)} y/o)`}
              </Text>
            </Group>
          </div>
        </Group>

        <Grid gutter="xl">
          <Grid.Col span={9}>
            <Group align="flex-start" gap="xl">
              <Stack gap="md" style={{ flex: 1 }}>
                <Tabs defaultValue="overview">
                  <Tabs.List>
                    <Tabs.Tab value="overview">Overview</Tabs.Tab>
                  </Tabs.List>

                  <Card mt="md" p="lg" radius="md" withBorder>
                    <Stack gap="xl">
                      <Card withBorder p="md" radius="md" style={{ backgroundColor: '#f7fdff' }}>
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
                              <Button
                                type="submit"
                                variant="light"
                                color="blue"
                                size="sm"
                                leftSection={<IconPlus size={16} />}
                              >
                                Add Note
                              </Button>
                            </Group>
                          </Stack>
                        </form>
                      </Card>

                      <Divider />

                      <ResourceTimeline value={patient} loadTimelineResources={loadTimelineResources} />
                    </Stack>
                  </Card>
                </Tabs>
              </Stack>
            </Group>
          </Grid.Col>
          <Grid.Col span={3}>
            <Stack>
              <ClientInfoBox patient={patient} />
              <UpcomingAppointmentsBox patient={patient} />
              <RelatedContactsBox patient={patient} />
            </Stack>
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
}

function ClientInfoBox({ patient }: { patient: Patient }) {
  return (
    <Paper withBorder p="md" mt="xl" radius="md">
      <Stack>
        <Text fw={500} size="sm">
          Client info
        </Text>

        {patient.telecom?.find((t) => t.system === 'email')?.value && (
          <Group align="center" wrap="nowrap">
            <Text size="sm" c="dimmed">
              <b>Email:</b> {patient.telecom.find((t) => t.system === 'email')?.value}
            </Text>
            <CopyButton value={patient.telecom.find((t) => t.system === 'email')?.value || ''} timeout={2000}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? 'Copied' : 'Copy'} withArrow position="left">
                  <ActionIcon size="sm" variant="subtle" color={copied ? 'teal' : 'gray'} onClick={copy}>
                    {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          </Group>
        )}

        {patient.telecom?.[0]?.value && (
          <Group align="center" wrap="nowrap">
            <Text size="sm" c="dimmed">
              <b>Phone:</b> {patient.telecom[0].value}
            </Text>
            <CopyButton value={patient.telecom[0].value} timeout={2000}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? 'Copied' : 'Copy'} withArrow position="left">
                  <ActionIcon size="sm" variant="subtle" color={copied ? 'teal' : 'gray'} onClick={copy}>
                    {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          </Group>
        )}

        {patient.address?.[0] && (
          <Text size="sm" c="dimmed">
            <b>Addr:</b> {patient.address[0].line?.[0]}, {patient.address[0].city}, {patient.address[0].state}{' '}
            {patient.address[0].postalCode}
          </Text>
        )}
      </Stack>
    </Paper>
  );
}

function UpcomingAppointmentsBox({ patient }: UpcomingAppointmentsBoxProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const medplum = useMedplum();

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const results = await medplum.searchResources('Appointment', {
          patient: `Patient/${patient.id}`,
          date: 'ge' + new Date().toISOString().split('T')[0],
          _sort: 'date',
          _count: 3,
        });
        setAppointments(results);
      } catch (error) {
        console.error('Error fetching appointments:', error);
      }
    };

    void fetchAppointments();
  }, [medplum, patient.id]);

  return (
    <Paper withBorder p="md" mt="md" radius="md">
      <Stack>
        <Group justify="space-between">
          <Text fw={500} size="sm">
            Upcoming Appointments
          </Text>
        </Group>

        {appointments.length === 0 ? (
          <Text size="sm" c="dimmed" fs="italic">
            No upcoming appointments
          </Text>
        ) : (
          appointments.map((appointment) => (
            <Stack key={appointment.id} gap={4}>
              <Group justify="space-between" wrap="nowrap">
                <Text size="sm" fw={500}>
                  {appointment.serviceType?.[0]?.text || 'Visit'}
                </Text>
                <Badge size="sm" color={appointment.status === 'booked' ? 'blue' : 'gray'}>
                  {appointment.status}
                </Badge>
              </Group>
              <Text size="sm" c="dimmed">
                {appointment.start && dayjs(appointment.start).format('MMM D, YYYY h:mm A')}
              </Text>
              {appointment.description && (
                <Text size="sm" c="dimmed" lineClamp={2}>
                  {appointment.description}
                </Text>
              )}
            </Stack>
          ))
        )}
      </Stack>
    </Paper>
  );
}

function RelatedContactsBox({ patient }: RelatedContactsBoxProps) {
  const [contacts, setContacts] = useState<RelatedPerson[]>([]);
  const medplum = useMedplum();

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const results = await medplum.searchResources('RelatedPerson', {
          patient: `Patient/${patient.id}`,
          _count: 5,
        });
        setContacts(results);
      } catch (error) {
        console.error('Error fetching related contacts:', error);
      }
    };

    void fetchContacts();
  }, [medplum, patient.id]);

  return (
    <Paper withBorder p="md" radius="md">
      <Stack>
        <Group justify="space-between">
          <Text fw={500} size="sm">
            Emergency Contacts
          </Text>
        </Group>

        {contacts.length === 0 ? (
          <Text size="sm" c="dimmed" fs="italic">
            No emergency contacts listed
          </Text>
        ) : (
          contacts.map((contact) => (
            <Stack key={contact.id} gap={4}>
              <Group justify="space-between" wrap="nowrap">
                <Text size="sm" fw={500}>
                  {contact.name?.[0]?.text || `${contact.name?.[0]?.given?.[0]} ${contact.name?.[0]?.family}`}
                </Text>
                <Badge size="sm">
                  {contact.relationship?.[0]?.text || contact.relationship?.[0]?.coding?.[0]?.display}
                </Badge>
              </Group>

              {contact.telecom?.map((t, index) => (
                <Group key={index} align="center" wrap="nowrap">
                  <Text size="sm" c="dimmed">
                    <b>{t.system === 'phone' ? 'Phone:' : 'Email:'}</b> {t.value}
                  </Text>
                  <CopyButton value={t.value || ''} timeout={2000}>
                    {({ copied, copy }) => (
                      <Tooltip label={copied ? 'Copied' : 'Copy'} withArrow position="left">
                        <ActionIcon size="sm" variant="subtle" color={copied ? 'teal' : 'gray'} onClick={copy}>
                          {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </CopyButton>
                </Group>
              ))}
            </Stack>
          ))
        )}
      </Stack>
    </Paper>
  );
}

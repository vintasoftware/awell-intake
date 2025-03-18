import { Button, Card, Container, Divider, Group, LoadingOverlay, Select, Stack, Tabs, Text, TextInput, Title, useMantineTheme } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { getReferenceString } from '@medplum/core';
import { Appointment, Encounter, Patient, Practitioner } from '@medplum/fhirtypes';
import { useResource, useMedplum } from '@medplum/react';
import { IconCalendarEvent, IconCheck, IconNotes, IconPencil, IconRefresh, IconUsers } from '@tabler/icons-react';
import moment from 'moment';
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

interface EncounterNoteForm {
  content: string;
  date: Date;
}

// Encounter status options in FHIR
type EncounterStatus = Encounter['status'];

const encounterStatusOptions = [
  { value: 'planned', label: 'Planned' },
  { value: 'arrived', label: 'Arrived' },
  { value: 'triaged', label: 'Triaged' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'onleave', label: 'On Leave' },
  { value: 'finished', label: 'Finished' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function AppointmentPage(): JSX.Element {
  const { id } = useParams();
  const navigate = useNavigate();
  const medplum = useMedplum();
  const theme = useMantineTheme();
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const appointment = useResource<Appointment>({ reference: `Appointment/${id}` });
  
  const form = useForm<EncounterNoteForm>({
    initialValues: {
      content: '',
      date: new Date(),
    },
  });

  // Function to extract patient from appointment
  const getPatientReference = () => {
    const patientParticipant = appointment?.participant?.find(
      (p) => p.actor?.reference?.startsWith('Patient/')
    );
    return patientParticipant?.actor;
  };
  
  // Function to extract practitioners from appointment
  const getPractitionerReferences = () => {
    return appointment?.participant
      ?.filter(p => p.actor?.reference?.startsWith('Practitioner/'))
      .map(p => ({
        individual: {
          reference: p.actor?.reference,
          display: p.actor?.display
        }
      }));
  };

  useEffect(() => {
    const fetchEncounter = async () => {
      if (appointment?.id) {
        try {
          // Search for encounters linked to this appointment
          const encounters = await medplum.searchResources('Encounter', {
            appointment: getReferenceString(appointment),
          });
          
          if (encounters.length > 0) {
            setEncounter(encounters[0]);
          }
        } catch (error) {
          console.error('Error fetching encounter:', error);
        }
      }
    };
    
    fetchEncounter();
  }, [medplum, appointment]);

  const handleSubmitNote = async (values: EncounterNoteForm) => {
    if (!values.content.trim()) return;
    
    setLoading(true);
    
    try {
      // Create encounter if it doesn't exist
      let currentEncounter = encounter;
      
      if (!currentEncounter) {
        // Get patient reference
        const patientRef = getPatientReference();
        
        // Create new encounter
        currentEncounter = await medplum.createResource<Encounter>({
          resourceType: 'Encounter',
          status: 'in-progress',
          class: {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: 'AMB',
            display: 'ambulatory'
          },
          appointment: [{
            reference: `Appointment/${appointment?.id}`
          }],
          subject: patientRef as { reference?: string; display?: string },
          participant: getPractitionerReferences()
        });
        
        setEncounter(currentEncounter);
      }
      
      // Create clinical note
      await medplum.createResource({
        resourceType: 'DiagnosticReport',
        status: 'preliminary',
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '11506-3',
            display: 'Progress note'
          }]
        },
        encounter: {
          reference: `Encounter/${currentEncounter.id}`
        },
        subject: {
          reference: getPatientReference()?.reference,
          display: getPatientReference()?.display
        },
        conclusion: values.content,
        effectiveDateTime: values.date.toISOString()
      });
      
      form.reset();
      notifications.show({
        title: 'Success',
        message: 'Encounter note added successfully',
        color: 'green'
      });
    } catch (error) {
      console.error('Error creating encounter note:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to add encounter note',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string | null) => {
    if (!newStatus || !encounter?.id) return;
    
    setStatusLoading(true);
    
    try {
      // Get the typed status
      const status = newStatus as EncounterStatus;
      
      // Create updated encounter
      const updatedEncounterData: Encounter = {
        ...encounter,
        status,
      };
      
      // If status is 'finished', set the end time
      if (status === 'finished' && !encounter.period?.end) {
        updatedEncounterData.period = {
          start: encounter.period?.start,
          end: new Date().toISOString()
        };
      }
      
      // If status is 'in-progress' and no start time, set it
      if (status === 'in-progress' && !encounter.period?.start) {
        updatedEncounterData.period = {
          start: new Date().toISOString(),
          end: encounter.period?.end
        };
      }
      
      // Update the encounter
      const result = await medplum.updateResource(updatedEncounterData);
      setEncounter(result as Encounter);
      
      notifications.show({
        title: 'Success',
        message: 'Encounter status updated successfully',
        color: 'green',
        icon: <IconCheck size={16} />
      });
    } catch (error) {
      console.error('Error updating encounter status:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to update encounter status',
        color: 'red'
      });
    } finally {
      setStatusLoading(false);
    }
  };

  const getPatientName = () => {
    const patientParticipant = appointment?.participant?.find(
      (p) => p.actor?.reference?.startsWith('Patient/')
    );
    
    return patientParticipant?.actor?.display || 'Unknown Patient';
  };

  const formatDateTime = (dateTime?: string) => {
    if (!dateTime) return 'Not scheduled';
    return moment(dateTime).format('dddd, MMMM D, YYYY [at] h:mm A');
  };

  const formatDuration = (start?: string, end?: string) => {
    if (!start || !end) return '';
    
    const startTime = moment(start);
    const endTime = moment(end);
    const duration = moment.duration(endTime.diff(startTime));
    const minutes = duration.asMinutes();
    
    return `${minutes} minutes`;
  };

  const getStatusBadgeColor = (status?: Appointment['status']) => {
    switch (status) {
      case 'booked': return theme.colors.green[6];
      case 'pending': return theme.colors.blue[6];
      case 'cancelled': return theme.colors.red[6];
      default: return theme.colors.gray[6];
    }
  };

  const getEncounterStatusColor = (status?: string) => {
    switch (status) {
      case 'in-progress': return theme.colors.blue[6];
      case 'finished': return theme.colors.green[6];
      case 'cancelled': return theme.colors.red[6];
      case 'arrived': return theme.colors.teal[6];
      default: return theme.colors.gray[6];
    }
  };

  if (!appointment) {
    return (
      <Container size="xl" mt="xl">
        <LoadingOverlay visible={true} />
      </Container>
    );
  }

  return (
    <Container size="xl" mt="xl">
      <Stack gap="xl">
        <Group justify="space-between">
          <div>
            <Title order={2} c="blue.9">{getPatientName()}</Title>
            <Text c="dimmed" size="sm">Appointment Details</Text>
          </div>
          <Group>
            <Button variant="default" leftSection={<IconUsers size={16} />} onClick={() => {
              const patientRef = appointment?.participant?.find(p => p.actor?.reference?.startsWith('Patient/'))?.actor?.reference;
              if (patientRef) {
                const patientId = patientRef.split('/')[1];
                navigate(`/patients/${patientId}`);
              }
            }}>
              Patient Profile
            </Button>
            <Button variant="default" leftSection={<IconCalendarEvent size={16} />} onClick={() => navigate('/calendar')}>
              Calendar
            </Button>
          </Group>
        </Group>
        
        <Tabs defaultValue="details">
          <Tabs.List>
            <Tabs.Tab value="details" leftSection={<IconCalendarEvent size={16} />}>Appointment</Tabs.Tab>
            <Tabs.Tab value="encounter" leftSection={<IconNotes size={16} />}>Encounter</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="details" pt="md">
            <Card shadow="sm" p="lg" radius="md" withBorder>
              <Stack gap="md">
                <Group justify="space-between">
                  <Title order={4}>Appointment Information</Title>
                  <div style={{ 
                    backgroundColor: getStatusBadgeColor(appointment.status), 
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '4px',
                    fontSize: '14px',
                    textTransform: 'capitalize'
                  }}>
                    {appointment.status}
                  </div>
                </Group>
                
                <Divider />
                
                <Group>
                  <Stack gap="xs" style={{ flex: 1 }}>
                    <Text fw={500}>Date & Time</Text>
                    <Text>{formatDateTime(appointment.start)}</Text>
                  </Stack>
                  
                  <Stack gap="xs" style={{ flex: 1 }}>
                    <Text fw={500}>Duration</Text>
                    <Text>{formatDuration(appointment.start, appointment.end)}</Text>
                  </Stack>
                </Group>
                
                <Divider />
                
                <Stack gap="xs">
                  <Text fw={500}>Description</Text>
                  <Text>{appointment.description || 'No description provided'}</Text>
                </Stack>
                
                <Divider />
                
                <Stack gap="xs">
                  <Text fw={500}>Participants</Text>
                  {appointment.participant?.map((participant, index) => (
                    <Text key={index}>{participant.actor?.display || 'Unnamed participant'} ({participant.status})</Text>
                  ))}
                </Stack>
                
                {appointment.serviceType && (
                  <>
                    <Divider />
                    <Stack gap="xs">
                      <Text fw={500}>Service Type</Text>
                      <Text>{appointment.serviceType[0]?.text || appointment.serviceType[0]?.coding?.[0]?.display || 'Unspecified service'}</Text>
                    </Stack>
                  </>
                )}
              </Stack>
            </Card>
          </Tabs.Panel>

          <Tabs.Panel value="encounter" pt="md">
            <Card shadow="sm" p="lg" radius="md" withBorder>
              <Stack gap="md">
                <Group justify="space-between">
                  <Title order={4}>Encounter Information</Title>
                  <div style={{ 
                    backgroundColor: encounter ? getEncounterStatusColor(encounter.status) : theme.colors.yellow[6], 
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '4px',
                    fontSize: '14px',
                    textTransform: 'capitalize'
                  }}>
                    {encounter ? encounter.status : 'No Encounter'}
                  </div>
                </Group>
                
                <form onSubmit={form.onSubmit(handleSubmitNote)}>
                  <Stack gap="sm">
                    <TextInput
                      placeholder="Add clinical note..."
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
                        leftSection={<IconPencil size={16} />}
                        loading={loading}
                      >
                        Add Note
                      </Button>
                    </Group>
                  </Stack>
                </form>
                
                <Divider />
                
                {encounter ? (
                  <Stack gap="md">
                    <Group align="flex-end">
                      <div style={{ flex: 1 }}>
                        <Text fw={500} mb="xs">Encounter Status</Text>
                        <Select
                          value={encounter.status}
                          onChange={handleStatusChange}
                          data={encounterStatusOptions}
                          rightSection={statusLoading ? <IconRefresh size={16} className="spin-animation" /> : null}
                          disabled={statusLoading}
                        />
                      </div>
                    </Group>
                    
                    {encounter.period?.start && (
                      <>
                        <Text fw={500}>Started</Text>
                        <Text>{moment(encounter.period.start).format('MMMM D, YYYY [at] h:mm A')}</Text>
                      </>
                    )}
                    
                    {encounter.period?.end && (
                      <>
                        <Text fw={500} mt="sm">Ended</Text>
                        <Text>{moment(encounter.period.end).format('MMMM D, YYYY [at] h:mm A')}</Text>
                      </>
                    )}
                    
                    {encounter.reasonCode && encounter.reasonCode.length > 0 && (
                      <>
                        <Text fw={500} mt="sm">Reason</Text>
                        <Text>{encounter.reasonCode[0].text || encounter.reasonCode[0].coding?.[0]?.display || 'Unspecified reason'}</Text>
                      </>
                    )}
                  </Stack>
                ) : (
                  <Text c="dimmed">No encounter has been created for this appointment yet. Add a note to create one.</Text>
                )}
              </Stack>
            </Card>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Container>
  );
} 
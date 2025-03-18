import { Box, Button, ButtonGroup, Card, Container, Group, MantineColor, Modal, Select, Stack, Text, TextInput, Title, useMantineTheme } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { getReferenceString } from '@medplum/core';
import { Appointment, Patient, Practitioner } from '@medplum/fhirtypes';
import { ResourceInput, useMedplum, useMedplumProfile } from '@medplum/react';
import { IconArrowLeft, IconArrowRight, IconCalendar, IconCalendarEvent, IconCalendarMonth, IconCalendarWeek, IconDatabase, IconPlus } from '@tabler/icons-react';
import moment from 'moment';
import { useEffect, useState } from 'react';
import { Calendar, ToolbarProps, View, momentLocalizer } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { createFakeAppointments } from '../utils/createFakeAppointments';
import { useNavigate } from 'react-router-dom';

// Setup the localizer for react-big-calendar
const localizer = momentLocalizer(moment);

interface AppointmentEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Appointment;
}

interface NewAppointmentFormData {
  patientId: string;
  patientName: string;
  startDateTime: Date;
  endDateTime: Date;
  description: string;
  status: 'proposed' | 'pending' | 'booked' | 'cancelled';
}

// Map of status values to colors, with a catch-all for unhandled statuses
const statusColorMap: Partial<Record<Appointment['status'] | 'default', MantineColor>> = {
  proposed: 'gray',
  pending: 'blue',
  booked: 'green',
  cancelled: 'red',
  default: 'gray',
};

/**
 * Calendar page that displays appointments for the current user.
 * Supports day, week, and month views.
 * @returns A React component that displays the calendar page.
 */
export function CalendarPage(): JSX.Element {
  const medplum = useMedplum();
  const profile = useMedplumProfile() as Practitioner;
  const theme = useMantineTheme();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [events, setEvents] = useState<AppointmentEvent[]>([]);
  const [viewType, setViewType] = useState<'day' | 'week' | 'month'>('week');
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [patients, setPatients] = useState<Patient[]>([]);
  const [opened, { open, close }] = useDisclosure(false);
  const [generatingTestData, setGeneratingTestData] = useState<boolean>(false);
  const [newAppointment, setNewAppointment] = useState<NewAppointmentFormData>({
    patientId: '',
    patientName: '',
    startDateTime: new Date(),
    endDateTime: new Date(new Date().getTime() + 30 * 60000),
    description: '',
    status: 'booked',
  });

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      // Get appointments where the current practitioner is a participant
      const searchResult = await medplum.search('Appointment', {
        practitioner: getReferenceString(profile),
        _count: '100',
      });

      const fetchedAppointments = searchResult.entry?.map((e) => e.resource as Appointment) || [];
      setAppointments(fetchedAppointments);

      // Convert appointments to calendar events
      const calendarEvents = fetchedAppointments.map((appointment) => {
        const start = appointment.start ? new Date(appointment.start) : new Date();
        const end = appointment.end ? new Date(appointment.end) : new Date(start.getTime() + 30 * 60000);

        // Get patient name if available
        let title = 'Appointment';
        const patientParticipant = appointment.participant?.find(
          (p) => p.actor?.reference?.startsWith('Patient/')
        );

        if (patientParticipant?.actor?.display) {
          title = patientParticipant.actor.display;
        }

        return {
          id: appointment.id as string,
          title,
          start,
          end,
          resource: appointment,
        };
      });

      setEvents(calendarEvents);

      // Fetch patients for the new appointment form
      const patientsResult = await medplum.search('Patient', {
        _count: '100',
      });

      setPatients(patientsResult.entry?.map((e) => e.resource as Patient) || []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch appointments for the current practitioner
  useEffect(() => {
    if (profile?.id) {
      fetchAppointments();
    }
  }, [medplum, profile]);

  const handleViewChange = (newView: 'day' | 'week' | 'month') => {
    setViewType(newView);
  };

  const handleNavigate = (newDate: Date) => {
    setSelectedDate(newDate);
  };

  const handleSelectEvent = (event: AppointmentEvent) => {
    if (event.resource.id) {
      navigate(`/appointment/${event.resource.id}`);
    }
  };

  const handleCreateAppointment = async () => {
    try {
      if (!newAppointment.patientId) {
        alert('Please select a patient');
        return;
      }

      // Create new appointment
      const appointment: Appointment = {
        resourceType: 'Appointment',
        status: newAppointment.status,
        start: newAppointment.startDateTime.toISOString(),
        end: newAppointment.endDateTime.toISOString(),
        description: newAppointment.description,
        participant: [
          {
            actor: {
              reference: `Practitioner/${profile.id}`,
              display: profile.name?.[0]?.text || 'Practitioner',
            },
            status: 'accepted',
          },
          {
            actor: {
              reference: `Patient/${newAppointment.patientId}`,
              display: newAppointment.patientName,
            },
            status: 'accepted',
          },
        ],
      };

      const result = await medplum.createResource(appointment);

      // Add the new appointment to the list and create a new event
      setAppointments([...appointments, result]);

      const newEvent: AppointmentEvent = {
        id: result.id as string,
        title: newAppointment.patientName,
        start: newAppointment.startDateTime,
        end: newAppointment.endDateTime,
        resource: result,
      };

      setEvents([...events, newEvent]);

      // Reset form and close modal
      setNewAppointment({
        patientId: '',
        patientName: '',
        startDateTime: new Date(),
        endDateTime: new Date(new Date().getTime() + 30 * 60000),
        description: '',
        status: 'booked',
      });

      close();
    } catch (error) {
      console.error('Error creating appointment:', error);
      alert('Failed to create appointment. Please try again.');
    }
  };

  const handleGenerateTestData = async () => {
    try {
      setGeneratingTestData(true);
      await createFakeAppointments(medplum, profile);
      // Refresh appointments
      await fetchAppointments();
      alert('Test data created successfully!');
    } catch (error) {
      console.error('Error generating test data:', error);
      alert('Failed to generate test data. Check console for details.');
    } finally {
      setGeneratingTestData(false);
    }
  };

  return (
    <Container size="xl" mt="xl">
      <Stack gap="xl">
        <Group justify="space-between">
          <Title order={2} c="blue.9">Appointments Calendar</Title>
          <Group>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={open}
              variant="filled"
              color="blue"
            >
              New Appointment
            </Button>
            <Button
              leftSection={<IconDatabase size={16} />}
              onClick={handleGenerateTestData}
              variant="outline"
              color="gray"
              loading={generatingTestData}
            >
              Generate Test Data
            </Button>
          </Group>
        </Group>

        <Card shadow="sm" p="lg" radius="md" withBorder>
          <Box style={{ height: '70vh' }}>
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              style={{ height: '100%' }}
              view={viewType}
              date={selectedDate}
              onNavigate={handleNavigate}
              onView={(view: View) => handleViewChange(view as 'day' | 'week' | 'month')}
              onSelectEvent={handleSelectEvent}
              eventPropGetter={(event: AppointmentEvent) => {
                const appointment = event.resource;
                const status = appointment.status || 'default';
                const colorKey = statusColorMap[status] || statusColorMap.default || 'gray';
                const backgroundColor = theme.colors[colorKey][5];

                return {
                  style: {
                    backgroundColor,
                    borderRadius: '4px',
                  },
                };
              }}
              components={{
                event: (props: { event: AppointmentEvent }) => (
                  <div>
                    <strong>{props.event.title}</strong>
                    <div>
                      <Text size="xs">
                        {moment(props.event.start).format('h:mm A')} - {moment(props.event.end).format('h:mm A')}
                      </Text>
                    </div>
                  </div>
                ),
                toolbar: (props: ToolbarProps<AppointmentEvent>) => (
                  <Group justify="space-between" py="md">
                    <ButtonGroup>
                      <Button
                        variant="default"
                        leftSection={<IconArrowLeft size={16} />}
                        onClick={() => props.onNavigate('PREV')}
                      >
                        Back
                      </Button>
                      <Button
                        variant="default"
                        leftSection={<IconCalendarEvent size={16} />}
                        onClick={() => props.onNavigate('TODAY')}
                      >
                        Today
                      </Button>
                      <Button
                        variant="default"
                        leftSection={<IconArrowRight size={16} />}
                        onClick={() => props.onNavigate('NEXT')}
                      >
                        Next
                      </Button>
                    </ButtonGroup>
                    <Text>{props.label}</Text>
                    <ButtonGroup>
                      <Button
                        variant={viewType === 'day' ? 'filled' : 'light'}
                        color="blue"
                        leftSection={<IconCalendar size={16} />}
                        onClick={() => props.onView('day')}
                      >
                        Day
                      </Button>
                      <Button
                        variant={viewType === 'week' ? 'filled' : 'light'}
                        color="blue"
                        leftSection={<IconCalendarWeek size={16} />}
                        onClick={() => props.onView('week')}
                      >
                        Week
                      </Button>
                      <Button
                        variant={viewType === 'month' ? 'filled' : 'light'}
                        color="blue"
                        leftSection={<IconCalendarMonth size={16} />}
                        onClick={() => props.onView('month')}
                      >
                        Month
                      </Button>
                    </ButtonGroup>
                  </Group>
                )
              }}
            />
          </Box>
        </Card>
      </Stack>

      {/* New Appointment Modal */}
      <Modal opened={opened} onClose={close} title="Create New Appointment" size="md">
        <Box p="md">
          <ResourceInput
            resourceType="Patient"
            name="patient"
            required
            onChange={(patient: Patient | undefined) => {
              if (patient) {
                setNewAppointment({
                  ...newAppointment,
                  patientId: patient.id as string,
                  patientName: patient.name?.[0]?.text || `${patient.name?.[0]?.given?.[0] || ''} ${patient.name?.[0]?.family || ''}`,
                });
              }
            }}
          />

          <DateTimePicker
            label="Start Time"
            value={newAppointment.startDateTime}
            onChange={(date) => {
              if (date) {
                const endTime = new Date(date.getTime() + 30 * 60000);
                setNewAppointment({
                  ...newAppointment,
                  startDateTime: date,
                  endDateTime: endTime,
                });
              }
            }}
            mt="md"
            required
          />

          <DateTimePicker
            label="End Time"
            value={newAppointment.endDateTime}
            onChange={(date) => {
              if (date) {
                setNewAppointment({
                  ...newAppointment,
                  endDateTime: date,
                });
              }
            }}
            mt="md"
            required
          />

          <TextInput
            label="Description"
            value={newAppointment.description}
            onChange={(e) => setNewAppointment({ ...newAppointment, description: e.target.value })}
            mt="md"
          />

          <Select
            label="Status"
            value={newAppointment.status}
            onChange={(value) => {
              if (value) {
                setNewAppointment({
                  ...newAppointment,
                  status: value as 'proposed' | 'pending' | 'booked' | 'cancelled',
                });
              }
            }}
            data={[
              { value: 'proposed', label: 'Proposed' },
              { value: 'pending', label: 'Pending' },
              { value: 'booked', label: 'Booked' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
            mt="md"
            required
          />

          <Group justify="flex-end" mt="xl">
            <Button variant="outline" onClick={close}>Cancel</Button>
            <Button color="blue" onClick={handleCreateAppointment}>Create Appointment</Button>
          </Group>
        </Box>
      </Modal>
    </Container>
  );
}

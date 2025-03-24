import {
  Container,
  Title,
  Button,
  Card,
  Group,
  Text,
  Badge,
  Stack,
  Loader,
  Center,
  List,
  Box,
  Alert,
  Grid,
  Menu,
  ActionIcon,
  Tabs,
  Paper,
} from '@mantine/core';
import { useMedplum } from '@medplum/react';
import { CarePlan, PlanDefinition, Reference, Resource } from '@medplum/fhirtypes';
import {
  IconArrowLeft,
  IconDotsVertical,
  IconEdit,
  IconTrash,
  IconCheckbox,
  IconInfoCircle,
  IconCalendarEvent,
  IconCircleCheck,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { notifications } from '@mantine/notifications';

// Activity status options
const activityStatusOptions = [
  { value: 'not-started', label: 'Not Started' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'on-hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

// Status badge color mapping
const getStatusColor = (status: string): string => {
  switch (status) {
    case 'active':
      return 'green';
    case 'completed':
      return 'blue';
    case 'draft':
      return 'yellow';
    case 'revoked':
      return 'red';
    default:
      return 'gray';
  }
};

// Formatted status display
const formatStatus = (status: string): string => {
  return status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ');
};

// Helper function to extract name from reference
const getNameFromReference = async (medplum: ReturnType<typeof useMedplum>, reference: Reference) => {
  try {
    if (!reference.reference) return reference.display || 'Unknown';
    const resource = (await medplum.readReference(reference)) as Resource & {
      name?: Array<{ given?: string[]; family?: string }>;
    };
    return resource?.name?.[0]?.given?.[0] + ' ' + resource?.name?.[0]?.family || reference.display || 'Unknown';
  } catch (error) {
    console.error('Error fetching reference resource:', error);
    return reference.display || 'Unknown';
  }
};

// Format date for display
const formatDate = (dateString?: string) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export function CarePlanDetail() {
  const medplum = useMedplum();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [carePlan, setCarePlan] = useState<CarePlan | null>(null);
  const [templateDetails, setTemplateDetails] = useState<PlanDefinition | null>(null);
  const [patientName, setPatientName] = useState<string>('');
  const [providerName, setProviderName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>('overview');

  useEffect(() => {
    const fetchCarePlan = async () => {
      if (!id) return;

      try {
        setLoading(true);
        // Fetch CarePlan from Medplum FHIR server
        const result = await medplum.readResource('CarePlan', id);
        setCarePlan(result);

        // Fetch related resources
        if (result.subject) {
          const name = await getNameFromReference(medplum, result.subject);
          setPatientName(name);
        }

        if (result.author) {
          const name = await getNameFromReference(medplum, result.author);
          setProviderName(name);
        }

        // Fetch template if based on a PlanDefinition
        if (result.basedOn && result.basedOn.length > 0) {
          const templateRef = result.basedOn[0];
          if (templateRef.reference?.startsWith('PlanDefinition/')) {
            const templateId = templateRef.reference.split('/')[1];
            const template = await medplum.readResource('PlanDefinition', templateId);
            setTemplateDetails(template);
          }
        }
      } catch (error) {
        console.error('Error fetching care plan:', error);
        notifications.show({
          title: 'Error',
          message: 'Failed to load care plan details',
          color: 'red',
        });
      } finally {
        setLoading(false);
      }
    };

    void fetchCarePlan();
  }, [id, medplum]);

  const handleStatusChange = async (newStatus: 'active' | 'completed' | 'revoked') => {
    if (!carePlan || !id) return;

    try {
      const updatedCarePlan = {
        ...carePlan,
        status: newStatus as CarePlan['status'],
      };

      await medplum.updateResource(updatedCarePlan);

      setCarePlan(updatedCarePlan);

      notifications.show({
        title: 'Success',
        message: `Care plan updated to ${formatStatus(newStatus)}`,
        color: 'green',
      });
    } catch (error) {
      console.error('Error updating care plan:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to update care plan status',
        color: 'red',
      });
    }
  };

  const handleEdit = () => {
    // In a real implementation, this would navigate to the edit page
    notifications.show({
      title: 'Info',
      message: 'Edit functionality to be implemented',
      color: 'blue',
    });
  };

  const handleDelete = async () => {
    if (!carePlan || !id) return;

    try {
      // Medplum handles deletes by updating the resource status
      const updatedCarePlan = {
        ...carePlan,
        status: 'revoked' as CarePlan['status'],
      };

      await medplum.updateResource(updatedCarePlan);

      notifications.show({
        title: 'Success',
        message: 'Care plan has been revoked',
        color: 'green',
      });

      // Navigate back to the list
      void navigate('/care-plans');
    } catch (error) {
      console.error('Error deleting care plan:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to delete care plan',
        color: 'red',
      });
    }
  };

  const handleActivityStatusChange = async (activityIndex: number, newStatus: string) => {
    if (!carePlan || !id || !carePlan.activity) return;

    try {
      // Create a deep copy of the carePlan to avoid mutating state directly
      const updatedCarePlan = JSON.parse(JSON.stringify(carePlan)) as CarePlan;

      // Ensure activity array exists
      if (!updatedCarePlan.activity) {
        updatedCarePlan.activity = [];
      }

      // Update the specific activity's status
      if (updatedCarePlan.activity[activityIndex]?.detail) {
        // Define the valid status values for type safety
        type ActivityStatus =
          | 'not-started'
          | 'scheduled'
          | 'in-progress'
          | 'on-hold'
          | 'completed'
          | 'cancelled'
          | 'entered-in-error'
          | 'stopped'
          | 'unknown';

        // Update with proper typing
        updatedCarePlan.activity[activityIndex].detail.status = newStatus as ActivityStatus;
      }

      // Update the resource on the server
      await medplum.updateResource(updatedCarePlan);

      // Update local state
      setCarePlan(updatedCarePlan);

      notifications.show({
        title: 'Success',
        message: 'Activity status updated',
        color: 'green',
        icon: <IconCircleCheck size={16} />,
      });
    } catch (error) {
      console.error('Error updating activity status:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to update activity status',
        color: 'red',
      });
    }
  };

  if (loading) {
    return (
      <Container size="lg" mt="xl">
        <Center h={300}>
          <Loader size="lg" />
        </Center>
      </Container>
    );
  }

  if (!carePlan) {
    return (
      <Container size="lg" mt="xl">
        <Alert title="Care Plan Not Found" color="red" icon={<IconInfoCircle size={16} />}>
          <Text>The requested care plan could not be found. It may have been deleted or you may not have access.</Text>
          <Button mt="md" onClick={() => void navigate('/care-plans')}>
            Return to Care Plans
          </Button>
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="lg" mt="xl">
      <Stack gap="md">
        <Group justify="space-between">
          <Group>
            <Button
              leftSection={<IconArrowLeft size={16} />}
              variant="outline"
              onClick={() => void navigate('/care-plans')}
            >
              Back to Care Plans
            </Button>

            <Title order={2} c="blue.9">
              {carePlan.title || 'Untitled Care Plan'}
            </Title>
          </Group>

          <Group>
            <Badge size="lg" color={getStatusColor(carePlan.status || 'unknown')}>
              {formatStatus(carePlan.status || 'unknown')}
            </Badge>

            <Menu shadow="md" width={200} position="bottom-end">
              <Menu.Target>
                <ActionIcon variant="subtle" size="lg">
                  <IconDotsVertical size={16} />
                </ActionIcon>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Label>Actions</Menu.Label>
                <Menu.Item leftSection={<IconEdit size={14} />} onClick={handleEdit}>
                  Edit Care Plan
                </Menu.Item>

                {carePlan.status !== 'active' && (
                  <Menu.Item leftSection={<IconCheckbox size={14} />} onClick={() => void handleStatusChange('active')}>
                    Mark as Active
                  </Menu.Item>
                )}

                {carePlan.status !== 'completed' && (
                  <Menu.Item
                    leftSection={<IconCheckbox size={14} />}
                    onClick={() => void handleStatusChange('completed')}
                  >
                    Mark as Completed
                  </Menu.Item>
                )}

                <Menu.Divider />

                <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => void handleDelete()}>
                  Delete Care Plan
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>

        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="overview" leftSection={<IconInfoCircle size={14} />}>
              Overview
            </Tabs.Tab>
            <Tabs.Tab value="activities" leftSection={<IconCalendarEvent size={14} />}>
              Activities
            </Tabs.Tab>
          </Tabs.List>

          <Paper shadow="xs" p="md" withBorder mt="xs">
            <Tabs.Panel value="overview">
              <Stack gap="md">
                <Card shadow="xs" p="lg" radius="md" withBorder>
                  <Grid>
                    <Grid.Col span={6}>
                      <Text fw={500} size="sm" c="dimmed">
                        Patient
                      </Text>
                      <Text fw={600}>{patientName}</Text>
                      <Text size="xs" c="dimmed">
                        {carePlan.subject?.reference}
                      </Text>
                    </Grid.Col>

                    <Grid.Col span={6}>
                      <Text fw={500} size="sm" c="dimmed">
                        Provider
                      </Text>
                      <Text fw={600}>{providerName}</Text>
                      <Text size="xs" c="dimmed">
                        {carePlan.author?.reference}
                      </Text>
                    </Grid.Col>

                    <Grid.Col span={6} mt="sm">
                      <Text fw={500} size="sm" c="dimmed">
                        Start Date
                      </Text>
                      <Text>{formatDate(carePlan.period?.start)}</Text>
                    </Grid.Col>

                    <Grid.Col span={6} mt="sm">
                      <Text fw={500} size="sm" c="dimmed">
                        End Date
                      </Text>
                      <Text>{formatDate(carePlan.period?.end)}</Text>
                    </Grid.Col>

                    <Grid.Col span={12} mt="sm">
                      <Text fw={500} size="sm" c="dimmed">
                        Description
                      </Text>
                      <Text>{carePlan.description || 'No description provided'}</Text>
                    </Grid.Col>
                  </Grid>
                </Card>

                {templateDetails && (
                  <Card shadow="xs" p="lg" radius="md" withBorder>
                    <Title order={4} mb="md">
                      Protocol Template
                    </Title>

                    <Text fw={600}>{templateDetails.title || 'Untitled Protocol'}</Text>
                    <Text size="sm" mt="xs">
                      {templateDetails.description || 'No description available'}
                    </Text>

                    {templateDetails.goal && templateDetails.goal.length > 0 && (
                      <Box mt="md">
                        <Text fw={600} size="sm">
                          Goals
                        </Text>
                        <List>
                          {templateDetails.goal.map((goal, index) => (
                            <List.Item key={index}>{goal.description?.text || `Goal ${index + 1}`}</List.Item>
                          ))}
                        </List>
                      </Box>
                    )}
                  </Card>
                )}
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="activities">
              <Card shadow="xs" p="lg" radius="md" withBorder>
                <Title order={4} mb="md">
                  Care Plan Activities
                </Title>

                {carePlan.activity && carePlan.activity.length > 0 ? (
                  <Stack gap="sm">
                    {carePlan.activity.map((activity, index) => (
                      <Card key={index} shadow="xs" p="md" radius="sm" withBorder>
                        <Group justify="space-between" align="flex-start">
                          <Box>
                            <Text fw={600}>
                              {activity.detail?.description || activity.reference?.display || `Activity ${index + 1}`}
                            </Text>

                            {activity.detail?.scheduledPeriod && (
                              <Text size="xs" c="dimmed">
                                {formatDate(activity.detail.scheduledPeriod.start)} -{' '}
                                {formatDate(activity.detail.scheduledPeriod.end)}
                              </Text>
                            )}
                          </Box>

                          <Group>
                            <Badge color={getStatusColor(activity.detail?.status || 'not-started')}>
                              {formatStatus(activity.detail?.status || 'not-started')}
                            </Badge>

                            <Menu position="bottom-end" shadow="md" width={200}>
                              <Menu.Target>
                                <ActionIcon variant="subtle" size="sm">
                                  <IconDotsVertical size={16} />
                                </ActionIcon>
                              </Menu.Target>

                              <Menu.Dropdown>
                                <Menu.Label>Change Status</Menu.Label>
                                {activityStatusOptions.map((option) => (
                                  <Menu.Item
                                    key={option.value}
                                    onClick={() => void handleActivityStatusChange(index, option.value)}
                                    disabled={activity.detail?.status === option.value}
                                  >
                                    {option.label}
                                  </Menu.Item>
                                ))}
                              </Menu.Dropdown>
                            </Menu>
                          </Group>
                        </Group>
                      </Card>
                    ))}
                  </Stack>
                ) : (
                  <Text c="dimmed">No activities defined for this care plan.</Text>
                )}
              </Card>
            </Tabs.Panel>
          </Paper>
        </Tabs>
      </Stack>
    </Container>
  );
}

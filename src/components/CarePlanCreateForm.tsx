import {
  Container,
  Title,
  Button,
  Card,
  Group,
  Text,
  Select,
  Divider,
  Stack,
  TextInput,
  Textarea,
  Loader,
  Center,
  List,
  Box,
  Alert,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMedplum } from '@medplum/react';
import { PlanDefinition, Patient, Practitioner, CarePlan } from '@medplum/fhirtypes';
import { IconInfoCircle, IconArrowLeft, IconCheck } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { DateTimePicker } from '@mantine/dates';

export function CarePlanCreateForm() {
  const medplum = useMedplum();
  const location = useLocation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [templateLoaded, setTemplateLoaded] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [templates, setTemplates] = useState<PlanDefinition[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PlanDefinition | null>(null);

  // Get template ID from URL query string if available
  const queryParams = new URLSearchParams(location.search);
  const templateIdFromUrl = queryParams.get('template');

  const form = useForm({
    initialValues: {
      title: '',
      description: '',
      patientId: '',
      practitionerId: '',
      templateId: templateIdFromUrl || '',
      status: 'draft',
      startDate: new Date(),
      endDate: new Date(new Date().setMonth(new Date().getMonth() + 12)), // Default to 1 year
    },
    validate: {
      title: (value) => (value.length < 3 ? 'Title must be at least 3 characters' : null),
      patientId: (value) => (!value ? 'Patient is required' : null),
      practitionerId: (value) => (!value ? 'Provider is required' : null),
    },
  });

  // Load patients, practitioners, and templates
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch patients
        const patientResults = await medplum.searchResources('Patient', {
          _count: '100',
          _sort: 'name',
        });
        setPatients(patientResults);

        // Fetch practitioners
        const practitionerResults = await medplum.searchResources('Practitioner', {
          _count: '100',
          _sort: 'name',
        });
        setPractitioners(practitionerResults);

        // Fetch templates (PlanDefinitions)
        const templateResults = await medplum.searchResources('PlanDefinition', {
          status: 'active,draft',
          _count: '100',
          _sort: '-_lastUpdated',
        });
        setTemplates(templateResults);

        // If there's a template ID from URL, set it in the form
        if (templateIdFromUrl) {
          form.setFieldValue('templateId', templateIdFromUrl);
          void loadTemplate(templateIdFromUrl);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [medplum, templateIdFromUrl]);

  // Load template details when selected
  const loadTemplate = async (templateId: string) => {
    if (!templateId) {
      setSelectedTemplate(null);
      setTemplateLoaded(false);
      return;
    }

    try {
      setLoadingTemplate(true);
      const template = await medplum.readResource('PlanDefinition', templateId);
      setSelectedTemplate(template);

      // Pre-populate title and description based on template
      form.setValues({
        ...form.values,
        title: template.title ? `${template.title} Care Plan` : form.values.title,
        description: template.description || form.values.description,
      });

      setTemplateLoaded(true);
    } catch (error) {
      console.error('Error loading template:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load protocol template',
        color: 'red',
      });
    } finally {
      setLoadingTemplate(false);
    }
  };

  // Handle template selection
  const handleTemplateChange = (templateId: string | null) => {
    form.setFieldValue('templateId', templateId || '');
    if (templateId) {
      void loadTemplate(templateId);
    } else {
      setSelectedTemplate(null);
      setTemplateLoaded(false);
    }
  };

  // Create CarePlan resource
  const handleSubmit = async (values: typeof form.values) => {
    if (!values.patientId || !values.practitionerId) {
      return; // Form validation should catch this
    }

    try {
      // Create references
      const subject = {
        reference: `Patient/${values.patientId}`,
        display:
          patients.find((p) => p.id === values.patientId)?.name?.[0]?.given?.[0] +
            ' ' +
            patients.find((p) => p.id === values.patientId)?.name?.[0]?.family || 'Unknown Patient',
      };

      const author = {
        reference: `Practitioner/${values.practitionerId}`,
        display:
          practitioners.find((p) => p.id === values.practitionerId)?.name?.[0]?.given?.[0] +
            ' ' +
            practitioners.find((p) => p.id === values.practitionerId)?.name?.[0]?.family || 'Unknown Practitioner',
      };

      // Build activities based on template
      const activities = [];

      if (selectedTemplate?.action) {
        for (const action of selectedTemplate.action) {
          activities.push({
            detail: {
              status: 'not-started' as const,
              description: action.description || action.title,
              scheduledPeriod: {
                start: values.startDate.toISOString(),
                end: values.endDate.toISOString(),
              },
            },
          });
        }
      }

      // Create care plan
      const carePlan: CarePlan = {
        resourceType: 'CarePlan',
        status: values.status as 'draft' | 'active' | 'completed' | 'revoked',
        intent: 'plan',
        title: values.title,
        description: values.description,
        subject,
        author,
        created: new Date().toISOString(),
        period: {
          start: values.startDate.toISOString(),
          end: values.endDate.toISOString(),
        },
        activity: activities,
      };

      // Add basedOn reference if using a template
      if (values.templateId) {
        carePlan.basedOn = [
          {
            reference: `PlanDefinition/${values.templateId}`,
          },
        ];
      }

      // Add goal reference if template has goals
      if (selectedTemplate?.goal && selectedTemplate.goal.length > 0) {
        carePlan.goal = selectedTemplate.goal.map((goal) => ({
          reference: `Goal/${goal.id}`,
          display: goal.description?.text || 'Goal',
        }));
      }

      const result = await medplum.createResource(carePlan);

      notifications.show({
        title: 'Success',
        message: 'Care plan created successfully',
        color: 'green',
      });

      // Navigate to the new care plan
      void navigate(`/care-plans/${result.id}`);
    } catch (error) {
      console.error('Error creating care plan:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to create care plan',
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

  return (
    <Container size="lg" mt="xl">
      <Stack gap="md">
        <Group>
          <Button
            leftSection={<IconArrowLeft size={16} />}
            variant="outline"
            onClick={() => void navigate('/care-plans')}
          >
            Back to Care Plans
          </Button>
        </Group>

        <Card shadow="sm" p="xl" radius="md" withBorder>
          <Title order={2} mb="md">
            Create New Care Plan
          </Title>

          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="md">
              <Card shadow="xs" p="md" radius="md" withBorder>
                <Title order={4} mb="md">
                  1. Select Patient and Provider
                </Title>
                <Group grow mb="md">
                  <Select
                    label="Patient"
                    placeholder="Select a patient"
                    searchable
                    required
                    data={patients.map((patient) => ({
                      value: patient.id || '',
                      label: `${patient.name?.[0]?.given?.[0] || ''} ${patient.name?.[0]?.family || ''}`,
                    }))}
                    {...form.getInputProps('patientId')}
                  />

                  <Select
                    label="Care Provider"
                    placeholder="Select a provider"
                    searchable
                    required
                    data={practitioners.map((practitioner) => ({
                      value: practitioner.id || '',
                      label: `${practitioner.name?.[0]?.given?.[0] || ''} ${practitioner.name?.[0]?.family || ''}`,
                    }))}
                    {...form.getInputProps('practitionerId')}
                  />
                </Group>

                <Group grow mb="md">
                  <DateTimePicker
                    label="Start Date"
                    placeholder="Select start date"
                    required
                    {...form.getInputProps('startDate')}
                  />

                  <DateTimePicker
                    label="End Date"
                    placeholder="Select end date"
                    required
                    {...form.getInputProps('endDate')}
                  />
                </Group>

                <Select
                  label="Initial Status"
                  data={[
                    { value: 'draft', label: 'Draft' },
                    { value: 'active', label: 'Active' },
                  ]}
                  {...form.getInputProps('status')}
                />
              </Card>

              <Divider my="md" />

              <Card shadow="xs" p="md" radius="md" withBorder>
                <Title order={4} mb="md">
                  2. Select Care Protocol Template
                </Title>
                <Select
                  label="Protocol Template"
                  placeholder="Select a protocol template"
                  searchable
                  data={templates.map((template) => ({
                    value: template.id || '',
                    label: template.title || 'Untitled Protocol',
                  }))}
                  value={form.values.templateId}
                  onChange={handleTemplateChange}
                  mb="md"
                />

                {loadingTemplate && (
                  <Center py="md">
                    <Loader size="sm" />
                  </Center>
                )}

                {templateLoaded && selectedTemplate && (
                  <Box mt="md">
                    <Alert
                      title={selectedTemplate.title || 'Protocol Details'}
                      color="blue"
                      mb="md"
                      icon={<IconInfoCircle size={16} />}
                    >
                      <Text size="sm">{selectedTemplate.description || 'No description available'}</Text>

                      {selectedTemplate.goal && selectedTemplate.goal.length > 0 && (
                        <>
                          <Text size="sm" fw={500} mt="sm">
                            Goals:
                          </Text>
                          <List size="sm">
                            {selectedTemplate.goal.map((goal, index) => (
                              <List.Item key={index}>{goal.description?.text || `Goal ${index + 1}`}</List.Item>
                            ))}
                          </List>
                        </>
                      )}

                      {selectedTemplate.action && selectedTemplate.action.length > 0 && (
                        <>
                          <Text size="sm" fw={500} mt="sm">
                            Recommended Actions:
                          </Text>
                          <List size="sm">
                            {selectedTemplate.action.map((action, index) => (
                              <List.Item key={index}>
                                {action.title || action.description || `Action ${index + 1}`}
                              </List.Item>
                            ))}
                          </List>
                        </>
                      )}
                    </Alert>
                  </Box>
                )}
              </Card>

              <Divider my="md" />

              <Card shadow="xs" p="md" radius="md" withBorder>
                <Title order={4} mb="md">
                  3. Care Plan Details
                </Title>
                <TextInput
                  label="Care Plan Title"
                  placeholder="e.g., Growth and Development Care Plan"
                  required
                  mb="md"
                  {...form.getInputProps('title')}
                />

                <Textarea
                  label="Description"
                  placeholder="Brief description of this care plan"
                  minRows={3}
                  mb="md"
                  {...form.getInputProps('description')}
                />
              </Card>

              <Group justify="flex-end" mt="xl">
                <Button variant="outline" onClick={() => void navigate('/care-plans')}>
                  Cancel
                </Button>
                <Button type="submit" leftSection={<IconCheck size={16} />}>
                  Create Care Plan
                </Button>
              </Group>
            </Stack>
          </form>
        </Card>
      </Stack>
    </Container>
  );
}

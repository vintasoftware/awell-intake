import {
  Container,
  Title,
  Button,
  Group,
  TextInput,
  Textarea,
  Select,
  MultiSelect,
  Switch,
  NumberInput,
  Card,
  Divider,
  Tabs,
  Text,
  Box,
  Alert,
  Stack,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMedplum } from '@medplum/react';
import { PlanDefinition, PlanDefinitionGoal } from '@medplum/fhirtypes';
import { notifications } from '@mantine/notifications';
import {
  IconStethoscope,
  IconCalendarEvent,
  IconUser,
  IconClipboardList,
  IconBrandTabler,
  IconArrowLeft,
} from '@tabler/icons-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Common pediatric developmental milestones and screenings
const developmentalAssessments = [
  { value: 'growth', label: 'Growth Chart Measurements' },
  { value: 'asq', label: 'Ages & Stages Questionnaire (ASQ)' },
  { value: 'mchat', label: 'M-CHAT (Autism Screening)' },
  { value: 'head-circumference', label: 'Head Circumference' },
  { value: 'developmental-milestones', label: 'Developmental Milestones Review' },
  { value: 'vision-screening', label: 'Vision Screening' },
  { value: 'hearing-screening', label: 'Hearing Screening' },
  { value: 'blood-pressure', label: 'Blood Pressure' },
];

// Common pediatric preventive care interventions
const preventiveCareActivities = [
  { value: 'vaccines', label: 'Vaccination Administration' },
  { value: 'anticipatory-guidance', label: 'Anticipatory Guidance Discussion' },
  { value: 'nutrition-counseling', label: 'Nutrition Counseling' },
  { value: 'safety-counseling', label: 'Safety Counseling' },
  { value: 'lead-screening', label: 'Lead Screening' },
  { value: 'anemia-screening', label: 'Anemia Screening' },
  { value: 'dental-varnish', label: 'Fluoride Varnish Application' },
  { value: 'development-education', label: 'Developmental Education' },
];

// Common age range options for pediatric protocols
const ageRangeOptions = [
  { value: 'newborn', label: 'Newborn (0-1 month)' },
  { value: 'infant-early', label: 'Early Infancy (1-6 months)' },
  { value: 'infant-late', label: 'Late Infancy (6-12 months)' },
  { value: 'toddler', label: 'Toddler (1-3 years)' },
  { value: 'preschool', label: 'Preschool (3-5 years)' },
  { value: 'school-age', label: 'School Age (5-12 years)' },
  { value: 'adolescent', label: 'Adolescent (12-18 years)' },
];

// Template types
const templateOptions = [
  { value: 'well-child', label: 'Well-Child Visit Protocol' },
  { value: 'developmental-screening', label: 'Developmental Screening Protocol' },
  { value: 'vaccination', label: 'Vaccination Schedule Protocol' },
  { value: 'chronic-condition', label: 'Chronic Condition Management' },
  { value: 'behavioral-health', label: 'Behavioral Health Screening' },
  { value: 'custom', label: 'Custom Protocol' },
];

export function PlanDefinitionCreateForm() {
  const medplum = useMedplum();
  const navigate = useNavigate();
  const [templateType, setTemplateType] = useState<string | null>('well-child');
  const [activeTab, setActiveTab] = useState<string | null>('basics');

  // Form with initial values
  const form = useForm({
    initialValues: {
      title: '',
      status: 'draft' as PlanDefinition['status'],
      version: '1.0',
      description: '',
      purpose: '',
      ageRange: [] as string[],
      includeGrowthTracking: true,
      includeDevelopmentalScreening: true,
      includeVaccinations: true,
      includeAnticipGuidance: true,
      assessments: [] as string[],
      activities: [] as string[],
      visitFrequency: 3, // months
      goalDescription: 'Ensure appropriate growth and development',
    },
    validate: {
      title: (value) => (value.length < 3 ? 'Title must be at least 3 characters' : null),
      ageRange: (value) => (value.length === 0 ? 'Select at least one age range' : null),
    },
  });

  // Apply template presets
  const applyTemplate = (templateType: string | null) => {
    if (!templateType || templateType === 'custom') {
      form.setValues({
        ...form.values,
        assessments: [],
        activities: [],
        includeGrowthTracking: false,
        includeDevelopmentalScreening: false,
        includeVaccinations: false,
        includeAnticipGuidance: false,
      });
      return;
    }

    if (templateType === 'well-child') {
      form.setValues({
        ...form.values,
        title: form.values.title || 'Well-Child Visit Protocol',
        purpose:
          'Comprehensive well-child care including growth monitoring, developmental screening, and preventive care',
        assessments: ['growth', 'developmental-milestones', 'vision-screening', 'hearing-screening'],
        activities: ['vaccines', 'anticipatory-guidance', 'nutrition-counseling', 'safety-counseling'],
        includeGrowthTracking: true,
        includeDevelopmentalScreening: true,
        includeVaccinations: true,
        includeAnticipGuidance: true,
        goalDescription: 'Ensure appropriate growth and development according to pediatric standards',
      });
    } else if (templateType === 'developmental-screening') {
      form.setValues({
        ...form.values,
        title: form.values.title || 'Developmental Screening Protocol',
        purpose: 'Standardized screening for developmental delays and concerns',
        assessments: ['asq', 'mchat', 'developmental-milestones'],
        activities: ['development-education'],
        includeGrowthTracking: false,
        includeDevelopmentalScreening: true,
        includeVaccinations: false,
        includeAnticipGuidance: true,
        goalDescription: 'Early identification of developmental concerns and appropriate intervention',
      });
    } else if (templateType === 'vaccination') {
      form.setValues({
        ...form.values,
        title: form.values.title || 'Vaccination Schedule Protocol',
        purpose: 'Standard pediatric immunization schedule following CDC/AAP guidelines',
        assessments: [],
        activities: ['vaccines'],
        includeGrowthTracking: false,
        includeDevelopmentalScreening: false,
        includeVaccinations: true,
        includeAnticipGuidance: true,
        goalDescription: 'Complete age-appropriate immunizations per recommended schedule',
      });
    }
  };

  // Handle template selection change
  const handleTemplateChange = (value: string | null) => {
    setTemplateType(value);
    applyTemplate(value);
  };

  // Create PlanDefinition resource
  const handleSubmit = async (values: typeof form.values) => {
    // Create a goal for the PlanDefinition
    const goal: PlanDefinitionGoal = {
      description: {
        text: values.goalDescription,
      },
      addresses: [
        {
          text: 'Pediatric preventive care',
        },
      ],
      target: [],
    };

    if (values.includeGrowthTracking) {
      goal.target!.push({
        measure: {
          text: 'Growth parameters',
        },
      });
    }

    if (values.includeDevelopmentalScreening) {
      goal.target!.push({
        measure: {
          text: 'Developmental milestones',
        },
      });
    }

    // Create the PlanDefinition resource
    const planDefinition: PlanDefinition = {
      resourceType: 'PlanDefinition',
      status: values.status,
      title: values.title,
      version: values.version,
      description: values.description,
      purpose: values.purpose,
      useContext: values.ageRange.map((age) => ({
        code: {
          system: 'http://terminology.hl7.org/CodeSystem/usage-context-type',
          code: 'age',
        },
        valueCodeableConcept: {
          text: ageRangeOptions.find((option) => option.value === age)?.label,
        },
      })),
      goal: [goal],
      action: [],
    };

    // Add actions based on selected components
    if (values.includeGrowthTracking) {
      planDefinition.action?.push({
        title: 'Growth Measurement',
        description: 'Measure height, weight, and plot on appropriate growth chart',
        dynamicValue: [
          {
            path: 'timing',
            expression: {
              language: 'text/cql',
              expression: `Every ${values.visitFrequency} months`,
            },
          },
        ],
      });
    }

    if (values.includeDevelopmentalScreening) {
      planDefinition.action?.push({
        title: 'Developmental Screening',
        description: 'Perform age-appropriate developmental screening',
        dynamicValue: [
          {
            path: 'timing',
            expression: {
              language: 'text/cql',
              expression: `Every ${values.visitFrequency} months`,
            },
          },
        ],
      });
    }

    if (values.includeVaccinations) {
      planDefinition.action?.push({
        title: 'Vaccination Administration',
        description: 'Administer age-appropriate vaccinations per schedule',
        dynamicValue: [
          {
            path: 'timing',
            expression: {
              language: 'text/cql',
              expression: 'As indicated by vaccination schedule',
            },
          },
        ],
      });
    }

    if (values.includeAnticipGuidance) {
      planDefinition.action?.push({
        title: 'Anticipatory Guidance',
        description: 'Provide age-appropriate anticipatory guidance to caregivers',
        dynamicValue: [
          {
            path: 'timing',
            expression: {
              language: 'text/cql',
              expression: `Every ${values.visitFrequency} months`,
            },
          },
        ],
      });
    }

    // Add selected assessments
    values.assessments.forEach((assessment) => {
      const assessmentInfo = developmentalAssessments.find((a) => a.value === assessment);
      planDefinition.action?.push({
        title: assessmentInfo?.label || assessment,
        description: `Perform ${assessmentInfo?.label || assessment}`,
        dynamicValue: [
          {
            path: 'timing',
            expression: {
              language: 'text/cql',
              expression: 'As clinically indicated',
            },
          },
        ],
      });
    });

    // Add selected activities
    values.activities.forEach((activity) => {
      const activityInfo = preventiveCareActivities.find((a) => a.value === activity);
      planDefinition.action?.push({
        title: activityInfo?.label || activity,
        description: `Perform ${activityInfo?.label || activity}`,
        dynamicValue: [
          {
            path: 'timing',
            expression: {
              language: 'text/cql',
              expression: 'As clinically indicated',
            },
          },
        ],
      });
    });

    try {
      // Create the PlanDefinition
      const result = await medplum.createResource(planDefinition);

      notifications.show({
        title: 'Success',
        message: 'Care protocol created successfully',
        color: 'green',
      });

      // Navigate to the new PlanDefinition
      void navigate(`/care-plan-templates/${result.id}`);
    } catch (error) {
      console.error('Error creating PlanDefinition:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to create care protocol',
        color: 'red',
      });
    }
  };

  return (
    <Container size="xl" mt="xl">
      <Stack gap="md">
        <Group>
          <Button
            leftSection={<IconArrowLeft size={16} />}
            variant="outline"
            onClick={() => void navigate('/care-plan-templates')}
          >
            Back to Protocols
          </Button>
        </Group>

        <Title order={2}>Create New Care Protocol</Title>

        <Card shadow="sm" p="lg" radius="md" withBorder>
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="md">
              <Box mb="md">
                <Title order={4} mb="xs">
                  Template Selection
                </Title>
                <Text size="sm" color="dimmed" mb="md">
                  Select a starting template or create a custom protocol from scratch
                </Text>

                <Select
                  label="Protocol Type"
                  placeholder="Select a protocol type"
                  data={templateOptions}
                  value={templateType}
                  onChange={handleTemplateChange}
                />
              </Box>

              <Divider my="md" />

              <Tabs value={activeTab} onChange={setActiveTab}>
                <Tabs.List>
                  <Tabs.Tab value="basics" leftSection={<IconBrandTabler size={16} />}>
                    Basic Information
                  </Tabs.Tab>
                  <Tabs.Tab value="components" leftSection={<IconCalendarEvent size={16} />}>
                    Core Components
                  </Tabs.Tab>
                  <Tabs.Tab value="assessments" leftSection={<IconClipboardList size={16} />}>
                    Assessments
                  </Tabs.Tab>
                  <Tabs.Tab value="activities" leftSection={<IconUser size={16} />}>
                    Activities
                  </Tabs.Tab>
                  <Tabs.Tab value="goals" leftSection={<IconStethoscope size={16} />}>
                    Goals
                  </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="basics" pt="md">
                  <Stack gap="md">
                    <TextInput
                      label="Protocol Title"
                      placeholder="e.g., Infant Well-Visit Protocol"
                      required
                      {...form.getInputProps('title')}
                    />

                    <Group grow>
                      <Select
                        label="Status"
                        data={[
                          { value: 'draft', label: 'Draft' },
                          { value: 'active', label: 'Active' },
                          { value: 'retired', label: 'Retired' },
                        ]}
                        {...form.getInputProps('status')}
                      />
                      <TextInput label="Version" placeholder="1.0" {...form.getInputProps('version')} />
                    </Group>

                    <Textarea
                      label="Description"
                      placeholder="Brief description of this protocol"
                      minRows={2}
                      {...form.getInputProps('description')}
                    />

                    <Textarea
                      label="Purpose"
                      placeholder="The clinical purpose of this protocol"
                      minRows={2}
                      {...form.getInputProps('purpose')}
                    />

                    <MultiSelect
                      label="Age Range"
                      data={ageRangeOptions}
                      placeholder="Select age ranges for this protocol"
                      required
                      {...form.getInputProps('ageRange')}
                    />
                  </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="components" pt="md">
                  <Stack gap="md">
                    <Title order={5}>Core Protocol Components</Title>
                    <Text size="sm" color="dimmed">
                      Select the standard components to include in this pediatric protocol
                    </Text>

                    <Switch
                      label="Include Growth Tracking"
                      description="Height, weight, head circumference, and BMI measurements"
                      {...form.getInputProps('includeGrowthTracking', { type: 'checkbox' })}
                    />

                    <Switch
                      label="Include Developmental Screening"
                      description="Age-appropriate developmental milestone assessment"
                      {...form.getInputProps('includeDevelopmentalScreening', { type: 'checkbox' })}
                    />

                    <Switch
                      label="Include Vaccination Administration"
                      description="Age-appropriate immunization administration"
                      {...form.getInputProps('includeVaccinations', { type: 'checkbox' })}
                    />

                    <Switch
                      label="Include Anticipatory Guidance"
                      description="Age-appropriate education and counseling"
                      {...form.getInputProps('includeAnticipGuidance', { type: 'checkbox' })}
                    />

                    <NumberInput
                      label="Recommended Visit Frequency (months)"
                      placeholder="3"
                      min={1}
                      max={24}
                      {...form.getInputProps('visitFrequency')}
                    />
                  </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="assessments" pt="md">
                  <Stack gap="md">
                    <Title order={5}>Assessment Tools</Title>
                    <Text size="sm" color="dimmed">
                      Select screenings and assessments to include in this protocol
                    </Text>

                    <MultiSelect
                      label="Assessment Tools"
                      data={developmentalAssessments}
                      placeholder="Select assessments"
                      {...form.getInputProps('assessments')}
                    />
                  </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="activities" pt="md">
                  <Stack gap="md">
                    <Title order={5}>Preventive Care Activities</Title>
                    <Text size="sm" color="dimmed">
                      Select preventive care activities to include in this protocol
                    </Text>

                    <MultiSelect
                      label="Preventive Care Activities"
                      data={preventiveCareActivities}
                      placeholder="Select activities"
                      {...form.getInputProps('activities')}
                    />
                  </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="goals" pt="md">
                  <Stack gap="md">
                    <Title order={5}>Clinical Goals</Title>
                    <Text size="sm" color="dimmed">
                      Define the primary goal for this care protocol
                    </Text>

                    <Textarea
                      label="Goal Description"
                      placeholder="The primary goal of this protocol"
                      minRows={3}
                      {...form.getInputProps('goalDescription')}
                    />

                    <Alert color="blue" title="Goal Purpose">
                      Clearly defined goals help providers track the effectiveness of this protocol in patient care.
                      Goals should be specific, measurable, and clinically relevant.
                    </Alert>
                  </Stack>
                </Tabs.Panel>
              </Tabs>

              <Group justify="flex-end" mt="xl">
                <Button variant="outline" onClick={() => void navigate('/care-plan-templates')}>
                  Cancel
                </Button>
                <Button type="submit">Create Protocol</Button>
              </Group>
            </Stack>
          </form>
        </Card>
      </Stack>
    </Container>
  );
}

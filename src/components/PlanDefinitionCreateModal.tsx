import {
  Modal,
  TextInput,
  Textarea,
  Button,
  Group,
  Select,
  Title,
  Text,
  Divider,
  Stack,
  Switch,
  Box,
  MultiSelect,
  NumberInput,
  Tabs,
} from '@mantine/core';
import { useMedplum } from '@medplum/react';
import { PlanDefinition, PlanDefinitionGoal } from '@medplum/fhirtypes';
import { notifications } from '@mantine/notifications';
import { useForm } from '@mantine/form';
import { useNavigate } from 'react-router-dom';
import { IconStethoscope, IconCalendarEvent, IconUser, IconClipboardList } from '@tabler/icons-react';
import { useState } from 'react';

export interface PlanDefinitionCreateModalProps {
  opened: boolean;
  onClose: () => void;
}

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

export function PlanDefinitionCreateModal({ opened, onClose }: PlanDefinitionCreateModalProps) {
  const medplum = useMedplum();
  const navigate = useNavigate();
  const [templateType, setTemplateType] = useState<string | null>('well-child');

  // Form with initial values
  const form = useForm({
    initialValues: {
      title: '',
      status: 'draft',
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

    // Create actions based on selected assessments and activities
    const actions = [];

    // Add assessment actions
    for (const assessment of values.assessments) {
      const assessmentItem = developmentalAssessments.find((a) => a.value === assessment);
      if (assessmentItem) {
        actions.push({
          title: assessmentItem.label,
          description: `Perform ${assessmentItem.label} at appropriate intervals`,
          type: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/action-type',
                code: 'create',
              },
            ],
          },
        });
      }
    }

    // Add activity actions
    for (const activity of values.activities) {
      const activityItem = preventiveCareActivities.find((a) => a.value === activity);
      if (activityItem) {
        actions.push({
          title: activityItem.label,
          description: `Provide ${activityItem.label} at appropriate intervals`,
          type: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/action-type',
                code: 'create',
              },
            ],
          },
        });
      }
    }

    // Create useContext for age ranges
    const useContext = values.ageRange.map((range) => {
      const rangeItem = ageRangeOptions.find((a) => a.value === range);
      return {
        code: {
          system: 'http://terminology.hl7.org/CodeSystem/usage-context-type',
          code: 'age',
        },
        valueCodeableConcept: {
          text: rangeItem?.label || range,
        },
      };
    });

    // Create PlanDefinition resource
    const planDefinition: PlanDefinition = {
      resourceType: 'PlanDefinition',
      status: values.status as 'draft' | 'active' | 'retired' | 'unknown',
      title: values.title,
      description: values.description,
      version: values.version,
      purpose: values.purpose,
      useContext: useContext,
      goal: [goal],
      action: actions,
    };

    try {
      const result = await medplum.createResource(planDefinition);
      notifications.show({
        title: 'Success',
        message: 'Protocol created successfully',
        color: 'green',
      });
      onClose();
      void navigate(`/care-plan-templates/${result.id}`);
    } catch (error) {
      console.error('Error creating protocol:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to create protocol',
        color: 'red',
      });
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Create Care Protocol" size="xl">
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Box mb="md">
            <Title order={4} mb="xs">
              Template Selection
            </Title>
            <Text size="sm" color="dimmed" mb="md">
              Choose a template or start from scratch with a custom protocol
            </Text>
            <Select
              label="Protocol Template"
              placeholder="Select a template"
              data={templateOptions}
              value={templateType}
              onChange={handleTemplateChange}
              mb="md"
            />
          </Box>

          <Divider my="md" />

          <Box>
            <Title order={4} mb="md">
              Basic Information
            </Title>
            <TextInput
              label="Protocol Title"
              placeholder="e.g., Infant Well-Child Protocol (0-12 months)"
              required
              mb="md"
              {...form.getInputProps('title')}
            />

            <Group grow mb="md">
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
              mb="md"
              {...form.getInputProps('description')}
            />

            <Textarea
              label="Purpose"
              placeholder="The clinical purpose of this protocol"
              minRows={2}
              mb="md"
              {...form.getInputProps('purpose')}
            />
          </Box>

          <Divider my="md" />

          <Box>
            <Title order={4} mb="md">
              Target Population
            </Title>
            <MultiSelect
              label="Age Range"
              data={ageRangeOptions}
              placeholder="Select age ranges for this protocol"
              required
              mb="md"
              {...form.getInputProps('ageRange')}
            />
          </Box>

          <Divider my="md" />

          <Tabs defaultValue="components">
            <Tabs.List mb="md">
              <Tabs.Tab value="components" leftSection={<IconClipboardList size={16} />}>
                Protocol Components
              </Tabs.Tab>
              <Tabs.Tab value="assessments" leftSection={<IconStethoscope size={16} />}>
                Assessments
              </Tabs.Tab>
              <Tabs.Tab value="activities" leftSection={<IconCalendarEvent size={16} />}>
                Activities
              </Tabs.Tab>
              <Tabs.Tab value="goals" leftSection={<IconUser size={16} />}>
                Goals
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="components">
              <Stack gap="md">
                <Title order={5}>Core Protocol Components</Title>
                <Text size="sm" color="dimmed">
                  Select the standard components to include in this pediatric protocol
                </Text>

                <Switch
                  label="Include Growth Tracking"
                  description="Height, weight, BMI, and growth percentiles"
                  {...form.getInputProps('includeGrowthTracking', { type: 'checkbox' })}
                />

                <Switch
                  label="Include Developmental Screening"
                  description="Age-appropriate screening for developmental milestones"
                  {...form.getInputProps('includeDevelopmentalScreening', { type: 'checkbox' })}
                />

                <Switch
                  label="Include Vaccinations"
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

            <Tabs.Panel value="assessments">
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

            <Tabs.Panel value="activities">
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

            <Tabs.Panel value="goals">
              <Stack gap="md">
                <Title order={5}>Clinical Goals</Title>
                <Text size="sm" color="dimmed">
                  Define the primary goal for this care protocol
                </Text>

                <Textarea
                  label="Goal Description"
                  placeholder="The primary goal of this protocol"
                  minRows={2}
                  mb="md"
                  {...form.getInputProps('goalDescription')}
                />
              </Stack>
            </Tabs.Panel>
          </Tabs>

          <Group justify="flex-end" mt="xl">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Create Protocol</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

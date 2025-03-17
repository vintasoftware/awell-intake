import { Container, Title, Grid, Card, Text, Group, ThemeIcon, Stack, Button } from '@mantine/core';
import {
  IconBrain,
  IconHeartPlus,
  IconBabyCarriage,
  IconUsers,
  IconStethoscope
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

/**
 * Home page that greets the user and displays a list of patients.
 * @returns A React component that displays the home page.
 */
export function HomePage(): JSX.Element {
  const navigate = useNavigate();

  const specializations = [
    {
      title: 'General Health',
      icon: IconStethoscope,
      description: 'Comprehensive health assessments and primary care',
      color: 'blue'
    },
    {
      title: 'Elderly Care',
      icon: IconHeartPlus,
      description: 'Specialized care and monitoring for elderly patients',
      color: 'cyan'
    },
    {
      title: 'Mental Health',
      icon: IconBrain,
      description: 'Mental health assessments including PHQ2 evaluations',
      color: 'indigo'
    },
    {
      title: 'Pediatric Care',
      icon: IconBabyCarriage,
      description: 'Comprehensive care for children and adolescents',
      color: 'violet'
    }
  ];

  return (
    <Container size="xl">
      <Stack spacing="xl">
        <div>
          <Title order={1} color="blue.9" mb="xs">Welcome to Vinta Clinic</Title>
          <Text size="lg" color="dimmed">
            Providing specialized healthcare through streamlined patient care pathways
          </Text>
        </div>

        <Card shadow="sm" p="lg" radius="md" withBorder>
          <Group justify="space-between" mb="md">
            <div>
              <Title order={3} color="blue.9">Patient Onboarding</Title>
              <Text size="sm" color="dimmed">Our streamlined patient intake process</Text>
            </div>
          </Group>

          <Grid>
            <Grid.Col span={12}>
              <Group spacing="xl">
                <ThemeIcon size="xl" radius="md" color="blue">
                  <IconUsers size={24} />
                </ThemeIcon>
                <div>
                  <Text weight={500}>Efficient Intake Process</Text>
                  <Text size="sm" color="dimmed">
                    Initial assessment and specialization routing through our form-based system
                  </Text>
                </div>
              </Group>
            </Grid.Col>
          </Grid>
        </Card>

        <Title order={2} color="blue.9">Our Specializations</Title>
        <Grid>
          {specializations.map((spec) => (
            <Grid.Col key={spec.title} span={6}>
              <Card shadow="sm" p="lg" radius="md" withBorder>
                <Group noWrap>
                  <ThemeIcon size="xl" radius="md" color={spec.color}>
                    <spec.icon size={24} />
                  </ThemeIcon>
                  <div>
                    <Text weight={500}>{spec.title}</Text>
                    <Text size="sm" color="dimmed">
                      {spec.description}
                    </Text>
                  </div>
                </Group>
              </Card>
            </Grid.Col>
          ))}
        </Grid>

        <Card shadow="sm" p="lg" radius="md" withBorder>
          <Title order={3} color="blue.9" mb="md">Care Flow Process</Title>
          <Text>
            Our care process follows a structured pathway:
          </Text>
          <ol style={{ lineHeight: 1.6 }}>
            <li>Patient onboarding through initial intake forms</li>
            <li>Specialization selection based on patient needs</li>
            <li>Questionnaire and assessment completion</li>
            <li>Care pathway activation based on specialization</li>
            <li>Ongoing monitoring and care schedule management</li>
          </ol>
        </Card>
      </Stack>
    </Container>
  );
}

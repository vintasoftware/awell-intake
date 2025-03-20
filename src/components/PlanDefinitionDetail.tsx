import {
  Container,
  Title,
  Card,
  Group,
  Badge,
  Text,
  Tabs,
  Button,
  Accordion,
  List,
  Loader,
  Center,
  Alert,
  Stack,
} from '@mantine/core';
import { useMedplum } from '@medplum/react';
import { PlanDefinition } from '@medplum/fhirtypes';
import { IconInfoCircle, IconStethoscope, IconListCheck, IconArrowBack, IconPlus } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export function PlanDefinitionDetail() {
  const { id } = useParams<{ id: string }>();
  const medplum = useMedplum();
  const navigate = useNavigate();
  const [planDefinition, setPlanDefinition] = useState<PlanDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlanDefinition = async () => {
      if (!id) return;

      try {
        setLoading(true);
        const result = await medplum.readResource('PlanDefinition', id);
        setPlanDefinition(result);
      } catch (err) {
        console.error('Error fetching plan definition:', err);
        setError('Failed to load protocol details');
      } finally {
        setLoading(false);
      }
    };

    void fetchPlanDefinition();
  }, [id, medplum]);

  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Get status badge color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active':
        return 'green';
      case 'draft':
        return 'yellow';
      case 'retired':
        return 'gray';
      default:
        return 'blue';
    }
  };

  // Create a care plan based on this protocol
  const handleCreateCarePlan = () => {
    void navigate(`/care-plans/new?template=${id}`);
  };

  if (loading) {
    return (
      <Container size="xl" mt="xl">
        <Center h={300}>
          <Loader size="lg" />
        </Center>
      </Container>
    );
  }

  if (error || !planDefinition) {
    return (
      <Container size="xl" mt="xl">
        <Alert color="red" title="Error">
          {error || 'Protocol not found'}
        </Alert>
        <Button
          leftSection={<IconArrowBack size={16} />}
          variant="outline"
          onClick={() => void navigate('/care-plan-templates')}
          mt="md"
        >
          Back to Protocols
        </Button>
      </Container>
    );
  }

  return (
    <Container size="xl" mt="xl">
      <Stack gap="md">
        <Group>
          <Button
            leftSection={<IconArrowBack size={16} />}
            variant="outline"
            onClick={() => void navigate('/care-plan-templates')}
          >
            Back
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={handleCreateCarePlan}>
            Create Care Plan
          </Button>
        </Group>

        <Card shadow="sm" p="lg" radius="md" withBorder>
          <Group justify="space-between" mb="xs">
            <Title order={2}>{planDefinition.title || 'Untitled Protocol'}</Title>
            <Badge color={getStatusColor(planDefinition.status || 'unknown')} size="lg">
              {planDefinition.status?.charAt(0).toUpperCase() + planDefinition.status?.slice(1) || 'Unknown'}
            </Badge>
          </Group>

          {planDefinition.description && (
            <Text c="dimmed" mb="md">
              {planDefinition.description}
            </Text>
          )}

          <Group gap="xl" mb="md">
            {planDefinition.version && (
              <Text size="sm">
                <b>Version:</b> {planDefinition.version}
              </Text>
            )}
            {planDefinition.publisher && (
              <Text size="sm">
                <b>Publisher:</b> {planDefinition.publisher}
              </Text>
            )}
            {planDefinition.meta?.lastUpdated && (
              <Text size="sm">
                <b>Last Updated:</b> {formatDate(planDefinition.meta.lastUpdated)}
              </Text>
            )}
          </Group>
        </Card>

        <Tabs defaultValue="overview">
          <Tabs.List>
            <Tabs.Tab value="overview" leftSection={<IconInfoCircle size={16} />}>
              Overview
            </Tabs.Tab>
            <Tabs.Tab value="actions" leftSection={<IconListCheck size={16} />}>
              Actions & Activities
            </Tabs.Tab>
            <Tabs.Tab value="goals" leftSection={<IconStethoscope size={16} />}>
              Goals
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="overview" pt="md">
            <Card shadow="sm" p="lg" radius="md" withBorder>
              {planDefinition.purpose && (
                <>
                  <Title order={4} mb="xs">
                    Purpose
                  </Title>
                  <Text mb="lg">{planDefinition.purpose}</Text>
                </>
              )}

              {planDefinition.useContext && planDefinition.useContext.length > 0 && (
                <>
                  <Title order={4} mb="xs">
                    Applicable Contexts
                  </Title>
                  <List mb="lg">
                    {planDefinition.useContext.map((context, index) => (
                      <List.Item key={index}>
                        <Text>
                          <b>{context.code?.display || context.code?.code}:</b>{' '}
                          {context.valueCodeableConcept?.text ||
                            context.valueCodeableConcept?.coding?.[0]?.display ||
                            'Not specified'}
                        </Text>
                      </List.Item>
                    ))}
                  </List>
                </>
              )}

              {planDefinition.relatedArtifact && planDefinition.relatedArtifact.length > 0 && (
                <>
                  <Title order={4} mb="xs">
                    Related Resources
                  </Title>
                  <List mb="lg">
                    {planDefinition.relatedArtifact.map((artifact, index) => (
                      <List.Item key={index}>
                        <Text>
                          <b>{artifact.type}:</b>{' '}
                          {artifact.display || artifact.resource || artifact.document?.url || 'Not specified'}
                        </Text>
                      </List.Item>
                    ))}
                  </List>
                </>
              )}
            </Card>
          </Tabs.Panel>

          <Tabs.Panel value="actions" pt="md">
            <Card shadow="sm" p="lg" radius="md" withBorder>
              {planDefinition.action && planDefinition.action.length > 0 ? (
                <Accordion>
                  {planDefinition.action.map((action, index) => (
                    <Accordion.Item key={index} value={`action-${index}`}>
                      <Accordion.Control>
                        <Text fw={500}>{action.title || `Action ${index + 1}`}</Text>
                      </Accordion.Control>
                      <Accordion.Panel>
                        {action.description && <Text mb="md">{action.description}</Text>}
                        {action.textEquivalent && (
                          <Text mb="md" style={{ fontStyle: 'italic' }}>
                            &quot;{action.textEquivalent}&quot;
                          </Text>
                        )}

                        {action.action && action.action.length > 0 && (
                          <>
                            <Title order={5} mb="xs">
                              Sub-Actions
                            </Title>
                            <List type="ordered" mb="md">
                              {action.action.map((subAction, subIndex) => (
                                <List.Item key={subIndex}>
                                  <Text fw={500}>{subAction.title || `Sub-Action ${subIndex + 1}`}</Text>
                                  {subAction.description && (
                                    <Text size="sm" ml="md">
                                      {subAction.description}
                                    </Text>
                                  )}
                                  {subAction.textEquivalent && (
                                    <Text size="sm" ml="md" style={{ fontStyle: 'italic' }}>
                                      &quot;{subAction.textEquivalent}&quot;
                                    </Text>
                                  )}
                                </List.Item>
                              ))}
                            </List>
                          </>
                        )}
                      </Accordion.Panel>
                    </Accordion.Item>
                  ))}
                </Accordion>
              ) : (
                <Text>No actions defined for this protocol.</Text>
              )}
            </Card>
          </Tabs.Panel>

          <Tabs.Panel value="goals" pt="md">
            <Card shadow="sm" p="lg" radius="md" withBorder>
              {planDefinition.goal && planDefinition.goal.length > 0 ? (
                planDefinition.goal.map((goal, index) => (
                  <Card key={index} shadow="xs" p="md" radius="md" withBorder mb="md">
                    <Title order={4} mb="xs">
                      {goal.description?.text || `Goal ${index + 1}`}
                    </Title>

                    {goal.category && (
                      <Text size="sm" mb="xs">
                        <b>Category:</b> {goal.category.text || goal.category.coding?.[0]?.display}
                      </Text>
                    )}

                    {goal.priority && (
                      <Text size="sm" mb="xs">
                        <b>Priority:</b> {goal.priority.text || goal.priority.coding?.[0]?.display}
                      </Text>
                    )}

                    {goal.addresses && goal.addresses.length > 0 && (
                      <>
                        <Text size="sm" mb="xs">
                          <b>Addresses:</b>
                        </Text>
                        <List size="sm" mb="md">
                          {goal.addresses.map((condition, condIndex) => (
                            <List.Item key={condIndex}>
                              {condition.text || condition.coding?.[0]?.display || 'Condition'}
                            </List.Item>
                          ))}
                        </List>
                      </>
                    )}

                    {goal.target && goal.target.length > 0 && (
                      <>
                        <Text size="sm" mb="xs">
                          <b>Targets:</b>
                        </Text>
                        <List size="sm">
                          {goal.target.map((target, targetIndex) => (
                            <List.Item key={targetIndex}>
                              {target.measure?.text || target.measure?.coding?.[0]?.display || 'Measure'}
                              {target.detailQuantity &&
                                `: ${target.detailQuantity.value} ${target.detailQuantity.unit || ''}`}
                              {target.detailRange &&
                                `: ${target.detailRange.low?.value || ''}-${target.detailRange.high?.value || ''} ${target.detailRange.high?.unit || ''}`}
                            </List.Item>
                          ))}
                        </List>
                      </>
                    )}
                  </Card>
                ))
              ) : (
                <Text>No goals defined for this protocol.</Text>
              )}
            </Card>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Container>
  );
}

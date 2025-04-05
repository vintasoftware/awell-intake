import {
  Container,
  Title,
  Group,
  Button,
  TextInput,
  Select,
  Card,
  SimpleGrid,
  Text,
  Badge,
  Loader,
  Center,
  Stack,
} from '@mantine/core';
import { useMedplum } from '@medplum/react';
import { PlanDefinition } from '@medplum/fhirtypes';
import { IconPlus, IconSearch, IconFileText, IconCalendar, IconUsers } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlanDefinitionCreateModal } from './PlanDefinitionCreateModal';

// Status badge color mapping
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

// Get suitable icon for a protocol
const getProtocolIcon = (title: string) => {
  const titleLower = title.toLowerCase();
  if (titleLower.includes('infant') || titleLower.includes('newborn') || titleLower.includes('baby')) {
    return <IconUsers size={24} />;
  }
  if (titleLower.includes('wellness') || titleLower.includes('visit')) {
    return <IconCalendar size={24} />;
  }
  return <IconFileText size={24} />;
};

export function PlanDefinitionList() {
  const medplum = useMedplum();
  const navigate = useNavigate();
  const [planDefinitions, setPlanDefinitions] = useState<PlanDefinition[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ageFilter, setAgeFilter] = useState('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);

  useEffect(() => {
    const fetchPlanDefinitions = async () => {
      try {
        setLoading(true);
        // Fetch PlanDefinitions from Medplum FHIR server
        const results = await medplum.searchResources('PlanDefinition', {
          _count: '100',
          _sort: '-_lastUpdated',
        });
        setPlanDefinitions(results);
      } catch (error) {
        console.error('Error fetching plan definitions:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchPlanDefinitions();
  }, [medplum]);

  // Extract age ranges from useContext if available
  const getAgeRange = (planDefinition: PlanDefinition): string => {
    if (!planDefinition.useContext || planDefinition.useContext.length === 0) {
      return 'All ages';
    }

    const ageContext = planDefinition.useContext.find((context) => context.code?.code === 'age');

    if (!ageContext || !ageContext.valueCodeableConcept) {
      return 'All ages';
    }

    return ageContext.valueCodeableConcept.text || ageContext.valueCodeableConcept.coding?.[0]?.display || 'All ages';
  };

  // Filter plan definitions based on search and filters
  const filteredPlanDefinitions = planDefinitions.filter((plan) => {
    // Filter by search term
    const matchesSearch =
      plan.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      false ||
      plan.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      false;

    // Filter by status
    const matchesStatus = statusFilter === 'all' || plan.status === statusFilter;

    // Filter by age group (simplified for now)
    if (ageFilter === 'all') {
      return matchesSearch && matchesStatus;
    }

    const ageRange = getAgeRange(plan).toLowerCase();
    if (
      ageFilter === 'infant' &&
      (ageRange.includes('infant') || ageRange.includes('0-') || ageRange.includes('newborn'))
    ) {
      return matchesSearch && matchesStatus;
    }
    if (ageFilter === 'child' && (ageRange.includes('child') || ageRange.includes('3-') || ageRange.includes('5-'))) {
      return matchesSearch && matchesStatus;
    }
    if (
      ageFilter === 'adolescent' &&
      (ageRange.includes('adolescent') || ageRange.includes('teen') || ageRange.includes('12-'))
    ) {
      return matchesSearch && matchesStatus;
    }
    if (ageFilter === 'adult' && (ageRange.includes('adult') || ageRange.includes('18+'))) {
      return matchesSearch && matchesStatus;
    }

    return false;
  });

  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleCreateProtocol = () => {
    void navigate('/care-plan-templates/new');
  };

  return (
    <Container size="xl" mt="xl">
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={2} c="blue.9">
            Care Protocols
          </Title>
          <Button leftSection={<IconPlus size={16} />} onClick={handleCreateProtocol}>
            Create Protocol
          </Button>
        </Group>

        <Card shadow="sm" p="md" radius="md" withBorder>
          <Group mb="md">
            <TextInput
              placeholder="Search protocols..."
              leftSection={<IconSearch size={16} />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ flexGrow: 1 }}
            />
            <Select
              label="Status"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value || 'all')}
              data={[
                { value: 'all', label: 'All Statuses' },
                { value: 'active', label: 'Active' },
                { value: 'draft', label: 'Draft' },
                { value: 'retired', label: 'Retired' },
              ]}
              style={{ width: 150 }}
            />
            <Select
              label="Age Group"
              value={ageFilter}
              onChange={(value) => setAgeFilter(value || 'all')}
              data={[
                { value: 'all', label: 'All Ages' },
                { value: 'infant', label: 'Infant (0-2y)' },
                { value: 'child', label: 'Child (3-11y)' },
                { value: 'adolescent', label: 'Adolescent (12-18y)' },
                { value: 'adult', label: 'Adult (18+)' },
              ]}
              style={{ width: 180 }}
            />
          </Group>
        </Card>

        <Card shadow="sm" p="md" radius="md" withBorder>
          {loading ? (
            <Center h={200}>
              <Loader size="lg" />
            </Center>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
              {filteredPlanDefinitions.length > 0 ? (
                filteredPlanDefinitions.map((plan) => (
                  <Card
                    key={plan.id}
                    shadow="sm"
                    padding="lg"
                    radius="md"
                    withBorder
                    style={{ cursor: 'pointer' }}
                    onClick={() => void navigate(`/care-plan-templates/${plan.id}`)}
                  >
                    <Group align="flex-start" gap="xs">
                      {getProtocolIcon(plan.title || '')}
                      <div style={{ flex: 1 }}>
                        <Text fw={500} size="lg" lineClamp={1}>
                          {plan.title || 'Untitled Protocol'}
                        </Text>
                        <Badge color={getStatusColor(plan.status || 'unknown')} mb="sm">
                          {plan.status?.charAt(0).toUpperCase() + plan.status?.slice(1) || 'Unknown'}
                        </Badge>
                      </div>
                    </Group>

                    {plan.description && (
                      <Text size="sm" c="dimmed" lineClamp={2} mb="md">
                        {plan.description}
                      </Text>
                    )}

                    <Group justify="space-between" mt="md">
                      <Text size="xs" c="dimmed">
                        Age: {getAgeRange(plan)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {plan.meta?.lastUpdated ? `Updated: ${formatDate(plan.meta.lastUpdated)}` : ''}
                      </Text>
                    </Group>

                    <Group mt="md">
                      <Button
                        variant="light"
                        fullWidth
                        onClick={(e) => {
                          e.stopPropagation();
                          void navigate(`/care-plans/new?template=${plan.id}`);
                        }}
                      >
                        Use This Protocol
                      </Button>
                    </Group>
                  </Card>
                ))
              ) : (
                <Card p="lg" shadow="sm" withBorder style={{ gridColumn: '1 / -1' }}>
                  <Center py="xl">
                    <Text>
                      {searchTerm || statusFilter !== 'all' || ageFilter !== 'all'
                        ? 'No protocols match your search criteria'
                        : 'No protocols found. Create a new protocol to get started.'}
                    </Text>
                  </Center>
                </Card>
              )}
            </SimpleGrid>
          )}
        </Card>
      </Stack>

      <PlanDefinitionCreateModal opened={createModalOpen} onClose={() => setCreateModalOpen(false)} />
    </Container>
  );
}

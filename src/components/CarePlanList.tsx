import {
  Container,
  Title,
  Group,
  Button,
  TextInput,
  Select,
  Card,
  Table,
  Badge,
  Text,
  ActionIcon,
  Loader,
  Center,
  Stack,
} from '@mantine/core';
import { useMedplum } from '@medplum/react';
import { CarePlan, Patient, Reference } from '@medplum/fhirtypes';
import { IconPlus, IconSearch, IconChevronRight } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MedplumClient } from '@medplum/core';

// Helper function to extract patient name from reference
const getPatientName = async (medplum: MedplumClient, reference: Reference<Patient>) => {
  try {
    if (!reference.reference) return 'Unknown Patient';
    const patient = await medplum.readReference(reference);
    return patient?.name?.[0]?.given?.[0] + ' ' + patient?.name?.[0]?.family || 'Unknown Patient';
  } catch (error) {
    console.error('Error fetching patient:', error);
    return 'Unknown Patient';
  }
};

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

export function CarePlanList() {
  const medplum = useMedplum();
  const navigate = useNavigate();
  const [carePlans, setCarePlans] = useState<(CarePlan & { patientName?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const fetchCarePlans = async () => {
      try {
        setLoading(true);
        // Fetch CarePlans from Medplum FHIR server
        const results = await medplum.searchResources('CarePlan', {
          _count: '100',
          _sort: '-_lastUpdated',
        });

        // Enhance with patient names
        const enhancedResults = await Promise.all(
          results.map(async (carePlan: CarePlan) => {
            let patientName = 'Unknown Patient';
            if (carePlan.subject && carePlan.subject.reference?.includes('Patient')) {
              patientName = await getPatientName(medplum, carePlan.subject as Reference<Patient>);
            }
            return { ...carePlan, patientName };
          })
        );

        setCarePlans(enhancedResults);
      } catch (error) {
        console.error('Error fetching care plans:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchCarePlans();
  }, [medplum]);

  const filteredCarePlans = carePlans.filter((plan) => {
    // Filter by search term (patient name or title)
    const matchesSearch =
      plan.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      false ||
      plan.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      false;

    // Filter by status
    const matchesStatus = statusFilter === 'all' || plan.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleCreateCarePlan = () => {
    void navigate('/care-plans/new');
  };

  return (
    <Container size="xl" mt="xl">
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={2} c="blue.9">
            Care Plans
          </Title>
          <Button leftSection={<IconPlus size={16} />} onClick={handleCreateCarePlan}>
            Create Care Plan
          </Button>
        </Group>

        <Card shadow="sm" p="md" radius="md" withBorder>
          <Group mb="md">
            <TextInput
              placeholder="Search by patient or title..."
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
                { value: 'completed', label: 'Completed' },
                { value: 'draft', label: 'Draft' },
                { value: 'revoked', label: 'Revoked' },
              ]}
              style={{ width: 200 }}
            />
          </Group>
        </Card>

        <Card shadow="sm" p="md" radius="md" withBorder>
          {loading ? (
            <Center h={200}>
              <Loader size="lg" />
            </Center>
          ) : (
            <Table highlightOnHover verticalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Patient</Table.Th>
                  <Table.Th>Title/Description</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Created</Table.Th>
                  <Table.Th>Period</Table.Th>
                  <Table.Th style={{ width: 80 }}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredCarePlans.length > 0 ? (
                  filteredCarePlans.map((plan) => (
                    <Table.Tr
                      key={plan.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => void navigate(`/care-plans/${plan.id}`)}
                    >
                      <Table.Td>
                        <Text fw={500}>{plan.patientName}</Text>
                        {plan.subject?.reference && (
                          <Text size="xs" c="dimmed">
                            {plan.subject.reference}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text fw={500}>{plan.title || 'Untitled Care Plan'}</Text>
                        {plan.description && (
                          <Text size="xs" c="dimmed" lineClamp={1}>
                            {plan.description}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Badge color={getStatusColor(plan.status || 'unknown')}>
                          {formatStatus(plan.status || 'unknown')}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{plan.meta?.lastUpdated ? formatDate(plan.meta.lastUpdated) : 'N/A'}</Table.Td>
                      <Table.Td>
                        {plan.period?.start && (
                          <Text size="sm">
                            {formatDate(plan.period.start)}
                            {plan.period.end ? ` - ${formatDate(plan.period.end)}` : ' (ongoing)'}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon color="blue" variant="subtle">
                          <IconChevronRight size={16} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))
                ) : (
                  <Table.Tr>
                    <Table.Td colSpan={6} align="center">
                      <Text py="lg">
                        {searchTerm || statusFilter !== 'all'
                          ? 'No care plans match your search criteria'
                          : 'No care plans found. Create a new care plan to get started.'}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          )}
        </Card>
      </Stack>
    </Container>
  );
}

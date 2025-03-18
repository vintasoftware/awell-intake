import { useMedplum } from '@medplum/react';
import { Patient } from '@medplum/fhirtypes';
import {
  Table,
  Card,
  Text,
  Group,
  TextInput,
  ActionIcon,
  Container,
  Title,
  Stack,
  Badge,
  Loader,
  Center,
  Button
} from '@mantine/core';
import { IconSearch, IconChevronRight, IconPlus } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreatePatientModal } from './CreatePatientModal';

export function PatientList() {
  const medplum = useMedplum();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  useEffect(() => {
    const fetchPatients = async () => {
      const results = await medplum.searchResources('Patient', {});
      setPatients(results);
    };
    fetchPatients();
  }, [medplum]);

  const filteredPatients = patients.filter(patient =>
    `${patient.name?.[0]?.given?.[0]} ${patient.name?.[0]?.family}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handlePatientCreated = (newPatient: Patient) => {
    setPatients([newPatient, ...patients]);
  };

  return (
    <Container size="xl" mt="xl">
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={2} c="blue.9">Patients</Title>
          <Group>
            <TextInput
              placeholder="Search patients..."
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: 300 }}
            />
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => setCreateModalOpen(true)}
            >
              Create Patient
            </Button>
          </Group>
        </Group>

        <Card shadow="sm" p="md" radius="md" withBorder>
          {loading ? (
            <Center h={200}>
              <Loader size="lg" />
            </Center>
          ) : (
            <Table
              highlightOnHover
              verticalSpacing="md"
              horizontalSpacing="lg"
              styles={{
                th: {
                  padding: '0 0 1rem 0',
                  fontWeight: 600,
                },
              }}
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Date of Birth</Table.Th>
                  <Table.Th>Gender</Table.Th>
                  <Table.Th>MRN</Table.Th>
                  <Table.Th style={{ width: 50 }}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredPatients.map((patient) => (
                  <Table.Tr
                    key={patient.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/patients/${patient.id}`)}
                  >
                    <td>
                      <Group gap="sm">
                        <div>
                          <Text fw={500}>
                            {patient.name?.[0]?.given?.[0]} {patient.name?.[0]?.family}
                          </Text>
                          {patient.telecom?.[0]?.value && (
                            <Text size="xs" c="dimmed">
                              {patient.telecom[0].value}
                            </Text>
                          )}
                        </div>
                      </Group>
                    </td>
                    <td>
                      <Text>{patient.birthDate && formatDate(patient.birthDate)}</Text>
                    </td>
                    <td>
                      <Badge
                        color={patient.gender === 'male' ? 'blue' : 'pink'}
                        variant="light"
                      >
                        {(patient.gender || 'N/A').charAt(0).toUpperCase() + (patient.gender || 'N/A').slice(1)}
                      </Badge>
                    </td>
                    <td>
                      <Text c="dimmed" size="sm">
                        {patient.id?.slice(0, 8)}
                      </Text>
                    </td>
                    <td>
                      <ActionIcon color="blue" variant="subtle">
                        <IconChevronRight size={16} />
                      </ActionIcon>
                    </td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Card>
      </Stack>

      <CreatePatientModal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onPatientCreated={handlePatientCreated}
      />
    </Container>
  );
}
import {
  Button,
  Container,
  Title,
  Text,
  Paper,
  TextInput,
  Group,
  Stack,
  Card,
  Badge,
  Modal,
  Select,
  ActionIcon,
} from '@mantine/core';
import { Practitioner, PractitionerRole } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { IconTrash, IconPlus } from '@tabler/icons-react';

export function PractitionerDetail(): JSX.Element {
  const { id } = useParams();
  const medplum = useMedplum();
  const navigate = useNavigate();
  const [practitioner, setPractitioner] = useState<Practitioner | undefined>();
  const [roles, setRoles] = useState<PractitionerRole[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [specialtyModalOpen, setSpecialtyModalOpen] = useState<boolean>(false);
  const [newSpecialty, setNewSpecialty] = useState<string>('');
  const availableSpecialties = [
    'Cardiology',
    'Dermatology',
    'Endocrinology',
    'Gastroenterology',
    'Neurology',
    'Oncology',
    'Orthopedics',
    'Pediatrics',
    'Psychiatry',
    'Radiology',
    'Surgery',
    'Urology',
    'Family Medicine',
    'Internal Medicine',
  ];

  const loadPractitioner = useCallback(async (): Promise<void> => {
    if (id === 'new') {
      setPractitioner({
        resourceType: 'Practitioner',
        name: [{ given: [''], family: '' }],
        telecom: [{ system: 'phone', value: '' }],
      });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const practitionerResource = await medplum.readResource('Practitioner', id as string);
      setPractitioner(practitionerResource);

      // Load PractitionerRole resources for this practitioner
      const rolesResponse = await medplum.search('PractitionerRole', {
        practitioner: `Practitioner/${id}`,
      });
      setRoles((rolesResponse.entry || []).map((entry) => entry.resource as PractitionerRole));
    } catch (error) {
      console.error('Error loading practitioner', error);
    } finally {
      setLoading(false);
    }
  }, [id, medplum]);

  useEffect(() => {
    if (id) {
      void loadPractitioner();
    }
  }, [id, loadPractitioner]);

  async function savePractitioner(): Promise<void> {
    if (!practitioner) return;

    try {
      const result =
        id === 'new' ? await medplum.createResource(practitioner) : await medplum.updateResource(practitioner);

      if (id === 'new') {
        void navigate(`/practitioners/${result.id}`);
      } else {
        setPractitioner(result);
      }
    } catch (error) {
      console.error('Error saving practitioner', error);
    }
  }

  async function addSpecialty(): Promise<void> {
    if (!practitioner?.id || !newSpecialty) return;

    try {
      const newRole: PractitionerRole = {
        resourceType: 'PractitionerRole',
        practitioner: {
          reference: `Practitioner/${practitioner.id}`,
          display: getFullName(practitioner),
        },
        specialty: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/practitioner-specialty',
                code: newSpecialty.toLowerCase().replace(/\s/g, '-'),
                display: newSpecialty,
              },
            ],
          },
        ],
        active: true,
      };

      const result = await medplum.createResource(newRole);
      setRoles([...roles, result]);
      setSpecialtyModalOpen(false);
      setNewSpecialty('');
    } catch (error) {
      console.error('Error adding specialty', error);
    }
  }

  async function removeSpecialty(roleId: string): Promise<void> {
    try {
      await medplum.deleteResource('PractitionerRole', roleId);
      setRoles(roles.filter((role) => role.id !== roleId));
    } catch (error) {
      console.error('Error removing specialty', error);
    }
  }

  function getFullName(p: Practitioner): string {
    const name = p.name?.[0];
    return [name?.prefix?.[0], name?.given?.[0], name?.family].filter(Boolean).join(' ') || 'Unknown';
  }

  function updateName(field: 'prefix' | 'given' | 'family', value: string): void {
    if (!practitioner) return;

    const updatedPractitioner = { ...practitioner };
    if (!updatedPractitioner.name?.[0]) {
      updatedPractitioner.name = [{ prefix: [], given: [''], family: '' }];
    }

    if (field === 'given') {
      updatedPractitioner.name[0].given = [value];
    } else if (field === 'family') {
      updatedPractitioner.name[0].family = value;
    } else if (field === 'prefix') {
      if (!value) {
        updatedPractitioner.name[0].prefix = [];
      } else {
        updatedPractitioner.name[0].prefix = [value];
      }
    }

    setPractitioner(updatedPractitioner);
  }

  if (loading) {
    return (
      <Container>
        <Text>Loading practitioner details...</Text>
      </Container>
    );
  }

  if (!practitioner) {
    return (
      <Container>
        <Text>Practitioner not found</Text>
      </Container>
    );
  }

  return (
    <Container size="lg">
      <Group justify="space-between" mb="md">
        <Title order={2}>{id === 'new' ? 'New Practitioner' : getFullName(practitioner)}</Title>
        <Button onClick={() => void savePractitioner()}>Save</Button>
      </Group>

      <Paper p="md" withBorder mb="xl">
        <Stack gap="md">
          <Title order={4}>Basic Information</Title>

          <Group grow>
            <TextInput
              label="Prefix"
              placeholder="e.g., Dr., Prof., MD, DNP, PA-C"
              value={practitioner.name?.[0]?.prefix?.[0] || ''}
              onChange={(e) => updateName('prefix', e.target.value)}
            />
            <TextInput
              label="First Name"
              value={practitioner.name?.[0]?.given?.[0] || ''}
              onChange={(e) => updateName('given', e.target.value)}
            />
            <TextInput
              label="Last Name"
              value={practitioner.name?.[0]?.family || ''}
              onChange={(e) => updateName('family', e.target.value)}
            />
          </Group>
        </Stack>
      </Paper>

      {id !== 'new' && (
        <Paper p="md" withBorder>
          <Group justify="space-between" mb="md">
            <Title order={4}>Specialties</Title>
            <Button leftSection={<IconPlus size={16} />} onClick={() => setSpecialtyModalOpen(true)} size="sm">
              Add Specialty
            </Button>
          </Group>

          {roles.length === 0 ? (
            <Text c="dimmed">No specialties assigned</Text>
          ) : (
            <Stack gap="md">
              {roles.map((role) => (
                <Card key={role.id} padding="sm" withBorder>
                  <Group justify="space-between">
                    <Group>
                      <Badge size="lg" color="blue">
                        {role.specialty?.[0]?.coding?.[0]?.display || 'Unknown Specialty'}
                      </Badge>
                      {role.active === false && <Badge color="red">Inactive</Badge>}
                    </Group>
                    <ActionIcon color="red" onClick={() => void removeSpecialty(role.id as string)}>
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Card>
              ))}
            </Stack>
          )}
        </Paper>
      )}

      <Modal title="Add Specialty" opened={specialtyModalOpen} onClose={() => setSpecialtyModalOpen(false)}>
        <Stack gap="md">
          <Select
            label="Select Specialty"
            data={availableSpecialties}
            value={newSpecialty}
            onChange={(value) => setNewSpecialty(value || '')}
            searchable
            clearable
          />
          <Group justify="flex-end">
            <Button variant="outline" onClick={() => setSpecialtyModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void addSpecialty()} disabled={!newSpecialty}>
              Add
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}

import { Container, Group, Paper, Table, Text, Title } from '@mantine/core';
import { Practitioner } from '@medplum/fhirtypes';
import { useMedplum, MedplumLink } from '@medplum/react';
import { useState, useEffect } from 'react';

export function PractitionerList(): JSX.Element {
  const medplum = useMedplum();
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadPractitioners(): Promise<void> {
      try {
        setLoading(true);
        const response = await medplum.search('Practitioner', {
          _count: 100,
          _sort: 'name',
        });
        setPractitioners((response.entry || []).map((entry) => entry.resource as Practitioner));
      } catch (error) {
        console.error('Error loading practitioners', error);
      } finally {
        setLoading(false);
      }
    }

    void loadPractitioners();
  }, [medplum]);

  const rows = practitioners.map((practitioner) => {
    const name = practitioner.name?.[0];
    const fullName = [name?.prefix?.[0], name?.given?.[0], name?.family].filter(Boolean).join(' ');

    return (
      <Table.Tr key={practitioner.id}>
        <Table.Td>
          <MedplumLink to={`/practitioners/${practitioner.id}`}>{fullName || 'Unknown name'}</MedplumLink>
        </Table.Td>
        <Table.Td>{practitioner.telecom?.[0]?.value || '-'}</Table.Td>
        <Table.Td>{practitioner.identifier?.[0]?.value || '-'}</Table.Td>
      </Table.Tr>
    );
  });

  return (
    <Container size="lg">
      <Group justify="space-between" mb="md">
        <Title order={2}>Practitioners</Title>
      </Group>

      <Paper p="md" withBorder>
        {loading ? (
          <Text>Loading practitioners...</Text>
        ) : practitioners.length === 0 ? (
          <Text>No practitioners found</Text>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Contact</Table.Th>
                <Table.Th>Identifier</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{rows}</Table.Tbody>
          </Table>
        )}
      </Paper>
    </Container>
  );
}

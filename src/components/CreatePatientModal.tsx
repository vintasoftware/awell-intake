import { useState } from 'react';
import { Drawer, TextInput, Button, Group, Stack, Title, Text, Switch, LoadingOverlay } from '@mantine/core';
import { useForm, matches } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMedplum } from '@medplum/react';
import { Task } from '@medplum/fhirtypes';
import { IconCheck, IconX } from '@tabler/icons-react';

interface CreatePatientModalProps {
  opened: boolean;
  onClose: () => void;
}

interface PatientFormValues {
  phone: string;
}

export function CreatePatientModal({ opened, onClose }: CreatePatientModalProps) {
  const medplum = useMedplum();
  const [startTriage, setStartTriage] = useState(true);
  const [loading, setLoading] = useState(false);

  // E.164 format: + followed by 1-15 digits (e.g., +12345678900)
  const phoneRegex = /^\+[1-9]\d{1,14}$/;

  const form = useForm<PatientFormValues>({
    initialValues: {
      phone: '',
    },
    validate: {
      phone: matches(phoneRegex, 'Please enter a valid phone number'),
    },
  });

  const resetForm = () => {
    form.reset();
    setStartTriage(true);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const createPatient = async (values: PatientFormValues) => {
    setLoading(true);
    if (!startTriage) {
      notifications.show({
        title: 'Nothing to do.',
        message: 'Triage is not enabled.',
        color: 'gray',
        icon: <IconCheck />,
      });
      setLoading(false);
      handleClose();
      return;
    }

    try {
      const taskData: Task = {
        resourceType: 'Task',
        status: 'accepted',
        intent: 'order',
        description: 'Trigger Triage',
        code: {
          text: 'Trigger Triage',
        },
        input: [
          {
            type: {
              text: 'Trigger Triage on Awell',
            },
            valueContactPoint: {
              system: 'phone',
              value: values.phone,
            },
          },
        ],
      };
      await medplum.createResource<Task>(taskData);

      notifications.show({
        title: 'Success',
        message: 'Triage triggered successfully',
        color: 'green',
        icon: <IconCheck />,
      });
      handleClose();
    } catch (error) {
      console.error('Error creating patient:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to trigger triage',
        color: 'red',
        icon: <IconX />,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      opened={opened}
      onClose={handleClose}
      position="right"
      title={<Title order={3}>Start Triage</Title>}
      padding="xl"
      size="md"
    >
      <div style={{ position: 'relative' }}>
        <LoadingOverlay visible={loading} />

        <form onSubmit={form.onSubmit(createPatient)}>
          <Stack gap="md">
            <Text>Enter patient information below. All fields are required.</Text>

            <TextInput
              label="Phone"
              placeholder="+12345678900"
              required
              {...form.getInputProps('phone')}
              description="Format: +1 followed by 10 digits (E.164 format)"
            />

            <Switch
              label="Start triage care flow after creation"
              checked={startTriage}
              onChange={(e) => setStartTriage(e.currentTarget.checked)}
              mt="md"
            />
            <Text size="sm" c="dimmed" mt="xs">
              The patient will receive an SMS with a link to complete their registration and begin the triage process.
            </Text>

            <Group justify="flex-end" mt="xl">
              <Button variant="outline" onClick={handleClose} type="button">
                Cancel
              </Button>
              <Button type="submit">Start Triage</Button>
            </Group>
          </Stack>
        </form>
      </div>
    </Drawer>
  );
}

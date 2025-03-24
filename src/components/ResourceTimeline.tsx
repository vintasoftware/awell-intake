/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  ActionIcon,
  Badge,
  Blockquote,
  Button,
  Card,
  Center,
  Divider,
  Flex,
  Grid,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { MedplumClient, ProfileResource, formatCodeableConcept, formatQuantity } from '@medplum/core';
import {
  Annotation,
  Attachment,
  Bundle,
  Communication,
  Media,
  QuestionnaireResponse,
  Reference,
  Resource,
  ResourceType,
} from '@medplum/fhirtypes';
import { ResourceDiff, ResourceTable, TimelineItemProps, sortByDateAndPriority } from '@medplum/react';
import { useMedplum, useResource } from '@medplum/react-hooks';
import { IconDownload, IconEye } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

const displayRules = {
  ClinicalImpression: {
    display: 'Chart Note',
    icon: 'IconStethoscope',
    fields: ['subject', 'encounter', 'date', 'summary', 'note'],
  },
  Patient: {
    display: 'Patient History',
    icon: 'IconUser',
    fields: [],
  },
  Communication: {
    display: 'Communication',
    icon: 'IconMessage',
    fields: ['subject', 'date', 'text'],
  },
  DiagnosticReport: {
    display: 'Diagnostic Report',
    icon: 'IconFile',
    fields: ['subject', 'date', 'conclusion', 'resultsInterpreter'],
  },
  Media: {
    display: 'Media',
    icon: 'IconPhoto',
    fields: ['subject', 'date', 'content', 'note'],
  },
  ServiceRequest: {
    display: 'Service Order',
    icon: 'IconFile',
    fields: ['subject', 'date', 'serviceType', 'code'],
  },
  Encounter: {
    display: 'Encounter',
    icon: 'IconFile',
    fields: ['subject', 'date', 'type', 'period', 'code', 'reasonCode'],
  },
  Appointment: {
    display: 'Appointment',
    icon: 'IconFile',
    fields: ['subject', 'date', 'type', 'start', 'end', 'code', 'reasonCode'],
  },
  DocumentReference: {
    display: 'Document Reference',
    icon: 'IconFile',
    fields: ['subject', 'date', 'type', 'description', 'author', 'content'],
  },
  QuestionnaireResponse: {
    display: 'Assessment',
    icon: 'IconFile',
    fields: ['date', 'questionnaire', 'answer'],
  },
  Observation: {
    display: 'Observation',
    icon: 'IconFile',
    fields: ['date', 'code', 'valueQuantity'],
  },
};

export interface ResourceTimelineMenuItemContext {
  readonly primaryResource: Resource;
  readonly currentResource: Resource;
  readonly reloadTimeline: () => void;
}

export interface ResourceTimelineProps<T extends Resource> {
  readonly value: T | Reference<T>;
  readonly loadTimelineResources: (
    medplum: MedplumClient,
    resourceType: ResourceType,
    id: string
  ) => Promise<PromiseSettledResult<Bundle>[]>;
  readonly createCommunication?: (resource: T, sender: ProfileResource, text: string) => Communication;
  readonly createMedia?: (resource: T, operator: ProfileResource, attachment: Attachment) => Media;
  readonly getMenu?: (context: ResourceTimelineMenuItemContext) => ReactNode;
}

interface GroupedTimelineItems {
  [date: string]: Resource[];
}

export function ResourceTimeline<T extends Resource>(props: ResourceTimelineProps<T>): JSX.Element {
  const medplum = useMedplum();
  const resource = useResource(props.value);
  const [history, setHistory] = useState<Bundle>();
  const [items, setItems] = useState<Resource[]>([]);
  const loadTimelineResources = props.loadTimelineResources;

  const itemsRef = useRef<Resource[]>(items);
  itemsRef.current = items;

  /**
   * Sorts and sets the items.
   *
   * Sorting is primarily a function of meta.lastUpdated, but there are special cases.
   * When displaying connected resources, for example a Communication in the context of an Encounter,
   * the Communication.sent time is used rather than Communication.meta.lastUpdated.
   *
   * Other examples of special cases:
   * - DiagnosticReport.issued
   * - Media.issued
   * - Observation.issued
   * - DocumentReference.date
   *
   * See "sortByDateAndPriority()" for more details.
   */
  const sortAndSetItems = useCallback(
    (newItems: Resource[]): void => {
      sortByDateAndPriority(newItems, resource);
      newItems.reverse();
      setItems(newItems);
    },
    [resource]
  );

  /**
   * Handles a batch request response.
   * @param batchResponse - The batch response.
   */
  const handleBatchResponse = useCallback(
    (batchResponse: PromiseSettledResult<Bundle>[]): void => {
      const newItems = [];

      for (const settledResult of batchResponse) {
        if (settledResult.status !== 'fulfilled') {
          // User may not have access to all resource types
          continue;
        }

        const bundle = settledResult.value;
        if (bundle.type === 'history') {
          setHistory(bundle);
        }

        if (bundle.entry) {
          for (const entry of bundle.entry) {
            newItems.push(entry.resource as Resource);
          }
        }
      }

      sortAndSetItems(newItems);
    },
    [sortAndSetItems]
  );

  /**
   * Loads the timeline.
   */
  const loadTimeline = useCallback(() => {
    let resourceType: ResourceType;
    let id: string;
    if ('resourceType' in props.value) {
      resourceType = props.value.resourceType;
      id = props.value.id as string;
    } else {
      [resourceType, id] = props.value.reference?.split('/') as [ResourceType, string];
    }
    loadTimelineResources(medplum, resourceType, id).then(handleBatchResponse).catch(console.error);
  }, [medplum, props.value, loadTimelineResources, handleBatchResponse]);

  useEffect(() => loadTimeline(), [loadTimeline]);

  const groupItemsByDate = useCallback((items: Resource[]): GroupedTimelineItems => {
    return items.reduce((groups: GroupedTimelineItems, item) => {
      const date = dayjs(item.meta?.lastUpdated).format('MMM D');
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(item);
      return groups;
    }, {});
  }, []);

  if (!resource) {
    return (
      <Center style={{ width: '100%', height: '100%' }}>
        <Loader />
      </Center>
    );
  }

  return (
    <>
      <Stack gap="xl">
        {Object.entries(groupItemsByDate(items)).map(([date, dateItems]) => (
          <Grid key={date} gutter="md">
            <Grid.Col span={2}>
              <Text size="sm" fw={500} c="dimmed">
                {date}
              </Text>
            </Grid.Col>

            <Grid.Col span={10}>
              {dateItems.map((item) => {
                if (!item) {
                  return null;
                }
                const key = `${item.resourceType}/${item.id}/${item.meta?.versionId}`;

                return (
                  <div key={key}>
                    <Group justify="space-between" wrap="nowrap" mb="xs">
                      <TimelineItemContent key={key} item={item} history={history as Bundle} />
                      <Text size="sm" c="dimmed">
                        {dayjs(item.meta?.lastUpdated).format('h:mm A')}
                      </Text>
                    </Group>
                    <Divider mt="md" />
                  </div>
                );
              })}
            </Grid.Col>
          </Grid>
        ))}
      </Stack>
    </>
  );
}

interface HistoryTimelineItemProps extends TimelineItemProps {
  readonly history: Bundle;
}

function getPrevious(history: Bundle, version: Resource): Resource | undefined {
  const entries = history.entry ?? [];
  const index = entries.findIndex((entry) => entry.resource?.meta?.versionId === version.meta?.versionId);
  // If not found index is -1, -1 === 0 - 1 so this returns undefined
  if (index >= entries.length - 1) {
    return undefined;
  }
  return entries[index + 1].resource;
}

function HistoryTimelineItem(props: HistoryTimelineItemProps): JSX.Element {
  const { history, resource } = props;
  const previous = getPrevious(history, resource);
  if (previous) {
    return <ResourceDiff original={previous} revised={props.resource} />;
  } else {
    return (
      <Card withBorder>
        <Flex direction="column">
          <h3>Created</h3>
          <ResourceTable value={resource} ignoreMissingValues forceUseInput />
        </Flex>
      </Card>
    );
  }
}

interface QuestionnaireResponseViewProps {
  response: QuestionnaireResponse;
  opened: boolean;
  onClose: () => void;
}

function QuestionnaireResponseView({ response, opened, onClose }: QuestionnaireResponseViewProps) {
  return (
    <Modal opened={opened} onClose={onClose} title={response.questionnaire || 'Assessment Details'} size="lg">
      <Stack gap="md">
        {response.item?.map((item, index) => (
          <Card key={index} withBorder>
            <Stack gap="xs">
              <Text fw={600}>{item.text}</Text>
              {item.answer?.map((answer, answerIndex) => (
                <Group key={answerIndex} gap="xs">
                  {answer.valueString && <Text>{answer.valueString}</Text>}
                  {answer.valueDecimal && <Text>{answer.valueDecimal}</Text>}
                  {answer.valueInteger && <Text>{answer.valueInteger}</Text>}
                  {answer.valueBoolean !== undefined && <Text>{answer.valueBoolean ? 'Yes' : 'No'}</Text>}
                  {answer.valueCoding && <Text>{answer.valueCoding.display || answer.valueCoding.code}</Text>}
                </Group>
              ))}
            </Stack>
          </Card>
        ))}
      </Stack>
    </Modal>
  );
}

function TimelineItemContent({ key, item, history }: { key: string; item: Resource; history: Bundle }) {
  const rule = displayRules[item.resourceType as keyof typeof displayRules];
  const [opened, { open, close }] = useDisclosure(false);

  const content = useMemo(() => {
    switch (item.resourceType) {
      case 'DocumentReference':
        return (
          <Stack gap="xs">
            <Group justify="space-between">
              <Text>{item.description || item.type?.text || 'Document'}</Text>
              <ActionIcon variant="subtle" onClick={() => window.open(item.content?.[0]?.attachment?.url, '_blank')}>
                <IconDownload size={16} />
              </ActionIcon>
            </Group>
            {item.author?.[0]?.display && (
              <Text size="sm" c="dimmed">
                By: {item.author[0].display}
              </Text>
            )}
          </Stack>
        );

      case 'Media': {
        const contentType = item.content.contentType || '';
        return (
          <Stack gap="xs">
            {contentType.startsWith('image/') && (
              <img
                src={item.content.url}
                alt={item.content.title || 'Image'}
                style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain' }}
              />
            )}
            <Button variant="light" size="xs" onClick={() => window.open(item.content.url, '_blank')}>
              Download
            </Button>
          </Stack>
        );
      }

      case 'QuestionnaireResponse': {
        return (
          <Stack gap="xs">
            {item.item?.slice(0, 2).map((item, index) => (
              <Text key={index} size="sm" lineClamp={1}>
                {item.text}:{' '}
                {item.answer?.[0]?.valueString ||
                  item.answer?.[0]?.valueDecimal ||
                  item.answer?.[0]?.valueInteger ||
                  (item.answer?.[0]?.valueBoolean !== undefined
                    ? item.answer[0].valueBoolean
                      ? 'Yes'
                      : 'No'
                    : item.answer?.[0]?.valueCoding?.display)}
              </Text>
            ))}
            {item.item && item.item.length > 2 && (
              <Text size="sm" c="dimmed">
                + {item.item.length - 2} more questions
              </Text>
            )}

            <Group>
              <Button variant="light" size="xs" onClick={open} leftSection={<IconEye size={14} />}>
                View Details
              </Button>
            </Group>
            <QuestionnaireResponseView response={item} opened={opened} onClose={close} />
          </Stack>
        );
      }

      default:
        // Generic display using displayRules
        return (
          <Stack gap="xs">
            {rule.fields.map((field) => {
              const value = (item as any)[field];
              if (!value) return null;

              if (field === 'date' || field === 'start' || field === 'end') {
                return (
                  <Text key={field} size="sm">
                    {dayjs(value).format('MMM D, YYYY h:mm A')}
                  </Text>
                );
              }

              if (field === 'period') {
                return (
                  <Text key={field} size="sm">
                    {dayjs(value.start).format('MMM D, YYYY')} - {dayjs(value.end).format('MMM D, YYYY')}
                  </Text>
                );
              }

              if (field === 'note') {
                return value.map(
                  (note: Annotation) =>
                    note.text && (
                      <Blockquote
                        key={`note-${note.text}`}
                        cite={`${note.authorReference?.display || note.authorString} – ${note.time && dayjs(note.time).format('MMM D, YYYY h:mm A')}`}
                        icon={null}
                        style={{ maxWidth: '600px' }}
                      >
                        {note.text}
                      </Blockquote>
                    )
                );
              }

              if (field === 'code') {
                return <>{formatCodeableConcept(value)}</>;
              }

              if (field === 'valueQuantity') {
                return (
                  <p key={field}>
                    <b>Result</b>: {formatQuantity(value)}
                  </p>
                );
              }

              if (typeof value === 'string') {
                return (
                  <Text key={field} size="sm">
                    {value}
                  </Text>
                );
              }

              return null;
            })}
          </Stack>
        );
    }
  }, [item, rule, close, open, opened]);

  if (item.resourceType === 'Patient') {
    return <HistoryTimelineItem key={key} history={history} resource={item} />;
  }

  if (!rule) return null;

  return (
    <Card>
      <Flex direction="column" mb="xs">
        <Group>
          <Text fw={600}>{rule.display}</Text>
          {'status' in item ? (
            <Badge
              key={item.status as string}
              color={item.status === 'completed' || item.status === 'finished' ? 'green' : 'blue'}
            >
              {item.status as string}
            </Badge>
          ) : null}
        </Group>
      </Flex>

      {content}
    </Card>
  );
}

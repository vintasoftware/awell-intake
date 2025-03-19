import { ActionIcon, Badge, Blockquote, Button, Card, Center, Container, Divider, Flex, Grid, Group, Loader, Menu, ScrollArea, Stack, Text, TextInput, Timeline, TimelineItem } from '@mantine/core';
import { showNotification, updateNotification } from '@mantine/notifications';
import { MedplumClient, ProfileResource, createReference, formatCodeableConcept, formatDate, formatQuantity, normalizeErrorString } from '@medplum/core';
import {
  Attachment,
  AuditEvent,
  Bundle,
  Communication,
  DiagnosticReport,
  Media,
  OperationOutcome,
  Reference,
  Resource,
  ResourceType,
  Task,
  Encounter,
  DocumentReference,
  ClinicalImpression,
  ServiceRequest,
  QuestionnaireResponse,
} from '@medplum/fhirtypes';
import { sortByDateAndPriority, Panel, ResourceAvatar, AttachmentButton, ResourceTable, AttachmentDisplay, DiagnosticReportDisplay, TimelineItemProps, ResourceDiff } from '@medplum/react';
import { useMedplum, useResource } from '@medplum/react-hooks';
import { IconCalendarEvent, IconCheck, IconCloudUpload, IconFileAlert, IconMessage, IconNotes, IconDownload, IconEye, IconDotsVertical, IconPlus } from '@tabler/icons-react';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Form, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { Modal } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';


const displayRules = {
  "ClinicalImpression": {
    "display": "Chart Note",
    "icon": "IconStethoscope",
    "fields": [
      "subject",
      "encounter",
      "date",
      "summary",
      "note",
    ]
  },
  "Patient": {
    "display": "Patient History",
    "icon": "IconUser",
    "fields": []
  },
  "Communication": {
    "display": "Communication",
    "icon": "IconMessage",
    "fields": [
      "subject",
      "date",
      "text",
    ]
  },
  "DiagnosticReport": {
    "display": "Diagnostic Report",
    "icon": "IconFile",
    "fields": [
      "subject",
      "date",
      "conclusion",
      "resultsInterpreter",
    ]
  },
  "Media": {
    "display": "Media",
    "icon": "IconPhoto",
    "fields": [
      "subject",
      "date",
      "content",
      "note",
    ]
  },
  "ServiceRequest": {
    "display": "Service Order",
    "icon": "IconFile",
    "fields": [
      "subject",
      "date",
      "serviceType",
      "code",
    ]
  },
  "Encounter": {
    "display": "Encounter",
    "icon": "IconFile",
    "fields": [
      "subject",
      "date",
      "type",
      "period",
      "code",
      "reasonCode",
    ],
  },
  "DocumentReference": {
    "display": "Document Reference",
    "icon": "IconFile",
    "fields": [
      "subject",
      "date",
      "type",
      "description",
      "author",
      "content",
    ]
  },
  "QuestionnaireResponse": {
    "display": "Assessment",
    "icon": "IconFile",
    "fields": [
      "date",
      "questionnaire",
      "answer",
    ]
  },
  "Observation": {
    "display": "Observation",
    "icon": "IconFile",
    "fields": [
      "date",
      "code",
      "valueQuantity",
    ]
  }
}

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
  const navigate = useNavigate();

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
   * Adds an array of resources to the timeline.
   * @param resource - Resource to add.
   */
  const addResource = useCallback(
    (resource: Resource): void => sortAndSetItems([...itemsRef.current, resource]),
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
      <Stack spacing="xl">
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
                    <Group justify="space-between" wrap='nowrap' mb="xs">
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
  const { history, resource, ...rest } = props;
  const previous = getPrevious(history, resource);
  if (previous) {
    return (
      <ResourceDiff original={previous} revised={props.resource} />
    );
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
    <Modal
      opened={opened}
      onClose={onClose}
      title={response.questionnaire?.display || 'Assessment Details'}
      size="lg"
    >
      <Stack spacing="md">
        {response.item?.map((item, index) => (
          <Card key={index} withBorder>
            <Stack spacing="xs">
              <Text fw={600}>{item.text}</Text>
              {item.answer?.map((answer, answerIndex) => (
                <Group key={answerIndex} spacing="xs">
                  {answer.valueString && (
                    <Text>{answer.valueString}</Text>
                  )}
                  {answer.valueDecimal && (
                    <Text>{answer.valueDecimal}</Text>
                  )}
                  {answer.valueInteger && (
                    <Text>{answer.valueInteger}</Text>
                  )}
                  {answer.valueBoolean !== undefined && (
                    <Text>{answer.valueBoolean ? 'Yes' : 'No'}</Text>
                  )}
                  {answer.valueCoding && (
                    <Text>{answer.valueCoding.display || answer.valueCoding.code}</Text>
                  )}
                </Group>
              ))}
            </Stack>
          </Card>
        ))}
      </Stack>
    </Modal>
  );
}

function TimelineItemContent({ key, item, history }: { key: string, item: Resource, history: Bundle }): JSX.Element {
  const navigate = useNavigate();

  if (item.resourceType === "Patient") {
    return <HistoryTimelineItem key={key} history={history} resource={item} />;
  }

  const rule = displayRules[item.resourceType as keyof typeof displayRules];
  if (!rule) return null;

  const renderContent = () => {
    switch (item.resourceType) {
      case 'DocumentReference':
        return (
          <Stack spacing="xs">
            <Group position="apart">
              <Text>{item.description || item.type?.text || 'Document'}</Text>
              <ActionIcon
                variant="subtle"
                onClick={() => window.open(item.content?.[0]?.attachment?.url, '_blank')}
              >
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

      case 'Media':
        const contentType = item.content.contentType || '';
        return (
          <Stack spacing="xs">
            {contentType.startsWith('image/') && (
              <img
                src={item.content.url}
                alt={item.content.title || 'Image'}
                style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain' }}
              />
            )}
            <Button variant="light" size="xs" onClick={() => window.open(item.content.url, '_blank')}>Download</Button>
          </Stack>
        );

      case 'QuestionnaireResponse':
        const [opened, { open, close }] = useDisclosure(false);
        return (
          <Stack spacing="xs">
            {item.item?.slice(0, 2).map((item, index) => (
              <Text key={index} size="sm" lineClamp={1}>
                {item.text}: {item.answer?.[0]?.valueString ||
                            item.answer?.[0]?.valueDecimal ||
                            item.answer?.[0]?.valueInteger ||
                            (item.answer?.[0]?.valueBoolean !== undefined ?
                              (item.answer[0].valueBoolean ? 'Yes' : 'No') :
                              item.answer?.[0]?.valueCoding?.display)}
              </Text>
            ))}
            {item.item && item.item.length > 2 && (
              <Text size="sm" c="dimmed">
                + {item.item.length - 2} more questions
              </Text>
            )}

            <Group>
              <Button
                variant="light"
                size="xs"
                onClick={open}
                leftSection={<IconEye size={14} />}
              >
                View Details
              </Button>
            </Group>
            <QuestionnaireResponseView
              response={item}
              opened={opened}
              onClose={close}
            />
          </Stack>
        );

      default:
        // Generic display using displayRules
        return (
          <Stack spacing="xs">
            {rule.fields.map((field) => {
              const value = (item as any)[field];
              if (!value) return null;

              if (field === 'date') {
                return (
                  <Text key={field} size="sm">
                    {dayjs(value).format('MMM D, YYYY')}
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
                return (
                  value.map(
                    (note) =>
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
                  )
                );
              }

              if (field === 'code') {
                return (<>{formatCodeableConcept(value)}</>)
              }

              if (field === 'valueQuantity') {
                return (<p><b>Result</b>: {formatQuantity(value)}</p>)
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
  };

  return (
    <Card>
      <Flex direction="column" mb="xs">
        <Group>
          <Text fw={600}>{rule.display}</Text>
          {item.status ?
            <Badge key={item.status} color={item.status === 'completed' || item.status === 'finished' ? 'green' : 'blue'}>
              {item.status}
            </Badge>
          : null}
        </Group>
      </Flex>

      {renderContent()}

      <Container my="sm" p={0}>
        {rule?.actions && (
          <Group gap="xs">
            {rule.actions.map((action) => (
              <Button key={action} variant="light" size="xs">
                {action}
              </Button>
            ))}
          </Group>
        )}
      </Container>
    </Card>
  );
}

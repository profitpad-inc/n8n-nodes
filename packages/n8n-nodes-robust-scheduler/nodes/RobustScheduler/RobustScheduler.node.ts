import type {
  CronExpression,
  IDataObject,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  ITriggerFunctions,
  ITriggerResponse,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError, sleep } from 'n8n-workflow';

function buildCronExpression(item: IDataObject): CronExpression {
  const mode = item.mode as string;
  switch (mode) {
    case 'everyNMinutes': {
      const n = (item.minutesBetweenTriggers as number) ?? 5;
      return `0 */${n} * * * *` as CronExpression;
    }
    case 'everyNHours': {
      const n = (item.hoursBetweenTriggers as number) ?? 1;
      const m = (item.atMinute as number) ?? 0;
      return `0 ${m} */${n} * * *` as CronExpression;
    }
    case 'everyNDays': {
      const n = (item.daysBetweenTriggers as number) ?? 1;
      const h = (item.atHour as number) ?? 0;
      const m = (item.atMinute as number) ?? 0;
      return `0 ${m} ${h} */${n} * *` as CronExpression;
    }
    case 'custom':
      return ((item.cronExpression as string) ?? '0 * * * * *') as CronExpression;
    default:
      return '0 * * * * *' as CronExpression;
  }
}

export class RobustScheduler implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Robust Scheduler',
    name: 'robustScheduler',
    icon: 'file:calendar-clock.svg',
    group: ['trigger'],
    version: 1,
    subtitle: '',
    description:
      'Triggers on a schedule with an optional random delay to spread simultaneous workflow executions',
    defaults: {
      name: 'Robust Scheduler',
    },
    usableAsTool: true,
    inputs: [],
    outputs: [NodeConnectionTypes.Main],
    properties: [
      {
        displayName: 'Trigger Rules',
        name: 'rule',
        type: 'fixedCollection',
        typeOptions: {
          multipleValues: true,
          sortable: true,
        },
        default: { interval: [{ mode: 'everyNMinutes' }] },
        placeholder: 'Add Rule',
        options: [
          {
            name: 'interval',
            displayName: 'Interval',
            // eslint-disable-next-line n8n-nodes-base/node-param-fixed-collection-type-unsorted-items
            values: [
              {
                displayName: 'Trigger Interval',
                name: 'mode',
                type: 'options',
                options: [
                  { name: 'Custom (Cron Expression)', value: 'custom' },
                  { name: 'Every N Days', value: 'everyNDays' },
                  { name: 'Every N Hours', value: 'everyNHours' },
                  { name: 'Every N Minutes', value: 'everyNMinutes' },
                ],
                default: 'everyNMinutes',
              },
              {
                displayName: 'Minutes Between Triggers',
                name: 'minutesBetweenTriggers',
                type: 'number',
                displayOptions: { show: { mode: ['everyNMinutes'] } },
                typeOptions: { minValue: 1, maxValue: 59 },
                default: 5,
                description: 'How many minutes between each trigger (1–59)',
              },
              {
                displayName: 'Hours Between Triggers',
                name: 'hoursBetweenTriggers',
                type: 'number',
                displayOptions: { show: { mode: ['everyNHours'] } },
                typeOptions: { minValue: 1, maxValue: 23 },
                default: 1,
                description: 'How many hours between each trigger (1–23)',
              },
              {
                displayName: 'Days Between Triggers',
                name: 'daysBetweenTriggers',
                type: 'number',
                displayOptions: { show: { mode: ['everyNDays'] } },
                typeOptions: { minValue: 1, maxValue: 365 },
                default: 1,
                description: 'How many days between each trigger',
              },
              {
                displayName: 'At Hour',
                name: 'atHour',
                type: 'number',
                displayOptions: { show: { mode: ['everyNDays'] } },
                typeOptions: { minValue: 0, maxValue: 23 },
                default: 0,
                description: 'Hour of the day (0–23)',
              },
              {
                displayName: 'At Minute',
                name: 'atMinute',
                type: 'number',
                displayOptions: { show: { mode: ['everyNHours', 'everyNDays'] } },
                typeOptions: { minValue: 0, maxValue: 59 },
                default: 0,
                description: 'Minute of the hour (0–59)',
              },
              {
                displayName: 'Cron Expression',
                name: 'cronExpression',
                type: 'string',
                displayOptions: { show: { mode: ['custom'] } },
                default: '0 * * * * *',
                placeholder: 'sec min hour dom month dow',
                description:
                  '6-field cron: second minute hour day-of-month month day-of-week. Example: <code>0 */5 * * * *</code> fires every 5 minutes.',
              },
            ],
          },
        ],
      },
      {
        displayName: 'Max Jitter (Seconds)',
        name: 'maxJitterSeconds',
        type: 'number',
        default: 0,
        typeOptions: { minValue: 0 },
        description:
          'Maximum random delay added before each trigger fires. A fresh offset is rolled each time the workflow is activated or n8n restarts, naturally spreading simultaneous workflows across the window. Set to 0 to disable.',
      },
    ],
  };

  async trigger(this: ITriggerFunctions): Promise<ITriggerResponse | undefined> {
    const maxJitterSeconds = this.getNodeParameter('maxJitterSeconds', 0) as number;
    const jitterOffsetMs =
      maxJitterSeconds > 0 ? Math.floor(Math.random() * maxJitterSeconds * 1000) : 0;

    const makeOutput = (): INodeExecutionData[][] => [
      [
        {
          json: {
            triggerTime: new Date().toISOString(),
            jitterOffsetMs,
            jitterOffsetSeconds: jitterOffsetMs / 1000,
          },
        },
      ],
    ];

    if (this.getMode() === 'manual') {
      return { manualTriggerResponse: Promise.resolve(makeOutput()) };
    }

    const ruleCollection = this.getNodeParameter('rule', { interval: [] }) as {
      interval?: IDataObject[];
    };
    const ruleItems = ruleCollection.interval ?? [];

    if (ruleItems.length === 0) {
      throw new NodeOperationError(this.getNode(), 'At least one trigger rule must be configured.');
    }

    for (const item of ruleItems) {
      const cron = { expression: buildCronExpression(item) };

      this.helpers.registerCron(cron, () => {
        void sleep(jitterOffsetMs)
          .then(() => {
            this.emit(makeOutput());
          })
          .catch((error: Error) => {
            this.emitError(error);
          });
      });
    }

    return {};
  }
}

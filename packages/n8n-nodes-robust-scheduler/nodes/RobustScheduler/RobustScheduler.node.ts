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

// Computes the next time the given rule would fire, based on the same cron
// semantics used by buildCronExpression. Returns undefined for custom mode.
function computeNextTriggerTime(item: IDataObject, now: Date): Date | undefined {
  const mode = item.mode as string;

  if (mode === 'everyNMinutes') {
    const n = (item.minutesBetweenTriggers as number) ?? 5;
    const d = new Date(now);
    const currentMinute = d.getMinutes();
    const pastSecond0 = d.getSeconds() > 0 || d.getMilliseconds() > 0;

    // cron fires at second 0 of every minute where minute % n === 0
    let nextMinute: number;
    if (!pastSecond0 && currentMinute % n === 0) {
      nextMinute = currentMinute + n;
    } else {
      nextMinute = Math.ceil((currentMinute + 1) / n) * n;
    }

    const result = new Date(d);
    result.setMilliseconds(0);
    result.setSeconds(0);
    if (nextMinute >= 60) {
      result.setHours(result.getHours() + 1);
      result.setMinutes(0);
    } else {
      result.setMinutes(nextMinute);
    }
    return result;
  }

  if (mode === 'everyNHours') {
    const n = (item.hoursBetweenTriggers as number) ?? 1;
    const atMin = (item.atMinute as number) ?? 0;

    const d = new Date(now);
    const currentHour = d.getHours();
    // cron fires at hours 0, n, 2n, ... (hours where hour % n === 0)
    const alignedHour = currentHour - (currentHour % n);

    const candidate = new Date(d);
    candidate.setHours(alignedHour, atMin, 0, 0);

    if (candidate > now) return candidate;

    const nextHour = alignedHour + n;
    if (nextHour >= 24) {
      const tomorrow = new Date(d);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, atMin, 0, 0);
      return tomorrow;
    }
    const next = new Date(d);
    next.setHours(nextHour, atMin, 0, 0);
    return next;
  }

  if (mode === 'everyNDays') {
    const n = (item.daysBetweenTriggers as number) ?? 1;
    const atHour = (item.atHour as number) ?? 0;
    const atMin = (item.atMinute as number) ?? 0;

    const d = new Date(now);
    const currentDay = d.getDate();

    // cron fires on days where (dayOfMonth - 1) % n === 0 (i.e., 1, 1+n, 1+2n, ...)
    for (let day = currentDay; day <= 31; day++) {
      if ((day - 1) % n !== 0) continue;

      const candidate = new Date(d);
      candidate.setDate(day);
      candidate.setHours(atHour, atMin, 0, 0);

      if (candidate.getDate() !== day) break; // overflowed (e.g. Feb 30)
      if (candidate > now) return candidate;
    }

    // No valid day left in this month; day 1 of next month is always valid
    const nextMonth = new Date(d);
    nextMonth.setDate(1);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setHours(atHour, atMin, 0, 0);
    return nextMonth;
  }

  // Custom cron expressions: return now as a best-effort fallback
  return new Date(now);
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

    const ruleCollection = this.getNodeParameter('rule', { interval: [] }) as {
      interval?: IDataObject[];
    };
    const ruleItems = ruleCollection.interval ?? [];

    const makeOutput = (nextTriggerTime?: string): INodeExecutionData[][] => [
      [
        {
          json: {
            triggerTime: new Date().toISOString(),
            jitterOffsetMs,
            jitterOffsetSeconds: jitterOffsetMs / 1000,
            ...(nextTriggerTime !== undefined ? { nextTriggerTime } : {}),
          },
        },
      ],
    ];

    const now = new Date();
    let earliest: Date | undefined;

    for (const item of ruleItems) {
      const next = computeNextTriggerTime(item, now);
      if (next !== undefined && (earliest === undefined || next < earliest)) {
        earliest = next;
      }
    }

    const immediateOutput = makeOutput(earliest?.toISOString());

    if (this.getMode() === 'manual') {
      return {
        manualTriggerFunction: async () => {
          this.emit(immediateOutput);
        },
        manualTriggerResponse: Promise.resolve(immediateOutput),
      };
    }

    if (ruleItems.length === 0) {
      throw new NodeOperationError(this.getNode(), 'At least one trigger rule must be configured.');
    }

    for (const item of ruleItems) {
      const cron = { expression: buildCronExpression(item) };

      this.helpers.registerCron(cron, () => {
        void sleep(jitterOffsetMs)
          .then(() => {
            const fireTime = new Date();
            let nextEarliest: Date | undefined;
            for (const ruleItem of ruleItems) {
              const next = computeNextTriggerTime(ruleItem, fireTime);
              if (next !== undefined && (nextEarliest === undefined || next < nextEarliest)) {
                nextEarliest = next;
              }
            }
            this.emit(makeOutput(nextEarliest?.toISOString()));
          })
          .catch((error: Error) => {
            this.emitError(error);
          });
      });
    }

    return {
      manualTriggerFunction: async () => {
        this.emit(immediateOutput);
      },
    };
  }
}

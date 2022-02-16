import { InfluxDB, Point } from '@influxdata/influxdb-client';
import { CronJob } from 'cron';
import { logger } from '../logger';
import { hostname } from 'os';
import { captureException, withScope } from '@sentry/node';

export const client = process.env.INFLUX_URL
  ? new InfluxDB({ url: process.env.INFLUX_URL, token: process.env.INFLUX_TOKEN })
  : null;

export const cron = new CronJob('*/5 * * * *', collect, null, false, 'America/New_York');

export let activeUsers: string[] = [];
export const commandCounts = new Map<string, { users: string[]; used: number }>();

export let commandsRan = 0;
export let requestsSent = 0;

export function onCommandRun(userID: string, commandName: string) {
  const commandCount = commandCounts.get(commandName) || { users: [], used: 0 };

  if (!commandCount.users.includes(userID)) commandCount.users.push(userID);

  commandCount.used++;
  commandsRan++;

  if (!activeUsers.includes(userID)) activeUsers.push(userID);

  commandCounts.set(commandName, commandCount);
}

export function onRequestSent() {
  requestsSent++;
}

async function collect(timestamp = new Date()) {
  if (!process.env.INFLUX_URL || !process.env.INFLUX_TOKEN) return;
  if (!timestamp) timestamp = cron.lastDate();

  const writeApi = client.getWriteApi(process.env.INFLUX_ORG, process.env.INFLUX_BUCKET, 's');
  const points: Point[] = [
    new Point('interaction_stats')
      .tag('server', process.env.SERVER_NAME || hostname())
      .intField('activeUsers', activeUsers.length)
      .intField('commandsRan', commandsRan)
      .intField('requestsSent', requestsSent)
      .timestamp(timestamp)
  ];

  // Insert command counts
  commandCounts.forEach((counts, name) =>
    points.push(
      new Point('command_usage')
        .tag('server', process.env.SERVER_NAME || hostname())
        .tag('command', name)
        .intField('used', counts.used)
        .intField('usedUnique', counts.users.length)
        .timestamp(timestamp)
    )
  );

  // Send to influx
  try {
    writeApi.writePoints(points);
    await writeApi.close();
    logger.log('Sent stats to Influx.');
  } catch (e) {
    withScope((scope) => {
      scope.clear();
      scope.setExtra('date', timestamp || cron.lastDate());
      captureException(e);
    });
    logger.error('Error sending stats to Influx.', e);
  }

  // Flush data for next cron run
  activeUsers = [];
  commandCounts.clear();
  commandsRan = 0;
  requestsSent = 0;
}

import * as Sentry from '@sentry/node';
import '@sentry/tracing';
import { RewriteFrames } from '@sentry/integrations';
import { AutocompleteContext, CommandContext } from 'slash-create';
import { logger } from '../logger';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new RewriteFrames({
      root: __dirname
    })
  ],

  environment: process.env.SENTRY_ENV || process.env.NODE_ENV || 'development',
  release: `taco-interactions@${require('../package.json').version}`,
  tracesSampleRate: process.env.SENTRY_SAMPLE_RATE ? parseFloat(process.env.SENTRY_SAMPLE_RATE) : 1.0
});

export function reportErrorFromCommand(
  ctx: CommandContext | AutocompleteContext,
  error: any,
  commandName: string,
  type?: string
) {
  Sentry.withScope((scope) => {
    scope.setTag('type', type || 'generic');
    if (commandName) scope.setTag('command', commandName);
    scope.setTag('user', ctx ? ctx.user.id : undefined);
    scope.setTag('guild', ctx ? ctx.guildID : undefined);
    scope.setTag('channel', ctx ? ctx.channelID : undefined);
    scope.setExtra('ctx', ctx);
    scope.setUser({
      id: ctx ? ctx.user.id : undefined,
      username: ctx ? ctx.user.username : undefined,
      discriminator: ctx ? ctx.user.discriminator : undefined
    });
    Sentry.captureException(error);
  });
  logger.error(type ? `Error in ${type} (${commandName})` : `Unknown error in ${commandName}`, error);
}

export function close() {
  return Sentry.close();
}

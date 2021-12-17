import { Notifier } from '@airbrake/node';
import { AutocompleteContext, CommandContext } from 'slash-create';
import { logger } from '../logger';

const notifier = new Notifier({
  projectId: parseInt(process.env.AIRBRAKE_PROJECT_ID, 10),
  projectKey: process.env.AIRBRAKE_PROJECT_KEY,
  environment: process.env.AIRBRAKE_ENV,
  keysBlocklist: [process.env.DATABASE_URL, process.env.DISCORD_BOT_TOKEN]
});

export function reportError(
  error: any,
  premsg?: string,
  type?: string,
  ctx?: CommandContext | AutocompleteContext,
  commandName?: string
) {
  if (process.env.AIRBRAKE_PROJECT_ID && process.env.AIRBRAKE_PROJECT_KEY)
    notifier.notify({
      error,
      params: {
        ...(type ? { type } : {}),
        ...(ctx
          ? {
              command: 'commandName' in ctx ? ctx.commandName : commandName,
              user: {
                id: ctx.user.id,
                username: ctx.user.username,
                discriminator: ctx.user.discriminator
              },
              guildID: ctx.guildID,
              channelID: ctx.channelID
            }
          : {})
      }
    });
  logger.error(...(premsg ? [premsg] : []), error);
}

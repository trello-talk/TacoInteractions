import dotenv from 'dotenv';
import { SlashCreator, FastifyServer, InteractionResponseFlags } from 'slash-create';
import { isInDist } from './util/dev';
import path from 'path';

let dotenvPath = path.join(process.cwd(), '.env');
if (isInDist) dotenvPath = path.join(process.cwd(), '..', '.env');
dotenv.config({ path: dotenvPath });

import { client, connect } from './util/redis';
import { handlePrompt } from './util/prompt';
import { Action, actions, load as loadActions } from './util/actions';
import { logger } from './logger';
import { deleteInteraction, getData } from './util';
import { init as initLocale } from './util/locale';

export const creator = new SlashCreator({
  applicationID: process.env.DISCORD_APP_ID,
  publicKey: process.env.DISCORD_PUBLIC_KEY,
  token: process.env.DISCORD_BOT_TOKEN,
  serverPort: parseInt(process.env.SERVER_PORT, 10) || 8020,
  allowedMentions: {
    everyone: false,
    users: false,
    roles: false
  }
});

creator.on('debug', (message) => logger.log(message));
creator.on('warn', (message) => logger.warn(message));
creator.on('error', (error) => logger.error(error));
creator.on('synced', () => logger.info('Commands synced!'));
creator.on('commandRun', (command, _, ctx) =>
  logger.info(`${ctx.user.username}#${ctx.user.discriminator} (${ctx.user.id}) ran command ${command.commandName}`)
);
creator.on('commandRegister', (command) => logger.info(`Registered command ${command.commandName}`));
creator.on('commandError', (command, error) => logger.error(`Command ${command.commandName}:`, error));

creator.withServer(new FastifyServer()).registerCommandsIn(path.join(__dirname, 'commands'));

creator.on('componentInteraction', async (ctx) => {
  try {
    if (ctx.customID === 'none') return ctx.acknowledge();
    else if (ctx.customID === 'delete') {
      const { t } = await getData(ctx);
      if (ctx.message.interaction!.user.id !== ctx.user.id)
        return ctx.send({
          content: t(['interactions.delete_wrong_user', 'interactions.wrong_user']),
          ephemeral: true
        });
      try {
        await deleteInteraction(ctx, t);
      } catch (e) {}
    } else if (ctx.customID.startsWith('prompt:')) return handlePrompt(ctx);
    else if (ctx.customID.startsWith('action:')) {
      const { t } = await getData(ctx);
      if (ctx.message.interaction!.user.id !== ctx.user.id)
        return ctx.send({
          content: t('interactions.wrong_user'),
          ephemeral: true
        });

      const [, actionID, actionType, actionExtra] = ctx.customID.split(':');
      if (!actionID && !actionType)
        return ctx.send({
          content: t('interactions.prompt_no_action_id_or_type'),
          ephemeral: true
        });

      let action: Action;

      if (!actionID) {
        action = {
          type: parseInt(actionType, 10),
          user: ctx.user.id,
          extra: actionExtra || ''
        };
      } else {
        const actionCache = await client.get(`action:${actionID}`);
        if (!actionCache) {
          if (ctx.message.flags === InteractionResponseFlags.EPHEMERAL)
            return ctx.send({
              content: t('interactions.prompt_action_expired'),
              ephemeral: true
            });
          return ctx.editParent({
            content: t('interactions.prompt_action_expired'),
            embeds: [],
            components: []
          });
        }

        await client.del(`action:${actionID}`);
        action = JSON.parse(actionCache);
      }

      if (!actions.has(action.type))
        return ctx.send({
          content: t('interactions.prompt_action_invalid_type'),
          ephemeral: true
        });

      if (actions.get(action.type).requiresData && !actionExtra)
        return ctx.send({
          content: t('interactions.prompt_action_requires_data'),
          ephemeral: true
        });

      return actions.get(action.type).onAction(ctx, action);
    }
  } catch (e) {
    logger.error(e);
    const { t } = await getData(ctx);
    return ctx.send({
      content: t('interactions.error'),
      ephemeral: true
    });
  }
});

if (process.env.COMMANDS_DEV_GUILD) {
  creator.commands.forEach((command) => {
    // @ts-ignore idk why i made this readonly
    if (!command.guildIDs || command.guildIDs.length === 0) command.guildIDs = [process.env.COMMANDS_DEV_GUILD];
  });
  creator.syncCommands();
}

(async () => {
  await initLocale();
  await connect();
  await loadActions();
  await creator.startServer();
})();

// This should serve in localhost:8020/interactions

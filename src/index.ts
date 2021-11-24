import dotenv from 'dotenv';
import { SlashCreator, FastifyServer } from 'slash-create';
import path from 'path';

let dotenvPath = path.join(process.cwd(), '.env');
if (path.parse(process.cwd()).name === 'dist') dotenvPath = path.join(process.cwd(), '..', '.env');
dotenv.config({ path: dotenvPath });

import { client, connect } from './util/redis';
import { handlePrompt } from './util/prompt';
import { Action, actions, load as loadActions } from './util/actions';
import { logger } from './logger';
import { deleteInteraction } from './util';

export const creator = new SlashCreator({
  applicationID: process.env.DISCORD_APP_ID,
  publicKey: process.env.DISCORD_PUBLIC_KEY,
  token: process.env.DISCORD_BOT_TOKEN,
  serverPort: parseInt(process.env.SERVER_PORT, 10) || 8020
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
  if (ctx.customID === 'none') return ctx.acknowledge();
  else if (ctx.customID === 'delete') {
    if (ctx.message.interaction!.user.id !== ctx.user.id)
      return ctx.send({
        content: '❌ Only the person who executed this command can delete the response.',
        ephemeral: true
      });
    try {
      await deleteInteraction(ctx);
    } catch (e) {}
  } else if (ctx.customID.startsWith('prompt:')) return handlePrompt(ctx);
  else if (ctx.customID.startsWith('action:')) {
    if (ctx.message.interaction!.user.id !== ctx.user.id)
      return ctx.send({
        content: '❌ Only the person who executed this command can do this.',
        ephemeral: true
      });

    const [, actionID, actionType] = ctx.customID.split(':');
    if (!actionID && !actionType)
      return ctx.send({
        content: '🔥 No action ID or action type was provided. Contact support if you see this.',
        ephemeral: true
      });

    let action: Action;

    if (!actionID) {
      action = {
        type: parseInt(actionType, 10),
        user: ctx.user.id
      };
    } else {
      const actionCache = await client.get(`action:${actionID}`);
      if (!actionCache)
        return ctx.send({
          content: '❌ The action to this prompt has expired, try again later.',
          ephemeral: true
        });

      await client.del(`action:${actionID}`);
      action = JSON.parse(actionCache);
    }

    if (!actions.has(action.type))
      return ctx.send({
        content: '🔥 The action to this prompt has an invalid type. Contact support if you see this.',
        ephemeral: true
      });

    if (actions.get(action.type).requiresData)
      return ctx.send({
        content: '🔥 The action to this component requires data. Contact support if you see this.',
        ephemeral: true
      });

    return actions.get(action.type).onAction(ctx, action);
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
  await connect();
  await loadActions();
  await creator.startServer();
})();

// This should serve in localhost:8020/interactions

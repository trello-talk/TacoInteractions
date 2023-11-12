import dotenv from 'dotenv';
import fastify from 'fastify';
import path from 'path';
import { FastifyServer, InteractionResponseFlags, SlashCreator } from 'slash-create';

import { logger } from './logger';
import { deleteInteraction, getData } from './util';
import { Action, actions, load as loadActions } from './util/actions';
import { isInDist } from './util/dev';
import { cron as influxCron, onCommandRun } from './util/influx';
import { init as initLocale } from './util/locale';
import { prisma } from './util/prisma';
import { handlePrompt } from './util/prompt';
import { client, connect } from './util/redis';
import { close as closeSentry, reportErrorFromComponent, reportErrorFromModal } from './util/sentry';

let dotenvPath = path.join(process.cwd(), '.env');
if (isInDist) dotenvPath = path.join(process.cwd(), '..', '.env');
dotenv.config({ path: dotenvPath });

export const server = fastify();

export const creator = new SlashCreator({
  applicationID: process.env.DISCORD_APP_ID,
  publicKey: process.env.DISCORD_PUBLIC_KEY,
  token: process.env.DISCORD_BOT_TOKEN,
  serverPort: parseInt(process.env.SERVER_PORT, 10) || 8020,
  serverHost: process.env.SERVER_HOST || '127.0.0.1',
  allowedMentions: {
    everyone: false,
    users: false,
    roles: false
  }
});

server.route({
  method: 'GET',
  url: '/health',
  handler: async (req, reply) => {
    return reply.status(200).send({ ok: true });
  }
});

// Bug for slash-create+fastify, where undefined responses are being returned before the real requests replies.
server.addHook('onSend', (request, reply, payload, done) => {
  if (payload === undefined) return;
  done(null, payload);
});

creator.on('debug', (message) => logger.log(message));
creator.on('warn', (message) => logger.warn(message));
creator.on('error', (error) => logger.error(error));
creator.on('synced', () => logger.info('Commands synced!'));
creator.on('commandRun', (command, _, ctx) => {
  logger.info(`${ctx.user.username}#${ctx.user.discriminator} (${ctx.user.id}) ran command ${command.commandName} ${ctx.subcommands.join(' ')}`);
  onCommandRun(ctx.user.id, command.commandName);
});
creator.on('commandRegister', (command) => logger.log(`Registered command ${command.commandName}`));
creator.on('commandError', (command, error) => logger.error(`Command ${command.commandName}:`, error));

creator.withServer(new FastifyServer(server)).registerCommandsIn(path.join(__dirname, 'commands'));

creator.on('componentInteraction', async (ctx) => {
  logger.info(`${ctx.user.username}#${ctx.user.discriminator} (${ctx.user.id}) ran component ${ctx.customID} for message ${ctx.message.id}`);
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
    } else if (ctx.customID.startsWith('prompt:')) return await handlePrompt(ctx);
    else if (ctx.customID.startsWith('action:')) {
      const { t } = await getData(ctx);
      if (ctx.message.interaction!.user.id !== ctx.user.id)
        return ctx.send({
          content: t('interactions.wrong_user'),
          ephemeral: true
        });

      const [, actionID, actionType, actionExtra] = ctx.customID.split(':');
      if (!actionID && !actionType)
        return await ctx.send({
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
            return await ctx.send({
              content: t('interactions.prompt_action_expired'),
              ephemeral: true
            });
          return await ctx.editParent({
            content: t('interactions.prompt_action_expired'),
            embeds: [],
            components: []
          });
        }

        await client.del(`action:${actionID}`);
        action = JSON.parse(actionCache);
      }

      if (!actions.has(action.type))
        return await ctx.send({
          content: t('interactions.prompt_action_invalid_type'),
          ephemeral: true
        });

      if (actions.get(action.type).requiresData && !actionExtra)
        return await ctx.send({
          content: t('interactions.prompt_action_requires_data'),
          ephemeral: true
        });

      return await actions.get(action.type).onAction(ctx, action);
    }
  } catch (e) {
    logger.error(e);
    reportErrorFromComponent(ctx, e);
    const { t } = await getData(ctx);
    return ctx.send({
      content: t('interactions.error'),
      ephemeral: true
    });
  }
});

creator.on('modalInteraction', async (ctx) => {
  logger.info(`${ctx.user.username}#${ctx.user.discriminator} (${ctx.user.id}) ran modal ${ctx.customID}`);
  try {
    const { t } = await getData(ctx);
    if (ctx.customID.startsWith('action:')) {
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
        if (!actionCache)
          return ctx.send({
            content: t('interactions.prompt_action_expired'),
            ephemeral: true
          });

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

    return ctx.send({
      content: t('interactions.modal_unknown'),
      ephemeral: true
    });
  } catch (e) {
    logger.error(e);
    reportErrorFromModal(ctx, e);
    const { t } = await getData(ctx);
    return ctx.send({
      content: t('interactions.error'),
      ephemeral: true
    });
  }
});

(async () => {
  await initLocale();
  await connect();
  await prisma.$connect();
  await loadActions();
  await creator.startServer();
  influxCron.start();

  // PM2 graceful start/shutdown
  if (process.send) process.send('ready');
})().catch((e) => {
  logger.error('Failed to start', e);
});

process.on('SIGINT', async () => {
  logger.info('Shutting down...');
  influxCron.stop();
  await server.close();
  closeSentry();
  process.exit(0);
});

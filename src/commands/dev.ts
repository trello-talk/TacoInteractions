import {
  SlashCommand,
  SlashCreator,
  CommandContext,
  CommandOptionType,
  ApplicationCommandPermissionType
} from 'slash-create';
import { stripIndentsAndNewlines } from '../util';
import { prisma } from '../util/prisma';

export default class BotCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'dev',
      description: 'Dev stuff.',
      deferEphemeral: true,
      guildIDs: [process.env.DEV_GUILD],
      defaultPermission: false,
      permissions: {
        [process.env.DEV_GUILD]: [
          {
            type: ApplicationCommandPermissionType.ROLE,
            id: process.env.DEV_ROLE,
            permission: true
          }
        ]
      },
      options: [
        {
          type: CommandOptionType.SUB_COMMAND_GROUP,
          name: 'get',
          description: 'Get stuff.',
          options: [
            {
              type: CommandOptionType.SUB_COMMAND,
              name: 'user',
              description: 'Get a user.',
              options: [
                {
                  type: CommandOptionType.STRING,
                  name: 'id',
                  description: 'The user ID.',
                  required: true
                }
              ]
            },
            {
              type: CommandOptionType.SUB_COMMAND,
              name: 'server',
              description: 'Get a server.',
              options: [
                {
                  type: CommandOptionType.STRING,
                  name: 'id',
                  description: 'The server ID.',
                  required: true
                }
              ]
            },
            {
              type: CommandOptionType.SUB_COMMAND,
              name: 'webhook',
              description: 'Get a webhook.',
              options: [
                {
                  type: CommandOptionType.INTEGER,
                  name: 'id',
                  description: 'The webhook ID.',
                  required: true
                }
              ]
            },
            {
              type: CommandOptionType.SUB_COMMAND,
              name: 'webhook_count',
              description: 'Get the webhooks from a server.',
              options: [
                {
                  type: CommandOptionType.STRING,
                  name: 'id',
                  description: 'The server ID.',
                  required: true
                }
              ]
            },
            {
              type: CommandOptionType.SUB_COMMAND,
              name: 'info',
              description: 'Get general information.'
            },
            {
              type: CommandOptionType.SUB_COMMAND,
              name: 'counts',
              description: 'Get general counts.'
            }
          ]
        },
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'smw',
          description: 'Set max webhooks.',
          options: [
            {
              type: CommandOptionType.INTEGER,
              name: 'id',
              description: 'The webhook ID.',
              required: true
            },
            {
              type: CommandOptionType.INTEGER,
              name: 'maxwebhooks',
              description: 'The max webhooks to set.',
              required: true
            },
            {
              type: CommandOptionType.BOOLEAN,
              name: 'restrict',
              description: 'Restrict webhooks outside of new limit.'
            }
          ]
        }
      ]
    });
  }

  async run(ctx: CommandContext) {
    if (!(ctx.guildID === process.env.DEV_GUILD && ctx.member.roles.includes(process.env.DEV_ROLE)))
      return { content: 'No permission.', ephemeral: true };

    switch (ctx.subcommands[0]) {
      case 'get': {
        switch (ctx.subcommands[1]) {
          case 'user': {
            const user = await prisma.user.findUnique({
              where: { userID: ctx.options.get.user.id }
            });
            if (!user) return { content: 'User not found.', ephemeral: true };
            return {
              embeds: [
                {
                  description: `\`\`\`json\n${JSON.stringify(user, null, 2)}\`\`\``
                }
              ],
              ephemeral: true
            };
          }
          case 'server': {
            const server = await prisma.server.findUnique({
              where: { serverID: ctx.options.get.server.id }
            });
            if (!server) return { content: 'Server not found.', ephemeral: true };
            return {
              embeds: [
                {
                  description: `\`\`\`json\n${JSON.stringify(server, null, 2)}\`\`\``
                }
              ],
              ephemeral: true
            };
          }
          case 'webhook': {
            const webhook = await prisma.webhook.findUnique({
              where: { id: ctx.options.get.webhook.id }
            });
            if (!webhook) return { content: 'Webhook not found.', ephemeral: true };
            return {
              embeds: [
                {
                  description: `\`\`\`json\n${JSON.stringify(webhook, null, 2)}\`\`\``
                }
              ],
              ephemeral: true
            };
          }
          case 'webhook_count': {
            const webhooks = await prisma.webhook.findMany({
              where: { guildID: ctx.options.get.webhook_count.id }
            });
            if (!webhooks.length) return { content: 'No webhooks found.', ephemeral: true };
            return {
              content: stripIndentsAndNewlines`
                ${webhooks.length} webhooks found.
                > ${webhooks.map((w) => `\`${w.id}\``).join(', ')}
              `,
              ephemeral: true
            };
          }
          case 'info': {
            const specialServers = await prisma.server.findMany({
              where: { maxWebhooks: { gt: 5 } }
            });
            return {
              content: stripIndentsAndNewlines`
                ${specialServers.length} servers with a raised webhook limit: ${specialServers
                .map((s) => `\`${s.serverID}\``)
                .join(', ')}
              `,
              ephemeral: true
            };
          }
          case 'counts': {
            const serverCount = await prisma.server.count();
            const userCount = await prisma.user.count();
            const webhooks = await prisma.webhook.findMany();
            return {
              content: stripIndentsAndNewlines`
                ${serverCount} servers
                ${userCount} users
                ${webhooks.length} webhooks (${webhooks.filter((w) => w.active).length} active)
              `,
              ephemeral: true
            };
          }
        }

        return { content: 'Invalid subcommand.', ephemeral: true };
      }
      case 'smw': {
        if (ctx.options.smw.maxwebhooks < 1)
          return { content: 'Max webhooks must be greater than 0.', ephemeral: true };

        await prisma.server.upsert({
          where: { serverID: ctx.options.smw.id },
          create: {
            serverID: ctx.options.smw.id,
            maxWebhooks: ctx.options.smw.maxwebhooks
          },
          update: {
            maxWebhooks: ctx.options.smw.maxwebhooks
          }
        });

        if (ctx.options.smw.restrict !== false) {
          const webhooks = await prisma.webhook.findMany({
            take: ctx.options.smw.maxwebhooks,
            where: { guildID: ctx.options.smw.id },
            orderBy: [{ createdAt: 'asc' }]
          });

          await prisma.webhook.updateMany({
            where: {
              guildID: ctx.options.smw.id,
              id: { notIn: webhooks.map((w) => w.id) }
            },
            data: { active: false }
          });

          return { content: 'Done.', ephemeral: true };
        }
      }
    }
    return { content: 'Invalid subcommand.', ephemeral: true };
  }
}

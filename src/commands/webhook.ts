import { User, Webhook } from '@prisma/client';
import { AxiosResponse } from 'axios';
import { oneLine } from 'common-tags';
import i18next from 'i18next';
import {
  ApplicationIntegrationType,
  AutocompleteContext,
  ButtonStyle,
  ChannelType,
  CommandContext,
  CommandOptionType,
  ComponentType,
  InteractionContextType,
  SlashCreator
} from 'slash-create';

import SlashCommand from '../command';
import { logger } from '../logger';
import {
  createDiscordWebhook,
  filterWebhookName,
  getBoardID,
  getData,
  isEntitlementsEnabled,
  noAuthResponse,
  postToWebhook,
  splitMessage,
  stripIndentsAndNewlines,
  truncate
} from '../util';
import { ActionType, createAction } from '../util/actions';
import { getBoard, getChannels, getWebhooks } from '../util/api';
import { EMOJIS } from '../util/constants';
import { formatNumber, langs } from '../util/locale';
import { prisma } from '../util/prisma';
import { createFiltersPrompt, createListPrompt, createQueryPrompt, createSelectPrompt } from '../util/prompt';
import Trello from '../util/trello';
import { DiscordWebhook, PartialDiscordWebhook, TrelloBoard } from '../util/types';
import WebhookFilters, { DEFAULT } from '../util/webhookFilters';

enum WebhookFilter {
  ALL = 'All',
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
  UNNAMED = 'Unnamed'
}

const MAX_WEBHOOKS = parseInt(process.env.WEBHOOK_LIMIT, 10) || 5;

export default class WebhookCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'webhook',
      description: 'Manage server webhooks.',
      contexts: [InteractionContextType.GUILD],
      integrationTypes: [ApplicationIntegrationType.GUILD_INSTALL],
      options: [
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'list',
          description: 'List webhooks in the server.',
          options: [
            {
              type: CommandOptionType.STRING,
              name: 'filter',
              description: 'Filter webhooks to list.',
              choices: [
                {
                  name: 'All',
                  value: WebhookFilter.ALL
                },
                {
                  name: 'Active',
                  value: WebhookFilter.ACTIVE
                },
                {
                  name: 'Inactive',
                  value: WebhookFilter.INACTIVE
                },
                {
                  name: 'Unnamed',
                  value: WebhookFilter.UNNAMED
                }
              ]
            }
          ]
        },
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'view',
          description: 'View a webhook.',
          options: [
            {
              type: CommandOptionType.STRING,
              name: 'webhook',
              description: 'The webhook to view.',
              autocomplete: true,
              required: true
            }
          ]
        },
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'add',
          description: 'Create a webhook.',
          options: [
            {
              type: CommandOptionType.STRING,
              name: 'board',
              description: 'The board to get updates from. You can use the board ID of a public board aswell.',
              required: true,
              autocomplete: true
            },
            {
              type: CommandOptionType.CHANNEL,
              name: 'channel',
              description: 'The channel to post updates to.',
              required: true,
              channel_types: [
                ChannelType.GUILD_TEXT,
                ChannelType.GUILD_NEWS,
                ChannelType.GUILD_NEWS_THREAD,
                ChannelType.GUILD_PUBLIC_THREAD,
                ChannelType.GUILD_PRIVATE_THREAD
              ]
            },
            {
              type: CommandOptionType.STRING,
              name: 'name',
              description: 'The name of the webhook to use.'
            }
          ]
        },
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'delete',
          description: 'Delete a webhook.',
          options: [
            {
              type: CommandOptionType.STRING,
              name: 'webhook',
              description: 'The webhook to delete.',
              autocomplete: true,
              required: true
            }
          ]
        },
        {
          type: CommandOptionType.SUB_COMMAND_GROUP,
          name: 'set',
          description: 'Edit a webhook.',
          options: [
            {
              type: CommandOptionType.SUB_COMMAND,
              name: 'active',
              description: 'Activate/Deactivate the webhook.',
              options: [
                {
                  type: CommandOptionType.STRING,
                  name: 'webhook',
                  description: 'The webhook to edit.',
                  autocomplete: true,
                  required: true
                },
                {
                  type: CommandOptionType.BOOLEAN,
                  name: 'active',
                  description: 'Whether to make this webhook active.',
                  required: true
                }
              ]
            },
            {
              type: CommandOptionType.SUB_COMMAND,
              name: 'name',
              description: "Edit a webhook's name.",
              options: [
                {
                  type: CommandOptionType.STRING,
                  name: 'webhook',
                  description: 'The webhook to edit.',
                  autocomplete: true,
                  required: true
                },
                {
                  type: CommandOptionType.STRING,
                  name: 'name',
                  description: 'The new name of the webhook.',
                  required: true
                }
              ]
            },
            {
              type: CommandOptionType.SUB_COMMAND,
              name: 'locale',
              description: "Edit a webhook's locale.",
              options: [
                {
                  type: CommandOptionType.STRING,
                  name: 'webhook',
                  description: 'The webhook to edit.',
                  autocomplete: true,
                  required: true
                },
                {
                  type: CommandOptionType.STRING,
                  name: 'locale',
                  description: 'The locale to set the webhook to.',
                  autocomplete: true,
                  required: true
                }
              ]
            },
            {
              type: CommandOptionType.SUB_COMMAND,
              name: 'filter_policy',
              description: "Edit a webhook's filter policy.",
              options: [
                {
                  type: CommandOptionType.STRING,
                  name: 'webhook',
                  description: 'The webhook to edit.',
                  autocomplete: true,
                  required: true
                },
                {
                  type: CommandOptionType.INTEGER,
                  name: 'policy',
                  description: 'The filter policy to set the webhook to.',
                  required: true,
                  choices: [
                    {
                      name: 'Whitelist',
                      value: 1
                    },
                    {
                      name: 'Blacklist',
                      value: 0
                    }
                  ]
                }
              ]
            },
            {
              type: CommandOptionType.SUB_COMMAND,
              name: 'style',
              description: "Edit a webhook's display style.",
              options: [
                {
                  type: CommandOptionType.STRING,
                  name: 'webhook',
                  description: 'The webhook to edit.',
                  autocomplete: true,
                  required: true
                },
                {
                  type: CommandOptionType.STRING,
                  name: 'style',
                  description: 'The display style to set to.',
                  required: true,
                  choices: [
                    {
                      name: 'Default',
                      value: 'default'
                    },
                    {
                      name: 'Small',
                      value: 'small'
                    },
                    {
                      name: 'Compact',
                      value: 'compact'
                    }
                  ]
                }
              ]
            },
            {
              type: CommandOptionType.SUB_COMMAND,
              name: 'filters',
              description: "Edit a webhook's filters.",
              options: [
                {
                  type: CommandOptionType.STRING,
                  name: 'webhook',
                  description: 'The webhook to edit.',
                  autocomplete: true,
                  required: true
                }
              ]
            },
            {
              type: CommandOptionType.SUB_COMMAND,
              name: 'cards',
              description: "Edit a webhook's filtered cards.",
              options: [
                {
                  type: CommandOptionType.STRING,
                  name: 'webhook',
                  description: 'The webhook to edit.',
                  autocomplete: true,
                  required: true
                }
              ]
            },
            {
              type: CommandOptionType.SUB_COMMAND,
              name: 'lists',
              description: "Edit a webhook's filtered lists.",
              options: [
                {
                  type: CommandOptionType.STRING,
                  name: 'webhook',
                  description: 'The webhook to edit.',
                  autocomplete: true,
                  required: true
                }
              ]
            },
            {
              type: CommandOptionType.SUB_COMMAND,
              name: 'thread',
              description: "Edit a webhook's thread.",
              options: [
                {
                  type: CommandOptionType.STRING,
                  name: 'webhook',
                  description: 'The webhook to edit.',
                  autocomplete: true,
                  required: true
                },
                {
                  type: CommandOptionType.CHANNEL,
                  name: 'thread',
                  description: 'The thread to set the webhook to.',
                  channel_types: [ChannelType.GUILD_NEWS_THREAD, ChannelType.GUILD_PUBLIC_THREAD, ChannelType.GUILD_PRIVATE_THREAD]
                }
              ]
            }
          ]
        },
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'repair',
          description: 'Repair a webhook.',
          options: [
            {
              type: CommandOptionType.STRING,
              name: 'webhook',
              description: 'The webhook to repair.',
              autocomplete: true,
              required: true
            }
          ]
        }
      ]
    });
  }

  webhookAvailable(webhookID: number, webhooks: Webhook[], maxWebhooks?: number) {
    maxWebhooks = maxWebhooks || MAX_WEBHOOKS;

    if (maxWebhooks < webhooks.length)
      return !!webhooks
        .sort((a, b) => a.createdAt.valueOf() - b.createdAt.valueOf())
        .slice(0, maxWebhooks)
        .find((webhook) => webhook.id === webhookID);

    return true;
  }

  async autocomplete(ctx: AutocompleteContext) {
    if (ctx.subcommands[0] === 'add') return this.autocompleteBoards(ctx, { query: ctx.options[ctx.subcommands[0]].board });
    if (ctx.subcommands[0] === 'set') {
      if (ctx.focused === 'locale') return this.autocompleteLocales(ctx, ctx.options.set[ctx.subcommands[1]].locale);
      return this.autocompleteWebhooks(ctx, ctx.options.set[ctx.subcommands[1]].webhook);
    }
    return this.autocompleteWebhooks(ctx, ctx.options[ctx.subcommands[0]].webhook);
  }

  async run(ctx: CommandContext) {
    const { userData, serverData, t, trello, locale } = await getData(ctx);
    if (!ctx.guildID) return { content: t('interactions.no_server'), ephemeral: true };
    if (!ctx.member!.roles.includes(serverData?.trelloRole) && !ctx.member!.permissions.has('MANAGE_GUILD'))
      return { content: t('interactions.no_trello_perms'), ephemeral: true };

    const webhooks = await prisma.webhook.findMany({
      where: { guildID: ctx.guildID },
      orderBy: { createdAt: 'asc' }
    });

    switch (ctx.subcommands[0]) {
      case 'list': {
        let displayedWebhooks = webhooks;
        const filter: WebhookFilter = ctx.options.list?.filter || WebhookFilter.ALL;
        switch (filter) {
          case WebhookFilter.ALL:
            break;
          case WebhookFilter.ACTIVE:
            displayedWebhooks = displayedWebhooks.filter((w) => w.active);
            break;
          case WebhookFilter.INACTIVE:
            displayedWebhooks = displayedWebhooks.filter((w) => !w.active);
            break;
          case WebhookFilter.UNNAMED:
            displayedWebhooks = displayedWebhooks.filter((w) => !w.name);
            break;
        }
        if (!displayedWebhooks.length) return t('query.no_list', { context: 'webhook' });

        await ctx.defer();
        await ctx.fetch();
        return await createListPrompt(
          {
            title: oneLine`
              ${t('webhook.list', { context: filter.toLowerCase() })}
              (${formatNumber(displayedWebhooks.length, locale)})`,
            pages: splitMessage(
              displayedWebhooks
                .map(
                  (w) => oneLine`
                    ${w.active ? EMOJIS.check : EMOJIS.uncheck}
                    \`${w.id}\` ${w.name || `*${t('webhook.unnamed')}*`}
                  `
                )
                .join('\n')
            )
          },
          ctx.messageID!,
          t,
          locale
        );
      }
      case 'view': {
        const webhook = webhooks.find((w) => String(w.id) === ctx.options.view?.webhook);
        if (!webhook) return t('query.not_found', { context: 'webhook' });

        let discordWebhook: DiscordWebhook;
        try {
          discordWebhook = (await getWebhooks(ctx.guildID, ctx.creator)).find((dwh) => dwh.id === webhook.webhookID);
        } catch (e) {
          return t('webhook.dwh_fail');
        }

        const filters = new WebhookFilters(BigInt(webhook.filters)).toArray();

        const trelloMember = webhook.memberID
          ? await prisma.user.findFirst({
              where: { trelloID: webhook.memberID }
            })
          : null;

        const webhookLang = langs.find((lang) => lang.code === webhook.locale);
        const webhookLocale = !webhook.locale ? t('webhook.not_set') : webhookLang ? `:${webhookLang.emoji}: ${webhookLang.name}` : webhook.locale;

        return {
          embeds: [
            {
              title: webhook.name || t('webhook.unnamed'),
              url: `https://trello.com/b/${webhook.modelID}?utm_source=tacobot.app`,
              description: stripIndentsAndNewlines`
                ${webhook.active ? EMOJIS.check : EMOJIS.uncheck} ${t('webhook.active')}
                **${t('webhook.id')}:** \`${webhook.id}\`
                **${t('webhook.style')}:** ${t(`webhook.styles.${webhook.style}.name`)}
                **${t('webhook.locale')}:** ${webhookLocale}
                ${trelloMember ? `**${t('webhook.wh_owner')}:** <@${trelloMember.userID}>` : ''}
                ${discordWebhook ? `**${t('webhook.dwh')}:** ${discordWebhook.name}` : ''}
                ${discordWebhook ? `**${t('webhook.dwh_creator')}:** <@${discordWebhook.user.id}>` : ''}
                ${discordWebhook ? `**${t('webhook.dwh_channel')}:** <#${discordWebhook.channel_id}>` : ''}
                ${discordWebhook && webhook.threadID ? `**${t('webhook.dwh_thread')}:** <#${webhook.threadID}>` : ''}
                ${
                  discordWebhook && webhook.threadParent === '0' && !webhook.active
                    ? `> :no_entry_sign: ${t('webhook.thread_send_fail')}`
                    : discordWebhook && webhook.threadID && discordWebhook.channel_id !== webhook.threadParent
                      ? `> :warning: ${t('webhook.thread_parent_mismatch')}`
                      : discordWebhook && webhook.threadParent && !webhook.threadID
                        ? `> :warning: ${t('webhook.thread_was_unset')}`
                        : ''
                }

                ${
                  !trelloMember || !discordWebhook
                    ? stripIndentsAndNewlines`
                      > :warning: **${t('webhook.repair_header')}**
                      ${!trelloMember ? t('webhook.trello_member_missing') : ''}
                      ${!discordWebhook ? t('webhook.discord_webhook_missing') : ''}
                      > ${t('webhook.repair_footer')}
                    `
                    : ''
                }
              `,
              fields: [
                {
                  name: t('webhook.filtering'),
                  value: stripIndentsAndNewlines`
                    **${t('webhook.filter_policy')}:** ${t(`webhook.${webhook.whitelist ? 'whitelist' : 'blacklist'}`)}
                    ${t('webhook.filters', { count: filters.length })}
                    ${t('webhook.filter_card', { count: webhook.cards.length })}
                    ${t('webhook.filter_list', { count: webhook.lists.length })}
                  `
                }
              ]
            }
          ]
        };
      }
      case 'delete': {
        const webhook = webhooks.find((w) => String(w.id) === ctx.options.delete?.webhook);
        if (!webhook) return t('query.not_found', { context: 'webhook' });

        return {
          content: t('webhook.delete_confirm', { webhook: webhook.name || t('webhook.unnamed') }),
          components: [
            {
              type: ComponentType.ACTION_ROW,
              components: [
                {
                  type: ComponentType.BUTTON,
                  style: ButtonStyle.DESTRUCTIVE,
                  label: t('common.yes'),
                  custom_id: `action::${ActionType.DELETE_WEBHOOK}:${webhook.id}`
                },
                {
                  type: ComponentType.BUTTON,
                  style: ButtonStyle.SECONDARY,
                  label: t('common.no'),
                  custom_id: 'delete'
                }
              ]
            }
          ]
        };
      }
      case 'add': {
        const maxWebhooks = serverData ? serverData.maxWebhooks : MAX_WEBHOOKS;
        if (maxWebhooks <= webhooks.length)
          return {
            content:
              t('webhook.max') +
              (isEntitlementsEnabled()
                ? `\n${t('bot.donate_extra')}: https://discord.com/application-directory/${ctx.data.application_id}/store`
                : ''),
            ephemeral: true,
            components: [
              {
                type: ComponentType.ACTION_ROW,
                components: [
                  {
                    type: ComponentType.BUTTON,
                    style: ButtonStyle.LINK,
                    label: t('bot.donate_button'),
                    url: process.env.DONATE_LINK
                  }
                ]
              }
            ]
          };
        if (!userData || !userData.trelloToken) return noAuthResponse(t);

        // Verify if the user can access this board
        const boardID = getBoardID(ctx.options.add.board);
        if (!boardID) return t('webhook.board_invalid');
        let board: TrelloBoard;
        try {
          const response = await trello.getBoard(boardID);
          board = response.data;
        } catch (err) {
          if ('response' in err) {
            const response = err.response as AxiosResponse;
            if (response.data === 'unauthorized permission requested') return t('webhook.board_unauthorized');
            else if (response.data === 'invalid id' || response.data === 'Board not found') return t('webhook.board_invalid');
          } else throw err;
        }

        const channel = ctx.channels.get(ctx.options.add.channel)!;
        const isThread =
          channel.type === ChannelType.GUILD_NEWS_THREAD ||
          channel.type === ChannelType.GUILD_PUBLIC_THREAD ||
          channel.type === ChannelType.GUILD_PRIVATE_THREAD;
        const isForum = channel.type === ChannelType.GUILD_FORUM || channel.type === (16 as ChannelType); /* GUILD_MEDIA */
        const channelID = isThread ? channel.parentID! : channel.id;

        let discordWebhooks: DiscordWebhook[];
        try {
          discordWebhooks = (await getWebhooks(ctx.guildID, ctx.creator)).filter((dwh) => dwh.channel_id === channelID);
        } catch (e) {
          return t('webhook.dwh_fail');
        }

        // Special case: if all the webhooks are made by other apps
        if (discordWebhooks.length >= 10 && discordWebhooks.every((dwh) => !dwh.token)) return t('webhook.no_dwh_available');

        // If there are no webhooks w/ tokens, we can create a new one
        if (!discordWebhooks.some((dwh) => dwh.token)) {
          let discordWebhook: DiscordWebhook;
          const reason = `Requested by ${ctx.user.discriminator === '0' ? ctx.user.username : `${ctx.user.username}#${ctx.user.discriminator}`} (${ctx.user.id})`;

          try {
            discordWebhook = await createDiscordWebhook(
              ctx.guildID,
              channelID,
              { name: filterWebhookName(ctx.options.add.name || board.name, t('webhook.new_wh_name')) },
              reason
            );
          } catch (e) {
            logger.warn(`Couldn't create a Discord Webhook (${ctx.guildID}, ${channelID})`);
            logger.warn({ e, reason });
            return t('webhook.dwh_fail_create');
          }

          const callbackURL = process.env.WEBHOOK_BASE_URL + userData.trelloID;
          const trelloWebhooks = await trello.getWebhooks();
          let trelloWebhook = trelloWebhooks.data.find((twh) => twh.idModel === board.id && twh.callbackURL === callbackURL);
          if (!trelloWebhook) trelloWebhook = await trello.addWebhook(board.id, { callbackURL });

          await prisma.webhook.create({
            data: {
              name: truncate(ctx.options.add.name || board.name, 100),
              memberID: userData.trelloID,
              modelID: board.id,
              trelloWebhookID: trelloWebhook.id,
              guildID: ctx.guildID,
              filters: DEFAULT.toString(),
              locale,
              webhookID: discordWebhook.id,
              webhookToken: discordWebhook.token,
              threadID: isThread ? channel.id : null,
              threadParent: isThread || isForum ? channelID : null
            }
          });

          if (!isForum)
            await postToWebhook(
              discordWebhook,
              {
                embeds: [
                  {
                    type: 'rich',
                    title: t('webhook.add_wh_title'),
                    description: t('webhook.add_wh_content', {
                      name: truncate(board.name, 1000)
                    }),
                    thumbnail: { url: 'https://tacobot.app/logo_happy.png' },
                    timestamp: new Date().toISOString(),
                    footer: {
                      icon_url: 'https://tacobot.app/logo_happy.png',
                      text: 'tacobot.app'
                    }
                  }
                ]
              },
              isThread ? channel.id : undefined
            );

          return t(isForum ? 'webhook.add_need_thread' : 'webhook.add_done', { board: truncate(board.name, 32) });
        }

        // If there are webhooks w/ tokens, we need to ask the user to choose one
        const limited = discordWebhooks.length >= 10;
        const action = await createAction(ActionType.CREATE_WEBHOOK, ctx.user.id, {
          board,
          name: ctx.options.add.name,
          webhooks: discordWebhooks,
          channelID,
          threadID: isThread ? channel.id : isForum ? '0' : ''
        });

        return {
          content: t(limited ? 'webhook.select_webhook_max' : 'webhook.select_webhook'),
          components: [
            {
              type: ComponentType.ACTION_ROW,
              components: [
                {
                  type: ComponentType.STRING_SELECT,
                  placeholder: t('webhook.select_webhook_placeholder'),
                  options: discordWebhooks
                    .filter((dwh) => dwh.token)
                    .map((dwh) => ({
                      label: truncate(dwh.name, 100),
                      description: t('webhook.created_by', {
                        user: dwh.user.discriminator === '0' ? dwh.user.username : `${dwh.user.username}#${dwh.user.discriminator}`
                      }),
                      value: dwh.id
                    })),
                  custom_id: `action:${action}`,
                  min_values: 1,
                  max_values: 1
                }
              ]
            },
            {
              type: ComponentType.ACTION_ROW,
              components: [
                {
                  type: ComponentType.BUTTON,
                  style: ButtonStyle.SUCCESS,
                  label: t('webhook.create_new'),
                  custom_id: limited ? 'none' : `action:${action}:`,
                  disabled: limited
                },
                {
                  type: ComponentType.BUTTON,
                  style: ButtonStyle.SECONDARY,
                  label: t('common.cancel'),
                  custom_id: 'delete'
                }
              ]
            }
          ]
        };
      }
      case 'set': {
        const webhook = webhooks.find((w) => String(w.id) === ctx.options.set[ctx.subcommands[1]].webhook);
        if (!webhook) return t('query.not_found', { context: 'webhook' });

        const maxWebhooks = serverData ? serverData.maxWebhooks : MAX_WEBHOOKS;
        const available = this.webhookAvailable(webhook.id, webhooks, maxWebhooks);
        if (!available)
          return {
            content:
              t('webhook.wh_expire') +
              (isEntitlementsEnabled()
                ? `\n${t('bot.donate_extra')}: https://discord.com/application-directory/${ctx.data.application_id}/store`
                : ''),
            ephemeral: true,
            components: [
              {
                type: ComponentType.ACTION_ROW,
                components: [
                  {
                    type: ComponentType.BUTTON,
                    style: ButtonStyle.LINK,
                    label: t('bot.donate_button'),
                    url: process.env.DONATE_LINK
                  }
                ]
              }
            ]
          };

        switch (ctx.subcommands[1]) {
          case 'active': {
            if (webhook.active === ctx.options.set.active.active)
              return t(ctx.options.set.active.active ? 'webhook.already_active' : 'webhook.already_inactive');

            await prisma.webhook.update({
              where: { id: webhook.id },
              data: {
                active: ctx.options.set.active.active,
                threadParent: webhook.threadParent === '0' ? null : webhook.threadParent
              }
            });

            return t(ctx.options.set.active.active ? 'webhook.set_active' : 'webhook.set_inactive');
          }
          case 'name': {
            await prisma.webhook.update({
              where: { id: webhook.id },
              data: { name: truncate(ctx.options.set.name.name, 100) }
            });

            return t('webhook.set_name', {
              name: truncate(ctx.options.set.name.name, 100)
            });
          }
          case 'filter_policy': {
            const policy = Boolean(ctx.options.set.filter_policy.policy);
            await prisma.webhook.update({
              where: { id: webhook.id },
              data: { whitelist: policy }
            });

            return t('webhook.set_filter_policy', {
              policy: policy ? t('webhook.whitelist') : t('webhook.blacklist')
            });
          }
          case 'locale': {
            const setLocale = ctx.options.set.locale.locale;
            if (!langs.some((lang) => lang.code === setLocale)) return t('webhook.invalid_locale');

            await prisma.webhook.update({
              where: { id: webhook.id },
              data: { locale: setLocale }
            });

            return t('webhook.set_locale', {
              name: oneLine`
                :flag_${i18next.getResource(setLocale, 'commands', '_.emoji')}:
                ${i18next.getResource(setLocale, 'commands', '_.name')}`
            });
          }
          case 'style': {
            const setStyle = ctx.options.set.style.style;
            if (!['default', 'small', 'compact'].includes(setStyle)) return t('webhook.invalid_style');

            await prisma.webhook.update({
              where: { id: webhook.id },
              data: { style: setStyle }
            });

            return t('webhook.set_style', {
              style: t(`webhook.styles.${setStyle}.name`)
            });
          }
          case 'filters': {
            const action = await createAction(ActionType.SET_WEBHOOK_FILTERS, ctx.user.id, { webhookID: webhook.id });
            await ctx.defer();
            await ctx.fetch();
            return await createFiltersPrompt(
              {
                title: t('webhook.filters_title', { webhook: truncate(webhook.name || t('webhook.unnamed'), 100) }),
                action,
                selected: new WebhookFilters(BigInt(webhook.filters)).toArray()
              },
              ctx.messageID!,
              t
            );
          }
          case 'cards': {
            if (!userData || !userData.trelloToken) return noAuthResponse(t);
            const [board] = await getBoard(userData.trelloToken, webhook.modelID, userData.trelloID);
            const action = await createAction(ActionType.SET_WEBHOOK_CARDS, ctx.user.id, { webhookID: webhook.id });
            await ctx.defer();
            await ctx.fetch();
            return await createSelectPrompt(
              {
                content: t('webhook.choose_cards'),
                title: t('webhook.cards_title', { webhook: truncate(webhook.name || t('webhook.unnamed'), 100) }),
                action,
                values: board.cards,
                placeholder: t('webhook.cards_placeholder'),
                display: board.cards.map((card) => ({
                  label: truncate(card.name, 100),
                  description: truncate(board.lists.find((l) => l.id === card.idList).name, 100)
                }))
              },
              ctx.messageID!,
              t,
              webhook.cards.map((c) => board.cards.findIndex((cr) => cr.id === c)),
              locale
            );
          }
          case 'lists': {
            if (!userData || !userData.trelloToken) return noAuthResponse(t);
            const [board] = await getBoard(userData.trelloToken, webhook.modelID, userData.trelloID);
            const action = await createAction(ActionType.SET_WEBHOOK_LISTS, ctx.user.id, { webhookID: webhook.id });
            await ctx.defer();
            await ctx.fetch();
            return await createSelectPrompt(
              {
                content: t('webhook.choose_lists'),
                title: t('webhook.lists_title', { webhook: truncate(webhook.name || t('webhook.unnamed'), 100) }),
                action,
                values: board.lists,
                placeholder: t('webhook.lists_placeholder'),
                display: board.lists.map((list) => ({
                  label: truncate(list.name, 100),
                  description: t('common.card_count', { count: board.cards.filter((c) => c.idList === list.id).length })
                }))
              },
              ctx.messageID!,
              t,
              webhook.lists.map((l) => board.lists.findIndex((li) => li.id === l)),
              locale
            );
          }
          case 'thread': {
            if (!ctx.options.set.thread.thread) {
              await prisma.webhook.update({
                where: { id: webhook.id },
                data: {
                  threadID: null,
                  threadParent: null
                }
              });

              return t('webhook.unset_thread');
            }

            const channel = ctx.channels.get(ctx.options.set.thread.thread)!;
            const isThread =
              channel.type === ChannelType.GUILD_NEWS_THREAD ||
              channel.type === ChannelType.GUILD_PUBLIC_THREAD ||
              channel.type === ChannelType.GUILD_PRIVATE_THREAD;

            if (!isThread)
              return {
                content: t('webhook.set_thread_invalid'),
                ephemeral: true
              };

            if (channel.threadMetadata?.locked)
              return {
                content: t('webhook.set_thread_locked'),
                ephemeral: true
              };

            if (!webhook.webhookID || !webhook.webhookToken)
              return {
                content: t('webhook.set_thread_disconnected_dwh'),
                ephemeral: true
              };

            const discordWebhook: PartialDiscordWebhook | null = await ctx.creator.requestHandler
              .request<PartialDiscordWebhook>('GET', `/webhooks/${webhook.webhookID}/${webhook.webhookToken}`)
              .catch(() => null);
            if (!discordWebhook)
              return {
                content: t('webhook.set_thread_disconnected_dwh'),
                ephemeral: true
              };

            if (channel.parentID !== discordWebhook.channel_id)
              return {
                content: t('webhook.set_thread_bad_parent', { channel: `<#${discordWebhook.channel_id}>` }),
                ephemeral: true
              };

            await prisma.webhook.update({
              where: { id: webhook.id },
              data: {
                threadID: channel.id,
                threadParent: channel.parentID!,
                // Set to active if there was a thread warning before
                active: webhook.threadParent === '0' || (webhook.threadParent && !webhook.threadID) || webhook.active
              }
            });

            return t('webhook.set_thread', { thread: `<#${channel.id}>` });
          }
        }

        return {
          content: t('interactions.bad_subcommand'),
          ephemeral: true
        };
      }
      case 'repair': {
        const webhook = webhooks.find((w) => String(w.id) === ctx.options.repair?.webhook);
        if (!webhook) return t('query.not_found', { context: 'webhook' });
        if (!userData || !userData.trelloToken) return noAuthResponse(t);

        // Repair trello webhook
        const trelloMember = webhook.memberID
          ? await prisma.user.findFirst({
              where: { trelloID: webhook.memberID }
            })
          : null;
        if (!trelloMember || !trelloMember.trelloToken) {
          try {
            await this.repairTrelloWebhook(webhook, webhook.modelID, userData);
          } catch (e) {
            return t('webhook.twh_repair_failed');
          }
        } else {
          try {
            await this.repairTrelloWebhook(webhook, webhook.modelID, trelloMember);
          } catch (e) {
            logger.warn("Failed to repair other's Trello webhook", e);
            try {
              await this.repairTrelloWebhook(webhook, webhook.modelID, userData);
            } catch (e) {
              return t('webhook.twh_repair_failed');
            }
          }
        }

        // Repair discord webhook
        let discordWebhooks: DiscordWebhook[];
        try {
          discordWebhooks = await getWebhooks(ctx.guildID, ctx.creator);
        } catch (e) {
          return t('webhook.dwh_fail');
        }
        if (discordWebhooks.find((dwh) => dwh.id === webhook.webhookID)) return t('webhook.repair_done');

        const channels = await getChannels(ctx.guildID, ctx.creator);
        const availableChannels = channels
          .filter((c) => {
            if (c.type !== ChannelType.GUILD_TEXT && c.type !== ChannelType.GUILD_NEWS && c.type !== ChannelType.GUILD_FORUM) return false;
            const channelWebhooks = discordWebhooks.filter((dwh) => dwh.channel_id === c.id);
            if (channelWebhooks.every((dwh) => !dwh.token) && channelWebhooks.length >= 10) return false;
            return true;
          })
          .sort((a, b) => a.position - b.position);

        if (!availableChannels.length) return t('webhook.dwh_fail_no_channel');

        const action = await createAction(ActionType.REPAIR_AFTER_CHANNEL, ctx.user.id, {
          webhookID: webhook.id,
          webhookName: webhook.name,
          webhooks: discordWebhooks
        });

        await ctx.defer();
        await ctx.fetch();
        return await createQueryPrompt(
          {
            content: t('webhook.select_channel'),
            action,
            placeholder: t('webhook.select_channel_placeholder'),
            values: availableChannels,
            display: availableChannels.map((c) => ({
              label: truncate(c.name, 100),
              description: c.parent_id ? truncate(channels.find((ch) => ch.id === c.parent_id).name, 100) : '',
              emoji: {
                id:
                  c.type === ChannelType.GUILD_NEWS
                    ? '658522693058166804'
                    : c.type === ChannelType.GUILD_FORUM
                      ? '1330683612290617444'
                      : '585783907841212418'
              }
            }))
          },
          ctx.messageID!,
          t,
          locale
        );
      }
    }

    return {
      content: t('interactions.bad_subcommand'),
      ephemeral: true
    };
  }

  async repairTrelloWebhook(webhook: Webhook, boardID: string, user: User) {
    const callbackURL = process.env.WEBHOOK_BASE_URL + user.trelloID;
    const trello = new Trello(user.trelloToken);
    const trelloWebhooks = await trello.getWebhooks();
    let trelloWebhook = trelloWebhooks.data.find((twh) => twh.idModel === boardID && twh.callbackURL === callbackURL);
    if (!trelloWebhook) trelloWebhook = await trello.addWebhook(boardID, { callbackURL });
    if (webhook.trelloWebhookID === trelloWebhook.id) return;
    await prisma.webhook.update({
      where: { id: webhook.id },
      data: { memberID: user.trelloID, trelloWebhookID: trelloWebhook.id }
    });
  }
}

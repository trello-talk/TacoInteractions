import {
  SlashCreator,
  CommandContext,
  CommandOptionType,
  AutocompleteContext,
  ComponentType,
  ButtonStyle,
  ChannelType
} from 'slash-create';
import SlashCommand from '../command';
import { prisma } from '../util/prisma';
import { formatNumber, langs } from '../util/locale';
import { oneLine } from 'common-tags';
import {
  createDiscordWebhook,
  getData,
  noAuthResponse,
  postToWebhook,
  splitMessage,
  stripIndentsAndNewlines,
  truncate
} from '../util';
import { createFiltersPrompt, createListPrompt, createSelectPrompt } from '../util/prompt';
import { EMOJIS } from '../util/constants';
import WebhookFilters, { DEFAULT } from '../util/webhookFilters';
import { getBoard, getWebhooks } from '../util/api';
import { DiscordWebhook, TrelloBoard } from '../util/types';
import i18next from 'i18next';
import { ActionType, createAction } from '../util/actions';
import { AxiosResponse } from 'axios';
import { Webhook } from '@prisma/client';
import { logger } from '../logger';

enum WebhookFilter {
  ALL = 'All',
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
  UNNAMED = 'Unnamed'
}

export default class WebhookCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'webhook',
      description: 'Manage server webhooks.',
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
              channel_types: [ChannelType.GUILD_TEXT, ChannelType.GUILD_NEWS]
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
            }
          ]
        }
      ]
    });
  }

  webhookAvailable(webhookID: number, webhooks: Webhook[], maxWebhooks?: number) {
    maxWebhooks = maxWebhooks || 5;

    if (maxWebhooks < webhooks.length)
      return !!webhooks
        .sort((a, b) => a.createdAt.valueOf() - b.createdAt.valueOf())
        .slice(0, maxWebhooks)
        .find((webhook) => webhook.id === webhookID);

    return true;
  }

  async autocomplete(ctx: AutocompleteContext) {
    if (ctx.subcommands[0] === 'add')
      return this.autocompleteBoards(ctx, { query: ctx.options[ctx.subcommands[0]].board });
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
      where: { guildID: ctx.guildID }
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

        const trelloMember = await prisma.user.findFirst({
          where: { trelloID: webhook.memberID }
        });

        const webhookLocale = !webhook.locale
          ? t('webhook.not_set')
          : langs.includes(webhook.locale)
          ? oneLine`
            :flag_${i18next.getResource(webhook.locale, 'commands', '_.emoji')}:
            ${i18next.getResource(webhook.locale, 'commands', '_.name')}`
          : webhook.locale;

        return {
          embeds: [
            {
              title: webhook.name || t('webhook.unnamed'),
              description: stripIndentsAndNewlines`
                ${webhook.active ? EMOJIS.check : EMOJIS.uncheck} ${t('webhook.active')}
                **${t('webhook.id')}:** \`${webhook.id}\`
                **${t('webhook.style')}:** ${t(`webhook.styles.${webhook.style}.name`)}
                **${t('webhook.locale')}:** ${webhookLocale}
                ${trelloMember ? `**${t('webhook.wh_owner')}:** <@${trelloMember.userID}>` : ''}
                ${discordWebhook ? `**${t('webhook.dwh')}:** ${discordWebhook.name}` : ''}
                ${discordWebhook ? `**${t('webhook.dwh_creator')}:** <@${discordWebhook.user.id}>` : ''}

                ${
                  !trelloMember || !discordWebhook
                    ? stripIndentsAndNewlines`
                      > :warning: **${t('webhook.repair_header')}**
                      ${!trelloMember ? t('webhook.trello_member_missing') : ''}
                      ${!discordWebhook ? t('webhook.discord_webhook_missing') : ''}
                      >${t('webhook.repair_footer')}
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
        const maxWebhooks = serverData ? serverData.maxWebhooks : 5;
        if (maxWebhooks <= webhooks.length)
          return {
            content: t('webhook.max'),
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
        const boardID = ctx.options.add.board.slice(0, 25);
        let board: TrelloBoard;
        try {
          const response = await trello.getBoard(boardID);
          board = response.data;
        } catch (err) {
          if ('response' in err) {
            const response = err.response as AxiosResponse;
            if (response.data === 'unauthorized permission requested') return t('webhook.board_unauthorized');
            else if (response.data === 'invalid id') return t('webhook.board_invalid');
          } else throw err;
        }

        let discordWebhooks: DiscordWebhook[];
        try {
          discordWebhooks = (await getWebhooks(ctx.guildID, ctx.creator)).filter(
            (dwh) => dwh.channel_id === ctx.options.add.channel
          );
        } catch (e) {
          return t('webhook.dwh_fail');
        }

        // Special case: if all the webhooks are made by other apps
        if (discordWebhooks.length >= 10 && discordWebhooks.every((dwh) => !dwh.token))
          return t('webhook.no_dwh_available');

        // If there are no webhooks w/ tokens, we can create a new one
        if (!discordWebhooks.some((dwh) => dwh.token)) {
          let discordWebhook: DiscordWebhook;
          try {
            discordWebhook = await createDiscordWebhook(
              ctx.guildID,
              ctx.options.add.channel,
              {
                name:
                  board.name === 'clyde' ? t('webhook.new_wh_name') : truncate(ctx.options.add.name || board.name, 32)
              },
              `Requested by ${ctx.user.username}#${ctx.user.discriminator} (${ctx.user.id})`
            );
          } catch (e) {
            logger.warn(`Couldn't create a Discord Webhook (${ctx.guildID}, ${ctx.options.add.channel})`, e);
            return t('interactions.dwh_fail_create');
          }

          const callbackURL = process.env.WEBHOOK_BASE_URL + userData.trelloID;
          const trelloWebhooks = await trello.getWebhooks();
          let trelloWebhook = trelloWebhooks.data.find(
            (twh) => twh.idModel === board.id && twh.callbackURL === callbackURL
          );
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
              webhookToken: discordWebhook.token
            }
          });

          await postToWebhook(discordWebhook, {
            embeds: [
              {
                type: 'rich',
                title: t('webhook.new_wh_title'),
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
          });

          return t('interactions.add_done', { board: truncate(board.name, 32) });
        }

        // If there are webhooks w/ tokens, we need to ask the user to choose one
        const limited = discordWebhooks.length >= 10;
        const action = await createAction(ActionType.CREATE_WEBHOOK, ctx.user.id, {
          board,
          name: ctx.options.add.name,
          webhooks: discordWebhooks,
          channelID: ctx.options.add.channel
        });

        return {
          content: t(limited ? 'webhook.select_webhook_max' : 'webhook.select_webhook'),
          components: [
            {
              type: ComponentType.ACTION_ROW,
              components: [
                {
                  type: ComponentType.SELECT,
                  placeholder: t('webhook.select_webhook_placeholder'),
                  options: discordWebhooks
                    .filter((dwh) => dwh.token)
                    .map((dwh) => ({
                      label: truncate(dwh.name, 100),
                      description: t('webhook.created_by', { user: `${dwh.user.username}#${dwh.user.discriminator}` }),
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

        const available = this.webhookAvailable(webhook.id, webhooks, serverData.maxWebhooks);
        if (!available)
          return {
            content: t('webhook.wh_expire'),
            ephemeral: true,
            components: [
              {
                type: ComponentType.ACTION_ROW,
                components: [
                  {
                    type: ComponentType.BUTTON,
                    style: ButtonStyle.LINK,
                    label: t('bot.donate_button'),
                    url: process.env.AUTH_LINK
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
              data: { active: ctx.options.set.active.active }
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
            if (!langs.includes(setLocale)) return t('webhook.invalid_locale');

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
                title: t('webhook.filters_title', { webhook: truncate(webhook.name, 100) || t('webhook.unnamed') }),
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
                title: t('webhook.cards_title', { webhook: truncate(webhook.name, 100) || t('webhook.unnamed') }),
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
                title: t('webhook.lists_title', { webhook: truncate(webhook.name, 100) || t('webhook.unnamed') }),
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
        }

        return {
          content: t('interactions.bad_subcommand'),
          ephemeral: true
        };
      }
    }

    return {
      content: t('interactions.bad_subcommand'),
      ephemeral: true
    };
  }
}

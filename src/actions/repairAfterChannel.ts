import { ButtonStyle, ComponentContext, ComponentType } from 'slash-create';
import { logger } from '../logger';
import { createDiscordWebhook, getData, postToWebhook, truncate } from '../util';
import { ActionFunction, ActionType, createAction, RepairWebhookAction } from '../util/actions';
import { prisma } from '../util/prisma';
import { DiscordChannel, DiscordWebhook } from '../util/types';

export const action: ActionFunction = {
  type: ActionType.REPAIR_AFTER_CHANNEL,
  requiresData: true,
  async onAction(ctx: ComponentContext, action: RepairWebhookAction, data: DiscordChannel) {
    const { t } = await getData(ctx);
    if (!ctx.guildID) return void ctx.editParent(t('interactions.no_server'), { components: [], embeds: [] });

    let discordWebhooks: DiscordWebhook[];
    try {
      discordWebhooks = action.webhooks.filter((dwh) => dwh.channel_id === data.id);
    } catch (e) {
      return void ctx.editParent(t('webhook.dwh_fail'), { components: [] });
    }

    // Special case: if all the webhooks are made by other apps
    if (discordWebhooks.length >= 10 && discordWebhooks.every((dwh) => !dwh.token))
      return void ctx.editParent(t('webhook.no_dwh_available'), { components: [] });

    // If there are no webhooks w/ tokens, we can create a new one
    if (!discordWebhooks.some((dwh) => dwh.token)) {
      let discordWebhook: DiscordWebhook;
      try {
        discordWebhook = await createDiscordWebhook(
          ctx.guildID,
          data.id,
          {
            name:
              !action.webhookName || action.webhookName.toLowerCase() === 'clyde'
                ? t('webhook.new_wh_name')
                : truncate(action.webhookName, 32)
          },
          `Requested by ${ctx.user.username}#${ctx.user.discriminator} (${ctx.user.id})`
        );
      } catch (e) {
        logger.warn(`Couldn't create a Discord Webhook (${ctx.guildID}, ${data.id})`, e);
        return void ctx.editParent(t('webhook.dwh_fail_create'), { components: [] });
      }

      await prisma.webhook.update({
        where: { id: action.webhookID },
        data: {
          webhookID: discordWebhook.id,
          webhookToken: discordWebhook.token
        }
      });

      await postToWebhook(discordWebhook, {
        embeds: [
          {
            type: 'rich',
            title: t('webhook.repair_wh_title'),
            description: t('webhook.repair_wh_content', {
              name: action.webhookName ? truncate(action.webhookName, 100) : t('webhook.unnamed')
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

      return void ctx.editParent(t('webhook.repair_done'), { components: [] });
    }

    // If there are webhooks w/ tokens, we need to ask the user to choose one
    const limited = discordWebhooks.length >= 10;
    const newAction = await createAction(ActionType.REPAIR_AFTER_WEBHOOK, ctx.user.id, {
      webhookID: action.webhookID,
      webhookName: action.webhookName,
      webhooks: discordWebhooks,
      channelID: data.id
    });

    return void ctx.editParent({
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
              custom_id: `action:${newAction}`,
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
              custom_id: limited ? 'none' : `action:${newAction}:`,
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
    });
  }
};

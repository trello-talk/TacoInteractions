import { ComponentContext } from 'slash-create';

import { logger } from '../logger';
import { BLACKLISTED_WEBHOOK_NAMES, BLACKLISTED_WEBHOOK_SUBSTRINGS, createDiscordWebhook, getData, postToWebhook, truncate } from '../util';
import { ActionFunction, ActionType, RepairWebhookAction } from '../util/actions';
import { prisma } from '../util/prisma';

export const action: ActionFunction = {
  type: ActionType.REPAIR_AFTER_WEBHOOK,
  async onAction(ctx: ComponentContext, action: RepairWebhookAction) {
    const { t } = await getData(ctx);
    if (!ctx.guildID) return void ctx.editParent({ content: t('interactions.no_server'), components: [] });

    let discordWebhook = action.webhooks.find((w) => w.id === ctx.values[0]);
    if (!discordWebhook)
      try {
        const boardName = action.webhookName.toLowerCase();
        const nameInvalid = BLACKLISTED_WEBHOOK_SUBSTRINGS.find((str) => boardName.includes(str)) || BLACKLISTED_WEBHOOK_NAMES.includes(boardName);
        const webhookName = (nameInvalid ? '' : truncate(action.webhookName, 80)) || t('webhook.new_wh_name');
        const reason = `Requested by ${ctx.user.discriminator === '0' ? ctx.user.username : `${ctx.user.username}#${ctx.user.discriminator}`} (${ctx.user.id})`;

        discordWebhook = await createDiscordWebhook(ctx.guildID, action.channelID, { name: webhookName }, reason);
      } catch (e) {
        logger.warn(`Couldn't create a Discord Webhook (${ctx.guildID}, ${action.channelID})`, e);
        return void ctx.editParent({ content: t('webhook.dwh_fail_create'), components: [] });
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

    return void ctx.editParent({ content: t('webhook.repair_done'), components: [] });
  }
};

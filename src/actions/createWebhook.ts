import { ComponentContext } from 'slash-create';

import { logger } from '../logger';
import { createDiscordWebhook, getData, noAuthResponse, postToWebhook, truncate } from '../util';
import { ActionFunction, ActionType, WebhookCreateAction } from '../util/actions';
import { prisma } from '../util/prisma';
import { DEFAULT } from '../util/webhookFilters';

export const action: ActionFunction = {
  type: ActionType.CREATE_WEBHOOK,
  async onAction(ctx: ComponentContext, action: WebhookCreateAction) {
    const { userData, t, trello, locale } = await getData(ctx);
    if (!ctx.guildID) return void ctx.editParent(t('interactions.no_server'), { components: [] });
    if (!userData || !userData.trelloToken) return void ctx.editParent(noAuthResponse(t));

    let discordWebhook = action.webhooks.find((w) => w.id === ctx.values[0]);
    if (!discordWebhook)
      try {
        discordWebhook = await createDiscordWebhook(
          ctx.guildID,
          action.channelID,
          {
            name: action.board.name.toLowerCase() === 'clyde' ? t('webhook.new_wh_name') : truncate(action.name || action.board.name, 32)
          },
          `Requested by ${ctx.user.discriminator === '0' ? ctx.user.username : `${ctx.user.username}#${ctx.user.discriminator}`} (${ctx.user.id})`
        );
      } catch (e) {
        logger.warn(`Couldn't create a Discord Webhook (${ctx.guildID}, ${action.channelID})`, e);
        return void ctx.editParent(t('webhook.dwh_fail_create'), { components: [] });
      }

    const callbackURL = process.env.WEBHOOK_BASE_URL + userData.trelloID;
    const trelloWebhooks = await trello.getWebhooks();
    let trelloWebhook = trelloWebhooks.data.find((twh) => twh.idModel === action.board.id && twh.callbackURL === callbackURL);
    if (!trelloWebhook) trelloWebhook = await trello.addWebhook(action.board.id, { callbackURL });

    await prisma.webhook.create({
      data: {
        name: truncate(action.name || action.board.name, 100),
        memberID: userData.trelloID,
        modelID: action.board.id,
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
          title: t('webhook.add_wh_title'),
          description: t('webhook.add_wh_content', {
            name: truncate(action.board.name, 1000)
          }),
          thumbnail: { url: 'https://tacobot.app/logo_happy.png' },
          footer: {
            icon_url: 'https://tacobot.app/logo_happy.png',
            text: 'tacobot.app'
          }
        }
      ]
    });

    return void ctx.editParent(t('webhook.add_done', { board: truncate(action.board.name, 32) }), {
      components: []
    });
  }
};

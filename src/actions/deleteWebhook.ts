import { ComponentContext } from 'slash-create';

import { getData } from '../util';
import { ActionFunction, ActionType } from '../util/actions';
import { prisma } from '../util/prisma';
import Trello from '../util/trello';

export const action: ActionFunction = {
  type: ActionType.DELETE_WEBHOOK,
  async onAction(ctx: ComponentContext, action) {
    const { t } = await getData(ctx);
    if (!ctx.guildID) return void ctx.editParent(t('interactions.no_server'), { components: [] });
    if (isNaN(parseInt(action.extra, 10))) return void ctx.editParent(t('query.not_found_webhook'), { components: [] });

    const webhook = await prisma.webhook.findFirst({
      where: {
        guildID: ctx.guildID,
        id: parseInt(action.extra, 10)
      }
    });
    if (!webhook) return void ctx.editParent(t('query.not_found_webhook'), { components: [] });

    await prisma.webhook.delete({ where: { id: webhook.id } });

    // Remove the internal webhook if there are no more webhooks depending on it
    const trelloMember = webhook.memberID
      ? await prisma.user.findUnique({
          where: { userID: webhook.memberID }
        })
      : null;
    try {
      if (trelloMember?.trelloToken) {
        const trello = new Trello(trelloMember.trelloToken);
        const webhookCount = await prisma.webhook.count({
          where: {
            trelloWebhookID: webhook.trelloWebhookID,
            id: {
              not: webhook.id
            }
          }
        });
        if (webhookCount <= 0) await trello.deleteWebhook(webhook.trelloWebhookID);
      }
    } catch (e) {}

    return void ctx.editParent(t('webhook.delete_done'), { components: [] });
  }
};

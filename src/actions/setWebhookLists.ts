import { ComponentContext } from 'slash-create';

import { getData, noAuthResponse } from '../util';
import { ActionFunction, ActionType, WebhookEditAction } from '../util/actions';
import { prisma } from '../util/prisma';
import { TrelloList } from '../util/types';

export const action: ActionFunction = {
  type: ActionType.SET_WEBHOOK_LISTS,
  requiresData: true,
  async onAction(ctx: ComponentContext, action: WebhookEditAction, data: TrelloList[]) {
    const { userData, t } = await getData(ctx);
    if (!ctx.guildID) return void ctx.editParent({ content: t('interactions.no_server'), components: [], embeds: [] });
    if (!userData || !userData.trelloToken) return void ctx.editParent(noAuthResponse(t));

    await prisma.webhook.update({
      where: { id: action.webhookID },
      data: { lists: data.map((list) => list.id) }
    });

    return void ctx.editParent({ content: t('webhook.lists_updated'), components: [], embeds: [] });
  }
};

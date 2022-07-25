import { ComponentContext } from 'slash-create';

import { getData, noAuthResponse } from '../util';
import { ActionFunction, ActionType, WebhookEditAction } from '../util/actions';
import { prisma } from '../util/prisma';
import { TrelloCard } from '../util/types';

export const action: ActionFunction = {
  type: ActionType.SET_WEBHOOK_CARDS,
  requiresData: true,
  async onAction(ctx: ComponentContext, action: WebhookEditAction, data: TrelloCard[]) {
    const { userData, t } = await getData(ctx);
    if (!ctx.guildID) return void ctx.editParent(t('interactions.no_server'), { components: [], embeds: [] });
    if (!userData || !userData.trelloToken) return void ctx.editParent(noAuthResponse(t));

    await prisma.webhook.update({
      where: { id: action.webhookID },
      data: { cards: data.map((card) => card.id) }
    });

    return void ctx.editParent(t('webhook.cards_updated'), { components: [], embeds: [] });
  }
};

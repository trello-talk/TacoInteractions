import { ComponentContext } from 'slash-create';
import { getData, noAuthResponse } from '../util';
import { ActionFunction, ActionType, WebhookEditAction } from '../util/actions';
import { prisma } from '../util/prisma';
import WebhookFilters from '../util/webhookFilters';

export const action: ActionFunction = {
  type: ActionType.SET_WEBHOOK_FILTERS,
  requiresData: true,
  async onAction(ctx: ComponentContext, action: WebhookEditAction, data: string[]) {
    const { userData, t } = await getData(ctx);
    if (!ctx.guildID) return void ctx.editParent(t('interactions.no_server'), { components: [], embeds: [] });
    if (!userData || !userData.trelloToken) return void ctx.editParent(noAuthResponse(t));

    await prisma.webhook.update({
      where: { id: action.webhookID },
      data: { filters: new WebhookFilters(data).bitfield.toString() }
    });

    return void ctx.editParent(t('webhook.filters_updated'), { components: [], embeds: [] });
  }
};

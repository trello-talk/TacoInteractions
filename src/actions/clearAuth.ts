import { ComponentContext } from 'slash-create';

import { getData } from '../util';
import { ActionFunction, ActionType } from '../util/actions';
import { prisma } from '../util/prisma';

export const action: ActionFunction = {
  type: ActionType.USER_CLEAR_AUTH,
  async onAction(ctx: ComponentContext, action) {
    const { userData, t, trello } = await getData(ctx);
    if (!userData || !userData.trelloToken) return void ctx.editParent(t('clearauth.no_auth'), { components: [] });

    await trello.invalidate();
    await prisma.user.update({
      where: { userID: action.user },
      data: { trelloID: null, trelloToken: null }
    });
    if (userData.trelloID)
      await prisma.webhook.updateMany({
        where: { memberID: userData.trelloID },
        data: { active: false, memberID: null }
      });

    return void ctx.editParent(t('clearauth.done'), { components: [] });
  }
};

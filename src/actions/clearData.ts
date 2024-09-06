import { ComponentContext } from 'slash-create';

import { getData } from '../util';
import { ActionFunction, ActionType } from '../util/actions';
import { prisma } from '../util/prisma';

export const action: ActionFunction = {
  type: ActionType.USER_CLEAR_DATA,
  async onAction(ctx: ComponentContext) {
    const { userData, t, trello } = await getData(ctx);
    if (!userData) return void ctx.editParent({ content: t('cleardata.no_data'), components: [] });

    try {
      if (userData.trelloToken) await trello.invalidate();
    } catch (e) {}

    await prisma.user.delete({ where: { userID: userData.userID } });

    if (userData.trelloID)
      await prisma.webhook.updateMany({
        where: { memberID: userData.trelloID },
        data: { active: false, memberID: null }
      });

    return void ctx.editParent({ content: t('cleardata.done'), components: [] });
  }
};

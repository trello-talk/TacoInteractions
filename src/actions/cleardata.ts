import { ActionFunction, ActionType } from '../util/actions';
import { prisma } from '../util/prisma';
import Trello from '../util/trello';

export const action: ActionFunction = {
  type: ActionType.USER_CLEAR_DATA,
  async onAction(ctx, action) {
    const userData = await prisma.user.findUnique({
      where: { userID: action.user }
    });

    if (!userData)
      return void ctx.editParent('No user data was found.', { components: [] });

    try {
      if (userData.trelloToken) await new Trello(userData.trelloToken).invalidate();
    } catch (e) {}
    await prisma.user.delete({ where: { userID: action.user } });

    return void ctx.editParent('Removed user data.', { components: [] });
  }
};

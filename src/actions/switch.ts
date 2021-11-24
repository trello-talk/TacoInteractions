import { noAuthResponse, truncate } from '../util';
import { ActionFunction, ActionType } from '../util/actions';
import { prisma } from '../util/prisma';
import { TrelloBoard } from '../util/types';

export const action: ActionFunction = {
  type: ActionType.USER_SWITCH,
  async onAction(ctx, action, board: TrelloBoard) {
    const userData = await prisma.user.findUnique({
      where: { userID: action.user }
    });

    if (!userData) return void ctx.editParent(noAuthResponse);

    await prisma.user.update({
      where: { userID: action.user },
      data: { currentBoard: board.id }
    });

    return void ctx.editParent(`Switched to the "${truncate(board.name, 100)}" board.`, { components: [] });
  }
};

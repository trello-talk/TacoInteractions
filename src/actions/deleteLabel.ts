import { noAuthResponse } from '../util';
import { ActionFunction, ActionType } from '../util/actions';
import { uncacheBoard } from '../util/api';
import { createT } from '../util/locale';
import { prisma } from '../util/prisma';
import Trello from '../util/trello';

export const action: ActionFunction = {
  type: ActionType.DELETE_LABEL,
  async onAction(ctx, action) {
    const userData = await prisma.user.findUnique({
      where: { userID: action.user }
    });

    const t = createT(userData?.locale);
    if (!userData || !userData.trelloToken) return void ctx.editParent(noAuthResponse(t));
    if (!userData.currentBoard) return void ctx.editParent({ content: t('switch.no_board_command'), components: [] });

    // action.extra would be the label id
    await new Trello(userData.trelloToken).deleteLabel(action.extra);
    await uncacheBoard(userData.currentBoard);

    return void ctx.editParent(t('deletelabel.done'), { components: [] });
  }
};

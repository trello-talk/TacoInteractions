import { ComponentContext } from 'slash-create';

import { getData, noAuthResponse } from '../util';
import { ActionFunction, ActionType } from '../util/actions';
import { uncacheBoard } from '../util/api';

export const action: ActionFunction = {
  type: ActionType.DELETE_LABEL,
  async onAction(ctx: ComponentContext, action) {
    const { userData, t, trello } = await getData(ctx);
    if (!userData || !userData.trelloToken) return void ctx.editParent(noAuthResponse(t));
    if (!userData.currentBoard) return void ctx.editParent({ content: t('switch.no_board_command'), components: [] });

    // action.extra would be the label id
    await trello.deleteLabel(action.extra);
    await uncacheBoard(userData.currentBoard);

    return void ctx.editParent(t('deletelabel.done'), { components: [] });
  }
};

import { ComponentContext } from 'slash-create';
import { getData, noAuthResponse } from '../util';
import { ActionFunction, ActionType } from '../util/actions';
import { uncacheBoard, uncacheCard } from '../util/api';

export const action: ActionFunction = {
  type: ActionType.DELETE_CARD,
  async onAction(ctx: ComponentContext, action) {
    const { userData, t, trello } = await getData(ctx);
    if (!userData || !userData.trelloToken) return void ctx.editParent(noAuthResponse(t));
    if (!userData.currentBoard) return void ctx.editParent({ content: t('switch.no_board_command'), components: [] });

    // action.extra would be the card id
    await trello.deleteCard(action.extra);
    await uncacheBoard(userData.currentBoard);
    await uncacheCard(action.extra);

    return void ctx.editParent(t('deletecard.done'), { components: [] });
  }
};

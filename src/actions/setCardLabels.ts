import { ComponentContext } from 'slash-create';
import { getData, noAuthResponse } from '../util';
import { ActionFunction, ActionType } from '../util/actions';
import { uncacheBoard, uncacheCard } from '../util/api';
import { TrelloLabel } from '../util/types';

export const action: ActionFunction = {
  type: ActionType.SET_CARD_LABELS,
  requiresData: true,
  async onAction(ctx: ComponentContext, action, data: TrelloLabel[]) {
    const { userData, t, trello } = await getData(ctx);
    if (!userData || !userData.trelloToken) return void ctx.editParent(noAuthResponse(t));
    if (!userData.currentBoard)
      return void ctx.editParent({ content: t('switch.no_board_command'), components: [], embeds: [] });

    // action.extra would be the card id
    await trello.updateCard(action.extra, { idLabels: data.map((lb) => lb.id).join(',') });
    await uncacheBoard(userData.currentBoard);
    await uncacheCard(action.extra);

    return void ctx.editParent(t('edit.labels_updated'), { components: [], embeds: [] });
  }
};

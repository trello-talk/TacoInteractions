import { ButtonStyle, ComponentType, ModalInteractionContext } from 'slash-create';
import { getData, noAuthResponse, truncate } from '../util';
import { ActionFunction, ActionType } from '../util/actions';
import { uncacheBoard } from '../util/api';
import { TrelloCard } from '../util/types';

export const action: ActionFunction = {
  type: ActionType.CREATE_CARD,
  async onAction(ctx: ModalInteractionContext, action) {
    const { userData, t, trello } = await getData(ctx);
    if (!userData || !userData.trelloToken) return void ctx.send(noAuthResponse(t));
    if (!userData.currentBoard) return void ctx.send({ content: t('switch.no_board_command'), ephemeral: true });

    // action.extra would be the list id
    const name = ctx.values.name.trim();
    const response = await trello.addCard(action.extra, {
      name,
      ...(ctx.values.description ? { desc: ctx.values.description } : {})
    });
    const card = response.data as TrelloCard;
    await uncacheBoard(userData.currentBoard);

    return void ctx.send({
      content: t('addcard.done', { card: truncate(name, 100) }),
      ephemeral: true,
      components: [
        {
          type: ComponentType.ACTION_ROW,
          components: [
            {
              type: ComponentType.BUTTON,
              style: ButtonStyle.LINK,
              label: t('interactions.visit', { context: 'card' }),
              url: `${card.shortUrl}?utm_source=tacobot.app`
            }
          ]
        }
      ]
    });
  }
};

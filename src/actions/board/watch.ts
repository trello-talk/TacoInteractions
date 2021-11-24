import { noAuthResponse, truncate } from '../../util';
import { ActionFunction, ActionType } from '../../util/actions';
import { TrelloAPIError, updateBoardInMember } from '../../util/api';
import { prisma } from '../../util/prisma';
import Trello from '../../util/trello';
import { TrelloBoard } from '../../util/types';

export const action: ActionFunction = {
  type: ActionType.BOARD_WATCH,
  async onAction(ctx, action, board: TrelloBoard) {
    const userData = await prisma.user.findUnique({
      where: { userID: action.user }
    });

    if (!userData || !userData.trelloToken) return void ctx.editParent(noAuthResponse);

    const trello = new Trello(userData.trelloToken);

    try {
      const response = await trello.updateBoard(board.id, { subscribed: !board.subscribed });
      await updateBoardInMember(userData.trelloID, board.id, response.data);
    } catch (err) {
      if (err instanceof TrelloAPIError)
        return void ctx.sendFollowUp("An error occurred with Trello's API!\n" + err.toString());
      else return void ctx.sendFollowUp('An error occurred!\n' + err.toString());
    }

    return void ctx.editParent(`${board.subscribed ? 'Stopped' : 'Started'} watching the "${truncate(board.name, 100)}" board.`, { components: [] });
  }
};

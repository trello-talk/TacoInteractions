import { noAuthResponse, truncate } from '../../util';
import { ActionFunction, ActionType } from '../../util/actions';
import { TrelloAPIError, updateBoardInMember } from '../../util/api';
import { prisma } from '../../util/prisma';
import Trello from '../../util/trello';
import { TrelloBoard } from '../../util/types';

export const action: ActionFunction = {
  type: ActionType.BOARD_STAR,
  async onAction(ctx, action, board: TrelloBoard) {
    const userData = await prisma.user.findUnique({
      where: { userID: action.user }
    });

    if (!userData || !userData.trelloToken) return void ctx.editParent(noAuthResponse);

    const trello = new Trello(userData.trelloToken);

    try {
      if (board.starred) {
        const stars = await trello.getBoardStars(userData.trelloID)
        const star = stars.data.find(star => star.idBoard === board.id);
        if (!star) return void ctx.editParent("Could not find the board's star. Try again later.");
        await trello.unstarBoard(userData.trelloID, star.id);
      } else await trello.starBoard(userData.trelloID, board.id);
      await updateBoardInMember(userData.trelloID, board.id, { starred: !board.starred });
    } catch (err) {
      if (err instanceof TrelloAPIError)
        return void ctx.sendFollowUp("An error occurred with Trello's API!\n" + err.toString());
      else return void ctx.sendFollowUp('An error occurred!\n' + err.toString());
    }

    return void ctx.editParent(`${board.subscribed ? 'Unstarred' : 'Starred'} the "${truncate(board.name, 100)}" board.`, { components: [] });
  }
};

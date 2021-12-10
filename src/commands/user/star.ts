import { SlashCreator, CommandContext, AutocompleteContext, CommandOptionType } from 'slash-create';
import { prisma } from '../../util/prisma';
import SlashCommand from '../../command';
import { noAuthResponse, truncate } from '../../util';
import { getMember, starBoard, unstarBoard, updateBoardInMember } from '../../util/api';
import { createT } from '../../util/locale';

export default class StarCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'star',
      description: 'Star a board to put it at the top of your boards.',
      options: [
        {
          type: CommandOptionType.STRING,
          name: 'board',
          description: 'The board to star, defaults to the selected board.',
          autocomplete: true
        }
      ]
    });
  }

  async autocomplete(ctx: AutocompleteContext) {
    return this.autocompleteBoards(ctx, { filter: (b) => !b.closed });
  }

  async run(ctx: CommandContext) {
    const userData = await prisma.user.findUnique({
      where: { userID: ctx.user.id }
    });
    const t = createT(userData?.locale);
    if (!userData || !userData.trelloToken) return noAuthResponse(t);

    const member = await getMember(userData.trelloToken, userData.trelloID);

    let board = member.boards.find((b) => b.id === ctx.options.board || b.shortLink === ctx.options.board);
    if (!board) board = member.boards.find((b) => b.id === userData.currentBoard);
    if (!board) return t('query.not_found', { context: 'board' });

    if (board.starred) await unstarBoard(userData.trelloToken, userData.trelloID, board.id);
    else await starBoard(userData.trelloToken, userData.trelloID, board.id);
    await updateBoardInMember(member.id, board.id, { starred: !board.starred });

    return t(board.starred ? 'star.unstar' : 'star.star', { board: truncate(board.name, 100) });
  }
}

import { AutocompleteContext, CommandContext, CommandOptionType, SlashCreator } from 'slash-create';

import SlashCommand from '../../command';
import { defaultContexts, getData, noAuthResponse, truncate } from '../../util';
import { getMember, starBoard, unstarBoard, updateBoardInMember } from '../../util/api';

export default class StarCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'star',
      description: 'Star a board to put it at the top of your boards.',
      ...defaultContexts,
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
    const { userData, t } = await getData(ctx);
    if (!userData || !userData.trelloToken) return noAuthResponse(t);

    const member = await getMember(userData.trelloToken, userData.trelloID);

    let board = member.boards.find((b) => b.id === ctx.options.board || b.shortLink === ctx.options.board);
    if (!board) board = member.boards.find((b) => b.id === userData.currentBoard);
    if (!board) return t('query.not_found', { context: 'board' });

    if (board.starred) await unstarBoard(userData.trelloToken, userData.trelloID, board.id);
    else await starBoard(userData.trelloToken, userData.trelloID, board.id);
    await updateBoardInMember(member.id, board.id, { starred: !board.starred });

    return {
      content: t(board.starred ? 'star.unstar' : 'star.star', { board: truncate(board.name, 100) }),
      ephemeral: true
    }
  }
}

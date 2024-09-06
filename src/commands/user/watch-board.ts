import { AutocompleteContext, CommandContext, CommandOptionType, SlashCreator } from 'slash-create';

import SlashCommand from '../../command';
import { defaultContexts, getData, noAuthResponse, truncate } from '../../util';
import { getMember, updateBoardInMember } from '../../util/api';

export default class WatchBoardCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'watch-board',
      description: 'Subscribe to a board to get notifications on Trello.com.',
      ...defaultContexts,
      options: [
        {
          type: CommandOptionType.STRING,
          name: 'board',
          description: 'The board to watch, defaults to the selected board.',
          autocomplete: true
        }
      ]
    });
  }

  async autocomplete(ctx: AutocompleteContext) {
    return this.autocompleteBoards(ctx, { filter: (b) => !b.closed });
  }

  async run(ctx: CommandContext) {
    const { userData, t, trello } = await getData(ctx);
    if (!userData || !userData.trelloToken) return noAuthResponse(t);

    const member = await getMember(userData.trelloToken, userData.trelloID);

    let board = member.boards.find((b) => b.id === ctx.options.board || b.shortLink === ctx.options.board);
    if (!board) board = member.boards.find((b) => b.id === userData.currentBoard);
    if (!board) return t('query.not_found', { context: 'board' });

    const response = await trello.updateBoard(board.id, { subscribed: !board.subscribed });
    await updateBoardInMember(member.id, board.id, response.data);

    return {
      content: t(board.subscribed ? 'watchboard.unwatched' : 'watchboard.watched', { board: truncate(board.name, 100) }),
      ephemeral: true
    }
  }
}

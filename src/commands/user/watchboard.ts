import { SlashCreator, CommandContext, AutocompleteContext, CommandOptionType } from 'slash-create';
import { prisma } from '../../util/prisma';
import SlashCommand from '../../command';
import { noAuthResponse, truncate } from '../../util';
import { createQueryPrompt } from '../../util/prompt';
import { getMember, updateBoardInMember } from '../../util/api';
import { ActionType, createAction } from '../../util/actions';
import Trello from '../../util/trello';

export default class WatchBoardCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'watch-board',
      description: 'Subscribe to a board to get notifications on Trello.com.',
      options: [{
        type: CommandOptionType.STRING,
        name: 'board',
        description: 'The board to watch.',
        autocomplete: true,
        required: true
      }]
    });
  }

  async autocomplete(ctx: AutocompleteContext) {
    return this.autocompleteBoards(ctx, { filter: b => !b.closed });
  }

  async run(ctx: CommandContext) {
    const userData = await prisma.user.findUnique({
      where: { userID: ctx.user.id }
    });

    if (!userData || !userData.trelloToken) return noAuthResponse;

    const member = await getMember(userData.trelloToken, userData.trelloID);

    const board = member.boards.find(b => b.id === ctx.options.board || b.shortLink === ctx.options.board);
    if (board) {
      const trello = new Trello(userData.trelloToken);
      const response = await trello.updateBoard(board.id, { subscribed: !board.subscribed });
      await updateBoardInMember(member.id, board.id, response.data);

      return `${board.subscribed ? 'Stopped' : 'Started'} watching the "${truncate(board.name, 100)}" board.`;
    }

    const boards = member.boards.filter(b => !b.closed);
    if (!boards.length) return 'You have no boards to watch.';

    const action = await createAction(ActionType.BOARD_WATCH, ctx.user.id);
    await ctx.defer();
    await ctx.fetch();
    return await createQueryPrompt(
      {
        content: 'Select a board to watch.',
        placeholder: `Select a board... (${boards.length.toLocaleString()})`,
        values: boards,
        display: boards.map(b => ({
          label: truncate(b.name, 100),
          description: [
            b.starred ? 'Starred' : '',
            b.subscribed ? 'Watched' : '',
          ].filter(v => !!v).join(' & '),
          value: b.id
        })),
        action
      },
      ctx.messageID!
    );
  }
}

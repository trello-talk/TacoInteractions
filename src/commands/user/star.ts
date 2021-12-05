import { SlashCreator, CommandContext, AutocompleteContext, CommandOptionType } from 'slash-create';
import { prisma } from '../../util/prisma';
import SlashCommand from '../../command';
import { noAuthResponse, truncate } from '../../util';
import { createQueryPrompt } from '../../util/prompt';
import { getMember, starBoard, unstarBoard, updateBoardInMember } from '../../util/api';
import { ActionType, createAction } from '../../util/actions';
import { createT } from '../../util/locale';

// TODO localize
export default class StarCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'star',
      description: 'Star a board to put it at the top of your boards.',
      options: [{
        type: CommandOptionType.STRING,
        name: 'board',
        description: 'The board to star.',
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
    const t = createT(userData.locale);

    const board = member.boards.find(b => b.id === ctx.options.board || b.shortLink === ctx.options.board);
    if (board) {
      if (board.starred)
        await unstarBoard(userData.trelloToken, userData.trelloID, board.id); else
        await starBoard(userData.trelloToken, userData.trelloID, board.id);
      await updateBoardInMember(member.id, board.id, { starred: !board.starred });

      return `${board.starred ? 'Unstarred' : 'Starred'} the "${truncate(board.name, 100)}" board.`;
    }

    const boards = member.boards.filter(b => !b.closed);
    if (!boards.length) return 'You have no boards to star.';

    const action = await createAction(ActionType.BOARD_STAR, ctx.user.id);
    await ctx.defer();
    await ctx.fetch();
    return await createQueryPrompt(
      {
        content: 'Select a board to star.',
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
      ctx.messageID!, t
    );
  }
}

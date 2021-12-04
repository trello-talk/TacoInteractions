import { SlashCreator, CommandContext, AutocompleteContext, CommandOptionType } from 'slash-create';
import { prisma } from '../../util/prisma';
import SlashCommand from '../../command';
import { noAuthResponse, truncate } from '../../util';
import { getMember } from '../../util/api';

export default class BoardCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'board',
      description: 'View a Trello board.',
      options: [{
        type: CommandOptionType.STRING,
        name: 'board',
        description: 'The board to view, defaults to the selected board.',
        autocomplete: true
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

    let board = member.boards.find(b => b.id === ctx.options.board || b.shortLink === ctx.options.board);
    if (!board) board = member.boards.find(b => b.id === userData.currentBoard);
    if (!board) return 'No board was given, try selecting a board first.';
    
    const boardColor = board.prefs && board.prefs.backgroundTopColor ?
      parseInt(board.prefs.backgroundTopColor.slice(1), 16) : 0;
    const backgroundImg = board.prefs && board.prefs.backgroundImageScaled ?
      board.prefs.backgroundImageScaled.reverse()[1].url : null;

    // TODO add more board info
    return {
      embeds: [
        {
          title: truncate(board.name, 256),
          url: board.shortUrl,
          color: boardColor,
          description: board.desc ? truncate(board.desc, 4096) : undefined,
          image: backgroundImg ? { url: backgroundImg } : undefined,
        }
      ]
    };
  }
}

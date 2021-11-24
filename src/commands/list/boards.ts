import { SlashCreator, CommandContext, CommandOptionType } from 'slash-create';
import SlashCommand from '../../command';
import { noAuthResponse, splitMessage } from '../../util';
import { truncate } from '../../util';
import { getMember } from '../../util/api';
import { prisma } from '../../util/prisma';
import { createListPrompt } from '../../util/prompt';

enum TrelloBoardsFilter {
  ALL = 'All',
  OPEN = 'Open',
  ARCHIVED = 'Archived',
  WATCHED = 'Watched',
  STARRED = 'Starred',
}

export default class BoardsCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'boards',
      description: 'List Trello boards.',
      options: [{
        type: CommandOptionType.STRING,
        name: 'filter',
        description: 'Filter boards to list.',
        choices: [
          {
            name: 'All',
            value: TrelloBoardsFilter.ALL
          },
          {
            name: 'Open',
            value: TrelloBoardsFilter.OPEN
          },
          {
            name: 'Archived',
            value: TrelloBoardsFilter.ARCHIVED
          },
          {
            name: 'Watched',
            value: TrelloBoardsFilter.WATCHED
          },
          {
            name: 'Starred',
            value: TrelloBoardsFilter.STARRED
          }
        ]
      }]
    });
  }

  async run(ctx: CommandContext) {
    const userData = await prisma.user.findUnique({
      where: { userID: ctx.user.id }
    });

    if (!userData || !userData.trelloToken) return noAuthResponse;

    const member = await getMember(userData.trelloToken, userData.trelloID);

    let boards = member.boards;
    switch (ctx.options.filter as TrelloBoardsFilter) {
      case TrelloBoardsFilter.OPEN:
        boards = boards.filter(b => !b.closed);
        break;
      case TrelloBoardsFilter.ARCHIVED:
        boards = boards.filter(b => b.closed);
        break;
      case TrelloBoardsFilter.WATCHED:
        boards = boards.filter(b => b.subscribed);
        break;
      case TrelloBoardsFilter.STARRED:
        boards = boards.filter(b => b.starred);
        break;
    }
    if (!boards.length) return 'No boards to list.';

    await ctx.defer();
    await ctx.fetch();
    return await createListPrompt(
      {
        title: `Boards (${boards.length.toLocaleString()})`,
        pages: splitMessage(boards.map(
          (board) =>
            `${board.closed ? '🗃️ ' : ''}${board.subscribed ? '🔔 ' : ''}${board.starred ? '⭐ ' : ''}\`${
              board.shortLink
            }\` ${truncate(board.name, 50)}`
        ).join('\n'), { maxLength: 4096 })
      },
      ctx.messageID!
    );
  }
}

import { SlashCreator, CommandContext, CommandOptionType } from 'slash-create';
import SlashCommand from '../../command';
import { noAuthResponse, splitMessage } from '../../util';
import { truncate } from '../../util';
import { getMember } from '../../util/api';
import { createT, formatNumber } from '../../util/locale';
import { prisma } from '../../util/prisma';
import { createListPrompt } from '../../util/prompt';

enum TrelloBoardsFilter {
  ALL = 'All',
  OPEN = 'Open',
  ARCHIVED = 'Archived',
  WATCHED = 'Watched',
  STARRED = 'Starred'
}

export default class BoardsCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'boards',
      description: 'List Trello boards.',
      options: [
        {
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
        }
      ]
    });
  }

  async run(ctx: CommandContext) {
    const userData = await prisma.user.findUnique({
      where: { userID: ctx.user.id }
    });
    const t = createT(userData?.locale);
    if (!userData || !userData.trelloToken) return noAuthResponse(t);

    const member = await getMember(userData.trelloToken, userData.trelloID);

    let boards = member.boards;
    const filter: TrelloBoardsFilter = ctx.options.filter || TrelloBoardsFilter.OPEN;
    switch (filter) {
      case TrelloBoardsFilter.OPEN:
        boards = boards.filter((b) => !b.closed);
        break;
      case TrelloBoardsFilter.ARCHIVED:
        boards = boards.filter((b) => b.closed);
        break;
      case TrelloBoardsFilter.WATCHED:
        boards = boards.filter((b) => b.subscribed);
        break;
      case TrelloBoardsFilter.STARRED:
        boards = boards.filter((b) => b.starred);
        break;
    }
    if (!boards.length) return t('query.no_list', { context: 'board' });

    await ctx.defer();
    await ctx.fetch();
    return await createListPrompt(
      {
        title: `${t('boards.list', { context: filter.toLowerCase() })} (${formatNumber(
          boards.length,
          userData.locale
        )})`,
        pages: splitMessage(
          boards
            .map(
              (board) =>
                `${board.closed ? '🗃️ ' : ''}${board.subscribed ? '🔔 ' : ''}${board.starred ? '⭐ ' : ''} [${truncate(
                  board.name,
                  50
                )}](${board.shortUrl})`
            )
            .join('\n')
        )
      },
      ctx.messageID!,
      t
    );
  }
}

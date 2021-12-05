import { SlashCreator, CommandContext, CommandOptionType } from 'slash-create';
import SlashCommand from '../../command';
import { noAuthResponse, splitMessage } from '../../util';
import { truncate } from '../../util';
import { getBoard } from '../../util/api';
import { createT } from '../../util/locale';
import { prisma } from '../../util/prisma';
import { createListPrompt } from '../../util/prompt';

enum TrelloListsFilter {
  ALL = 'All',
  OPEN = 'Open',
  ARCHIVED = 'Archived',
  WATCHED = 'Watched'
}

export default class ListsCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'lists',
      description: 'List Trello lists on your selected board.',
      options: [{
        type: CommandOptionType.STRING,
        name: 'filter',
        description: 'Filter lists to list.',
        choices: [
          {
            name: 'All',
            value: TrelloListsFilter.ALL
          },
          {
            name: 'Open',
            value: TrelloListsFilter.OPEN
          },
          {
            name: 'Archived',
            value: TrelloListsFilter.ARCHIVED
          },
          {
            name: 'Watched',
            value: TrelloListsFilter.WATCHED
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

    const [board, subs] = await getBoard(userData.trelloToken, userData.currentBoard, userData.trelloID, true);
    const t = createT(userData.locale);

    let lists = board.lists;
    switch (ctx.options.filter as TrelloListsFilter) {
      case TrelloListsFilter.ALL:
        break;
      case TrelloListsFilter.ARCHIVED:
        lists = lists.filter(l => l.closed);
        break;
      case TrelloListsFilter.WATCHED:
        lists = lists.filter(l => subs.lists[l.id] || l.subscribed);
        break;
      case TrelloListsFilter.OPEN:
      default:
        lists = lists.filter(l => !l.closed);
        break;
    }
    if (!lists.length) return t('query.no_list', { context: 'list' });

    await ctx.defer();
    await ctx.fetch();
    return await createListPrompt(
      {
        title: `${t('common.lists')} (${lists.length.toLocaleString(userData.locale)})`,
        pages: splitMessage(lists.map(
          (list) =>
            `${list.closed ? '🗃️ ' : ''}${subs.lists[list.id] || list.subscribed ? '🔔 ' : ''} ${truncate(list.name, 50)} (${board.cards.filter(c => c.idList == list.id).length.toLocaleString()} card[s])`
        ).join('\n'), { maxLength: 4096 })
      },
      ctx.messageID!,
      t
    );
  }
}

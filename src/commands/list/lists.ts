import { CommandContext, CommandOptionType, SlashCreator } from 'slash-create';

import SlashCommand from '../../command';
import { defaultContexts, getData, noAuthResponse, splitMessage, truncate } from '../../util';
import { getBoard } from '../../util/api';
import { formatNumber } from '../../util/locale';
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
      ...defaultContexts,
      options: [
        {
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
        }
      ]
    });
  }

  async run(ctx: CommandContext) {
    const { userData, t, locale } = await getData(ctx);
    if (!userData || !userData.trelloToken) return noAuthResponse(t);
    if (!userData.currentBoard) return { content: t('switch.no_board_command'), ephemeral: true };

    const [board, subs] = await getBoard(userData.trelloToken, userData.currentBoard, userData.trelloID, true);

    let lists = board.lists;
    const filter: TrelloListsFilter = ctx.options.filter || TrelloListsFilter.OPEN;
    switch (filter) {
      case TrelloListsFilter.ALL:
        break;
      case TrelloListsFilter.ARCHIVED:
        lists = lists.filter((l) => l.closed);
        break;
      case TrelloListsFilter.WATCHED:
        lists = lists.filter((l) => subs.lists[l.id] || l.subscribed);
        break;
      case TrelloListsFilter.OPEN:
        lists = lists.filter((l) => !l.closed);
        break;
    }
    if (!lists.length) return t('query.no_list', { context: 'list' });

    await ctx.defer();
    await ctx.fetch();
    return await createListPrompt(
      {
        title: `${t('lists.list', { context: filter.toLowerCase() })} (${formatNumber(lists.length, locale)})`,
        pages: splitMessage(
          lists
            .map(
              (list) =>
                `${list.closed ? '🗃️ ' : ''}${subs.lists[list.id] || list.subscribed ? '🔔 ' : ''} ${truncate(list.name, 50)} (${formatNumber(
                  board.cards.filter((c) => c.idList == list.id).length,
                  locale
                )} card[s])`
            )
            .join('\n'),
          { maxLength: 1000 }
        )
      },
      ctx.messageID!,
      t,
      locale
    );
  }
}

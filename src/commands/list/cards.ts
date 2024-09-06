import { CommandContext, CommandOptionType, SlashCreator } from 'slash-create';

import SlashCommand from '../../command';
import { defaultContexts, getData, noAuthResponse, splitMessage, truncate } from '../../util';
import { getBoard } from '../../util/api';
import { formatNumber } from '../../util/locale';
import { createListPrompt } from '../../util/prompt';

enum TrelloCardsFilter {
  ALL = 'All',
  OPEN = 'Open',
  ARCHIVED = 'Archived',
  WATCHED = 'Watched',
  OVERDUE = 'Overdue',
  LABELS = 'Labels',
  NO_LABELS = 'No_Labels'
}

export default class CardsCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'cards',
      description: 'List Trello cards on your selected board.',
      ...defaultContexts,
      options: [
        {
          type: CommandOptionType.STRING,
          name: 'filter',
          description: 'Filter cards to list.',
          choices: [
            {
              name: 'All',
              value: TrelloCardsFilter.ALL
            },
            {
              name: 'Open',
              value: TrelloCardsFilter.OPEN
            },
            {
              name: 'Archived',
              value: TrelloCardsFilter.ARCHIVED
            },
            {
              name: 'Watched',
              value: TrelloCardsFilter.WATCHED
            },
            {
              name: 'Overdue',
              value: TrelloCardsFilter.OVERDUE
            },
            {
              name: 'With Labels',
              value: TrelloCardsFilter.LABELS
            },
            {
              name: 'Without Labels',
              value: TrelloCardsFilter.NO_LABELS
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

    let cards = board.cards;
    const filter: TrelloCardsFilter = ctx.options.filter || TrelloCardsFilter.OPEN;
    switch (filter) {
      case TrelloCardsFilter.ALL:
        break;
      case TrelloCardsFilter.OPEN:
        cards = cards.filter((c) => !c.closed);
        break;
      case TrelloCardsFilter.ARCHIVED:
        cards = cards.filter((c) => c.closed);
        break;
      case TrelloCardsFilter.WATCHED:
        cards = cards.filter((c) => subs.cards[c.id] || c.subscribed);
        break;
      case TrelloCardsFilter.OVERDUE:
        cards = cards.filter((c) => c.due && Date.now() > new Date(c.due).valueOf() && !c.closed && !c.dueComplete);
        break;
      case TrelloCardsFilter.LABELS:
        cards = cards.filter((c) => c.idLabels.length);
        break;
      case TrelloCardsFilter.NO_LABELS:
        cards = cards.filter((c) => !c.idLabels.length);
        break;
    }
    if (!cards.length) return t('query.no_list', { context: 'card' });

    await ctx.defer();
    await ctx.fetch();
    return await createListPrompt(
      {
        title: `${t('cards.list', { context: filter.toLowerCase() })} (${formatNumber(cards.length, locale)})`,
        pages: splitMessage(
          cards
            .map(
              (card) =>
                `${card.closed ? '🗃️ ' : ''}${subs.cards[card.id] || card.subscribed ? '🔔 ' : ''} [${truncate(
                  card.name,
                  25
                )}](https://trello.com/c/${card.shortLink}?utm_source=tacobot.app "${truncate(card.name, 50)}") (${truncate(
                  board.lists.find((l) => l.id === card.idList).name,
                  25
                )})`
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

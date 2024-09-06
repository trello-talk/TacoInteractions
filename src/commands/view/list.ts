import { AutocompleteContext, CommandContext, CommandOptionType, SlashCreator } from 'slash-create';

import SlashCommand from '../../command';
import { defaultContexts, getData, noAuthResponse, sortCards, splitMessage, truncate } from '../../util';
import { getBoard } from '../../util/api';
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

export default class ListCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'list',
      description: 'View cards in a Trello list on your selected board.',
      ...defaultContexts,
      options: [
        {
          type: CommandOptionType.STRING,
          name: 'list',
          description: 'The list to view.',
          autocomplete: true,
          required: true
        },
        {
          type: CommandOptionType.STRING,
          name: 'card_filter',
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

  async autocomplete(ctx: AutocompleteContext) {
    return this.autocompleteLists(ctx);
  }

  async run(ctx: CommandContext) {
    const { userData, t, locale } = await getData(ctx);
    if (!userData || !userData.trelloToken) return noAuthResponse(t);
    if (!userData.currentBoard) return { content: t('switch.no_board_command'), ephemeral: true };

    const [board, subs] = await getBoard(userData.trelloToken, userData.currentBoard, userData.trelloID, true);

    const list = board.lists.find((l) => l.id === ctx.options.list || l.name === ctx.options.list);
    if (list) {
      let cards = sortCards(board.cards.filter((c) => c.idList === list.id));
      const filter: TrelloCardsFilter = ctx.options.card_filter || TrelloCardsFilter.OPEN;
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

      if (!cards.length)
        return {
          embeds: [
            {
              title: t('list.title', { label: truncate(list.name, 100), cards: 0 }),
              description: `*${t('list.none')}*`
            }
          ]
        };

      await ctx.defer();
      await ctx.fetch();
      return await createListPrompt(
        {
          title: t('list.title', { list: truncate(list.name, 100), cards: cards.length }),
          pages: splitMessage(
            cards
              .map((card) => `${card.closed ? '🗃️ ' : ''}${subs.cards[card.id] || card.subscribed ? '🔔 ' : ''} ${truncate(card.name, 100)}`)
              .join('\n')
          )
        },
        ctx.messageID!,
        t,
        locale
      );
    }

    return t('query.not_found', { context: 'list' });
  }
}

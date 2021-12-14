import { SlashCreator, CommandContext, AutocompleteContext, CommandOptionType } from 'slash-create';
import SlashCommand from '../../command';
import { getData, noAuthResponse, truncate } from '../../util';
import { getBoard, updateBoardSub } from '../../util/api';

export default class WatchCardCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'watch-card',
      description: 'Subscribe to a card to get notifications on Trello.com.',
      options: [
        {
          type: CommandOptionType.STRING,
          name: 'card',
          description: 'The card to watch.',
          autocomplete: true,
          required: true
        }
      ]
    });
  }

  async autocomplete(ctx: AutocompleteContext) {
    return this.autocompleteCards(ctx, { filter: (c) => !c.closed });
  }

  async run(ctx: CommandContext) {
    const { userData, t, trello } = await getData(ctx);
    if (!userData || !userData.trelloToken) return noAuthResponse(t);
    if (!userData.currentBoard) return { content: t('switch.no_board_command'), ephemeral: true };

    const [board, subs] = await getBoard(userData.trelloToken, userData.currentBoard, userData.trelloID, true);
    const card = board.cards.find((c) => c.id === ctx.options.card || c.shortLink === ctx.options.card);
    if (!card) return t('query.not_found', { context: 'card' });

    const subbed = !subs.cards[card.id];
    await trello.updateCard(card.id, { subscribed: subbed });
    await updateBoardSub(userData.trelloID, board.id, card.id, 'card', subbed);

    return t(subbed ? 'watchcard.watched' : 'watchcard.unwatched', { card: truncate(card.name, 100) });
  }
}

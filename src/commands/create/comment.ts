import { AutocompleteContext, ButtonStyle, CommandContext, CommandOptionType, ComponentType, SlashCreator } from 'slash-create';

import SlashCommand from '../../command';
import { defaultContexts, getData, noAuthResponse, truncate } from '../../util';
import { getBoard } from '../../util/api';

export default class CommentCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'comment',
      description: 'Comment on a card.',
      ...defaultContexts,
      options: [
        {
          type: CommandOptionType.STRING,
          name: 'card',
          description: 'The card to comment on.',
          autocomplete: true,
          required: true
        },
        {
          type: CommandOptionType.STRING,
          name: 'message',
          description: 'The message to comment.',
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

    const [board] = await getBoard(userData.trelloToken, userData.currentBoard, userData.trelloID);
    const card = board.cards.find((c) => c.id === ctx.options.card || c.shortLink === ctx.options.card);
    if (!card) return t('query.not_found', { context: 'card' });

    await trello.addComment(card.id, ctx.options.message);

    return {
      content: t('comment.commented', { card: truncate(card.name, 100) }),
      components: [
        {
          type: ComponentType.ACTION_ROW,
          components: [
            {
              type: ComponentType.BUTTON,
              style: ButtonStyle.LINK,
              label: t('interactions.visit', { context: 'card' }),
              url: `https://trello.com/c/${card.shortLink}?utm_source=tacobot.app`
            }
          ]
        }
      ]
    };
  }
}

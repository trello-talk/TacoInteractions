import { AutocompleteContext, ButtonStyle, CommandContext, CommandOptionType, ComponentType, SlashCreator } from 'slash-create';

import SlashCommand from '../../command';
import { defaultContexts, getData, noAuthResponse, truncate } from '../../util';
import { ActionType } from '../../util/actions';
import { getBoard } from '../../util/api';

export default class DeleteCardCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'delete-card',
      description: 'Delete a card from your selected board.',
      ...defaultContexts,
      options: [
        {
          type: CommandOptionType.STRING,
          name: 'card',
          description: 'The card to delete.',
          autocomplete: true,
          required: true
        }
      ]
    });
  }

  async autocomplete(ctx: AutocompleteContext) {
    return this.autocompleteCards(ctx);
  }

  async run(ctx: CommandContext) {
    const { userData, t } = await getData(ctx);
    if (!userData || !userData.trelloToken) return noAuthResponse(t);
    if (!userData.currentBoard) return { content: t('switch.no_board_command'), ephemeral: true };

    const [board] = await getBoard(userData.trelloToken, userData.currentBoard, userData.trelloID);

    const card = board.cards.find((c) => c.id === ctx.options.card || c.shortLink === ctx.options.card);
    if (!card) return t('query.not_found', { context: 'card' });

    return {
      content: t('deletecard.confirm', { card: truncate(card.name, 100) }),
      components: [
        {
          type: ComponentType.ACTION_ROW,
          components: [
            {
              type: ComponentType.BUTTON,
              style: ButtonStyle.DESTRUCTIVE,
              label: t('common.yes'),
              custom_id: `action::${ActionType.DELETE_CARD}:${card.id}`
            },
            {
              type: ComponentType.BUTTON,
              style: ButtonStyle.SECONDARY,
              label: t('common.no'),
              custom_id: 'delete'
            }
          ]
        }
      ]
    };
  }
}

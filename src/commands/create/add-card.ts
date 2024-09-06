import { AutocompleteContext, CommandContext, CommandOptionType, ComponentType, SlashCreator, TextInputStyle } from 'slash-create';

import SlashCommand from '../../command';
import { defaultContexts, getData, noAuthResponse } from '../../util';
import { ActionType } from '../../util/actions';
import { getBoard } from '../../util/api';

export default class AddCardCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'add-card',
      description: 'Create a card on your selected board.',
      ...defaultContexts,
      options: [
        {
          type: CommandOptionType.STRING,
          name: 'list',
          description: 'The list to create your card in.',
          autocomplete: true,
          required: true
        }
      ]
    });
  }

  async autocomplete(ctx: AutocompleteContext) {
    return this.autocompleteLists(ctx, { filter: (l) => !l.closed });
  }

  async run(ctx: CommandContext) {
    const { userData, t } = await getData(ctx);
    if (!userData || !userData.trelloToken) return noAuthResponse(t);
    if (!userData.currentBoard) return { content: t('switch.no_board_command'), ephemeral: true };

    const [board] = await getBoard(userData.trelloToken, userData.currentBoard, userData.trelloID);
    // NOTE: we can't check per list, so this might fail anyways.
    if (board.cards.filter((c) => !c.closed).length >= 5000 || board.cards.length >= 2000000)
      return { content: t('addcard.limited'), ephemeral: true };

    const list = board.lists.find((l) => l.id === ctx.options.list || l.name === ctx.options.list);
    if (!list) return t('query.not_found', { context: 'list' });

    await ctx.sendModal({
      title: t('addcard.modal_title'),
      custom_id: `action::${ActionType.CREATE_CARD}:${list.id}`,
      components: [
        {
          type: ComponentType.ACTION_ROW,
          components: [
            {
              type: ComponentType.TEXT_INPUT,
              label: t('common.name'),
              style: TextInputStyle.SHORT,
              custom_id: 'name',
              placeholder: t('common.empty_input'),
              required: true
            }
          ]
        },
        {
          type: ComponentType.ACTION_ROW,
          components: [
            {
              type: ComponentType.TEXT_INPUT,
              label: t('common.description'),
              style: TextInputStyle.PARAGRAPH,
              custom_id: 'description',
              placeholder: t('common.empty_input'),
              required: false
            }
          ]
        }
      ]
    });
  }
}

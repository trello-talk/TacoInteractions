import { AutocompleteContext, ButtonStyle, CommandContext, CommandOptionType, ComponentType, SlashCreator } from 'slash-create';

import SlashCommand from '../../command';
import { defaultContexts, getData, noAuthResponse, truncate } from '../../util';
import { ActionType } from '../../util/actions';
import { getBoard } from '../../util/api';
import { manager } from '../../util/emojiManager';

export default class DeleteLabelCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'delete-label',
      description: 'Delete a label from your selected board.',
      ...defaultContexts,
      options: [
        {
          type: CommandOptionType.STRING,
          name: 'label',
          description: 'The label to delete.',
          autocomplete: true,
          required: true
        }
      ]
    });
  }

  async autocomplete(ctx: AutocompleteContext) {
    return this.autocompleteLabels(ctx);
  }

  async run(ctx: CommandContext) {
    const { userData, t } = await getData(ctx);
    if (!userData || !userData.trelloToken) return noAuthResponse(t);
    if (!userData.currentBoard) return { content: t('switch.no_board_command'), ephemeral: true };

    const [board] = await getBoard(userData.trelloToken, userData.currentBoard, userData.trelloID);

    const label = board.labels.find((l) => l.id === ctx.options.label);
    if (!label) return t('query.not_found', { context: 'label' });

    return {
      content: t('deletelabel.confirm', {
        label: `${manager.getMarkdown(ctx.options.color ? (`label_${ctx.options.color}` as any) : 'label_none')} ${truncate(label.name, 100)}`
      }),
      components: [
        {
          type: ComponentType.ACTION_ROW,
          components: [
            {
              type: ComponentType.BUTTON,
              style: ButtonStyle.DESTRUCTIVE,
              label: t('common.yes'),
              custom_id: `action::${ActionType.DELETE_LABEL}:${label.id}`
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

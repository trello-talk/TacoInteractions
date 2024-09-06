import { AutocompleteContext, CommandContext, CommandOptionType, SlashCreator } from 'slash-create';

import SlashCommand from '../../command';
import { defaultContexts, getData, noAuthResponse, stripIndentsAndNewlines, truncate } from '../../util';
import { getBoard, uncacheBoard } from '../../util/api';
import { LABEL_EMOJIS } from '../../util/constants';

export default class EditLabelCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'edit-label',
      description: 'Edit a label from your selected board.',
      ...defaultContexts,
      options: [
        {
          type: CommandOptionType.STRING,
          name: 'label',
          description: 'The label to edit.',
          autocomplete: true,
          required: true
        },
        {
          type: CommandOptionType.STRING,
          name: 'name',
          description: 'The new name of your label.'
        },
        {
          type: CommandOptionType.STRING,
          name: 'color',
          description: 'The new color of your label.',
          choices: [
            {
              name: 'No Color',
              value: 'none'
            },
            {
              name: 'Red',
              value: 'red'
            },
            {
              name: 'Orange',
              value: 'orange'
            },
            {
              name: 'Yellow',
              value: 'yellow'
            },
            {
              name: 'Lime Green',
              value: 'lime'
            },
            {
              name: 'Green',
              value: 'green'
            },
            {
              name: 'Sky Blue',
              value: 'sky'
            },
            {
              name: 'Blue',
              value: 'blue'
            },
            {
              name: 'Purple',
              value: 'purple'
            },
            {
              name: 'Pink',
              value: 'pink'
            },
            {
              name: 'Black',
              value: 'black'
            }
          ]
        }
      ]
    });
  }

  async autocomplete(ctx: AutocompleteContext) {
    return this.autocompleteLabels(ctx);
  }

  async run(ctx: CommandContext) {
    const { userData, t, trello } = await getData(ctx);
    if (!userData || !userData.trelloToken) return noAuthResponse(t);
    if (!userData.currentBoard) return { content: t('switch.no_board_command'), ephemeral: true };

    const [board] = await getBoard(userData.trelloToken, userData.currentBoard, userData.trelloID);

    const label = board.labels.find((l) => l.id === ctx.options.label);
    if (!label) return t('query.not_found', { context: 'label' });

    const color = ctx.options.color === 'none' ? null : ctx.options.color;
    if (color === undefined && !ctx.options.name) return t('edit.no_edit');

    await trello.updateLabel(label.id, {
      ...(ctx.options.name ? { name: ctx.options.name } : {}),
      ...(color !== undefined ? { color } : {})
    });
    await uncacheBoard(userData.currentBoard);

    return stripIndentsAndNewlines`
      ${t('edit.header', {
        context: 'label',
        name: `${label.color ? LABEL_EMOJIS[label.color.split('_')[0]] : LABEL_EMOJIS.none} ${label.name ? truncate(label.name, 100) : '*[unnamed]*'}`
      })}
      ${ctx.options.name ? t('edit.rename', { name: ctx.options.name }) : ''}
      ${
        color !== undefined
          ? t('edit.recolor', {
              color: `${color ? LABEL_EMOJIS[color.split('_')[0]] : LABEL_EMOJIS.none} ${t(`common.label_color.${color || 'none'}`)}`
            })
          : ''
      }
    `;
  }
}

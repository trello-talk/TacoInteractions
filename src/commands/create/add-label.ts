import { CommandContext, CommandOptionType, SlashCreator } from 'slash-create';

import SlashCommand from '../../command';
import { getData, noAuthResponse, truncate } from '../../util';
import { getBoard, uncacheBoard } from '../../util/api';
import { LABEL_EMOJIS } from '../../util/constants';

export default class AddLabelCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'add-label',
      description: 'Create a label on your selected board.',
      options: [
        {
          type: CommandOptionType.STRING,
          name: 'name',
          description: 'The name of your new label.',
          required: true
        },
        {
          type: CommandOptionType.STRING,
          name: 'color',
          description: 'The color of your new label.',
          choices: [
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

  async run(ctx: CommandContext) {
    const { userData, t, trello } = await getData(ctx);
    if (!userData || !userData.trelloToken) return noAuthResponse(t);
    if (!userData.currentBoard) return { content: t('switch.no_board_command'), ephemeral: true };

    const [board] = await getBoard(userData.trelloToken, userData.currentBoard, userData.trelloID);
    if (board.labels.length >= 800) return { content: t('addlabel.limited'), ephemeral: true };

    const name = ctx.options.name.trim();
    await trello.addLabel(userData.currentBoard, { name, color: ctx.options.color });
    await uncacheBoard(userData.currentBoard);

    return t('addlabel.done', {
      label: `${ctx.options.color ? LABEL_EMOJIS[ctx.options.color] : LABEL_EMOJIS.none} ${truncate(name, 100)}`
    });
  }
}

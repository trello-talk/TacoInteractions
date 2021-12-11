import { SlashCreator, CommandContext, CommandOptionType } from 'slash-create';
import { prisma } from '../../util/prisma';
import SlashCommand from '../../command';
import { noAuthResponse, truncate } from '../../util';
import { uncacheBoard } from '../../util/api';
import Trello from '../../util/trello';
import { createT } from '../../util/locale';
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
    const userData = await prisma.user.findUnique({
      where: { userID: ctx.user.id }
    });
    const t = createT(userData?.locale);
    if (!userData || !userData.trelloToken) return noAuthResponse(t);
    if (!userData.currentBoard) return { content: t('switch.no_board_command'), ephemeral: true };

    const trello = new Trello(userData.trelloToken);
    const name = ctx.options.name.trim();
    await trello.addLabel(userData.currentBoard, { name, color: ctx.options.color });
    await uncacheBoard(userData.currentBoard);

    return t('addlabel.done', {
      label: `${ctx.options.color ? LABEL_EMOJIS[ctx.options.color] : LABEL_EMOJIS.none} ${truncate(name, 100)}`
    });
  }
}

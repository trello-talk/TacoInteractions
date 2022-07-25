import { CommandContext, CommandOptionType, SlashCreator } from 'slash-create';

import SlashCommand from '../../command';
import { getData, noAuthResponse, truncate } from '../../util';
import { getBoard, uncacheBoard } from '../../util/api';

// TODO add position option (left, right)
export default class AddListCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'add-list',
      description: 'Create a list on your selected board.',
      options: [
        {
          type: CommandOptionType.STRING,
          name: 'name',
          description: 'The name of your new list.',
          required: true
        }
      ]
    });
  }

  async run(ctx: CommandContext) {
    const { userData, t, trello } = await getData(ctx);
    if (!userData || !userData.trelloToken) return noAuthResponse(t);
    if (!userData.currentBoard) return { content: t('switch.no_board_command'), ephemeral: true };

    const [board] = await getBoard(userData.trelloToken, userData.currentBoard, userData.trelloID);
    if (board.lists.length >= 400) return { content: t('addlist.limited'), ephemeral: true };

    const name = ctx.options.name.trim();
    await trello.addList(userData.currentBoard, name);
    await uncacheBoard(userData.currentBoard);

    return t('addlist.done', { list: truncate(name, 100) });
  }
}

import { AutocompleteContext, CommandContext, CommandOptionType, SlashCreator } from 'slash-create';

import SlashCommand from '../../command';
import { getData, noAuthResponse, truncate } from '../../util';
import { getMember } from '../../util/api';
import { prisma } from '../../util/prisma';

export default class SwitchCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'switch',
      description: 'Switch your board context to interact with board elements.',
      options: [
        {
          type: CommandOptionType.STRING,
          name: 'board',
          description: 'The board to switch to.',
          autocomplete: true,
          required: true
        }
      ]
    });
  }

  async autocomplete(ctx: AutocompleteContext) {
    return this.autocompleteBoards(ctx, { filter: (b) => !b.closed });
  }

  async run(ctx: CommandContext) {
    const { userData, t } = await getData(ctx);
    if (!userData || !userData.trelloToken) return noAuthResponse(t);

    const member = await getMember(userData.trelloToken, userData.trelloID);

    const board = member.boards.find((b) => b.id === ctx.options.board || b.shortLink === ctx.options.board);
    if (!board) return t('switch.not_found');

    await prisma.user.update({
      where: { userID: ctx.user.id },
      data: { currentBoard: board.id }
    });

    return t('switch.success', { board: truncate(board.name, 100) });
  }
}

import { SlashCreator, CommandContext, AutocompleteContext, CommandOptionType } from 'slash-create';
import SlashCommand from '../../command';
import { noAuthResponse, stripIndentsAndNewlines, truncate } from '../../util';
import { getBoard, uncacheBoard } from '../../util/api';
import { createT } from '../../util/locale';
import { prisma } from '../../util/prisma';
import Trello from '../../util/trello';

export default class EditListCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'edit-list',
      description: 'Edit a list from your selected board.',
      options: [
        {
          type: CommandOptionType.STRING,
          name: 'list',
          description: 'The list to edit.',
          autocomplete: true,
          required: true
        },
        {
          type: CommandOptionType.STRING,
          name: 'name',
          description: 'The new name of your list.'
        },
        {
          type: CommandOptionType.BOOLEAN,
          name: 'archive',
          description: 'Whether to archive (or unarchive) the list.'
        }
      ]
    });
  }

  async autocomplete(ctx: AutocompleteContext) {
    return this.autocompleteLists(ctx);
  }

  async run(ctx: CommandContext) {
    const userData = await prisma.user.findUnique({
      where: { userID: ctx.user.id }
    });
    const t = createT(userData?.locale);
    if (!userData || !userData.trelloToken) return noAuthResponse(t);
    if (!userData.currentBoard) return { content: t('switch.no_board_command'), ephemeral: true };

    const [board] = await getBoard(userData.trelloToken, userData.currentBoard, userData.trelloID);

    const list = board.lists.find((l) => l.id === ctx.options.list || l.name === ctx.options.list);
    if (!list) return t('query.not_found', { context: 'list' });

    if (ctx.options.archive === undefined && !ctx.options.name) return t('edit.no_edit');

    await new Trello(userData.trelloToken).updateList(list.id, {
      ...(ctx.options.name ? { name: ctx.options.name } : {}),
      ...(ctx.options.archive !== undefined ? { closed: ctx.options.archive } : {})
    });
    await uncacheBoard(userData.currentBoard);

    return stripIndentsAndNewlines`
      ${t('edit.header', { context: 'list', name: truncate(list.name, 100) })}
      ${ctx.options.name ? t('edit.rename', { name: ctx.options.name }) : ''}
      ${ctx.options.archive !== undefined ? t(`edit.${ctx.options.archive ? 'archive' : 'unarchive'}`) : ''}
    `;
  }
}

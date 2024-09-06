import { AutocompleteContext, ButtonStyle, CommandContext, CommandOptionType, ComponentType, SlashCreator } from 'slash-create';

import SlashCommand from '../../command';
import { defaultContexts, getData, noAuthResponse, stripIndentsAndNewlines, truncate } from '../../util';
import { getBoard, getMember, uncacheBoard, uncacheMember } from '../../util/api';

export default class EditBoardCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'edit-board',
      description: 'Edit a board.',
      ...defaultContexts,
      options: [
        {
          type: CommandOptionType.STRING,
          name: 'board',
          description: 'The board to edit. Defaults to the selected board.',
          autocomplete: true
        },
        {
          type: CommandOptionType.STRING,
          name: 'name',
          description: 'The new name of your board.'
        },
        {
          type: CommandOptionType.STRING,
          name: 'description',
          description: 'The new description of your board. Use "none" to remove the description.'
        }
      ]
    });
  }

  async autocomplete(ctx: AutocompleteContext) {
    return this.autocompleteBoards(ctx);
  }

  async run(ctx: CommandContext) {
    const { userData, t, trello } = await getData(ctx);
    if (!userData || !userData.trelloToken) return noAuthResponse(t);

    let boardID = ctx.options.board || userData.currentBoard;

    if ((!ctx.options.board || /^[a-f0-9]{24}$/.test(ctx.options.board)) && !userData.currentBoard) return t('query.not_found', { context: 'board' });

    if (ctx.options.board) {
      const member = await getMember(userData.trelloToken, userData.trelloID);
      let board = member.boards.find((b) => b.id === ctx.options.board || b.shortLink === ctx.options.board);
      if (!board) board = member.boards.find((b) => b.id === userData.currentBoard);
      if (!board) return t('query.not_found', { context: 'board' });
      boardID = board.id;
    }

    const [board] = await getBoard(userData.trelloToken, boardID, userData.trelloID);

    if (!ctx.options.description && !ctx.options.name) return t('edit.no_edit');

    try {
      await trello.updateBoard(boardID, {
        ...(ctx.options.name ? { name: ctx.options.name } : {}),
        ...(ctx.options.description ? { desc: ctx.options.description === 'none' ? '' : ctx.options.description } : {})
      });
    } catch (e) {
      if (e.message === 'unauthorized permission requested') return t('edit.need_admin');
      throw e;
    }
    await uncacheBoard(boardID);
    await uncacheMember(userData.trelloID);

    return {
      content: stripIndentsAndNewlines`
        ${t('edit.header', { context: 'board', name: truncate(board.name, 100) })}
        ${ctx.options.name ? t('edit.rename', { name: ctx.options.name }) : ''}
        ${ctx.options.description ? t(`edit.${ctx.options.description === 'none' ? 'remove_description' : 'description'}`) : ''}
      `,
      components: [
        {
          type: ComponentType.ACTION_ROW,
          components: [
            {
              type: ComponentType.BUTTON,
              style: ButtonStyle.LINK,
              label: t('interactions.visit', { context: 'board' }),
              url: `https://trello.com/b/${board.shortLink}?utm_source=tacobot.app`
            }
          ]
        }
      ]
    };
  }
}

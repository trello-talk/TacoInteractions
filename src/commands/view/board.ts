import { SlashCreator, CommandContext, AutocompleteContext, CommandOptionType } from 'slash-create';
import { prisma } from '../../util/prisma';
import SlashCommand from '../../command';
import { noAuthResponse, stripIndentsAndNewlines, truncate } from '../../util';
import { getBoard, getMember } from '../../util/api';
import { createT } from '../../util/locale';

export default class BoardCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'board',
      description: 'View a Trello board.',
      options: [
        {
          type: CommandOptionType.STRING,
          name: 'board',
          description: 'The board to view, defaults to the selected board.',
          autocomplete: true
        }
      ]
    });
  }

  async autocomplete(ctx: AutocompleteContext) {
    return this.autocompleteBoards(ctx, { filter: (b) => !b.closed });
  }

  async run(ctx: CommandContext) {
    const userData = await prisma.user.findUnique({
      where: { userID: ctx.user.id }
    });
    const t = createT(userData?.locale);
    if (!userData || !userData.trelloToken) return noAuthResponse(t);

    let boardID = ctx.options.board || userData.currentBoard;

    if ((!ctx.options.board || /^[a-f0-9]{24}$/.test(ctx.options.board)) && !userData.currentBoard)
      return t('query.not_found', { context: 'board' });

    if (ctx.options.board) {
      const member = await getMember(userData.trelloToken, userData.trelloID);
      let board = member.boards.find((b) => b.id === ctx.options.board || b.shortLink === ctx.options.board);
      if (!board) board = member.boards.find((b) => b.id === userData.currentBoard);
      if (!board) return t('query.not_found', { context: 'board' });
      boardID = board.id;
    }

    const [board] = await getBoard(userData.trelloToken, boardID, userData.trelloID);

    const boardColor =
      board.prefs && board.prefs.backgroundTopColor ? parseInt(board.prefs.backgroundTopColor.slice(1), 16) : 0;
    const backgroundImg =
      board.prefs && board.prefs.backgroundImageScaled ? board.prefs.backgroundImageScaled.reverse()[1].url : null;

    return {
      embeds: [
        {
          title: truncate(board.name, 256),
          url: board.shortUrl,
          color: boardColor,
          description: board.desc ? truncate(board.desc, 4096) : undefined,
          image: backgroundImg ? { url: backgroundImg } : undefined,
          fields: [
            {
              // Information
              name: t('common.info'),
              value: stripIndentsAndNewlines`
              ${board.closed ? `🗃️ *${t('board.is_archived')}*` : ''}
              **${t('common.visibility')}:** ${t(`common.perm_levels.${board.prefs.permissionLevel}`)}
              ${
                board.organization
                  ? `**${t('common.org')}:** [${(truncate(board.organization.displayName), 50)}](https://trello.com/${
                      board.organization.name
                    })`
                  : ''
              }
              ${backgroundImg ? `**${t('common.bg_img')}:** [${t('common.link')}](${backgroundImg})\n` : ''}
            `
            }
          ],
          footer: {
            text: t('board.footer', {
              lists: board.lists.filter((c) => !c.closed).length,
              cards: board.cards.filter((c) => !c.closed).length
            })
          }
        }
      ]
    };
  }
}

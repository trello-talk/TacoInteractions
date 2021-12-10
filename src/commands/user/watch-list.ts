import { SlashCreator, CommandContext, AutocompleteContext, CommandOptionType } from 'slash-create';
import { prisma } from '../../util/prisma';
import SlashCommand from '../../command';
import { noAuthResponse, noBoardSelectedResponse, truncate } from '../../util';
import { getBoard, updateBoardSub } from '../../util/api';
import Trello from '../../util/trello';
import { createT } from '../../util/locale';

export default class WatchListCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'watch-list',
      description: 'Subscribe to a list to get notifications on Trello.com.',
      options: [{
        type: CommandOptionType.STRING,
        name: 'list',
        description: 'The list to watch.',
        autocomplete: true,
        required: true
      }]
    });
  }

  async autocomplete(ctx: AutocompleteContext) {
    return this.autocompleteLists(ctx, { filter: l => !l.closed });
  }

  async run(ctx: CommandContext) {
    const userData = await prisma.user.findUnique({
      where: { userID: ctx.user.id }
    });
    const t = createT(userData?.locale);
    if (!userData || !userData.trelloToken) return noAuthResponse(t);
    if (!userData.currentBoard) return noBoardSelectedResponse(t);

    const [board, subs] = await getBoard(userData.trelloToken, userData.currentBoard, userData.trelloID, true);
    const list = board.lists.find(l => l.id === ctx.options.list || l.name === ctx.options.list);
    if (!list) return t('query.not_found', { context: 'list' });

    const subbed = !subs.lists[list.id];
    const trello = new Trello(userData.trelloToken);
    await trello.updateList(list.id, { subscribed: subbed });
    await updateBoardSub(userData.trelloID, board.id, list.id, 'list', subbed);

    return t(subbed ? 'watchlist.watched' : 'watchlist.unwatched', { list: truncate(list.name, 100) });
  }
}

import { SlashCreator, CommandContext, AutocompleteContext, CommandOptionType } from 'slash-create';
import SlashCommand from '../../command';
import { getData, noAuthResponse, truncate } from '../../util';
import { getBoard, updateBoardSub } from '../../util/api';

export default class WatchListCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'watch-list',
      description: 'Subscribe to a list to get notifications on Trello.com.',
      options: [
        {
          type: CommandOptionType.STRING,
          name: 'list',
          description: 'The list to watch.',
          autocomplete: true,
          required: true
        }
      ]
    });
  }

  async autocomplete(ctx: AutocompleteContext) {
    return this.autocompleteLists(ctx, { filter: (l) => !l.closed });
  }

  async run(ctx: CommandContext) {
    const { userData, t, trello } = await getData(ctx);
    if (!userData || !userData.trelloToken) return noAuthResponse(t);
    if (!userData.currentBoard) return { content: t('switch.no_board_command'), ephemeral: true };

    const [board, subs] = await getBoard(userData.trelloToken, userData.currentBoard, userData.trelloID, true);
    const list = board.lists.find((l) => l.id === ctx.options.list || l.name === ctx.options.list);
    if (!list) return t('query.not_found', { context: 'list' });

    const subbed = !subs.lists[list.id];
    await trello.updateList(list.id, { subscribed: subbed });
    await updateBoardSub(userData.trelloID, board.id, list.id, 'list', subbed);

    return t(subbed ? 'watchlist.watched' : 'watchlist.unwatched', { list: truncate(list.name, 100) });
  }
}

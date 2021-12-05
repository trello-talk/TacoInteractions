import { SlashCreator, CommandContext, AutocompleteContext, CommandOptionType } from 'slash-create';
import SlashCommand from '../../command';
import { noAuthResponse, sortCards, splitMessage } from '../../util';
import { truncate } from '../../util';
import { getBoard } from '../../util/api';
import { createT } from '../../util/locale';
import { prisma } from '../../util/prisma';
import { createListPrompt } from '../../util/prompt';

export default class ListCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'list',
      description: 'View a Trello list on your selected board.',
      options: [{
        type: CommandOptionType.STRING,
        name: 'list',
        description: 'The list to view.',
        autocomplete: true
      }]
    });
  }

  async autocomplete(ctx: AutocompleteContext) {
    return this.autocompleteLists(ctx);
  }

  async run(ctx: CommandContext) {
    const userData = await prisma.user.findUnique({
      where: { userID: ctx.user.id }
    });

    if (!userData || !userData.trelloToken) return noAuthResponse;

    const [board, subs] = await getBoard(userData.trelloToken, userData.currentBoard, userData.trelloID);
    const t = createT(userData.locale);

    const list = board.lists.find(l => l.id === ctx.options.list || l.name === ctx.options.list);
    if (list) {
      const cards = sortCards(board.cards.filter(c => c.idList === list.id));

      await ctx.defer();
      await ctx.fetch();
      return await createListPrompt(
        {
          title: `Cards in "${truncate(list.name, 100)}" (${cards.length.toLocaleString()})`,
          pages: splitMessage(cards.map(
            (card) =>
              `${card.closed ? '🗃️ ' : ''}${subs.cards[card.id] || card.subscribed ? '🔔 ' : ''} ${truncate(card.name, 100)}`
          ).join('\n'), { maxLength: 4096 })
        },
        ctx.messageID!,
        t
      );
    }
    
    return t('query.not_found', { context: 'list' });
  }
}

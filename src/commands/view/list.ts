import { SlashCreator, CommandContext, AutocompleteContext, CommandOptionType } from 'slash-create';
import SlashCommand from '../../command';
import { noAuthResponse, noBoardSelectedResponse, sortCards, splitMessage } from '../../util';
import { truncate } from '../../util';
import { getBoard } from '../../util/api';
import { createT } from '../../util/locale';
import { prisma } from '../../util/prisma';
import { createListPrompt } from '../../util/prompt';

export default class ListCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'list',
      description: 'View cards in a Trello list on your selected board.',
      options: [{
        type: CommandOptionType.STRING,
        name: 'list',
        description: 'The list to view.',
        autocomplete: true,
        required: true
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
    const t = createT(userData?.locale);
    if (!userData || !userData.trelloToken) return noAuthResponse(t);
    if (!userData.currentBoard) return noBoardSelectedResponse(t);

    const [board, subs] = await getBoard(userData.trelloToken, userData.currentBoard, userData.trelloID, true);

    const list = board.lists.find(l => l.id === ctx.options.list || l.name === ctx.options.list);
    if (list) {
      const cards = sortCards(board.cards.filter(c => c.idList === list.id));

      if (!cards.length) return {
        embeds: [{
          title: t('list.title', { label: truncate(list.name, 100), cards: 0 }),
          description: `*${t('list.none')}*`
        }]
      }

      await ctx.defer();
      await ctx.fetch();
      return await createListPrompt(
        {
          title: t('list.title', { list: truncate(list.name, 100), cards: cards.length }),
          pages: splitMessage(cards.map(
            (card) =>
              `${card.closed ? '🗃️ ' : ''}${subs.cards[card.id] || card.subscribed ? '🔔 ' : ''} ${truncate(card.name, 100)}`
          ).join('\n'))
        },
        ctx.messageID!,
        t
      );
    }

    return t('query.not_found', { context: 'list' });
  }
}

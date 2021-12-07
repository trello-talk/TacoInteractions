import { SlashCreator, CommandContext, CommandOptionType } from 'slash-create';
import SlashCommand from '../../command';
import { noAuthResponse, splitMessage } from '../../util';
import { truncate } from '../../util';
import { getBoard } from '../../util/api';
import { createT, formatNumber } from '../../util/locale';
import { prisma } from '../../util/prisma';
import { createListPrompt } from '../../util/prompt';

enum TrelloLabelsFilter {
  ALL = 'All',
  CARDS = 'Cards'
}

export default class LabelsCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'labels',
      description: 'List Trello labels in the selected board.',
      options: [{
        type: CommandOptionType.STRING,
        name: 'filter',
        description: 'Filter labels to list.',
        choices: [
          {
            name: 'All',
            value: TrelloLabelsFilter.ALL
          },
          {
            name: 'Assigned to Cards',
            value: TrelloLabelsFilter.CARDS
          }
        ]
      }]
    });
  }

  async run(ctx: CommandContext) {
    const userData = await prisma.user.findUnique({
      where: { userID: ctx.user.id }
    });
    const t = createT(userData?.locale);
    if (!userData || !userData.trelloToken) return noAuthResponse(t);

    const [board] = await getBoard(userData.trelloToken, userData.currentBoard, userData.trelloID);

    let lists = board.lists;
    const filter: TrelloLabelsFilter = ctx.options.filter || TrelloLabelsFilter.ALL;
    switch (filter) {
      case TrelloLabelsFilter.ALL:
        break;
      case TrelloLabelsFilter.CARDS:
        lists = lists.filter(l => board.cards.some(c => c.idLabels.includes(l.id)));
        break;
    }
    if (!lists.length) return t('query.no_list', { context: 'list' });

    // TODO use emojis for label colors
    await ctx.defer();
    await ctx.fetch();
    return await createListPrompt(
      {
        title: `${t('labels.list', { context: filter.toLowerCase() })} (${formatNumber(board.labels.length, userData.locale)})`,
        pages: splitMessage(board.labels.map(
          (label) => `${truncate(label.name, 50)}${label.color ? ` (${t(`common.label_color.${label.color}`)})` : ''}`
        ).join('\n'))
      },
      ctx.messageID!,
      t
    );
  }
}

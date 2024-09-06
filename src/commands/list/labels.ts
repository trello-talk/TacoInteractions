import { oneLine } from 'common-tags';
import { CommandContext, CommandOptionType, SlashCreator } from 'slash-create';

import SlashCommand from '../../command';
import { defaultContexts, getData, noAuthResponse, splitMessage, truncate } from '../../util';
import { getBoard } from '../../util/api';
import { LABEL_EMOJIS } from '../../util/constants';
import { formatNumber } from '../../util/locale';
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
      ...defaultContexts,
      options: [
        {
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
        }
      ]
    });
  }

  async run(ctx: CommandContext) {
    const { userData, t, locale } = await getData(ctx);
    if (!userData || !userData.trelloToken) return noAuthResponse(t);
    if (!userData.currentBoard) return { content: t('switch.no_board_command'), ephemeral: true };

    const [board] = await getBoard(userData.trelloToken, userData.currentBoard, userData.trelloID);

    let labels = board.labels;
    const filter: TrelloLabelsFilter = ctx.options.filter || TrelloLabelsFilter.ALL;
    switch (filter) {
      case TrelloLabelsFilter.ALL:
        break;
      case TrelloLabelsFilter.CARDS:
        labels = labels.filter((l) => board.cards.some((c) => c.idLabels.includes(l.id)));
        break;
    }
    if (!labels.length) return t('query.no_list', { context: 'label' });

    await ctx.defer();
    await ctx.fetch();
    return await createListPrompt(
      {
        title: `${t('labels.list', { context: filter.toLowerCase() })} (${formatNumber(labels.length, locale)})`,
        pages: splitMessage(
          labels
            .map(
              (label) => oneLine`
                ${label.color ? LABEL_EMOJIS[label.color.split('_')[0]] : LABEL_EMOJIS.none}
                ${truncate(label.name, 50) || '*[unnamed]*'}`
            )
            .join('\n')
        )
      },
      ctx.messageID!,
      t,
      locale
    );
  }
}

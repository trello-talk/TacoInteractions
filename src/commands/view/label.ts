import { SlashCreator, CommandContext, AutocompleteContext, CommandOptionType } from 'slash-create';
import SlashCommand from '../../command';
import { noAuthResponse, noBoardSelectedResponse, sortCards, splitMessage } from '../../util';
import { truncate } from '../../util';
import { getBoard } from '../../util/api';
import { LABEL_COLORS } from '../../util/constants';
import { createT } from '../../util/locale';
import { prisma } from '../../util/prisma';
import { createListPrompt } from '../../util/prompt';

export default class LabelCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'label',
      description: 'View cards that are assigned a given label on your selected board.',
      options: [
        {
          type: CommandOptionType.STRING,
          name: 'label',
          description: 'The label to view.',
          autocomplete: true,
          required: true
        }
      ]
    });
  }

  async autocomplete(ctx: AutocompleteContext) {
    return this.autocompleteLabels(ctx);
  }

  async run(ctx: CommandContext) {
    const userData = await prisma.user.findUnique({
      where: { userID: ctx.user.id }
    });
    const t = createT(userData?.locale);
    if (!userData || !userData.trelloToken) return noAuthResponse(t);
    if (!userData.currentBoard) return noBoardSelectedResponse(t);

    const [board, subs] = await getBoard(userData.trelloToken, userData.currentBoard, userData.trelloID, true);

    const label = board.labels.find((l) => l.id === ctx.options.label);
    if (label) {
      const cards = sortCards(board.cards.filter((c) => c.idLabels.includes(label.id)));

      if (!cards.length)
        return {
          embeds: [
            {
              title: t('label.title', { label: truncate(label.name, 100), cards: 0 }),
              color: label.color ? LABEL_COLORS[label.color] : undefined,
              description: `*${t('label.none')}*`
            }
          ]
        };

      await ctx.defer();
      await ctx.fetch();
      return await createListPrompt(
        {
          title: t('label.title', { label: truncate(label.name, 100), cards: cards.length }),
          color: label.color ? LABEL_COLORS[label.color] : undefined,
          pages: splitMessage(
            cards
              .map(
                (card) =>
                  `${card.closed ? '🗃️ ' : ''}${subs.cards[card.id] || card.subscribed ? '🔔 ' : ''} ${truncate(
                    card.name,
                    100
                  )}`
              )
              .join('\n')
          )
        },
        ctx.messageID!,
        t
      );
    }

    return t('query.not_found', { context: 'label' });
  }
}

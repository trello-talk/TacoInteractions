import { stripIndents } from 'common-tags';
import { SlashCreator, CommandContext, AutocompleteContext, CommandOptionType, MessageEmbedOptions } from 'slash-create';
import SlashCommand from '../../command';
import { noAuthResponse, toColorInt, truncateList } from '../../util';
import { truncate } from '../../util';
import { getBoard, getCard } from '../../util/api';
import { LABEL_COLORS, LABEL_EMOJIS } from '../../util/constants';
import { createT } from '../../util/locale';
import { prisma } from '../../util/prisma';

export default class CardCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'card',
      description: 'View a Trello card on your selected board.',
      options: [{
        type: CommandOptionType.STRING,
        name: 'card',
        description: 'The card to view.',
        autocomplete: true,
        required: true
      }]
    });
  }

  async autocomplete(ctx: AutocompleteContext) {
    return this.autocompleteCards(ctx);
  }

  async run(ctx: CommandContext) {
    const userData = await prisma.user.findUnique({
      where: { userID: ctx.user.id }
    });
    const t = createT(userData?.locale);
    if (!userData || !userData.trelloToken) return noAuthResponse(t);

    const [board] = await getBoard(userData.trelloToken, userData.currentBoard, userData.trelloID);
    if (!board.cards.find(c => c.id === ctx.options.card || c.shortLink === ctx.options.card))
      return t('query.not_found', { context: 'card' });

    const card = await getCard(userData.trelloToken, ctx.options.card);

    const embed: MessageEmbedOptions = {
      title: truncate(card.name, 256),
      url: card.shortUrl,
      description: card.desc ? truncate(card.desc, 4096) : undefined,
      fields: [{
        // Information
        name: t('common.info'),
        value: stripIndents`
          ${card.closed ? `🗃️ *${t('card.is_archived')}*` : ''}
          **${t('common.list')}:** ${truncate(board.lists.find(list => card.idList === list.id).name, 50)}
          ${card.cover?.sharedSourceUrl ? `**${t('common.cover_source')}:** ${card.cover.sharedSourceUrl}` : ''}
        `
      }]
    };

    // Cover
    if (card.cover) {
      embed.color = card.cover.edgeColor ?
        toColorInt(card.cover.edgeColor) :
        (card.cover.color ? LABEL_COLORS[card.cover.color] : undefined);
      if (card.cover.scaled)
        embed.thumbnail = {
          url: card.cover.scaled.reverse()[card.cover.idAttachment ? 0 : 1].url };
    }

    // Labels
    if (card.labels.length) {
      embed.fields.push({
        name: t('common.labels'),
        value: truncateList(card.labels.map(
          (label) => `${label.color ? LABEL_EMOJIS[label.color] : LABEL_EMOJIS.none} ${truncate(label.name, 50)}`
        ), t),
        inline: true
      });
    }

    return { embeds: [embed] };
  }
}

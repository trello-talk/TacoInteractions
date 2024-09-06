import { oneLine } from 'common-tags';
import { AutocompleteContext, ButtonStyle, CommandContext, CommandOptionType, ComponentType, MessageEmbedOptions, SlashCreator } from 'slash-create';

import SlashCommand from '../../command';
import { defaultContexts, formatTime, getData, noAuthResponse, stripIndentsAndNewlines, toColorInt, truncate, truncateList } from '../../util';
import { getBoard, getCard } from '../../util/api';
import { EMOJIS, LABEL_COLORS, LABEL_EMOJIS, STICKER_EMOJIS } from '../../util/constants';
import { formatNumber } from '../../util/locale';

export default class CardCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'card',
      description: 'View a Trello card on your selected board.',
      ...defaultContexts,
      options: [
        {
          type: CommandOptionType.STRING,
          name: 'card',
          description: 'The card to view.',
          autocomplete: true,
          required: true
        }
      ]
    });
  }

  async autocomplete(ctx: AutocompleteContext) {
    return this.autocompleteCards(ctx);
  }

  async run(ctx: CommandContext) {
    const { userData, t, locale } = await getData(ctx);
    if (!userData || !userData.trelloToken) return noAuthResponse(t);
    if (!userData.currentBoard) return { content: t('switch.no_board_command'), ephemeral: true };

    const [board] = await getBoard(userData.trelloToken, userData.currentBoard, userData.trelloID);
    if (!board.cards.find((c) => c.id === ctx.options.card || c.shortLink === ctx.options.card)) return t('query.not_found', { context: 'card' });

    const card = await getCard(userData.trelloToken, ctx.options.card);
    const hasVoted = !!card.membersVoted.find((member) => member.id === userData.trelloID);

    const embed: MessageEmbedOptions = {
      title: truncate(card.name, 256),
      url: `${card.shortUrl}?utm_source=tacobot.app`,
      description: card.desc ? truncate(card.desc, 4096) : undefined,
      fields: [
        {
          // Information
          name: t('common.info'),
          value: stripIndentsAndNewlines`
          ${card.closed ? `🗃️ *${t('card.is_archived')}*` : ''}
          **${t('common.list')}:** ${truncate(board.lists.find((list) => card.idList === list.id).name, 50)}
          ${card.due ? `**${t('common.due')}:** ${card.dueComplete ? EMOJIS.check : EMOJIS.uncheck} ${formatTime(card.due)}` : ''}
          ${card.cover?.sharedSourceUrl ? `**${t('common.cover_source')}:** [${t('common.link')}](${card.cover.sharedSourceUrl})` : ''}
          ${
            card.membersVoted.length
              ? `**${t('common.votes')}:** ${formatNumber(card.membersVoted.length, locale)}${hasVoted ? ` ${t('card.vote_include')}` : ''}`
              : ''
          }
        `
        }
      ]
    };

    // Cover
    if (card.cover) {
      embed.color = card.cover.edgeColor ? toColorInt(card.cover.edgeColor) : card.cover.color ? LABEL_COLORS[card.cover.color] : undefined;
      if (card.cover.scaled)
        embed.thumbnail = {
          url: card.cover.scaled.reverse()[card.cover.idAttachment ? 0 : 1].url
        };
    }

    // Labels
    if (card.labels.length)
      embed.fields.push({
        name: t('common.labels'),
        value: truncateList(
          card.labels.map(
            (label) => oneLine`
              ${label.color ? LABEL_EMOJIS[label.color.split('_')[0]] : LABEL_EMOJIS.none}
              ${truncate(label.name, 50) || '*[unnamed]*'}`
          ),
          t
        ),
        inline: true
      });

    // Attachments
    if (card.attachments.length)
      embed.fields.push({
        name: t('common.attachments'),
        value: truncateList(
          card.attachments.map((attachment) => `[${truncate(attachment.name, 20)}](${attachment.url})`),
          t
        ),
        inline: true
      });

    // Stickers
    if (card.stickers.length) {
      const stickers = {};
      card.stickers.forEach((sticker) => {
        if (stickers[sticker.image]) stickers[sticker.image]++;
        else stickers[sticker.image] = 1;
      });
      embed.fields.push({
        name: t('common.stickers'),
        value: Object.keys(stickers)
          .map(
            (key) =>
              `${STICKER_EMOJIS[key] ? `<:_:${STICKER_EMOJIS[key]}>` : key}${stickers[key] > 1 ? ` ${formatNumber(stickers[key], locale)}` : ''}`
          )
          .join(' '),
        inline: true
      });
    }

    // Checklists
    if (card.checklists.length)
      embed.fields.push({
        name: t('common.checklists'),
        value: truncateList(
          card.checklists.map((checklist) => {
            const completed = !checklist.checkItems.some((item) => item.state === 'incomplete');
            const checkedCount = checklist.checkItems.filter((item) => item.state === 'complete').length;
            return `${completed ? EMOJIS.check : EMOJIS.uncheck} ${truncate(checklist.name, 50)} (${formatNumber(
              checkedCount,
              locale
            )}/${formatNumber(checklist.checkItems.length, locale)})`;
          }),
          t
        ),
        inline: true
      });

    // Members
    if (card.members.length)
      embed.fields.push({
        name: t('common.members'),
        value: truncateList(
          card.members.map((member) =>
            userData.trelloID === member.id ? `**${member.fullName || member.username}**` : member.fullName || member.username
          ),
          t
        ),
        inline: true
      });

    return {
      embeds: [embed],
      components: [
        {
          type: ComponentType.ACTION_ROW,
          components: [
            {
              type: ComponentType.BUTTON,
              style: ButtonStyle.LINK,
              label: t('interactions.visit', { context: 'card' }),
              url: `https://trello.com/c/${card.shortLink}?utm_source=tacobot.app`
            }
          ]
        }
      ]
    };
  }
}

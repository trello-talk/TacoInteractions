import { AutocompleteContext, CommandContext, CommandOptionType, SlashCreator } from 'slash-create';

import SlashCommand from '../../command';
import { defaultContexts, getData, noAuthResponse } from '../../util';
import { getBoard, getCard } from '../../util/api';
import { createAttachmentPrompt } from '../../util/prompt';

export default class AttachmentsCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'attachments',
      description: "View a card's attachments.",
      ...defaultContexts,
      options: [
        {
          type: CommandOptionType.STRING,
          name: 'card',
          description: 'The card to view attachments from.',
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

    await ctx.defer();
    await ctx.fetch();
    return await createAttachmentPrompt({ attachments: card.attachments }, ctx.messageID!, t, locale);
  }
}

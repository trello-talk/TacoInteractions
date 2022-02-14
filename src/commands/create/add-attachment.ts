import {
  SlashCreator,
  CommandContext,
  AutocompleteContext,
  CommandOptionType,
  ButtonStyle,
  ComponentType
} from 'slash-create';
import SlashCommand from '../../command';
import { getData, noAuthResponse, truncate } from '../../util';
import { getBoard } from '../../util/api';

export default class CommentCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'add-attachment',
      description: 'Add an attachment to a card.',
      options: [
        {
          type: CommandOptionType.STRING,
          name: 'card',
          description: 'The card to add an attachment on.',
          autocomplete: true,
          required: true
        },
        {
          type: CommandOptionType.ATTACHMENT,
          name: 'attachment',
          description: 'The attachment to use.'
        },
        {
          type: CommandOptionType.STRING,
          name: 'url',
          description: 'The URL to use as an attachment, instead of attaching a file.'
        }
      ]
    });
  }

  async autocomplete(ctx: AutocompleteContext) {
    return this.autocompleteCards(ctx, { filter: (c) => !c.closed });
  }

  async run(ctx: CommandContext) {
    const { userData, t, trello } = await getData(ctx);
    if (!userData || !userData.trelloToken) return noAuthResponse(t);
    if (!userData.currentBoard) return { content: t('switch.no_board_command'), ephemeral: true };

    const [board] = await getBoard(userData.trelloToken, userData.currentBoard, userData.trelloID);
    const card = board.cards.find((c) => c.id === ctx.options.card || c.shortLink === ctx.options.card);
    if (!card) return t('query.not_found', { context: 'card' });

    if (!ctx.options.url && !ctx.options.attachment) return { content: t('addattachment.no_url'), ephemeral: true };

    await trello.addAttachment(
      card.id,
      ctx.options.attachment ? ctx.attachments.get(ctx.options.attachment).url : ctx.options.url
    );

    return {
      content: t('addattachment.done', { card: truncate(card.name, 100) }),
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

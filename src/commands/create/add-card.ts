import {
  SlashCreator,
  CommandContext,
  CommandOptionType,
  AutocompleteContext,
  ComponentType,
  ButtonStyle
} from 'slash-create';
import { prisma } from '../../util/prisma';
import SlashCommand from '../../command';
import { noAuthResponse, truncate } from '../../util';
import { getBoard, uncacheBoard } from '../../util/api';
import Trello from '../../util/trello';
import { createT } from '../../util/locale';
import { TrelloCard } from '../../util/types';

// TODO add position option (top, bottom)
export default class AddCardCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'add-card',
      description: 'Create a card on your selected board.',
      options: [
        {
          type: CommandOptionType.STRING,
          name: 'list',
          description: 'The list to create your card in.',
          autocomplete: true,
          required: true
        },
        {
          type: CommandOptionType.STRING,
          name: 'name',
          description: 'The name of your new card.',
          required: true
        },
        {
          type: CommandOptionType.STRING,
          name: 'description',
          description: 'The description of your new card.'
        }
      ]
    });
  }

  async autocomplete(ctx: AutocompleteContext) {
    return this.autocompleteLists(ctx, { filter: (l) => !l.closed });
  }

  async run(ctx: CommandContext) {
    const userData = await prisma.user.findUnique({
      where: { userID: ctx.user.id }
    });
    const t = createT(userData?.locale);
    if (!userData || !userData.trelloToken) return noAuthResponse(t);
    if (!userData.currentBoard) return { content: t('switch.no_board_command'), ephemeral: true };

    const [board] = await getBoard(userData.trelloToken, userData.currentBoard, userData.trelloID);
    if (board.cards.length >= 400) return { content: t('addcard.limited'), ephemeral: true };

    const list = board.lists.find((l) => l.id === ctx.options.list || l.name === ctx.options.list);
    if (!list) return t('query.not_found', { context: 'list' });

    const trello = new Trello(userData.trelloToken);
    const name = ctx.options.name.trim();
    const response = await trello.addCard(list.id, { name, desc: ctx.options.description });
    const card = response.data as TrelloCard;
    await uncacheBoard(userData.currentBoard);

    return {
      content: t('addcard.done', { card: truncate(name, 100) }),
      components: [
        {
          type: ComponentType.ACTION_ROW,
          components: [
            {
              type: ComponentType.BUTTON,
              style: ButtonStyle.LINK,
              label: t('interactions.visit', { context: 'card' }),
              url: `${card.shortUrl}?utm_source=tacobot.app`
            }
          ]
        }
      ]
    };
  }
}

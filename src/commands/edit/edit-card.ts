import { SlashCreator, CommandContext, AutocompleteContext, CommandOptionType } from 'slash-create';
import SlashCommand from '../../command';
import { getData, noAuthResponse, stripIndentsAndNewlines, truncate } from '../../util';
import { ActionType, createAction } from '../../util/actions';
import { getBoard, getCard, uncacheBoard, uncacheCard } from '../../util/api';
import { LABEL_EMOJIS } from '../../util/constants';
import { createSelectPrompt } from '../../util/prompt';

export default class EditCardCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'edit-card',
      description: 'Edit a card from your selected board.',
      options: [
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'attributes',
          description: "Edit a card's attributes.",
          options: [
            {
              type: CommandOptionType.STRING,
              name: 'card',
              description: 'The card to edit.',
              autocomplete: true,
              required: true
            },
            {
              type: CommandOptionType.STRING,
              name: 'name',
              description: 'The new name of your card.'
            },
            {
              type: CommandOptionType.STRING,
              name: 'description',
              description: 'The new description of your card. Use "none" to remove the description.'
            },
            {
              type: CommandOptionType.BOOLEAN,
              name: 'archive',
              description: 'Whether to archive (or unarchive) the card.'
            }
          ]
        },
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'move',
          description: 'Move a card to a list.',
          options: [
            {
              type: CommandOptionType.STRING,
              name: 'card',
              description: 'The card to move.',
              autocomplete: true,
              required: true
            },
            {
              type: CommandOptionType.STRING,
              name: 'list',
              description: 'The list to move to card to.',
              autocomplete: true,
              required: true
            }
          ]
        },
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'labels',
          description: "Edit a card's labels.",
          options: [
            {
              type: CommandOptionType.STRING,
              name: 'card',
              description: 'The card to edit labels from.',
              autocomplete: true,
              required: true
            }
          ]
        },
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'members',
          description: "Edit a card's members.",
          options: [
            {
              type: CommandOptionType.STRING,
              name: 'card',
              description: 'The card to edit members from.',
              autocomplete: true,
              required: true
            }
          ]
        }
      ]
    });
  }

  async autocomplete(ctx: AutocompleteContext) {
    if (ctx.subcommands[0] === 'move' && ctx.focused === 'list')
      return this.autocompleteLists(ctx, { query: ctx.options.move.list, filter: (l) => !l.closed });
    return this.autocompleteCards(ctx, {
      query: ctx.options[ctx.subcommands[0]].card,
      ...(ctx.subcommands[0] === 'move' ? { filter: (c) => !c.closed } : {})
    });
  }

  async run(ctx: CommandContext) {
    const { userData, t, trello, locale } = await getData(ctx);
    if (!userData || !userData.trelloToken) return noAuthResponse(t);
    if (!userData.currentBoard) return { content: t('switch.no_board_command'), ephemeral: true };

    const [board] = await getBoard(userData.trelloToken, userData.currentBoard, userData.trelloID);
    const cardID = ctx.options[ctx.subcommands[0]].card;
    if (!board.cards.find((c) => c.id === cardID || c.shortLink === cardID))
      return t('query.not_found', { context: 'card' });
    const card = await getCard(userData.trelloToken, cardID);

    switch (ctx.subcommands[0]) {
      case 'attributes': {
        const opts = ctx.options.attributes;
        await trello.updateCard(card.id, {
          ...(opts.name ? { name: opts.name } : {}),
          ...(opts.description ? { desc: opts.description === 'none' ? '' : opts.description } : {}),
          ...(opts.archive !== undefined ? { closed: opts.archive } : {})
        });
        await uncacheBoard(userData.currentBoard);
        await uncacheCard(card.id);

        return stripIndentsAndNewlines`
          ${t('edit.header', { context: 'card', name: truncate(card.name, 100) })}
          ${opts.name ? t('edit.rename', { name: opts.name }) : ''}
          ${opts.description ? t(`edit.${opts.description === 'none' ? 'remove_description' : 'description'}`) : ''}
          ${opts.archive !== undefined ? t(`edit.${opts.archive ? 'archive' : 'unarchive'}`) : ''}
        `;
      }
      case 'move': {
        const opts = ctx.options.move;
        const list = board.lists.find((l) => l.id === opts.list || l.name === opts.list);
        if (!list) return t('query.not_found', { context: 'list' });

        await trello.updateCard(card.id, { idList: list.id });
        await uncacheBoard(userData.currentBoard);
        await uncacheCard(card.id);

        return t('edit.move', { card: truncate(card.name, 100), list: truncate(list.name, 100) });
      }
      case 'labels': {
        if (!board.labels.length) return t('edit.no_labels');

        const action = await createAction(ActionType.SET_CARD_LABELS, ctx.user.id, { extra: card.id });
        await ctx.defer();
        await ctx.fetch();
        return await createSelectPrompt(
          {
            title: t('edit.labels_title', { card: truncate(card.name, 50) }),
            action,
            values: board.labels,
            placeholder: t('edit.labels_placeholder'),
            display: board.labels.map((l) => ({
              label: truncate(l.name, 100) || '[unnamed]',
              emoji: { id: (l.color ? LABEL_EMOJIS[l.color] : LABEL_EMOJIS.none).split(':')[2].replace('>', '') }
            }))
          },
          ctx.messageID!,
          t,
          card.labels.map((l) => board.labels.findIndex((lb) => lb.id === l.id)),
          locale
        );
      }
      case 'members': {
        const action = await createAction(ActionType.SET_CARD_MEMBERS, ctx.user.id, { extra: card.id });
        await ctx.defer();
        await ctx.fetch();
        return await createSelectPrompt(
          {
            title: t('edit.members_title', { card: truncate(card.name, 50) }),
            action,
            values: board.members,
            placeholder: t('edit.members_placeholder'),
            display: board.members.map((member) => ({
              label: `${truncate(member.fullName, 50)} (${member.username})`
            }))
          },
          ctx.messageID!,
          t,
          card.members.map((m) => board.members.findIndex((mb) => mb.id === m.id)),
          locale
        );
      }
    }

    return t('interactions.bad_subcommand');
  }
}

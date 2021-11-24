import { SlashCreator, CommandContext, ComponentType, ButtonStyle } from 'slash-create';
import { ActionType } from '../../util/actions';
import { prisma } from '../../util/prisma';
import SlashCommand from '../../command';

export default class ClearAuthCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'clearauth',
      description: 'Remove your authentication data.',
      deferEphemeral: true
    });
  }

  async run(ctx: CommandContext) {
    const userData = await prisma.user.findUnique({
      where: { userID: ctx.user.id }
    });

    if (!userData || !userData.trelloToken)
      return {
        content: 'No authentication data was found.',
        ephemeral: true
      };

    return {
      content: 'Are you sure you want to remove your authentication data?',
      ephemeral: true,
      components: [
        {
          type: ComponentType.ACTION_ROW,
          components: [
            {
              type: ComponentType.BUTTON,
              style: ButtonStyle.DESTRUCTIVE,
              label: 'Yes',
              custom_id: `action::${ActionType.USER_CLEAR_AUTH}`
            },
            {
              type: ComponentType.BUTTON,
              style: ButtonStyle.SECONDARY,
              label: 'No',
              custom_id: 'delete'
            }
          ]
        }
      ]
    };
  }
}

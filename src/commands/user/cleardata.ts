import { SlashCreator, CommandContext, ComponentType, ButtonStyle } from 'slash-create';
import { ActionType } from '../../util/actions';
import { prisma } from '../../util/prisma';
import SlashCommand from '../../command';

// TODO localize
export default class ClearDataCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'clear-data',
      description: 'Remove your user data.',
      deferEphemeral: true
    });
  }

  async run(ctx: CommandContext) {
    const userData = await prisma.user.findUnique({
      where: { userID: ctx.user.id }
    });

    if (!userData)
      return {
        content: 'No user data was found.',
        ephemeral: true
      };

    return {
      content: 'Are you sure you want to remove **ALL** of your user data?',
      ephemeral: true,
      components: [
        {
          type: ComponentType.ACTION_ROW,
          components: [
            {
              type: ComponentType.BUTTON,
              style: ButtonStyle.DESTRUCTIVE,
              label: 'Yes',
              custom_id: `action::${ActionType.USER_CLEAR_DATA}`
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

import { SlashCreator, CommandContext, ComponentType, ButtonStyle } from 'slash-create';
import { ActionType } from '../../util/actions';
import { prisma } from '../../util/prisma';
import SlashCommand from '../../command';
import { createT } from '../../util/locale';

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

    const t = createT(userData?.locale);

    if (!userData)
      return {
        content: t('cleardata.no_data'),
        ephemeral: true
      };

    return {
      content: t('cleardata.confirm'),
      ephemeral: true,
      components: [
        {
          type: ComponentType.ACTION_ROW,
          components: [
            {
              type: ComponentType.BUTTON,
              style: ButtonStyle.DESTRUCTIVE,
              label: t('common.yes'),
              custom_id: `action::${ActionType.USER_CLEAR_DATA}`
            },
            {
              type: ComponentType.BUTTON,
              style: ButtonStyle.SECONDARY,
              label: t('common.no'),
              custom_id: 'delete'
            }
          ]
        }
      ]
    };
  }
}

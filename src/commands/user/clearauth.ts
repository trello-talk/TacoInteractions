import { SlashCreator, CommandContext, ComponentType, ButtonStyle } from 'slash-create';
import { ActionType } from '../../util/actions';
import SlashCommand from '../../command';
import { getData } from '../../util';

export default class ClearAuthCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'clear-auth',
      description: 'Remove your authentication data.',
      deferEphemeral: true
    });
  }

  async run(ctx: CommandContext) {
    const { userData, t } = await getData(ctx);

    if (!userData || !userData.trelloToken)
      return {
        content: t('clearauth.no_auth'),
        ephemeral: true
      };

    return {
      content: t('clearauth.confirm'),
      ephemeral: true,
      components: [
        {
          type: ComponentType.ACTION_ROW,
          components: [
            {
              type: ComponentType.BUTTON,
              style: ButtonStyle.DESTRUCTIVE,
              label: t('common.yes'),
              custom_id: `action::${ActionType.USER_CLEAR_AUTH}`
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

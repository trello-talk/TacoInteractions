import { ButtonStyle, CommandContext, ComponentType, SlashCreator } from 'slash-create';

import SlashCommand from '../../command';
import { getData } from '../../util';
import { ActionType } from '../../util/actions';

export default class ClearDataCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'clear-data',
      description: 'Remove your user data.',
      deferEphemeral: true
    });
  }

  async run(ctx: CommandContext) {
    const { userData, t } = await getData(ctx);

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

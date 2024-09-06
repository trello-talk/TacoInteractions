import { ComponentContext } from 'slash-create';
import { inspect } from 'util';

import { ActionFunction, ActionType } from '../util/actions';

export const action: ActionFunction = {
  type: ActionType.DEBUG,
  async onAction(ctx, action, data) {
    console.log(action, data);
    if (ctx instanceof ComponentContext)
      return void ctx.editParent({
        content: `Debug action used.\n\`\`\`js\n${inspect(data)}\n\`\`\``,
        components: [],
        embeds: []
      });
    return void ctx.send({
      content: `Debug action used.\n\`\`\`js\n${inspect(data)}\n\`\`\``,
      ephemeral: true
    });
  }
};

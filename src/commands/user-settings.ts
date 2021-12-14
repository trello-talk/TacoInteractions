import { SlashCreator, CommandContext, CommandOptionType, AutocompleteContext } from 'slash-create';
import SlashCommand from '../command';
import { prisma } from '../util/prisma';
import { createT, langs } from '../util/locale';
import i18next from 'i18next';
import { oneLine } from 'common-tags';
import { getData } from '../util';

export default class UserSettingsCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: 'user-settings',
      description: 'Edit user settings.',
      deferEphemeral: true,
      options: [
        {
          type: CommandOptionType.SUB_COMMAND,
          name: 'locale',
          description: 'Set your preferred locale.',
          options: [
            {
              type: CommandOptionType.STRING,
              name: 'set',
              description: 'The locale to set to.',
              autocomplete: true
            }
          ]
        }
      ]
    });
  }

  async autocomplete(ctx: AutocompleteContext) {
    if (ctx.subcommands[0] === 'locale') return this.autocompleteLocales(ctx, ctx.options.locale.set);
  }

  async run(ctx: CommandContext) {
    const { userData, t } = await getData(ctx);

    switch (ctx.subcommands[0]) {
      case 'locale': {
        const setLocale = ctx.options.locale?.set;
        if (setLocale) {
          if (!langs.includes(setLocale))
            return {
              content: t('user_settings.invalid_locale'),
              ephemeral: true
            };

          await prisma.user.upsert({
            where: { userID: ctx.user.id },
            update: { locale: setLocale },
            create: { userID: ctx.user.id, locale: setLocale }
          });
          const nt = createT(setLocale);
          return {
            content: nt('user_settings.set_locale', { name: `:flag_${nt('_.emoji')}: ${nt('_.name')}` }),
            ephemeral: true
          };
        }

        const lng = userData?.locale || 'en';
        return {
          content: t('user_settings.locale', {
            name: langs.includes(lng)
              ? oneLine`
                :flag_${i18next.getResource(lng, 'commands', '_.emoji')}:
                ${i18next.getResource(lng, 'commands', '_.name')}`
              : lng
          }),
          ephemeral: true
        };
      }
    }

    return {
      content: t('interactions.bad_subcommand'),
      ephemeral: true
    };
  }
}

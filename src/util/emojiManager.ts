import { EmojiManager } from '@snazzah/emoji-sync';

export type EmojiKey =
  | 'channel_forum'
  | 'channel_news'
  | 'channel_text'
  | 'check'
  | 'clock'
  | 'frown'
  | 'github'
  | 'heart'
  | 'huh'
  | 'label_black'
  | 'label_blue'
  | 'label_green'
  | 'label_lime'
  | 'label_none'
  | 'label_orange'
  | 'label_pink'
  | 'label_purple'
  | 'label_red'
  | 'label_sky'
  | 'label_yellow'
  | 'laugh'
  | 'pete_alert'
  | 'pete_award'
  | 'pete_broken'
  | 'pete_busy'
  | 'pete_completed'
  | 'pete_confused'
  | 'pete_ghost'
  | 'pete_happy'
  | 'pete_love'
  | 'pete_music'
  | 'pete_shipped'
  | 'pete_sketch'
  | 'pete_space'
  | 'pete_talk'
  | 'pete_vacation'
  | 'prompt_done'
  | 'prompt_next'
  | 'prompt_previous'
  | 'prompt_stop'
  | 'rocketship'
  | 'smile'
  | 'star'
  | 'tacobot'
  | 'taco_active'
  | 'taco_alert'
  | 'taco_angry'
  | 'taco_celebrate'
  | 'taco_clean'
  | 'taco_confused'
  | 'taco_cool'
  | 'taco_embarrassed'
  | 'taco_love'
  | 'taco_money'
  | 'taco_pixel'
  | 'taco_proto'
  | 'taco_reading'
  | 'taco_robot'
  | 'taco_sleeping'
  | 'taco_trophy'
  | 'thumbsdown'
  | 'thumbsup'
  | 'trello'
  | 'uncheck'
  | 'warning';

export const manager = new EmojiManager<EmojiKey>({
  applicationId: process.env.DISCORD_APP_ID,
  token: process.env.DISCORD_BOT_TOKEN
});

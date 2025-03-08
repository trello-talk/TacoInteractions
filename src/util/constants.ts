import type { EmojiKey } from './emojiManager';

export const STICKER_EMOJIS: Record<string, EmojiKey> = {
  thumbsup: 'thumbsup',
  thumbsdown: 'thumbsdown',
  heart: 'heart',
  star: 'star',
  clock: 'clock',
  huh: 'huh',
  rocketship: 'rocketship',
  warning: 'warning',
  smile: 'smile',
  laugh: 'laugh',
  frown: 'frown',
  check: 'check',

  'pete-alert': 'pete_alert',
  'pete-award': 'pete_award',
  'pete-broken': 'pete_broken',
  'pete-busy': 'pete_busy',
  'pete-completed': 'pete_completed',
  'pete-confused': 'pete_confused',
  'pete-ghost': 'pete_ghost',
  'pete-happy': 'pete_happy',
  'pete-love': 'pete_love',
  'pete-music': 'pete_music',
  'pete-shipped': 'pete_shipped',
  'pete-sketch': 'pete_sketch',
  'pete-space': 'pete_space',
  'pete-talk': 'pete_talk',
  'pete-vacation': 'pete_vacation',

  'taco-active': 'taco_active',
  'taco-alert': 'taco_alert',
  'taco-angry': 'taco_angry',
  'taco-celebrate': 'taco_celebrate',
  'taco-clean': 'taco_clean',
  'taco-confused': 'taco_confused',
  'taco-cool': 'taco_cool',
  'taco-embarrassed': 'taco_embarrassed',
  'taco-love': 'taco_love',
  'taco-money': 'taco_money',
  'taco-pixel': 'taco_pixel',
  'taco-proto': 'taco_proto',
  'taco-reading': 'taco_reading',
  'taco-robot': 'taco_robot',
  'taco-sleeping': 'taco_sleeping',
  'taco-trophy': 'taco_trophy'
};

export const LABEL_COLORS: Record<string, number> = {
  green: 0x61bd4f,
  yellow: 0xf2d600,
  red: 0xeb5a46,
  orange: 0xff9f1a,
  lime: 0x51e898,
  purple: 0xc377e0,
  blue: 0x0079bf,
  sky: 0x00c2e0,
  pink: 0xc9558f,
  black: 0x344563
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../../package.json');

export const VERSION: string = pkg.version;
export const REPOSITORY: string = pkg.repository;

export const STICKER_EMOJIS: Record<string, string> = {
  thumbsup: '632444552845852682',
  thumbsdown: '632444552845721602',
  heart: '632444546650996746',
  star: '632444550597574666',
  clock: '632444546348744717',
  huh: '632444546583887873',
  rocketship: '632444552942452736',
  warning: '632444552837595146',
  smile: '632444553051504640',
  laugh: '632444546428436492',
  frown: '632444546634219520',
  check: '632444546684551183',

  'pete-alert': '632444547086942217',
  'pete-award': '632444547154051118',
  'pete-broken': '632444552518828033',
  'pete-busy': '632444553441443882',
  'pete-completed': '632444550018891777',
  'pete-confused': '632444550337527818',
  'pete-ghost': '632444553101705217',
  'pete-happy': '632444550337658890',
  'pete-love': '632444550413156363',
  'pete-music': '632444553239986176',
  'pete-shipped': '632444550362693642',
  'pete-sketch': '632444555668619274',
  'pete-space': '632444553311289354',
  'pete-talk': '632444553324134420',
  'pete-vacation': '632444553349169162',

  'taco-active': '632444556264210439',
  'taco-alert': '632444556276924437',
  'taco-angry': '632444553412083742',
  'taco-celebrate': '632444557920829450',
  'taco-clean': '632444555760762894',
  'taco-confused': '632444555911888898',
  'taco-cool': '632444553714204672',
  'taco-embarrassed': '632444553625993216',
  'taco-love': '632444556352421898',
  'taco-money': '632444555911757834',
  'taco-pixel': '632444550069223437',
  'taco-proto': '632444556192776205',
  'taco-reading': '632444553819062282',
  'taco-robot': '632444553810411559',
  'taco-sleeping': '632444556092112927',
  'taco-trophy': '632444556025135124'
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

export const LABEL_EMOJIS: Record<string, string> = {
  none: '<:labelNone:917659406244663346>',
  green: '<:labelGreen:917659218037837834>',
  yellow: '<:labelYellow:917659218176266290>',
  red: '<:labelRed:917659218025250826>',
  orange: '<:labelOrange:917659217983340604>',
  lime: '<:labelLime:917659217983315998>',
  purple: '<:labelPurple:917659217450663967>',
  blue: '<:labelBlue:917659217958141963>',
  sky: '<:labelSky:917659218155294760>',
  pink: '<:labelPink:917659218004295720>',
  black: '<:labelBlack:917659217958141962>'
};

export const EMOJIS: Record<string, string> = {
  check: '<:check:632444546684551183>',
  uncheck: '<:uncheck:632444550115491910>'
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../../package.json');

export const VERSION: string = pkg.version;
export const REPOSITORY: string = pkg.repository;

type TrelloPermissionLevel = 'public' | 'private' | 'org' | 'observers';
type TrelloBackgroundBrightness = 'dark' | 'light';
type TrelloBackgroundSize = 'normal' | 'full';
type TrelloColor =
  | 'green'
  | 'yellow'
  | 'red'
  | 'orange'
  | 'lime'
  | 'purple'
  | 'blue'
  | 'sky'
  | 'pink'
  | 'black';

// TODO update board type
export interface TrelloBoard {
  id: string;
  name: string;
  desc?: string;
  starred: boolean;
  subscribed: boolean;
  closed: boolean;
  pinned: boolean;
  shortLink: string;
  shortUrl: string;
  dateLastActivity: string;
  organization?: {
    displayName: string;
    name: string;
    id: string;
  };
  prefs?: {
    backgroundTopColor?: string;
    backgroundImageScaled: TrelloScaledImage[];
    permissionLevel: TrelloPermissionLevel;
    voting: TrelloPermissionLevel;
    comments: TrelloPermissionLevel;
    invitations: TrelloPermissionLevel;
    selfJoin: boolean;
    cardCovers: boolean;
    canBePublic: boolean;
    canBeOrg: boolean;
    canBePrivate: boolean;
    canInvite: boolean;
  };
  lists: TrelloList[];
  cards: TrelloCard[];
}

// TODO update card type
export interface TrelloCard {
  id: string;
  name: string;
  idShort: number;
  desc?: string;
  cover: {
    sharedSourceUrl: string;
    idAttachment?: string;
    edgeColor: string;
    brightness: TrelloBackgroundBrightness;
    size: TrelloBackgroundSize;
    color: TrelloColor;
    imageUrl?: string;
    scaled?: TrelloScaledImage[];
  };
  dueComplete?: boolean;
  due?: string;
  dueReminder?: number | null;
  idAttachmentCover?: string;
  membersVoted: any[]; // TODO
  labels: TrelloLabel[];
  attachments: any[]; // TODO
  stickers: any[]; // TODO
  checklists: any[]; // TODO
  members: any[]; // TODO
  idList: string;
  idLabels: string[];
  shortLink: string;
  shortUrl: string;
  subscribed: boolean;
  closed: boolean;
  pos: number;
}

export interface TrelloList {
  id: string;
  name: string;
  subscribed: boolean;
  closed: boolean;
  pos: number;
}

export interface TrelloLabel {
  id: string;
  name: string;
  color: TrelloColor;
}

export interface TrelloScaledImage {
  width: number;
  height: number;
  url: string;
}

export interface TrelloUser {
  id: number;
  avatarHash?: string;
  fullName?: string;
  avatarUrl?: string;
  username: string;
  initials: string;
}

export enum PrivacySetting {
  PUBLIC = 'public'
}

export interface TrelloBoardStar {
  id: string;
  idBoard: string;
  pos: number;
}

export interface TrelloMember {
  username: string;
  fullName: string;
  avatarUrl?: string;
  url: string;
  id: string;
  initials: string;
  bio?: string;
  idOrganizations: string[];
  products: number[];
  boards: TrelloBoard[];
  boardStars: TrelloBoardStar[];
  prefs?: {
    privacy?: {
      avatar: PrivacySetting;
      fullName: PrivacySetting;
    };
    locale: string;
    colorBlind: boolean;
    sendSummaries: boolean;
  };
  marketingOptIn: { optedIn: boolean };
}


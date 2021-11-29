// TODO update types
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
    backgroundImageScaled: { url: string }[];
    permissionLevel: string;
    comments: string;
    invitations: string;
    voting: string;
    cardCovers: boolean;
    isTemplate: boolean;
    hideVotes: boolean;
    selfJoin: boolean;
  };
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
    colorBlind: boolean;
    sendSummaries: boolean;
    marketingOptIn: { optedIn: boolean };
  };
}

